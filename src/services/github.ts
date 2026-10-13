import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

export interface GitHubCallbackResult {
  success: boolean;
  authenticated_user_id?: string;
  user: {
    id?: number;
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
  synced_count?: number;
}

export interface DiscoveredDeploymentDetail {
  repository: string;
  platform: string;
  url: string;
  environment?: string;
  status?: string;
}

export interface GitHubSyncResult {
  success: boolean;
  count: number;
  repositories_scanned?: number;
  deployments_discovered?: number;
  new_deployments_added?: number;
  deployments_updated?: number;
  deployments_already_stored?: number;
  discovered_details?: DiscoveredDeploymentDetail[];
  synced_at: string;
}


export const githubService = {
  isConfigured(): boolean {
    return config.isGitHubClientConfigured;
  },

  getRedirectUri(): string {
    return typeof window !== 'undefined'
      ? `${window.location.origin}/github/callback`
      : config.github.redirectUri;
  },

  async initiateOAuth(desiredGithubLogin?: string) {
    const clientId = config.github.clientId;
    const redirectUri = this.getRedirectUri();

    if (!clientId) {
      throw new Error('GitHub Client ID not configured. Add VITE_GITHUB_CLIENT_ID to your .env file.');
    }

    // The active Supabase session is authoritative; do not bind state to a stale component prop.
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData?.session?.user;

    if (!currentUser?.id) {
      throw new Error('Please sign in before connecting your GitHub account.');
    }

    const userId = currentUser.id;
    const userEmail = currentUser.email || '';
    const githubLogin = desiredGithubLogin?.trim().replace(/^@/, '');

    // Generate a cryptographically secure, user-bound correlation identifier
    const randomBytes = new Uint8Array(16);
    if (typeof crypto?.getRandomValues === 'function') {
      crypto.getRandomValues(randomBytes);
    }
    const nonce = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('') || Math.random().toString(36).slice(2);
    const attemptId = `oauth_attempt_${Date.now()}_${nonce.slice(0, 8)}`;

    const statePayload = {
      attemptId,
      userId,
      email: userEmail,
      githubLogin: githubLogin || null,
      timestamp: Date.now(),
      nonce,
    };

    const state = 'devos_' + btoa(JSON.stringify(statePayload)).replace(/=/g, '');

    // Persist single-use OAuth state record in Supabase database
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    try {
      await supabase.from('oauth_states').insert({
        user_id: userId,
        state,
        provider: 'github',
        used: false,
        expires_at: expiresAt,
      });
    } catch (dbErr) {
      console.warn('[GitHub OAuth] Non-blocking state record creation warning:', dbErr);
    }

    // Step 2 Diagnostic: Safe initiate log with correlationId (never log tokens/secrets)
    console.log('[DevOS GitHub OAuth Diagnostic: Initiate]', {
      correlationId: attemptId,
      step1_currentSupabaseUserId: userId,
      step2_currentDevOSEmail: userEmail ? `${userEmail.split('@')[0]}@...` : null,
      step3_oauthAttemptId: attemptId,
      redirectUri,
      timestamp: new Date().toISOString(),
    });

    // Store state in localStorage associated specifically with this user ID
    localStorage.setItem(`github_oauth_state_${userId}`, state);
    localStorage.setItem('github_oauth_state', state);
    localStorage.setItem('github_oauth_user_id', userId);
    localStorage.setItem('github_oauth_attempt_id', attemptId);
    localStorage.setItem('github_oauth_state_timestamp', Date.now().toString());
    sessionStorage.setItem('current_github_oauth_attempt_id', attemptId);

    // Clear any previous processed code to allow reconnecting
    sessionStorage.removeItem('github_oauth_processed_code');
    localStorage.removeItem('github_oauth_processed_code');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo user',
      state,
      allow_signup: 'true',
    });
    if (githubLogin) {
      params.set('login', githubLogin);
    }

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  },

  async handleCallback(code: string, state: string): Promise<GitHubCallbackResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData?.session?.user;

    if (!currentUser?.id) {
      throw new Error('Please sign in to complete GitHub authorization.');
    }

    const userId = currentUser.id;
    let attemptId = 'unknown_attempt';

    // Validate state format and ownership
    if (state.startsWith('devos_')) {
      try {
        const rawB64 = state.slice(6);
        const padded = rawB64.padEnd(rawB64.length + (4 - (rawB64.length % 4)) % 4, '=');
        const parsed = JSON.parse(atob(padded)) as { attemptId?: string; userId?: string; timestamp?: number };

        if (parsed.attemptId) {
          attemptId = parsed.attemptId;
        }

        if (parsed.userId && parsed.userId !== userId) {
          localStorage.removeItem(`github_oauth_state_${userId}`);
          localStorage.removeItem('github_oauth_state');
          localStorage.removeItem('github_oauth_state_timestamp');
          throw new Error('OAuth security error: This GitHub authorization was initiated by a different user session. Please connect while signed in as the intended user.');
        }

        if (parsed.timestamp && Date.now() - parsed.timestamp > 15 * 60 * 1000) {
          localStorage.removeItem(`github_oauth_state_${userId}`);
          localStorage.removeItem('github_oauth_state');
          localStorage.removeItem('github_oauth_state_timestamp');
          throw new Error('OAuth state has expired. Please try connecting again.');
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message.includes('OAuth security error')) {
          throw parseErr;
        }
      }
    }

    const storedUserState = localStorage.getItem(`github_oauth_state_${userId}`);
    const storedGenericState = localStorage.getItem('github_oauth_state');
    const stateTimestamp = localStorage.getItem('github_oauth_state_timestamp');

    const expectedState = storedUserState || storedGenericState;

    if (!expectedState || expectedState !== state) {
      localStorage.removeItem(`github_oauth_state_${userId}`);
      localStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_state_timestamp');
      throw new Error('Invalid OAuth state. Please try connecting again.');
    }

    if (stateTimestamp) {
      const age = Date.now() - parseInt(stateTimestamp, 10);
      if (age > 15 * 60 * 1000) {
        localStorage.removeItem(`github_oauth_state_${userId}`);
        localStorage.removeItem('github_oauth_state');
        localStorage.removeItem('github_oauth_state_timestamp');
        throw new Error('OAuth state expired. Please try connecting again.');
      }
    }

    console.log('[DevOS GitHub OAuth Diagnostic: Callback Invoking Edge Function]', {
      correlationId: attemptId,
      step1_currentSupabaseUserId: userId,
      step2_currentDevOSEmail: currentUser.email ? `${currentUser.email.split('@')[0]}@...` : null,
      step3_oauthAttemptId: attemptId,
      step4_oauthStateValidationResult: 'VALID_MATCH',
    });

    const authHeader = sessionData?.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;

    const redirectUri = this.getRedirectUri();

    let data: GitHubCallbackResult | null = null;
    let error: { message: string; context?: { json?: () => Promise<Record<string, unknown>> } } | null = null;

    try {
      const response = await supabase.functions.invoke('github-oauth', {
        headers: {
          ...(authHeader ?? {}),
        },
        body: {
          code,
          client_id: config.github.clientId,
          redirect_uri: redirectUri,
          state,
          attempt_id: attemptId,
        },
      });
      data = response.data as GitHubCallbackResult;
      error = response.error;
    } catch (invokeError) {
      console.error('github-oauth invoke failed', invokeError);
      throw invokeError instanceof Error ? invokeError : new Error('Failed to invoke github-oauth');
    }

    if (error) {
      let message = error.message;
      let details: Record<string, unknown> | null = null;
      try {
        details = (await error.context?.json?.()) || null;
        if (details?.error) message = String(details.error);
      } catch {
        // Fallback to error.message
      }

      console.warn('[DevOS GitHub OAuth Diagnostic: Edge Function Rejected]', {
        correlationId: attemptId,
        step1_currentSupabaseUserId: userId,
        step2_currentDevOSEmail: currentUser.email ? `${currentUser.email.split('@')[0]}@...` : null,
        step3_oauthAttemptId: attemptId,
        step5_actualGithubNumericId: details?.authorized_github_id || null,
        step5_actualGithubUsername: details?.authorized_github_login || null,
        step6_edgeFunctionDevOSUserId: details?.authenticated_user_id || null,
        step7_existingIntegrationOwner: details?.existing_owner_id || null,
        step8_databaseWriteAttempted: details?.database_write_attempted ?? false,
        step9_finalResult: details?.final_result || 'ERROR_REJECTED',
        errorMessage: message,
      });

      const err = new Error(message) as Error & {
        conflict?: boolean;
        existingOwnerEmail?: string;
        authorizedGithubLogin?: string;
      };
      err.conflict = Boolean(details?.conflict);
      if (details?.existing_owner_email) err.existingOwnerEmail = String(details.existing_owner_email);
      if (details?.authorized_github_login) err.authorizedGithubLogin = String(details.authorized_github_login);
      throw err;
    }

    if (!data) {
      throw new Error('No response from GitHub OAuth service');
    }

    console.log('[DevOS GitHub OAuth Diagnostic: Connected Successfully]', {
      correlationId: attemptId,
      step1_currentSupabaseUserId: userId,
      step2_currentDevOSEmail: currentUser.email ? `${currentUser.email.split('@')[0]}@...` : null,
      step3_oauthAttemptId: attemptId,
      step4_oauthStateValidationResult: 'VALID',
      step5_actualGithubNumericId: data.user?.id || null,
      step5_actualGithubUsername: data.user?.login || null,
      step6_edgeFunctionDevOSUserId: data.authenticated_user_id || userId,
      step7_existingIntegrationOwner: null,
      step8_databaseWriteAttempted: true,
      step9_finalResult: 'CONNECTED_SUCCESSFULLY',
    });

    // Clear OAuth state after successful exchange
    localStorage.removeItem(`github_oauth_state_${userId}`);
    localStorage.removeItem('github_oauth_state');
    localStorage.removeItem('github_oauth_user_id');
    localStorage.removeItem('github_oauth_attempt_id');
    localStorage.removeItem('github_oauth_state_timestamp');

    return data;
  },

  async syncRepositories(): Promise<GitHubSyncResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    const authHeader = sessionData?.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;

    if (!authHeader || !user) {
      throw new Error('Please sign in before syncing repositories.');
    }

    try {
      const response = await supabase.functions.invoke('sync-repositories', {
        headers: {
          ...authHeader,
        },
      });

      if (!response.error && response.data?.success) {
        return response.data as GitHubSyncResult;
      }
    } catch {
      // Proceed to resilient client-side discovery fallback
    }

    // Resilient Fallback: Discover directly using authenticated user's session
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'github')
      .maybeSingle();

    if (!integration || !integration.connected) {
      throw new Error('GitHub is not connected for this account. Please connect GitHub first.');
    }

    const metadata = (integration.metadata || {}) as Record<string, unknown>;
    const accessToken = (metadata.token || metadata.access_token) as string | undefined;

    if (!accessToken) {
      throw new Error('GitHub credentials not found. Please reconnect your GitHub account.');
    }

    // Fetch user repos from GitHub API
    const ghResponse = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=100&visibility=all&affiliation=owner,collaborator',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!ghResponse.ok) {
      throw new Error(`GitHub API error (${ghResponse.status}): Failed to fetch repositories`);
    }

    const allRepos = (await ghResponse.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      description?: string | null;
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
    }>;

    const nowIso = new Date().toISOString();
    const repoRows = allRepos.map((repo) => ({
      user_id: user.id,
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

    if (repoRows.length > 0) {
      await supabase
        .from('repositories')
        .upsert(repoRows, { onConflict: 'user_id,github_id' });
    }

    // Fetch repository table UUIDs
    const { data: dbRepos } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('user_id', user.id);

    const repoIdMap = new Map<number, string>();
    for (const r of dbRepos || []) {
      repoIdMap.set(Number(r.github_id), r.id);
    }

    // Auto-discover deployments
    const detectedPlatforms = new Set<string>();
    const discoveredDetailsList: DiscoveredDeploymentDetail[] = [];
    let newDeploymentsAdded = 0;
    let deploymentsUpdated = 0;

    for (const repo of allRepos) {
      const owner = repo.owner?.login || repo.full_name.split('/')[0];
      const repoPushedAt = repo.pushed_at || repo.updated_at || nowIso;
      const dbRepoId = repoIdMap.get(repo.id) || null;

      // Source A: Homepage URL
      if (repo.homepage) {
        let clean = repo.homepage.trim();
        if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
        try {
          const parsed = new URL(clean);
          if (['http:', 'https:'].includes(parsed.protocol) && parsed.hostname !== 'localhost') {
            const host = parsed.hostname.toLowerCase();
            let platform = 'custom';
            if (host.includes('.vercel.app')) platform = 'vercel';
            else if (host.includes('.netlify.app')) platform = 'netlify';
            else if (host.includes('.onrender.com') || host.includes('.render.com')) platform = 'render';
            else if (host.includes('.railway.app') || host.includes('.up.railway.app')) platform = 'railway';
            else if (host.includes('.pages.dev')) platform = 'cloudflare_pages';
            else if (host.includes('.github.io')) platform = 'github_pages';

            detectedPlatforms.add(platform);
            const urlStr = parsed.toString().replace(/\/$/, '');

            discoveredDetailsList.push({
              repository: repo.name,
              platform,
              url: urlStr,
              environment: 'production',
              status: 'live',
            });

            const { data: existing } = await supabase
              .from('deployments')
              .select('id')
              .eq('user_id', user.id)
              .eq('url', urlStr)
              .maybeSingle();

            if (existing) {
              deploymentsUpdated++;
              await supabase
                .from('deployments')
                .update({
                  name: repo.name,
                  platform,
                  provider: platform,
                  status: 'live',
                  environment: 'production',
                  repository_id: dbRepoId,
                  last_deployed_at: repoPushedAt,
                  ssl_status: 'valid',
                  updated_at: nowIso,
                })
                .eq('id', existing.id);
            } else {
              newDeploymentsAdded++;
              await supabase.from('deployments').insert({
                user_id: user.id,
                repository_id: dbRepoId,
                name: repo.name,
                url: urlStr,
                platform,
                provider: platform,
                status: 'live',
                environment: 'production',
                last_deployed_at: repoPushedAt,
                ssl_status: 'valid',
                created_at: nowIso,
                updated_at: nowIso,
              });
            }
          }
        } catch {
          // invalid homepage url ignored
        }
      }

      // Source B: GitHub Pages
      if (repo.has_pages) {
        const pagesUrl = `https://${owner.toLowerCase()}.github.io/${repo.name}`;
        detectedPlatforms.add('github_pages');

        discoveredDetailsList.push({
          repository: `${repo.name} (GitHub Pages)`,
          platform: 'github_pages',
          url: pagesUrl,
          environment: 'production',
          status: 'live',
        });

        const { data: existing } = await supabase
          .from('deployments')
          .select('id')
          .eq('user_id', user.id)
          .eq('url', pagesUrl)
          .maybeSingle();

        if (existing) {
          deploymentsUpdated++;
          await supabase
            .from('deployments')
            .update({
              name: `${repo.name} (GitHub Pages)`,
              platform: 'github_pages',
              provider: 'github',
              status: 'live',
              environment: 'production',
              repository_id: dbRepoId,
              last_deployed_at: repoPushedAt,
              ssl_status: 'valid',
              updated_at: nowIso,
            })
            .eq('id', existing.id);
        } else {
          newDeploymentsAdded++;
          await supabase.from('deployments').insert({
            user_id: user.id,
            repository_id: dbRepoId,
            name: `${repo.name} (GitHub Pages)`,
            url: pagesUrl,
            platform: 'github_pages',
            provider: 'github',
            status: 'live',
            environment: 'production',
            last_deployed_at: repoPushedAt,
            ssl_status: 'valid',
            created_at: nowIso,
            updated_at: nowIso,
          });
        }
      }
    }

    // Auto-register integrations
    const platformDisplayNames: Record<string, string> = {
      vercel: 'Vercel',
      netlify: 'Netlify',
      render: 'Render',
      railway: 'Railway',
      github_pages: 'GitHub Pages',
      cloudflare_pages: 'Cloudflare Pages',
    };

    for (const plat of detectedPlatforms) {
      if (['vercel', 'netlify', 'render', 'railway', 'github_pages', 'cloudflare_pages'].includes(plat)) {
        const platName = platformDisplayNames[plat] || plat;
        await supabase
          .from('integrations')
          .upsert(
            {
              user_id: user.id,
              platform: plat,
              name: platName,
              connected: true,
              connected_at: nowIso,
              last_sync_at: nowIso,
              metadata: {
                auto_discovered: true,
                source: 'github_sync',
                discovered_at: nowIso,
              },
            },
            { onConflict: 'user_id,platform' }
          );
      }
    }

    await supabase
      .from('integrations')
      .update({ last_sync_at: nowIso, updated_at: nowIso })
      .eq('id', integration.id);

    return {
      success: true,
      count: allRepos.length,
      repositories_scanned: allRepos.length,
      deployments_discovered: discoveredDetailsList.length,
      new_deployments_added: newDeploymentsAdded,
      deployments_updated: deploymentsUpdated,
      discovered_details: discoveredDetailsList,
      synced_at: nowIso,
    };
  },


  async isConnected(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'github')
      .eq('connected', true)
      .maybeSingle();

    return !!data;
  },

  async disconnect(userId: string) {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', userId)
      .eq('platform', 'github');

    if (error) throw error;
  },
};
