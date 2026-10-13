import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, ExternalLink, Unlink, RefreshCw, AlertTriangle, Github, Key, ShieldCheck, Lock } from 'lucide-react';
import { Button, Card, Modal, Input } from '@/components/ui';
import {
  useIntegrations,
  useRepositories,
  useDisconnectIntegration,
  useDeployments,
  useLogActivity,
  useConnectProvider,
  useSyncDeployments,
  useSyncRepositories,
  useQueryInitialLoading,
} from '@/hooks/api';
import { PageHeader } from '@/components/design/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { config } from '@/lib/config';
import { githubService } from '@/services/github';

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  tokenName: string;
  tokenPlaceholder: string;
  docsUrl: string;
  tokenHelpUrl: string;
  icon: React.ReactNode;
}

const deploymentProviders: ProviderConfig[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Frontend projects, Edge Middleware, and serverless functions.',
    tokenName: 'Personal Access Token',
    tokenPlaceholder: 'vercel_pat_...',
    docsUrl: 'https://vercel.com/docs/rest-api',
    tokenHelpUrl: 'https://vercel.com/account/tokens',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-900" fill="currentColor">
        <path d="M24 22.525H0L12 3zm-12-3.5" />
      </svg>
    ),
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Static sites, continuous deployment, and serverless functions.',
    tokenName: 'Personal Access Token',
    tokenPlaceholder: 'nfp_...',
    docsUrl: 'https://docs.netlify.com/api/get-started/',
    tokenHelpUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
    icon: <span className="text-lg font-bold text-slate-900">N</span>,
  },
  {
    id: 'render',
    name: 'Render',
    description: 'Cloud web services, background workers, and databases.',
    tokenName: 'API Key',
    tokenPlaceholder: 'rnd_...',
    docsUrl: 'https://render.com/docs/api',
    tokenHelpUrl: 'https://dashboard.render.com/u/settings#api-keys',
    icon: <span className="text-lg font-bold text-slate-900">R</span>,
  },
  {
    id: 'railway',
    name: 'Railway',
    description: 'Instant infrastructure, databases, and microservices.',
    tokenName: 'API Token',
    tokenPlaceholder: 'railway_...',
    docsUrl: 'https://docs.railway.app/',
    tokenHelpUrl: 'https://railway.app/account/tokens',
    icon: <span className="text-lg font-bold text-slate-900">RW</span>,
  },
];

export function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
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

  const connectProviderMutation = useConnectProvider();
  const syncDeploymentsMutation = useSyncDeployments();
  const syncRepositoriesMutation = useSyncRepositories();
  const disconnectIntegration = useDisconnectIntegration();
  const logActivity = useLogActivity();

  const integrationsLoading = useQueryInitialLoading(
    authLoading,
    integrationsPending,
    integrationsFetchStatus
  );

  const getIntegration = (providerId: string) =>
    integrations.find((i) => i.platform === providerId);

  const githubIntegration = getIntegration('github');
  const githubConnected = githubIntegration?.connected === true;
  const githubMetadata = (githubIntegration?.metadata as Record<string, unknown>) || {};
  const githubAccount = (githubMetadata.login || githubMetadata.username || githubMetadata.name) as string | undefined;
  const githubAvatar = githubMetadata.avatar_url as string | undefined;
  const connectedCount = integrations.filter((i) => i.connected === true).length;
  const deploymentCount = deployments.length;
  const repositoryCount = repositories.length;

  const providerDeployments = (providerId: string) =>
    deployments.filter((d) => d.platform === providerId).length;

  const handleOpenConnectModal = (provider: ProviderConfig) => {
    setSelectedProvider(provider);
    setTokenInput('');
    setConnectError(null);
    setIsConnectModalOpen(true);
  };

  const handleGitHubConnect = async () => {
    try {
      setError(null);
      await githubService.initiateOAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate GitHub connection');
    }
  };

  const handleGitHubDisconnect = async () => {
    if (!user) return;
    if (!confirm('Disconnect GitHub? Your synced repositories will remain in DevOS AI until you choose to remove them.')) return;
    try {
      await disconnectIntegration.mutateAsync('github');
      await logActivity.mutateAsync({
        action: 'disconnected_github',
        resourceType: 'integration',
        details: { platform: 'github' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect GitHub');
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !tokenInput.trim()) {
      setConnectError('Please enter a valid token.');
      return;
    }

    setConnectError(null);

    try {
      await connectProviderMutation.mutateAsync({
        provider: selectedProvider.id,
        token: tokenInput.trim(),
      });

      setIsConnectModalOpen(false);
      setTokenInput('');

      // Auto-trigger sync right after connecting
      await handleSync(selectedProvider.id);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect provider. Please check your credentials.');
    }
  };

  const handleSync = async (providerId: string) => {
    if (!user) return;

    setSyncingProvider(providerId);
    setError(null);

    try {
      const integration = getIntegration(providerId);
      if (integration?.connected) {
        const result = await syncDeploymentsMutation.mutateAsync(providerId);
        setSyncResults((prev) => ({
          ...prev,
          [providerId]: { count: result.count },
        }));
      } else {
        // Zero-token mode: discover deployments from connected GitHub repositories
        await syncRepositoriesMutation.mutateAsync();
        const count = providerDeployments(providerId);
        setSyncResults((prev) => ({
          ...prev,
          [providerId]: { count },
        }));
      }
    } catch {
      // Fallback to GitHub discovery if provider credentials are not present
      try {
        await syncRepositoriesMutation.mutateAsync();
        const count = providerDeployments(providerId);
        setSyncResults((prev) => ({
          ...prev,
          [providerId]: { count },
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to sync deployments';
        setSyncResults((prev) => ({
          ...prev,
          [providerId]: { count: 0, error: errorMsg },
        }));
        setError(errorMsg);
      }
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to disconnect ${providerId.charAt(0).toUpperCase() + providerId.slice(1)}? Your credentials will be securely removed from the server.`)) return;

    try {
      await disconnectIntegration.mutateAsync(providerId);
      await logActivity.mutateAsync({
        action: 'disconnected_integration',
        resourceType: 'integration',
        details: { platform: providerId },
      });
      setSyncResults((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect provider');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connections"
        title="Integrations"
        description="Connect your personal GitHub and deployment provider accounts to track real infrastructure across all your projects."
        actions={
          <Button variant="secondary" onClick={() => refetchIntegrations()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Connected</p>
          <p className="text-3xl font-bold text-slate-900">{connectedCount}</p>
          <p className="text-xs text-slate-500 mt-2">Active integrations</p>
        </Card>
        <Card className="p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Deployments</p>
          <p className="text-3xl font-bold text-slate-900">{deploymentCount}</p>
          <p className="text-xs text-slate-500 mt-2">Tracked deployments</p>
        </Card>
        <Card className="p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">Repositories</p>
          <p className="text-3xl font-bold text-slate-900">{repositoryCount}</p>
          <p className="text-xs text-slate-500 mt-2">Synced GitHub repos</p>
        </Card>
      </div>

      {error && (
        <Card className="p-4 bg-rose-50 border border-rose-200 text-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
          {error.toLowerCase().includes('switch') || error.toLowerCase().includes('already connected') ? (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <a
                href="https://github.com/logout"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-rose-700 bg-rose-100 hover:bg-rose-200 whitespace-nowrap transition-colors"
              >
                1. Sign out on GitHub.com
              </a>
              <button
                onClick={handleGitHubConnect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 whitespace-nowrap transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                2. Connect GitHub
              </button>
            </div>
          ) : null}
        </Card>
      )}

      {/* Source Control Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Source control</h2>
            <p className="text-sm text-slate-500">GitHub sync and repository metadata from your connected personal account.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {githubConnected ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-700 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-700" />
                GitHub connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-sm text-amber-700 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Not connected
              </span>
            )}
          </div>
        </div>

        <Card className="p-6 border border-slate-200 shadow-sm bg-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-900 text-2xl flex-shrink-0">
                <Github className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">GitHub</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Sync your repositories, watch commit activity, and link repositories to deployment environments.
                </p>
                {githubConnected && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    {githubAccount && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-medium">
                        {githubAvatar && (
                          <img src={githubAvatar} alt={githubAccount} className="w-3.5 h-3.5 rounded-full" />
                        )}
                        @{githubAccount}
                      </span>
                    )}
                    <span className="font-medium text-emerald-700 flex items-center gap-1.5 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {repositoryCount} synced {repositoryCount === 1 ? 'repository' : 'repositories'}
                    </span>
                  </div>
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

      {/* Deployment Platforms Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Deployment platforms</h2>
            <p className="text-sm text-slate-500">
              Deployments are automatically discovered from your connected GitHub repositories without manual API tokens.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Zero-token GitHub discovery & server-isolated storage</span>
          </div>
        </div>

        {integrationsLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((index) => (
              <Card key={index} className="p-6 animate-pulse bg-slate-50 h-48" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {deploymentProviders.map((provider, index) => {
              const integration = getIntegration(provider.id);
              const trackCount = providerDeployments(provider.id);
              const isConnected = (integration?.connected === true) || trackCount > 0;
              const syncInProgress = syncingProvider === provider.id;
              const syncResult = syncResults[provider.id];
              const metadata = (integration?.metadata as Record<string, unknown>) || {};
              const accountName = (metadata.account_name || metadata.username || metadata.name) as string | undefined;

              return (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-900 shadow-sm flex-shrink-0">
                            {provider.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">{provider.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isConnected ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {trackCount > 0 ? 'Discovered' : 'Connected'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                              Not connected
                            </span>
                          )}
                        </div>
                      </div>

                      {isConnected && (
                        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                          {accountName && (
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-2 pb-2 border-b border-slate-200">
                              <span>Account:</span>
                              <span className="font-medium text-slate-800">@{String(accountName)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span>Deployments tracked</span>
                            <span className="font-semibold text-slate-900">{trackCount}</span>
                          </div>
                          {syncResult && (
                            <p className={`mt-2 text-xs ${syncResult.error ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {syncResult.error
                                ? `Sync error: ${syncResult.error}`
                                : `Last sync: ${syncResult.count} deployment${syncResult.count === 1 ? '' : 's'} imported`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                      {isConnected ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSync(provider.id)}
                            isLoading={syncInProgress}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${syncInProgress ? 'animate-spin' : ''}`} />
                            {syncInProgress ? 'Syncing...' : 'Scan Deployments'}
                          </Button>
                          {integration?.connected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnect(provider.id)}
                              className="text-error-600"
                            >
                              <Unlink className="w-4 h-4 mr-2" />
                              Disconnect
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleSync(provider.id)}
                          isLoading={syncInProgress}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${syncInProgress ? 'animate-spin' : ''}`} />
                          Discover from GitHub
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenConnectModal(provider)}
                        className="text-xs text-slate-400 hover:text-slate-700 underline ml-auto"
                      >
                        Direct Token (Optional)
                      </button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Secure Provider Connect Modal */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => {
          if (!connectProviderMutation.isPending) {
            setIsConnectModalOpen(false);
            setTokenInput('');
            setConnectError(null);
          }
        }}
        title={`Connect ${selectedProvider?.name ?? ''}`}
        description={`Provide your ${selectedProvider?.name} ${selectedProvider?.tokenName || 'API token'} to synchronize your deployments.`}
        size="md"
      >
        {selectedProvider && (
          <form onSubmit={handleConnectSubmit} className="space-y-5">
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
              <Lock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Server-Side Security</p>
                <p className="mt-0.5 text-amber-800">
                  Your token is validated directly against {selectedProvider.name} and stored securely server-side with Row-Level Security. DevOS AI never exposes your token to the browser.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
                <span>{selectedProvider.name} {selectedProvider.tokenName}</span>
                <a
                  href={selectedProvider.tokenHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1"
                >
                  Generate token <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <Input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={selectedProvider.tokenPlaceholder}
                autoFocus
                disabled={connectProviderMutation.isPending}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Paste your personal token here. Read-only permissions for deployments/services are recommended.
              </p>
            </div>

            {connectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{connectError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsConnectModalOpen(false)}
                disabled={connectProviderMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={connectProviderMutation.isPending}
                disabled={!tokenInput.trim() || connectProviderMutation.isPending}
              >
                <Key className="w-4 h-4 mr-2" />
                {connectProviderMutation.isPending ? 'Verifying...' : `Verify & Connect ${selectedProvider.name}`}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
