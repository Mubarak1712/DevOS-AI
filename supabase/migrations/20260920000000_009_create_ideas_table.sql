-- Create ideas table for developer idea vault with complete user isolation (RLS)
CREATE TABLE IF NOT EXISTS public.ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('project', 'feature', 'improvement', 'technical', 'experiment', 'product', 'thought')),
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'planned', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ideas' AND policyname = 'ideas_select_own') THEN
    CREATE POLICY "ideas_select_own" ON public.ideas FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ideas' AND policyname = 'ideas_insert_own') THEN
    CREATE POLICY "ideas_insert_own" ON public.ideas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ideas' AND policyname = 'ideas_update_own') THEN
    CREATE POLICY "ideas_update_own" ON public.ideas FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ideas' AND policyname = 'ideas_delete_own') THEN
    CREATE POLICY "ideas_delete_own" ON public.ideas FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

DROP TRIGGER IF EXISTS handle_ideas_updated_at ON public.ideas;
CREATE TRIGGER handle_ideas_updated_at BEFORE UPDATE ON public.ideas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON public.ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON public.ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON public.ideas(category);

NOTIFY pgrst, 'reload schema';
