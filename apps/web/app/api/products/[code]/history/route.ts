import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { requireUser } from "@/lib/server/supabase/session";
import { getHistory, getLatestBatchId } from "@/lib/server/data/repo";
import { fail, handler, json } from "@/lib/server/http";

export const GET = handler(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  await requireUser();
  const { code } = await ctx.params;
  const priceListCode = request.nextUrl.searchParams.get("price_list");
  if (!priceListCode) return fail("Falta el parámetro price_list");

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return json({ prices: [], costs: [] });

  return json(await getHistory(supabase, batchId, code, priceListCode));
});
