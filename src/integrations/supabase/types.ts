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
      agent_definitions: {
        Row: {
          agent_id: string
          avg_latency_ms: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          label: string
          last_used: string | null
          routing_keywords: string[]
          status: string
          success_rate: number | null
          total_invocations: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          avg_latency_ms?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          last_used?: string | null
          routing_keywords?: string[]
          status?: string
          success_rate?: number | null
          total_invocations?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          avg_latency_ms?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          last_used?: string | null
          routing_keywords?: string[]
          status?: string
          success_rate?: number | null
          total_invocations?: number
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_type: string
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          is_pinned: boolean
          last_message_preview: string | null
          message_count: number
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          last_message_preview?: string | null
          message_count?: number
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          last_message_preview?: string | null
          message_count?: number
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          is_pinned: boolean
          project_id: string | null
          tags: string[]
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_pinned?: boolean
          project_id?: string | null
          tags?: string[]
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_pinned?: boolean
          project_id?: string | null
          tags?: string[]
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      health_metrics: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          metric_name: string
          notes: string | null
          recorded_at: string
          status: string | null
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          metric_name: string
          notes?: string | null
          recorded_at?: string
          status?: string | null
          unit?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metric_name?: string
          notes?: string | null
          recorded_at?: string
          status?: string | null
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      memories: {
        Row: {
          confidence: number
          content: string
          created_at: string
          created_by: string | null
          id: string
          importance: string
          is_archived: boolean
          is_pinned: boolean
          layer: string
          project_id: string | null
          source: string | null
          tags: string[]
          updated_at: string
          verified: boolean
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: string
          is_archived?: boolean
          is_pinned?: boolean
          layer: string
          project_id?: string | null
          source?: string | null
          tags?: string[]
          updated_at?: string
          verified?: boolean
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: string
          is_archived?: boolean
          is_pinned?: boolean
          layer?: string
          project_id?: string | null
          source?: string | null
          tags?: string[]
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "memories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_type: string | null
          content: string
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          role: string
          sources: Json
          updated_at: string
        }
        Insert: {
          agent_type?: string | null
          content: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          role: string
          sources?: Json
          updated_at?: string
        }
        Update: {
          agent_type?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          role?: string
          sources?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_knowledge: {
        Row: {
          agent_type: string | null
          applied_count: number
          category: string
          confidence: number
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          project_id: string | null
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_type?: string | null
          applied_count?: number
          category: string
          confidence?: number
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          project_id?: string | null
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_type?: string | null
          applied_count?: number
          category?: string
          confidence?: number
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          project_id?: string | null
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_knowledge_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          decisions: Json
          description: string | null
          goals: Json
          id: string
          milestones: Json
          name: string
          notes: string | null
          sources: Json
          status: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: Json
          description?: string | null
          goals?: Json
          id?: string
          milestones?: Json
          name: string
          notes?: string | null
          sources?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: Json
          description?: string | null
          goals?: Json
          id?: string
          milestones?: Json
          name?: string
          notes?: string | null
          sources?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
          fetched_at: string | null
          freshness_score: number | null
          id: string
          is_verified: boolean
          project_id: string | null
          snippet: string | null
          tags: string[]
          title: string
          type: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          fetched_at?: string | null
          freshness_score?: number | null
          id?: string
          is_verified?: boolean
          project_id?: string | null
          snippet?: string | null
          tags?: string[]
          title: string
          type?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          fetched_at?: string | null
          freshness_score?: number | null
          id?: string
          is_verified?: boolean
          project_id?: string | null
          snippet?: string | null
          tags?: string[]
          title?: string
          type?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          approved: boolean
          assigned_agent: string
          blockers: Json
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          plan: Json
          priority: string
          project_id: string | null
          requires_approval: boolean
          result_summary: string | null
          retry_count: number
          status: string
          title: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          approved?: boolean
          assigned_agent?: string
          blockers?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          plan?: Json
          priority?: string
          project_id?: string | null
          requires_approval?: boolean
          result_summary?: string | null
          retry_count?: number
          status?: string
          title: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          approved?: boolean
          assigned_agent?: string
          blockers?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          plan?: Json
          priority?: string
          project_id?: string | null
          requires_approval?: boolean
          result_summary?: string | null
          retry_count?: number
          status?: string
          title?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_connections: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invocation_count: number
          last_used: string | null
          name: string
          status: string
          tool_type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invocation_count?: number
          last_used?: string | null
          name: string
          status?: string
          tool_type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invocation_count?: number
          last_used?: string | null
          name?: string
          status?: string
          tool_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      verification_logs: {
        Row: {
          agent_type: string | null
          claim: string
          confidence: number
          conversation_id: string | null
          created_at: string
          created_by: string | null
          evidence: Json
          id: string
          project_id: string | null
          source: string | null
          updated_at: string
          verdict: string
          verified_at: string
        }
        Insert: {
          agent_type?: string | null
          claim: string
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          project_id?: string | null
          source?: string | null
          updated_at?: string
          verdict: string
          verified_at?: string
        }
        Update: {
          agent_type?: string | null
          claim?: string
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          project_id?: string | null
          source?: string | null
          updated_at?: string
          verdict?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
