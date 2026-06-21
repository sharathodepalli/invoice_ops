import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, serviceRole };
}

export function hasSupabaseConfig(): boolean {
  const { url, serviceRole } = getConfig();
  return Boolean(url && serviceRole);
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const { url, serviceRole } = getConfig();
  if (!url || !serviceRole) {
    throw new Error("Supabase is not configured. Missing URL or service role key.");
  }

  cachedClient = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
