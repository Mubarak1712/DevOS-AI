export{};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore - the Supabase client is provided by the Deno edge runtime at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DeploymentEdgeNode {
  id?: string;
  name?: string;
  url?: string;
  status?: string;
  createdAt?: string;
  services?: {
    edges?: Array<{
      node: Record<string, unknown>;
    }>;
  };
  deployments?: {
    edges?: Array<{
      node: Record<string, unknown>;
    }>;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper functions for provider API calls
async function fetchVercelDeployments(token: string) {
  const response = await fetch('https://api.vercel.com/v13/deployments?limit=100', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Vercel API error: ${response.status}`);
  const data = (await response.json()) as { deployments?: Array<Record<string, unknown>> };
  return (data.deployments ?? []).map((d: any) => ({
    id: d.uid,
    name: d.name,
    url: d.url || `https://${d.name}.vercel.app`,
    status: mapVercelStatus(d.state),
    environment: d.target === 'production' ? 'production' : 'preview',
    lastDeployedAt: d.created,
    platform: 'vercel',
    branch: d.git?.repo?.branch,
  }));
}

async function fetchNetlifyDeployments(token: string) {
  const response = await fetch('https://api.netlify.com/api/v1/sites', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Netlify API error: ${response.status}`);
  const sites = (await response.json()) as Array<Record<string, unknown>>;
  return sites.map((site: any) => ({
    id: site.id,
    name: site.name,
    url: site.ssl_url || site.url,
    status: mapNetlifyStatus(site.state),
    environment: 'production',
    lastDeployedAt: site.updated_at,
    platform: 'netlify',
  }));
}

async function fetchRenderDeployments(apiKey: string) {
  const response = await fetch('https://api.render.com/v1/services', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Render API error: ${response.status}`);
  const services = (await response.json()) as Array<Record<string, unknown>>;
  return services.map((s: any) => ({
    id: s.id,
    name: s.name,
    url: s.serviceDetails?.url || '',
    status: mapRenderStatus(s.status),
    environment: s.type === 'web_service' ? 'production' : 'development',
    lastDeployedAt: s.serviceDetails?.lastDeploy?.createdAt,
    platform: 'render',
    branch: s.branch,
  }));
}

async function fetchRailwayDeployments(token: string) {
  const response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
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
                    deployments {
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
      }`,
    }),
  });
  if (!response.ok) throw new Error(`Railway API error: ${response.status}`);
  const data = (await response.json()) as {
    data?: {
      projects?: {
        edges?: Array<{ node: DeploymentEdgeNode }>;
      };
    };
  };
  const deployments: any[] = [];
  for (const projectEdge of data.data?.projects?.edges || []) {
    const project = projectEdge.node as DeploymentEdgeNode & Record<string, any>;
    for (const serviceEdge of (project.services?.edges || []) as Array<{ node: Record<string, unknown> }>) {
      const service = serviceEdge.node as Record<string, any>;
      const latestDeploy = ((service.deployments?.edges || [])[0] as { node?: Record<string, unknown> } | undefined)?.node;
      deployments.push({
        id: latestDeploy?.id || service.id,
        name: service.name || project.name,
        url: latestDeploy?.url || '',
        status: mapRailwayStatus(String(latestDeploy?.status ?? '')),
        environment: 'production',
        lastDeployedAt: latestDeploy?.createdAt,
        platform: 'railway',
      });
    }
  }
  return deployments;
}

// Status mapping functions
function mapVercelStatus(state: string): string {
  const mapping: Record<string, string> = {
    'READY': 'live',
    'BUILDING': 'building',
    'INITIALIZING': 'building',
    'QUEUED': 'building',
    'ERROR': 'error',
    'CANCELED': 'error',
  };
  return mapping[state] || 'offline';
}

function mapNetlifyStatus(state: string): string {
  const mapping: Record<string, string> = {
    'current': 'live',
    'ready': 'live',
    'building': 'building',
    'processing': 'building',
    'error': 'error',
  };
  return mapping[state] || 'offline';
}

function mapRenderStatus(status: string): string {
  const mapping: Record<string, string> = {
    'live': 'live',
    'available': 'live',
    'build_in_progress': 'building',
    'deploy_in_progress': 'building',
    'build_failed': 'error',
    'update_failed': 'error',
    'suspended': 'offline',
    'canceled': 'offline',
  };
  return mapping[status] || 'offline';
}

function mapRailwayStatus(status: string): string {
  const mapping: Record<string, string> = {
    'SUCCESS': 'live',
    'RUNNING': 'live',
    'BUILDING': 'building',
    'DEPLOYING': 'building',
    'FAILED': 'error',
    'CRASHED': 'error',
  };
  return mapping[status?.toUpperCase()] || 'offline';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as { userId?: string; provider?: string };
    const { userId, provider } = body;

    if (!userId || !provider) {
      return new Response(
        JSON.stringify({ error: 'userId and provider are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deployments: any[] = [];
    let error: string | null = null;

    switch (provider) {
      case 'vercel': {
        const token = Deno.env.get('VERCEL_TOKEN');
        if (!token) {
          error = 'Vercel token not configured';
        } else {
          try {
            deployments = await fetchVercelDeployments(token);
          } catch (e) {
            error = e instanceof Error ? e.message : 'Failed to fetch Vercel deployments';
          }
        }
        break;
      }
      case 'netlify': {
        const token = Deno.env.get('NETLIFY_TOKEN');
        if (!token) {
          error = 'Netlify token not configured';
        } else {
          try {
            deployments = await fetchNetlifyDeployments(token);
          } catch (e) {
            error = e instanceof Error ? e.message : 'Failed to fetch Netlify deployments';
          }
        }
        break;
      }
      case 'render': {
        const apiKey = Deno.env.get('RENDER_API_KEY');
        if (!apiKey) {
          error = 'Render API key not configured';
        } else {
          try {
            deployments = await fetchRenderDeployments(apiKey);
          } catch (e) {
            error = e instanceof Error ? e.message : 'Failed to fetch Render deployments';
          }
        }
        break;
      }
      case 'railway': {
        const token = Deno.env.get('RAILWAY_TOKEN');
        if (!token) {
          error = 'Railway token not configured';
        } else {
          try {
            deployments = await fetchRailwayDeployments(token);
          } catch (e) {
            error = e instanceof Error ? e.message : 'Failed to fetch Railway deployments';
          }
        }
        break;
      }
      default:
        error = `Unknown provider: ${provider}`;
    }

    if (error) {
      return new Response(
        JSON.stringify({ error, count: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark integration connected even when provider returns zero deployments
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', provider)
      .maybeSingle();

    if (existingIntegration) {
      await supabase
        .from('integrations')
        .update({
          connected: true,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', existingIntegration.id);
    } else {
      await supabase.from('integrations').insert({
        user_id: userId,
        platform: provider,
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        connected: true,
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
      });
    }

    // Upsert deployments to database
    for (const deployment of deployments) {
      const { data: existing } = await supabase
        .from('deployments')
        .select('id')
        .eq('user_id', userId)
        .eq('url', deployment.url)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('deployments')
          .update({
            name: deployment.name,
            status: deployment.status,
            environment: deployment.environment,
            last_deployed_at: deployment.lastDeployedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else if (deployment.url) {
        await supabase.from('deployments').insert({
          user_id: userId,
          platform: deployment.platform || provider,
          name: deployment.name,
          url: deployment.url,
          status: deployment.status,
          environment: deployment.environment,
          last_deployed_at: deployment.lastDeployedAt,
        });
      }
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'synced_deployments',
      resource_type: 'integration',
      details: { provider, count: deployments.length },
    });

    return new Response(
      JSON.stringify({
        provider,
        count: deployments.length,
        deployments: deployments.map(d => ({
          name: d.name,
          url: d.url,
          status: d.status,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync deployments error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
