import "server-only";
import { publicEnv } from "@/lib/config/public-env";

function requiredSecret(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Falta la variable privada requerida: ${name}`);
  return value;
}

export const serverEnv = Object.freeze({
  ...publicEnv,
  supabaseServiceRoleKey: requiredSecret(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),
  importsBucket: process.env.SUPABASE_IMPORTS_BUCKET?.trim() || "imports",
});
