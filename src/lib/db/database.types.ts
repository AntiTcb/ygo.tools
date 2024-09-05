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
      db_metadata: {
        Row: {
          created_at: string | null
          downloaded: boolean
          game: Database["public"]["Enums"]["game"] | null
          skipped: boolean
          source: string
          updated_at: string | null
          uploaded: boolean
          version: string
        }
        Insert: {
          created_at?: string | null
          downloaded?: boolean
          game?: Database["public"]["Enums"]["game"] | null
          skipped?: boolean
          source: string
          updated_at?: string | null
          uploaded?: boolean
          version: string
        }
        Update: {
          created_at?: string | null
          downloaded?: boolean
          game?: Database["public"]["Enums"]["game"] | null
          skipped?: boolean
          source?: string
          updated_at?: string | null
          uploaded?: boolean
          version?: string
        }
        Relationships: []
      }
      neuron_attributes: {
        Row: {
          created_at: string
          id: number
          language: string
          name: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: number
          language: string
          name?: string | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string
          name?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_card_frame_types: {
        Row: {
          created_at: string
          id: number
          language: string
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: number
          language: string
          name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_card_relations: {
        Row: {
          card_id: number
          created_at: string
          language: string | null
          relation_card_id: number
          updated_at: string | null
          version: string
        }
        Insert: {
          card_id: number
          created_at?: string
          language?: string | null
          relation_card_id: number
          updated_at?: string | null
          version: string
        }
        Update: {
          card_id?: number
          created_at?: string
          language?: string | null
          relation_card_id?: number
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_card_types: {
        Row: {
          created_at: string
          id: number
          language: string
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: number
          language: string
          name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_cards: {
        Row: {
          atk: number | null
          attribute_id: number | null
          created_at: string
          def: number | null
          effect_id: number | null
          effect_text: string | null
          frame_type_id: number | null
          id: number
          language: string
          level: number | null
          link_arrows: number | null
          link_rating: number | null
          name: string
          pend_scale_l: number | null
          pend_scale_r: number | null
          pendulum_text: string | null
          species_id: number | null
          updated_at: string | null
          version: string
        }
        Insert: {
          atk?: number | null
          attribute_id?: number | null
          created_at?: string
          def?: number | null
          effect_id?: number | null
          effect_text?: string | null
          frame_type_id?: number | null
          id?: number
          language: string
          level?: number | null
          link_arrows?: number | null
          link_rating?: number | null
          name: string
          pend_scale_l?: number | null
          pend_scale_r?: number | null
          pendulum_text?: string | null
          species_id?: number | null
          updated_at?: string | null
          version: string
        }
        Update: {
          atk?: number | null
          attribute_id?: number | null
          created_at?: string
          def?: number | null
          effect_id?: number | null
          effect_text?: string | null
          frame_type_id?: number | null
          id?: number
          language?: string
          level?: number | null
          link_arrows?: number | null
          link_rating?: number | null
          name?: string
          pend_scale_l?: number | null
          pend_scale_r?: number | null
          pendulum_text?: string | null
          species_id?: number | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_cardsets: {
        Row: {
          card_id: number
          card_image_id: number
          card_number: string
          created_at: string
          language: string
          pack_id: string
          rarity_id: number
          updated_at: string | null
          version: string
        }
        Insert: {
          card_id: number
          card_image_id: number
          card_number: string
          created_at?: string
          language: string
          pack_id: string
          rarity_id: number
          updated_at?: string | null
          version: string
        }
        Update: {
          card_id?: number
          card_image_id?: number
          card_number?: string
          created_at?: string
          language?: string
          pack_id?: string
          rarity_id?: number
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_complex_frame_types: {
        Row: {
          created_at: string
          id: number
          language: string
          name: string
          subtype_1: number | null
          subtype_2: number | null
          subtype_3: number | null
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: number
          language: string
          name: string
          subtype_1?: number | null
          subtype_2?: number | null
          subtype_3?: number | null
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string
          name?: string
          subtype_1?: number | null
          subtype_2?: number | null
          subtype_3?: number | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_monster_types: {
        Row: {
          created_at: string
          id: number
          language: string
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: number
          language: string
          name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_packs: {
        Row: {
          created_at: string
          id: string
          language: string
          name: string
          set_code: string
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id: string
          language: string
          name: string
          set_code: string
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          name?: string
          set_code?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_rarities: {
        Row: {
          background_color: string
          color: string
          created_at: string
          id: number
          language: string
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          background_color: string
          color: string
          created_at?: string
          id?: number
          language: string
          name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          background_color?: string
          color?: string
          created_at?: string
          id?: number
          language?: string
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      neuron_spelltrap_types: {
        Row: {
          created_at: string
          id: number
          language: string
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: number
          language: string
          name: string
          updated_at?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: number
          language?: string
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      ygoprodeck_archetypes: {
        Row: {
          created_at: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ygoprodeck_cards: {
        Row: {
          atk: number | null
          attribute: string | null
          banlistinfo: Json | null
          cardimages: Json | null
          cardsets: Json | null
          created_at: string | null
          def: number | null
          desc: string | null
          frametype: string | null
          id: number
          level: number | null
          linkarrows: string[] | null
          linkrating: number | null
          miscinfo: Json | null
          name: string | null
          race: string | null
          scale: number | null
          type: string | null
        }
        Insert: {
          atk?: number | null
          attribute?: string | null
          banlistinfo?: Json | null
          cardimages?: Json | null
          cardsets?: Json | null
          created_at?: string | null
          def?: number | null
          desc?: string | null
          frametype?: string | null
          id?: number
          level?: number | null
          linkarrows?: string[] | null
          linkrating?: number | null
          miscinfo?: Json | null
          name?: string | null
          race?: string | null
          scale?: number | null
          type?: string | null
        }
        Update: {
          atk?: number | null
          attribute?: string | null
          banlistinfo?: Json | null
          cardimages?: Json | null
          cardsets?: Json | null
          created_at?: string | null
          def?: number | null
          desc?: string | null
          frametype?: string | null
          id?: number
          level?: number | null
          linkarrows?: string[] | null
          linkrating?: number | null
          miscinfo?: Json | null
          name?: string | null
          race?: string | null
          scale?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_cards: {
        Args: {
          card_name: string
        }
        Returns: {
          id: number
          name: string
          language: string
          effect_text: string
          word_similarity: number
          strict_similarity: number
          word_dist: number
          avg_similarity: number
        }[]
      }
    }
    Enums: {
      game: "TCG" | "OCG" | "Rush"
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
