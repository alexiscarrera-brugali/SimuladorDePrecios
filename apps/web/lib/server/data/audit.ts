import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/server/http";

export async function recordAudit(
  admin: SupabaseClient,
  event: { actorId: string; action: string; entityType: string; entityId?: string | null; details?: Record<string, unknown> },
) {
  const { error } = await admin.from("audit_events").insert({
    actor_id: event.actorId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    details: event.details ?? {},
  });
  if (error) throw new HttpError(500, `No se pudo registrar la auditoría: ${error.message}`);
}
