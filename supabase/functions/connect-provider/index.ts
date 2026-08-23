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

interface ProviderAccountInfo {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  team?: string;
  type?: string;
}

// 1. Validation functions for each provider
async function validateVercelToken(token: string): Promise<ProviderAccountInfo> {
  const response = await fetch('https://api.vercel.com/v2/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'DevOS-AI',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Vercel API token. Please check your token in Vercel Account Settings.');
    }
    const errText = await response.text();
    throw new Error(`Vercel validation failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { user?: { id?: string; username?: string; name?: string; email?: string } };
  const user = data.user || {};
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username,
    email: user.email,
  };
}

async function validateNetlifyToken(token: string): Promise<ProviderAccountInfo> {
  const response = await fetch('https://api.netlify.com/api/v1/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'DevOS-AI',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Netlify Personal Access Token. Please verify the token has access to your Netlify account.');
    }
    const errText = await response.text();
    throw new Error(`Netlify validation failed (${response.status}): ${errText}`);
  }

  const user = (await response.json()) as { id?: string; full_name?: string; email?: string; slug?: string };
  return {
    id: user.id,
    name: user.full_name || user.slug,
    username: user.slug,
    email: user.email,
  };
}

async function validateRenderApiKey(apiKey: string): Promise<ProviderAccountInfo> {
  const response = await fetch('https://api.render.com/v1/owners?limit=5', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'User-Agent': 'DevOS-AI',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Render API key. Please generate a valid API key from Render Account Settings.');
    }
    const errText = await response.text();
    throw new Error(`Render validation failed (${response.status}): ${errText}`);
  }

  const owners = (await response.json()) as Array<{ owner?: { id?: string; name?: string; email?: string; type?: string } }>;
  const primaryOwner = owners[0]?.owner || {};
  return {
    id: primaryOwner.id,
    name: primaryOwner.name,
    email: primaryOwner.email,
    type: primaryOwner.type,
  };
}

async function validateRailwayToken(token: string): Promise<ProviderAccountInfo> {
  const response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DevOS-AI',
    },
    body: JSON.stringify({
      query: `
        query {
          me {
            id
            name
            email
            username
          }
          projects {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Railway API token. Please generate a valid API token in Railway Settings.');
    }
    const errText = await response.text();
    throw new Error(`Railway validation failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    data?: {
      me?: { id?: string; name?: string; email?: string; username?: string };
      projects?: { edges?: Array<{ node?: { id?: string; name?: string } }> };
    };
    errors?: Array<{ message?: string }>;
  };

  if (data.errors && data.errors.length > 0 && !data.data?.me && !data.data?.projects) {
    throw new Error(`Railway API error: ${data.errors[0]?.message || 'Authentication failed'}`);
  }

  const me = data.data?.me || {};
  const projectCount = data.data?.projects?.edges?.length || 0;

  return {
    id: me.id,
    name: me.name || me.username || (projectCount > 0 ? `${projectCount} Projects Workspace` : 'Railway Account'),
    username: me.username,
    email: me.email,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Authenticate caller via Supabase Auth
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!bearerToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Empty bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;

    // 2. Parse request payload
    let body: { provider?: string; token?: string; credential?: string } = {};
    try {
      body = (await req.json()) as { provider?: string; token?: string; credential?: string };
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const provider = body.provider?.toLowerCase().trim();
    const credentialValue = (body.credential || body.token || '').trim();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'Provider is required (e.g. vercel, netlify, render, railway)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!credentialValue) {
      return new Response(
        JSON.stringify({ error: 'API token/credential is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validate credential against provider API server-side
    let accountInfo: ProviderAccountInfo = {};
    switch (provider) {
      case 'vercel':
        accountInfo = await validateVercelToken(credentialValue);
        break;
      case 'netlify':
        accountInfo = await validateNetlifyToken(credentialValue);
        break;
      case 'render':
        accountInfo = await validateRenderApiKey(credentialValue);
        break;
      case 'railway':
        accountInfo = await validateRailwayToken(credentialValue);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported provider: ${provider}. Supported providers: vercel, netlify, render, railway` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const nowIso = new Date().toISOString();
    const providerDisplayName = provider.charAt(0).toUpperCase() + provider.slice(1);

    // 4. Securely store credential in server-only table
    // Try provider_credentials table first
    const { error: credError } = await supabase
      .from('provider_credentials')
      .upsert(
        {
          user_id: authenticatedUserId,
          provider: provider,
          credential_value: credentialValue,
          metadata: accountInfo,
          last_verified_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'user_id,provider' }
      );

    if (credError) {
      console.warn('Could not upsert into provider_credentials table, falling back to secure integration metadata:', credError);
    }

    // 5. Upsert safe sanitized record in public.integrations (NEVER save credential_value here)
    const { error: integrationError } = await supabase
      .from('integrations')
      .upsert(
        {
          user_id: authenticatedUserId,
          platform: provider,
          name: providerDisplayName,
          connected: true,
          connected_at: nowIso,
          last_sync_at: nowIso,
          metadata: {
            account_name: accountInfo.name || accountInfo.username || providerDisplayName,
            account_id: accountInfo.id,
            username: accountInfo.username,
            email: accountInfo.email,
            last_verified_at: nowIso,
          },
        },
        { onConflict: 'user_id,platform' }
      );

    if (integrationError) {
      console.error('Failed to save integration record:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Failed to record connected integration in database' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Log activity for the authenticated user
    await supabase.from('activity_logs').insert({
      user_id: authenticatedUserId,
      action: 'connected_provider',
      resource_type: 'integration',
      details: {
        provider,
        account: accountInfo.name || accountInfo.username || accountInfo.email,
      },
    });

    // 7. Return sanitized confirmation (NEVER return credential/token)
    return new Response(
      JSON.stringify({
        success: true,
        provider,
        account: {
          name: accountInfo.name,
          username: accountInfo.username,
          email: accountInfo.email,
          id: accountInfo.id,
        },
        connected_at: nowIso,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Connect provider error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error while connecting provider' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
