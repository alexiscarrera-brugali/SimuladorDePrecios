import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { requireUser } from "@/lib/server/supabase/session";
import { getLatestBatchId } from "@/lib/server/data/repo";
import { handler, json, HttpError } from "@/lib/server/http";

export const GET = handler(async () => {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const batchId = await getLatestBatchId(supabase);
  if (!batchId) return json([]);

  const { data, error } = await supabase
    .from("quality_issues")
    .select("issue_type, severity, sheet_name, business_key, explanation, source_rows, values")
    .eq("batch_id", batchId)
    .order("severity");
  if (error) throw new HttpError(500, error.message);
  return json(data ?? []);
});
