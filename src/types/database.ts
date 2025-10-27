export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          username: string;
          slug: string;
          email: string | null;
          profile_json: Json | null;
          pdf_raw: string | null;
          profile_html: string | null;
          last_enriched_at: string | null;
          last_rendered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          username: string;
          slug: string;
          email?: string | null;
          profile_json?: Json | null;
          pdf_raw?: string | null;
          profile_html?: string | null;
          last_enriched_at?: string | null;
          last_rendered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          username?: string;
          slug?: string;
          email?: string | null;
          profile_json?: Json | null;
          pdf_raw?: string | null;
          profile_html?: string | null;
          last_enriched_at?: string | null;
          last_rendered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
