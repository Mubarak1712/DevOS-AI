import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Github, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui';
import { githubService } from '@/services/github';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

        setMessage('Exchanging authorization code and connecting account...');
        const oauthResult = await githubService.handleCallback(code, state);

        const githubUser = oauthResult.user ?? null;
        const syncedCount = oauthResult.synced_count ?? 0;

        await queryClient.invalidateQueries({ queryKey: ['repositories'] });
        await queryClient.invalidateQueries({ queryKey: ['integrations'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

        setStatus('success');
        setMessage(
          `Connected to GitHub as @${githubUser?.login || 'developer'}. Initial sync imported ${syncedCount} repositories.`
        );

        window.setTimeout(() => {
          navigate('/github');
        }, 1000);
      } catch (error) {
        console.error('GitHub OAuth callback failed:', error);
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
