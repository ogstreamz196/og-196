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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      boss_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          category: string
          created_at: string
          id: string
          metadata: Json
          new_value: string | null
          old_value: string | null
          target_key: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          category: string
          created_at?: string
          id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          target_key: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          category?: string
          created_at?: string
          id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          target_key?: string
        }
        Relationships: []
      }
      bot_tokens: {
        Row: {
          allowed_domain: string | null
          created_at: string
          developer_id: string
          id: string
          status: string
          token_string: string
          updated_at: string
        }
        Insert: {
          allowed_domain?: string | null
          created_at?: string
          developer_id: string
          id?: string
          status?: string
          token_string?: string
          updated_at?: string
        }
        Update: {
          allowed_domain?: string | null
          created_at?: string
          developer_id?: string
          id?: string
          status?: string
          token_string?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_tokens_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reference: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reference?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reference?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      og_bot_remote_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          external_user: string | null
          grants_vip: boolean
          id: string
          origin_host: string
          revoked_at: string | null
          signing_secret: string | null
          token: string
          uses_remaining: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          external_user?: string | null
          grants_vip?: boolean
          id?: string
          origin_host: string
          revoked_at?: string | null
          signing_secret?: string | null
          token: string
          uses_remaining?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          external_user?: string | null
          grants_vip?: boolean
          id?: string
          origin_host?: string
          revoked_at?: string | null
          signing_secret?: string | null
          token?: string
          uses_remaining?: number | null
        }
        Relationships: []
      }
      og_bot_token_invites: {
        Row: {
          claim_expires_at: string | null
          code: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          revoked_at: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          claim_expires_at?: string | null
          code: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          claim_expires_at?: string | null
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      og_bot_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          last_used_at: string | null
          revoked_at: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portals: {
        Row: {
          allowed_styles: string[] | null
          coin_cost_per_generation: number
          created_at: string
          created_by: string | null
          custom_welcome_text: string | null
          id: string
          language: string
          name: string
          primary_color: string
          slug: string
          status: string
          style_tags: string[]
          updated_at: string
        }
        Insert: {
          allowed_styles?: string[] | null
          coin_cost_per_generation?: number
          created_at?: string
          created_by?: string | null
          custom_welcome_text?: string | null
          id?: string
          language: string
          name: string
          primary_color?: string
          slug: string
          status?: string
          style_tags?: string[]
          updated_at?: string
        }
        Update: {
          allowed_styles?: string[] | null
          coin_cost_per_generation?: number
          created_at?: string
          created_by?: string | null
          custom_welcome_text?: string | null
          id?: string
          language?: string
          name?: string
          primary_color?: string
          slug?: string
          status?: string
          style_tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          coin_balance: number
          created_at: string
          custom_bot_name: string
          display_name: string | null
          email: string | null
          id: string
          total_bot_interactions: number
          updated_at: string
          widget_deployed_domains: string[]
        }
        Insert: {
          coin_balance?: number
          created_at?: string
          custom_bot_name?: string
          display_name?: string | null
          email?: string | null
          id: string
          total_bot_interactions?: number
          updated_at?: string
          widget_deployed_domains?: string[]
        }
        Update: {
          coin_balance?: number
          created_at?: string
          custom_bot_name?: string
          display_name?: string | null
          email?: string | null
          id?: string
          total_bot_interactions?: number
          updated_at?: string
          widget_deployed_domains?: string[]
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          audio_path: string | null
          completed_at: string | null
          cover_url: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          lyrics: string | null
          portal_id: string | null
          prompt: string
          sample_path: string | null
          status: string
          style: string | null
          suno_clip_id: string | null
          suno_task_id: string | null
          title: string | null
          unlocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          lyrics?: string | null
          portal_id?: string | null
          prompt: string
          sample_path?: string | null
          status?: string
          style?: string | null
          suno_clip_id?: string | null
          suno_task_id?: string | null
          title?: string | null
          unlocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_path?: string | null
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          lyrics?: string | null
          portal_id?: string | null
          prompt?: string
          sample_path?: string | null
          status?: string
          style?: string | null
          suno_clip_id?: string | null
          suno_task_id?: string | null
          title?: string | null
          unlocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          foul_mouth: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          foul_mouth?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          foul_mouth?: boolean
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_profile_label: {
        Args: {
          admin_notes: string
          new_display_name: string
          target_user_id: string
        }
        Returns: string
      }
      create_og_bot_invite: {
        Args: {
          p_claim_expires_at?: string
          p_notes?: string
          p_token_expires_at?: string
        }
        Returns: string
      }
      deduct_coins: {
        Args: { p_amount: number; p_reference: string; p_user: string }
        Returns: number
      }
      gen_bot_token_string: { Args: never; Returns: string }
      gen_og_bot_invite_code: { Args: never; Returns: string }
      gen_og_bot_token: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_bot_interactions: {
        Args: { p_delta?: number }
        Returns: number
      }
      list_og_bot_remote_tokens_safe: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          expires_at: string
          external_user: string
          grants_vip: boolean
          id: string
          origin_host: string
          revoked_at: string
          token: string
          uses_remaining: number
        }[]
      }
      mint_coins: {
        Args: { p_amount: number; p_reason?: string; p_target: string }
        Returns: number
      }
      mint_coins_admin: {
        Args: { admin_notes: string; amount: number; target_user_id: string }
        Returns: number
      }
      purchase_bot_token: {
        Args: { p_allowed_domain?: string }
        Returns: {
          id: string
          token_string: string
        }[]
      }
      purchase_vip: { Args: never; Returns: number }
      redeem_og_bot_invite: { Args: { p_code: string }; Returns: string }
      regenerate_og_bot_token: {
        Args: { target_user_id: string }
        Returns: string
      }
      revoke_og_bot_invite: { Args: { p_invite_id: string }; Returns: boolean }
      revoke_og_bot_token: {
        Args: { admin_notes?: string; target_user_id: string }
        Returns: string
      }
      set_balance_admin: {
        Args: {
          admin_notes: string
          new_balance: number
          target_user_id: string
        }
        Returns: number
      }
      set_og_bot_admin: {
        Args: { admin_notes?: string; make_og: boolean; target_user_id: string }
        Returns: boolean
      }
      set_og_bot_token_expiry: {
        Args: {
          admin_notes?: string
          new_expires_at: string
          target_user_id: string
        }
        Returns: string
      }
      set_site_content: {
        Args: { p_key: string; p_value: string }
        Returns: string
      }
      set_vip_admin: {
        Args: {
          admin_notes?: string
          make_vip: boolean
          target_user_id: string
        }
        Returns: boolean
      }
      unrevoke_og_bot_token: {
        Args: { admin_notes?: string; target_user_id: string }
        Returns: boolean
      }
      validate_bot_token: {
        Args: { p_origin: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "vip" | "og_bot"
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
      app_role: ["admin", "user", "vip", "og_bot"],
    },
  },
} as const
