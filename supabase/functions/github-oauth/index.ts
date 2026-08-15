declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET') || '';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!GITHUB_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'GitHub OAuth credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: Record<string, unknown> = {};

try {
  body = (await req.json()) as Record<string, unknown>;
} catch (err) {
  console.error("Invalid request body", err);

  return new Response(
    JSON.stringify({
      error: "Request body is empty or invalid JSON"
    }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

const { code, client_id, redirect_uri } = body as {
  code?: string;
  client_id?: string;
  redirect_uri?: string;
};
    console.log('GitHub OAuth edge function request', { redirect_uri });

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client_id) {
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

    // Exchange code for access token
    console.log("Client ID:", client_id);
    console.log("Redirect URI:", redirect_uri);
    console.log("Secret exists:", !!GITHUB_CLIENT_SECRET);
    console.log("Secret length:", GITHUB_CLIENT_SECRET.length);

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri,
      }),
    });

    const tokenText = await tokenResponse.text();
    let tokenData: any;

    try {
      tokenData = JSON.parse(tokenText);
    } catch (parseError) {
      console.error('GitHub token exchange parse error:', parseError, tokenText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse GitHub token response', details: tokenText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenResponse.ok || tokenData.error) {
      console.error('GitHub token exchange failed:', tokenResponse.status, tokenData);
      return new Response(
        JSON.stringify({
          error: tokenData.error_description || tokenData.error || 'Failed to exchange authorization code',
          details: {
            status: tokenResponse.status,
            redirect_uri,
            tokenData,
          },
        }),
        { status: tokenResponse.ok ? 400 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData);
      return new Response(
        JSON.stringify({
          error: tokenData.error_description || tokenData.error,
          details: {
            redirect_uri,
            tokenData,
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user info with the access token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    let userData: {
      id?: number;
      login?: string;
      name?: string | null;
      avatar_url?: string | null;
      email?: string | null;
    } | null = null;
    if (userResponse.ok) {
      const githubUser = (await userResponse.json()) as Record<string, unknown>;
      userData = {
        id: typeof githubUser.id === 'number' ? githubUser.id : undefined,
        login: typeof githubUser.login === 'string' ? githubUser.login : undefined,
        name: typeof githubUser.name === 'string' ? githubUser.name : null,
        avatar_url: typeof githubUser.avatar_url === 'string' ? githubUser.avatar_url : null,
        email: typeof githubUser.email === 'string' ? githubUser.email : null,
      };
    }

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        user: userData ? {
          id: userData.id,
          login: userData.login,
          name: userData.name,
          avatar_url: userData.avatar_url,
          email: userData.email,
        } : null,
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
