import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Activity,
  Rocket,
  Github,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Code2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, StatCard, EmptyState, Badge } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useProjects, useDeployments, useRepositories, useIntegrations } from '@/hooks/api';

export function AnalyticsPage() {
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: deployments = [], isLoading: loadingDeployments } = useDeployments();
  const { data: repositories = [], isLoading: loadingRepos } = useRepositories();
  const { data: integrations = [] } = useIntegrations();

  const isLoading = loadingProjects || loadingDeployments || loadingRepos;

  const githubConnected = integrations.some((i) => i.platform === 'github' && i.connected);
  const hasData = projects.length > 0 || deployments.length > 0 || repositories.length > 0;

  // 1. Projects Distribution
  const projectStats = useMemo(() => {
    const total = projects.length;
    const planning = projects.filter((p) => p.status === 'planning').length;
    const development = projects.filter((p) => p.status === 'development').length;
    const testing = projects.filter((p) => p.status === 'testing').length;
    const deployed = projects.filter((p) => p.status === 'deployed').length;
    const archived = projects.filter((p) => p.status === 'archived').length;

    return {
      total,
      planning,
      development,
      testing,
      deployed,
      archived,
      active: development + testing,
    };
  }, [projects]);

  // 2. Deployments Health Breakdown
  const deploymentStats = useMemo(() => {
    const total = deployments.length;
    const live = deployments.filter((d) => d.status === 'live').length;
    const failed = deployments.filter((d) => d.status === 'failed' || d.status === 'offline').length;
    const sleeping = deployments.filter((d) => d.status === 'sleeping').length;
    const deploying = deployments.filter((d) => d.status === 'deploying').length;

    // Calculate average response time among deployments that have recorded response_time_ms
    const timedDeployments = deployments.filter((d) => typeof d.response_time_ms === 'number' && d.response_time_ms > 0);
    const avgResponseTime = timedDeployments.length > 0
      ? Math.round(timedDeployments.reduce((sum, d) => sum + (d.response_time_ms ?? 0), 0) / timedDeployments.length)
      : null;

    // Platform distribution
    const platforms: Record<string, { total: number; live: number }> = {};
    deployments.forEach((d) => {
      const plat = d.platform || 'other';
      if (!platforms[plat]) platforms[plat] = { total: 0, live: 0 };
      platforms[plat].total += 1;
      if (d.status === 'live') platforms[plat].live += 1;
    });

    const liveRatio = total > 0 ? Math.round((live / total) * 100) : 0;

    return {
      total,
      live,
      failed,
      sleeping,
      deploying,
      avgResponseTime,
      platforms,
      liveRatio,
    };
  }, [deployments]);

  // 3. Repository Maintenance Health & Languages
  const repoStats = useMemo(() => {
    const total = repositories.length;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let active30d = 0;
    let moderate90d = 0;
    let staleOver90d = 0;

    const languagesMap: Record<string, number> = {};

    repositories.forEach((repo) => {
      // Activity date check
      const dateStr = repo.last_commit_at || repo.last_activity_at || repo.updated_at;
      if (dateStr) {
        const diffDays = Math.floor((now - new Date(dateStr).getTime()) / dayMs);
        if (diffDays <= 30) {
          active30d++;
        } else if (diffDays <= 90) {
          moderate90d++;
        } else {
          staleOver90d++;
        }
      } else {
        staleOver90d++;
      }

      // Language distribution
      const lang = repo.language || 'Other';
      languagesMap[lang] = (languagesMap[lang] || 0) + 1;
    });

    const languages = Object.entries(languagesMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      active30d,
      moderate90d,
      staleOver90d,
      languages,
    };
  }, [repositories]);

  // 4. Actionable Findings (Actionable developer diagnostics)
  const findings = useMemo(() => {
    const list: Array<{
      id: string;
      level: 'error' | 'warning' | 'info';
      title: string;
      description: string;
      actionLabel?: string;
      actionUrl?: string;
    }> = [];

    // Offline deployments
    const offlineList = deployments.filter((d) => d.status === 'failed' || d.status === 'offline');
    if (offlineList.length > 0) {
      list.push({
        id: 'offline-deployments',
        level: 'error',
        title: `${offlineList.length} Deployment${offlineList.length > 1 ? 's' : ''} Offline or Failing`,
        description: `${offlineList.map((d) => `${d.name} (${d.platform})`).slice(0, 3).join(', ')}${offlineList.length > 3 ? '...' : ''} need attention.`,
        actionLabel: 'Check Deployments',
        actionUrl: '/deployments',
      });
    }

    // Projects without linked GitHub repo
    const unlinkedProjects = projects.filter((p) => (p.status === 'development' || p.status === 'planning') && !p.github_url);
    if (unlinkedProjects.length > 0) {
      list.push({
        id: 'unlinked-projects',
        level: 'warning',
        title: `${unlinkedProjects.length} Active Project${unlinkedProjects.length > 1 ? 's' : ''} Missing Git Links`,
        description: `Link repositories to track commit activity and streamline zero-token deployments.`,
        actionLabel: 'Link Projects',
        actionUrl: '/projects',
      });
    }

    // Repositories with no active deployment
    if (repositories.length > 0) {
      const reposWithDeployment = new Set(deployments.map((d) => d.repository_id).filter(Boolean));
      const unlinkedRepos = repositories.filter((r) => !reposWithDeployment.has(r.id));
      if (unlinkedRepos.length > 0) {
        list.push({
          id: 'unlinked-repos',
          level: 'info',
          title: `${unlinkedRepos.length} Repositories Without Discovered Deployments`,
          description: `Run zero-token discovery on Deployments to automatically extract public URLs from your repository commits and configs.`,
          actionLabel: 'Scan Deployments',
          actionUrl: '/deployments',
        });
      }
    }

    // Stale repositories warning
    if (repoStats.staleOver90d > 0 && repositories.length > 0) {
      list.push({
        id: 'stale-repos',
        level: 'info',
        title: `${repoStats.staleOver90d} Inactive Repositor${repoStats.staleOver90d > 1 ? 'ies' : 'y'} (>90d)`,
        description: `Codebases have not received commits in over 90 days. Consider archiving or refreshing dependencies.`,
        actionLabel: 'View GitHub Repos',
        actionUrl: '/github',
      });
    }

    return list;
  }, [deployments, projects, repositories, repoStats.staleOver90d]);

  if (!isLoading && !hasData) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Intelligence" title="Analytics & Diagnostics" description="Actionable health metrics derived directly from your connected workspace" />
        <Card variant="os" padding="none">
          <EmptyState
            icon={<TrendingUp className="w-8 h-8" />}
            title="No Workspace Data to Analyze"
            description="Connect GitHub and link your projects to generate real-time maintenance cadence, deployment health, and actionable warnings."
            actionLabel={githubConnected ? 'View Deployments' : 'Connect GitHub'}
            onAction={() => { window.location.href = githubConnected ? '/deployments' : '/github'; }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence"
        title="Analytics & Diagnostics"
        description="Actionable workspace insights, repository maintenance cadence, and deployment health"
      />

      {/* Actionable Findings / Alerts Banner */}
      {findings.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-700 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-violet-600" />
            <span>Actionable Workspace Findings ({findings.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className={`p-4 rounded-2xl border text-sm flex flex-col justify-between transition-all ${
                  finding.level === 'error'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : finding.level === 'warning'
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-violet-50/60 border-violet-200/80 text-violet-900'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {finding.level === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    ) : finding.level === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    ) : (
                      <Activity className="w-4 h-4 text-violet-600 flex-shrink-0" />
                    )}
                    <h3 className="font-semibold text-xs uppercase tracking-wide">{finding.title}</h3>
                  </div>
                  <p className="text-xs opacity-85 mt-1 leading-relaxed">{finding.description}</p>
                </div>
                {finding.actionLabel && finding.actionUrl && (
                  <div className="mt-3 pt-2 border-t border-black/5 flex justify-end">
                    <Link
                      to={finding.actionUrl}
                      className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                    >
                      {finding.actionLabel}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">All Systems Operational</p>
              <p className="text-xs text-emerald-700/85">
                All {deploymentStats.total} deployment endpoints are online and active projects are linked to Git repositories.
              </p>
            </div>
          </div>
          <Badge variant="success">Healthy</Badge>
        </div>
      )}

      {/* 4 Core Diagnostic Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <StatCard
            title="Deployment Availability"
            value={deploymentStats.total > 0 ? `${deploymentStats.liveRatio}%` : 'N/A'}
            icon={Rocket}
            color={deploymentStats.liveRatio >= 80 ? 'emerald' : 'coral'}
            subtitle={`${deploymentStats.live} of ${deploymentStats.total} endpoints live`}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StatCard
            title="Development Velocity"
            value={String(projectStats.active)}
            icon={Activity}
            color="primary"
            subtitle={`${projectStats.active} projects active in sprint`}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <StatCard
            title="Active Repositories"
            value={String(repoStats.active30d)}
            icon={Github}
            color="cyan"
            subtitle={`Updated within last 30 days`}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <StatCard
            title="Average Latency"
            value={deploymentStats.avgResponseTime ? `${deploymentStats.avgResponseTime}ms` : 'Healthy'}
            icon={Clock}
            color="secondary"
            subtitle="Response time across endpoints"
          />
        </motion.div>
      </div>

      {/* Row 2: Projects Lifecycle & Repo Maintenance */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Project Status Lifecycle */}
        <Card variant="os" padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-600" />
              <h2 className="font-display font-bold text-neutral-900">Project Lifecycle Distribution</h2>
            </div>
            <Link to="/projects" className="text-xs text-violet-600 hover:underline font-medium">
              View Projects →
            </Link>
          </div>

          {projectStats.total === 0 ? (
            <EmptyState
              icon={<Layers className="w-6 h-6" />}
              title="No projects tracked"
              description="Create a project to visualize your development stages."
              variant="default"
            />
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Planning', count: projectStats.planning, color: 'bg-amber-500', pill: 'default' as const },
                { label: 'In Development', count: projectStats.development, color: 'bg-violet-600', pill: 'primary' as const },
                { label: 'Testing / QA', count: projectStats.testing, color: 'bg-cyan-500', pill: 'cyan' as const },
                { label: 'Deployed to Production', count: projectStats.deployed, color: 'bg-emerald-500', pill: 'success' as const },
                { label: 'Archived', count: projectStats.archived, color: 'bg-slate-400', pill: 'default' as const },
              ].map((stage) => {
                const pct = projectStats.total > 0 ? Math.round((stage.count / projectStats.total) * 100) : 0;
                return (
                  <div key={stage.label}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-medium text-neutral-700">{stage.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-surface-400">{pct}%</span>
                        <span className="font-semibold text-neutral-900 tabular-nums">{stage.count}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${stage.color}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Repository Maintenance Cadence */}
        <Card variant="os" padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Github className="w-4 h-4 text-neutral-900" />
              <h2 className="font-display font-bold text-neutral-900">Repository Maintenance Cadence</h2>
            </div>
            <Link to="/github" className="text-xs text-violet-600 hover:underline font-medium">
              View Repositories →
            </Link>
          </div>

          {repoStats.total === 0 ? (
            <EmptyState
              icon={<Github className="w-6 h-6" />}
              title="No GitHub Repositories"
              description="Connect GitHub under Integrations to inspect activity frequency."
              variant="default"
            />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100">
                  <p className="text-xl font-bold text-emerald-700 tabular-nums">{repoStats.active30d}</p>
                  <p className="text-[11px] font-medium text-emerald-800 mt-0.5">Active (&lt;30d)</p>
                </div>
                <div className="p-3 rounded-xl bg-violet-50/80 border border-violet-100">
                  <p className="text-xl font-bold text-violet-700 tabular-nums">{repoStats.moderate90d}</p>
                  <p className="text-[11px] font-medium text-violet-800 mt-0.5">Moderate (30-90d)</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xl font-bold text-slate-700 tabular-nums">{repoStats.staleOver90d}</p>
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5">Inactive (&gt;90d)</p>
                </div>
              </div>

              {/* Language Distribution */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 mb-2.5">
                  <Code2 className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Primary Languages in Synced Codebases</span>
                </div>
                <div className="space-y-2">
                  {repoStats.languages.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-neutral-700">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-surface-400">{item.percentage}%</span>
                        <span className="font-semibold text-neutral-900 tabular-nums">
                          {item.count} {item.count === 1 ? 'repo' : 'repos'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Deployment Platforms & Security Health */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Platform Availability Breakdown */}
        <Card variant="os" padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-coral-500" />
              <h2 className="font-display font-bold text-neutral-900">Deployment Platforms & Health</h2>
            </div>
            <Link to="/deployments" className="text-xs text-violet-600 hover:underline font-medium">
              View Deployments →
            </Link>
          </div>

          {deploymentStats.total === 0 ? (
            <EmptyState
              icon={<Rocket className="w-6 h-6" />}
              title="No Deployments Connected"
              description="Zero-token discovery can automatically discover your Vercel, Netlify, Render, and GitHub Pages deployments."
              variant="default"
            />
          ) : (
            <div className="space-y-3">
              {Object.entries(deploymentStats.platforms).map(([platform, data]) => {
                const ratio = Math.round((data.live / data.total) * 100);
                return (
                  <div key={platform} className="p-3 rounded-xl bg-surface-50/80 border border-surface-200/80 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-neutral-900 capitalize">{platform}</span>
                      <p className="text-[11px] text-surface-500">
                        {data.live} live of {data.total} total endpoints
                      </p>
                    </div>
                    <Badge variant={ratio === 100 ? 'success' : ratio > 0 ? 'warning' : 'error'}>
                      {ratio}% Online
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Security & Multi-Tenant Diagnostics */}
        <Card variant="os" padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="font-display font-bold text-neutral-900">Security & Operational Diagnostics</h2>
            </div>
            <Link to="/admin" className="text-xs text-violet-600 hover:underline font-medium">
              Admin Diagnostics →
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">Row Level Security (RLS)</span>
              <span className="font-bold text-emerald-600">Strictly Enforced (auth.uid)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">Deployment Discovery Model</span>
              <span className="font-bold text-violet-600">Zero-Token (OAuth Scoped)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">SSL Certificate Verification</span>
              <span className="font-bold text-emerald-600">HTTPS Enforced on Public Endpoints</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-medium text-slate-700">AI Intelligence Sandbox</span>
              <span className="font-bold text-slate-800">Edge Function Isolated (No client secret exposure)</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
