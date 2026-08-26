import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/session";
import { downloadWorkbook, removeWorkbook } from "@/lib/data/imports";
import { persistImport } from "@/lib/data/repo";
import { recordAudit } from "@/lib/data/audit";
import { parseWorkbook } from "@/lib/engine/importer";
import { importPathSchema } from "@/lib/schemas";
import { fail, handler, json } from "@/lib/http";

export const POST = handler(async (request: NextRequest) => {
  const user = await requireRole("admin_importer");
  const parsed = importPathSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Ruta de archivo inválida");

  const admin = createSupabaseAdminClient();
  const buffer = await downloadWorkbook(admin, parsed.data.path);
  const filename = parsed.data.path.replace(/^[0-9a-f-]+-/, "");

  let workbook;
  try {
    workbook = await parseWorkbook(buffer);
  } catch (error) {
    return fail(`No se pudo leer la planilla: ${(error as Error).message}`, 422);
  }

  const batchId = await persistImport(admin, workbook, filename, user.id);
  await recordAudit(admin, {
    actorId: user.id,
    action: "import.commit",
    entityType: "import_batch",
    entityId: batchId,
    details: { filename, summary: workbook.summary, sha256: workbook.sha256 },
  });
  await removeWorkbook(admin, parsed.data.path);

  return json({ batchId, summary: workbook.summary });
});
