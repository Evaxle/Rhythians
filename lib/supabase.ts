import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only warn if not configured, don't throw during build
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase environment variables are not configured. Supabase features will not work until configured.");
}

export const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;
export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

export function getStoragePath(bucket: string, folder: string, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9-_\.]/g, "-").toLowerCase();
  return `${folder}/${crypto.randomUUID()}-${safeName}`;
}
