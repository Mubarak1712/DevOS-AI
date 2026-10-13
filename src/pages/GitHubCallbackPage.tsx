import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Github, Loader2, CheckCircle, XCircle, ExternalLink, AlertTriangle, LogOut } from 'lucide-react';
import { Card } from '@/components/ui';
import { githubService } from '@/services/github';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type OAuthStatus = 'processing' | 'success' | 'error';

interface CallbackErrorDetails {
  isCollision: boolean;
  isAccountMismatch: boolean;
  existingOwnerEmail?: string;
  authorizedGithubLogin?: string;
}

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
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<OAuthStatus>('processing');
  const [message, setMessage] = useState('Initializing OAuth...');
  const [githubLogin, setGithubLogin] = useState('');
  const [errorDetails, setErrorDetails] = useState<CallbackErrorDetails | null>(null);
  const [started, setStarted] = useState(false);
  const hasStartedRef = useRef(false);

  const handleConnectIntended = async () => {
    try {
      await githubService.initiateOAuth(githubLogin.trim() || undefined);
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  };

  const handleSwitchDevOSAccount = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Failed to sign out:', err);
      navigate('/login');
    }
  };

  useEffect(() => {
    if (started || hasStartedRef.current || loading) return;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      hasStartedRef.current = true;
      setStatus('error');
      setMessage(errorDescription || errorParam);
      setStarted(true);
      return;
    }

    if (!code || !state) {
      hasStartedRef.current = true;
      setStatus('error');
      setMessage('Missing OAuth parameters. Please try connecting again.');
      setStarted(true);
      return;
    }

    // Single-use code check to prevent duplicate callback replays
    const alreadyProcessed = sessionStorage.getItem(`github_oauth_code_processed_${code}`);
    if (alreadyProcessed) {
      console.log('[DevOS GitHub OAuth Diagnostic: Callback Replay Prevented]', {
        codePrefix: code.slice(0, 4) + '...',
      });
      return;
    }

    hasStartedRef.current = true;
    sessionStorage.setItem(`github_oauth_code_processed_${code}`, 'true');
    // Clear URL parameters immediately so refresh never re-executes stale code
    window.history.replaceState({}, document.title, window.location.pathname);

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

        // Validate state user binding before invoking code exchange
        let attemptId = 'unknown_attempt';
        if (state.startsWith('devos_')) {
          try {
            const rawB64 = state.slice(6);
            const padded = rawB64.padEnd(rawB64.length + (4 - (rawB64.length % 4)) % 4, '=');
            const parsed = JSON.parse(atob(padded)) as { attemptId?: string; userId?: string; timestamp?: number };
            attemptId = parsed.attemptId || attemptId;

            console.log('[DevOS GitHub OAuth Diagnostic: Callback Start]', {
              correlationId: attemptId,
              step1_currentSupabaseUserId: currentUser.id,
              step2_currentDevOSEmail: currentUser.email ? `${currentUser.email.split('@')[0]}@...` : null,
              step3_oauthAttemptId: attemptId,
              step4_stateValidation: parsed.userId === currentUser.id ? 'VALID_MATCH' : 'MISMATCH',
              codePrefix: code.slice(0, 4) + '...',
            });

            if (parsed.userId && parsed.userId !== currentUser.id) {
              setStatus('error');
              setMessage('OAuth security error: This GitHub authorization was initiated by a different user session. Please connect while logged in as the intended user.');
              return;
            }
          } catch {
            // Handled in githubService.handleCallback
          }
        }

        setMessage('Exchanging authorization code and connecting account...');
        const oauthResult = await githubService.handleCallback(code, state);

        const githubUser = oauthResult.user ?? null;
        const syncedCount = oauthResult.synced_count ?? 0;

        // Invalidate both general and user-scoped query caches
        await queryClient.invalidateQueries({ queryKey: ['repositories'] });
        await queryClient.invalidateQueries({ queryKey: ['repositories', currentUser.id] });
        await queryClient.invalidateQueries({ queryKey: ['integrations'] });
        await queryClient.invalidateQueries({ queryKey: ['integrations', currentUser.id] });
        await queryClient.invalidateQueries({ queryKey: ['deployments'] });
        await queryClient.invalidateQueries({ queryKey: ['deployments', currentUser.id] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        await queryClient.invalidateQueries({ queryKey: ['activity'] });

        setStatus('success');
        setMessage(
          `Connected to GitHub as @${githubUser?.login || 'developer'}. Initial sync imported ${syncedCount} repositories.`
        );

        window.setTimeout(() => {
          navigate('/github');
        }, 1000);
      } catch (error: unknown) {
        console.error('GitHub OAuth callback failed:', error);
        const errorMsg = getErrorMessage(error);
        setStatus('error');
        setMessage(errorMsg);

        const customErr = error as {
          conflict?: boolean;
          accountMismatch?: boolean;
          existingOwnerEmail?: string;
          authorizedGithubLogin?: string;
        };

        const isCollision =
          Boolean(customErr?.conflict) ||
          errorMsg.toLowerCase().includes('already connected') ||
          errorMsg.toLowerCase().includes('another devos');

        const isAccountMismatch =
          Boolean(customErr?.accountMismatch) ||
          errorMsg.toLowerCase().includes('does not match the requested account');

        let existingOwnerEmail = customErr?.existingOwnerEmail;
        if (!existingOwnerEmail) {
          const emailMatch = errorMsg.match(/\(([^)]+@[^)]+)\)/);
          if (emailMatch) existingOwnerEmail = emailMatch[1];
        }

        let authorizedGithubLogin = customErr?.authorizedGithubLogin;
        if (!authorizedGithubLogin) {
          const ghMatch = errorMsg.match(/@([a-zA-Z0-9_-]+)/);
          if (ghMatch) authorizedGithubLogin = ghMatch[1];
        }

        setErrorDetails({
          isCollision,
          isAccountMismatch,
          existingOwnerEmail,
          authorizedGithubLogin,
        });
      }
    };

    void processCallback();
  }, [loading, navigate, queryClient, searchParams, started, user]);

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8">
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

          {status === 'error' && (() => {
            const isCollision =
              errorDetails?.isCollision ||
              message.toLowerCase().includes('already connected') ||
              message.toLowerCase().includes('another devos');
            const isAccountMismatch =
              errorDetails?.isAccountMismatch ||
              message.toLowerCase().includes('does not match the requested account');

            const ownerEmail = errorDetails?.existingOwnerEmail;
            const targetLogin = errorDetails?.authorizedGithubLogin;

            return (
              <>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isCollision ? 'bg-amber-100' : 'bg-rose-100'}`}>
                  {isCollision ? (
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-600" />
                  )}
                </div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                  {isCollision
                    ? 'GitHub Account Collision Detected'
                    : isAccountMismatch
                    ? 'Choose Intended GitHub Account'
                    : 'Connection Failed'}
                </h2>

                {/* Error diagnostics banner */}
                <div className="text-rose-700 text-sm mb-4 bg-rose-50 border border-rose-200 p-3.5 rounded-xl leading-relaxed text-left">
                  <p className="font-semibold text-rose-800 mb-1">
                    {isCollision
                      ? 'Account Already Paired with DevOS'
                      : isAccountMismatch
                      ? 'Authorized GitHub account did not match'
                      : 'Authorization Error'}
                  </p>
                  <p className="text-rose-700 text-xs">{message}</p>
                  {user?.email && (
                    <p className="text-neutral-600 text-xs mt-2 pt-2 border-t border-rose-200/60">
                      Currently signed in to DevOS as: <span className="font-semibold text-neutral-800">{user.email}</span>
                    </p>
                  )}
                </div>

                {isCollision ? (
                  <div className="space-y-3 mb-6 text-left">
                    {/* Option 1: Switch DevOS Account */}
                    {ownerEmail && (
                      <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-violet-200 text-violet-800 font-bold flex items-center justify-center text-[11px]">1</span>
                          <p className="text-xs font-bold text-violet-900">
                            Switch to DevOS Account ({ownerEmail})
                          </p>
                        </div>
                        <p className="text-[11px] text-violet-800 leading-relaxed pl-7">
                          The GitHub profile {targetLogin ? `@${targetLogin}` : ''} is linked to {ownerEmail}. If this is your account, switch to it to view your connected repositories.
                        </p>
                        <div className="pl-7 pt-1">
                          <button
                            onClick={handleSwitchDevOSAccount}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg shadow-sm transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Sign Out & Log In as {ownerEmail}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Option 2: Transfer to Current Account Instructions */}
                    <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-surface-200 text-surface-800 font-bold flex items-center justify-center text-[11px]">2</span>
                        <p className="text-xs font-semibold text-neutral-800">
                          Transfer to This Account ({user?.email})
                        </p>
                      </div>
                      <div className="pl-7 space-y-1.5 text-[11px] text-neutral-600">
                        <p>To safely transfer {targetLogin ? `@${targetLogin}` : 'this GitHub account'} without conflicts:</p>
                        <ol className="list-decimal list-inside space-y-1 text-neutral-700 font-medium">
                          <li>Log in to DevOS as <span className="font-semibold">{ownerEmail || 'the original owner'}</span></li>
                          <li>Go to <span className="font-semibold">Integrations</span> and click <span className="font-semibold text-rose-600">Disconnect</span></li>
                          <li>Log back in as <span className="font-semibold">{user?.email}</span> and reconnect</li>
                        </ol>
                      </div>
                    </div>

                    {/* Option 3: Connect Different Personal GitHub Account */}
                    <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-surface-200 text-surface-800 font-bold flex items-center justify-center text-[11px]">3</span>
                        <p className="text-xs font-semibold text-neutral-800">
                          Connect a Different Personal GitHub Account
                        </p>
                      </div>
                      <div className="pl-7 space-y-2">
                        <p className="text-[11px] text-neutral-500">
                          If you have a separate personal GitHub account, sign out on GitHub.com first:
                        </p>
                        <a
                          href="https://github.com/logout"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg shadow-sm transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                          Open GitHub Sign-Out (New Tab)
                        </a>
                        <div className="pt-1.5">
                          <label htmlFor="github-login" className="block text-[11px] font-medium text-neutral-700 mb-1">
                            Enter intended GitHub username:
                          </label>
                          <div className="flex gap-2">
                            <input
                              id="github-login"
                              type="text"
                              autoComplete="username"
                              value={githubLogin}
                              onChange={(event) => setGithubLogin(event.target.value)}
                              placeholder="e.g. personal-username"
                              className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                            />
                            <button
                              onClick={handleConnectIntended}
                              disabled={!githubLogin.trim()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg shadow-sm transition-colors whitespace-nowrap"
                            >
                              <Github className="w-3.5 h-3.5" />
                              Connect
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isAccountMismatch ? (
                  <div className="mb-4 p-4 rounded-xl bg-surface-50 border border-surface-200 text-left space-y-3">
                    <p className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">How to resolve:</p>
                    <div className="space-y-3 text-xs text-neutral-600">
                      <div className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-[11px] mt-0.5">1</span>
                        <div className="flex-1">
                          <p className="font-semibold text-neutral-800">Sign out of GitHub.com</p>
                          <p className="text-neutral-500 text-[11px] mt-0.5">Sign out of the current GitHub browser session before authorizing.</p>
                          <a
                            href="https://github.com/logout"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg shadow-sm transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                            Open GitHub Sign-Out (New Tab)
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 pt-2.5 border-t border-surface-200">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-[11px] mt-0.5">2</span>
                        <div className="flex-1">
                          <label htmlFor="github-login" className="font-semibold text-neutral-800">Intended GitHub username</label>
                          <input
                            id="github-login"
                            type="text"
                            autoComplete="username"
                            value={githubLogin}
                            onChange={(event) => setGithubLogin(event.target.value)}
                            placeholder="e.g. octocat"
                            className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                          />
                          <button
                            onClick={handleConnectIntended}
                            disabled={!githubLogin.trim()}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg shadow-sm transition-colors w-full justify-center"
                          >
                            <Github className="w-3.5 h-3.5" />
                            Connect Intended GitHub Account
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 mb-4">
                    <button
                      onClick={handleConnectIntended}
                      className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors shadow-sm"
                    >
                      <Github className="w-4 h-4 mr-2" />
                      Try Connecting Again
                    </button>
                  </div>
                )}

                <button
                  onClick={() => navigate('/github')}
                  className="text-neutral-500 hover:text-neutral-700 text-xs font-medium py-1 transition-colors"
                >
                  Return to GitHub page
                </button>
              </>
            );
          })()}
        </div>
      </Card>
    </div>
  );
}
