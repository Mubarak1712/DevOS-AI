import { Users, Activity, Server, Brain, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, StatCard, Badge, EmptyState } from '@/components/ui';
import { useDashboardStats, useRecentActivity } from '@/hooks/api';

export function AdminPage() {
  const { data: stats } = useDashboardStats();
  const { data: activityLogs = [], isLoading } = useRecentActivity(10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Admin Panel</h1>
        <p className="text-surface-500 mt-2">Your workspace overview and activity</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Projects" value={String(stats?.projects_count ?? 0)} icon={Users} color="primary" />
        <StatCard title="Repositories" value={String(stats?.repositories_count ?? 0)} icon={Users} color="secondary" />
        <StatCard title="Deployments" value={String(stats?.deployments_count ?? 0)} icon={Activity} color="emerald" />
        <StatCard title="Integrations" value={String(stats?.integrations_count ?? 0)} icon={Brain} color="cyan" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Workspace Health</h2>
          <div className="space-y-4">
            {[
              { service: 'Supabase Database', status: stats ? 'connected' : 'loading', detail: 'Schema synced' },
              { service: 'GitHub Integration', status: (stats?.repositories_count ?? 0) > 0 ? 'connected' : 'pending', detail: `${stats?.repositories_count ?? 0} repositories` },
              { service: 'Deployments', status: (stats?.deployments_count ?? 0) > 0 ? 'connected' : 'pending', detail: `${stats?.live_deployments_count ?? 0} live` },
            ].map((item) => (
              <div key={item.service} className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-surface-400" />
                  <div>
                    <span className="text-neutral-700">{item.service}</span>
                    <p className="text-xs text-surface-400">{item.detail}</p>
                  </div>
                </div>
                <Badge variant={item.status === 'connected' ? 'success' : 'warning'}>{item.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-surface-600">Projects</span>
              <span className="font-semibold text-neutral-900">{stats?.projects_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-600">Deployments</span>
              <span className="font-semibold text-neutral-900">{stats?.deployments_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-600">Repositories</span>
              <span className="font-semibold text-neutral-900">{stats?.repositories_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-600">Integrations</span>
              <span className="font-semibold text-neutral-900">{stats?.integrations_count ?? 0}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Activity Log</h2>
        {isLoading ? (
          <p className="text-surface-500 text-sm">Loading activity...</p>
        ) : activityLogs.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8" />}
            title="No activity yet"
            description="Actions like connecting GitHub or syncing deployments will appear here."
          />
        ) : (
          <div className="space-y-4">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-3 border-b border-surface-100 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-neutral-700">{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-surface-500 text-sm">{log.resource_type}</span>
                </div>
                <span className="text-sm text-surface-400 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
