
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
    const providers = [
      {
        provider: 'vercel',
        name: 'Vercel',
        configured: isSecretConfigured('VERCEL_TOKEN'),
        secretKey: 'VERCEL_TOKEN',
      },
      {
        provider: 'netlify',
        name: 'Netlify',
        configured: isSecretConfigured('NETLIFY_TOKEN'),
        secretKey: 'NETLIFY_TOKEN',
      },
      {
        provider: 'render',
        name: 'Render',
        configured: isSecretConfigured('RENDER_API_KEY'),
        secretKey: 'RENDER_API_KEY',
      },
      {
        provider: 'railway',
        name: 'Railway',
        configured: isSecretConfigured('RAILWAY_TOKEN'),
        secretKey: 'RAILWAY_TOKEN',
      },
      {
        provider: 'github',
        name: 'GitHub (OAuth Secret)',
        configured: isSecretConfigured('GITHUB_CLIENT_SECRET'),
        secretKey: 'GITHUB_CLIENT_SECRET',
      },
      {
        provider: 'groq',
        name: 'Groq',
        configured: isSecretConfigured('GROQ_API_KEY'),
        secretKey: 'GROQ_API_KEY',
      },
      {
        provider: 'gemini',
        name: 'Gemini',
        configured: isSecretConfigured('GEMINI_API_KEY'),
        secretKey: 'GEMINI_API_KEY',
      },
    ];

    return new Response(
      JSON.stringify({
        providers: providers.map(p => ({
          provider: p.provider,
          name: p.name,
          configured: p.configured,
        })),
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
