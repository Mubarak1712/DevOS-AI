import { useState, useEffect } from 'react';
import { Bell, Shield, Link2, Zap, Unlink, CheckCircle } from 'lucide-react';
import { Button, Card, Select } from '@/components/ui';
import { useSettings, useUpdateSettings, useIntegrations, useCreateIntegration, useDisconnectIntegration } from '@/hooks/api';
import { useLogActivity } from '@/hooks/api';

const availableIntegrations = [
  { platform: 'github', name: 'GitHub', icon: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z' },
  { platform: 'vercel', name: 'Vercel', icon: 'M24 22.525H0L12 3zm-12-3.5' },
  { platform: 'netlify', name: 'Netlify', icon: '' },
  { platform: 'render', name: 'Render', icon: '' },
  { platform: 'railway', name: 'Railway', icon: '' },
  { platform: 'firebase', name: 'Firebase', icon: '' },
  { platform: 'cloudflare', name: 'Cloudflare', icon: '' },
  { platform: 'aws', name: 'AWS', icon: '' },
];

export function SettingsPage() {
  const [localSettings, setLocalSettings] = useState({
    notifications_email: true,
    notifications_in_app: true,
    auto_ping_enabled: false,
    auto_ping_interval: 10,
  });

  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: integrations = [] } = useIntegrations();
  const createIntegration = useCreateIntegration();
  const disconnectIntegration = useDisconnectIntegration();
  const logActivity = useLogActivity();

  // Update local settings when data loads
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

    await updateSettings.mutateAsync({
      updates: { [key]: value },
    });
  };

  const handleConnect = async (platform: string) => {
    if (platform === 'github') {
      // Redirect to GitHub OAuth
      window.location.href = '/github';
    } else {
      // For other platforms, show integration modal (simplified for now)
      await createIntegration.mutateAsync({
        platform,
        name: availableIntegrations.find(i => i.platform === platform)?.name || platform,
        connected: true,
      });

      await logActivity.mutateAsync({
        action: 'connected_integration',
        resourceType: 'integration',
        details: { platform },
      });
    }
  };

  const handleDisconnect = async (platform: string) => {
    await disconnectIntegration.mutateAsync(platform);
    await logActivity.mutateAsync({
      action: 'disconnected_integration',
      resourceType: 'integration',
      details: { platform },
    });
  };

  const getIntegration = (platform: string) => {
    return integrations.find(i => i.platform === platform);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-neutral-500 mt-1">Manage your account preferences and integrations</p>
      </div>

      {/* Notifications */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-semibold text-neutral-900">Notifications</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-neutral-900">Email Notifications</p>
              <p className="text-sm text-neutral-500">Receive critical alerts via email</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.notifications_email}
              onChange={(e) => handleUpdateSettings('notifications_email', e.target.checked)}
              className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-neutral-900">In-App Notifications</p>
              <p className="text-sm text-neutral-500">Show notifications in the dashboard</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.notifications_in_app}
              onChange={(e) => handleUpdateSettings('notifications_in_app', e.target.checked)}
              className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500 cursor-pointer"
            />
          </label>
        </div>
      </Card>

      {/* Auto Ping */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-5 h-5 text-warning-500" />
          <h2 className="text-lg font-semibold text-neutral-900">Keep Alive Engine</h2>
        </div>

        <p className="text-neutral-600 mb-4">
          Automatically ping your sleeping services to prevent cold starts on free tier deployments.
        </p>

        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-neutral-900">Enable Keep Alive</p>
              <p className="text-sm text-neutral-500">Automatically ping sleeping services</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.auto_ping_enabled}
              onChange={(e) => handleUpdateSettings('auto_ping_enabled', e.target.checked)}
              className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500 cursor-pointer"
            />
          </label>

          {localSettings.auto_ping_enabled && (
            <Select
              label="Ping Interval"
              options={[
                { value: '5', label: 'Every 5 minutes' },
                { value: '10', label: 'Every 10 minutes' },
                { value: '15', label: 'Every 15 minutes' },
                { value: '30', label: 'Every 30 minutes' },
              ]}
              value={String(localSettings.auto_ping_interval)}
              onChange={(e) => handleUpdateSettings('auto_ping_interval', parseInt(e.target.value))}
            />
          )}
        </div>
      </Card>

      {/* Integrations */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link2 className="w-5 h-5 text-cyan-500" />
          <h2 className="text-lg font-semibold text-neutral-900">Integrations</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {availableIntegrations.map((integration) => {
            const connected = getIntegration(integration.platform)?.connected ?? false;

            return (
              <div
                key={integration.platform}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  connected ? 'bg-success-50 border border-success-200' : 'bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    connected ? 'bg-success-100' : 'bg-white'
                  } border ${connected ? 'border-success-200' : 'border-neutral-200'}`}>
                    {integration.platform === 'github' ? (
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                    ) : (
                      <span className="text-neutral-400 font-bold text-sm">
                        {integration.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">{integration.name}</p>
                    <p className={`text-sm ${connected ? 'text-success-600' : 'text-neutral-500'}`}>
                      {connected ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                </div>
                {connected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(integration.platform)}
                      className="text-neutral-500 hover:text-error-600"
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleConnect(integration.platform)}
                  >
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-error-200">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-error-500" />
          <h2 className="text-lg font-semibold text-error-600">Danger Zone</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-error-50">
            <div>
              <p className="font-medium text-neutral-900">Delete Account</p>
              <p className="text-sm text-neutral-500">Permanently delete your account and all data</p>
            </div>
            <Button variant="danger" size="sm" className="pointer-events-none opacity-50">
              Delete Account
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
