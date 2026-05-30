export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: Database['public']['Enums']['profile_role'];
          default_organization_id: string | null;
          default_workspace_id: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: Database['public']['Enums']['profile_role'];
          default_organization_id?: string | null;
          default_workspace_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          owner_id: string;
          plan: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          owner_id: string;
          plan?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: Database['public']['Enums']['organization_role'];
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: Database['public']['Enums']['organization_role'];
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['organization_members']['Insert']>;
      };
      workspaces: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string | null;
          created_by: string;
          default_mode: Database['public']['Enums']['ai_mode'];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug?: string | null;
          created_by: string;
          default_mode?: Database['public']['Enums']['ai_mode'];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>;
      };
      workspace_members: {
        Row: {
          id: string;
          organization_id: string;
          workspace_id: string;
          user_id: string;
          role: Database['public']['Enums']['workspace_role'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workspace_id: string;
          user_id: string;
          role?: Database['public']['Enums']['workspace_role'];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workspace_members']['Insert']>;
      };
      conversations: {
        Row: {
          id: string;
          organization_id: string;
          workspace_id: string;
          user_id: string;
          title: string;
          mode: Database['public']['Enums']['ai_mode'];
          summary: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workspace_id: string;
          user_id: string;
          title?: string;
          mode?: Database['public']['Enums']['ai_mode'];
          summary?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          organization_id: string;
          workspace_id: string;
          conversation_id: string;
          user_id: string | null;
          role: Database['public']['Enums']['message_role'];
          content: string;
          upload_ids: string[];
          tool_names: string[];
          token_estimate: number;
          model: string | null;
          is_final_response: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workspace_id: string;
          conversation_id: string;
          user_id?: string | null;
          role: Database['public']['Enums']['message_role'];
          content: string;
          upload_ids?: string[];
          tool_names?: string[];
          token_estimate?: number;
          model?: string | null;
          is_final_response?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      memories: {
        Row: {
          id: string;
          organization_id: string;
          workspace_id: string | null;
          user_id: string;
          content: string;
          kind: string;
          tags: string[];
          importance: number;
          embedding: string | null;
          source_message_id: string | null;
          archived: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workspace_id?: string | null;
          user_id: string;
          content: string;
          kind?: string;
          tags?: string[];
          importance?: number;
          embedding?: string | null;
          source_message_id?: string | null;
          archived?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memories']['Insert']>;
      };
      uploads: {
        Row: {
          id: string;
          organization_id: string;
          workspace_id: string;
          user_id: string;
          bucket_id: string;
          storage_path: string;
          name: string;
          mime: string;
          size_bytes: number;
          status: Database['public']['Enums']['upload_status'];
          extracted_text: string | null;
          summary: string | null;
          embedding: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workspace_id: string;
          user_id: string;
          bucket_id: string;
          storage_path: string;
          name: string;
          mime: string;
          size_bytes?: number;
          status?: Database['public']['Enums']['upload_status'];
          extracted_text?: string | null;
          summary?: string | null;
          embedding?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['uploads']['Insert']>;
      };
      workflows: {
        Row: {
          id: string;
          organization_id: string;
          workspace_id: string;
          created_by: string;
          name: string;
          description: string | null;
          status: Database['public']['Enums']['workflow_status'];
          definition: Json;
          trigger_config: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workspace_id: string;
          created_by: string;
          name: string;
          description?: string | null;
          status?: Database['public']['Enums']['workflow_status'];
          definition?: Json;
          trigger_config?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workflows']['Insert']>;
      };
      workflow_runs: {
        Row: {
          id: string;
          organization_id: string;
          workspace_id: string;
          workflow_id: string | null;
          conversation_id: string | null;
          started_by: string | null;
          status: Database['public']['Enums']['workflow_run_status'];
          input: Json;
          output: Json;
          error: string | null;
          started_at: string;
          completed_at: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          organization_id: string;
          workspace_id: string;
          workflow_id?: string | null;
          conversation_id?: string | null;
          started_by?: string | null;
          status?: Database['public']['Enums']['workflow_run_status'];
          input?: Json;
          output?: Json;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database['public']['Tables']['workflow_runs']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          workspace_id: string | null;
          actor_id: string | null;
          event_type: string;
          target_table: string | null;
          target_id: string | null;
          status: string;
          ip_address: string | null;
          user_agent: string | null;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          workspace_id?: string | null;
          actor_id?: string | null;
          event_type: string;
          target_table?: string | null;
          target_id?: string | null;
          status?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      analytics: {
        Row: {
          id: string;
          organization_id: string | null;
          workspace_id: string | null;
          user_id: string | null;
          conversation_id: string | null;
          event_type: string;
          mode: Database['public']['Enums']['ai_mode'];
          model: string | null;
          latency_ms: number;
          tokens_estimated: number;
          tool_names: string[];
          status: string;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          workspace_id?: string | null;
          user_id?: string | null;
          conversation_id?: string | null;
          event_type: string;
          mode?: Database['public']['Enums']['ai_mode'];
          model?: string | null;
          latency_ms?: number;
          tokens_estimated?: number;
          tool_names?: string[];
          status?: string;
          detail?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['analytics']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_memories: {
        Args: {
          query_embedding: string;
          match_count?: number;
          match_threshold?: number;
          p_workspace_id?: string | null;
          p_organization_id?: string | null;
        };
        Returns: {
          id: string;
          organization_id: string;
          workspace_id: string | null;
          user_id: string;
          content: string;
          kind: string;
          tags: string[];
          importance: number;
          similarity: number;
          metadata: Json;
          created_at: string;
        }[];
      };
    };
    Enums: {
      profile_role: 'user' | 'admin' | 'clinician' | 'platform_admin';
      organization_role: 'owner' | 'admin' | 'member' | 'viewer';
      workspace_role: 'owner' | 'admin' | 'editor' | 'viewer';
      ai_mode: 'general' | 'medical';
      message_role: 'user' | 'assistant' | 'system';
      workflow_status: 'draft' | 'active' | 'paused' | 'archived';
      workflow_run_status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
      upload_status: 'uploaded' | 'processing' | 'ready' | 'failed' | 'archived';
      setting_scope: 'user' | 'organization' | 'workspace';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

