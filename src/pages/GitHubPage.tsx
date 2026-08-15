import { useMemo, useState } from 'react';
import { Github, RefreshCw, AlertTriangle, CheckCircle, XCircle, ExternalLink, Unlink, Clipboard, Search } from 'lucide-react';
import { Button, Card, EmptyState, Input, Select } from '@/components/ui';
import { useRepositories, useIntegrations, useDisconnectIntegration, useSyncRepositories, useQueryInitialLoading } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLogActivity } from '@/hooks/api';
import { githubService } from '@/services/github';
import { config } from '@/lib/config';

export function GitHubPage() {
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'stars' | 'activity' | 'name'>('recent');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const {
    data: repositories = [],
    isPending: reposPending,
    fetchStatus: reposFetchStatus,
  } = useRepositories();
  const { data: integrations = [], isPending: integrationsPending, fetchStatus: integrationsFetchStatus } = useIntegrations();
  const syncRepositoriesMutation = useSyncRepositories();
  const disconnectIntegration = useDisconnectIntegration();
  const logActivity = useLogActivity();

  const reposLoading = useQueryInitialLoading(authLoading, reposPending, reposFetchStatus);
  const integrationsLoading = useQueryInitialLoading(authLoading, integrationsPending, integrationsFetchStatus);
  const pageLoading = reposLoading || integrationsLoading;

  const handleConnect = () => {
    try {
      setError(null);
      setSyncSuccessMessage(null);
      githubService.initiateOAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate GitHub connection');
    }
  };

  const handleSync = async () => {
    try {
      setError(null);
      setSyncSuccessMessage(null);
      const result = await syncRepositoriesMutation.mutateAsync();
      setSyncSuccessMessage(`Successfully synchronized ${result.count} repositories with GitHub.`);
      setTimeout(() => setSyncSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync repositories from GitHub');
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      setError(null);
      setSyncSuccessMessage(null);
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

  const githubIntegration = integrations.find((i) => i.platform === 'github');
  const isConnected = githubIntegration?.connected === true || repositories.length > 0;

  const activeRepos = repositories.filter((repo) => {
    if (!repo.last_commit_at) return false;
    const lastCommit = new Date(repo.last_commit_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return lastCommit > weekAgo;
  }).length;

  const staleRepos = repositories.filter((repo) => {
    if (!repo.last_commit_at) return true;
    const lastCommit = new Date(repo.last_commit_at);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return lastCommit < monthAgo;
  }).length;

  const languages = useMemo(
    () => Array.from(new Set(repositories.map((repo) => repo.language).filter(Boolean) as string[])).sort(),
    [repositories]
  );

  const visibilities = useMemo(
    () => Array.from(new Set(repositories.map((repo) => repo.visibility).filter(Boolean) as string[])).sort(),
    [repositories]
  );

  const filteredRepositories = useMemo(() => {
    return repositories
      .filter((repo) => {
        const matchesSearch = [repo.name, repo.full_name, repo.description || '', repo.topics?.join(' ') || '']
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesLanguage = !languageFilter || repo.language === languageFilter;
        const matchesVisibility = !visibilityFilter || repo.visibility === visibilityFilter;
        return matchesSearch && matchesLanguage && matchesVisibility;
      })
      .sort((a, b) => {
        if (sortBy === 'stars') return b.stars - a.stars;
        if (sortBy === 'activity') {
          const aDate = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          const bDate = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          return bDate - aDate;
        }
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        const aUpdated = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bUpdated = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return bUpdated - aUpdated;
      });
  }, [repositories, search, languageFilter, visibilityFilter, sortBy]);

  const getRepositorySummary = (repo: (typeof repositories)[number]) => {
    if (repo.description) return repo.description;
    const topics = repo.topics?.slice(0, 3).join(', ');
    if (topics) return `Repository focused on ${topics}.`;
    return `${repo.full_name} is a GitHub project with ${repo.stars} stars and ${repo.forks} forks.`;
  };

  const copyRepositoryUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Repository URL copied');
      setTimeout(() => setCopyMessage(null), 1800);
    } catch {
      setCopyMessage('Failed to copy URL');
      setTimeout(() => setCopyMessage(null), 1800);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-[#D9C5FF] bg-[#FCEEF8] p-6 shadow-[0_20px_60px_rgba(124,58,237,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5E4F7C]">GitHub</p>
            <h1 className="mt-2 text-3xl font-bold text-[#1F1145]">Repository explorer</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#5E4F7C]">A cleaner, developer-focused list of your connected GitHub repositories.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isConnected ? (
              <Button onClick={handleConnect} className="whitespace-nowrap">
                <Github className="w-4 h-4 mr-2" />
                Connect GitHub
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={handleSync}
                  disabled={syncRepositoriesMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncRepositoriesMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncRepositoriesMutation.isPending ? 'Syncing...' : 'Sync Repositories'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDisconnect}
                  disabled={disconnectIntegration.isPending}
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {syncSuccessMessage && (
        <Card className="p-4 border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium">{syncSuccessMessage}</p>
        </Card>
      )}

      {error && (
        <Card className="p-4 border-rose-200 bg-rose-50 text-rose-700 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </Card>
      )}

      {!config.isGitHubClientConfigured && (
        <Card className="p-6 border border-orange-200 bg-orange-50 text-slate-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-slate-900">GitHub OAuth Not Configured</h3>
              <p className="text-sm text-slate-700 mt-1">
                Add <code className="bg-slate-100 px-1 rounded text-slate-700">VITE_GITHUB_CLIENT_ID</code> to your environment variables.
              </p>
              <p className="text-sm text-slate-700 mt-2">
                See <a href="/config" className="underline decoration-slate-400 text-slate-900">Configuration</a> for setup details.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!isConnected ? (
        <Card className="p-8 border border-slate-200 text-slate-900 shadow-sm">
          <EmptyState
            icon={<Github className="w-8 h-8 text-slate-700" />}
            title="No repositories connected"
            description="Connect GitHub to sync your repository workspace and start monitoring activity."
            actionLabel={config.isGitHubClientConfigured ? 'Connect GitHub' : undefined}
            onAction={config.isGitHubClientConfigured ? handleConnect : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6 border border-[#D9C5FF] bg-[#F6F1FF] text-[#1F1145] shadow-[0_18px_48px_rgba(124,58,237,0.08)] rounded-[32px]">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] bg-[#E8F4FF] p-5 shadow-sm border border-[#D1E6FF]">
                <p className="text-sm font-semibold text-[#5E4F7C]">Total repositories</p>
                <p className="mt-3 text-3xl font-bold text-[#1F1145]">{repositories.length}</p>
              </div>
              <div className="rounded-[24px] bg-[#FFF7D6] p-5 shadow-sm border border-[#F6E7A9]">
                <p className="text-sm font-semibold text-[#7B5A00]">Active last 7 days</p>
                <p className="mt-3 text-3xl font-bold text-[#1F1145]">{activeRepos}</p>
              </div>
              <div className="rounded-[24px] bg-[#E8FFF3] p-5 shadow-sm border border-[#BEEAD0]">
                <p className="text-sm font-semibold text-[#065F46]">Stale repos</p>
                <p className="mt-3 text-3xl font-bold text-[#1F1145]">{staleRepos}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-[#D9C5FF] bg-[#EEE6FF] text-[#1F1145] shadow-[0_18px_48px_rgba(124,58,237,0.08)] rounded-[32px]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#1F1145]">Repository list</h2>
                  <p className="text-sm text-[#5E4F7C]">Browse connected repositories with quick actions and activity context.</p>
                </div>
                <div className="text-sm text-[#5E4F7C]">
                  {filteredRepositories.length} repositories · sorted by {sortBy === 'recent' ? 'recent activity' : sortBy === 'stars' ? 'stars' : sortBy === 'name' ? 'name' : 'activity'}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative min-h-[72px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A99CC2]" />
                  <Input
                    placeholder="Search repositories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10"
                  />
                </div>
                <div className="min-h-[72px]">
                  <Select
                    label="Language"
                    value={languageFilter}
                    onChange={(e) => setLanguageFilter(e.target.value)}
                    className="w-full"
                    options={[
                      { value: '', label: 'All languages' },
                      ...languages.map((language) => ({ value: language, label: language })),
                    ]}
                  />
                </div>
                <div className="min-h-[72px]">
                  <Select
                    label="Visibility"
                    value={visibilityFilter}
                    onChange={(e) => setVisibilityFilter(e.target.value)}
                    className="w-full"
                    options={[
                      { value: '', label: 'All visibility' },
                      ...visibilities.map((visibility) => ({ value: visibility, label: visibility })),
                    ]}
                  />
                </div>
                <div className="min-h-[72px]">
                  <Select
                    label="Sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="w-full"
                    options={[
                      { value: 'recent', label: 'Recent activity' },
                      { value: 'stars', label: 'Top starred' },
                      { value: 'activity', label: 'Most active' },
                      { value: 'name', label: 'A → Z' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {pageLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-100 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRepositories.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No repositories match your criteria. Adjust filters or sync to refresh.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRepositories.map((repo) => {
                  const lastCommit = repo.last_commit_at ? new Date(repo.last_commit_at) : null;
                  const lastActivity = repo.last_activity_at ? new Date(repo.last_activity_at) : null;
                  const statusLabel = lastCommit
                    ? lastCommit > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ? 'Active'
                      : lastCommit > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                      ? 'Moderate'
                      : 'Inactive'
                    : 'Unknown';

                  return (
                    <Card key={repo.id} className="p-5 border border-[#D9C5FF] bg-white shadow-[0_15px_40px_rgba(84,57,183,0.08)] rounded-[28px]">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-start gap-4 min-w-0">
                              <div className="w-14 h-14 rounded-3xl bg-[#EEF1FF] flex items-center justify-center text-[#4C4B6F] shadow-sm">
                                <Github className="w-6 h-6" />
                              </div>
                              <div className="min-w-0">
                                <a
                                  href={repo.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-lg font-semibold text-[#1F1145] hover:text-[#7A57FF] hover:underline truncate"
                                >
                                  {repo.full_name}
                                </a>
                                <p className="mt-2 text-sm text-[#5E4F7C]">{repo.description || getRepositorySummary(repo)}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-[#5E4F7C]">
                              <span className="rounded-full bg-[#F2EEFF] px-3 py-1.5 text-[#3C2976]">{statusLabel}</span>
                              {repo.language && <span className="rounded-full bg-[#F2EEFF] px-3 py-1.5 text-[#3C2976]">{repo.language}</span>}
                              {repo.default_branch && <span className="rounded-full bg-[#F2EEFF] px-3 py-1.5 text-[#3C2976]">{repo.default_branch}</span>}
                              <span className="rounded-full bg-[#F2EEFF] px-3 py-1.5 text-[#3C2976]">{repo.stars}★</span>
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 text-sm text-[#5E4F7C]">
                            <div>
                              <p className="font-semibold text-[#1F1145]">Owner</p>
                              <p>{repo.owner_login || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[#1F1145]">Last Commit</p>
                              <p>{lastCommit ? lastCommit.toLocaleDateString() : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[#1F1145]">Last Activity</p>
                              <p>{lastActivity ? lastActivity.toLocaleDateString() : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[#1F1145]">Topics</p>
                              <p>{repo.topics?.slice(0, 3).join(', ') || 'None'}</p>
                            </div>
                          </div>

                          {repo.topics && repo.topics.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {repo.topics.slice(0, 6).map((topic: string) => (
                                <span key={topic} className="text-xs rounded-full bg-[#F3F0FF] px-2.5 py-1 text-[#5E4F7C]">{topic}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="min-w-[220px] space-y-4">
                          <div className="rounded-[24px] border border-[#E5D5FF] bg-[#E8F4FF] p-4 text-sm text-[#2F1F5E] shadow-sm">
                            <div className="font-semibold mb-2">Repository summary</div>
                            <p>{getRepositorySummary(repo)}</p>
                          </div>
                          <div className="flex gap-3 flex-col sm:flex-row">
                            <Button variant="secondary" onClick={() => copyRepositoryUrl(repo.html_url)} className="flex-1">
                              <Clipboard className="w-4 h-4 mr-2" />
                              Copy URL
                            </Button>
                            <a
                              href={repo.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex flex-1 items-center justify-center rounded-[24px] border border-[#D9C5FF] bg-white px-4 py-3 text-sm font-semibold text-[#321F73] shadow-sm transition hover:bg-[#F6F1FF]"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Open
                            </a>
                          </div>
                          {copyMessage && <div className="text-sm text-[#065F46]">{copyMessage}</div>}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-6 border border-slate-200 text-slate-900 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Repository health indicators</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Active</p>
                  <p className="text-sm text-slate-500">Commit within 7 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Moderate</p>
                  <p className="text-sm text-slate-500">Commit 7–30 days ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Inactive</p>
                  <p className="text-sm text-slate-500">No commits in 30+ days</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
