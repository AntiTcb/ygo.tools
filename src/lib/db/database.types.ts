export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      card_archetype_rules: {
        Row: {
          archetype: string;
          match: Database['public']['Enums']['card_archetype_match'];
          note: string | null;
          updated_at: string;
        };
        Insert: {
          archetype: string;
          match: Database['public']['Enums']['card_archetype_match'];
          note?: string | null;
          updated_at?: string;
        };
        Update: {
          archetype?: string;
          match?: Database['public']['Enums']['card_archetype_match'];
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      card_archetypes: {
        Row: {
          archetype: string;
          card_id: number;
          created_at: string;
          source: Database['public']['Enums']['card_archetype_source'];
        };
        Insert: {
          archetype: string;
          card_id: number;
          created_at?: string;
          source: Database['public']['Enums']['card_archetype_source'];
        };
        Update: {
          archetype?: string;
          card_id?: number;
          created_at?: string;
          source?: Database['public']['Enums']['card_archetype_source'];
        };
        Relationships: [];
      };
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
      effect_actions: {
        Row: {
          card_id: number;
          context_note: string | null;
          contextual: boolean;
          effect_id: number;
          from_side: Database['public']['Enums']['effect_side'] | null;
          from_zones: number[];
          id: number;
          is_cost: boolean;
          is_self: boolean;
          name_refs: number[];
          quantity: number | null;
          seq: number;
          stat: Database['public']['Enums']['effect_stat'] | null;
          stat_amount: number | null;
          stat_amount_note: string | null;
          stat_mode: Database['public']['Enums']['effect_stat_mode'] | null;
          target: Json | null;
          target_rule: Json | null;
          to_side: Database['public']['Enums']['effect_side'] | null;
          to_zones: number[];
          unresolved_name_refs: string[];
          verb_id: number;
        };
        Insert: {
          card_id: number;
          context_note?: string | null;
          contextual?: boolean;
          effect_id: number;
          from_side?: Database['public']['Enums']['effect_side'] | null;
          from_zones?: number[];
          id?: never;
          is_cost?: boolean;
          is_self?: boolean;
          name_refs?: number[];
          quantity?: number | null;
          seq: number;
          stat?: Database['public']['Enums']['effect_stat'] | null;
          stat_amount?: number | null;
          stat_amount_note?: string | null;
          stat_mode?: Database['public']['Enums']['effect_stat_mode'] | null;
          target?: Json | null;
          target_rule?: Json | null;
          to_side?: Database['public']['Enums']['effect_side'] | null;
          to_zones?: number[];
          unresolved_name_refs?: string[];
          verb_id: number;
        };
        Update: {
          card_id?: number;
          context_note?: string | null;
          contextual?: boolean;
          effect_id?: number;
          from_side?: Database['public']['Enums']['effect_side'] | null;
          from_zones?: number[];
          id?: never;
          is_cost?: boolean;
          is_self?: boolean;
          name_refs?: number[];
          quantity?: number | null;
          seq?: number;
          stat?: Database['public']['Enums']['effect_stat'] | null;
          stat_amount?: number | null;
          stat_amount_note?: string | null;
          stat_mode?: Database['public']['Enums']['effect_stat_mode'] | null;
          target?: Json | null;
          target_rule?: Json | null;
          to_side?: Database['public']['Enums']['effect_side'] | null;
          to_zones?: number[];
          unresolved_name_refs?: string[];
          verb_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'effect_actions_effect_id_fkey';
            columns: ['effect_id'];
            referencedRelation: 'effect_effects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'effect_actions_verb_id_fkey';
            columns: ['verb_id'];
            referencedRelation: 'effect_vocab_verbs';
            referencedColumns: ['id'];
          },
        ];
      };
      effect_card_tags: {
        Row: {
          card_id: number;
          locked: boolean;
          model: string | null;
          output: Json | null;
          pending_draft: Json | null;
          pending_text_hash: string | null;
          prompt_version: string | null;
          source: string;
          tagged_at: string;
          text_hash: string;
        };
        Insert: {
          card_id: number;
          locked?: boolean;
          model?: string | null;
          output?: Json | null;
          pending_draft?: Json | null;
          pending_text_hash?: string | null;
          prompt_version?: string | null;
          source?: string;
          tagged_at?: string;
          text_hash: string;
        };
        Update: {
          card_id?: number;
          locked?: boolean;
          model?: string | null;
          output?: Json | null;
          pending_draft?: Json | null;
          pending_text_hash?: string | null;
          prompt_version?: string | null;
          source?: string;
          tagged_at?: string;
          text_hash?: string;
        };
        Relationships: [];
      };
      effect_effects: {
        Row: {
          card_id: number;
          effect_index: number;
          effect_type: Database['public']['Enums']['effect_type'];
          id: number;
          opt: Database['public']['Enums']['effect_opt'];
          phase_restriction: Database['public']['Enums']['effect_phase'][];
          snippet: string;
          text_source: Database['public']['Enums']['effect_text_source'];
          turn_restriction: Database['public']['Enums']['effect_turn'];
        };
        Insert: {
          card_id: number;
          effect_index: number;
          effect_type: Database['public']['Enums']['effect_type'];
          id?: never;
          opt?: Database['public']['Enums']['effect_opt'];
          phase_restriction?: Database['public']['Enums']['effect_phase'][];
          snippet: string;
          text_source?: Database['public']['Enums']['effect_text_source'];
          turn_restriction?: Database['public']['Enums']['effect_turn'];
        };
        Update: {
          card_id?: number;
          effect_index?: number;
          effect_type?: Database['public']['Enums']['effect_type'];
          id?: never;
          opt?: Database['public']['Enums']['effect_opt'];
          phase_restriction?: Database['public']['Enums']['effect_phase'][];
          snippet?: string;
          text_source?: Database['public']['Enums']['effect_text_source'];
          turn_restriction?: Database['public']['Enums']['effect_turn'];
        };
        Relationships: [
          {
            foreignKeyName: 'effect_effects_card_id_fkey';
            columns: ['card_id'];
            referencedRelation: 'effect_card_tags';
            referencedColumns: ['card_id'];
          },
        ];
      };
      effect_gold_cards: {
        Row: {
          card_id: number;
          created_at: string;
          expected: Json;
          notes: string | null;
          text_hash: string;
          updated_at: string;
        };
        Insert: {
          card_id: number;
          created_at?: string;
          expected: Json;
          notes?: string | null;
          text_hash: string;
          updated_at?: string;
        };
        Update: {
          card_id?: number;
          created_at?: string;
          expected?: Json;
          notes?: string | null;
          text_hash?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      effect_tag_runs: {
        Row: {
          cards_done: number;
          cards_failed: number;
          cards_total: number;
          error: string | null;
          finished_at: string | null;
          id: number;
          kind: Database['public']['Enums']['effect_tag_run_kind'];
          model: string | null;
          prompt_version: string | null;
          source: string | null;
          started_at: string;
          status: Database['public']['Enums']['effect_tag_run_status'];
          version: string | null;
          workflow_instance_id: string | null;
        };
        Insert: {
          cards_done?: number;
          cards_failed?: number;
          cards_total?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: never;
          kind: Database['public']['Enums']['effect_tag_run_kind'];
          model?: string | null;
          prompt_version?: string | null;
          source?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['effect_tag_run_status'];
          version?: string | null;
          workflow_instance_id?: string | null;
        };
        Update: {
          cards_done?: number;
          cards_failed?: number;
          cards_total?: number;
          error?: string | null;
          finished_at?: string | null;
          id?: never;
          kind?: Database['public']['Enums']['effect_tag_run_kind'];
          model?: string | null;
          prompt_version?: string | null;
          source?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['effect_tag_run_status'];
          version?: string | null;
          workflow_instance_id?: string | null;
        };
        Relationships: [];
      };
      effect_triggers: {
        Row: {
          card_id: number;
          cause: Database['public']['Enums']['effect_trigger_cause'] | null;
          cause_card: Json | null;
          cause_card_rule: Json | null;
          cause_side: Database['public']['Enums']['effect_side'] | null;
          effect_id: number;
          event_verb_id: number;
          from_zones: number[];
          id: number;
          subject: Json | null;
          subject_is_self: boolean;
          subject_rule: Json | null;
          subject_side: Database['public']['Enums']['effect_side'] | null;
        };
        Insert: {
          card_id: number;
          cause?: Database['public']['Enums']['effect_trigger_cause'] | null;
          cause_card?: Json | null;
          cause_card_rule?: Json | null;
          cause_side?: Database['public']['Enums']['effect_side'] | null;
          effect_id: number;
          event_verb_id: number;
          from_zones?: number[];
          id?: never;
          subject?: Json | null;
          subject_is_self?: boolean;
          subject_rule?: Json | null;
          subject_side?: Database['public']['Enums']['effect_side'] | null;
        };
        Update: {
          card_id?: number;
          cause?: Database['public']['Enums']['effect_trigger_cause'] | null;
          cause_card?: Json | null;
          cause_card_rule?: Json | null;
          cause_side?: Database['public']['Enums']['effect_side'] | null;
          effect_id?: number;
          event_verb_id?: number;
          from_zones?: number[];
          id?: never;
          subject?: Json | null;
          subject_is_self?: boolean;
          subject_rule?: Json | null;
          subject_side?: Database['public']['Enums']['effect_side'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'effect_triggers_effect_id_fkey';
            columns: ['effect_id'];
            referencedRelation: 'effect_effects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'effect_triggers_event_verb_id_fkey';
            columns: ['event_verb_id'];
            referencedRelation: 'effect_vocab_verbs';
            referencedColumns: ['id'];
          },
        ];
      };
      effect_vocab_suggestions: {
        Row: {
          as_action: boolean;
          as_event: boolean;
          cluster_key: string | null;
          created_at: string;
          description: string | null;
          example_card_ids: number[];
          id: number;
          kind: Database['public']['Enums']['effect_vocab_kind'];
          merged_into_verb_id: number | null;
          merged_into_zone_id: number | null;
          occurrences: number;
          phrases: string[];
          proposed_term: string;
          reviewed_at: string | null;
          status: Database['public']['Enums']['effect_suggestion_status'];
          updated_at: string;
        };
        Insert: {
          as_action?: boolean;
          as_event?: boolean;
          cluster_key?: string | null;
          created_at?: string;
          description?: string | null;
          example_card_ids?: number[];
          id?: never;
          kind: Database['public']['Enums']['effect_vocab_kind'];
          merged_into_verb_id?: number | null;
          merged_into_zone_id?: number | null;
          occurrences?: number;
          phrases?: string[];
          proposed_term: string;
          reviewed_at?: string | null;
          status?: Database['public']['Enums']['effect_suggestion_status'];
          updated_at?: string;
        };
        Update: {
          as_action?: boolean;
          as_event?: boolean;
          cluster_key?: string | null;
          created_at?: string;
          description?: string | null;
          example_card_ids?: number[];
          id?: never;
          kind?: Database['public']['Enums']['effect_vocab_kind'];
          merged_into_verb_id?: number | null;
          merged_into_zone_id?: number | null;
          occurrences?: number;
          phrases?: string[];
          proposed_term?: string;
          reviewed_at?: string | null;
          status?: Database['public']['Enums']['effect_suggestion_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'effect_vocab_suggestions_merged_into_verb_id_fkey';
            columns: ['merged_into_verb_id'];
            referencedRelation: 'effect_vocab_verbs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'effect_vocab_suggestions_merged_into_zone_id_fkey';
            columns: ['merged_into_zone_id'];
            referencedRelation: 'effect_vocab_zones';
            referencedColumns: ['id'];
          },
        ];
      };
      effect_vocab_verbs: {
        Row: {
          created_at: string;
          description: string;
          id: number;
          replaced_by: number | null;
          retired_at: string | null;
          term: string;
          updated_at: string;
          usable_as_action: boolean;
          usable_as_event: boolean;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: never;
          replaced_by?: number | null;
          retired_at?: string | null;
          term: string;
          updated_at?: string;
          usable_as_action?: boolean;
          usable_as_event?: boolean;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: never;
          replaced_by?: number | null;
          retired_at?: string | null;
          term?: string;
          updated_at?: string;
          usable_as_action?: boolean;
          usable_as_event?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'effect_vocab_verbs_replaced_by_fkey';
            columns: ['replaced_by'];
            referencedRelation: 'effect_vocab_verbs';
            referencedColumns: ['id'];
          },
        ];
      };
      effect_vocab_zones: {
        Row: {
          created_at: string;
          description: string;
          id: number;
          replaced_by: number | null;
          retired_at: string | null;
          term: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: never;
          replaced_by?: number | null;
          retired_at?: string | null;
          term: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: never;
          replaced_by?: number | null;
          retired_at?: string | null;
          term?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'effect_vocab_zones_replaced_by_fkey';
            columns: ['replaced_by'];
            referencedRelation: 'effect_vocab_zones';
            referencedColumns: ['id'];
          },
        ];
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
      neuron_regulation_cards: {
        Row: {
          apply_time_end: string | null;
          apply_time_start: string | null;
          available_num: number | null;
          available_num_pre: number | null;
          available_num_team: number | null;
          available_num_team_pre: number | null;
          card_id: number;
          forbidden_limited_type: number | null;
          has_point: boolean;
          point: number | null;
          point_pre: number | null;
          region: string;
          regulation_id: string;
          renewal_type: number | null;
        };
        Insert: {
          apply_time_end?: string | null;
          apply_time_start?: string | null;
          available_num?: number | null;
          available_num_pre?: number | null;
          available_num_team?: number | null;
          available_num_team_pre?: number | null;
          card_id: number;
          forbidden_limited_type?: number | null;
          has_point?: boolean;
          point?: number | null;
          point_pre?: number | null;
          region: string;
          regulation_id: string;
          renewal_type?: number | null;
        };
        Update: {
          apply_time_end?: string | null;
          apply_time_start?: string | null;
          available_num?: number | null;
          available_num_pre?: number | null;
          available_num_team?: number | null;
          available_num_team_pre?: number | null;
          card_id?: number;
          forbidden_limited_type?: number | null;
          has_point?: boolean;
          point?: number | null;
          point_pre?: number | null;
          region?: string;
          regulation_id?: string;
          renewal_type?: number | null;
        };
        Relationships: [];
      };
      neuron_regulation_changes: {
        Row: {
          card_id: number | null;
          card_name: string | null;
          change_type: string;
          detected_at: string;
          field: string | null;
          id: number;
          new_value: string | null;
          old_value: string | null;
          region: string;
          regulation_id: string;
          regulation_name: string;
          run_id: string;
        };
        Insert: {
          card_id?: number | null;
          card_name?: string | null;
          change_type: string;
          detected_at?: string;
          field?: string | null;
          id?: never;
          new_value?: string | null;
          old_value?: string | null;
          region: string;
          regulation_id: string;
          regulation_name: string;
          run_id: string;
        };
        Update: {
          card_id?: number | null;
          card_name?: string | null;
          change_type?: string;
          detected_at?: string;
          field?: string | null;
          id?: never;
          new_value?: string | null;
          old_value?: string | null;
          region?: string;
          regulation_id?: string;
          regulation_name?: string;
          run_id?: string;
        };
        Relationships: [];
      };
      neuron_regulations: {
        Row: {
          apply_nation_code: string | null;
          apply_nation_group_code: string;
          apply_time_end: string | null;
          apply_time_start: string | null;
          card_count: number;
          cards_hash: string;
          first_seen_at: string;
          game: string;
          language: string;
          meta_hash: string;
          name: string;
          note: string | null;
          raw: Json;
          region: string;
          regulation_id: string;
          regulation_type: string;
          release_time_end: string | null;
          release_time_start: string | null;
          removed_at: string | null;
          status_hash: string | null;
          target_nations: string[];
          updated_at: string;
        };
        Insert: {
          apply_nation_code?: string | null;
          apply_nation_group_code: string;
          apply_time_end?: string | null;
          apply_time_start?: string | null;
          card_count?: number;
          cards_hash: string;
          first_seen_at?: string;
          game: string;
          language: string;
          meta_hash: string;
          name: string;
          note?: string | null;
          raw?: Json;
          region: string;
          regulation_id: string;
          regulation_type: string;
          release_time_end?: string | null;
          release_time_start?: string | null;
          removed_at?: string | null;
          status_hash?: string | null;
          target_nations?: string[];
          updated_at?: string;
        };
        Update: {
          apply_nation_code?: string | null;
          apply_nation_group_code?: string;
          apply_time_end?: string | null;
          apply_time_start?: string | null;
          card_count?: number;
          cards_hash?: string;
          first_seen_at?: string;
          game?: string;
          language?: string;
          meta_hash?: string;
          name?: string;
          note?: string | null;
          raw?: Json;
          region?: string;
          regulation_id?: string;
          regulation_type?: string;
          release_time_end?: string | null;
          release_time_start?: string | null;
          removed_at?: string | null;
          status_hash?: string | null;
          target_nations?: string[];
          updated_at?: string;
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
          magic: number | null;
          name: string;
          sort: number | null;
          trap: number | null;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          icon_display_flag?: boolean | null;
          id?: number;
          language: string;
          magic?: number | null;
          name: string;
          sort?: number | null;
          trap?: number | null;
          updated_at?: string | null;
          version: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          icon_display_flag?: boolean | null;
          id?: number;
          language?: string;
          magic?: number | null;
          name?: string;
          sort?: number | null;
          trap?: number | null;
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
      card_archetypes_unconfirmed: {
        Row: {
          archetype: string | null;
          card_id: number | null;
        };
        Insert: {
          archetype?: string | null;
          card_id?: number | null;
        };
        Update: {
          archetype?: string | null;
          card_id?: number | null;
        };
        Relationships: [];
      };
      effect_tag_queue: {
        Row: {
          card_id: number | null;
          locked: boolean | null;
          never_tagged: boolean | null;
          text_hash: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      archetype_name_matches: {
        Args: {
          card_name: string;
          archetype: string;
          mode: Database['public']['Enums']['card_archetype_match'];
        };
        Returns: boolean;
      };
      effect_assert_zone_ids: {
        Args: {
          zone_ids: number[];
        };
        Returns: undefined;
      };
      effect_record_suggestions: {
        Args: {
          p_card_id: number;
          p_items: Json;
        };
        Returns: undefined;
      };
      effect_store_card_tags: {
        Args: {
          p_card_id: number;
          p_output: Json;
          p_rows: Json;
          p_model: string;
          p_prompt_version: string;
          p_mode: string;
          p_text_hash?: string;
        };
        Returns: string;
      };
      effect_zone_ids: {
        Args: {
          terms: Json;
        };
        Returns: number[];
      };
      get_cards_with_special_chars: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: number;
          name: string;
        }[];
      };
      refresh_card_archetypes: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      search_cards: {
        Args: {
          card_name: string;
        };
        Returns: {
          id: number;
          name: string;
          language: string;
          effect_text: string;
          word_similarity: number;
          strict_similarity: number;
          word_dist: number;
          avg_similarity: number;
        }[];
      };
    };
    Enums: {
      card_archetype_match: 'word_start' | 'word' | 'substring' | 'off';
      card_archetype_source: 'name' | 'relations' | 'treated_text' | 'treat_table' | 'manual';
      effect_opt: 'none' | 'soft' | 'hard' | 'per_name_activation' | 'shared_each_effect';
      effect_phase: 'draw' | 'standby' | 'main' | 'battle' | 'damage_step' | 'end';
      effect_side: 'you' | 'opponent' | 'either';
      effect_stat: 'atk' | 'def' | 'level' | 'rank';
      effect_stat_mode: 'gain' | 'lose' | 'set' | 'halve' | 'double';
      effect_suggestion_status: 'pending' | 'approved' | 'rejected' | 'merged';
      effect_tag_run_kind: 'import' | 'vocab' | 'manual' | 'backfill';
      effect_tag_run_status: 'running' | 'completed' | 'failed';
      effect_text_source: 'card' | 'pendulum';
      effect_trigger_cause: 'cost' | 'effect' | 'battle' | 'material';
      effect_turn: 'any' | 'yours' | 'opponents';
      effect_type: 'ignition' | 'trigger' | 'quick' | 'continuous' | 'activation' | 'procedure';
      effect_vocab_kind: 'verb' | 'zone';
      game: 'TCG' | 'OCG' | 'Rush';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views']) | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] & Database[PublicTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] & Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends (PublicEnumNameOrOptions extends { schema: keyof Database } ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums'] : never) =
    never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes'] | { schema: keyof Database },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
    ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;
