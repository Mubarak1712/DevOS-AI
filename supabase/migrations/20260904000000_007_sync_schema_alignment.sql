-- Schema Alignment Migration
-- Ensures all columns and tables expected by the application exist idempotently on the remote database.

-- 1. Align public.repositories
ALTER TABLE public.repositories
  ADD COLUMN IF NOT EXISTS owner_login TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT,
  ADD COLUMN IF NOT EXISTS default_branch TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS health_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS has_readme BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_license BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stars INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_issues INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_fork BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_commit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Ensure UNIQUE (github_id) constraint on public.repositories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repositories_github_id_key'
      AND conrelid = 'public.repositories'::regclass
  ) THEN
    ALTER TABLE public.repositories
      ADD CONSTRAINT repositories_github_id_key UNIQUE (github_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Align public.integrations
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS connected BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integrations_user_id_platform_key'
      AND conrelid = 'public.integrations'::regclass
  ) THEN
    ALTER TABLE public.integrations
      ADD CONSTRAINT integrations_user_id_platform_key UNIQUE (user_id, platform);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Align public.deployments
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS deployment_id TEXT,
  ADD COLUMN IF NOT EXISTS branch TEXT,
  ADD COLUMN IF NOT EXISTS commit_hash TEXT,
  ADD COLUMN IF NOT EXISTS commit_message TEXT,
  ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_build_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS build_status TEXT,
  ADD COLUMN IF NOT EXISTS ssl_status TEXT,
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS uptime_percentage DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS is_sleeping BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Create provider_credentials table if not exists (Server-side only)
CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  credential_value TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

-- 5. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

-- 6. Ensure RLS policies exist
DO $$
BEGIN
  -- Repositories policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repositories' AND policyname = 'repositories_select_own') THEN
    CREATE POLICY "repositories_select_own" ON public.repositories FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repositories' AND policyname = 'repositories_insert_own') THEN
    CREATE POLICY "repositories_insert_own" ON public.repositories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repositories' AND policyname = 'repositories_update_own') THEN
    CREATE POLICY "repositories_update_own" ON public.repositories FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repositories' AND policyname = 'repositories_delete_own') THEN
    CREATE POLICY "repositories_delete_own" ON public.repositories FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;

  -- Deployments policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deployments' AND policyname = 'deployments_select_own') THEN
    CREATE POLICY "deployments_select_own" ON public.deployments FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deployments' AND policyname = 'deployments_insert_own') THEN
    CREATE POLICY "deployments_insert_own" ON public.deployments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deployments' AND policyname = 'deployments_update_own') THEN
    CREATE POLICY "deployments_update_own" ON public.deployments FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'deployments' AND policyname = 'deployments_delete_own') THEN
    CREATE POLICY "deployments_delete_own" ON public.deployments FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;

  -- Provider credentials policies (User-scoped access for select and delete)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'provider_credentials' AND policyname = 'provider_credentials_select_own') THEN
    CREATE POLICY "provider_credentials_select_own" ON public.provider_credentials FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'provider_credentials' AND policyname = 'provider_credentials_delete_own') THEN
    CREATE POLICY "provider_credentials_delete_own" ON public.provider_credentials FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
