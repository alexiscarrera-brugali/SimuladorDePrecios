import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/server/env";

export function createSupabaseAdminClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
