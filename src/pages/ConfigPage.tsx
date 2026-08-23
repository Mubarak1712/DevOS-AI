import { config, fetchProviderConfigStatus, type ProviderConfigStatus } from '@/lib/config';
import { CheckCircle, XCircle, AlertTriangle, Key, Server, Github, Cloud, RefreshCw, Shield } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface CategoryGroup {
  category: string;
  icon: React.ReactNode;
  statusColor: string;
  statuses: { key: string; name: string; configured: boolean; required: boolean; description: string }[];
  isServerSide?: boolean;
}

export function ConfigPage() {
  const [clientStatuses] = useState(config.getClientConfigStatuses());
  const [providerStatuses, setProviderStatuses] = useState<ProviderConfigStatus[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  useEffect(() => {
    const loadProviderStatuses = async () => {
      setLoadingProviders(true);
      try {
        const statuses = await fetchProviderConfigStatus();
        setProviderStatuses(statuses);
      } catch (err) {
        console.error('Failed to load provider statuses:', err);
      }
      setLoadingProviders(false);
    };
    loadProviderStatuses();
  }, []);

  // Group client configs by category
  const clientCategories: CategoryGroup[] = [];
  const clientCategoryMap = new Map<string, typeof clientStatuses>();
  clientStatuses.forEach(status => {
    const existing = clientCategoryMap.get(status.category) || [];
    existing.push(status);
    clientCategoryMap.set(status.category, existing);
  });

  const categoryIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    'Supabase': { icon: <Server className="w-5 h-5" />, color: 'text-emerald-600' },
    'GitHub': { icon: <Github className="w-5 h-5" />, color: 'text-neutral-900' },
  };

  clientCategoryMap.forEach((statuses, category) => {
    const allConfigured = statuses.every(s => s.configured);
    const iconInfo = categoryIcons[category] || { icon: <Key className="w-5 h-5" />, color: 'text-neutral-600' };
    clientCategories.push({
      category,
      icon: iconInfo.icon,
      statusColor: allConfigured ? 'text-success-600' : 'text-warning-600',
      statuses,
    });
  });

  // Provider categories (server-side)
  const providerCategory: CategoryGroup = {
    category: 'Deployment Providers (Server-Side)',
    icon: <Cloud className="w-5 h-5" />,
    statusColor: providerStatuses.some(p => p.configured) ? 'text-success-600' : 'text-neutral-400',
    statuses: providerStatuses.map(p => ({
      key: `${p.provider.toUpperCase()}_TOKEN`,
      name: p.name,
      configured: p.configured,
      required: false,
      description: `API token for ${p.name} (server-side secret)`,
    })),
    isServerSide: true,
  };

  const missingRequired = clientStatuses.filter(s => s.required && !s.configured);
  const configuredClientCount = clientStatuses.filter(s => s.configured).length;
  const configuredProviderCount = providerStatuses.filter(p => p.configured).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Configuration</h1>
          <p className="text-neutral-500 mt-1">
            Environment variables and integration status
          </p>
        </div>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{configuredClientCount}</p>
              <p className="text-sm text-neutral-500">Client Configs</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{configuredProviderCount}</p>
              <p className="text-sm text-neutral-500">Providers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
              <Key className="w-5 h-5 text-neutral-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{clientStatuses.length + providerStatuses.length}</p>
              <p className="text-sm text-neutral-500">Total Keys</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              missingRequired.length > 0 ? 'bg-error-100' : 'bg-success-100'
            }`}>
              {missingRequired.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-error-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-success-600" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{missingRequired.length}</p>
              <p className="text-sm text-neutral-500">Missing Required</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Required Missing Alert */}
      {missingRequired.length > 0 && (
        <Card className="p-4 bg-error-50 border-error-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-error-800">Missing Required Configuration</h3>
              <p className="text-sm text-error-700 mt-1">
                The following required environment variables are not set:
              </p>
              <ul className="mt-2 space-y-1">
                {missingRequired.map(item => (
                  <li key={item.key} className="text-sm text-error-700 font-mono">
                    {item.key}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-error-700 mt-2">
                Please add these variables to your <code className="bg-error-100 px-1 rounded">.env</code> file.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Client-side Configuration */}
      {clientCategories.map(category => (
        <Card key={category.category} className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={category.statusColor}>
              {category.icon}
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">{category.category}</h2>
            <span className={`ml-auto text-sm font-medium ${
              category.statuses.every(s => s.configured) ? 'text-success-600' : 'text-warning-600'
            }`}>
              {category.statuses.filter(s => s.configured).length}/{category.statuses.length} configured
            </span>
          </div>

          <div className="space-y-3">
            {category.statuses.map(status => (
              <div
                key={status.key}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  status.configured ? 'bg-success-50' : status.required ? 'bg-error-50' : 'bg-neutral-50'
                }`}
              >
                {status.configured ? (
                  <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0" />
                ) : (
                  <XCircle className={`w-5 h-5 flex-shrink-0 ${status.required ? 'text-error-600' : 'text-neutral-400'}`} />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-neutral-900">{status.key}</span>
                    {status.required && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-error-100 text-error-700 font-medium">
                        required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 mt-0.5">{status.description}</p>
                </div>
                <span className={`text-sm font-medium ${status.configured ? 'text-success-600' : 'text-neutral-400'}`}>
                  {status.configured ? 'Set' : 'Not Set'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Server-side Provider Configuration */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={providerCategory.statusColor}>
            {providerCategory.icon}
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">{providerCategory.category}</h2>
          <span className={`ml-auto text-sm font-medium ${
            configuredProviderCount > 0 ? 'text-success-600' : 'text-neutral-400'
          }`}>
            {configuredProviderCount}/{providerCategory.statuses.length} configured
          </span>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-primary-50 border border-primary-200">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary-700">
              These secrets are stored securely on the server and never exposed to the client.
              Configuration status is verified via secure Edge Function calls.
            </p>
          </div>
        </div>

        {loadingProviders ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {providerCategory.statuses.map(status => (
              <div
                key={status.key}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  status.configured ? 'bg-success-50' : 'bg-neutral-50'
                }`}
              >
                {status.configured ? (
                  <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-neutral-900">{status.key}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600 font-medium">
                      server-side
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-0.5">{status.description}</p>
                </div>
                <span className={`text-sm font-medium ${status.configured ? 'text-success-600' : 'text-neutral-400'}`}>
                  {status.configured ? 'Configured' : 'Not Set'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/integrations">
            <Button variant="secondary">
              Manage Integrations
            </Button>
          </Link>
          <Link to="/deployments">
            <Button variant="secondary">
              View Deployments
            </Button>
          </Link>
          <Link to="/github">
            <Button variant="secondary">
              Connect GitHub
            </Button>
          </Link>
        </div>
      </Card>

      {/* Environment Setup Guide */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Environment Setup Guide</h2>
        <div className="prose prose-sm text-neutral-600">
          <p>
            To configure your environment variables, create a <code>.env</code> file in the project root:
          </p>
          <pre className="bg-neutral-100 p-3 rounded-lg text-xs overflow-x-auto mt-3">
{`# Required - Client-side (VITE_ prefix)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional - GitHub OAuth (client-side)
VITE_GITHUB_CLIENT_ID=your_github_client_id

# Server-side secrets (configured in Supabase Edge Functions)
GITHUB_CLIENT_SECRET=your_github_client_secret
GROQ_API_KEY=your_groq_api_key

# Note: Deployment provider tokens (Vercel, Netlify, Render, Railway)
# are connected individually by each user under the Integrations tab.`}
          </pre>
          <p className="mt-3">
            <strong>Note:</strong> Variables prefixed with <code>VITE_</code> are exposed to the browser.
            Global secrets without this prefix are only accessible server-side via Edge Functions, while deployment provider credentials are securely managed per authenticated user.
          </p>
        </div>
      </Card>
    </div>
  );
}
