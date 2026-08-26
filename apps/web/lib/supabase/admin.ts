// Cliente Supabase con service-role — SOLO backend.
// Omite RLS: úsese exclusivamente en Route Handlers/Server Actions tras
// verificar el rol del usuario. `server-only` impide que se empaquete al
// navegador; la clave nunca se expone al cliente.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (solo backend).");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
