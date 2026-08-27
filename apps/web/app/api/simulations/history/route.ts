import { requireUser } from "@/lib/supabase/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, handler, json } from "@/lib/http";

export const GET = handler(async () => {
  await requireUser();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("simulation_events")
    .select("id, product_code, price_list_code, query_date, input_payload, result_payload, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return fail(error.message, 500);

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))];
  let emailMap: Record<string, string> = {};

  if (actorIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, name")
      .in("id", actorIds);
    emailMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name ?? p.email ?? p.id]));
  }

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    product_code: r.product_code,
    price_list_code: r.price_list_code,
    query_date: r.query_date,
    actor_email: emailMap[r.actor_id] ?? "—",
    created_at: r.created_at,
    original_cost: r.input_payload?.cost ?? null,
    original_ideal_percent: r.input_payload?.ideal_percent ?? null,
    driver: r.input_payload?.driver ?? "price",
    driver_value: r.input_payload?.driver_value ?? "0",
    simulated_price: r.result_payload?.price ?? null,
    simulated_gain_amount: r.result_payload?.gain_amount ?? null,
    simulated_gain_percent: r.result_payload?.gain_percent ?? null,
    thermometer: r.result_payload?.thermometer ?? "neutral",
  }));

  return json(rows);
});
