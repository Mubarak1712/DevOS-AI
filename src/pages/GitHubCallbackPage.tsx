import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Github, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui';
import { githubService } from '@/services/github';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

type OAuthStatus = 'processing' | 'success' | 'error';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unexpected error while connecting GitHub.';
}

export function GitHubCallbackPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<OAuthStatus>('processing');
  const [message, setMessage] = useState('Initializing OAuth...');
  const [started, setStarted] = useState(false);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (started || hasStartedRef.current || loading) return;
    hasStartedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setMessage(errorDescription || errorParam);
      setStarted(true);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing OAuth parameters. Please try connecting again.');
      setStarted(true);
      return;
    }

    if (!config.github.redirectUri) {
      setStatus('error');
      setMessage('Missing GitHub redirect URI configuration.');
      setStarted(true);
      return;
    }

    setStarted(true);
    setMessage('Checking authentication session...');

    const processCallback = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        const currentUser = sessionData.session?.user ?? user;
        if (!currentUser) {
          setStatus('error');
          setMessage('Please sign in before connecting GitHub.');
          return;
        }

        setMessage('Exchanging GitHub authorization code...');
        const oauthResult = await githubService.handleCallback(code, state);

        if (!oauthResult?.access_token) {
          throw new Error('GitHub access token was not returned.');
        }

        const accessToken = oauthResult.access_token;
        const githubUser = oauthResult.user ?? null;

        if (!githubUser?.id) {
          throw new Error('GitHub user profile was not returned.');
        }

        setMessage('Saving GitHub profile...');
        const { error: userError } = await supabase
          .from('users')
          .upsert(
            {
              id: currentUser.id,
              email: githubUser.email || currentUser.email || '',
              name: githubUser.name || githubUser.login || currentUser.user_metadata?.full_name || currentUser.email || '',
              avatar_url: githubUser.avatar_url || currentUser.user_metadata?.avatar_url || null,
            },
            { onConflict: 'id' }
          );

        if (userError) {
          throw userError;
        }

        setMessage('Fetching your GitHub repositories...');
        const repositories = await githubService.fetchRepositories(accessToken);

        setMessage('Syncing repositories to your account...');
        const repositoryRows = repositories.map((repo) => ({
          user_id: currentUser.id,
          github_id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          html_url: repo.html_url,
          owner_login: repo.owner?.login ?? null,
          visibility: repo.visibility ?? (repo.private ? 'private' : 'public'),
          default_branch: repo.default_branch ?? null,
          stars: repo.stargazers_count ?? 0,
          forks: repo.forks_count ?? 0,
          open_issues: repo.open_issues_count ?? 0,
          language: repo.language ?? null,
          topics: repo.topics ?? [],
          is_private: repo.private ?? false,
          is_fork: repo.fork ?? false,
          last_commit_at: repo.pushed_at ?? null,
          last_activity_at: repo.updated_at ?? null,
          has_readme: false,
          has_license: false,
        }));

        const { error: repositoryError } = await supabase
          .from('repositories')
          .upsert(repositoryRows, { onConflict: 'github_id' });

        if (repositoryError) {
          throw repositoryError;
        }

        const { error: integrationError } = await supabase
          .from('integrations')
          .upsert(
            [
              {
                user_id: currentUser.id,
                platform: 'github',
                name: 'GitHub',
                connected: true,
                connected_at: new Date().toISOString(),
                metadata: {
                  login: githubUser.login,
                  avatar_url: githubUser.avatar_url,
                  github_id: githubUser.id,
                },
              },
            ],
            { onConflict: 'user_id,platform' }
          );

        if (integrationError) {
          throw integrationError;
        }

        await queryClient.invalidateQueries({ queryKey: ['repositories'] });
        await queryClient.invalidateQueries({ queryKey: ['integrations'] });

        setStatus('success');
        setMessage(`Connected to GitHub as ${githubUser.login || 'your account'}.`);

        window.setTimeout(() => {
          navigate('/github');
        }, 800);
      } catch (error) {
        console.error('GitHub OAuth callback failed', error);
        setStatus('error');
        setMessage(getErrorMessage(error));
      }
    };

    void processCallback();
  }, [loading, navigate, queryClient, searchParams, started, user]);

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto mb-6">
            <Github className="w-8 h-8 text-white" />
          </div>

          {status === 'processing' && (
            <>
              <Loader2 className="w-8 h-8 text-violet-600 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Connecting GitHub</h2>
              <p className="text-surface-500 text-sm">{message}</p>
              <div className="mt-6 w-full bg-surface-100 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-purple-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-success-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success-600" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">GitHub Connected!</h2>
              <p className="text-surface-500 text-sm">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-error-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-error-600" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Connection Failed</h2>
              <p className="text-error-600 text-sm mb-4">{message}</p>
              <button
                onClick={() => navigate('/github')}
                className="text-violet-600 hover:underline text-sm font-medium"
              >
                Return to GitHub page
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
