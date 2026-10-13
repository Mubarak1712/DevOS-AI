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
    const configured = getEnvVar('VITE_GITHUB_REDIRECT_URI');
    let redirectUri = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/github/callback`;
    if (configured && !configured.includes('localhost:')) {
      redirectUri = configured;
    } else if (typeof window !== 'undefined') {
      redirectUri = `${window.location.origin}/github/callback`;
    }
    return {
      clientId: getEnvVar('VITE_GITHUB_CLIENT_ID') || '',
      redirectUri,
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
      {
        key: 'VITE_GITHUB_REDIRECT_URI',
        name: 'GitHub Redirect URI',
        category: 'GitHub',
        configured: hasEnvVar('VITE_GITHUB_REDIRECT_URI'),
        required: false,
        description: 'OAuth callback endpoint (falls back automatically to current window origin)',
      },
    ];
  },

  // Server-side secrets (validated via Edge Function, not in browser bundle)
  getServerConfigDocumentation(): ConfigStatus[] {
    return [
      { key: 'SUPABASE_SERVICE_ROLE_KEY', name: 'Supabase Service Role', category: 'Supabase', configured: false, required: true, description: 'Set in Supabase Edge Function secrets' },
      { key: 'GITHUB_CLIENT_SECRET', name: 'GitHub Client Secret', category: 'GitHub', configured: false, required: true, description: 'Set in Supabase Edge Function secrets' },
      { key: 'GROQ_API_KEY', name: 'Groq API Key', category: 'AI', configured: false, required: true, description: 'Set in Supabase Edge Function secrets for AI Studio' },
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
  key?: string;
  category?: string;
  required?: boolean;
  description?: string;
}

const DEFAULT_PROVIDER_CONFIGS: ProviderConfigStatus[] = [
  {
    provider: 'github',
    name: 'GitHub OAuth Client Secret',
    key: 'GITHUB_CLIENT_SECRET',
    category: 'Authentication',
    configured: false,
    required: true,
    description: 'Exchanges OAuth code for user access token to enable repository synchronization',
  },
  {
    provider: 'groq',
    name: 'Groq Cloud API Key',
    key: 'GROQ_API_KEY',
    category: 'AI Services',
    configured: false,
    required: true,
    description: 'Primary LLM provider (Llama 3.3 70B) for DevOS-AI Studio fast idea analysis and specs',
  },
  {
    provider: 'gemini',
    name: 'Google Gemini API Key',
    key: 'GEMINI_API_KEY',
    category: 'AI Services',
    configured: false,
    required: false,
    description: 'High-context fallback provider for deep architectural plans and technical documentation',
  },
  {
    provider: 'supabase',
    name: 'Supabase Service Role Key',
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    category: 'Database & Auth',
    configured: false,
    required: true,
    description: 'Enables administrative backend operations and background Edge Function tasks',
  },
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
