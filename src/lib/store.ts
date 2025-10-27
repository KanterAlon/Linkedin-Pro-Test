import type { Database, Json } from "@/types/database";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
type UserProfileInsert = Database["public"]["Tables"]["user_profiles"]["Insert"];
type UserProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"];

const RANDOM_SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function sanitizeUsername(username: string): string {
  return username.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
}

function randomSuffix(length = 6): string {
  let output = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * RANDOM_SUFFIX_ALPHABET.length);
    output += RANDOM_SUFFIX_ALPHABET.charAt(randomIndex);
  }
  return output;
}

function buildSlug(username: string): string {
  const sanitized = sanitizeUsername(username);
  if (sanitized.length > 0) {
    return sanitized;
  }
  return `user-${randomSuffix()}`;
}

export async function ensureProfileMetadata(args: {
  username: string;
  slug?: string;
  email?: string | null;
  authUserId?: string | null;
}): Promise<UserProfileRow> {
  const supabase = getSupabaseServiceClient();
  const slugSource = args.slug ?? args.username;
  const slug = sanitizeUsername(slugSource) || buildSlug(args.username);
  const payload: UserProfileInsert = {
    username: args.username,
    slug,
    auth_user_id: args.authUserId ?? null,
  };
  if (typeof args.email !== "undefined") {
    payload.email = args.email ?? null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "slug" })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear o actualizar el perfil");
  }

  return data;
}

export async function saveProfileFromPdf(args: {
  username: string;
  slug?: string;
  email?: string | null;
  authUserId?: string | null;
  pdfText: string;
  profileJson?: Json | null;
}): Promise<UserProfileRow> {
  const supabase = getSupabaseServiceClient();
  const slugSource = args.slug ?? args.username;
  const slug = sanitizeUsername(slugSource) || buildSlug(args.username);
  const payload: UserProfileInsert = {
    username: args.username,
    slug,
    email: args.email ?? null,
    auth_user_id: args.authUserId ?? null,
    pdf_raw: args.pdfText,
    profile_json: args.profileJson ?? null,
    profile_html: null,
    last_rendered_at: null,
    last_enriched_at: args.profileJson ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "slug" })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar el perfil en Supabase");
  }

  return data;
}

export async function getUserProfile(identifier: string): Promise<UserProfileRow | null> {
  const supabase = getSupabaseServiceClient();
  const slug = sanitizeUsername(identifier);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .or(`slug.eq.${slug},username.eq.${identifier}`)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getUserProfileByAuthUserId(
  authUserId: string
): Promise<UserProfileRow | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateProfileJson(args: {
  username: string;
  profileJson: Json;
  pdfText?: string | null;
  enrichedAt?: string;
  resetHtml?: boolean;
}): Promise<UserProfileRow> {
  const supabase = getSupabaseServiceClient();
  const slug = sanitizeUsername(args.username);
  const update: UserProfileUpdate = {
    profile_json: args.profileJson,
    last_enriched_at: args.enrichedAt ?? new Date().toISOString(),
  };

  if (typeof args.pdfText !== "undefined") {
    update.pdf_raw = args.pdfText;
  }

  if (args.resetHtml !== false) {
    update.profile_html = null;
    update.last_rendered_at = null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("slug", slug)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el JSON del perfil");
  }

  return data;
}

export async function updateProfileHtml(args: {
  username: string;
  profileHtml: string;
  renderedAt?: string;
}): Promise<UserProfileRow> {
  const supabase = getSupabaseServiceClient();
  const slug = sanitizeUsername(args.username);
  const update: UserProfileUpdate = {
    profile_html: args.profileHtml,
    last_rendered_at: args.renderedAt ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("slug", slug)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el HTML del perfil");
  }

  return data;
}
