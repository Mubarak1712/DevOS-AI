import { config, fetchProviderConfigStatus, type ProviderConfigStatus } from '@/lib/config';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Key,
  Server,
  Github,
  Cloud,
  RefreshCw,
  Shield,
  Activity,
  Sparkles,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function ConfigPage() {
  const [clientStatuses] = useState(config.getClientConfigStatuses());
  const [serverStatuses, setServerStatuses] = useState<ProviderConfigStatus[]>([]);
  const [loadingServerStatus, setLoadingServerStatus] = useState(true);

  // Latency & connectivity test states
  const [testingConnection, setTestingConnection] = useState(false);
  const [dbResult, setDbResult] = useState<{ ok: boolean; latencyMs?: number; message?: string } | null>(null);
  const [edgeResult, setEdgeResult] = useState<{ ok: boolean; latencyMs?: number; message?: string } | null>(null);

  const loadServerConfig = async () => {
    setLoadingServerStatus(true);
    try {
      const statuses = await fetchProviderConfigStatus();
      setServerStatuses(statuses);
    } catch (err) {
      console.error('Failed to load server configuration status:', err);
    } finally {
      setLoadingServerStatus(false);
    }
  };

  useEffect(() => {
    loadServerConfig();
  }, []);

  const handleRunDiagnostics = async () => {
    setTestingConnection(true);

    // 1. Test Supabase Database REST API
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from('settings').select('count', { count: 'exact', head: true });
      const latency = Date.now() - dbStart;
      if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
        setDbResult({ ok: false, message: error.message });
      } else {
        setDbResult({ ok: true, latencyMs: latency });
      }
    } catch (err) {
      setDbResult({ ok: false, message: err instanceof Error ? err.message : 'Database connection failed' });
    }

    // 2. Test Supabase Edge Functions
    const edgeStart = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('check-provider-config');
      const edgeLatency = Date.now() - edgeStart;
      if (error) {
        setEdgeResult({ ok: false, message: error.message });
      } else {
        setEdgeResult({ ok: true, latencyMs: edgeLatency });
        if (data?.providers) {
          setServerStatuses(data.providers);
        }
      }
    } catch (err) {
      setEdgeResult({ ok: false, message: err instanceof Error ? err.message : 'Edge function call failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const missingRequiredClient = clientStatuses.filter(s => s.required && !s.configured);
  const configuredClientCount = clientStatuses.filter(s => s.configured).length;
  const configuredServerCount = serverStatuses.filter(s => s.configured).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        eyebrow="Diagnostics & Infrastructure"
        title="System & Environment Configuration"
        description="Inspect client environment variables, server-side Edge Function secrets, zero-token deployment discovery status, and real-time network latency."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunDiagnostics}
              isLoading={testingConnection}
            >
              <Activity className="w-4 h-4 mr-1.5 text-cyan-600" />
              Run Connectivity Diagnostics
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                loadServerConfig();
                handleRunDiagnostics();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Diagnostics Results Banners */}
      {(dbResult || edgeResult) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {dbResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                dbResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {dbResult.ok ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <div>
                  <span className="font-semibold">Supabase REST API: </span>
                  {dbResult.ok
                    ? `Healthy (${dbResult.latencyMs}ms latency)`
                    : `Error: ${dbResult.message}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDbResult(null)}
                className="text-xs font-bold opacity-60 hover:opacity-100 px-1"
              >
                ×
              </button>
            </div>
          )}

          {edgeResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                edgeResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {edgeResult.ok ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <div>
                  <span className="font-semibold">Edge Functions Gateway: </span>
                  {edgeResult.ok
                    ? `Reachable (${edgeResult.latencyMs}ms latency)`
                    : `Error: ${edgeResult.message}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEdgeResult(null)}
                className="text-xs font-bold opacity-60 hover:opacity-100 px-1"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Server className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {configuredClientCount}/{clientStatuses.length}
              </p>
              <p className="text-xs text-neutral-500">Client Env Vars</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {loadingServerStatus ? '...' : `${configuredServerCount}/${serverStatuses.length}`}
              </p>
              <p className="text-xs text-neutral-500">Server Secrets</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-base font-bold text-neutral-900">Zero-Token</p>
              <p className="text-xs text-neutral-500">Deployment Engine</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                missingRequiredClient.length > 0 ? 'bg-rose-100' : 'bg-emerald-100'
              }`}
            >
              {missingRequiredClient.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">
                {missingRequiredClient.length === 0 ? 'Optimal' : `${missingRequiredClient.length} Missing`}
              </p>
              <p className="text-xs text-neutral-500">System Readiness</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Missing Client Env Alert */}
      {missingRequiredClient.length > 0 && (
        <Card className="p-4 bg-rose-50 border-rose-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-rose-900">Missing Required Client Variables</h3>
              <p className="text-sm text-rose-700 mt-1">
                The application requires the following environment variables in your <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">.env</code> file:
              </p>
              <ul className="mt-2 space-y-1">
                {missingRequiredClient.map(item => (
                  <li key={item.key} className="text-sm text-rose-800 font-mono">
                    • {item.key} — {item.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Client-Side Environment Bindings */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-neutral-900">Client-Side Environment Variables</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-neutral-100 text-neutral-700">
            Vite Bundle (Public to Browser)
          </span>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Variables prefixed with <code className="font-mono bg-neutral-100 px-1 py-0.5 rounded">VITE_</code> are embedded into the client code at build time. They contain public endpoints and OAuth client identifiers.
        </p>

        <div className="space-y-3">
          {clientStatuses.map(status => (
            <div
              key={status.key}
              className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                status.configured
                  ? 'bg-white border-neutral-200'
                  : status.required
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              {status.configured ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    status.required ? 'text-rose-600' : 'text-neutral-400'
                  }`}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-neutral-900">{status.key}</span>
                  {status.required ? (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                      Required
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                      Optional
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-400 font-mono">[{status.category}]</span>
                </div>
                <p className="text-xs text-neutral-600 mt-0.5">{status.description}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded ${
                  status.configured
                    ? 'bg-emerald-100 text-emerald-800'
                    : status.required
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {status.configured ? 'Configured' : 'Missing'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Server-Side Edge Function Secrets */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-neutral-900">Server-Side Edge Function Secrets</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            Secure Vault (Server Only)
          </span>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-900 leading-relaxed">
              These credentials are never bundled into the client application. They are securely injected into Supabase Edge Functions (<code className="font-mono bg-indigo-100 px-1 rounded">ai-generate</code>, <code className="font-mono bg-indigo-100 px-1 rounded">github-oauth</code>, <code className="font-mono bg-indigo-100 px-1 rounded">sync-repositories</code>). Status is inspected via secure backend introspection.
            </p>
          </div>
        </div>

        {loadingServerStatus ? (
          <div className="flex items-center justify-center py-8 text-neutral-500 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Querying backend secrets status...
          </div>
        ) : (
          <div className="space-y-3">
            {serverStatuses.map(status => (
              <div
                key={status.key || status.provider}
                className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                  status.configured ? 'bg-white border-neutral-200' : 'bg-neutral-50/60 border-neutral-200'
                }`}
              >
                {status.configured ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-neutral-900">
                      {status.key || status.name}
                    </span>
                    <span className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                      {status.category || 'Backend Secret'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-0.5">{status.description || status.name}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    status.configured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {status.configured ? 'Configured' : 'Not Set'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Zero-Token Deployment Architecture */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyan-600" />
            <h2 className="text-lg font-semibold text-neutral-900">Zero-Token Deployment Engine</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
            Zero-Token Discovery Active
          </span>
        </div>

        <p className="text-xs text-neutral-600 leading-relaxed mb-4">
          DevOS-AI eliminates the need to configure personal API tokens (<code className="font-mono text-neutral-800">VERCEL_TOKEN</code>, <code className="font-mono text-neutral-800">NETLIFY_TOKEN</code>, <code className="font-mono text-neutral-800">RENDER_API_KEY</code>, <code className="font-mono text-neutral-800">RAILWAY_TOKEN</code>). Instead, live deployments are detected automatically through:
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <p className="text-xs font-semibold text-neutral-900 mb-1">1. Commit Status Signals</p>
            <p className="text-[11px] text-neutral-500">
              Inspects GitHub deployment statuses and commit checks reported directly by CI/CD providers.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <p className="text-xs font-semibold text-neutral-900 mb-1">2. Environment Metadata</p>
            <p className="text-[11px] text-neutral-500">
              Parses GitHub Deployments API for active target URLs and production environment deployments.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <p className="text-xs font-semibold text-neutral-900 mb-1">3. Live HTTP & DNS Verification</p>
            <p className="text-[11px] text-neutral-500">
              Scans known hosting domains, CNAME entries, and response headers without requiring API credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-500 font-medium">Auto-Discovered Platforms:</span>
          {['Vercel', 'Netlify', 'Render', 'Railway', 'GitHub Pages'].map(platform => (
            <span
              key={platform}
              className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 font-medium"
            >
              {platform}
            </span>
          ))}
        </div>
      </Card>

      {/* Quick Navigation to Operational Workspaces */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-2">Connected Workspaces & Features</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Jump directly to dedicated feature workspaces rather than configuring settings here:
        </p>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/ai-studio"
            className="p-3.5 rounded-xl border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/30 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Sparkles className="w-4 h-4 text-primary-600" />
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-primary-600 transition-colors" />
              </div>
              <p className="text-xs font-semibold text-neutral-900">AI Studio</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Explore ideas, roadmaps & architecture specs</p>
            </div>
          </Link>

          <Link
            to="/github"
            className="p-3.5 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Github className="w-4 h-4 text-neutral-800" />
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-800 transition-colors" />
              </div>
              <p className="text-xs font-semibold text-neutral-900">GitHub Repositories</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Sync repos, commits, and pull requests</p>
            </div>
          </Link>

          <Link
            to="/deployments"
            className="p-3.5 rounded-xl border border-neutral-200 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Cloud className="w-4 h-4 text-cyan-600" />
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-cyan-600 transition-colors" />
              </div>
              <p className="text-xs font-semibold text-neutral-900">Deployments</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">View live URLs & scan deployment health</p>
            </div>
          </Link>

          <Link
            to="/integrations"
            className="p-3.5 rounded-xl border border-neutral-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <p className="text-xs font-semibold text-neutral-900">Integrations</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Manage OAuth connections & webhooks</p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}
