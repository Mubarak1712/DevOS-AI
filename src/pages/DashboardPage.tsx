import { motion } from 'framer-motion';
import {
  Github,
  Rocket,
  Link2,
  CheckCircle,
  Circle,
  FolderKanban,
  Bell,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDeployments,
  useRepositories,
  useIntegrations,
  useDashboardStats,
  useQueryInitialLoading,
  useNotifications,
} from '@/hooks/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  action: string;
  completed: boolean;
  icon: React.ElementType;
}

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    data: stats,
    isPending: statsPending,
    fetchStatus: statsFetchStatus,
  } = useDashboardStats();
  const { data: deployments = [] } = useDeployments();
  const { data: repositories = [] } = useRepositories();
  const { data: integrations = [] } = useIntegrations();
  const { data: notifications = [] } = useNotifications(true);

  const statsLoading = useQueryInitialLoading(authLoading, statsPending, statsFetchStatus);
  const unreadNotifications = notifications.length;

  const githubConnected = integrations.some((i) => i.platform === 'github' && i.connected === true);
  const connectedIntegrations = integrations.filter((i) => i.connected === true).length;
  const hasDeployments = (stats?.deployments_count ?? deployments.length) > 0;
  const hasRepositories = (stats?.repositories_count ?? repositories.length) > 0;
  const hasProviderConnected = integrations.some(
    (i) => i.connected === true && ['vercel', 'netlify', 'render', 'railway'].includes(i.platform)
  );

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'github',
      title: 'Connect GitHub',
      description: 'Link your GitHub account to sync repositories and track project health.',
      href: '/github',
      action: githubConnected ? 'Connected' : 'Connect',
      completed: githubConnected,
      icon: Github,
    },
    {
      id: 'platforms',
      title: 'Connect Deployment Platforms',
      description: 'Sync Vercel, Netlify, Render, or Railway to track live deployments.',
      href: '/integrations',
      action: hasProviderConnected ? 'Connected' : 'Connect',
      completed: hasProviderConnected,
      icon: Link2,
    },
    {
      id: 'sync',
      title: 'Sync Your Data',
      description: 'Once connected, repositories and deployments sync from your database.',
      href: '/deployments',
      action: hasRepositories || hasDeployments ? 'Synced' : 'Sync',
      completed: hasRepositories || hasDeployments,
      icon: Rocket,
    },
  ];

  const onboardingComplete = onboardingSteps.every((s) => s.completed);
  const liveDeployments = stats?.live_deployments_count ?? deployments.filter((d) => d.status === 'live').length;

  const statCards = [
    {
      label: 'Active Projects',
      value: stats?.active_projects_count ?? 0,
      icon: FolderKanban,
      bgColor: 'bg-[#F3EBFF]',
      iconBg: 'bg-white/90',
      iconColor: 'text-[#4C2A8C]',
    },
    {
      label: 'Repositories',
      value: stats?.repositories_count ?? repositories.length,
      icon: Github,
      bgColor: 'bg-[#E8F4FF]',
      iconBg: 'bg-white/90',
      iconColor: 'text-[#1E62AA]',
    },
    {
      label: 'Integrations',
      value: stats?.integrations_count ?? connectedIntegrations,
      icon: Link2,
      bgColor: 'bg-[#FFF7D6]',
      iconBg: 'bg-white/90',
      iconColor: 'text-[#7B5A00]',
    },
    {
      label: 'Deployments',
      value: stats?.deployments_count ?? deployments.length,
      icon: Rocket,
      bgColor: 'bg-[#E8FFF3]',
      iconBg: 'bg-white/90',
      iconColor: 'text-[#0F6B56]',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Command Center"
        title={`Welcome${user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ''}`}
        description={
          onboardingComplete
            ? 'Your workspace at a glance — all metrics from live database data.'
            : 'Complete setup to unlock your developer operating system.'
        }
        variant="hero"
        className="rounded-[32px] border border-[#F5D0EF] bg-[#FCEEF8] p-8 shadow-[0_20px_50px_rgba(124,58,237,0.08)]"
        actions={
          unreadNotifications > 0 ? (
            <Link to="/notifications">
              <span className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl bg-[#FFB3A7]/15 text-[#C24433] hover:bg-[#FFB3A7]/25 transition-colors">
                <Bell className="w-4 h-4" />
                {unreadNotifications} unread
              </span>
            </Link>
          ) : undefined
        }
      />

      {!onboardingComplete ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-7 border border-[#D9C5FF] bg-[#FCEEF8] shadow-[0_18px_48px_rgba(124,58,237,0.08)] rounded-[32px]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#1F1145]">Get started</h2>
                <p className="text-sm text-[#4C4B6F] mt-1">Step through your workspace setup with premium guidance.</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#EEE6FF] px-3 py-2 text-sm font-semibold text-[#2A1F5E]">
                {onboardingSteps.filter((step) => step.completed).length} of {onboardingSteps.length} complete
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {onboardingSteps.map((step) => (
                <Link
                  key={step.id}
                  to={step.href}
                  className="group flex flex-col gap-3 rounded-[24px] border border-[#D9C5FF] bg-[#EEE6FF] p-5 transition hover:shadow-[0_20px_50px_rgba(124,58,237,0.14)]"
                >
                  <div className={`w-12 h-12 rounded-3xl flex items-center justify-center ${step.completed ? 'bg-[#D1FAE5] text-emerald-700' : 'bg-[#DBEAFE] text-sky-700'}`}>
                    {step.completed ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                    <p className="text-sm text-slate-600">{step.description}</p>
                  </div>
                  <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${step.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-[#FBCFE8] text-rose-700'}`}>
                    {step.action}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {statsLoading
            ? [1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-5 animate-pulse">
                  <div className="h-10 w-10 bg-slate-200 rounded-xl mb-3" />
                  <div className="h-7 bg-slate-200 rounded w-12 mb-1" />
                  <div className="h-4 bg-slate-100 rounded w-24" />
                </Card>
              ))
            : statCards.map((stat) => (
              <Card key={stat.label} className={`border border-[#D9C5FF] ${stat.bgColor} rounded-[28px]`}>
                <div className="p-6 space-y-4">
                  <div className={`w-14 h-14 rounded-3xl ${stat.iconBg} flex items-center justify-center shadow-sm`}>
                    <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2F1F5E]">
                      {stat.label}
                    </p>
                    <h3 className="text-3xl font-bold text-[#16123A] mt-2">
                      {stat.value}
                    </h3>
                  </div>
                </div>
              </Card>
            ))}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/github">
            <Card className="h-full border border-[#B3D9FF] bg-[#E8F4FF] shadow-[0_12px_40px_rgba(26,100,167,0.08)] rounded-[28px]">
              <div className="flex items-center gap-3 p-5">
                <div className="w-12 h-12 rounded-3xl bg-white flex items-center justify-center shadow-sm">
                  <Github className="w-6 h-6 text-[#1E62AA]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1F1145]">GitHub</p>
                  <p className="text-sm text-[#4C4B6F]">{hasRepositories ? `${stats?.repositories_count ?? repositories.length} repos` : githubConnected ? 'Connected' : 'Connect'}</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/deployments">
            <Card className="h-full border border-[#C5F1DF] bg-[#E8FFF3] shadow-[0_12px_40px_rgba(17,110,85,0.08)] rounded-[28px]">
              <div className="flex items-center gap-3 p-5">
                <div className="w-12 h-12 rounded-3xl bg-white flex items-center justify-center shadow-sm">
                  <Rocket className="w-6 h-6 text-[#0F6B56]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1F1145]">Deployments</p>
                  <p className="text-sm text-[#4C4B6F]">{hasDeployments ? `${liveDeployments} live` : 'View all'}</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/integrations">
            <Card className="h-full border border-[#F7D4E8] bg-[#FCEEF8] shadow-[0_12px_40px_rgba(199,118,214,0.08)] rounded-[28px]">
              <div className="flex items-center gap-3 p-5">
                <div className="w-12 h-12 rounded-3xl bg-white flex items-center justify-center shadow-sm">
                  <Link2 className="w-6 h-6 text-[#A43A9E]" />
                </div>
                <div>
                  <p className="font-semibold text-[#1F1145]">Integrations</p>
                  <p className="text-sm text-[#4C4B6F]">{connectedIntegrations} connected</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/config">
            <Card className="h-full border border-[#DDD6FE] bg-[#FCE7F3] shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
              <div className="flex items-center gap-3 p-5">
                <div className="w-12 h-12 rounded-3xl bg-white/90 flex items-center justify-center shadow-sm">
                  <Circle className="w-6 h-6 text-rose-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Configuration</p>
                  <p className="text-sm text-slate-600">Settings</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </motion.div>

      {(hasRepositories || hasDeployments) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid md:grid-cols-2 gap-6"
        >
          {hasRepositories && (
            <Card className="p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">Recent Repositories</h2>
                <Link to="/github" className="text-sm text-cyan-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {repositories.slice(0, 4).map((repo) => (
                  <div key={repo.id} className="flex items-center justify-between p-4 rounded-3xl bg-[#F8FAFD] border border-slate-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <Github className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="font-medium text-slate-900 text-sm truncate">{repo.name}</span>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{repo.language || '—'}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {hasDeployments && (
            <Card className="p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">Recent Deployments</h2>
                <Link to="/deployments" className="text-sm text-cyan-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {deployments.slice(0, 4).map((deployment) => (
                  <div key={deployment.id} className="p-4 rounded-3xl bg-[#F8FAFD] border border-slate-200">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Rocket className="w-4 h-4 text-rose-500 flex-shrink-0" />
                          <h3 className="font-medium text-slate-900 text-sm truncate">{deployment.name}</h3>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {deployment.url || 'No URL'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex self-start text-xs font-medium px-2 py-1 rounded-full capitalize ${
                          deployment.status === 'live'
                            ? 'bg-emerald-100 text-emerald-700'
                            : deployment.status === 'sleeping'
                              ? 'bg-amber-100 text-amber-700'
                              : deployment.status === 'offline' || deployment.status === 'error'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {deployment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}
