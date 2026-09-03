export {};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore - Supabase client is provided by Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  owner?: { login?: string };
  visibility?: string;
  default_branch?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  topics?: string[];
  private?: boolean;
  fork?: boolean;
  pushed_at?: string;
  updated_at?: string;
  license?: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // 1. Authenticate caller with Supabase Auth
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Empty bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;

    // 2. Validate server secret configuration
    const envSecret = (Deno.env.get('GITHUB_CLIENT_SECRET') || GITHUB_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
    const envClientId = (Deno.env.get('GITHUB_CLIENT_ID') || Deno.env.get('VITE_GITHUB_CLIENT_ID') || '').trim().replace(/^["']|["']$/g, '');

    if (!envSecret) {
      return new Response(
        JSON.stringify({ error: 'GitHub OAuth credentials (GITHUB_CLIENT_SECRET) not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request body
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Request body is empty or invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { code, client_id, redirect_uri, state } = body as {
      code?: string;
      client_id?: string;
      redirect_uri?: string;
      state?: string;
    };

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveClientId = ((client_id || envClientId) as string || '').trim().replace(/^["']|["']$/g, '');
    if (!effectiveClientId) {
      return new Response(
        JSON.stringify({ error: 'client_id is required for GitHub OAuth code exchange' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'redirect_uri is required for GitHub OAuth code exchange' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!state) {
      return new Response(
        JSON.stringify({ error: 'OAuth state parameter is required for CSRF protection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveRedirectUri = (redirect_uri as string).trim();
    const effectiveState = (state as string).trim();
    const effectiveCode = (code as string).trim();

    // 4. Exchange code for access token with GitHub
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DevOS-AI',
      },
      body: JSON.stringify({
        client_id: effectiveClientId,
        client_secret: envSecret,
        code: effectiveCode,
        redirect_uri: effectiveRedirectUri,
        state: effectiveState,
      }),
    });

    const tokenText = await tokenResponse.text();
    let tokenData: any;

    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse GitHub token response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenResponse.ok || tokenData.error) {
      return new Response(
        JSON.stringify({
          error: tokenData.error_description || tokenData.error || 'Failed to exchange authorization code',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub did not return an access token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Fetch user info with the access token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DevOS-AI',
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch GitHub user profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const githubUser = (await userResponse.json()) as Record<string, unknown>;
    const githubUserData = {
      id: typeof githubUser.id === 'number' ? githubUser.id : undefined,
      login: typeof githubUser.login === 'string' ? githubUser.login : undefined,
      name: typeof githubUser.name === 'string' ? githubUser.name : null,
      avatar_url: typeof githubUser.avatar_url === 'string' ? githubUser.avatar_url : null,
      email: typeof githubUser.email === 'string' ? githubUser.email : null,
    };

    // 6. Ensure user record exists in public.users (with upsert)
    await supabase
      .from('users')
      .upsert(
        {
          id: authenticatedUserId,
          email: user.email || githubUserData.email,
          name: githubUserData.name || githubUserData.login || user.email?.split('@')[0],
          avatar_url: githubUserData.avatar_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    // 7. Store integration and securely preserve credential server-side
    const nowIso = new Date().toISOString();
    const { error: integrationError } = await supabase
      .from('integrations')
      .upsert(
        {
          user_id: authenticatedUserId,
          platform: 'github',
          name: 'GitHub',
          connected: true,
          connected_at: nowIso,
          last_sync_at: nowIso,
          metadata: {
            login: githubUserData.login,
            avatar_url: githubUserData.avatar_url,
            github_id: githubUserData.id,
            name: githubUserData.name,
            token: accessToken,
            scope: tokenData.scope,
            token_type: tokenData.token_type,
          },
        },
        { onConflict: 'user_id,platform' }
      );

    if (integrationError) {
      console.error('Failed to save integration record:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Failed to save GitHub integration record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Fetch initial repositories server-side
    let initialRepos: GitHubRepoResponse[] = [];
    try {
      const reposResponse = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=100&page=1&visibility=all&affiliation=owner,collaborator',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'DevOS-AI',
          },
        }
      );

      if (reposResponse.ok) {
        initialRepos = (await reposResponse.json()) as GitHubRepoResponse[];
      }
    } catch (repoFetchErr) {
      console.error('Initial repo fetch warning:', repoFetchErr);
    }

    // 9. Upsert initial repositories to database
    if (Array.isArray(initialRepos) && initialRepos.length > 0) {
      const repoRows = initialRepos.map((repo) => ({
        user_id: authenticatedUserId,
        github_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || null,
        html_url: repo.html_url,
        owner_login: repo.owner?.login || null,
        visibility: repo.visibility || (repo.private ? 'private' : 'public'),
        default_branch: repo.default_branch || 'main',
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        open_issues: repo.open_issues_count || 0,
        language: repo.language || null,
        topics: Array.isArray(repo.topics) ? repo.topics : [],
        is_private: repo.private ?? false,
        is_fork: repo.fork ?? false,
        last_commit_at: repo.pushed_at || null,
        last_activity_at: repo.updated_at || null,
        has_readme: false,
        has_license: !!repo.license,
        updated_at: nowIso,
      }));

      await supabase
        .from('repositories')
        .upsert(repoRows, { onConflict: 'github_id' });
    }

    // 10. Log activity
    await supabase.from('activity_logs').insert({
      user_id: authenticatedUserId,
      action: 'connected_github',
      resource_type: 'integration',
      details: {
        login: githubUserData.login,
        initial_repositories_synced: initialRepos.length,
      },
    });

    // 11. Return ONLY safe metadata to the browser (NEVER return access_token)
    return new Response(
      JSON.stringify({
        success: true,
        authenticated_user_id: authenticatedUserId,
        user: {
          id: githubUserData.id,
          login: githubUserData.login,
          name: githubUserData.name,
          avatar_url: githubUserData.avatar_url,
          email: githubUserData.email,
        },
        synced_count: initialRepos.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
