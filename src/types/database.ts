// Database types generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          name: string;
          description: string | null;
          category: string | null;
          technologies: string[] | null;
          github_url: string | null;
          deployment_url: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id?: string | null;
          name: string;
          description?: string | null;
          category?: string | null;
          technologies?: string[] | null;
          github_url?: string | null;
          deployment_url?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          category?: string | null;
          technologies?: string[] | null;
          github_url?: string | null;
          deployment_url?: string | null;
          status?: string;
          updated_at?: string;
        };
      };
      repositories: {
        Row: {
          id: string;
          user_id: string;
          github_id: number;
          name: string;
          full_name: string;
          description: string | null;
          html_url: string;
          owner_login: string | null;
          visibility: string | null;
          default_branch: string | null;
          stars: number;
          forks: number;
          open_issues: number;
          language: string | null;
          topics: string[] | null;
          is_private: boolean;
          is_fork: boolean;
          last_commit_at: string | null;
          last_activity_at: string | null;
          health_score: number | null;
          has_readme: boolean;
          has_license: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          github_id: number;
          name: string;
          full_name: string;
          description?: string | null;
          html_url: string;
          owner_login?: string | null;
          visibility?: string | null;
          default_branch?: string | null;
          stars?: number;
          forks?: number;
          open_issues?: number;
          language?: string | null;
          topics?: string[] | null;
          is_private?: boolean;
          is_fork?: boolean;
          last_commit_at?: string | null;
          last_activity_at?: string | null;
          health_score?: number | null;
          has_readme?: boolean;
          has_license?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          [key: string]: unknown;
          updated_at?: string;
        };
      };
      deployments: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          repository_id: string | null;
          platform: string;
          name: string;
          url: string;
          status: string;
          environment: string;
          last_deployed_at: string | null;
          last_build_at: string | null;
          build_status: string | null;
          ssl_status: string | null;
          response_time_ms: number | null;
          uptime_percentage: number | null;
          is_sleeping: boolean | null;
          error_message: string | null;
          connected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          repository_id?: string | null;
          platform: string;
          name: string;
          url: string;
          status?: string;
          environment?: string;
          last_deployed_at?: string | null;
          last_build_at?: string | null;
          build_status?: string | null;
          ssl_status?: string | null;
          response_time_ms?: number | null;
          uptime_percentage?: number | null;
          is_sleeping?: boolean | null;
          error_message?: string | null;
          connected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          [key: string]: unknown;
          updated_at?: string;
        };
      };
      integrations: {
        Row: {
          id: string;
          user_id: string;
          platform: string;
          name: string;
          connected: boolean;
          connected_at: string | null;
          expires_at: string | null;
          metadata: Json | null;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: string;
          name: string;
          connected?: boolean;
          connected_at?: string | null;
          expires_at?: string | null;
          metadata?: Json | null;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          connected?: boolean;
          connected_at?: string | null;
          expires_at?: string | null;
          metadata?: Json | null;
          last_sync_at?: string | null;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data: Json | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data?: Json | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
      };
      settings: {
        Row: {
          user_id: string;
          notifications_email: boolean;
          notifications_in_app: boolean;
          auto_ping_enabled: boolean;
          auto_ping_interval: number;
          theme: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          notifications_email?: boolean;
          notifications_in_app?: boolean;
          auto_ping_enabled?: boolean;
          auto_ping_interval?: number;
          theme?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          notifications_email?: boolean;
          notifications_in_app?: boolean;
          auto_ping_enabled?: boolean;
          auto_ping_interval?: number;
          theme?: string;
          updated_at?: string;
        };
      };
      ideas: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: string;
          tags: string[] | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          category?: string;
          tags?: string[] | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          category?: string;
          tags?: string[] | null;
          status?: string;
          updated_at?: string;
        };
      };
      ai_history: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          type: string;
          input: string;
          output: string;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          type: string;
          input: string;
          output: string;
          model: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          type?: string;
          input?: string;
          output?: string;
          model?: string;
          created_at?: string;
        };
      };
    };
  };
}

// Utility type for extracting table types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
