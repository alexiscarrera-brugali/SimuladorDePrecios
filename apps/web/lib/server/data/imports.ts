import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/server/http";
import { XLSX_MAX_BYTES } from "@/lib/config/upload";
import { serverEnv } from "@/lib/server/env";

export async function downloadWorkbook(admin: SupabaseClient, path: string): Promise<Buffer> {
  const { data, error } = await admin.storage.from(serverEnv.importsBucket).download(path);
  if (error || !data) throw new HttpError(404, `No se encontró el archivo subido: ${error?.message ?? path}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.byteLength > XLSX_MAX_BYTES) {
    throw new HttpError(413, "El archivo supera el máximo permitido de 25 MB");
  }
  return buffer;
}

export async function removeWorkbook(admin: SupabaseClient, path: string): Promise<string | null> {
  const { error } = await admin.storage.from(serverEnv.importsBucket).remove([path]);
  return error?.message ?? null;
}
