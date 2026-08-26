import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/session";
import { signUploadSchema } from "@/lib/schemas";
import { fail, handler, json } from "@/lib/http";

const BUCKET = process.env.SUPABASE_IMPORTS_BUCKET ?? "imports";

export const POST = handler(async (request: NextRequest) => {
  await requireRole("admin_importer");
  const parsed = signUploadSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Nombre de archivo inválido");

  const safe = parsed.data.filename.replace(/[^\w.\-]+/g, "_");
  const path = `${randomUUID()}-${safe}`;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return fail(`No se pudo preparar la subida: ${error.message}`, 500);
  return json({ path: data.path, token: data.token, bucket: BUCKET });
});
