import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ExternalLink, Unlink, Plus, RefreshCw, AlertTriangle, Github } from 'lucide-react';
import { Button, Card, Modal } from '@/components/ui';
import {
  useIntegrations,
  useRepositories,
  useDisconnectIntegration,
  useQueryClient,
  useDeployments,
  useLogActivity,
  useProviderConfigs,
  useQueryInitialLoading,
} from '@/hooks/api';
import { PageHeader } from '@/components/design/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { integrationService } from '@/services/api';
import { githubService } from '@/services/github';

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  icon: React.ReactNode;
}

const deploymentProviders: ProviderConfig[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy frontend projects and serverless functions.',
    docsUrl: 'https://vercel.com/docs/rest-api',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-900" fill="currentColor">
        <path d="M24 22.525H0L12 3zm-12-3.5" />
      </svg>
    ),
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Static sites and serverless functions.',
    docsUrl: 'https://docs.netlify.com/api/get-started/',
    icon: <span className="text-lg font-bold text-slate-900">N</span>,
  },
  {
    id: 'render',
    name: 'Render',
    description: 'Web services, databases, and background jobs.',
    docsUrl: 'https://render.com/docs/api',
    icon: <span className="text-lg font-bold text-slate-900">R</span>,
  },
  {
    id: 'railway',
    name: 'Railway',
    description: 'Deploy code from GitHub in seconds.',
    docsUrl: 'https://docs.railway.app/',
    icon: <span className="text-lg font-bold text-slate-900">RW</span>,
  },
];

function isIntegrationConnected(
  integrations: { platform: string; connected: boolean }[],
  platform: string
) {
  return integrations.some((i) => i.platform === platform && i.connected === true);
}

export function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { count: number; error?: string }>>({});

  const {
    data: integrations = [],
    isPending: integrationsPending,
    fetchStatus: integrationsFetchStatus,
    refetch: refetchIntegrations,
  } = useIntegrations();
  const { data: repositories = [] } = useRepositories();
  const { data: deployments = [] } = useDeployments();
  const { data: providerConfigs = [] } = useProviderConfigs();
  const disconnectIntegration = useDisconnectIntegration();
  const logActivity = useLogActivity();

  const integrationsLoading = useQueryInitialLoading(
    authLoading,
    integrationsPending,
    integrationsFetchStatus
  );

  const githubConnected = isIntegrationConnected(integrations, 'github');
  const connectedCount = integrations.filter((i) => i.connected === true).length;
  const configuredCount = providerConfigs.filter((p) => p.configured).length;
  const deploymentCount = deployments.length;
  const repositoryCount = repositories.length;

  const getIntegration = (providerId: string) =>
    integrations.find((i) => i.platform === providerId);

  const isProviderConfigured = (providerId: string): boolean =>
    providerConfigs.find((p) => p.provider === providerId)?.configured ?? false;

  const providerDeployments = (providerId: string) =>
    deployments.filter((d) => d.platform === providerId).length;

  const handleConnect = (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    setError(null);
    setIsConnectModalOpen(true);
  };

  const handleGitHubConnect = () => {
    try {
      setError(null);
      githubService.initiateOAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate GitHub connection');
    }
  };

  const handleGitHubDisconnect = async () => {
    if (!user) return;
    if (!confirm('Disconnect GitHub? Your synced repositories will remain until you reconnect.')) return;
    await disconnectIntegration.mutateAsync('github');
    await logActivity.mutateAsync({
      action: 'disconnected_github',
      resourceType: 'integration',
      details: { platform: 'github' },
    });
  };

  const syncDeployments = async (providerId: string) => {
    if (!user) return;

    setSyncingProvider(providerId);
    setError(null);

    try {
      const { data, error: syncError } = await supabase.functions.invoke('sync-deployments', {
        body: { userId: user.id, provider: providerId },
      });

      if (syncError) throw syncError;
      if (data?.error) throw new Error(data.error);

      await integrationService.createOrUpdate({
        user_id: user.id,
        platform: providerId,
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        connected: true,
        connected_at: new Date().toISOString(),
      });

      setSyncResults((prev) => ({
        ...prev,
        [providerId]: { count: data?.count ?? 0 },
      }));

      await logActivity.mutateAsync({
        action: 'synced_deployments',
        resourceType: 'integration',
        details: { platform: providerId, count: data?.count ?? 0 },
      });

      await queryClient.invalidateQueries({ queryKey: ['deployments'] });
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      refetchIntegrations();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to sync';
      setSyncResults((prev) => ({
        ...prev,
        [providerId]: { count: 0, error: errorMsg },
      }));
      setError(errorMsg);
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleConfirmConnect = async () => {
    if (!selectedProvider || !user) return;
    setIsConnectModalOpen(false);
    await syncDeployments(selectedProvider.id);
  };

  const handleDisconnect = async (providerId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    await disconnectIntegration.mutateAsync(providerId);
    await logActivity.mutateAsync({
      action: 'disconnected_integration',
      resourceType: 'integration',
      details: { platform: providerId },
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connections"
        title="Integrations"
        description="A polished hub for all connected GitHub and deployment platforms."
        actions={
          <Button variant="secondary" onClick={() => refetchIntegrations()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Connected</p>
          <p className="text-3xl font-bold text-slate-900">{connectedCount}</p>
          <p className="text-xs text-slate-500 mt-2">Active integrations</p>
        </Card>
        <Card className="p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Configured</p>
          <p className="text-3xl font-bold text-slate-900">{configuredCount}</p>
          <p className="text-xs text-slate-500 mt-2">Provider tokens detected</p>
        </Card>
        <Card className="p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Deployments</p>
          <p className="text-3xl font-bold text-slate-900">{deploymentCount}</p>
          <p className="text-xs text-slate-500 mt-2">Tracked deployments</p>
        </Card>
        <Card className="p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Repositories</p>
          <p className="text-3xl font-bold text-slate-900">{repositoryCount}</p>
          <p className="text-xs text-slate-500 mt-2">Synced repos</p>
        </Card>
      </div>

      {error && (
        <Card className="p-4 bg-rose-50 border border-rose-200 text-rose-700">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        </Card>
      )}

      <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Source control</h2>
              <p className="text-sm text-slate-500">GitHub sync and repository metadata from your connected integration.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {githubConnected ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                  GitHub connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Not connected
                </span>
              )}
            </div>
          </div>

        <Card className={`p-6 border border-slate-200 shadow-sm`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-900 text-2xl">
                <Github className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">GitHub</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Sync your repositories, watch activity, and link commits to deployments.
                </p>
                {githubConnected && (
                  <p className="text-sm font-medium text-emerald-700 mt-3">
                    {repositoryCount} synced {repositoryCount === 1 ? 'repository' : 'repositories'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {githubConnected ? (
                <>
                  <Link to="/github">
                    <Button variant="secondary" size="sm">
                      View Repositories
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleGitHubDisconnect} className="text-error-600">
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </>
              ) : config.isGitHubClientConfigured ? (
                <Button size="sm" onClick={handleGitHubConnect}>
                  <Github className="w-4 h-4 mr-2" />
                  Connect GitHub
                </Button>
              ) : (
                <Link to="/config">
                  <Button size="sm" variant="secondary">
                    Configure OAuth
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Deployment platforms</h2>
            <p className="text-sm text-slate-500">Connected platforms and sync status for your deployment providers.</p>
          </div>
          <div className="text-sm text-slate-500">Sync updates reflected in database-backed deployments.</div>
        </div>

        {integrationsLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((index) => (
              <Card key={index} className="p-6 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {deploymentProviders.map((provider, index) => {
              const integration = getIntegration(provider.id);
              const isConnected = integration?.connected === true;
              const isConfigured = isProviderConfigured(provider.id);
              const syncInProgress = syncingProvider === provider.id;
              const syncResult = syncResults[provider.id];

              return (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-6 bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-900 shadow-sm">
                          {provider.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                          <p className="text-sm text-slate-500 mt-1">{provider.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isConfigured && (
                          <span className="text-xs text-cyan-800 bg-cyan-100 px-2.5 py-1 rounded-full">Token ready</span>
                        )}
                        {isConnected && (
                          <span className="flex items-center gap-1 text-xs text-success-700 font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Connected
                          </span>
                        )}
                      </div>
                    </div>

                    {(isConnected || providerDeployments(provider.id) > 0) && (
                      <div className="mt-5 rounded-3xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Deployments tracked</span>
                          <span className="font-semibold text-slate-900">{providerDeployments(provider.id)}</span>
                        </div>
                        {syncResult && (
                          <p className={`mt-2 ${syncResult.error ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {syncResult.error
                              ? `Sync error: ${syncResult.error}`
                              : `Last sync: ${syncResult.count} deployment${syncResult.count === 1 ? '' : 's'}`}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      {isConfigured ? (
                        <>
                          <Button
                            variant={isConnected ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => syncDeployments(provider.id)}
                            isLoading={syncInProgress}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {isConnected ? 'Sync' : 'Connect & Sync'}
                          </Button>
                          <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-violet-600 hover:underline inline-flex items-center gap-1"
                          >
                            Docs <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => handleConnect(provider)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Connect
                          </Button>
                          <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-violet-600 hover:underline inline-flex items-center gap-1"
                          >
                            Docs <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                      {isConnected && (
                        <Button variant="ghost" size="sm" onClick={() => handleDisconnect(provider.id)} className="text-error-600">
                          <Unlink className="w-4 h-4 mr-2" />
                          Disconnect
                        </Button>
                      )}
                    </div>

                    {!isConfigured && (
                      <p className="mt-4 text-xs text-slate-500 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                        Add <code className="bg-slate-100 px-1 rounded text-xs text-slate-700">{provider.id.toUpperCase()}_TOKEN</code> to Edge Function secrets and then sync.
                      </p>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title={`Connect ${selectedProvider?.name ?? ''}`}
        description={selectedProvider ? `Add your ${selectedProvider.name} API token to server environment variables, then sync.` : ''}
        size="md"
      >
        {selectedProvider && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
              <code className="block rounded-2xl bg-white p-3 text-sm font-mono text-slate-700">
                {selectedProvider.id.toUpperCase()}_TOKEN=your_api_token
              </code>
            </div>
            {isProviderConfigured(selectedProvider.id) ? (
              <p className="text-sm text-success-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Token configured — click Sync to import deployments.
              </p>
            ) : (
              <p className="text-sm text-warning-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No server token detected yet.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" className="flex-1" onClick={() => setIsConnectModalOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleConfirmConnect} isLoading={syncingProvider === selectedProvider.id}>
                {isProviderConfigured(selectedProvider.id) ? 'Sync Now' : 'Check & Sync'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
