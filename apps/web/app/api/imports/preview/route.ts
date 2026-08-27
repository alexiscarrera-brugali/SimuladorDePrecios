import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireRole } from "@/lib/server/supabase/session";
import { downloadWorkbook } from "@/lib/server/data/imports";
import { parseWorkbook } from "@/lib/domain/importer";
import { issueToJSON, summaryToJSON } from "@/lib/server/serialize";
import { importPathSchema } from "@/lib/schemas";
import { fail, handler, json } from "@/lib/server/http";

const PREVIEW_ISSUE_LIMIT = 200;

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handler(async (request: NextRequest) => {
  await requireRole("admin_importer");
  const parsed = importPathSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Ruta de archivo inválida");

  const admin = createSupabaseAdminClient();
  const buffer = await downloadWorkbook(admin, parsed.data.path);
  try {
    const workbook = await parseWorkbook(buffer);
    return json({
      path: parsed.data.path,
      filename: parsed.data.path.replace(/^[0-9a-f-]+-/, ""),
      sha256: workbook.sha256,
      summary: summaryToJSON(workbook.summary),
      issues: workbook.issues.slice(0, PREVIEW_ISSUE_LIMIT).map(issueToJSON),
      issues_total: workbook.issues.length,
    });
  } catch (error) {
    return fail(`No se pudo leer la planilla: ${(error as Error).message}`, 422);
  }
});
