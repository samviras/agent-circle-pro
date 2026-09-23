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
      activity_log: {
        Row: {
          actor_agent_id: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          message: string
          target_agent_id: string | null
          task_id: string | null
          type: string
        }
        Insert: {
          actor_agent_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          message: string
          target_agent_id?: string | null
          task_id?: string | null
          type: string
        }
        Update: {
          actor_agent_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          message?: string
          target_agent_id?: string | null
          task_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_agent_id_fkey"
            columns: ["actor_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_target_agent_id_fkey"
            columns: ["target_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_capabilities: {
        Row: {
          agent_id: string
          capability_id: string
        }
        Insert: {
          agent_id: string
          capability_id: string
        }
        Update: {
          agent_id?: string
          capability_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_capabilities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_capabilities_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          approval_threshold: number
          availability: string
          avatar_url: string | null
          completed_tasks: number
          created_at: string
          description: string | null
          id: string
          input_types: string[]
          monthly_budget: number
          name: string
          output_types: string[]
          owner_id: string | null
          paused: boolean
          price_credits: number
          pricing_model: string
          reputation: number
          slug: string
          tagline: string | null
          verified: boolean
        }
        Insert: {
          approval_threshold?: number
          availability?: string
          avatar_url?: string | null
          completed_tasks?: number
          created_at?: string
          description?: string | null
          id?: string
          input_types?: string[]
          monthly_budget?: number
          name: string
          output_types?: string[]
          owner_id?: string | null
          paused?: boolean
          price_credits?: number
          pricing_model?: string
          reputation?: number
          slug: string
          tagline?: string | null
          verified?: boolean
        }
        Update: {
          approval_threshold?: number
          availability?: string
          avatar_url?: string | null
          completed_tasks?: number
          created_at?: string
          description?: string | null
          id?: string
          input_types?: string[]
          monthly_budget?: number
          name?: string
          output_types?: string[]
          owner_id?: string | null
          paused?: boolean
          price_credits?: number
          pricing_model?: string
          reputation?: number
          slug?: string
          tagline?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          owner_id: string
          revoked: boolean
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          owner_id: string
          revoked?: boolean
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          owner_id?: string
          revoked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          agent_id: string | null
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          amount: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          agent_id: string
          created_at: string
          follower_id: string
          id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          follower_id: string
          id?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          credits: number
          display_name: string
          id: string
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          credits?: number
          display_name?: string
          id: string
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          credits?: number
          display_name?: string
          id?: string
          verified?: boolean
        }
        Relationships: []
      }
      reviews: {
        Row: {
          agent_id: string
          comment: string | null
          created_at: string
          id: string
          quality: number | null
          rating: number
          reviewer_id: string | null
          reviewer_name: string
          speed: number | null
          task_id: string | null
        }
        Insert: {
          agent_id: string
          comment?: string | null
          created_at?: string
          id?: string
          quality?: number | null
          rating: number
          reviewer_id?: string | null
          reviewer_name?: string
          speed?: number | null
          task_id?: string | null
        }
        Update: {
          agent_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          quality?: number | null
          rating?: number
          reviewer_id?: string | null
          reviewer_name?: string
          speed?: number | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_bids: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          message: string | null
          price_credits: number
          status: string
          task_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          message?: string | null
          price_credits?: number
          status?: string
          task_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          message?: string | null
          price_credits?: number
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_bids_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_bids_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_messages: {
        Row: {
          agent_id: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          task_id: string
        }
        Insert: {
          agent_id?: string | null
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind?: string
          task_id: string
        }
        Update: {
          agent_id?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_agent_id: string | null
          budget_credits: number
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string
          id: string
          input_spec: string | null
          output_spec: string | null
          parent_task_id: string | null
          posted_by_agent: string | null
          required_capabilities: string[]
          result: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          assigned_agent_id?: string | null
          budget_credits?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          id?: string
          input_spec?: string | null
          output_spec?: string | null
          parent_task_id?: string | null
          posted_by_agent?: string | null
          required_capabilities?: string[]
          result?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          assigned_agent_id?: string | null
          budget_credits?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          id?: string
          input_spec?: string | null
          output_spec?: string | null
          parent_task_id?: string | null
          posted_by_agent?: string | null
          required_capabilities?: string[]
          result?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_posted_by_agent_fkey"
            columns: ["posted_by_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_task: { Args: { _task_id: string }; Returns: boolean }
      owns_agent: { Args: { _agent_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
