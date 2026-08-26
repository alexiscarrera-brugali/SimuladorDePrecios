import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/session";
import { getAnalysisData, getLatestBatchId, getPriceListByCode } from "@/lib/data/repo";
import { analyze } from "@/lib/engine/analysis";
import { fail, handler, json } from "@/lib/http";

export const GET = handler(async (request: NextRequest) => {
  await requireUser();
  const params = request.nextUrl.searchParams;
  const queryDate = params.get("date");
  const priceListCode = params.get("price_list");
  if (!queryDate || !/^\d{4}-\d{2}-\d{2}$/.test(queryDate)) return fail("Fecha inválida (use YYYY-MM-DD)");
  if (!priceListCode) return fail("Falta el parámetro price_list");

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return fail("No hay datos importados todavía", 409);

  const priceList = await getPriceListByCode(supabase, priceListCode);
  const data = await getAnalysisData(supabase, batchId, priceListCode);
  return json(analyze({ queryDate, priceList, ...data }));
});
