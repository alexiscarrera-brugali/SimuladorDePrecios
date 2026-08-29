import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireRole } from "@/lib/server/supabase/session";
import { getLatestBatchId } from "@/lib/server/data/repo";
import { recordAudit } from "@/lib/server/data/audit";
import { publishSchema } from "@/lib/contracts";
import { fail, handler, json } from "@/lib/server/http";

// Establecer como lista vigente: escribe una vigencia nueva con la fecha del día
// (origin='manual'). Pasa a ser el precio vigente; el anterior queda en el
// histórico. Sólo admin_importer (escribe precios). Reversible con /reset.
export const POST = handler(async (request: NextRequest) => {
  const user = await requireRole("admin_importer");
  const parsed = publishSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const p = parsed.data;

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return fail("No hay datos importados todavía", 409);

  const admin = createSupabaseAdminClient();
  const codes = p.items.map((i) => i.product_code);

  // Reemplaza la vigencia manual de hoy para esos productos (evita duplicar/chocar).
  const { error: delError } = await admin
    .from("price_facts")
    .delete()
    .eq("batch_id", batchId)
    .eq("price_list_code", p.price_list_code)
    .eq("valid_from", p.query_date)
    .eq("origin", "manual")
    .in("product_code", codes);
  if (delError) return fail(`No se pudo actualizar la lista vigente: ${delError.message}`, 500);

  const rows = p.items.map((i) => ({
    batch_id: batchId,
    branch_code: i.branch_code,
    price_list_code: p.price_list_code,
    product_code: i.product_code,
    valid_from: p.query_date,
    value: i.price,
    source_status: "active",
    source_row: 0,
    origin: "manual",
  }));
  const { error } = await admin.from("price_facts").insert(rows);
  if (error) return fail(`No se pudo establecer la lista vigente: ${error.message}`, 500);

  await recordAudit(admin, {
    actorId: user.id,
    action: "price.publish",
    entityType: "price_list",
    entityId: p.price_list_code,
    details: { query_date: p.query_date, products: codes, count: rows.length },
  });

  return json({ ok: true, published: rows.length });
});
