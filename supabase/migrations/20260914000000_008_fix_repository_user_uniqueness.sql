-- Fix repository uniqueness to be strictly per-user
-- Drops the global UNIQUE (github_id) and replaces with UNIQUE (user_id, github_id)

ALTER TABLE public.repositories
  DROP CONSTRAINT IF EXISTS repositories_github_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repositories_user_id_github_id_key'
      AND conrelid = 'public.repositories'::regclass
  ) THEN
    ALTER TABLE public.repositories
      ADD CONSTRAINT repositories_user_id_github_id_key UNIQUE (user_id, github_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
