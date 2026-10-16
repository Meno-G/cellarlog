// Mirrors supabase/migrations. Same shape as `supabase gen types typescript`,
// so it can be replaced by the generated file later.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      tanks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          volume_liters: number;
          variety: string | null;
          vintage: number | null;
          kind: Database['public']['Enums']['vessel_kind'];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          volume_liters: number;
          variety?: string | null;
          vintage?: number | null;
          kind?: Database['public']['Enums']['vessel_kind'];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          volume_liters?: number;
          variety?: string | null;
          vintage?: number | null;
          kind?: Database['public']['Enums']['vessel_kind'];
          created_at?: string;
        };
        Relationships: [];
      };
      ferments: {
        Row: {
          id: string;
          tank_id: string;
          user_id: string;
          name: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tank_id: string;
          user_id?: string;
          name: string;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tank_id?: string;
          user_id?: string;
          name?: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ferments_tank_id_fkey';
            columns: ['tank_id'];
            isOneToOne: false;
            referencedRelation: 'tanks';
            referencedColumns: ['id'];
          },
        ];
      };
      entries: {
        Row: {
          id: string;
          tank_id: string;
          user_id: string;
          type: Database['public']['Enums']['entry_type'];
          raw_text: string;
          parsed: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tank_id: string;
          user_id?: string;
          type: Database['public']['Enums']['entry_type'];
          raw_text: string;
          parsed: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tank_id?: string;
          user_id?: string;
          type?: Database['public']['Enums']['entry_type'];
          raw_text?: string;
          parsed?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entries_tank_id_fkey';
            columns: ['tank_id'];
            isOneToOne: false;
            referencedRelation: 'tanks';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      entry_type: 'addition' | 'temperature' | 'lab_analysis' | 'tasting' | 'transfer' | 'note' | 'decision';
      vessel_kind: 'tank' | 'qvevri' | 'barrel';
    };
    CompositeTypes: { [_ in never]: never };
  };
};
