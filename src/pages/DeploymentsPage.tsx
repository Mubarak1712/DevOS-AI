import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Rocket,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Moon,
  Globe,
  Activity,
  TrendingUp,
  Loader2,
  Clipboard,
  Info,
  ArrowRight,
} from 'lucide-react';
import { Button, Input, Card, StatusBadge, EmptyState, Modal, Select, StatCard } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import {
  useDeployments,
  useCreateDeployment,
  useUpdateDeployment,
  useDeleteDeployment,
  useIntegrations,
  useRepositories,
  useQueryInitialLoading,
  useLogActivity,
  useSyncRepositories,
} from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { checkUrlHealth, calculateHealthScore, detectPlatformFromUrl, detectSleepingService, type HealthCheckResult } from '@/services/health';
import type { GitHubSyncResult } from '@/services/github';

const platforms = [
  { value: 'vercel', label: 'Vercel' },
  { value: 'netlify', label: 'Netlify' },
  { value: 'render', label: 'Render' },
  { value: 'railway', label: 'Railway' },
  { value: 'firebase', label: 'Firebase' },
  { value: 'github_pages', label: 'GitHub Pages' },
  { value: 'cloudflare_pages', label: 'Cloudflare Pages' },
  { value: 'aws_amplify', label: 'AWS Amplify' },
  { value: 'heroku', label: 'Heroku' },
  { value: 'fly_io', label: 'Fly.io' },
  { value: 'digitalocean', label: 'DigitalOcean' },
  { value: 'custom', label: 'Custom Domain' },
];

interface DeploymentHealth {
  deploymentId: string;
  lastCheck?: HealthCheckResult;
  healthScore?: number;
  isChecking: boolean;
}

export function DeploymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'live' | 'status' | 'name'>('recent');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deploymentToDelete, setDeploymentToDelete] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [healthData, setHealthData] = useState<Map<string, DeploymentHealth>>(new Map());
  const [checkingAll, setCheckingAll] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStatusBanner, setSyncStatusBanner] = useState<string | null>(null);

  // Rich Scan Result Modal State
  const [scanResult, setScanResult] = useState<GitHubSyncResult | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const { data: deployments = [], isPending, fetchStatus, refetch } = useDeployments();
  const { data: integrations = [] } = useIntegrations();
  const { data: repositories = [] } = useRepositories();
  const isLoading = useQueryInitialLoading(authLoading, isPending, fetchStatus);
  const createDeployment = useCreateDeployment();
  const updateDeployment = useUpdateDeployment();
  const deleteDeployment = useDeleteDeployment();
  const syncRepositories = useSyncRepositories();
  const logActivity = useLogActivity();

  const githubIntegration = integrations.find((i) => i.platform === 'github');
  const githubConnected = githubIntegration?.connected === true;

  const [newDeployment, setNewDeployment] = useState({
    platform: 'vercel',
    name: '',
    url: '',
    environment: 'production',
    repository_id: '',
  });

  const checkDeploymentHealth = useCallback(async (deploymentId: string, url: string, platform: string) => {
    setHealthData((prev) => {
      const updated = new Map(prev);
      updated.set(deploymentId, { deploymentId, isChecking: true });
      return updated;
    });

    const healthResult = await checkUrlHealth(url, platform, deploymentId);
    const isSleeping = detectSleepingService(healthResult.responseTimeMs || 0, platform);

    if (healthResult.status === 'live' && isSleeping) {
      healthResult.status = 'sleeping';
    }

    const healthScore = calculateHealthScore(
      [healthResult],
      healthResult.status === 'live' ? 100 : 0,
      healthResult.responseTimeMs || 0,
      healthResult.sslValid ?? true
    );

    setHealthData((prev) => {
      const updated = new Map(prev);
      updated.set(deploymentId, {
        deploymentId,
        lastCheck: healthResult,
        healthScore: healthScore.score,
        isChecking: false,
      });
      return updated;
    });

    if (healthResult.status !== 'offline') {
      await updateDeployment.mutateAsync({
        deploymentId,
        updates: {
          status: healthResult.status,
          response_time_ms: healthResult.responseTimeMs,
          ssl_status: healthResult.sslValid ? 'valid' : 'invalid',
        },
      });
    }

    return healthResult;
  }, [updateDeployment]);

  const handleScanGitHubRepositories = async () => {
    setIsSyncingAll(true);
    setSyncStatusBanner(null);
    try {
      const result = await syncRepositories.mutateAsync();
      setScanResult(result);
      setIsScanModalOpen(true);
      const repCount = result?.repositories_scanned ?? result?.count ?? 0;
      const depCount = result?.deployments_discovered ?? 0;
      setSyncStatusBanner(`Scan completed: ${repCount} repositories scanned · ${depCount} live deployments discovered.`);
      setTimeout(() => setSyncStatusBanner(null), 6000);
    } catch (err) {
      setSyncStatusBanner(err instanceof Error ? `Discovery error: ${err.message}` : 'Failed to scan GitHub repositories.');
      setTimeout(() => setSyncStatusBanner(null), 6000);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const checkAllDeployments = async () => {
    if (deployments.length === 0) return;

    setCheckingAll(true);
    const results = await Promise.all(
      deployments.map((d) => checkDeploymentHealth(d.id, d.url, d.platform))
    );
    setCheckingAll(false);

    await logActivity.mutateAsync({
      action: 'health_check_completed',
      resourceType: 'deployment',
      details: {
        checked: deployments.length,
        live: results.filter((r) => r.status === 'live').length,
        offline: results.filter((r) => r.status === 'offline').length,
      },
    });
  };

  useEffect(() => {
    if (deployments.length > 0 && healthData.size === 0) {
      deployments.slice(0, 5).forEach((d) => {
        checkDeploymentHealth(d.id, d.url, d.platform);
      });
    }
  }, [deployments, healthData.size, checkDeploymentHealth]);

  const handleCreateDeployment = async () => {
    if (!user) return;

    let url = newDeployment.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const detectedPlatform = detectPlatformFromUrl(url);
    const platform = detectedPlatform || newDeployment.platform;
    const linkedRepo = repositories.find((r) => r.id === newDeployment.repository_id);
    const deploymentName = newDeployment.name.trim() || linkedRepo?.name || 'Untitled Deployment';

    const deployment = await createDeployment.mutateAsync({
      platform,
      name: deploymentName,
      url: url,
      environment: newDeployment.environment,
      status: 'offline',
      repository_id: newDeployment.repository_id || undefined,
    });

    await logActivity.mutateAsync({
      action: 'added_deployment',
      resourceType: 'deployment',
      resourceId: deployment.id,
      details: { name: deployment.name, platform: deployment.platform },
    });

    checkDeploymentHealth(deployment.id, deployment.url, deployment.platform);

    setIsAddModalOpen(false);
    setNewDeployment({ platform: 'vercel', name: '', url: '', environment: 'production', repository_id: '' });
  };

  const handleDeleteDeployment = async () => {
    if (!deploymentToDelete) return;
    await deleteDeployment.mutateAsync(deploymentToDelete);
    setHealthData((prev) => {
      const updated = new Map(prev);
      updated.delete(deploymentToDelete);
      return updated;
    });
    setIsDeleteModalOpen(false);
    setDeploymentToDelete(null);
  };

  const filteredDeployments = useMemo(
    () =>
      deployments
        .filter((deployment) => {
          const matchesSearch = [deployment.name, deployment.url, deployment.platform]
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase());
          const matchesPlatform = !platformFilter || deployment.platform === platformFilter;
          const matchesStatus = !statusFilter || deployment.status === statusFilter;
          return matchesSearch && matchesPlatform && matchesStatus;
        })
        .sort((a, b) => {
          if (sortBy === 'name') return a.name.localeCompare(b.name);
          if (sortBy === 'live') return (b.status === 'live' ? 1 : 0) - (a.status === 'live' ? 1 : 0);
          if (sortBy === 'status') return a.status.localeCompare(b.status);
          const aDate = a.last_deployed_at ? new Date(a.last_deployed_at).getTime() : 0;
          const bDate = b.last_deployed_at ? new Date(b.last_deployed_at).getTime() : 0;
          return bDate - aDate;
        }),
    [deployments, search, platformFilter, statusFilter, sortBy]
  );

  const liveCount = deployments.filter((d) => d.status === 'live').length;
  const sleepingCount = deployments.filter((d) => d.status === 'sleeping').length;
  const avgHealthScore = healthData.size > 0
    ? Math.round(
        [...healthData.values()].reduce((sum, h) => sum + (h.healthScore || 0), 0) / healthData.size
      )
    : 0;

  const connectedPlatforms = integrations.filter((i) => i.connected).map((i) => i.platform);

  const copyDeploymentUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Deployment URL copied');
      setTimeout(() => setCopyMessage(null), 1800);
    } catch {
      setCopyMessage('Failed to copy deployment URL');
      setTimeout(() => setCopyMessage(null), 1800);
    }
  };

  const getDeploymentSummary = (deployment: (typeof deployments)[number]) => {
    const repo = deployment.repository as { description?: string | null } | null | undefined;
    if (repo?.description) return repo.description;
    return `${deployment.name} is a ${deployment.environment} deployment on ${deployment.platform.replace('_', ' ')}.`;
  };

  const getDeploymentProjectName = (deployment: (typeof deployments)[number]) => {
    const repo = deployment.repository as { full_name?: string; name?: string } | null | undefined;
    return repo?.full_name || deployment.name;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Infrastructure"
        title="Deployments"
        description="Track live URLs, platform health, and real-time deployment status with zero manual tokens."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleScanGitHubRepositories}
              disabled={isSyncingAll || syncRepositories.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingAll || syncRepositories.isPending ? 'animate-spin' : ''}`} />
              {isSyncingAll || syncRepositories.isPending ? 'Scanning GitHub...' : 'Scan GitHub Repositories'}
            </Button>
            <Button variant="secondary" onClick={checkAllDeployments} disabled={!deployments.length || checkingAll}>
              {checkingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
              Health Check
            </Button>
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Deployment
            </Button>
          </div>
        }
      />

      {syncStatusBanner && (
        <Card className="p-4 bg-slate-900 text-white border-0 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-violet-400 flex-shrink-0" />
              <p className="text-sm font-medium">{syncStatusBanner}</p>
            </div>
            {scanResult && (
              <button
                type="button"
                onClick={() => setIsScanModalOpen(true)}
                className="text-xs text-violet-300 hover:text-white underline font-semibold whitespace-nowrap"
              >
                View Details
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={deployments.length} icon={Rocket} color="primary" subtitle="Tracked endpoints" />
        <StatCard title="Live" value={liveCount} icon={Globe} color="emerald" subtitle="Responding deployments" />
        <StatCard title="Sleeping" value={sleepingCount} icon={Moon} color="warning" subtitle="Cold starts detected" />
        <StatCard title="Health" value={`${avgHealthScore}%`} icon={TrendingUp} color="cyan" subtitle="Avg. score" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="p-5 border border-slate-200 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">Search and filter</p>
                <h2 className="text-xl font-semibold text-slate-900">Deployment list</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-900">
                <Rocket className="w-4 h-4" />
                {filteredDeployments.length} result{filteredDeployments.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <Input
                  placeholder="Search deployments..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                options={[{ value: '', label: 'All platforms' }, ...platforms]}
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'live', label: 'Live' },
                  { value: 'sleeping', label: 'Sleeping' },
                  { value: 'offline', label: 'Offline' },
                  { value: 'error', label: 'Error' },
                  { value: 'building', label: 'Building' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
              <Select
                label="Sort"
                options={[
                  { value: 'recent', label: 'Most recent' },
                  { value: 'name', label: 'Name' },
                  { value: 'status', label: 'Status' },
                  { value: 'live', label: 'Live first' },
                ]}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'live' | 'status' | 'name')}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Zero-Token Discovery</p>
                <h3 className="text-base font-semibold text-slate-900 mt-0.5">Connected platforms</h3>
              </div>
              <span className="text-xs bg-violet-100 text-violet-800 px-2 py-1 rounded-full font-semibold">
                {connectedPlatforms.length} active
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              DevOS AI parses repository homepages, GitHub Pages, and deployment webhooks automatically.
            </p>
          </div>

          <Link to="/integrations" className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-violet-600 hover:text-violet-800 font-semibold group">
            <span>Manage Integrations</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <Card key={index} className="p-5 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : filteredDeployments.length === 0 ? (
        <Card className="p-8 border border-slate-200 shadow-sm">
          <EmptyState
            icon={<Rocket className="w-8 h-8 text-slate-500" />}
            title={search || platformFilter || statusFilter ? 'No deployments match your filters' : 'No deployments discovered yet'}
            description={
              search || platformFilter || statusFilter
                ? 'Try adjusting your filters.'
                : 'DevOS AI automatically scans your connected GitHub repositories to detect live deployments on Vercel, Netlify, Render, Railway, and GitHub Pages — without requiring provider API tokens.'
            }
            actionLabel={
              !search && !platformFilter && !statusFilter
                ? (githubConnected ? 'Scan GitHub Repositories' : 'Connect GitHub')
                : undefined
            }
            onAction={
              !search && !platformFilter && !statusFilter
                ? (githubConnected ? handleScanGitHubRepositories : undefined)
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDeployments.map((deployment) => {
            const health = healthData.get(deployment.id);
            const isChecking = health?.isChecking ?? false;
            const lastCheck = health?.lastCheck;
            const healthScore = health?.healthScore;
            const lastChecked = lastCheck?.checkedAt ? new Date(lastCheck.checkedAt).toLocaleString() : 'Not checked yet';
            const projectName = getDeploymentProjectName(deployment);
            const summary = getDeploymentSummary(deployment);

            return (
              <Card key={deployment.id} hover className="p-5 border border-slate-200 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-700 text-xl font-bold">
                          {deployment.platform.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-xl font-semibold text-slate-900 truncate">{projectName}</h3>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 capitalize">
                              {deployment.platform.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{summary}</p>
                        </div>
                      </div>

                      <StatusBadge status={deployment.status} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-600">
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last deploy</p>
                        <p className="mt-2 text-slate-900">{deployment.last_deployed_at ? new Date(deployment.last_deployed_at).toLocaleString() : 'Unknown'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Environment</p>
                        <p className="mt-2 text-slate-900 capitalize">{deployment.environment}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 text-sm text-slate-600">
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Response</p>
                        <p className="mt-2 text-slate-900">{lastCheck?.statusCode ?? '-'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SSL</p>
                        <p className="mt-2 text-slate-900">{lastCheck?.sslValid === true ? 'Valid' : lastCheck?.sslValid === false ? 'Invalid' : 'Unknown'}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last checked</p>
                        <p className="mt-2 text-slate-900">{lastChecked}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Health score</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">{healthScore ?? '––'}%</p>
                      <p className="text-sm text-slate-600 mt-2">Based on latest response and SSL check</p>
                    </div>

                    <div className="space-y-3">
                      <Button
                        variant="secondary"
                        onClick={() => checkDeploymentHealth(deployment.id, deployment.url, deployment.platform)}
                        disabled={isChecking || !deployment.url}
                        className="w-full"
                      >
                        {isChecking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
                        Check Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyDeploymentUrl(deployment.url)}
                        disabled={!deployment.url}
                        className="w-full"
                      >
                        <Clipboard className="w-4 h-4 mr-2" />
                        Copy URL
                      </Button>
                    </div>

                    <div className="grid gap-2">
                      <a
                        href={deployment.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium transition ${deployment.url ? 'bg-slate-100 text-slate-900 hover:bg-slate-50' : 'opacity-50 pointer-events-none'}`}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open deployment
                      </a>
                      <button
                        type="button"
                        onClick={() => { setDeploymentToDelete(deployment.id); setIsDeleteModalOpen(true); }}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Remove
                      </button>
                    </div>
                    {copyMessage && <p className="text-sm text-emerald-700">{copyMessage}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Streamlined Platform Support & Integrations Callout */}
      <Card className="p-6 border border-slate-200 bg-slate-50/70 shadow-sm rounded-[24px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">Supported Deployment Platforms</h2>
            <p className="text-sm text-slate-600">
              DevOS automatically detects Vercel, Netlify, Render, Railway, GitHub Pages, Cloudflare, and Custom Domains from your repositories.
            </p>
          </div>
          <Link to="/integrations">
            <Button variant="secondary" size="sm" className="whitespace-nowrap">
              Manage Integrations
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </Card>

      {/* Rich Deployment Scan Results Modal (Phase 3 UX) */}
      <Modal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        title="GitHub Deployment Discovery"
        description="Detailed result breakdown from scanning your connected GitHub repositories."
        size="lg"
      >
        {scanResult && (
          <div className="space-y-5">
            {/* Scan Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-xs text-slate-500 font-medium">Repositories</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {scanResult.repositories_scanned ?? scanResult.count ?? 0}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Scanned</p>
              </div>

              <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 text-center">
                <p className="text-xs text-violet-700 font-medium">Discovered</p>
                <p className="text-2xl font-bold text-violet-900 mt-1">
                  {scanResult.deployments_discovered ?? 0}
                </p>
                <p className="text-[11px] text-violet-600 mt-0.5">Live URLs</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-xs text-emerald-700 font-medium">New Added</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  {scanResult.new_deployments_added ?? 0}
                </p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Stored</p>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-center">
                <p className="text-xs text-sky-700 font-medium">Updated</p>
                <p className="text-2xl font-bold text-sky-900 mt-1">
                  {scanResult.deployments_updated ?? 0}
                </p>
                <p className="text-[11px] text-sky-600 mt-0.5">Refreshed</p>
              </div>
            </div>

            {/* When 0 Deployments Discovered */}
            {(scanResult.deployments_discovered ?? 0) === 0 ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-900 text-sm">
                      No publicly detectable deployment URLs were found in your GitHub repositories.
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      A GitHub repository is not automatically a deployment. DevOS AI inspects repository metadata, configured homepage URLs, GitHub Pages, and GitHub Environments/Deployments to detect live endpoints.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/70 text-xs text-amber-800">
                  <p className="font-semibold mb-1">How to make your deployments auto-detectable:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    <li>Set the <strong>About / Homepage URL</strong> in your GitHub repository settings to your live Vercel / Netlify / Render link.</li>
                    <li>Enable <strong>GitHub Pages</strong> in repository settings.</li>
                    <li>Or click <strong>Add Custom Deployment</strong> to track any live URL directly.</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* When Deployments Discovered */
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Discovered Deployments</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {scanResult.discovered_details?.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 truncate">{item.repository}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 capitalize">
                            {item.platform.replace('_', ' ')}
                          </span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-500 hover:text-violet-600 truncate block mt-0.5"
                        >
                          {item.url}
                        </a>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 flex-shrink-0 capitalize">
                        {item.status || 'live'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button onClick={() => setIsScanModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Custom Deployment Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Custom Deployment"
        description="Track a custom domain or private deployment endpoint."
        size="md"
      >
        <div className="space-y-4">
          {repositories.length > 0 && (
            <Select
              label="Link GitHub Repository (optional)"
              options={[
                { value: '', label: 'No repository linked' },
                ...repositories.map((repo) => ({ value: repo.id, label: repo.full_name })),
              ]}
              value={newDeployment.repository_id}
              onChange={(e) => {
                const repositoryId = e.target.value;
                const repo = repositories.find((item) => item.id === repositoryId);
                setNewDeployment((prev) => ({
                  ...prev,
                  repository_id: repositoryId,
                  name: prev.name || repo?.name || '',
                }));
              }}
            />
          )}

          <Input
            label="Deployment Name"
            placeholder="My Production App"
            value={newDeployment.name}
            onChange={(e) => setNewDeployment({ ...newDeployment, name: e.target.value })}
          />
          <Input
            label="Deployment URL"
            placeholder="https://myapp.vercel.app"
            value={newDeployment.url}
            onChange={(e) => setNewDeployment({ ...newDeployment, url: e.target.value })}
            helperText="Platform is auto-detected from URL"
          />
          <Select
            label="Platform (if not auto-detected)"
            options={platforms}
            value={newDeployment.platform}
            onChange={(e) => setNewDeployment({ ...newDeployment, platform: e.target.value })}
          />
          <Select
            label="Environment"
            options={[
              { value: 'production', label: 'Production' },
              { value: 'staging', label: 'Staging' },
              { value: 'development', label: 'Development' },
              { value: 'preview', label: 'Preview' },
            ]}
            value={newDeployment.environment}
            onChange={(e) => setNewDeployment({ ...newDeployment, environment: e.target.value })}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleCreateDeployment} isLoading={createDeployment.isPending} disabled={!newDeployment.url}>
              Add Deployment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Deployment Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setDeploymentToDelete(null); }}
        title="Delete Deployment"
        size="sm"
      >
        <div className="text-center py-4">
          <p className="text-neutral-600 mb-6">
            Are you sure you want to remove this deployment? It will stop being tracked but the live site stays intact.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => { setIsDeleteModalOpen(false); setDeploymentToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDeleteDeployment} isLoading={deleteDeployment.isPending}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
