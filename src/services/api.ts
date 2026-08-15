import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';

// User profile operations
export const userService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: { name?: string; avatar_url?: string }) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createUser(userId: string, email: string, name?: string) {
    const { data, error } = await supabase
      .from('users')
      .insert({ id: userId, email, name: name || email.split('@')[0] })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// Project operations
export const projectService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(projectId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    if (error) throw error;
    return data;
  },

  async create(project: {
    user_id: string;
    name: string;
    description?: string;
    category?: string;
    technologies?: string[];
    github_url?: string;
    deployment_url?: string;
    status?: string;
  }) {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(projectId: string, updates: Partial<{
    name: string;
    description: string;
    category: string;
    technologies: string[];
    github_url: string;
    deployment_url: string;
    status: string;
  }>) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(projectId: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    if (error) throw error;
  },
};

// Repository operations
export const repositoryService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('repositories')
      .select('*')
      .eq('user_id', userId)
      .order('last_activity_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(repository: {
    user_id: string;
    github_id: number;
    name: string;
    full_name: string;
    description?: string;
    html_url: string;
    owner_login?: string;
    visibility?: string;
    default_branch?: string;
    stars: number;
    forks: number;
    open_issues: number;
    language?: string;
    topics?: string[];
    is_private: boolean;
    is_fork: boolean;
    last_commit_at?: string;
    last_activity_at?: string;
    has_readme: boolean;
    has_license: boolean;
  }) {
    const { data, error } = await supabase
      .from('repositories')
      .insert(repository)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(repoId: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('repositories')
      .update(updates)
      .eq('id', repoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(repoId: string) {
    const { error } = await supabase
      .from('repositories')
      .delete()
      .eq('id', repoId);
    if (error) throw error;
  },

  async syncFromGitHub(userId: string, repositories: Array<{
    id: number;
    name: string;
    full_name: string;
    description?: string | null;
    html_url: string;
    owner?: { login?: string };
    visibility?: string;
    default_branch?: string;
    stargazers_count?: number;
    forks_count?: number;
    open_issues_count?: number;
    language?: string | null;
    topics?: string[];
    private?: boolean;
    fork?: boolean;
    pushed_at?: string;
    updated_at?: string;
    license?: unknown;
  }>) {
    // Delete existing repos first
    await supabase.from('repositories').delete().eq('user_id', userId);

    // Insert new repos
    const reposToInsert = repositories.map(repo => ({
      user_id: userId,
      github_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      owner_login: repo.owner?.login,
      visibility: repo.visibility,
      default_branch: repo.default_branch,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      open_issues: repo.open_issues_count || 0,
      language: repo.language,
      topics: repo.topics || [],
      is_private: repo.private,
      is_fork: repo.fork,
      last_commit_at: repo.pushed_at,
      last_activity_at: repo.updated_at,
      has_readme: false,
      has_license: !!repo.license,
    }));

    const { data, error } = await supabase
      .from('repositories')
      .insert(reposToInsert)
      .select();
    if (error) throw error;
    return data;
  },
};

// Deployment operations
export const deploymentService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('deployments')
      .select(`
        *,
        repository:repositories (
          id,
          name,
          full_name,
          description,
          html_url,
          language
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      repository: Array.isArray(row.repository) ? row.repository[0] ?? null : row.repository,
    }));
  },

  async getById(deploymentId: string) {
    const { data, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();
    if (error) throw error;
    return data;
  },

  async create(deployment: {
    user_id: string;
    project_id?: string;
    repository_id?: string;
    platform: string;
    name: string;
    url: string;
    environment?: string;
    status?: string;
  }) {
    const { data, error } = await supabase
      .from('deployments')
      .insert({
        ...deployment,
        status: deployment.status || 'offline',
        environment: deployment.environment || 'production',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(deploymentId: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('deployments')
      .update(updates)
      .eq('id', deploymentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(deploymentId: string) {
    const { error } = await supabase
      .from('deployments')
      .delete()
      .eq('id', deploymentId);
    if (error) throw error;
  },

  async updateStatus(deploymentId: string, status: string, error?: string) {
    const updates: Record<string, unknown> = { status };
    if (error) updates.error_message = error;
    return this.update(deploymentId, updates);
  },
};

export type DeploymentWithRepository = Awaited<ReturnType<typeof deploymentService.getAll>>[number];

function sanitizeIntegration<T extends { metadata?: unknown }>(item: T): T {
  if (!item || typeof item !== 'object' || !item.metadata || typeof item.metadata !== 'object') {
    return item;
  }
  const meta = { ...(item.metadata as Record<string, unknown>) };
  delete meta.token;
  delete meta.access_token;
  return { ...item, metadata: meta };
}

// Integration operations
export const integrationService = {
  async getAll(userId: string) {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map(sanitizeIntegration);
  },

  async getByPlatform(userId: string, platform: string) {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? sanitizeIntegration(data) : null;
  },

  async create(integration: {
    user_id: string;
    platform: string;
    name: string;
    connected?: boolean;
    connected_at?: string;
    metadata?: Json;
  }) {
    const { data, error } = await supabase
      .from('integrations')
      .insert({
        ...integration,
        connected: integration.connected ?? true,
        connected_at: integration.connected_at ?? new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createOrUpdate(integration: {
    user_id: string;
    platform: string;
    name: string;
    connected?: boolean;
    connected_at?: string;
    metadata?: Json;
  }) {
    const values: Database['public']['Tables']['integrations']['Insert'][] = [
      {
        ...integration,
        connected: integration.connected ?? true,
        connected_at: integration.connected_at ?? new Date().toISOString(),
      },
    ];

    const { data, error } = await supabase
      .from('integrations')
      .upsert(values, { onConflict: 'user_id,platform' })
      .select()
      .single();

    if (error) {
      console.error('STEP D ERROR: integrationService.createOrUpdate failed', error);
      throw error;
    }
    return data;
  },

  async update(integrationId: string, updates: { connected?: boolean; connected_at?: string }) {
    const { data, error } = await supabase
      .from('integrations')
      .update(updates)
      .eq('id', integrationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(integrationId: string) {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('id', integrationId);
    if (error) throw error;
  },

  async disconnect(userId: string, platform: string) {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform);
    if (error) throw error;
  },
};

// Notification operations
export const notificationService = {
  async getAll(userId: string, unreadOnly = false) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async create(notification: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markAllAsRead(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
      .select();
    if (error) throw error;
    return data;
  },

  async delete(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) throw error;
  },
};

// Activity log operations
export const activityLogService = {
  async log(userId: string, action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>) {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
      });
    if (error) console.error('Failed to log activity:', error);
  },

  async getRecent(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
};

// Analytics operations
export const analyticsService = {
  async getToday(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getRange(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async updateToday(userId: string, updates: Partial<{
    projects_count: number;
    active_projects_count: number;
    deployments_count: number;
    live_deployments_count: number;
    repositories_count: number;
    active_repositories_count: number;
    commits_count: number;
    ai_queries: number;
  }>) {
    const today = new Date().toISOString().split('T')[0];

    // Try to get existing record
    const existing = await this.getToday(userId);

    if (existing) {
      const { data, error } = await supabase
        .from('analytics')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('analytics')
        .insert({
          user_id: userId,
          date: today,
          ...updates,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async getDashboardStats(userId: string) {
    const [projects, deployments, repositories, integrations] = await Promise.all([
      supabase.from('projects').select('id, status').eq('user_id', userId),
      supabase.from('deployments').select('id, status').eq('user_id', userId),
      supabase.from('repositories').select('id').eq('user_id', userId),
      supabase.from('integrations').select('id, connected, platform').eq('user_id', userId),
    ]);

    if (projects.error) throw projects.error;
    if (deployments.error) throw deployments.error;
    if (repositories.error) throw repositories.error;
    if (integrations.error) throw integrations.error;

    const projectRows = projects.data ?? [];
    const deploymentRows = deployments.data ?? [];
    const connectedIntegrations = (integrations.data ?? []).filter((i) => i.connected === true);

    return {
      projects_count: projectRows.length,
      active_projects_count: projectRows.filter((p) =>
        ['development', 'testing', 'deployed'].includes(p.status)
      ).length,
      deployments_count: deploymentRows.length,
      live_deployments_count: deploymentRows.filter((d) => d.status === 'live').length,
      repositories_count: (repositories.data ?? []).length,
      integrations_count: connectedIntegrations.length,
      total_integrations_count: (integrations.data ?? []).length,
    };
  },
};

// Settings operations
export const settingsService = {
  async get(userId: string) {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(userId: string) {
    const { data, error } = await supabase
      .from('settings')
      .insert({ user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(userId: string, updates: Record<string, unknown>) {
    // Check if settings exist
    let settings = await this.get(userId);

    if (!settings) {
      settings = await this.create(userId);
    }

    const { data, error } = await supabase
      .from('settings')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// AI History operations
export const aiHistoryService = {
  async create(userId: string, history: {
    type: string;
    input: string;
    output: string;
    model: string;
    project_id?: string;
  }) {
    const { data, error } = await supabase
      .from('ai_history')
      .insert({
        user_id: userId,
        ...history,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getRecent(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('ai_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
};

// Deployment Sync Service - uses Edge Functions for secure server-side sync
export const deploymentSyncService = {
  // Sync deployments via Edge Function (server-side tokens)
  async syncFromProvider(userId: string, platform: string): Promise<{
    count: number;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('sync-deployments', {
        body: { userId, provider: platform },
      });

      if (error) {
        return { count: 0, error: error.message };
      }

      if (data?.error) {
        return { count: 0, error: data.error };
      }

      return { count: data?.count || 0 };
    } catch (err) {
      return {
        count: 0,
        error: err instanceof Error ? err.message : 'Failed to sync',
      };
    }
  },

  async storeCredentials(userId: string, platform: string) {
    // With server-side tokens, we just ensure the integration is marked as connected
    // The actual tokens are managed server-side
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    if (existing) {
      return integrationService.update(existing.id, {
        connected: true,
        connected_at: new Date().toISOString(),
      });
    }

    return integrationService.create({
      user_id: userId,
      platform,
      name: platform.charAt(0).toUpperCase() + platform.slice(1),
      connected: true,
      connected_at: new Date().toISOString(),
    });
  },

  async getCredentialMetadata(userId: string, platform: string) {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
};
