import { supabase } from '@/lib/supabase';

// Deployment Provider Services
// These services interact with deployment platform APIs to fetch real deployment data

export interface DeploymentProvider {
  id: string;
  name: string;
  icon: string;
  authType: 'oauth' | 'api_key';
  oauthUrl?: string;
  apiBaseUrl: string;
}

export interface ProviderDeployment {
  id: string;
  name: string;
  url: string;
  status: 'live' | 'building' | 'error' | 'offline';
  environment: 'production' | 'staging' | 'preview' | 'development';
  createdAt: string;
  updatedAt: string;
  lastDeployedAt?: string;
  buildStatus?: 'success' | 'failed' | 'building' | 'pending';
  branch?: string;
  commitSha?: string;
}

export interface ProviderConnectResult {
  success: boolean;
  provider: string;
  account: {
    name?: string;
    username?: string;
    email?: string;
    id?: string;
  };
  connected_at: string;
}

export interface ProviderSyncResult {
  success: boolean;
  provider: string;
  count: number;
  synced_at: string;
  deployments?: Array<{
    name: string;
    url: string;
    status: string;
    environment: string;
    last_deployed_at?: string;
  }>;
}

export const providerService = {
  async connect(provider: string, token: string): Promise<ProviderConnectResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const authHeader = sessionData?.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;

    if (!authHeader) {
      throw new Error('Please sign in before connecting a deployment provider.');
    }

    const response = await supabase.functions.invoke('connect-provider', {
      headers: { ...authHeader },
      body: { provider, token },
    });

    if (response.error) {
      let message = response.error.message;
      try {
        const details = await response.error.context?.json?.();
        if (details?.error) message = details.error;
      } catch {
        // fallback
      }
      throw new Error(message);
    }

    const data = response.data as ProviderConnectResult;
    if (!data || !data.success) {
      throw new Error(`Failed to connect ${provider}`);
    }

    return data;
  },

  async sync(provider: string): Promise<ProviderSyncResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const authHeader = sessionData?.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined;

    if (!authHeader) {
      throw new Error('Please sign in before syncing deployments.');
    }

    const response = await supabase.functions.invoke('sync-deployments', {
      headers: { ...authHeader },
      body: { provider },
    });

    if (response.error) {
      let message = response.error.message;
      try {
        const details = await response.error.context?.json?.();
        if (details?.error) message = details.error;
      } catch {
        // fallback
      }
      throw new Error(message);
    }

    const data = response.data as ProviderSyncResult;
    if (!data || !data.success) {
      throw new Error(`Failed to sync deployments for ${provider}`);
    }

    return data;
  },
};

export const PROVIDERS: DeploymentProvider[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    icon: 'vercel',
    authType: 'oauth',
    oauthUrl: 'https://vercel.com/oauth/authorize',
    apiBaseUrl: 'https://api.vercel.com',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    icon: 'netlify',
    authType: 'oauth',
    oauthUrl: 'https://app.netlify.com/authorize',
    apiBaseUrl: 'https://api.netlify.com/api/v1',
  },
  {
    id: 'render',
    name: 'Render',
    icon: 'render',
    authType: 'api_key',
    apiBaseUrl: 'https://api.render.com/v1',
  },
  {
    id: 'railway',
    name: 'Railway',
    icon: 'railway',
    authType: 'api_key',
    apiBaseUrl: 'https://backboard.railway.app/graphql/v2',
  },
];

// Vercel API Service
export const vercelService = {
  async getDeployments(accessToken: string): Promise<ProviderDeployment[]> {
    try {
      const response = await fetch('https://api.vercel.com/v13/deployments?limit=100', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Vercel API error: ${response.status}`);
      }

      const data = await response.json();

      return data.deployments.map((d: Record<string, unknown>) => ({
        id: d.uid as string,
        name: d.name as string,
        url: (d.url as string) || `https://${d.name as string}.vercel.app`,
        status: mapVercelStatus(d.state as string),
        environment: d.target === 'production' ? 'production' : 'preview',
        createdAt: d.created as string,
        updatedAt: (d.updated as string) || (d.created as string),
        lastDeployedAt: d.created as string,
        buildStatus: mapVercelBuildStatus(d.state as string),
        branch: (d.git as { repo?: { branch?: string } })?.repo?.branch,
        commitSha: (d.git as { commitSha?: string })?.commitSha,
      }));
    } catch (error) {
      console.error('Vercel API error:', error);
      return [];
    }
  },

  async getDeployment(accessToken: string, deploymentId: string): Promise<ProviderDeployment | null> {
    try {
      const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;

      const d = await response.json();
      return {
        id: d.uid,
        name: d.name,
        url: d.url || `https://${d.name}.vercel.app`,
        status: mapVercelStatus(d.state),
        environment: d.target === 'production' ? 'production' : 'preview',
        createdAt: d.created,
        updatedAt: d.updated || d.created,
        lastDeployedAt: d.created,
        buildStatus: mapVercelBuildStatus(d.state),
        branch: d.git?.repo?.branch,
        commitSha: d.git?.commitSha,
      };
    } catch (error) {
      console.error('Vercel API error:', error);
      return null;
    }
  },

  async getProjects(accessToken: string): Promise<Record<string, unknown>[]> {
    try {
      const response = await fetch('https://api.vercel.com/v9/projects', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.projects || [];
    } catch (error) {
      console.error('Vercel API error:', error);
      return [];
    }
  },
};

function mapVercelStatus(state: string): 'live' | 'building' | 'error' | 'offline' {
  switch (state) {
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

function mapVercelBuildStatus(state: string): 'success' | 'failed' | 'building' | 'pending' {
  switch (state) {
    case 'READY':
      return 'success';
    case 'ERROR':
    case 'CANCELED':
      return 'failed';
    case 'BUILDING':
      return 'building';
    default:
      return 'pending';
  }
}

// Netlify API Service
export const netlifyService = {
  async getDeployments(accessToken: string): Promise<ProviderDeployment[]> {
    try {
      const response = await fetch('https://api.netlify.com/api/v1/sites', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Netlify API error: ${response.status}`);
      }

      const sites = await response.json();
      const deployments: ProviderDeployment[] = [];

      for (const site of sites) {
        // Get deployments for each site
        const deploysResponse = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys?per_page=5`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        const deploys = deploysResponse.ok ? await deploysResponse.json() : [];

        deployments.push({
          id: site.id,
          name: site.name,
          url: site.ssl_url || site.url,
          status: mapNetlifyStatus(site.state, deploys[0]?.state),
          environment: 'production',
          createdAt: site.created_at,
          updatedAt: site.updated_at,
          lastDeployedAt: deploys[0]?.created_at,
          buildStatus: mapNetlifyBuildStatus(deploys[0]?.state),
          branch: deploys[0]?.branch,
          commitSha: deploys[0]?.commit_ref,
        });
      }

      return deployments;
    } catch (error) {
      console.error('Netlify API error:', error);
      return [];
    }
  },

  async getSite(accessToken: string, siteId: string): Promise<ProviderDeployment | null> {
    try {
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return null;

      const site = await response.json();
      return {
        id: site.id,
        name: site.name,
        url: site.ssl_url || site.url,
        status: mapNetlifyStatus(site.state),
        environment: 'production',
        createdAt: site.created_at,
        updatedAt: site.updated_at,
      };
    } catch (error) {
      console.error('Netlify API error:', error);
      return null;
    }
  },
};

function mapNetlifyStatus(siteState: string, deployState?: string): 'live' | 'building' | 'error' | 'offline' {
  if (deployState) {
    switch (deployState) {
      case 'ready':
        return 'live';
      case 'building':
      case 'processing':
        return 'building';
      case 'error':
        return 'error';
    }
  }

  switch (siteState) {
    case 'current':
      return 'live';
    case 'building':
      return 'building';
    case 'error':
      return 'error';
    default:
      return 'offline';
  }
}

function mapNetlifyBuildStatus(state: string): 'success' | 'failed' | 'building' | 'pending' {
  switch (state) {
    case 'ready':
      return 'success';
    case 'error':
      return 'failed';
    case 'building':
    case 'processing':
      return 'building';
    default:
      return 'pending';
  }
}

// Render API Service
export const renderService = {
  async getDeployments(apiKey: string): Promise<ProviderDeployment[]> {
    try {
      const response = await fetch('https://api.render.com/v1/services', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Render API error: ${response.status}`);
      }

      const services = await response.json();

      return services.map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: s.name as string,
        url: (s.serviceDetails as { url?: string; pullRequestUrl?: string })?.url
          || (s.serviceDetails as { pullRequestUrl?: string })?.pullRequestUrl
          || '',
        status: mapRenderStatus(s.status as string),
        environment: s.type === 'web_service' ? 'production' : 'development',
        createdAt: s.createdAt as string,
        updatedAt: s.updatedAt as string,
        lastDeployedAt: (s.serviceDetails as { lastDeploy?: { createdAt?: string } })?.lastDeploy?.createdAt,
        buildStatus: mapRenderBuildStatus(s.status as string),
        branch: s.branch as string | undefined,
      }));
    } catch (error) {
      console.error('Render API error:', error);
      return [];
    }
  },

  async getService(apiKey: string, serviceId: string): Promise<ProviderDeployment | null> {
    try {
      const response = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) return null;

      const s = await response.json();
      return {
        id: s.id,
        name: s.name,
        url: s.serviceDetails?.url || '',
        status: mapRenderStatus(s.status),
        environment: 'production',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        buildStatus: mapRenderBuildStatus(s.status),
      };
    } catch (error) {
      console.error('Render API error:', error);
      return null;
    }
  },
};

function mapRenderStatus(status: string): 'live' | 'building' | 'error' | 'offline' {
  switch (status) {
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
    case 'canceled':
      return 'offline';
    default:
      return 'offline';
  }
}

function mapRenderBuildStatus(status: string): 'success' | 'failed' | 'building' | 'pending' {
  switch (status) {
    case 'live':
    case 'available':
      return 'success';
    case 'build_failed':
    case 'update_failed':
      return 'failed';
    case 'build_in_progress':
    case 'deploy_in_progress':
      return 'building';
    default:
      return 'pending';
  }
}

// Railway API Service (GraphQL)
export const railwayService = {
  async getDeployments(apiToken: string): Promise<ProviderDeployment[]> {
    try {
      const response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
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
                          repo
                          branch
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
            }
          `,
        }),
      });

      if (!response.ok) {
        throw new Error(`Railway API error: ${response.status}`);
      }

      const data = await response.json();
      const deployments: ProviderDeployment[] = [];

      for (const projectEdge of data.data?.projects?.edges || []) {
        const project = projectEdge.node;
        for (const serviceEdge of project.services?.edges || []) {
          const service = serviceEdge.node;
          const latestDeploy = service.deployments?.edges?.[0]?.node;

          deployments.push({
            id: latestDeploy?.id || service.id,
            name: service.name || project.name,
            url: latestDeploy?.url || '',
            status: mapRailwayStatus(latestDeploy?.status),
            environment: 'production',
            createdAt: latestDeploy?.createdAt || new Date().toISOString(),
            updatedAt: latestDeploy?.createdAt || new Date().toISOString(),
            lastDeployedAt: latestDeploy?.createdAt,
            buildStatus: mapRailwayBuildStatus(latestDeploy?.status),
            branch: service.branch,
          });
        }
      }

      return deployments;
    } catch (error) {
      console.error('Railway API error:', error);
      return [];
    }
  },
};

function mapRailwayStatus(status: string): 'live' | 'building' | 'error' | 'offline' {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
    case 'RUNNING':
      return 'live';
    case 'BUILDING':
    case 'DEPLOYING':
      return 'building';
    case 'FAILED':
    case 'CRASHED':
      return 'error';
    default:
      return 'offline';
  }
}

function mapRailwayBuildStatus(status: string): 'success' | 'failed' | 'building' | 'pending' {
  switch (status?.toUpperCase()) {
    case 'SUCCESS':
    case 'RUNNING':
      return 'success';
    case 'FAILED':
    case 'CRASHED':
      return 'failed';
    case 'BUILDING':
    case 'DEPLOYING':
      return 'building';
    default:
      return 'pending';
  }
}
