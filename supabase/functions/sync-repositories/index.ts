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

interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage?: string | null;
  has_pages?: boolean;
  owner?: { login?: string };
  visibility?: string;
  default_branch?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  topics?: string[];
  private?: boolean;
  fork?: boolean;
  pushed_at?: string;
  updated_at?: string;
  license?: unknown;
}

interface DiscoveredDeployment {
  name: string;
  url: string;
  platform: string;
  provider: string;
  status: string;
  environment: string;
  lastDeployedAt: string;
  repoGithubId: number;
}

function cleanUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return null;
    }
    if (hostname === 'github.com' && !parsed.pathname.includes('/releases')) {
      return null;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function detectPlatform(url: string, rawDescription?: string): { platform: string; provider: string } {
  const lowerUrl = url.toLowerCase();
  const desc = (rawDescription || '').toLowerCase();

  if (lowerUrl.includes('.vercel.app') || desc.includes('vercel')) {
    return { platform: 'vercel', provider: 'vercel' };
  }
  if (lowerUrl.includes('.netlify.app') || desc.includes('netlify')) {
    return { platform: 'netlify', provider: 'netlify' };
  }
  if (lowerUrl.includes('.onrender.com') || lowerUrl.includes('.render.com') || desc.includes('render')) {
    return { platform: 'render', provider: 'render' };
  }
  if (lowerUrl.includes('.railway.app') || lowerUrl.includes('.up.railway.app') || desc.includes('railway')) {
    return { platform: 'railway', provider: 'railway' };
  }
  if (lowerUrl.includes('.pages.dev') || desc.includes('cloudflare')) {
    return { platform: 'cloudflare_pages', provider: 'cloudflare' };
  }
  if (lowerUrl.includes('.github.io')) {
    return { platform: 'github_pages', provider: 'github' };
  }
  if (lowerUrl.includes('.firebaseapp.com') || lowerUrl.includes('.web.app')) {
    return { platform: 'firebase', provider: 'firebase' };
  }
  if (lowerUrl.includes('.amplifyapp.com')) {
    return { platform: 'aws_amplify', provider: 'aws' };
  }
  if (lowerUrl.includes('.herokuapp.com')) {
    return { platform: 'heroku', provider: 'heroku' };
  }
  if (lowerUrl.includes('.fly.dev')) {
    return { platform: 'fly_io', provider: 'fly' };
  }
  return { platform: 'custom', provider: 'custom' };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Authenticate caller with Supabase Auth
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Empty bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;

    // 2. Fetch the user's GitHub integration and credential
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', authenticatedUserId)
      .eq('platform', 'github')
      .maybeSingle();

    if (integrationError || !integration || !integration.connected) {
      return new Response(
        JSON.stringify({ error: 'GitHub is not connected for this account. Please connect GitHub first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = (integration.metadata || {}) as Record<string, unknown>;
    const accessToken = (metadata.token || metadata.access_token) as string | undefined;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub credentials not found. Please reconnect your GitHub account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch real repositories from GitHub API with pagination
    const allRepos: GitHubRepoResponse[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 5;

    while (page <= maxPages) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const ghResponse = await fetch(
          `https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}&visibility=all&affiliation=owner,collaborator`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'DevOS-AI',
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (ghResponse.status === 401) {
          // Token expired or revoked
          await supabase
            .from('integrations')
            .update({ connected: false, updated_at: new Date().toISOString() })
            .eq('id', integration.id);

          return new Response(
            JSON.stringify({ error: 'GitHub authorization has expired or was revoked. Please reconnect your account.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (ghResponse.status === 403) {
          const rateRemaining = ghResponse.headers.get('x-ratelimit-remaining');
          if (rateRemaining === '0') {
            return new Response(
              JSON.stringify({ error: 'GitHub API rate limit reached. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (!ghResponse.ok) {
          return new Response(
            JSON.stringify({ error: `GitHub API error (${ghResponse.status}): Failed to fetch repositories` }),
            { status: ghResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const pageData = (await ghResponse.json()) as GitHubRepoResponse[];
        if (!Array.isArray(pageData) || pageData.length === 0) {
          break;
        }

        allRepos.push(...pageData);
        if (pageData.length < perPage) {
          break;
        }
        page += 1;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    }

    // 4. Transform repositories and prepare database rows
    const nowIso = new Date().toISOString();
    const repositoryRows = allRepos.map((repo) => ({
      user_id: authenticatedUserId,
      github_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || null,
      html_url: repo.html_url,
      owner_login: repo.owner?.login || null,
      visibility: repo.visibility || (repo.private ? 'private' : 'public'),
      default_branch: repo.default_branch || 'main',
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      open_issues: repo.open_issues_count || 0,
      language: repo.language || null,
      topics: Array.isArray(repo.topics) ? repo.topics : [],
      is_private: repo.private ?? false,
      is_fork: repo.fork ?? false,
      last_commit_at: repo.pushed_at || null,
      last_activity_at: repo.updated_at || null,
      has_readme: false,
      has_license: !!repo.license,
      updated_at: nowIso,
    }));

    // 5. Upsert repositories into database
    if (repositoryRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('repositories')
        .upsert(repositoryRows, { onConflict: 'user_id,github_id' });

      if (upsertError) {
        console.error('Error upserting repositories:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to update repositories in database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Reconciliation: clean up repositories for this user that no longer exist on GitHub
    const incomingGithubIds = new Set(allRepos.map((r) => r.id));
    const { data: existingUserRepos } = await supabase
      .from('repositories')
      .select('id, github_id, name, full_name')
      .eq('user_id', authenticatedUserId);

    if (existingUserRepos && existingUserRepos.length > 0) {
      const idsToDelete = existingUserRepos
        .filter((r) => !incomingGithubIds.has(Number(r.github_id)))
        .map((r) => r.id);

      if (idsToDelete.length > 0) {
        await supabase
          .from('repositories')
          .delete()
          .in('id', idsToDelete)
          .eq('user_id', authenticatedUserId);
      }
    }

    // Map github_id -> repository table uuid
    const repoIdMap = new Map<number, string>();
    for (const r of existingUserRepos || []) {
      repoIdMap.set(Number(r.github_id), r.id);
    }

    // 7. ZERO-TOKEN AUTOMATED DEPLOYMENT DISCOVERY
    const discoveredDeployments: DiscoveredDeployment[] = [];
    const discoveredPlatforms = new Set<string>();

    for (const repo of allRepos) {
      const owner = repo.owner?.login || repo.full_name.split('/')[0];
      const repoName = repo.name;
      const repoPushedAt = repo.pushed_at || repo.updated_at || nowIso;

      // Source A: Repository Homepage URL
      const cleanHomepage = cleanUrl(repo.homepage);
      if (cleanHomepage) {
        const { platform, provider } = detectPlatform(cleanHomepage, repo.description || '');
        discoveredPlatforms.add(platform);
        discoveredDeployments.push({
          name: repo.name,
          url: cleanHomepage,
          platform,
          provider,
          status: 'live',
          environment: 'production',
          lastDeployedAt: repoPushedAt,
          repoGithubId: repo.id,
        });
      }

      // Source B: GitHub Pages
      if (repo.has_pages) {
        const pagesUrl = `https://${owner.toLowerCase()}.github.io/${repoName}`;
        discoveredPlatforms.add('github_pages');
        discoveredDeployments.push({
          name: `${repo.name} (GitHub Pages)`,
          url: pagesUrl,
          platform: 'github_pages',
          provider: 'github',
          status: 'live',
          environment: 'production',
          lastDeployedAt: repoPushedAt,
          repoGithubId: repo.id,
        });
      }

      // Source C: GitHub Deployments API (for Vercel, Netlify, Render, Railway, Actions deployments)
      try {
        const ghDeploymentsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/deployments?per_page=5`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'DevOS-AI',
            },
          }
        );

        if (ghDeploymentsRes.ok) {
          const ghDeployments = (await ghDeploymentsRes.json()) as Array<{
            id: number;
            environment?: string;
            description?: string;
            created_at?: string;
            updated_at?: string;
          }>;

          for (const dep of ghDeployments.slice(0, 3)) {
            const statusRes = await fetch(
              `https://api.github.com/repos/${owner}/${repoName}/deployments/${dep.id}/statuses?per_page=1`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'User-Agent': 'DevOS-AI',
                },
              }
            );

            if (statusRes.ok) {
              const statuses = (await statusRes.json()) as Array<{
                state?: string;
                environment_url?: string;
                log_url?: string;
                description?: string;
              }>;

              const latestStatus = statuses[0];
              const envUrl = cleanUrl(latestStatus?.environment_url || latestStatus?.log_url);

              if (envUrl) {
                const { platform, provider } = detectPlatform(envUrl, `${dep.description || ''} ${latestStatus?.description || ''} ${dep.environment || ''}`);
                discoveredPlatforms.add(platform);

                let depStatus = 'live';
                const state = (latestStatus?.state || '').toLowerCase();
                if (state === 'in_progress' || state === 'queued' || state === 'pending') {
                  depStatus = 'building';
                } else if (state === 'failure' || state === 'error') {
                  depStatus = 'error';
                } else if (state === 'inactive') {
                  depStatus = 'offline';
                }

                discoveredDeployments.push({
                  name: dep.environment ? `${repo.name} (${dep.environment})` : repo.name,
                  url: envUrl,
                  platform,
                  provider,
                  status: depStatus,
                  environment: (dep.environment?.toLowerCase() === 'staging' || dep.environment?.toLowerCase() === 'preview') ? dep.environment.toLowerCase() : 'production',
                  lastDeployedAt: dep.updated_at || dep.created_at || repoPushedAt,
                  repoGithubId: repo.id,
                });
              }
            }
          }
        }
      } catch (depErr) {
        console.warn(`Could not fetch GitHub deployments for ${owner}/${repoName}:`, depErr);
      }
    }

    // 8. Upsert discovered deployments into database (user-isolated)
    let newDeploymentsAdded = 0;
    let deploymentsUpdated = 0;

    for (const d of discoveredDeployments) {
      const dbRepoId = repoIdMap.get(d.repoGithubId) || null;

      const { data: existing } = await supabase
        .from('deployments')
        .select('id')
        .eq('user_id', authenticatedUserId)
        .eq('url', d.url)
        .maybeSingle();

      if (existing) {
        deploymentsUpdated++;
        await supabase
          .from('deployments')
          .update({
            name: d.name,
            platform: d.platform,
            provider: d.provider,
            status: d.status,
            environment: d.environment,
            repository_id: dbRepoId,
            last_deployed_at: d.lastDeployedAt,
            ssl_status: 'valid',
            updated_at: nowIso,
          })
          .eq('id', existing.id);
      } else {
        newDeploymentsAdded++;
        await supabase.from('deployments').insert({
          user_id: authenticatedUserId,
          repository_id: dbRepoId,
          name: d.name,
          url: d.url,
          platform: d.platform,
          provider: d.provider,
          status: d.status,
          environment: d.environment,
          last_deployed_at: d.lastDeployedAt,
          ssl_status: 'valid',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    // 9. Auto-register discovered provider platforms in integrations table
    const platformDisplayNames: Record<string, string> = {
      vercel: 'Vercel',
      netlify: 'Netlify',
      render: 'Render',
      railway: 'Railway',
      github_pages: 'GitHub Pages',
      cloudflare_pages: 'Cloudflare Pages',
    };

    for (const plat of discoveredPlatforms) {
      if (['vercel', 'netlify', 'render', 'railway', 'github_pages', 'cloudflare_pages'].includes(plat)) {
        const platName = platformDisplayNames[plat] || plat;
        await supabase
          .from('integrations')
          .upsert(
            {
              user_id: authenticatedUserId,
              platform: plat,
              name: platName,
              connected: true,
              connected_at: nowIso,
              last_sync_at: nowIso,
              metadata: {
                auto_discovered: true,
                source: 'github_sync',
                discovered_at: nowIso,
              },
            },
            { onConflict: 'user_id,platform' }
          );
      }
    }

    // 10. Update GitHub integration last_sync_at
    await supabase
      .from('integrations')
      .update({
        last_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', integration.id);

    // 11. Log activity for the authenticated user
    await supabase.from('activity_logs').insert({
      user_id: authenticatedUserId,
      action: 'synced_repositories',
      resource_type: 'integration',
      details: {
        count: allRepos.length,
        discovered_deployments: discoveredDeployments.length,
        new_deployments_added: newDeploymentsAdded,
        deployments_updated: deploymentsUpdated,
        platforms: Array.from(discoveredPlatforms),
      },
    });

    const discoveredDetails = discoveredDeployments.map((d) => ({
      repository: d.name,
      platform: d.platform,
      url: d.url,
      environment: d.environment,
      status: d.status,
    }));

    // 12. Return safe response (NEVER return tokens)
    return new Response(
      JSON.stringify({
        success: true,
        count: allRepos.length,
        repositories_scanned: allRepos.length,
        deployments_discovered: discoveredDeployments.length,
        new_deployments_added: newDeploymentsAdded,
        deployments_updated: deploymentsUpdated,
        discovered_details: discoveredDetails,
        synced_at: nowIso,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Repository sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error during repository sync' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
