import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let cachedClient: SupabaseClient<Database> | null = null;

export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurado");
  }

  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY no configurado");
  }

  cachedClient = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "linkedin-pro-portfolio/0.1.0",
      },
    },
  });

  return cachedClient;
}
