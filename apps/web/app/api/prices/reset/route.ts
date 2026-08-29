import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { requireRole } from "@/lib/server/supabase/session";
import { getLatestBatchId } from "@/lib/server/data/repo";
import { recordAudit } from "@/lib/server/data/audit";
import { resetSchema } from "@/lib/contracts";
import { fail, handler, json } from "@/lib/server/http";

// Restablecer: elimina las vigencias manuales del producto en la lista → vuelve
// el precio importado anterior. Sólo admin_importer.
export const POST = handler(async (request: NextRequest) => {
  const user = await requireRole("admin_importer");
  const parsed = resetSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const p = parsed.data;

  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return fail("No hay datos importados todavía", 409);

  const admin = createSupabaseAdminClient();
  const codes = p.items.map((i) => i.product_code);

  const { error } = await admin
    .from("price_facts")
    .delete()
    .eq("batch_id", batchId)
    .eq("price_list_code", p.price_list_code)
    .eq("origin", "manual")
    .in("product_code", codes);
  if (error) return fail(`No se pudo restablecer: ${error.message}`, 500);

  await recordAudit(admin, {
    actorId: user.id,
    action: "price.reset",
    entityType: "price_list",
    entityId: p.price_list_code,
    details: { products: codes },
  });

  return json({ ok: true, reset: codes.length });
});
