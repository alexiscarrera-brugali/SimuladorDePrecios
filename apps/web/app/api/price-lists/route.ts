import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { requireUser } from "@/lib/server/supabase/session";
import { getPriceLists } from "@/lib/server/data/repo";
import { handler, json } from "@/lib/server/http";

export const GET = handler(async () => {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  return json(await getPriceLists(supabase));
});
