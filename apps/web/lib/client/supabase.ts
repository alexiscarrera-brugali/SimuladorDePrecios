import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/config/public-env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
