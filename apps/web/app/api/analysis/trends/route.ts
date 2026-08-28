import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { requireUser } from "@/lib/server/supabase/session";
import { getLatestBatchId } from "@/lib/server/data/repo";
import { fail, handler, json } from "@/lib/server/http";

// Series compactas de precio por producto en una lista, ordenadas por vigencia,
// para dibujar una sparkline de tendencia por fila. Payload chico (pocos puntos).
export const GET = handler(async (request: NextRequest) => {
  await requireUser();
  const date = request.nextUrl.searchParams.get("date");
  const priceListCode = request.nextUrl.searchParams.get("price_list");
  if (!priceListCode) return fail("Falta el parámetro price_list");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Fecha inválida (use YYYY-MM-DD)");

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return json({ prices: {} });

  let query = supabase
    .from("price_facts")
    .select("product_code, value, valid_from")
    .eq("batch_id", batchId)
    .eq("price_list_code", priceListCode)
    .order("valid_from", { ascending: true });
  if (date) query = query.lte("valid_from", date);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);

  const prices: Record<string, number[]> = {};
  for (const row of data ?? []) {
    if (row.value === null) continue;
    const n = Number(row.value);
    if (Number.isNaN(n)) continue;
    (prices[row.product_code] ??= []).push(n);
  }

  return json({ prices });
});
