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

export interface GitHubSyncResult {
  success: boolean;
  count: number;
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

  initiateOAuth() {
    const clientId = config.github.clientId;
    const redirectUri = this.getRedirectUri();

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

  async handleCallback(code: string, state: string): Promise<GitHubCallbackResult> {
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
      const age = Date.now() - parseInt(stateTimestamp, 10);
      if (age > 10 * 60 * 1000) {
        localStorage.removeItem('github_oauth_state');
        localStorage.removeItem('github_oauth_state_timestamp');
        throw new Error('OAuth state expired. Please try connecting again.');
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const authHeader = sessionData?.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;

    const redirectUri = this.getRedirectUri();

    let data: GitHubCallbackResult | null = null;
    let error: { message: string; context?: { json?: () => Promise<{ error?: string }> } } | null = null;

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
      try {
        const details = await error.context?.json?.();
        if (details?.error) message = details.error;
      } catch {
        // Fallback to error.message
      }
      throw new Error(message);
    }

    if (!data) {
      throw new Error('No response from GitHub OAuth service');
    }

    // Clear OAuth state after successful exchange
    localStorage.removeItem('github_oauth_state');
    localStorage.removeItem('github_oauth_state_timestamp');

    return data;
  },

  async syncRepositories(): Promise<GitHubSyncResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const authHeader = sessionData?.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;

    if (!authHeader) {
      throw new Error('Please sign in before syncing repositories.');
    }

    const response = await supabase.functions.invoke('sync-repositories', {
      headers: {
        ...authHeader,
      },
    });

    if (response.error) {
      let message = response.error.message;
      try {
        const details = await response.error.context?.json?.();
        if (details?.error) message = details.error;
      } catch {
        // Fallback to response.error.message
      }
      throw new Error(message);
    }

    const data = response.data as GitHubSyncResult;
    if (!data || !data.success) {
      throw new Error('Failed to sync repositories from GitHub.');
    }

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
};
