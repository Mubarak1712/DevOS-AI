
export{};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Check if secrets are configured (without exposing their values)
function isSecretConfigured(secretName: string): boolean {
  const value = Deno.env.get(secretName);
  return typeof value === 'string' && value.length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let groqModels: string[] = [];
    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (groqKey) {
      try {
        const mRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${groqKey}` }
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          groqModels = (mData?.data || []).map((m: { id: string }) => m.id);
        }
      } catch (err) {
        console.error('Failed to list groq models:', err);
      }
    }

    const providers = [
      {
        provider: 'github',
        name: 'GitHub OAuth Client Secret',
        key: 'GITHUB_CLIENT_SECRET',
        category: 'Authentication',
        configured: isSecretConfigured('GITHUB_CLIENT_SECRET'),
        required: true,
        description: 'Exchanges OAuth code for user access token to enable repository synchronization',
      },
      {
        provider: 'groq',
        name: 'Groq Cloud API Key',
        key: 'GROQ_API_KEY',
        category: 'AI Services',
        configured: isSecretConfigured('GROQ_API_KEY'),
        required: true,
        description: 'Primary LLM provider (Llama 3.3 70B) for DevOS-AI Studio fast idea analysis and specs',
      },
      {
        provider: 'gemini',
        name: 'Google Gemini API Key',
        key: 'GEMINI_API_KEY',
        category: 'AI Services',
        configured: isSecretConfigured('GEMINI_API_KEY'),
        required: false,
        description: 'High-context fallback provider for deep architectural plans and technical documentation',
      },
      {
        provider: 'supabase',
        name: 'Supabase Service Role Key',
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        category: 'Database & Auth',
        configured: isSecretConfigured('SUPABASE_SERVICE_ROLE_KEY'),
        required: true,
        description: 'Enables administrative backend operations and background Edge Function tasks',
      },
    ];

    return new Response(
      JSON.stringify({
        ok: true,
        providers,
        groqModels,
        deploymentMode: 'zero-token',
        deploymentMessage: 'Deployments are automatically detected via GitHub commit statuses and DNS probe headers without requiring third-party provider API tokens.',
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Check provider config error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
