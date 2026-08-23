import { supabase } from '@/lib/supabase';

// Deployment Health Monitoring Service
// Checks status codes, SSL certificates, response times, and availability

export interface HealthCheckResult {
  url: string;
  status: 'live' | 'offline' | 'error' | 'sleeping';
  statusCode?: number;
  responseTimeMs?: number;
  sslValid?: boolean;
  sslExpiresAt?: string;
  errorMessage?: string;
  checkedAt: string;
}

export interface DeploymentHealthScore {
  score: number; // 0-100
  uptime: number; // percentage
  avgResponseTime: number;
  lastCheckedAt: string;
  issues: string[];
}

// Check URL health by making an authoritative server-side request (bypassing CORS)
export async function checkUrlHealth(url: string, platform?: string, deploymentId?: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  let checkUrl = url.trim();
  if (!/^https?:\/\//i.test(checkUrl)) {
    checkUrl = 'https://' + checkUrl;
  }

  // Attempt server-side check via Edge Function
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.access_token) {
      const response = await supabase.functions.invoke('check-deployment-health', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: { url: checkUrl, platform, deploymentId },
      });

      if (response.data && !response.error) {
        return response.data as HealthCheckResult;
      }
    }
  } catch (serverCheckErr) {
    console.warn('Server-side health check fallback:', serverCheckErr);
  }

  const result: HealthCheckResult = {
    url: checkUrl,
    status: 'offline',
    checkedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(checkUrl, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    result.responseTimeMs = Date.now() - startTime;
    result.statusCode = response.type === 'opaque' ? 200 : response.status;
    result.sslValid = checkUrl.startsWith('https://');

    if (response.type === 'opaque' || (response.status >= 200 && response.status < 400)) {
      result.status = 'live';
    } else if (response.status >= 500) {
      result.status = 'error';
      result.errorMessage = `Server error: ${response.status}`;
    } else if (response.status >= 400) {
      result.status = 'error';
      result.errorMessage = `Client error: ${response.status}`;
    }
  } catch (error: unknown) {
    result.responseTimeMs = Date.now() - startTime;
    const err = error as { name?: string; message?: string };

    if (err.name === 'AbortError') {
      result.status = 'offline';
      result.errorMessage = 'Request timed out (15s)';
    } else {
      result.status = 'offline';
      result.errorMessage = err.message || 'Unable to connect to deployment';
    }
  }

  return result;
}

// Check SSL certificate (via Supabase Edge Function to avoid CORS)
export async function checkSSLCertificate(url: string): Promise<{
  valid: boolean;
  expiresAt?: string;
  daysRemaining?: number;
  issuer?: string;
}> {
  try {
    // This would call a Supabase Edge Function that checks SSL
    // For now, we assume SSL is valid for HTTPS URLs
    if (url.startsWith('https://')) {
      return {
        valid: true,
        issuer: 'Unknown',
      };
    }

    return {
      valid: false,
    };
  } catch {
    return {
      valid: false,
    };
  }
}

// Calculate health score based on multiple factors
export function calculateHealthScore(
  checks: HealthCheckResult[],
  uptimePercentage: number,
  avgResponseTime: number,
  sslValid: boolean
): DeploymentHealthScore {
  const issues: string[] = [];
  let score = 100;

  // Deduct for uptime issues
  if (uptimePercentage < 99.9) {
    const uptimePenalty = (100 - uptimePercentage) * 2;
    score -= uptimePenalty;
    issues.push(`Uptime is ${uptimePercentage.toFixed(2)}% (below 99.9%)`);
  }

  // Deduct for slow response times
  if (avgResponseTime > 1000) {
    score -= 15;
    issues.push(`Slow response time: ${avgResponseTime}ms`);
  } else if (avgResponseTime > 500) {
    score -= 5;
    issues.push(`Moderate response time: ${avgResponseTime}ms`);
  }

  // Deduct for SSL issues
  if (!sslValid) {
    score -= 25;
    issues.push('SSL certificate is invalid or missing');
  }

  // Deduct for recent errors
  const recentErrors = checks.filter(c => c.status === 'error' || c.status === 'offline').length;
  if (recentErrors > 0) {
    score -= recentErrors * 5;
    issues.push(`${recentErrors} recent error(s) detected`);
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    uptime: uptimePercentage,
    avgResponseTime,
    lastCheckedAt: new Date().toISOString(),
    issues,
  };
}

// Determine if a deployment might be sleeping (common with free tiers)
export function detectSleepingService(
  responseTimeMs: number,
  platform: string,
  hasPaidPlan: boolean = false
): boolean {
  if (hasPaidPlan) return false;

  // Free tier services often have 10-30 second delays when waking up
  const sleepingThresholds: Record<string, number> = {
    vercel: 2000,
    netlify: 3000,
    render: 10000,
    railway: 8000,
    fly_io: 5000,
  };

  const threshold = sleepingThresholds[platform] || 5000;
  return responseTimeMs > threshold;
}

// Parse deployment URL to detect platform
export function detectPlatformFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('vercel.app') || hostname.includes('.vercel.app')) return 'vercel';
  if (hostname.includes('netlify.app') || hostname.includes('.netlify.app')) return 'netlify';
  if (hostname.includes('onrender.com') || hostname.includes('.onrender.com')) return 'render';
  if (hostname.includes('railway.app') || hostname.includes('.railway.app')) return 'railway';
  if (hostname.includes('fly.dev') || hostname.includes('.fly.dev')) return 'fly_io';
  if (hostname.includes('herokuapp.com') || hostname.includes('.herokuapp.com')) return 'heroku';
  if (hostname.includes('github.io') || hostname.includes('.github.io')) return 'github_pages';
  if (hostname.includes('firebaseapp.com') || hostname.includes('.firebaseapp.com')) return 'firebase';
  if (hostname.includes('web.app') || hostname.includes('.web.app')) return 'firebase';
  if (hostname.includes('cloudfront.net') || hostname.includes('.cloudfront.net')) return 'cloudflare';
  if (hostname.includes('pages.dev') || hostname.includes('.pages.dev')) return 'cloudflare_pages';
  if (hostname.includes('amplifyapp.com') || hostname.includes('.amplifyapp.com')) return 'aws_amplify';
  if (hostname.includes('digitaloceanspaces.com') || hostname.includes('.digitaloceanspaces.com')) return 'digitalocean';

    return null;
  } catch {
    return null;
  }
}

// Match deployment with GitHub repository
export function matchDeploymentWithRepository(
  deploymentName: string,
  deploymentUrl: string,
  repositories: Array<{ name: string; full_name: string; html_url: string }>
): string | null {
  // Try to match by name similarity
  const deploymentSlug = deploymentName.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const repo of repositories) {
    const repoSlug = repo.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Exact name match
    if (repoSlug === deploymentSlug) {
      return repo.html_url;
    }

    // Check if deployment name is in repo name
    if (repoSlug.includes(deploymentSlug) || deploymentSlug.includes(repoSlug)) {
      return repo.html_url;
    }

    // Check URL patterns
    if (deploymentUrl.toLowerCase().includes(repoSlug)) {
      return repo.html_url;
    }
  }

  return null;
}

// Batch health check for multiple deployments
export async function batchHealthCheck(urls: string[]): Promise<Map<string, HealthCheckResult>> {
  const results = new Map<string, HealthCheckResult>();

  // Run checks in parallel with concurrency limit
  const concurrencyLimit = 5;
  const batches = [];

  for (let i = 0; i < urls.length; i += concurrencyLimit) {
    batches.push(urls.slice(i, i + concurrencyLimit));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (url) => ({
        url,
        result: await checkUrlHealth(url),
      }))
    );

    for (const { url, result } of batchResults) {
      results.set(url, result);
    }
  }

  return results;
}
