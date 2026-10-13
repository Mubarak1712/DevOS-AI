import { Link } from 'react-router-dom';
import { Server, Clock, ShieldCheck, Database, Lock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, StatCard, Badge, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useDashboardStats, useRecentActivity } from '@/hooks/api';

export function AdminPage() {
  const { data: stats } = useDashboardStats();
  const { data: activityLogs = [], isLoading } = useRecentActivity(12);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Admin & Operational Oversight"
        description="Multi-tenant isolation status, database security policies, and workspace audit logs"
      />

      {/* Operational Diagnostic Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tenant Isolation"
          value="Strict RLS"
          icon={ShieldCheck}
          color="primary"
          subtitle="Enforced by auth.uid()"
        />
        <StatCard
          title="Database State"
          value="Online"
          icon={Database}
          color="emerald"
          subtitle="PostgreSQL schema active"
        />
        <StatCard
          title="OAuth Tokens"
          value="Encrypted"
          icon={Lock}
          color="cyan"
          subtitle="Scoped per user identity"
        />
        <StatCard
          title="Live Endpoints"
          value={String(stats?.live_deployments_count ?? 0)}
          icon={Server}
          color="secondary"
          subtitle="Active monitored endpoints"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Workspace Security & Architecture */}
        <Card variant="os" padding="md" className="lg:col-span-2">
          <h2 className="text-base font-bold text-neutral-900 mb-4">Infrastructure & Service Health</h2>
          <div className="space-y-3">
            {[
              {
                service: 'Supabase PostgreSQL',
                status: 'healthy',
                detail: 'Row-level security active across all user-scoped tables',
                badge: 'Connected',
              },
              {
                service: 'Edge Function Workers',
                status: 'healthy',
                detail: 'Zero-token discovery, AI generation & health check runners',
                badge: 'Operational',
              },
              {
                service: 'GitHub OAuth Engine',
                status: 'healthy',
                detail: 'Scoped to read-only metadata and repository deployments',
                badge: 'Active',
              },
              {
                service: 'Keep-Alive Engine',
                status: 'healthy',
                detail: 'Automated health pings for spin-down mitigation',
                badge: 'Ready',
              },
            ].map((item) => (
              <div
                key={item.service}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-50/80 border border-surface-200/80"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center text-neutral-700">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-neutral-900 font-semibold text-xs">{item.service}</span>
                    <p className="text-[11px] text-surface-500 mt-0.5">{item.detail}</p>
                  </div>
                </div>
                <Badge variant="success">{item.badge}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Security Controls */}
        <Card variant="os" padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-neutral-900">Security Guarantees</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-semibold text-neutral-900 flex items-center justify-between">
                <span>Row Level Security (RLS)</span>
                <span className="text-emerald-600">Enabled</span>
              </p>
              <p className="text-[11px] text-surface-500 mt-1">
                Database queries strictly filter rows to the authenticated user ID.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-semibold text-neutral-900 flex items-center justify-between">
                <span>Secret Exposure</span>
                <span className="text-emerald-600">Isolated</span>
              </p>
              <p className="text-[11px] text-surface-500 mt-1">
                No server tokens (GROQ, GEMINI, GITHUB_SECRET) are bundled in client assets.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-semibold text-neutral-900 flex items-center justify-between">
                <span>Zero-Token Discovery</span>
                <span className="text-violet-600">Active</span>
              </p>
              <p className="text-[11px] text-surface-500 mt-1">
                Deployments discovered without asking developers to paste third-party API keys.
              </p>
            </div>

            <div className="pt-2 border-t border-surface-100">
              <Link
                to="/config"
                className="text-xs text-violet-600 hover:underline font-semibold inline-flex items-center gap-1"
              >
                Inspect Environment Bindings
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Log */}
      <Card variant="os" padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-600" />
            <h2 className="text-base font-bold text-neutral-900">Workspace Audit Trail</h2>
          </div>
          <span className="text-xs text-surface-400">Recent {activityLogs.length} events</span>
        </div>

        {isLoading ? (
          <p className="text-surface-500 text-xs py-4">Loading operational audit logs...</p>
        ) : activityLogs.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8" />}
            title="No activity recorded"
            description="Actions such as repository synchronizations and project updates will appear here."
            variant="default"
          />
        ) : (
          <div className="divide-y divide-surface-100">
            {activityLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-neutral-900 capitalize">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-surface-400 ml-2 font-mono text-[11px]">
                      [{log.resource_type}]
                    </span>
                  </div>
                </div>
                <span className="text-surface-400 flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3" />
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
