export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          mode: Database["public"]["Enums"]["ai_mode"]
          organization_id: string | null
          summary: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          mode?: Database["public"]["Enums"]["ai_mode"]
          organization_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          mode?: Database["public"]["Enums"]["ai_mode"]
          organization_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_workspace_org_fk"
            columns: ["workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      memories: {
        Row: {
          category: string
          confidence: number
          content: string
          created_at: string
          frequency: number
          id: string
          last_used_at: string
          pinned: boolean
          updated_at: string
          usefulness: number
          user_id: string
        }
        Insert: {
          category?: string
          confidence?: number
          content: string
          created_at?: string
          frequency?: number
          id?: string
          last_used_at?: string
          pinned?: boolean
          updated_at?: string
          usefulness?: number
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          content?: string
          created_at?: string
          frequency?: number
          id?: string
          last_used_at?: string
          pinned?: boolean
          updated_at?: string
          usefulness?: number
          user_id?: string
        }
        Relationships: []
      }
      memory_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          helpful: boolean
          id: string
          impact: number
          memory_ids: string[]
          message_id: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          helpful: boolean
          id?: string
          impact?: number
          memory_ids?: string[]
          message_id?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
          impact?: number
          memory_ids?: string[]
          message_id?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_final_response: boolean
          metadata: Json
          model: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["message_role"]
          token_estimate: number
          tool_names: string[]
          upload_ids: string[]
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_final_response?: boolean
          metadata?: Json
          model?: string | null
          organization_id?: string | null
          role: Database["public"]["Enums"]["message_role"]
          token_estimate?: number
          tool_names?: string[]
          upload_ids?: string[]
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_final_response?: boolean
          metadata?: Json
          model?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["message_role"]
          token_estimate?: number
          tool_names?: string[]
          upload_ids?: string[]
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_org_fk"
            columns: ["workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          name: string
          owner_id: string
          plan: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          owner_id: string
          plan?: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          owner_id?: string
          plan?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_organization_id: string | null
          default_workspace_id: string | null
          display_name: string | null
          email: string | null
          id: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_organization_id?: string | null
          default_workspace_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_organization_id?: string | null
          default_workspace_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_org_fk"
            columns: ["default_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_workspace_fk"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      response_outcomes: {
        Row: {
          chars: number
          conversation_id: string
          created_at: string
          id: string
          intent: string
          latency_ms: number
          live_used: boolean
          memory_hits: number
          user_id: string
          was_fallback: boolean
        }
        Insert: {
          chars?: number
          conversation_id: string
          created_at?: string
          id?: string
          intent: string
          latency_ms?: number
          live_used?: boolean
          memory_hits?: number
          user_id: string
          was_fallback?: boolean
        }
        Update: {
          chars?: number
          conversation_id?: string
          created_at?: string
          id?: string
          intent?: string
          latency_ms?: number
          live_used?: boolean
          memory_hits?: number
          user_id?: string
          was_fallback?: boolean
        }
        Relationships: []
      }
      routing_stats: {
        Row: {
          avg_latency_ms: number
          created_at: string
          failure_count: number
          id: string
          intent: string
          last_used_at: string
          live_used: boolean
          success_count: number
          user_id: string
        }
        Insert: {
          avg_latency_ms?: number
          created_at?: string
          failure_count?: number
          id?: string
          intent: string
          last_used_at?: string
          live_used?: boolean
          success_count?: number
          user_id: string
        }
        Update: {
          avg_latency_ms?: number
          created_at?: string
          failure_count?: number
          id?: string
          intent?: string
          last_used_at?: string
          live_used?: boolean
          success_count?: number
          user_id?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string | null
          status: Database["public"]["Enums"]["upload_status"]
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["upload_status"]
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          status?: Database["public"]["Enums"]["upload_status"]
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          source_conversation_id: string | null
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          source_conversation_id?: string | null
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          source_conversation_id?: string | null
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["workspace_role"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_organization_id_fkey"
            columns: ["workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          default_mode: Database["public"]["Enums"]["ai_mode"]
          id: string
          metadata: Json
          name: string
          organization_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_mode?: Database["public"]["Enums"]["ai_mode"]
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_mode?: Database["public"]["Enums"]["ai_mode"]
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ai_mode: "general" | "medical"
      app_role: "admin" | "member"
      message_role: "user" | "assistant" | "system"
      organization_role: "owner" | "admin" | "member" | "viewer"
      upload_status: "uploading" | "processing" | "ready" | "failed"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_mode: ["general", "medical"],
      app_role: ["admin", "member"],
      message_role: ["user", "assistant", "system"],
      organization_role: ["owner", "admin", "member", "viewer"],
      upload_status: ["uploading", "processing", "ready", "failed"],
      workspace_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const
