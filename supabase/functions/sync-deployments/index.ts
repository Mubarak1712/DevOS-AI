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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

interface ProviderDeploymentItem {
  id: string;
  name: string;
  url: string;
  status: string;
  environment: string;
  lastDeployedAt?: string;
  platform: string;
  branch?: string;
}

// 1. Provider Fetchers
async function fetchVercelDeployments(token: string): Promise<ProviderDeploymentItem[]> {
  const response = await fetch('https://api.vercel.com/v13/deployments?limit=100', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'DevOS-AI',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Vercel API token is invalid or has expired.');
    }
    const errText = await response.text();
    throw new Error(`Vercel API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { deployments?: Array<Record<string, unknown>> };
  return (data.deployments ?? []).map((d: any) => ({
    id: String(d.uid || d.id),
    name: String(d.name || 'Untitled'),
    url: d.url ? (d.url.startsWith('http') ? d.url : `https://${d.url}`) : `https://${d.name}.vercel.app`,
    status: mapVercelStatus(String(d.state || '')),
    environment: d.target === 'production' ? 'production' : 'preview',
    lastDeployedAt: d.created ? new Date(d.created).toISOString() : new Date().toISOString(),
    platform: 'vercel',
    branch: d.git?.repo?.branch,
  }));
}

async function fetchNetlifyDeployments(token: string): Promise<ProviderDeploymentItem[]> {
  const response = await fetch('https://api.netlify.com/api/v1/sites', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'DevOS-AI',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Netlify API token is invalid or has expired.');
    }
    const errText = await response.text();
    throw new Error(`Netlify API error (${response.status}): ${errText}`);
  }

  const sites = (await response.json()) as Array<Record<string, unknown>>;
  return sites.map((site: any) => ({
    id: String(site.id),
    name: String(site.name || 'Untitled Site'),
    url: String(site.ssl_url || site.url || `https://${site.name}.netlify.app`),
    status: mapNetlifyStatus(String(site.state || '')),
    environment: 'production',
    lastDeployedAt: site.updated_at ? new Date(site.updated_at).toISOString() : new Date().toISOString(),
    platform: 'netlify',
  }));
}

async function fetchRenderDeployments(apiKey: string): Promise<ProviderDeploymentItem[]> {
  const response = await fetch('https://api.render.com/v1/services?limit=100', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'User-Agent': 'DevOS-AI',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Render API key is invalid or has expired.');
    }
    const errText = await response.text();
    throw new Error(`Render API error (${response.status}): ${errText}`);
  }

  const services = (await response.json()) as Array<Record<string, unknown>>;
  return services.map((s: any) => {
    const serviceDetails = s.serviceDetails || s.service || {};
    const url = serviceDetails.url || serviceDetails.pullRequestUrl || '';
    return {
      id: String(s.id),
      name: String(s.name || 'Render Service'),
      url: url,
      status: mapRenderStatus(String(s.status || '')),
      environment: s.type === 'web_service' ? 'production' : 'development',
      lastDeployedAt: (serviceDetails.lastDeploy?.createdAt || s.updatedAt)
        ? new Date(serviceDetails.lastDeploy?.createdAt || s.updatedAt).toISOString()
        : new Date().toISOString(),
      platform: 'render',
      branch: s.branch,
    };
  });
}

async function fetchRailwayDeployments(token: string): Promise<ProviderDeploymentItem[]> {
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
          projects {
            edges {
              node {
                id
                name
                services {
                  edges {
                    node {
                      id
                      name
                      deployments(first: 1) {
                        edges {
                          node {
                            id
                            status
                            createdAt
                            url
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Railway API token is invalid or has expired.');
    }
    const errText = await response.text();
    throw new Error(`Railway API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    data?: {
      projects?: {
        edges?: Array<{
          node?: {
            id?: string;
            name?: string;
            services?: {
              edges?: Array<{
                node?: {
                  id?: string;
                  name?: string;
                  deployments?: {
                    edges?: Array<{
                      node?: {
                        id?: string;
                        status?: string;
                        createdAt?: string;
                        url?: string;
                      };
                    }>;
                  };
                };
              }>;
            };
          };
        }>;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (data.errors && data.errors.length > 0 && !data.data?.projects) {
    throw new Error(`Railway error: ${data.errors[0]?.message || 'Failed to fetch projects'}`);
  }

  const deployments: ProviderDeploymentItem[] = [];
  for (const projectEdge of data.data?.projects?.edges || []) {
    const project = projectEdge.node;
    if (!project) continue;

    for (const serviceEdge of project.services?.edges || []) {
      const service = serviceEdge.node;
      if (!service) continue;

      const latestDeploy = service.deployments?.edges?.[0]?.node;
      const url = latestDeploy?.url ? (latestDeploy.url.startsWith('http') ? latestDeploy.url : `https://${latestDeploy.url}`) : '';

      deployments.push({
        id: latestDeploy?.id || service.id || project.id || '',
        name: service.name ? `${project.name} / ${service.name}` : (project.name || 'Railway Project'),
        url: url,
        status: mapRailwayStatus(String(latestDeploy?.status || '')),
        environment: 'production',
        lastDeployedAt: latestDeploy?.createdAt ? new Date(latestDeploy.createdAt).toISOString() : new Date().toISOString(),
        platform: 'railway',
      });
    }
  }

  return deployments;
}

// 2. Status mappers
function mapVercelStatus(state: string): string {
  switch (state.toUpperCase()) {
    case 'READY':
      return 'live';
    case 'BUILDING':
    case 'INITIALIZING':
    case 'QUEUED':
      return 'building';
    case 'ERROR':
    case 'CANCELED':
      return 'error';
    default:
      return 'offline';
  }
}

function mapNetlifyStatus(state: string): string {
  switch (state.toLowerCase()) {
    case 'current':
    case 'ready':
      return 'live';
    case 'building':
    case 'processing':
    case 'uploading':
      return 'building';
    case 'error':
      return 'error';
    default:
      return 'offline';
  }
}

function mapRenderStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'live':
    case 'available':
      return 'live';
    case 'build_in_progress':
    case 'deploy_in_progress':
      return 'building';
    case 'build_failed':
    case 'update_failed':
    case 'create_failed':
      return 'error';
    case 'suspended':
      return 'sleeping';
    case 'canceled':
      return 'offline';
    default:
      return 'offline';
  }
}

function mapRailwayStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
    case 'RUNNING':
      return 'live';
    case 'BUILDING':
    case 'DEPLOYING':
    case 'INITIALIZING':
      return 'building';
    case 'FAILED':
    case 'CRASHED':
      return 'error';
    case 'SLEEPING':
      return 'sleeping';
    default:
      return 'offline';
  }
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

    // 2. Parse request body
    let body: { provider?: string } = {};
    try {
      body = (await req.json()) as { provider?: string };
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const provider = body.provider?.toLowerCase().trim();
    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'Provider parameter is required (vercel, netlify, render, railway)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Retrieve user's personal provider credential from server-only storage
    let credentialValue = '';

    const { data: userCred } = await supabase
      .from('provider_credentials')
      .select('credential_value, metadata')
      .eq('user_id', authenticatedUserId)
      .eq('provider', provider)
      .maybeSingle();

    if (userCred?.credential_value) {
      credentialValue = userCred.credential_value;
    }

    // If no credential found for this user, return clear error
    if (!credentialValue) {
      return new Response(
        JSON.stringify({
          error: `${provider.charAt(0).toUpperCase() + provider.slice(1)} is not connected for your account. Please connect your account in Integrations.`,
          count: 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Fetch real deployments from provider API
    let deployments: ProviderDeploymentItem[] = [];
    switch (provider) {
      case 'vercel':
        deployments = await fetchVercelDeployments(credentialValue);
        break;
      case 'netlify':
        deployments = await fetchNetlifyDeployments(credentialValue);
        break;
      case 'render':
        deployments = await fetchRenderDeployments(credentialValue);
        break;
      case 'railway':
        deployments = await fetchRailwayDeployments(credentialValue);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unsupported provider: ${provider}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const nowIso = new Date().toISOString();

    // 5. Upsert active deployments for this user
    for (const d of deployments) {
      if (!d.url && !d.name) continue;

      const { data: existing } = await supabase
        .from('deployments')
        .select('id')
        .eq('user_id', authenticatedUserId)
        .eq('platform', provider)
        .eq('name', d.name)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('deployments')
          .update({
            url: d.url,
            status: d.status,
            environment: d.environment,
            last_deployed_at: d.lastDeployedAt || nowIso,
            updated_at: nowIso,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('deployments').insert({
          user_id: authenticatedUserId,
          platform: provider,
          name: d.name,
          url: d.url,
          status: d.status,
          environment: d.environment,
          last_deployed_at: d.lastDeployedAt || nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    // 6. Stale deployment reconciliation (strictly user-scoped)
    const incomingNames = new Set(deployments.map((d) => d.name));
    const { data: existingUserDeployments } = await supabase
      .from('deployments')
      .select('id, name')
      .eq('user_id', authenticatedUserId)
      .eq('platform', provider);

    if (existingUserDeployments && existingUserDeployments.length > 0) {
      const staleIds = existingUserDeployments
        .filter((ed) => !incomingNames.has(ed.name))
        .map((ed) => ed.id);

      if (staleIds.length > 0) {
        await supabase
          .from('deployments')
          .delete()
          .in('id', staleIds)
          .eq('user_id', authenticatedUserId);
      }
    }

    // 7. Update integration record last_sync_at
    await supabase
      .from('integrations')
      .update({
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', authenticatedUserId)
      .eq('platform', provider);

    // 8. Log activity
    await supabase.from('activity_logs').insert({
      user_id: authenticatedUserId,
      action: 'synced_deployments',
      resource_type: 'integration',
      details: { provider, count: deployments.length },
    });

    // 9. Return safe response (NEVER return secrets)
    return new Response(
      JSON.stringify({
        success: true,
        provider,
        count: deployments.length,
        synced_at: nowIso,
        deployments: deployments.map((d) => ({
          name: d.name,
          url: d.url,
          status: d.status,
          environment: d.environment,
          last_deployed_at: d.lastDeployedAt,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync deployments error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error while syncing deployments' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
