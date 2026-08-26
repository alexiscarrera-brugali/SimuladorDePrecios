import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/session";
import { Decimal, parseDecimalOrNull, toStr } from "@/lib/engine/decimal";
import { simulate } from "@/lib/engine/simulation";
import { EngineError } from "@/lib/engine/types";
import { simulationSchema } from "@/lib/schemas";
import { fail, handler, json } from "@/lib/http";

export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser();
  const parsed = simulationSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos de simulación inválidos");
  const p = parsed.data;

  let result;
  try {
    result = simulate({
      cost: parseDecimalOrNull(p.cost),
      driver: p.driver,
      driverValue: new Decimal(p.driver_value || "0"),
      idealPercent: parseDecimalOrNull(p.ideal_percent),
      sourceInactive: p.source_inactive,
      sourceUnknown: p.source_unknown,
    });
  } catch (error) {
    if (error instanceof EngineError) return fail(`Simulación rechazada: ${error.code}`, 422);
    throw error;
  }

  const resultPayload = {
    price: toStr(result.price),
    gain_amount: toStr(result.gainAmount),
    gain_percent: toStr(result.gainPercent),
    ideal_price: toStr(result.idealPrice),
    gap_amount: toStr(result.gapAmount),
    gap_percentage_points: toStr(result.gapPercentagePoints),
    thermometer: result.thermometer,
    warnings: result.warnings,
  };

  const admin = createSupabaseAdminClient();
  await admin.from("simulation_events").insert({
    actor_id: user.id,
    product_code: p.product_code,
    price_list_code: p.price_list_code,
    query_date: p.query_date,
    input_payload: p,
    result_payload: resultPayload,
  });

  return json(resultPayload);
});
