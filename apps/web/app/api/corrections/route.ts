import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireUser } from "@/lib/server/supabase/session";
import { correctionSchema } from "@/lib/contracts";
import { fail, handler, json } from "@/lib/server/http";

export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser();
  const parsed = correctionSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos de corrección inválidos");

  const { product_code, price_list_code, corrections } = parsed.data;
  const admin = createSupabaseAdminClient();

  const rows = corrections.map((c) => ({
    product_code,
    price_list_code,
    field: c.field,
    original_value: c.original_value,
    corrected_value: c.corrected_value,
    corrected_by: user.id,
    corrected_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("manual_corrections")
    .upsert(rows, { onConflict: "product_code,price_list_code,field" });

  if (error) return fail(`No se pudo guardar la corrección: ${error.message}`, 500);

  return json({ ok: true, saved: rows.length });
});

export const GET = handler(async (request: NextRequest) => {
  await requireUser();
  const params = request.nextUrl.searchParams;
  const productCode = params.get("product_code");
  const priceListCode = params.get("price_list");
  if (!productCode || !priceListCode) return fail("Faltan parámetros product_code y price_list");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("manual_corrections")
    .select("field, original_value, corrected_value, corrected_at")
    .eq("product_code", productCode)
    .eq("price_list_code", priceListCode);

  if (error) return fail(error.message, 500);
  return json(data ?? []);
});
