import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireRole } from "@/lib/server/supabase/session";
import { signUploadSchema } from "@/lib/schemas";
import { fail, handler, json } from "@/lib/server/http";
import { serverEnv } from "@/lib/server/env";

export const POST = handler(async (request: NextRequest) => {
  await requireRole("admin_importer");
  const parsed = signUploadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Archivo inválido");
  }

  const safe = parsed.data.filename.replace(/[^\w.\-]+/g, "_");
  const path = `${randomUUID()}-${safe}`;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(serverEnv.importsBucket)
    .createSignedUploadUrl(path);
  if (error) return fail(`No se pudo preparar la subida: ${error.message}`, 500);
  return json({ path: data.path, token: data.token, bucket: serverEnv.importsBucket });
});
