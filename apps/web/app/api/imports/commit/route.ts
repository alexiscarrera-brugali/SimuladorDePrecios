import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireRole } from "@/lib/server/supabase/session";
import { downloadWorkbook, removeWorkbook } from "@/lib/server/data/imports";
import { persistImport } from "@/lib/server/data/repo";
import { recordAudit } from "@/lib/server/data/audit";
import { parseWorkbook } from "@/lib/domain/importer";
import { importPathSchema } from "@/lib/schemas";
import { fail, handler, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const cleanupError = await removeWorkbook(admin, parsed.data.path);
  const warnings: string[] = [];
  if (cleanupError) {
    warnings.push("El lote se confirmó, pero no se pudo eliminar el archivo temporal.");
    await recordAudit(admin, {
      actorId: user.id,
      action: "import.cleanup_failed",
      entityType: "import_batch",
      entityId: batchId,
      details: { reason: cleanupError },
    });
  }

  return json({ batchId, summary: workbook.summary, warnings });
});
