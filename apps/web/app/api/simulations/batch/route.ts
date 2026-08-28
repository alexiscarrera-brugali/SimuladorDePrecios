import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireUser } from "@/lib/server/supabase/session";
import { getAnalysisData, getLatestBatchId, getPriceListByCode } from "@/lib/server/data/repo";
import { analyze } from "@/lib/domain/analysis";
import { applyBatch, type BatchInputRow, type BatchRule } from "@/lib/domain/batch";
import { parseDecimalOrNull } from "@/lib/domain/decimal";
import { batchSchema } from "@/lib/contracts";
import { batchOutcomeToJSON } from "@/lib/server/serialize";
import { fail, handler, json } from "@/lib/server/http";

// What-if de cartera: recalcula server-authoritative con applyBatch y, si se
// pide, persiste el escenario con auditoría. El preview (save:false) y el
// guardado comparten el mismo cálculo → el resultado del servidor prevalece.
export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser();
  const parsed = batchSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos del escenario inválidos");
  const p = parsed.data;

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return fail("No hay datos importados todavía", 409);

  const priceList = await getPriceListByCode(supabase, p.price_list_code);
  const data = await getAnalysisData(supabase, batchId, p.price_list_code);
  const analysis = analyze({ queryDate: p.query_date, priceList, ...data });

  const wanted = new Set(p.product_codes);
  const rows: BatchInputRow[] = analysis.rows
    .filter((r) => wanted.has(r.productCode))
    .map((r) => ({
      productCode: r.productCode,
      branchCode: r.branchCode,
      cost: parseDecimalOrNull(r.cost.value),
      price: parseDecimalOrNull(r.price.value),
      idealPercent: parseDecimalOrNull(r.idealPercent),
      actualGainPercent: parseDecimalOrNull(r.actualGainPercent),
    }));

  if (rows.length === 0) return fail("Ningún producto seleccionado está en la lista actual", 422);

  const rule: BatchRule = { kind: p.rule_kind, value: parseDecimalOrNull(p.rule_value) };
  const outcome = applyBatch(rows, rule);
  const payload = batchOutcomeToJSON(outcome);

  if (!p.save) return json(payload);

  const admin = createSupabaseAdminClient();
  const { data: scenario, error } = await admin
    .from("scenarios")
    .insert({
      actor_id: user.id,
      price_list_code: p.price_list_code,
      query_date: p.query_date,
      rule_kind: p.rule_kind,
      rule_value: p.rule_value === null || p.rule_value.trim() === "" ? null : Number(p.rule_value),
      note: p.note ?? null,
      aggregate: payload.aggregate,
    })
    .select("id")
    .single();
  if (error || !scenario) return fail(`No se pudo guardar el escenario: ${error?.message ?? "sin id"}`, 500);

  const items = payload.items.map((item) => ({
    scenario_id: scenario.id,
    product_code: item.product_code,
    branch_code: item.branch_code,
    before_payload: { price: item.before_price, gain_percent: item.before_gain_percent },
    after_payload: {
      price: item.after_price,
      gain_percent: item.after_gain_percent,
      thermometer: item.thermometer,
      crossed_into_target: item.crossed_into_target,
      fell_below_target: item.fell_below_target,
      skipped: item.skipped,
      reason: item.reason,
    },
  }));
  const { error: itemsError } = await admin.from("scenario_items").insert(items);
  if (itemsError) return fail(`No se pudieron guardar los ítems del escenario: ${itemsError.message}`, 500);

  return json({ ...payload, scenario_id: scenario.id, saved: items.length });
});
