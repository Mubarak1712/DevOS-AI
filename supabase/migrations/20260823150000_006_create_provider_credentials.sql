-- Create provider_credentials table for secure, server-only storage of per-user deployment tokens.
-- RLS is enabled with NO SELECT/INSERT/UPDATE/DELETE policies for 'authenticated' or 'anon' roles.
-- This ensures tokens can NEVER be read or modified via client-side PostgREST queries.
-- Only Supabase Edge Functions with the service_role key can read/write this table.

CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  credential_value TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_credentials_user_provider
  ON public.provider_credentials (user_id, provider);

CREATE INDEX IF NOT EXISTS idx_provider_credentials_user_id
  ON public.provider_credentials (user_id);

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS handle_provider_credentials_updated_at ON public.provider_credentials;
CREATE TRIGGER handle_provider_credentials_updated_at
  BEFORE UPDATE ON public.provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

NOTIFY pgrst, 'reload schema';
