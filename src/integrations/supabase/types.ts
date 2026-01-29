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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      consent_forms: {
        Row: {
          consent_template_id: string
          id: string
          pdf_url: string | null
          signature_url: string
          signed_date: string
          treatment_id: string
          visit_id: string
        }
        Insert: {
          consent_template_id: string
          id?: string
          pdf_url?: string | null
          signature_url: string
          signed_date?: string
          treatment_id: string
          visit_id: string
        }
        Update: {
          consent_template_id?: string
          id?: string
          pdf_url?: string | null
          signature_url?: string
          signed_date?: string
          treatment_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_forms_consent_template_id_fkey"
            columns: ["consent_template_id"]
            isOneToOne: false
            referencedRelation: "consent_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_forms_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_forms_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_templates: {
        Row: {
          consent_text: string
          created_date: string
          form_name: string
          id: string
          is_current_version: boolean
          last_updated: string
          status: Database["public"]["Enums"]["consent_status"]
          treatment_id: string | null
          version_number: number
        }
        Insert: {
          consent_text: string
          created_date?: string
          form_name: string
          id?: string
          is_current_version?: boolean
          last_updated?: string
          status?: Database["public"]["Enums"]["consent_status"]
          treatment_id?: string | null
          version_number?: number
        }
        Update: {
          consent_text?: string
          created_date?: string
          form_name?: string
          id?: string
          is_current_version?: boolean
          last_updated?: string
          status?: Database["public"]["Enums"]["consent_status"]
          treatment_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_templates_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_by: string | null
          expiry_date: string | null
          id: string
          patient_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          purchase_date: string
          sessions_purchased: number
          sessions_remaining: number
          status: Database["public"]["Enums"]["package_status"]
          treatment_id: string
        }
        Insert: {
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          patient_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          purchase_date?: string
          sessions_purchased: number
          sessions_remaining: number
          status?: Database["public"]["Enums"]["package_status"]
          treatment_id: string
        }
        Update: {
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          patient_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          purchase_date?: string
          sessions_purchased?: number
          sessions_remaining?: number
          status?: Database["public"]["Enums"]["package_status"]
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          date_of_birth: string
          email: string
          emirates_id: string | null
          full_name: string
          id: string
          phone_number: string
          registration_date: string
          registration_signature_url: string | null
          status: Database["public"]["Enums"]["patient_status"]
        }
        Insert: {
          address?: string | null
          date_of_birth: string
          email: string
          emirates_id?: string | null
          full_name: string
          id?: string
          phone_number: string
          registration_date?: string
          registration_signature_url?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
        }
        Update: {
          address?: string | null
          date_of_birth?: string
          email?: string
          emirates_id?: string | null
          full_name?: string
          id?: string
          phone_number?: string
          registration_date?: string
          registration_signature_url?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_date: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
          user_id: string
        }
        Insert: {
          created_date?: string
          email: string
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          user_id: string
        }
        Update: {
          created_date?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          user_id?: string
        }
        Relationships: []
      }
      treatments: {
        Row: {
          administration_method: string | null
          category: string
          common_doses: Json | null
          consent_template_id: string | null
          created_date: string
          dosage_unit: Database["public"]["Enums"]["dosage_unit"]
          id: string
          status: Database["public"]["Enums"]["treatment_status"]
          treatment_name: string
        }
        Insert: {
          administration_method?: string | null
          category: string
          common_doses?: Json | null
          consent_template_id?: string | null
          created_date?: string
          dosage_unit?: Database["public"]["Enums"]["dosage_unit"]
          id?: string
          status?: Database["public"]["Enums"]["treatment_status"]
          treatment_name: string
        }
        Update: {
          administration_method?: string | null
          category?: string
          common_doses?: Json | null
          consent_template_id?: string | null
          created_date?: string
          dosage_unit?: Database["public"]["Enums"]["dosage_unit"]
          id?: string
          status?: Database["public"]["Enums"]["treatment_status"]
          treatment_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_consent_template"
            columns: ["consent_template_id"]
            isOneToOne: false
            referencedRelation: "consent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_treatments: {
        Row: {
          administration_details: string | null
          dose_administered: string
          dose_unit: string
          id: string
          package_id: string
          performed_by: string | null
          sessions_deducted: number
          timestamp: string
          treatment_id: string
          visit_id: string
        }
        Insert: {
          administration_details?: string | null
          dose_administered: string
          dose_unit: string
          id?: string
          package_id: string
          performed_by?: string | null
          sessions_deducted?: number
          timestamp?: string
          treatment_id: string
          visit_id: string
        }
        Update: {
          administration_details?: string | null
          dose_administered?: string
          dose_unit?: string
          id?: string
          package_id?: string
          performed_by?: string | null
          sessions_deducted?: number
          timestamp?: string
          treatment_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_treatments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_treatments_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_treatments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_treatments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          completed_date: string | null
          consent_signed: boolean
          created_date: string
          current_status: Database["public"]["Enums"]["visit_status"]
          doctor_notes: string | null
          doctor_staff_id: string | null
          heart_rate: number | null
          id: string
          is_locked: boolean
          nurse_staff_id: string | null
          patient_id: string
          reception_staff_id: string | null
          treatment_completed: boolean
          visit_date: string
          visit_number: number
          vitals_completed: boolean
          weight_kg: number | null
        }
        Insert: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          completed_date?: string | null
          consent_signed?: boolean
          created_date?: string
          current_status?: Database["public"]["Enums"]["visit_status"]
          doctor_notes?: string | null
          doctor_staff_id?: string | null
          heart_rate?: number | null
          id?: string
          is_locked?: boolean
          nurse_staff_id?: string | null
          patient_id: string
          reception_staff_id?: string | null
          treatment_completed?: boolean
          visit_date?: string
          visit_number: number
          vitals_completed?: boolean
          weight_kg?: number | null
        }
        Update: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          completed_date?: string | null
          consent_signed?: boolean
          created_date?: string
          current_status?: Database["public"]["Enums"]["visit_status"]
          doctor_notes?: string | null
          doctor_staff_id?: string | null
          heart_rate?: number | null
          id?: string
          is_locked?: boolean
          nurse_staff_id?: string | null
          patient_id?: string
          reception_staff_id?: string | null
          treatment_completed?: boolean
          visit_date?: string
          visit_number?: number
          vitals_completed?: boolean
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_doctor_staff_id_fkey"
            columns: ["doctor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_nurse_staff_id_fkey"
            columns: ["nurse_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_reception_staff_id_fkey"
            columns: ["reception_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals_config: {
        Row: {
          critical_alert_rule: Json | null
          display_order: number
          id: string
          input_type: Database["public"]["Enums"]["vital_input_type"]
          is_required: boolean
          status: Database["public"]["Enums"]["vital_status"]
          unit: string
          vital_name: string
          warning_alert_rule: Json | null
        }
        Insert: {
          critical_alert_rule?: Json | null
          display_order?: number
          id?: string
          input_type?: Database["public"]["Enums"]["vital_input_type"]
          is_required?: boolean
          status?: Database["public"]["Enums"]["vital_status"]
          unit: string
          vital_name: string
          warning_alert_rule?: Json | null
        }
        Update: {
          critical_alert_rule?: Json | null
          display_order?: number
          id?: string
          input_type?: Database["public"]["Enums"]["vital_input_type"]
          is_required?: boolean
          status?: Database["public"]["Enums"]["vital_status"]
          unit?: string
          vital_name?: string
          warning_alert_rule?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      is_active_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      consent_status: "active" | "inactive"
      dosage_unit: "mg" | "ml" | "Units" | "mcg" | "Session"
      package_status: "active" | "depleted" | "expired"
      patient_status: "active" | "inactive"
      payment_status: "paid" | "pending"
      staff_role: "admin" | "reception" | "nurse" | "doctor"
      staff_status: "active" | "inactive"
      treatment_status: "active" | "inactive"
      visit_status: "waiting" | "in_progress" | "completed"
      vital_input_type: "single" | "dual"
      vital_status: "active" | "inactive"
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
      consent_status: ["active", "inactive"],
      dosage_unit: ["mg", "ml", "Units", "mcg", "Session"],
      package_status: ["active", "depleted", "expired"],
      patient_status: ["active", "inactive"],
      payment_status: ["paid", "pending"],
      staff_role: ["admin", "reception", "nurse", "doctor"],
      staff_status: ["active", "inactive"],
      treatment_status: ["active", "inactive"],
      visit_status: ["waiting", "in_progress", "completed"],
      vital_input_type: ["single", "dual"],
      vital_status: ["active", "inactive"],
    },
  },
} as const
