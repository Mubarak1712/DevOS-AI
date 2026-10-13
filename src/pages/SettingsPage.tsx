import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Shield,
  Link2,
  Zap,
  ArrowRight,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { Button, Card, Select, Modal, Input } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import {
  useSettings,
  useUpdateSettings,
  useIntegrations,
  useDeployments,
  useUpdateDeployment,
  useQueryClient,
} from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { checkUrlHealth } from '@/services/health';
import { supabase } from '@/lib/supabase';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [localSettings, setLocalSettings] = useState({
    notifications_email: true,
    notifications_in_app: true,
    auto_ping_enabled: false,
    auto_ping_interval: 10,
  });

  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Manual keep-alive ping state
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingResult, setLastPingResult] = useState<{
    timestamp: string;
    total: number;
    live: number;
    avgMs?: number;
  } | null>(null);

  // Danger zone modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: integrations = [] } = useIntegrations();
  const { data: deployments = [] } = useDeployments();
  const updateDeployment = useUpdateDeployment();

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        notifications_email: settings.notifications_email,
        notifications_in_app: settings.notifications_in_app,
        auto_ping_enabled: settings.auto_ping_enabled,
        auto_ping_interval: settings.auto_ping_interval,
      });
    }
  }, [settings]);

  const handleUpdateSettings = async (key: string, value: boolean | number) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings as typeof localSettings);

    try {
      await updateSettings.mutateAsync({
        updates: { [key]: value },
      });
      setSaveSuccess(`Preference updated`);
      setTimeout(() => setSaveSuccess(null), 2500);
    } catch {
      // Revert on error
      if (settings) {
        setLocalSettings({
          notifications_email: settings.notifications_email,
          notifications_in_app: settings.notifications_in_app,
          auto_ping_enabled: settings.auto_ping_enabled,
          auto_ping_interval: settings.auto_ping_interval,
        });
      }
    }
  };

  // Active Keep-Alive execution: ping all user deployments
  const handlePingAllNow = async () => {
    if (isPinging || deployments.length === 0) return;
    setIsPinging(true);

    try {
      let liveCount = 0;
      let totalLatency = 0;
      let timedCount = 0;

      for (const d of deployments) {
        if (!d.url) continue;
        try {
          const res = await checkUrlHealth(d.url, d.platform, d.id);
          if (res.status === 'live') {
            liveCount++;
          }
          if (res.responseTimeMs && res.responseTimeMs > 0) {
            totalLatency += res.responseTimeMs;
            timedCount++;
          }

          // Update deployment in database
          await updateDeployment.mutateAsync({
            deploymentId: d.id,
            updates: {
              status: res.status,
              response_time_ms: res.responseTimeMs,
              ssl_status: res.sslValid ? 'valid' : 'invalid',
            },
          });
        } catch (err) {
          console.warn(`Keep-alive ping failed for ${d.name}:`, err);
        }
      }

      setLastPingResult({
        timestamp: new Date().toLocaleTimeString(),
        total: deployments.length,
        live: liveCount,
        avgMs: timedCount > 0 ? Math.round(totalLatency / timedCount) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    } finally {
      setIsPinging(false);
    }
  };

  const handleClearCache = () => {
    queryClient.clear();
    window.location.reload();
  };

  const handleWipeData = async () => {
    if (deleteConfirmationText !== 'DELETE' || isDeleting || !user) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Delete user scoped records from public tables
      await supabase.from('deployments').delete().eq('user_id', user.id);
      await supabase.from('projects').delete().eq('user_id', user.id);
      await supabase.from('ideas').delete().eq('user_id', user.id);
      await supabase.from('repositories').delete().eq('user_id', user.id);
      await supabase.from('integrations').delete().eq('user_id', user.id);

      // Sign out and redirect to login
      await supabase.auth.signOut();
      queryClient.clear();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to wipe data.');
      setIsDeleting(false);
    }
  };

  const connectedCount = integrations.filter((i) => i.connected === true).length;
  const githubIntegration = integrations.find((i) => i.platform === 'github' && i.connected);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="Account"
        title="Settings & Workspace Preferences"
        description="Manage notification alerts, automated keep-alive engine, and workspace data maintenance"
        actions={
          saveSuccess && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5" />
              {saveSuccess}
            </span>
          )
        }
      />

      {/* Notifications */}
      <Card variant="os" padding="md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900">Notification Channels</h2>
            <p className="text-xs text-surface-500">Configure where you receive deployment status and system alerts</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer p-3.5 rounded-xl border border-surface-200/80 hover:bg-surface-50/80 transition-colors">
            <div>
              <p className="font-semibold text-xs text-neutral-900">Email Notifications</p>
              <p className="text-xs text-surface-500 mt-0.5">
                Receive build failure and critical deployment offline alerts via email
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.notifications_email}
              onChange={(e) => handleUpdateSettings('notifications_email', e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-3.5 rounded-xl border border-surface-200/80 hover:bg-surface-50/80 transition-colors">
            <div>
              <p className="font-semibold text-xs text-neutral-900">In-App Health Notifications</p>
              <p className="text-xs text-surface-500 mt-0.5">
                Display live deployment state changes and zero-token discovery notifications
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.notifications_in_app}
              onChange={(e) => handleUpdateSettings('notifications_in_app', e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
          </label>
        </div>
      </Card>

      {/* Auto Ping / Keep Alive Engine */}
      <Card variant="os" padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Keep Alive Engine</h2>
              <p className="text-xs text-surface-500">
                Pings free-tier deployment endpoints (Render, Fly.io, Railway) to prevent cold starts
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            localSettings.auto_ping_enabled
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-surface-100 text-surface-600'
          }`}>
            {localSettings.auto_ping_enabled ? 'Active' : 'Disabled'}
          </span>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer p-3.5 rounded-xl border border-surface-200/80 hover:bg-surface-50/80 transition-colors">
            <div>
              <p className="font-semibold text-xs text-neutral-900">Automated Background Keep-Alive</p>
              <p className="text-xs text-surface-500 mt-0.5">
                Periodically check and ping all {deployments.length} connected deployment URLs
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.auto_ping_enabled}
              onChange={(e) => handleUpdateSettings('auto_ping_enabled', e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
          </label>

          {localSettings.auto_ping_enabled && (
            <div className="p-3.5 bg-surface-50/80 rounded-xl border border-surface-200/80">
              <Select
                label="Automated Ping Interval"
                options={[
                  { value: '5', label: 'Every 5 minutes (High frequency)' },
                  { value: '10', label: 'Every 10 minutes (Recommended for free-tier Render)' },
                  { value: '15', label: 'Every 15 minutes' },
                  { value: '30', label: 'Every 30 minutes' },
                ]}
                value={String(localSettings.auto_ping_interval)}
                onChange={(e) => handleUpdateSettings('auto_ping_interval', parseInt(e.target.value))}
              />
            </div>
          )}

          {/* Active Ping Trigger */}
          <div className="p-3.5 rounded-xl bg-violet-50/60 border border-violet-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-violet-900">Manual Health Ping Verification</p>
              <p className="text-[11px] text-violet-700/80 mt-0.5">
                {lastPingResult
                  ? `Last checked at ${lastPingResult.timestamp}: ${lastPingResult.live}/${lastPingResult.total} endpoints responded ${lastPingResult.avgMs ? `(${lastPingResult.avgMs}ms latency)` : ''}`
                  : `Ping all ${deployments.length} deployment endpoints now to verify live response and SSL.`}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handlePingAllNow}
              disabled={isPinging || deployments.length === 0}
              isLoading={isPinging}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Ping Deployments Now
            </Button>
          </div>
        </div>
      </Card>

      {/* Connected Integrations Reference */}
      <Card variant="os" padding="md">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Integrations Status</h2>
              <p className="text-xs text-surface-500">
                {connectedCount} connected · Zero-token discovery active
              </p>
            </div>
          </div>
          <Link to="/integrations">
            <Button variant="secondary" size="sm">
              Manage Integrations
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>

        <div className="rounded-xl bg-surface-50/80 p-3.5 border border-surface-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${githubIntegration ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="text-neutral-800 font-medium">
              GitHub: {githubIntegration ? 'Connected (zero-token automated discovery)' : 'Not connected'}
            </span>
          </div>
          <Link to="/config" className="text-violet-600 hover:underline font-semibold">
            View Environment Configuration →
          </Link>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card variant="os" padding="md" className="border-rose-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-700">Danger Zone</h2>
            <p className="text-xs text-surface-500">Maintenance operations and workspace data wipe</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Action 1: Clear Cache */}
          <div className="p-3.5 rounded-xl bg-surface-50/80 border border-surface-200/80 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-xs text-neutral-900">Clear Workspace Cache & Re-sync</p>
              <p className="text-xs text-surface-500 mt-0.5">
                Flushes browser memory and re-queries latest data from Supabase and GitHub
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleClearCache}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Clear Cache
            </Button>
          </div>

          {/* Action 2: Wipe Workspace Data */}
          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-xs text-rose-900">Wipe Workspace Data & Sign Out</p>
              <p className="text-xs text-rose-700/85 mt-0.5">
                Permanently delete your synced projects, deployments, ideas, and sign out
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDeleteConfirmationText('');
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Wipe Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Wipe Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Workspace Data Wipe"
        description="This action cannot be undone. All your created projects, scanned deployments, and ideas will be removed."
        size="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p>
              You are about to delete all workspace records associated with your account (<strong>{user?.email}</strong>).
              Your GitHub account itself will not be affected.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">
              Type <strong className="text-rose-600 font-mono">DELETE</strong> to confirm:
            </label>
            <Input
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </div>

          {deleteError && (
            <p className="text-xs text-rose-600 font-medium">{deleteError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleWipeData}
              disabled={deleteConfirmationText !== 'DELETE' || isDeleting}
              isLoading={isDeleting}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Permanently Wipe Data
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
