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
    PostgrestVersion: "14.17"
  }
  mybody: {
    Tables: {
      activity_records: {
        Row: {
          activity_type: string | null
          conditions_note: string | null
          created_at: string
          distance_meters: number | null
          duration_minutes: number | null
          elevation_gain_meters: number | null
          id: string
          pack_weight_kg: number | null
          pain_recovery_note: string | null
          route_name: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          activity_type?: string | null
          conditions_note?: string | null
          created_at?: string
          distance_meters?: number | null
          duration_minutes?: number | null
          elevation_gain_meters?: number | null
          id: string
          pack_weight_kg?: number | null
          pain_recovery_note?: string | null
          route_name?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          activity_type?: string | null
          conditions_note?: string | null
          created_at?: string
          distance_meters?: number | null
          duration_minutes?: number | null
          elevation_gain_meters?: number | null
          id?: string
          pack_weight_kg?: number | null
          pain_recovery_note?: string | null
          route_name?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_working_sets"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "activity_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      body_metrics: {
        Row: {
          body_fat_percent: number | null
          created_at: string
          id: string
          measured_at: string
          measurement_method: string | null
          note: string | null
          skeletal_muscle_kg: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_percent?: number | null
          created_at?: string
          id?: string
          measured_at?: string
          measurement_method?: string | null
          note?: string | null
          skeletal_muscle_kg?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_percent?: number | null
          created_at?: string
          id?: string
          measured_at?: string
          measurement_method?: string | null
          note?: string | null
          skeletal_muscle_kg?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          aliases: string[]
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          measurement_type: string
          name: string
          parent_exercise_id: string | null
          updated_at: string
          user_id: string | null
          weight_basis: string | null
        }
        Insert: {
          aliases?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          measurement_type: string
          name: string
          parent_exercise_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight_basis?: string | null
        }
        Update: {
          aliases?: string[]
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          measurement_type?: string
          name?: string
          parent_exercise_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight_basis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_library_parent_exercise_id_fkey"
            columns: ["parent_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_sets: {
        Row: {
          created_at: string
          distance_meters: number | null
          duration_seconds: number | null
          id: string
          is_assisted: boolean | null
          raw_value_note: string | null
          reps: number | null
          rounds: number | null
          session_item_id: string
          set_kind: string
          set_no: number
          side: string
          success: boolean | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          id: string
          is_assisted?: boolean | null
          raw_value_note?: string | null
          reps?: number | null
          rounds?: number | null
          session_item_id: string
          set_kind?: string
          set_no?: number
          side?: string
          success?: boolean | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          id?: string
          is_assisted?: boolean | null
          raw_value_note?: string | null
          reps?: number | null
          rounds?: number | null
          session_item_id?: string
          set_kind?: string
          set_no?: number
          side?: string
          success?: boolean | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_sets_session_item_id_fkey"
            columns: ["session_item_id"]
            isOneToOne: false
            referencedRelation: "session_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_logs: {
        Row: {
          alcohol_amount_note: string | null
          alcohol_type: string | null
          condition_note: string | null
          created_at: string
          id: string
          log_date: string
          pain_note: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alcohol_amount_note?: string | null
          alcohol_type?: string | null
          condition_note?: string | null
          created_at?: string
          id?: string
          log_date?: string
          pain_note?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          alcohol_amount_note?: string | null
          alcohol_type?: string | null
          condition_note?: string | null
          created_at?: string
          id?: string
          log_date?: string
          pain_note?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_items: {
        Row: {
          assistance_note: string | null
          created_at: string
          difficulty_rpe: number | null
          display_name_snapshot: string
          exercise_id: string | null
          id: string
          item_note: string | null
          pain_note: string | null
          sequence_no: number
          session_id: string
          updated_at: string
          variation_note: string | null
        }
        Insert: {
          assistance_note?: string | null
          created_at?: string
          difficulty_rpe?: number | null
          display_name_snapshot: string
          exercise_id?: string | null
          id: string
          item_note?: string | null
          pain_note?: string | null
          sequence_no?: number
          session_id: string
          updated_at?: string
          variation_note?: string | null
        }
        Update: {
          assistance_note?: string | null
          created_at?: string
          difficulty_rpe?: number | null
          display_name_snapshot?: string
          exercise_id?: string | null
          id?: string
          item_note?: string | null
          pain_note?: string | null
          sequence_no?: number
          session_id?: string
          updated_at?: string
          variation_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_working_sets"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          condition_note: string | null
          created_at: string
          deleted_at: string | null
          duration_minutes: number | null
          ended_at: string | null
          general_note: string | null
          id: string
          raw_note: string | null
          session_date: string
          session_type: string
          source_type: string
          started_at: string | null
          structured_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          condition_note?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          general_note?: string | null
          id: string
          raw_note?: string | null
          session_date?: string
          session_type: string
          source_type?: string
          started_at?: string | null
          structured_status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          condition_note?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          general_note?: string | null
          id?: string
          raw_note?: string | null
          session_date?: string
          session_type?: string
          source_type?: string
          started_at?: string | null
          structured_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_working_sets: {
        Row: {
          assisted: boolean | null
          created_at: string | null
          display_name_snapshot: string | null
          distance_meters: number | null
          duration_seconds: number | null
          exercise_id: string | null
          id: string | null
          measurement_type: string | null
          raw_value_note: string | null
          reps: number | null
          rounds: number | null
          sequence_no: number | null
          session_date: string | null
          session_id: string | null
          session_item_id: string | null
          session_type: string | null
          set_no: number | null
          side: string | null
          success: boolean | null
          unclassified: boolean | null
          user_id: string | null
          volume_kg: number | null
          weight_basis: string | null
          weight_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_sets_session_item_id_fkey"
            columns: ["session_item_id"]
            isOneToOne: false
            referencedRelation: "session_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
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
  mybody: {
    Enums: {},
  },
} as const
