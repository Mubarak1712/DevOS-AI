import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

export const githubService = {
  isConfigured(): boolean {
    return config.isGitHubClientConfigured;
  },

  initiateOAuth() {
    const clientId = config.github.clientId;
    const redirectUri = config.github.redirectUri;

    if (!clientId) {
      throw new Error('GitHub Client ID not configured. Add VITE_GITHUB_CLIENT_ID to your .env file.');
    }

    // Generate a unique state
    const state = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

    // Store state in localStorage with timestamp
    localStorage.setItem('github_oauth_state', state);
    localStorage.setItem('github_oauth_state_timestamp', Date.now().toString());
    
    // Clear any previous processed code to allow reconnecting
    sessionStorage.removeItem('github_oauth_processed_code');
    localStorage.removeItem('github_oauth_processed_code');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo user',
      state,
    });

    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  },

  async handleCallback(code: string, state: string) {
    const storedState = localStorage.getItem('github_oauth_state');
    const stateTimestamp = localStorage.getItem('github_oauth_state_timestamp');
    
    // Check if state is valid
    if (!storedState || storedState !== state) {
      localStorage.removeItem('github_oauth_state');
      localStorage.removeItem('github_oauth_state_timestamp');
      throw new Error('Invalid OAuth state. Please try connecting again.');
    }

    // Check if state is too old (older than 10 minutes)
    if (stateTimestamp) {
      const age = Date.now() - parseInt(stateTimestamp);
      if (age > 10 * 60 * 1000) {
        localStorage.removeItem('github_oauth_state');
        localStorage.removeItem('github_oauth_state_timestamp');
        throw new Error('OAuth state expired. Please try connecting again.');
      }
    }

    let data;
    let error;

    const { data: sessionData } = await supabase.auth.getSession();
    const authHeader = sessionData?.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;

    try {
      const response = await supabase.functions.invoke('github-oauth', {
        headers: {
          ...(authHeader ?? {}),
        },
        body: {
          code,
          client_id: config.github.clientId,
          redirect_uri: config.github.redirectUri,
        },
      });
      data = response.data;
      error = response.error;
    } catch (invokeError) {
      console.error('STEP A ERROR: github-oauth invoke failed', invokeError);
      throw invokeError instanceof Error ? invokeError : new Error('Failed to invoke github-oauth');
    }

    if (error) {
      let message = error.message;
      try {
        const details = await error.context?.json?.();
        if (details?.error) message = details.error;
      } catch (parseError) {
        console.error('STEP B ERROR: Failed to parse error context JSON', parseError);
      }
      throw new Error(message);
    }

    if (!data) {
      throw new Error('No response from OAuth service');
    }

    if (data.error) {
      throw new Error(data.error);
    }

    // Clear OAuth state after successful exchange
    localStorage.removeItem('github_oauth_state');
    localStorage.removeItem('github_oauth_state_timestamp');
    
    return data;
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

  async fetchRepositories(accessToken: string) {
    const repositories: Record<string, unknown>[] = [];
    let page = 1;
    const perPage = 100;

    while (page <= 5) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(
          `https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}&visibility=all&affiliation=owner,collaborator`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.mercy-preview+json',
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch repositories: ${response.status} ${errorText}`);
        }

        const pageRepos = await response.json();
        if (!Array.isArray(pageRepos) || pageRepos.length === 0) break;

        repositories.push(...pageRepos);
        if (pageRepos.length < perPage) break;
        page += 1;
      } finally {
        clearTimeout(timeout);
      }
    }

    return repositories as Array<{
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
    }>;
  },

  async fetchUserInfo(accessToken: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      return response.json() as Promise<{
        id: number;
        login: string;
        name: string | null;
        avatar_url: string;
      }>;
    } finally {
      clearTimeout(timeout);
    }
  },
};
