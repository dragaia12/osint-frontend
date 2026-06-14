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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          resource: string | null
          resource_id: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      artefacts: {
        Row: {
          contenu: string
          created_at: string
          dossier_id: string
          id: string
          nom: string
          recherche_id: string | null
          taille_bytes: number
          type_artefact: Database["public"]["Enums"]["artifact_type"]
          user_id: string
        }
        Insert: {
          contenu: string
          created_at?: string
          dossier_id: string
          id?: string
          nom: string
          recherche_id?: string | null
          taille_bytes?: number
          type_artefact: Database["public"]["Enums"]["artifact_type"]
          user_id: string
        }
        Update: {
          contenu?: string
          created_at?: string
          dossier_id?: string
          id?: string
          nom?: string
          recherche_id?: string | null
          taille_bytes?: number
          type_artefact?: Database["public"]["Enums"]["artifact_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artefacts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artefacts_recherche_id_fkey"
            columns: ["recherche_id"]
            isOneToOne: false
            referencedRelation: "recherches"
            referencedColumns: ["id"]
          },
        ]
      }
      cache_modules: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          input_type: Database["public"]["Enums"]["entity_type"]
          query: string
          resultats: Json
          strategy: Database["public"]["Enums"]["search_strategy"]
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
          input_type: Database["public"]["Enums"]["entity_type"]
          query: string
          resultats: Json
          strategy: Database["public"]["Enums"]["search_strategy"]
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          input_type?: Database["public"]["Enums"]["entity_type"]
          query?: string
          resultats?: Json
          strategy?: Database["public"]["Enums"]["search_strategy"]
          user_id?: string
        }
        Relationships: []
      }
      dossiers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          statut: Database["public"]["Enums"]["dossier_statut"]
          tags: string[]
          titre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          statut?: Database["public"]["Enums"]["dossier_statut"]
          tags?: string[]
          titre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          statut?: Database["public"]["Enums"]["dossier_statut"]
          tags?: string[]
          titre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entites_trouvees: {
        Row: {
          created_at: string
          dossier_id: string
          id: string
          metadata: Json
          note: string | null
          platform: string | null
          recherche_id: string
          sources: string[]
          trust_level: Database["public"]["Enums"]["trust_level"]
          type_entite: Database["public"]["Enums"]["entity_type"]
          url: string | null
          user_id: string
          valeur: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          id?: string
          metadata?: Json
          note?: string | null
          platform?: string | null
          recherche_id: string
          sources?: string[]
          trust_level?: Database["public"]["Enums"]["trust_level"]
          type_entite: Database["public"]["Enums"]["entity_type"]
          url?: string | null
          user_id: string
          valeur: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          id?: string
          metadata?: Json
          note?: string | null
          platform?: string | null
          recherche_id?: string
          sources?: string[]
          trust_level?: Database["public"]["Enums"]["trust_level"]
          type_entite?: Database["public"]["Enums"]["entity_type"]
          url?: string | null
          user_id?: string
          valeur?: string
        }
        Relationships: [
          {
            foreignKeyName: "entites_trouvees_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entites_trouvees_recherche_id_fkey"
            columns: ["recherche_id"]
            isOneToOne: false
            referencedRelation: "recherches"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          contenu: string
          created_at: string
          dossier_id: string
          entite_id: string | null
          id: string
          recherche_id: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          contenu: string
          created_at?: string
          dossier_id: string
          entite_id?: string | null
          id?: string
          recherche_id?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          contenu?: string
          created_at?: string
          dossier_id?: string
          entite_id?: string | null
          id?: string
          recherche_id?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_entite_id_fkey"
            columns: ["entite_id"]
            isOneToOne: false
            referencedRelation: "entites_trouvees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_recherche_id_fkey"
            columns: ["recherche_id"]
            isOneToOne: false
            referencedRelation: "recherches"
            referencedColumns: ["id"]
          },
        ]
      }
      pivots: {
        Row: {
          confiance: number
          created_at: string
          dossier_id: string
          entite_cible_id: string
          entite_source_id: string
          id: string
          note: string | null
          type_pivot: Database["public"]["Enums"]["pivot_type"]
          user_id: string
        }
        Insert: {
          confiance?: number
          created_at?: string
          dossier_id: string
          entite_cible_id: string
          entite_source_id: string
          id?: string
          note?: string | null
          type_pivot: Database["public"]["Enums"]["pivot_type"]
          user_id: string
        }
        Update: {
          confiance?: number
          created_at?: string
          dossier_id?: string
          entite_cible_id?: string
          entite_source_id?: string
          id?: string
          note?: string | null
          type_pivot?: Database["public"]["Enums"]["pivot_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pivots_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pivots_entite_cible_id_fkey"
            columns: ["entite_cible_id"]
            isOneToOne: false
            referencedRelation: "entites_trouvees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pivots_entite_source_id_fkey"
            columns: ["entite_source_id"]
            isOneToOne: false
            referencedRelation: "entites_trouvees"
            referencedColumns: ["id"]
          },
        ]
      }
      recherches: {
        Row: {
          created_at: string
          dossier_id: string
          duree_ms: number | null
          id: string
          input_type: Database["public"]["Enums"]["entity_type"]
          nb_resultats: number
          query: string
          resultats_raw: Json | null
          statut: Database["public"]["Enums"]["search_status"]
          strategy: Database["public"]["Enums"]["search_strategy"]
          user_id: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          duree_ms?: number | null
          id?: string
          input_type: Database["public"]["Enums"]["entity_type"]
          nb_resultats?: number
          query: string
          resultats_raw?: Json | null
          statut?: Database["public"]["Enums"]["search_status"]
          strategy?: Database["public"]["Enums"]["search_strategy"]
          user_id: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          duree_ms?: number | null
          id?: string
          input_type?: Database["public"]["Enums"]["entity_type"]
          nb_resultats?: number
          query?: string
          resultats_raw?: Json | null
          statut?: Database["public"]["Enums"]["search_status"]
          strategy?: Database["public"]["Enums"]["search_strategy"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recherches_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_user_role: {
        Args: { p_email: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_admin_stats: { Args: never; Returns: Json }
      get_all_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          nb_dossiers: number
          nb_recherches: number
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      update_recherche_result: {
        Args: {
          p_duree_ms: number
          p_id: string
          p_nb_resultats: number
          p_resultats: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "administrateur" | "utilisateur"
      artifact_type: "json" | "csv" | "markdown" | "screenshot" | "report"
      dossier_statut: "actif" | "archivé" | "clos"
      entity_type:
        | "email"
        | "phone"
        | "ip"
        | "domain"
        | "username"
        | "url"
        | "hash"
        | "crypto"
        | "name"
        | "organization"
        | "social_profile"
        | "location"
        | "document"
        | "certificate"
      pivot_type:
        | "leads_to"
        | "related_to"
        | "part_of"
        | "same_as"
        | "source_of"
      search_status: "pending" | "running" | "done" | "error"
      search_strategy:
        | "balanced"
        | "deep"
        | "quick"
        | "social"
        | "infrastructure"
      trust_level: "VERIFIED" | "PROBABLE" | "CANDIDATE"
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
      app_role: ["administrateur", "utilisateur"],
      artifact_type: ["json", "csv", "markdown", "screenshot", "report"],
      dossier_statut: ["actif", "archivé", "clos"],
      entity_type: [
        "email",
        "phone",
        "ip",
        "domain",
        "username",
        "url",
        "hash",
        "crypto",
        "name",
        "organization",
        "social_profile",
        "location",
        "document",
        "certificate",
      ],
      pivot_type: ["leads_to", "related_to", "part_of", "same_as", "source_of"],
      search_status: ["pending", "running", "done", "error"],
      search_strategy: [
        "balanced",
        "deep",
        "quick",
        "social",
        "infrastructure",
      ],
      trust_level: ["VERIFIED", "PROBABLE", "CANDIDATE"],
    },
  },
} as const
