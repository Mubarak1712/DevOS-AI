export {};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore - Supabase client provided by Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    return new Response(null, { status: 200, headers: corsHeaders });
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

    // 2. Fetch the user's GitHub integration and credential
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', authenticatedUserId)
      .eq('platform', 'github')
      .maybeSingle();

    if (integrationError || !integration || !integration.connected) {
      return new Response(
        JSON.stringify({ error: 'GitHub is not connected for this account. Please connect GitHub first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = (integration.metadata || {}) as Record<string, unknown>;
    const accessToken = (metadata.token || metadata.access_token) as string | undefined;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub credentials not found. Please reconnect your GitHub account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch real repositories from GitHub API with pagination
    const allRepos: GitHubRepoResponse[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 5;

    while (page <= maxPages) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const ghResponse = await fetch(
          `https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}&visibility=all&affiliation=owner,collaborator`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'DevOS-AI',
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (ghResponse.status === 401) {
          // Token expired or revoked
          await supabase
            .from('integrations')
            .update({ connected: false, updated_at: new Date().toISOString() })
            .eq('id', integration.id);

          return new Response(
            JSON.stringify({ error: 'GitHub authorization has expired or was revoked. Please reconnect your account.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (ghResponse.status === 403) {
          const rateRemaining = ghResponse.headers.get('x-ratelimit-remaining');
          if (rateRemaining === '0') {
            return new Response(
              JSON.stringify({ error: 'GitHub API rate limit reached. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (!ghResponse.ok) {
          return new Response(
            JSON.stringify({ error: `GitHub API error (${ghResponse.status}): Failed to fetch repositories` }),
            { status: ghResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const pageData = (await ghResponse.json()) as GitHubRepoResponse[];
        if (!Array.isArray(pageData) || pageData.length === 0) {
          break;
        }

        allRepos.push(...pageData);
        if (pageData.length < perPage) {
          break;
        }
        page += 1;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    }

    // 4. Transform repositories and prepare database rows
    const repositoryRows = allRepos.map((repo) => ({
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
      updated_at: new Date().toISOString(),
    }));

    // 5. Upsert repositories into database
    if (repositoryRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('repositories')
        .upsert(repositoryRows, { onConflict: 'user_id,github_id' });

      if (upsertError) {
        console.error('Error upserting repositories:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to update repositories in database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Reconciliation: clean up repositories for this user that no longer exist on GitHub
    const incomingGithubIds = new Set(allRepos.map((r) => r.id));
    const { data: existingUserRepos } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('user_id', authenticatedUserId);

    if (existingUserRepos && existingUserRepos.length > 0) {
      const idsToDelete = existingUserRepos
        .filter((r) => !incomingGithubIds.has(Number(r.github_id)))
        .map((r) => r.id);

      if (idsToDelete.length > 0) {
        await supabase
          .from('repositories')
          .delete()
          .in('id', idsToDelete)
          .eq('user_id', authenticatedUserId);
      }
    }

    // 7. Update integration last_sync_at
    await supabase
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    // 8. Log activity for the authenticated user
    await supabase.from('activity_logs').insert({
      user_id: authenticatedUserId,
      action: 'synced_repositories',
      resource_type: 'integration',
      details: { count: allRepos.length },
    });

    // 9. Return safe response (NEVER return tokens)
    return new Response(
      JSON.stringify({
        success: true,
        count: allRepos.length,
        synced_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Repository sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error during repository sync' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
