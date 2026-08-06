export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      db_metadata: {
        Row: {
          created_at: string;
          downloaded: boolean | null;
          game: Database['public']['Enums']['game'] | null;
          skipped: boolean | null;
          source: string;
          updated_at: string | null;
          uploaded: boolean | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          downloaded?: boolean | null;
          game?: Database['public']['Enums']['game'] | null;
          skipped?: boolean | null;
          source: string;
          updated_at?: string | null;
          uploaded?: boolean | null;
          version: string;
        };
        Update: {
          created_at?: string;
          downloaded?: boolean | null;
          game?: Database['public']['Enums']['game'] | null;
          skipped?: boolean | null;
          source?: string;
          updated_at?: string | null;
          uploaded?: boolean | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_attributes: {
        Row: {
          created_at: string;
          id: number;
          language: string;
          name: string | null;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          language: string;
          name?: string | null;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          language?: string;
          name?: string | null;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_card_frame_types: {
        Row: {
          created_at: string;
          id: number;
          language: string;
          name: string;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          language: string;
          name: string;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          language?: string;
          name?: string;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_card_relations: {
        Row: {
          card_id: number;
          created_at: string;
          language: string | null;
          relation_card_id: number;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          card_id?: number;
          created_at?: string;
          language?: string | null;
          relation_card_id: number;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          card_id?: number;
          created_at?: string;
          language?: string | null;
          relation_card_id?: number;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_card_treat: {
        Row: {
          card_id: number;
          language: string | null;
          treated_card_id: number;
          version: string;
        };
        Insert: {
          card_id: number;
          language?: string | null;
          treated_card_id: number;
          version: string;
        };
        Update: {
          card_id?: number;
          language?: string | null;
          treated_card_id?: number;
          version?: string;
        };
        Relationships: [];
      };
      neuron_card_types: {
        Row: {
          created_at: string;
          id: number;
          language: string;
          name: string | null;
          updated_at: string | null;
          version: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          language: string;
          name?: string | null;
          updated_at?: string | null;
          version?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          language?: string;
          name?: string | null;
          updated_at?: string | null;
          version?: string | null;
        };
        Relationships: [];
      };
      neuron_cards: {
        Row: {
          atk: number | null;
          attribute_id: number | null;
          created_at: string;
          def: number | null;
          effect_id: number | null;
          effect_text: string | null;
          frame_type_id: number | null;
          id: number;
          language: string;
          level: number | null;
          link_arrows: number | null;
          link_rating: number | null;
          name: string;
          pend_scale_l: number | null;
          pend_scale_r: number | null;
          pendulum_text: string | null;
          species_id: number | null;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          atk?: number | null;
          attribute_id?: number | null;
          created_at?: string;
          def?: number | null;
          effect_id?: number | null;
          effect_text?: string | null;
          frame_type_id?: number | null;
          id?: number;
          language: string;
          level?: number | null;
          link_arrows?: number | null;
          link_rating?: number | null;
          name: string;
          pend_scale_l?: number | null;
          pend_scale_r?: number | null;
          pendulum_text?: string | null;
          species_id?: number | null;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          atk?: number | null;
          attribute_id?: number | null;
          created_at?: string;
          def?: number | null;
          effect_id?: number | null;
          effect_text?: string | null;
          frame_type_id?: number | null;
          id?: number;
          language?: string;
          level?: number | null;
          link_arrows?: number | null;
          link_rating?: number | null;
          name?: string;
          pend_scale_l?: number | null;
          pend_scale_r?: number | null;
          pendulum_text?: string | null;
          species_id?: number | null;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_cardsets: {
        Row: {
          card_id: number;
          card_image_id: number;
          card_number: string;
          created_at: string;
          language: string;
          pack_id: number;
          rarity_id: number;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          card_id: number;
          card_image_id: number;
          card_number: string;
          created_at?: string;
          language: string;
          pack_id: number;
          rarity_id: number;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          card_id?: number;
          card_image_id?: number;
          card_number?: string;
          created_at?: string;
          language?: string;
          pack_id?: number;
          rarity_id?: number;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_complex_frame_types: {
        Row: {
          created_at: string;
          id: number;
          language: string;
          name: string;
          subtype_1: number | null;
          subtype_2: number | null;
          subtype_3: number | null;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          language: string;
          name: string;
          subtype_1?: number | null;
          subtype_2?: number | null;
          subtype_3?: number | null;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          language?: string;
          name?: string;
          subtype_1?: number | null;
          subtype_2?: number | null;
          subtype_3?: number | null;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_monster_types: {
        Row: {
          created_at: string;
          id: number;
          language: string;
          name: string | null;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          language: string;
          name?: string | null;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          language?: string;
          name?: string | null;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_pack_class: {
        Row: {
          created_at: string;
          id: number;
          language: string;
          name: string;
          sort: number | null;
          unit_type: number | null;
          version: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          language: string;
          name: string;
          sort?: number | null;
          unit_type?: number | null;
          version?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          language?: string;
          name?: string;
          sort?: number | null;
          unit_type?: number | null;
          version?: string | null;
        };
        Relationships: [];
      };
      neuron_packs: {
        Row: {
          created_at: string;
          id: number;
          language: string;
          name: string;
          set_code: string;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          language: string;
          name: string;
          set_code: string;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          language?: string;
          name?: string;
          set_code?: string;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_rarities: {
        Row: {
          background_color: string;
          color: string;
          created_at: string;
          id: number;
          language: string;
          name: string;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          background_color: string;
          color: string;
          created_at?: string;
          id?: number;
          language: string;
          name: string;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          background_color?: string;
          color?: string;
          created_at?: string;
          id?: number;
          language?: string;
          name?: string;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      neuron_spelltrap_types: {
        Row: {
          created_at: string;
          icon: string | null;
          icon_display_flag: boolean | null;
          id: number;
          language: string;
          magic: boolean | null;
          name: string;
          sort: number | null;
          trap: boolean | null;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          icon_display_flag?: boolean | null;
          id?: number;
          language: string;
          magic?: boolean | null;
          name: string;
          sort?: number | null;
          trap?: boolean | null;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          icon_display_flag?: boolean | null;
          id?: number;
          language?: string;
          magic?: boolean | null;
          name?: string;
          sort?: number | null;
          trap?: boolean | null;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      ygoprodeck_archetypes: {
        Row: {
          created_at: string;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ygoprodeck_cards: {
        Row: {
          atk: number | null;
          attribute: string | null;
          banlistinfo: Json | null;
          cardimages: Json | null;
          cardsets: Json | null;
          created_at: string;
          def: number | null;
          desc: string | null;
          frametype: string | null;
          id: number;
          level: number | null;
          linkarrows: string | null;
          linkrating: number | null;
          miscinfo: Json | null;
          name: string | null;
          race: string | null;
          scale: number | null;
          type: string | null;
        };
        Insert: {
          atk?: number | null;
          attribute?: string | null;
          banlistinfo?: Json | null;
          cardimages?: Json | null;
          cardsets?: Json | null;
          created_at?: string;
          def?: number | null;
          desc?: string | null;
          frametype?: string | null;
          id?: number;
          level?: number | null;
          linkarrows?: string | null;
          linkrating?: number | null;
          miscinfo?: Json | null;
          name?: string | null;
          race?: string | null;
          scale?: number | null;
          type?: string | null;
        };
        Update: {
          atk?: number | null;
          attribute?: string | null;
          banlistinfo?: Json | null;
          cardimages?: Json | null;
          cardsets?: Json | null;
          created_at?: string;
          def?: number | null;
          desc?: string | null;
          frametype?: string | null;
          id?: number;
          level?: number | null;
          linkarrows?: string | null;
          linkrating?: number | null;
          miscinfo?: Json | null;
          name?: string | null;
          race?: string | null;
          scale?: number | null;
          type?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_cards_with_special_chars: {
        Args: never;
        Returns: {
          id: number;
          name: string;
        }[];
      };
      search_cards: {
        Args: { card_name: string };
        Returns: {
          avg_similarity: number;
          effect_text: string;
          id: number;
          language: string;
          name: string;
          strict_similarity: number;
          word_dist: number;
          word_similarity: number;
        }[];
      };
    };
    Enums: {
      game: 'TCG' | 'OCG' | 'Rush';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

export type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      game: ['TCG', 'OCG', 'Rush'],
    },
  },
} as const;
