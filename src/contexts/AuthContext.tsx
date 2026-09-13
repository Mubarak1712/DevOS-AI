/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; needsEmailVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ensuredUserIds = new Set<string>();

/**
 * Ensures public.users + settings rows exist for the authenticated user.
 * Requires an active session (RLS: auth.uid() must match id).
 * DB trigger handle_new_user() also creates rows on signup; this is the client fallback on login.
 */
async function ensureUserProfile(authUser: User | null): Promise<void> {
  if (!authUser?.id || !authUser.email) return;

  if (ensuredUserIds.has(authUser.id)) return;
  ensuredUserIds.add(authUser.id);

  try {
    const email = authUser.email;
    const name =
      (authUser.user_metadata?.name as string | undefined) ||
      email.split('@')[0] ||
      authUser.id;

    const { error: upsertError } = await supabase.from('users').upsert(
      { id: authUser.id, email, name },
      { onConflict: 'id' }
    );

    if (upsertError) {
      console.error('[Auth] Failed to upsert public.users row:', upsertError.message, upsertError);
    }

    const { data: existingSettings } = await supabase
      .from('settings')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!existingSettings) {
      const { error: settingsError } = await supabase
        .from('settings')
        .insert({ user_id: authUser.id });

      if (settingsError && settingsError.code !== '23505') {
        console.error('[Auth] Failed to create settings row:', settingsError.message, settingsError);
      }
    }
  } catch (err) {
    console.error('[Auth] Unexpected error in ensureUserProfile:', err);
    ensuredUserIds.delete(authUser.id); // allow retry
  }
}

function clearAuthStorage() {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key.includes('github_oauth') ||
      key.includes('oauth') ||
      key.includes('supabase') ||
      key.startsWith('sb-')
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem('github_oauth_processed_code');
  sessionStorage.removeItem('github_oauth_state');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;

      // When user changes (e.g. User A -> User B or User A -> logged out), wipe query cache
      if (currentUserIdRef.current !== null && currentUserIdRef.current !== nextUserId) {
        queryClient.clear();
      }
      currentUserIdRef.current = nextUserId;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        clearAuthStorage();
        ensuredUserIds.clear();
        queryClient.clear();
      } else if (nextSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY')) {
        ensuredUserIds.delete(nextSession.user.id);
        ensureUserProfile(nextSession.user).catch(err => {
          console.error('[Auth] Background profile ensure failed:', err);
        });
      }
    });

    // Fallback: If onAuthStateChange doesn't fire within 1s (should never happen), force unblock
    const timeoutId = setTimeout(() => {
      if (mounted && !initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signUp = async (email: string, password: string, name: string) => {
    const emailRedirectTo = (
      import.meta.env.VITE_EMAIL_CONFIRMATION_REDIRECT_URI || ''
    ).trim() || `${window.location.origin}/login`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { name },
      },
    });

    const needsEmailVerification = !error && !!data.user && !data.session;

    // Profile row is created by DB trigger on auth.users insert.
    // If email confirmation is off and a session exists, ensure profile now.
    if (!error && data.session?.user) {
      await ensureUserProfile(data.session.user);
    }

    return { error, needsEmailVerification };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && data.session?.user) {
      ensuredUserIds.delete(data.session.user.id);
      await ensureUserProfile(data.session.user);
    }

    return { error };
  };

  const signOut = async () => {
    try {
      // Trigger sign out in background (non-blocking) so that network/Web Lock hangs do not block the UI logout
      supabase.auth.signOut().catch((err) => {
        console.error('[Auth] Background Supabase sign out error:', err);
      });

      // Clear persisted OAuth and auth state
      clearAuthStorage();
      ensuredUserIds.clear();

      // Clear client-side cache/state
      queryClient.clear();
      setSession(null);
      setUser(null);

      return { error: null };
    } catch (err) {
      console.error('[Auth] Error during sign out:', err);
      // Fallback clean-up
      clearAuthStorage();
      ensuredUserIds.clear();
      queryClient.clear();
      setSession(null);
      setUser(null);
      return { error: err instanceof Error ? err : new Error('Logout failed') };
    }
  };

  const resetPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/profile`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
