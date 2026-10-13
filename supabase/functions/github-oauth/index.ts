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
  homepage?: string | null;
  has_pages?: boolean;
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

interface DiscoveredDeployment {
  name: string;
  url: string;
  platform: string;
  provider: string;
  status: string;
  environment: string;
  lastDeployedAt: string;
  repoGithubId: number;
}

function cleanUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return null;
    }
    if (hostname === 'github.com' && !parsed.pathname.includes('/releases')) {
      return null;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function detectPlatform(url: string, rawDescription?: string): { platform: string; provider: string } {
  const lowerUrl = url.toLowerCase();
  const desc = (rawDescription || '').toLowerCase();

  if (lowerUrl.includes('.vercel.app') || desc.includes('vercel')) {
    return { platform: 'vercel', provider: 'vercel' };
  }
  if (lowerUrl.includes('.netlify.app') || desc.includes('netlify')) {
    return { platform: 'netlify', provider: 'netlify' };
  }
  if (lowerUrl.includes('.onrender.com') || lowerUrl.includes('.render.com') || desc.includes('render')) {
    return { platform: 'render', provider: 'render' };
  }
  if (lowerUrl.includes('.railway.app') || lowerUrl.includes('.up.railway.app') || desc.includes('railway')) {
    return { platform: 'railway', provider: 'railway' };
  }
  if (lowerUrl.includes('.pages.dev') || desc.includes('cloudflare')) {
    return { platform: 'cloudflare_pages', provider: 'cloudflare' };
  }
  if (lowerUrl.includes('.github.io')) {
    return { platform: 'github_pages', provider: 'github' };
  }
  if (lowerUrl.includes('.firebaseapp.com') || lowerUrl.includes('.web.app')) {
    return { platform: 'firebase', provider: 'firebase' };
  }
  if (lowerUrl.includes('.amplifyapp.com')) {
    return { platform: 'aws_amplify', provider: 'aws' };
  }
  if (lowerUrl.includes('.herokuapp.com')) {
    return { platform: 'heroku', provider: 'heroku' };
  }
  if (lowerUrl.includes('.fly.dev')) {
    return { platform: 'fly_io', provider: 'fly' };
  }
  return { platform: 'custom', provider: 'custom' };
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

    const { code, client_id, redirect_uri, state, attempt_id } = body as {
      code?: string;
      client_id?: string;
      redirect_uri?: string;
      state?: string;
      attempt_id?: string;
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

    // 4. Validate state user-binding and single-use server record
    let stateUserId: string | null = null;
    let stateTimestamp: number | null = null;
    let stateAttemptId: string | null = null;
    let expectedGithubLogin: string | null = null;

    if (effectiveState.startsWith('devos_')) {
      try {
        const rawB64 = effectiveState.slice(6);
        const padded = rawB64.padEnd(rawB64.length + (4 - (rawB64.length % 4)) % 4, '=');
        const decodedStr = atob(padded);
        const parsedState = JSON.parse(decodedStr) as {
          attemptId?: string;
          userId?: string;
          timestamp?: number;
          githubLogin?: string | null;
        };
        stateUserId = parsedState.userId || null;
        stateTimestamp = parsedState.timestamp || null;
        stateAttemptId = parsedState.attemptId || null;
        expectedGithubLogin = parsedState.githubLogin?.trim() || null;
      } catch (stateErr) {
        console.warn('Could not parse devos_ state JSON:', stateErr);
      }
    }

    const correlationId = attempt_id || stateAttemptId || `attempt_${Date.now()}`;

    if (stateUserId && stateUserId !== authenticatedUserId) {
      return new Response(
        JSON.stringify({
          error: 'OAuth security validation error: The GitHub authorization was initiated by a different user session. Please reconnect while signed in as the intended user.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (stateTimestamp && Date.now() - stateTimestamp > 15 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: 'OAuth state has expired. Please initiate the GitHub connection again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side single-use verification against public.oauth_states table
    try {
      const { data: stateRecord } = await supabase
        .from('oauth_states')
        .select('id, user_id, used, expires_at')
        .eq('state', effectiveState)
        .maybeSingle();

      if (stateRecord) {
        if (stateRecord.used) {
          return new Response(
            JSON.stringify({
              error: 'OAuth security error: This authorization state token has already been consumed. Please initiate a new connection request.',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (stateRecord.user_id !== authenticatedUserId) {
          return new Response(
            JSON.stringify({
              error: 'OAuth security error: State record user mismatch. The authorization was started by a different user.',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (new Date(stateRecord.expires_at).getTime() < Date.now()) {
          return new Response(
            JSON.stringify({ error: 'OAuth state has expired. Please initiate a new connection request.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Mark state as consumed immediately (enforces strict single-use)
        await supabase
          .from('oauth_states')
          .update({ used: true })
          .eq('id', stateRecord.id);
      }
    } catch (stateDbErr) {
      console.warn('oauth_states single-use check warning:', stateDbErr);
    }

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

    if (
      expectedGithubLogin &&
      expectedGithubLogin.toLowerCase() !== String(githubUserData.login || '').toLowerCase()
    ) {
      console.warn('[DevOS GitHub OAuth Diagnostic: Account Selection Mismatch]', {
        correlationId,
        step1_currentSupabaseUserId: authenticatedUserId,
        step2_currentDevOSEmail: user.email || null,
        step3_oauthAttemptId: correlationId,
        step4_oauthStateValidationResult: 'VALID',
        step5_actualGithubNumericId: githubUserData.id || null,
        step5_actualGithubUsername: githubUserData.login || null,
        step6_edgeFunctionDevOSUserId: authenticatedUserId,
        step7_existingIntegrationOwnerForGithubId: null,
        step8_databaseWriteAttempted: false,
        step9_finalResult: 'REJECTED_ACCOUNT_SELECTION_MISMATCH',
      });

      return new Response(
        JSON.stringify({
          error: `GitHub authorized @${githubUserData.login || 'unknown'}, which does not match the requested account @${expectedGithubLogin}. No integration or repositories were saved.`,
          account_mismatch: true,
          correlation_id: correlationId,
          authenticated_user_id: authenticatedUserId,
          authorized_github_id: githubUserData.id,
          authorized_github_login: githubUserData.login,
          requested_github_login: expectedGithubLogin,
          database_write_attempted: false,
          final_result: 'REJECTED_ACCOUNT_SELECTION_MISMATCH',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Prevent cross-user account conflict: Check if this GitHub identity is already registered by another user
    const { data: existingIntegrations } = await supabase
      .from('integrations')
      .select('id, user_id, platform, connected, metadata')
      .eq('platform', 'github');

    const conflictingIntegration = (existingIntegrations || []).find((rec: any) => {
      // Reconnecting own account is never a conflict
      if (rec.user_id === authenticatedUserId) return false;

      const meta = (rec.metadata || {}) as Record<string, unknown>;
      const existingGithubId = meta.github_id;
      const existingLogin = String(meta.login || meta.username || '').toLowerCase();
      const currentLogin = String(githubUserData.login || '').toLowerCase();

      const sameNumericId = Boolean(
        githubUserData.id &&
        existingGithubId &&
        String(existingGithubId) === String(githubUserData.id)
      );

      const sameLogin = Boolean(
        currentLogin &&
        existingLogin &&
        existingLogin === currentLogin
      );

      return sameNumericId || sameLogin;
    });

    if (conflictingIntegration) {
      let existingOwnerEmail = 'another DevOS account';
      try {
        const { data: ownerUser } = await supabase
          .from('users')
          .select('email')
          .eq('id', conflictingIntegration.user_id)
          .maybeSingle();
        if (ownerUser?.email) {
          existingOwnerEmail = ownerUser.email;
        }
      } catch (ownerErr) {
        console.warn('Error fetching conflicting owner email:', ownerErr);
      }

      // Step 2 Diagnostic: Collision decision
      console.warn('[DevOS GitHub OAuth Diagnostic: Backend Decision]', {
        correlationId,
        step1_currentSupabaseUserId: authenticatedUserId,
        step2_currentDevOSEmail: user.email || null,
        step3_oauthAttemptId: correlationId,
        step4_oauthStateValidationResult: 'STATE_VALID_AND_CONSUMED',
        step5_actualGithubNumericId: githubUserData.id || null,
        step5_actualGithubUsername: githubUserData.login || null,
        step6_edgeFunctionDevOSUserId: authenticatedUserId,
        step7_existingIntegrationOwnerForGithubId: conflictingIntegration.user_id,
        step8_databaseWriteAttempted: false,
        step9_finalResult: 'REJECTED_COLLISION_ALREADY_CONNECTED',
      });

      return new Response(
        JSON.stringify({
          error: `The GitHub account @${githubUserData.login || 'developer'} is already connected to another DevOS account (${existingOwnerEmail}). To protect account security, each GitHub account can only be connected to one DevOS account. If you want to connect your personal GitHub account to this DevOS account, please sign out of GitHub.com in your browser first and try connecting again.`,
          conflict: true,
          correlation_id: correlationId,
          authenticated_user_id: authenticatedUserId,
          authorized_github_id: githubUserData.id,
          authorized_github_login: githubUserData.login,
          existing_owner_id: conflictingIntegration.user_id,
          existing_owner_email: existingOwnerEmail,
          database_write_attempted: false,
          final_result: 'REJECTED_COLLISION',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Ensure user record exists in public.users (with upsert)
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
        .upsert(repoRows, { onConflict: 'user_id,github_id' });

      console.log('[github-oauth save]', {
        authenticatedDevOSUserId: authenticatedUserId,
        githubNumericId: githubUserData.id,
        githubLogin: githubUserData.login,
        savedIntegrationForUserId: authenticatedUserId,
        reposSyncedCount: initialRepos.length,
      });

      // Fetch repository database UUIDs for linking
      const { data: userDbRepos } = await supabase
        .from('repositories')
        .select('id, github_id')
        .eq('user_id', authenticatedUserId);

      const repoIdMap = new Map<number, string>();
      for (const r of userDbRepos || []) {
        repoIdMap.set(Number(r.github_id), r.id);
      }

      // Discover deployments from initial repos
      const discoveredDeployments: DiscoveredDeployment[] = [];
      const discoveredPlatforms = new Set<string>();

      for (const repo of initialRepos) {
        const owner = repo.owner?.login || repo.full_name.split('/')[0];
        const repoName = repo.name;
        const repoPushedAt = repo.pushed_at || repo.updated_at || nowIso;

        // Source A: Homepage URL
        const cleanHomepage = cleanUrl(repo.homepage);
        if (cleanHomepage) {
          const { platform, provider } = detectPlatform(cleanHomepage, repo.description || '');
          discoveredPlatforms.add(platform);
          discoveredDeployments.push({
            name: repo.name,
            url: cleanHomepage,
            platform,
            provider,
            status: 'live',
            environment: 'production',
            lastDeployedAt: repoPushedAt,
            repoGithubId: repo.id,
          });
        }

        // Source B: GitHub Pages
        if (repo.has_pages) {
          const pagesUrl = `https://${owner.toLowerCase()}.github.io/${repoName}`;
          discoveredPlatforms.add('github_pages');
          discoveredDeployments.push({
            name: `${repo.name} (GitHub Pages)`,
            url: pagesUrl,
            platform: 'github_pages',
            provider: 'github',
            status: 'live',
            environment: 'production',
            lastDeployedAt: repoPushedAt,
            repoGithubId: repo.id,
          });
        }
      }

      // Upsert discovered deployments
      for (const d of discoveredDeployments) {
        const dbRepoId = repoIdMap.get(d.repoGithubId) || null;
        const { data: existing } = await supabase
          .from('deployments')
          .select('id')
          .eq('user_id', authenticatedUserId)
          .eq('url', d.url)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('deployments')
            .update({
              name: d.name,
              platform: d.platform,
              provider: d.provider,
              status: d.status,
              environment: d.environment,
              repository_id: dbRepoId,
              last_deployed_at: d.lastDeployedAt,
              ssl_status: 'valid',
              updated_at: nowIso,
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('deployments').insert({
            user_id: authenticatedUserId,
            repository_id: dbRepoId,
            name: d.name,
            url: d.url,
            platform: d.platform,
            provider: d.provider,
            status: d.status,
            environment: d.environment,
            last_deployed_at: d.lastDeployedAt,
            ssl_status: 'valid',
            created_at: nowIso,
            updated_at: nowIso,
          });
        }
      }

      // Auto-register discovered platforms
      const platformDisplayNames: Record<string, string> = {
        vercel: 'Vercel',
        netlify: 'Netlify',
        render: 'Render',
        railway: 'Railway',
        github_pages: 'GitHub Pages',
        cloudflare_pages: 'Cloudflare Pages',
      };

      for (const plat of discoveredPlatforms) {
        if (['vercel', 'netlify', 'render', 'railway', 'github_pages', 'cloudflare_pages'].includes(plat)) {
          const platName = platformDisplayNames[plat] || plat;
          await supabase
            .from('integrations')
            .upsert(
              {
                user_id: authenticatedUserId,
                platform: plat,
                name: platName,
                connected: true,
                connected_at: nowIso,
                last_sync_at: nowIso,
                metadata: {
                  auto_discovered: true,
                  source: 'github_oauth_init',
                  discovered_at: nowIso,
                },
              },
              { onConflict: 'user_id,platform' }
            );
        }
      }
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

    // Step 2 Diagnostic: Successful connection
    console.log('[DevOS GitHub OAuth Diagnostic: Backend Decision]', {
      correlationId,
      step1_currentSupabaseUserId: authenticatedUserId,
      step2_currentDevOSEmail: user.email || null,
      step3_oauthAttemptId: correlationId,
      step4_oauthStateValidationResult: 'STATE_VALID_AND_CONSUMED',
      step5_actualGithubNumericId: githubUserData.id || null,
      step5_actualGithubUsername: githubUserData.login || null,
      step6_edgeFunctionDevOSUserId: authenticatedUserId,
      step7_existingIntegrationOwnerForGithubId: null,
      step8_databaseWriteAttempted: true,
      step9_finalResult: 'CONNECTED_SUCCESSFULLY',
    });

    // 11. Return ONLY safe metadata to the browser (NEVER return access_token)
    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        authenticated_user_id: authenticatedUserId,
        user: {
          id: githubUserData.id,
          login: githubUserData.login,
          name: githubUserData.name,
          avatar_url: githubUserData.avatar_url,
          email: githubUserData.email,
        },
        synced_count: initialRepos.length,
        database_write_attempted: true,
        final_result: 'SUCCESS',
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
