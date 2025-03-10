export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          created_at: string | null
          domains: string[] | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domains?: string[] | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domains?: string[] | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_logs: {
        Row: {
          created_at: string | null
          details: string | null
          event_type: string | null
          id: number
          metadata: Json | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          event_type?: string | null
          id?: number
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          event_type?: string | null
          id?: number
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_cycles: {
        Row: {
          company_id: string
          created_at: string | null
          cycle_name: string | null
          due_date: string | null
          frequency: string | null
          id: string
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          cycle_name?: string | null
          due_date?: string | null
          frequency?: string | null
          id?: string
          start_date?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          cycle_name?: string | null
          due_date?: string | null
          frequency?: string | null
          id?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_questions: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          question_text: string
          question_type: string
          scope: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          question_text: string
          question_type: string
          scope: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          question_text?: string
          question_type?: string
          scope?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_questions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_recipients: {
        Row: {
          created_at: string | null
          id: string
          recipient_id: string
          session_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipient_id: string
          session_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          recipient_id?: string
          session_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_recipients_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "feedback_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_responses: {
        Row: {
          comment_text: string | null
          created_at: string | null
          has_comment: boolean | null
          id: string
          question_id: string
          rating_value: number | null
          recipient_id: string
          skipped: boolean | null
          text_response: string | null
          updated_at: string | null
        }
        Insert: {
          comment_text?: string | null
          created_at?: string | null
          has_comment?: boolean | null
          id?: string
          question_id: string
          rating_value?: number | null
          recipient_id: string
          skipped?: boolean | null
          text_response?: string | null
          updated_at?: string | null
        }
        Update: {
          comment_text?: string | null
          created_at?: string | null
          has_comment?: boolean | null
          id?: string
          question_id?: string
          rating_value?: number | null
          recipient_id?: string
          skipped?: boolean | null
          text_response?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "feedback_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_responses_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "feedback_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cycle_id: string
          id: string
          provider_id: string
          reminder_sent_at: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cycle_id: string
          id?: string
          provider_id: string
          reminder_sent_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cycle_id?: string
          id?: string
          provider_id?: string
          reminder_sent_at?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_sessions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "feedback_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "company_members"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          config: string | null
          created_at: string
          id: number
          last_sync_date: string | null
          refresh_token: string | null
          status: string
          token_expiry: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          config?: string | null
          created_at?: string
          id?: number
          last_sync_date?: string | null
          refresh_token?: string | null
          status?: string
          token_expiry?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          config?: string | null
          created_at?: string
          id?: number
          last_sync_date?: string | null
          refresh_token?: string | null
          status?: string
          token_expiry?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invited_users: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          invite_code: string | null
          job_title: string | null
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          used_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          id: string
          invite_code?: string | null
          job_title?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          used_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          invite_code?: string | null
          job_title?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invited_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: number
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: number
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: number
        }
        Relationships: []
      }
      manager_relationships: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          invited_manager_id: string | null
          invited_member_id: string | null
          manager_id: string | null
          member_id: string | null
          relationship_type: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          invited_manager_id?: string | null
          invited_member_id?: string | null
          manager_id?: string | null
          member_id?: string | null
          relationship_type?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          invited_manager_id?: string | null
          invited_member_id?: string | null
          manager_id?: string | null
          member_id?: string | null
          relationship_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_relationships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_relationships_invited_manager_id_fkey"
            columns: ["invited_manager_id"]
            isOneToOne: false
            referencedRelation: "invited_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_relationships_invited_member_id_fkey"
            columns: ["invited_member_id"]
            isOneToOne: false
            referencedRelation: "invited_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_registrations: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          processed_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          processed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          processed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_registrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          additional_data: Json | null
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          job_title: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          additional_data?: Json | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          job_title?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_data?: Json | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          job_title?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      org_structure: {
        Row: {
          company_id: string | null
          email: string | null
          id: string | null
          is_invited: boolean | null
          is_pending: boolean | null
          manager_id: string | null
          relationship_type: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_user_profiles: {
        Args: {
          admin_id: string
          company_id: string
          users_data: Json
        }
        Returns: Json
      }
      approve_team_member: {
        Args: {
          member_id: string
        }
        Returns: boolean
      }
      deactivate_team_member: {
        Args: {
          member_id: string
        }
        Returns: boolean
      }
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_available_functions: {
        Args: Record<PropertyKey, never>
        Returns: {
          function_name: string
          schema_name: string
        }[]
      }
      get_deactivated_users_by_emails: {
        Args: {
          p_company_id: string
          p_emails: string[]
        }
        Returns: {
          id: string
          email: string
        }[]
      }
      get_member_status_enum: {
        Args: Record<PropertyKey, never>
        Returns: {
          enum_value: string
        }[]
      }
      link_user: {
        Args: {
          user_id: string
          company_id: string
          user_role?: string
        }
        Returns: boolean
      }
      link_user_to_company: {
        Args: {
          user_id: string
          company_id: string
          user_role?: string
        }
        Returns: boolean
      }
      transfer_manager_relationships: {
        Args: {
          invited_user_id: string
          auth_user_id: string
        }
        Returns: undefined
      }
      transfer_user_profile_info: {
        Args: {
          invited_user_id: string
          auth_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      member_status: "pending" | "active" | "deactivated"
      user_role: "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
