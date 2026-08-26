import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/session";
import { getPriceLists } from "@/lib/data/repo";
import { handler, json } from "@/lib/http";

export const GET = handler(async () => {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  return json(await getPriceLists(supabase));
});
