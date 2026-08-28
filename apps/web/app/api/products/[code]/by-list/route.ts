import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { requireUser } from "@/lib/server/supabase/session";
import { getLatestBatchId, getPriceLists } from "@/lib/server/data/repo";
import { resolveEffective } from "@/lib/domain/effective";
import { buildListMatrix, type ListMatrixInput } from "@/lib/domain/matrix";
import { parseDecimalOrNull, toStr } from "@/lib/domain/decimal";
import type { EffectiveCandidate } from "@/lib/domain/types";
import { fail, handler, json } from "@/lib/server/http";

function asStatus(value: string | null): EffectiveCandidate["sourceStatus"] {
  return value === "active" || value === "inactive" ? value : "unknown";
}

// Margen del producto a través de todas las listas de precio, a una fecha.
export const GET = handler(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  await requireUser();
  const { code } = await ctx.params;
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Fecha inválida (use YYYY-MM-DD)");

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return json({ product_code: code, description: null, cost: null, lists: [] });

  const lists = await getPriceLists(supabase);
  const [pricesRes, costsRes, marginsRes, productRes] = await Promise.all([
    supabase.from("price_facts").select("price_list_code, value, valid_from, source_status, source_row").eq("batch_id", batchId).eq("product_code", code),
    supabase.from("cost_facts").select("value, valid_from, source_status, source_row").eq("batch_id", batchId).eq("product_code", code),
    supabase.from("theoretical_margins").select("price_list_name, percentage, is_ambiguous").eq("batch_id", batchId).eq("product_code", code),
    supabase.from("products").select("description").eq("code", code).maybeSingle(),
  ]);
  for (const res of [pricesRes, costsRes, marginsRes, productRes]) {
    if (res.error) return fail(res.error.message, 500);
  }

  const costCandidates: EffectiveCandidate[] = (costsRes.data ?? []).map((r) => ({
    value: parseDecimalOrNull(r.value),
    validFrom: r.valid_from,
    sourceRow: r.source_row,
    sourceStatus: asStatus(r.source_status),
  }));
  const cost = resolveEffective(costCandidates, date);

  const objByListName = new Map<string, ReturnType<typeof parseDecimalOrNull>>();
  for (const m of marginsRes.data ?? []) {
    if (!m.is_ambiguous) objByListName.set(m.price_list_name, parseDecimalOrNull(m.percentage));
  }

  const priceCandidatesByList = new Map<string, EffectiveCandidate[]>();
  for (const r of pricesRes.data ?? []) {
    const bucket = priceCandidatesByList.get(r.price_list_code) ?? [];
    bucket.push({ value: parseDecimalOrNull(r.value), validFrom: r.valid_from, sourceRow: r.source_row, sourceStatus: asStatus(r.source_status) });
    priceCandidatesByList.set(r.price_list_code, bucket);
  }

  const inputs: ListMatrixInput[] = lists.map((list) => ({
    code: list.code,
    description: list.description,
    price: resolveEffective(priceCandidatesByList.get(list.code) ?? [], date).value,
    idealPercent: objByListName.get(list.description) ?? null,
  }));

  return json({
    product_code: code,
    description: productRes.data?.description ?? null,
    cost: toStr(cost.value),
    lists: buildListMatrix(cost.value, inputs),
  });
});
