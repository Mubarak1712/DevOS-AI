// Environment Configuration Service
// Only VITE_ prefixed variables are accessible in the browser.
// Server-side secrets (GITHUB_CLIENT_SECRET, provider tokens) must be accessed via Edge Functions.

import { supabase } from '@/lib/supabase';

export interface ClientConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  github: {
    clientId: string;
    redirectUri: string;
  };
}

export interface ConfigStatus {
  key: string;
  name: string;
  category: string;
  configured: boolean;
  required: boolean;
  description: string;
}

function getEnvVar(key: string): string | undefined {
  return import.meta.env[key];
}

function hasEnvVar(key: string): boolean {
  const value = getEnvVar(key);
  return typeof value === 'string' && value.length > 0;
}

// Client-side config - only VITE_ prefixed variables
export const config = {
  get supabase() {
    return {
      url: getEnvVar('VITE_SUPABASE_URL') || '',
      anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY') || '',
    };
  },

  get github() {
    return {
      clientId: getEnvVar('VITE_GITHUB_CLIENT_ID') || '',
      redirectUri:
        getEnvVar('VITE_GITHUB_REDIRECT_URI') || `${window.location.origin}/github/callback`,
    };
  },

  // Check if Supabase is properly configured
  get isSupabaseConfigured(): boolean {
    return hasEnvVar('VITE_SUPABASE_URL') && hasEnvVar('VITE_SUPABASE_ANON_KEY');
  },

  // Check if GitHub OAuth client ID is configured (client-side only)
  get isGitHubClientConfigured(): boolean {
    return hasEnvVar('VITE_GITHUB_CLIENT_ID');
  },

  // Get client-side configuration statuses
  getClientConfigStatuses(): ConfigStatus[] {
    return [
      {
        key: 'VITE_SUPABASE_URL',
        name: 'Supabase URL',
        category: 'Supabase',
        configured: hasEnvVar('VITE_SUPABASE_URL'),
        required: true,
        description: 'Your Supabase project URL',
      },
      {
        key: 'VITE_SUPABASE_ANON_KEY',
        name: 'Supabase Anon Key',
        category: 'Supabase',
        configured: hasEnvVar('VITE_SUPABASE_ANON_KEY'),
        required: true,
        description: 'Your Supabase anonymous key',
      },
      {
        key: 'VITE_GITHUB_CLIENT_ID',
        name: 'GitHub Client ID',
        category: 'GitHub',
        configured: hasEnvVar('VITE_GITHUB_CLIENT_ID'),
        required: false,
        description: 'GitHub OAuth App Client ID',
      },
    ];
  },

  // Server-side secrets (validated via Edge Function, not in browser bundle)
  getServerConfigDocumentation(): ConfigStatus[] {
    return [
      { key: 'SUPABASE_SERVICE_ROLE_KEY', name: 'Supabase Service Role', category: 'Supabase', configured: false, required: true, description: 'Set in Supabase Edge Function secrets' },
      { key: 'GITHUB_CLIENT_SECRET', name: 'GitHub Client Secret', category: 'GitHub', configured: false, required: false, description: 'Set in Supabase Edge Function secrets' },
      { key: 'VERCEL_TOKEN', name: 'Vercel Token', category: 'Deployments', configured: false, required: false, description: 'Set in Supabase Edge Function secrets' },
      { key: 'NETLIFY_TOKEN', name: 'Netlify Token', category: 'Deployments', configured: false, required: false, description: 'Set in Supabase Edge Function secrets' },
      { key: 'RAILWAY_TOKEN', name: 'Railway Token', category: 'Deployments', configured: false, required: false, description: 'Set in Supabase Edge Function secrets' },
      { key: 'RENDER_API_KEY', name: 'Render API Key', category: 'Deployments', configured: false, required: false, description: 'Set in Supabase Edge Function secrets (RENDER_API_KEY)' },
      { key: 'GROQ_API_KEY', name: 'Groq API Key', category: 'AI', configured: false, required: false, description: 'Set in Supabase Edge Function secrets for AI Studio' },
      { key: 'GEMINI_API_KEY', name: 'Gemini API Key', category: 'AI', configured: false, required: false, description: 'Set in Supabase Edge Function secrets for AI Studio' },
    ];
  },

  getAllConfigDocumentation(): ConfigStatus[] {
    return [...this.getClientConfigStatuses(), ...this.getServerConfigDocumentation()];
  },

  getMissingRequiredConfigs(): ConfigStatus[] {
    return this.getClientConfigStatuses().filter(c => c.required && !c.configured);
  },

  // Check if app is ready to run
  get isReady(): boolean {
    return this.getMissingRequiredConfigs().length === 0;
  },
};

// Provider configuration status - fetched from server via Edge Function
export interface ProviderConfigStatus {
  provider: string;
  name: string;
  configured: boolean;
}

const DEFAULT_PROVIDER_CONFIGS: ProviderConfigStatus[] = [
  { provider: 'vercel', name: 'Vercel', configured: false },
  { provider: 'netlify', name: 'Netlify', configured: false },
  { provider: 'render', name: 'Render', configured: false },
  { provider: 'railway', name: 'Railway', configured: false },
  { provider: 'github', name: 'GitHub (OAuth Secret)', configured: false },
  { provider: 'groq', name: 'Groq', configured: false },
  { provider: 'gemini', name: 'Gemini', configured: false },
];

// Fetch provider configuration status from server (with timeout so UI never hangs)
export async function fetchProviderConfigStatus(): Promise<ProviderConfigStatus[]> {
  const timeoutMs = 8000;

  const fetchConfigs = async () => {
    const { data, error } = await supabase.functions.invoke('check-provider-config');
    if (error) throw error;
    return (data?.providers as ProviderConfigStatus[] | undefined) ?? DEFAULT_PROVIDER_CONFIGS;
  };

  try {
    return await Promise.race([
      fetchConfigs(),
      new Promise<ProviderConfigStatus[]>((_, reject) => {
        setTimeout(() => reject(new Error('Provider config check timed out')), timeoutMs);
      }),
    ]);
  } catch (err) {
    console.error('Failed to fetch provider config status:', err);
    return DEFAULT_PROVIDER_CONFIGS;
  }
}
