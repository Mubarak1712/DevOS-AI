-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations table
CREATE TABLE public.organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members
CREATE TABLE public.organization_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Projects table
CREATE TABLE public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  technologies TEXT[],
  github_url TEXT,
  deployment_url TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'development', 'testing', 'deployed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repositories table
CREATE TABLE public.repositories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  github_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  html_url TEXT NOT NULL,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  open_issues INTEGER DEFAULT 0,
  language TEXT,
  topics TEXT[],
  is_private BOOLEAN DEFAULT FALSE,
  is_fork BOOLEAN DEFAULT FALSE,
  last_commit_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  health_score DECIMAL(5,2),
  has_readme BOOLEAN DEFAULT FALSE,
  has_license BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployments table
CREATE TABLE public.deployments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  repository_id UUID REFERENCES public.repositories(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('live', 'offline', 'error', 'sleeping', 'building')),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development', 'preview')),
  last_deployed_at TIMESTAMPTZ,
  last_build_at TIMESTAMPTZ,
  build_status TEXT CHECK (build_status IN ('success', 'failed', 'building', 'pending')),
  ssl_status TEXT CHECK (ssl_status IN ('valid', 'invalid', 'expired', 'pending')),
  response_time_ms INTEGER,
  uptime_percentage DECIMAL(5,2),
  is_sleeping BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations table
CREATE TABLE public.integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  connected BOOLEAN DEFAULT FALSE,
  connected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI History table
CREATE TABLE public.ai_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('idea_capture', 'document_conversion', 'readme', 'documentation')),
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics table
CREATE TABLE public.analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  projects_count INTEGER DEFAULT 0,
  active_projects_count INTEGER DEFAULT 0,
  deployments_count INTEGER DEFAULT 0,
  live_deployments_count INTEGER DEFAULT 0,
  repositories_count INTEGER DEFAULT 0,
  active_repositories_count INTEGER DEFAULT 0,
  uptime_score DECIMAL(5,2),
  productivity_score DECIMAL(5,2),
  commits_count INTEGER DEFAULT 0,
  deployments_created INTEGER DEFAULT 0,
  ai_queries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Settings table
CREATE TABLE public.settings (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  notifications_email BOOLEAN DEFAULT TRUE,
  notifications_in_app BOOLEAN DEFAULT TRUE,
  auto_ping_enabled BOOLEAN DEFAULT FALSE,
  auto_ping_interval INTEGER DEFAULT 10,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies for organizations
CREATE POLICY "organizations_select_member" ON public.organizations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = id AND user_id = auth.uid())
  OR owner_id = auth.uid()
);
CREATE POLICY "organizations_insert_own" ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "organizations_update_owner" ON public.organizations FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "organizations_delete_owner" ON public.organizations FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- RLS Policies for organization_members
CREATE POLICY "org_members_select_own" ON public.organization_members FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.organization_members om2 WHERE om2.organization_id = organization_id AND om2.user_id = auth.uid())
);
CREATE POLICY "org_members_insert_owner" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);
CREATE POLICY "org_members_delete_owner" ON public.organization_members FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);

-- RLS Policies for projects
CREATE POLICY "projects_select_own" ON public.projects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for repositories
CREATE POLICY "repos_select_own" ON public.repositories FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "repos_insert_own" ON public.repositories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "repos_update_own" ON public.repositories FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "repos_delete_own" ON public.repositories FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for deployments
CREATE POLICY "deployments_select_own" ON public.deployments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "deployments_insert_own" ON public.deployments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "deployments_update_own" ON public.deployments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "deployments_delete_own" ON public.deployments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for integrations
CREATE POLICY "integrations_select_own" ON public.integrations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "integrations_insert_own" ON public.integrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "integrations_update_own" ON public.integrations FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "integrations_delete_own" ON public.integrations FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for activity_logs
CREATE POLICY "logs_select_own" ON public.activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "logs_insert_own" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS Policies for ai_history
CREATE POLICY "ai_select_own" ON public.ai_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ai_insert_own" ON public.ai_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_delete_own" ON public.ai_history FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for analytics
CREATE POLICY "analytics_select_own" ON public.analytics FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "analytics_insert_own" ON public.analytics FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "analytics_update_own" ON public.analytics FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for settings
CREATE POLICY "settings_select_own" ON public.settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "settings_insert_own" ON public.settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "settings_update_own" ON public.settings FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER handle_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_repositories_updated_at BEFORE UPDATE ON public.repositories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better query performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_repositories_user_id ON public.repositories(user_id);
CREATE INDEX idx_deployments_user_id ON public.deployments(user_id);
CREATE INDEX idx_deployments_status ON public.deployments(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_analytics_user_date ON public.analytics(user_id, date);