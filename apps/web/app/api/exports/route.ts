import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireUser } from "@/lib/server/supabase/session";
import { getAnalysisData, getLatestBatchId, getPriceListByCode } from "@/lib/server/data/repo";
import { recordAudit } from "@/lib/server/data/audit";
import { analyze } from "@/lib/domain/analysis";
import { buildExportWorkbook, type SimulationExportInput } from "@/lib/domain/exports";
import type { ParsedIssue, Severity } from "@/lib/domain/importer";
import { exportSchema } from "@/lib/schemas";
import { fail, handler } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser();
  const parsed = exportSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Parámetros de exportación inválidos");
  const { query_date: queryDate, price_list_code: priceListCode, simulations } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return fail("No hay datos importados todavía", 409);

  const priceList = await getPriceListByCode(supabase, priceListCode);
  const data = await getAnalysisData(supabase, batchId, priceListCode);
  const analysis = analyze({ queryDate, priceList, ...data });

  const { data: issueRows } = await supabase.from("quality_issues").select("*").eq("batch_id", batchId);
  const issues: ParsedIssue[] = (issueRows ?? []).map((r) => ({
    issueType: r.issue_type,
    severity: r.severity as Severity,
    sheetName: r.sheet_name,
    businessKey: r.business_key,
    explanation: r.explanation,
    sourceRows: r.source_rows ?? [],
    values: r.values ?? [],
  }));

  const simMap: Record<string, SimulationExportInput> = {};
  for (const [code, sim] of Object.entries(simulations ?? {})) {
    simMap[code] = {
      cost: sim.cost,
      idealPercent: sim.ideal_percent,
      driver: sim.driver,
      driverValue: sim.driver_value,
      sourceInactive: sim.source_inactive,
      sourceUnknown: sim.source_unknown,
    };
  }

  const workbook = await buildExportWorkbook({
    queryDate,
    analysis,
    issues,
    simulations: simMap,
    metadata: {
      batchId,
      filename: null,
      exportedBy: user.email,
      exportedAt: new Date().toISOString(),
    },
  });

  const admin = createSupabaseAdminClient();
  await recordAudit(admin, {
    actorId: user.id,
    action: "export.create",
    entityType: "export",
    entityId: batchId,
    details: { queryDate, priceListCode, rows: analysis.rows.length },
  });

  const filename = `analisis_${priceListCode}_${queryDate}.xlsx`;
  return new Response(new Uint8Array(workbook), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
