import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { requireUser } from "@/lib/server/supabase/session";
import { getAnalysisData, getLatestBatchId, getPriceListByCode } from "@/lib/server/data/repo";
import { analyze } from "@/lib/domain/analysis";
import { analysisToJSON } from "@/lib/server/serialize";
import { fail, handler, json } from "@/lib/server/http";

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
  return json(analysisToJSON(analyze({ queryDate, priceList, ...data })));
});
