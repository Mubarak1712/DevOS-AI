export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  organization_id?: string;
  name: string;
  description?: string;
  category?: string;
  technologies?: string[];
  github_url?: string;
  deployment_url?: string;
  status: 'planning' | 'development' | 'testing' | 'deployed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: string;
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
  health_score?: number;
  has_readme: boolean;
  has_license: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string;
  user_id: string;
  project_id?: string;
  repository_id?: string;
  platform: DeploymentPlatform;
  name: string;
  url: string;
  status: DeploymentStatus;
  environment: 'production' | 'staging' | 'development' | 'preview';
  last_deployed_at?: string;
  last_build_at?: string;
  build_status?: 'success' | 'failed' | 'building' | 'pending';
  ssl_status?: 'valid' | 'invalid' | 'expired' | 'pending';
  response_time_ms?: number;
  uptime_percentage?: number;
  is_sleeping?: boolean;
  error_message?: string;
  connected_at: string;
  created_at: string;
  updated_at: string;
}

export type DeploymentPlatform =
  | 'vercel'
  | 'netlify'
  | 'render'
  | 'railway'
  | 'firebase'
  | 'github_pages'
  | 'cloudflare_pages'
  | 'cloudflare_workers'
  | 'aws_amplify'
  | 'aws_ec2'
  | 'aws_s3'
  | 'azure_app_service'
  | 'azure_static_web_apps'
  | 'google_cloud_run'
  | 'google_app_engine'
  | 'digitalocean_app_platform'
  | 'fly_io'
  | 'heroku'
  | 'surge'
  | 'hostinger'
  | 'namecheap'
  | 'custom';

export type DeploymentStatus = 'live' | 'offline' | 'error' | 'sleeping' | 'building';

export interface Integration {
  id: string;
  user_id: string;
  platform: IntegrationPlatform;
  name: string;
  connected: boolean;
  connected_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export type IntegrationPlatform = 'github' | 'vercel' | 'netlify' | 'render' | 'railway' | 'firebase' | 'cloudflare' | 'aws' | 'azure' | 'google_cloud' | 'digitalocean';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export type NotificationType =
  | 'build_failed'
  | 'deployment_down'
  | 'deployment_recovered'
  | 'repository_inactive'
  | 'ssl_expiring'
  | 'ssl_expired'
  | 'backend_sleeping'
  | 'ai_suggestion'
  | 'project_update';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface AIHistory {
  id: string;
  user_id: string;
  project_id?: string;
  type: 'idea_capture' | 'document_conversion' | 'readme' | 'documentation';
  input: string;
  output: string;
  model: string;
  created_at: string;
}

export interface Analytics {
  id: string;
  user_id: string;
  date: string;
  projects_count: number;
  active_projects_count: number;
  deployments_count: number;
  live_deployments_count: number;
  repositories_count: number;
  active_repositories_count: number;
  uptime_score: number;
  productivity_score: number;
  commits_count: number;
  deployments_created: number;
  ai_queries: number;
  created_at: string;
}

export interface Settings {
  user_id: string;
  notifications_email: boolean;
  notifications_in_app: boolean;
  auto_ping_enabled: boolean;
  auto_ping_interval: number;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}
