import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  projectService,
  deploymentService,
  repositoryService,
  notificationService,
  integrationService,
  settingsService,
  analyticsService,
  activityLogService,
} from '@/services/api';
import { githubService } from '@/services/github';
import { fetchProviderConfigStatus } from '@/lib/config';

export { useQueryClient };

/** True when auth has resolved and we have a user id for Supabase RLS queries. */
function useAuthReady() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const isReady = !loading && !!userId;
  return { user, userId, authLoading: loading, isReady };
}

/** Initial fetch in progress — excludes disabled-query pending state. */
export function useQueryInitialLoading(
  authLoading: boolean,
  isPending: boolean,
  fetchStatus: 'fetching' | 'paused' | 'idle'
) {
  return authLoading || (isPending && fetchStatus === 'fetching');
}

// Projects hooks
export function useProjects() {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['projects', userId],
    queryFn: () => projectService.getAll(userId!),
    enabled: isReady,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getById(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const { userId } = useAuthReady();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (project: Omit<Parameters<typeof projectService.create>[0], 'user_id'>) =>
      projectService.create({ ...project, user_id: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, updates }: { projectId: string; updates: Parameters<typeof projectService.update>[1] }) =>
      projectService.update(projectId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectService.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Repositories hooks
export function useRepositories() {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['repositories', userId],
    queryFn: () => repositoryService.getAll(userId!),
    enabled: isReady,
  });
}

export function useSyncRepositories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => githubService.syncRepositories(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

// Deployments hooks
export function useDeployments() {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['deployments', userId],
    queryFn: () => deploymentService.getAll(userId!),
    enabled: isReady,
  });
}

export function useDeployment(deploymentId: string | undefined) {
  return useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: () => deploymentService.getById(deploymentId!),
    enabled: !!deploymentId,
  });
}

export function useCreateDeployment() {
  const { userId } = useAuthReady();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deployment: Omit<Parameters<typeof deploymentService.create>[0], 'user_id'>) =>
      deploymentService.create({ ...deployment, user_id: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useUpdateDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deploymentId, updates }: { deploymentId: string; updates: Record<string, unknown> }) =>
      deploymentService.update(deploymentId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}

export function useDeleteDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deploymentId: string) => deploymentService.delete(deploymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Integrations hooks
export function useIntegrations() {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['integrations', userId],
    queryFn: () => integrationService.getAll(userId!),
    enabled: isReady,
  });
}

export function useIntegration(platform: string) {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['integration', platform, userId],
    queryFn: () => integrationService.getByPlatform(userId!, platform),
    enabled: isReady && !!platform,
  });
}

export function useCreateIntegration() {
  const { userId } = useAuthReady();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (integration: Omit<Parameters<typeof integrationService.create>[0], 'user_id'>) =>
      integrationService.create({ ...integration, user_id: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useDisconnectIntegration() {
  const { userId } = useAuthReady();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (platform: string) => integrationService.disconnect(userId!, platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integration'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}

// Provider server config (edge function) — never blocks UI indefinitely
export function useProviderConfigs() {
  return useQuery({
    queryKey: ['provider-configs'],
    queryFn: fetchProviderConfigStatus,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

// Notifications hooks
export function useNotifications(unreadOnly = false) {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['notifications', userId, unreadOnly],
    queryFn: () => notificationService.getAll(userId!, unreadOnly),
    enabled: isReady,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { userId } = useAuthReady();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Settings hooks
export function useSettings() {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['settings', userId],
    queryFn: () => settingsService.get(userId!),
    enabled: isReady,
  });
}

export function useUpdateSettings() {
  const { userId } = useAuthReady();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ updates }: { updates: Record<string, unknown> }) => {
      if (!userId) throw new Error('Not authenticated');
      return settingsService.update(userId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// Analytics hooks
export function useDashboardStats() {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['dashboard-stats', userId],
    queryFn: () => analyticsService.getDashboardStats(userId!),
    enabled: isReady,
    refetchInterval: 30000,
  });
}

export function useAnalyticsRange(startDate: string, endDate: string) {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['analytics', userId, startDate, endDate],
    queryFn: () => analyticsService.getRange(userId!, startDate, endDate),
    enabled: isReady && !!startDate && !!endDate,
  });
}

// Activity logs hooks
export function useRecentActivity(limit = 20) {
  const { userId, isReady } = useAuthReady();

  return useQuery({
    queryKey: ['activity', userId, limit],
    queryFn: () => activityLogService.getRecent(userId!, limit),
    enabled: isReady,
  });
}

export function useLogActivity() {
  const { userId } = useAuthReady();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ action, resourceType, resourceId, details }: {
      action: string;
      resourceType: string;
      resourceId?: string;
      details?: Record<string, unknown>;
    }) => activityLogService.log(userId!, action, resourceType, resourceId, details),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
