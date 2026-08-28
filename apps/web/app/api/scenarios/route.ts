import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { requireUser } from "@/lib/server/supabase/session";
import { fail, handler, json } from "@/lib/server/http";

// Escenarios guardados del usuario. Usa el cliente con la sesión del usuario a
// propósito: la lectura pasa por RLS (el actor ve los suyos; admin ve todos).
export const GET = handler(async () => {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("scenarios")
    .select("id, price_list_code, query_date, rule_kind, rule_value, note, aggregate, created_at, scenario_items(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail(error.message, 500);

  const rows = (data ?? []).map((s) => ({
    id: s.id,
    price_list_code: s.price_list_code,
    query_date: s.query_date,
    rule_kind: s.rule_kind,
    rule_value: s.rule_value,
    note: s.note,
    aggregate: s.aggregate,
    created_at: s.created_at,
    item_count: Array.isArray(s.scenario_items) ? (s.scenario_items[0]?.count ?? 0) : 0,
  }));

  return json(rows);
});
