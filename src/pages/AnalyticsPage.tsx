import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Activity, GitCommit, Rocket, Github, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, StatCard, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useDashboardStats, useProjects, useDeployments, useIntegrations } from '@/hooks/api';

function MetricBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-surface-600">{label}</span>
        <span className="font-semibold text-neutral-900 tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: projects = [] } = useProjects();
  const { data: deployments = [] } = useDeployments();
  const { data: integrations = [] } = useIntegrations();

  const githubConnected = integrations.some((i) => i.platform === 'github' && i.connected);
  const hasData = (stats?.projects_count ?? 0) > 0 || (stats?.deployments_count ?? 0) > 0 || (stats?.repositories_count ?? 0) > 0;
  const liveDeployments = deployments.filter((d) => d.status === 'live').length;
  const activeProjects = projects.filter((p) => p.status === 'development' || p.status === 'testing').length;

  const maxMetric = Math.max(
    stats?.projects_count ?? 0,
    stats?.repositories_count ?? 0,
    stats?.deployments_count ?? 0,
    stats?.integrations_count ?? 0,
    1
  );

  const statCards = [
    { title: 'Projects', value: String(stats?.projects_count ?? 0), icon: BarChart3, color: 'primary' as const, subtitle: `${activeProjects} active` },
    { title: 'Repositories', value: String(stats?.repositories_count ?? 0), icon: Github, color: 'cyan' as const },
    { title: 'Deployments', value: String(stats?.deployments_count ?? 0), icon: Rocket, color: 'coral' as const, subtitle: `${liveDeployments} live` },
    { title: 'Integrations', value: String(stats?.integrations_count ?? 0), icon: Link2, color: 'secondary' as const },
  ];

  if (!isLoading && !hasData) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Analytics" description="Real metrics from your connected workspace" />
        <Card variant="os" padding="none">
          <EmptyState
            icon={<TrendingUp className="w-8 h-8" />}
            title="No analytics yet"
            description="Connect GitHub and deployment platforms to start tracking productivity and health metrics."
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
        eyebrow="Insights"
        title="Analytics"
        description="Live workspace metrics — no estimates, no placeholders"
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card variant="os" padding="md">
          <h2 className="font-display font-bold text-neutral-900 mb-6">Workspace breakdown</h2>
          <div className="space-y-5">
            <MetricBar label="Projects" value={stats?.projects_count ?? 0} max={maxMetric} color="from-violet-500 to-purple-600" />
            <MetricBar label="Repositories" value={stats?.repositories_count ?? 0} max={maxMetric} color="from-cyan-500 to-teal-500" />
            <MetricBar label="Deployments" value={stats?.deployments_count ?? 0} max={maxMetric} color="from-coral-500 to-peach-500" />
            <MetricBar label="Connected integrations" value={stats?.integrations_count ?? 0} max={maxMetric} color="from-purple-500 to-violet-600" />
          </div>
        </Card>

        <Card variant="gradient" padding="md">
          <h2 className="font-display font-bold text-neutral-900 mb-4">Deployment health</h2>
          {deployments.length === 0 ? (
            <EmptyState icon={<Rocket className="w-8 h-8" />} title="No deployments" description="Sync a platform to see health metrics." variant="default" />
          ) : (
            <div className="space-y-6">
              <div className="text-center py-4">
                <p className="font-display text-5xl font-bold gradient-text-violet tabular-nums">
                  {Math.round((liveDeployments / deployments.length) * 100)}%
                </p>
                <p className="text-sm text-surface-500 mt-2">Live deployment ratio</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-white/80">
                  <p className="font-bold text-success-600">{liveDeployments}</p>
                  <p className="text-xs text-surface-500">Live</p>
                </div>
                <div className="p-3 rounded-xl bg-white/80">
                  <p className="font-bold text-neutral-900">{deployments.length}</p>
                  <p className="text-xs text-surface-500">Total</p>
                </div>
                <div className="p-3 rounded-xl bg-white/80">
                  <p className="font-bold text-warning-600">{deployments.length - liveDeployments}</p>
                  <p className="text-xs text-surface-500">Other</p>
                </div>
              </div>
              <Link to="/deployments" className="text-sm text-violet-600 hover:underline inline-block">
                View all deployments →
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card variant="glass" padding="md">
          <h2 className="font-display font-bold text-neutral-900 mb-4">Productivity</h2>
          <div className="text-center py-6">
            <p className="font-display text-4xl font-bold text-violet-600 tabular-nums">{activeProjects}</p>
            <p className="text-sm text-surface-500 mt-2">Active projects in development</p>
          </div>
        </Card>
        <Card variant="glass" padding="md">
          <h2 className="font-display font-bold text-neutral-900 mb-4">Commit activity</h2>
          <div className="text-center py-6">
            <GitCommit className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-surface-600 text-sm">Requires GitHub webhook integration</p>
          </div>
        </Card>
        <Card variant="glass" padding="md">
          <h2 className="font-display font-bold text-neutral-900 mb-4">Activity</h2>
          <div className="flex items-center justify-center py-6">
            <Activity className="w-10 h-10 text-cyan-500" />
          </div>
          <p className="text-center text-sm text-surface-500">Based on your synced workspace data</p>
        </Card>
      </div>
    </div>
  );
}
