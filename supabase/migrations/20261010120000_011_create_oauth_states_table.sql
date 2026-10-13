-- Create oauth_states table for server-side single-use OAuth state tracking and replay protection.

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'github',
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_user_state
  ON public.oauth_states (user_id, state);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state_lookup
  ON public.oauth_states (state);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'oauth_states' AND policyname = 'oauth_states_insert_own'
  ) THEN
    CREATE POLICY "oauth_states_insert_own" ON public.oauth_states
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'oauth_states' AND policyname = 'oauth_states_select_own'
  ) THEN
    CREATE POLICY "oauth_states_select_own" ON public.oauth_states
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'oauth_states' AND policyname = 'oauth_states_update_own'
  ) THEN
    CREATE POLICY "oauth_states_update_own" ON public.oauth_states
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'oauth_states' AND policyname = 'oauth_states_delete_own'
  ) THEN
    CREATE POLICY "oauth_states_delete_own" ON public.oauth_states
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
