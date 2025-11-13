// TEMPORARY FIX: Correct database types until auto-generation is fixed
// This file contains the actual schema from the database
// Generated from schema inspection on 2025-11-13

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
      admin_audit_logs: {
        Row: {
          id: string
          user_id: string
          action_type: string
          table_affected: string | null
          record_id: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: string
          table_affected?: string | null
          record_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: string
          table_affected?: string | null
          record_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      admin_invite_codes: {
        Row: {
          id: string
          code: string
          created_at: string
          created_by: string | null
          used_at: string | null
          used_by: string | null
          is_active: boolean
          expires_at: string | null
        }
        Insert: {
          id?: string
          code: string
          created_at?: string
          created_by?: string | null
          used_at?: string | null
          used_by?: string | null
          is_active?: boolean
          expires_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          used_at?: string | null
          used_by?: string | null
          is_active?: boolean
          expires_at?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          id: string
          name: string
          email: string
          campaign: string | null
          organization_type: string | null
          message: string
          created_at: string
          status: string
          priority: string
          assigned_to: string | null
          resolved_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          campaign?: string | null
          organization_type?: string | null
          message: string
          created_at?: string
          status?: string
          priority?: string
          assigned_to?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          campaign?: string | null
          organization_type?: string | null
          message?: string
          created_at?: string
          status?: string
          priority?: string
          assigned_to?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          id: string
          user_id: string
          email: string
          ip_address: string | null
          user_agent: string | null
          login_successful: boolean
          failure_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          ip_address?: string | null
          user_agent?: string | null
          login_successful?: boolean
          failure_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          ip_address?: string | null
          user_agent?: string | null
          login_successful?: boolean
          failure_reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
          last_sign_in_at: string | null
          is_active: boolean
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
          last_sign_in_at?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
          last_sign_in_at?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      submission_notes: {
        Row: {
          id: string
          submission_id: string
          admin_id: string
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          admin_id: string
          note: string
          created_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          admin_id?: string
          note?: string
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      get_users_with_roles: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          created_at: string
          last_sign_in_at: string | null
          is_active: boolean
          roles: string[]
        }[]
      }
      get_submissions_with_details: {
        Args: Record<string, never>
        Returns: {
          id: string
          created_at: string
          updated_at: string
          name: string
          email: string
          campaign: string | null
          organization_type: string | null
          message: string
          status: string
          priority: string
          assigned_to: string | null
          assigned_to_email: string | null
          resolved_at: string | null
          notes_count: number
        }[]
      }
      log_admin_action: {
        Args: {
          _action_type: string
          _table_affected?: string | null
          _record_id?: string | null
          _old_value?: Json | null
          _new_value?: Json | null
        }
        Returns: string
      }
      log_login_attempt: {
        Args: {
          _user_id: string
          _email: string
          _successful: boolean
          _failure_reason?: string | null
        }
        Returns: string
      }
      verify_admin_invite_code: {
        Args: {
          invite_code: string
          user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Type helpers
type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
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
    : never = never
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
    : never = never
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
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
  ? PublicSchema["Enums"][PublicEnumNameOrOptions]
  : never
