import { redirect } from "next/navigation";
import type { PriceList } from "@/lib/types";
import { getSessionUser } from "@/lib/server/supabase/session";
import { createSupabaseServerClient } from "@/lib/server/supabase/server";
import { getPriceLists } from "@/lib/server/data/repo";
import { Dashboard } from "@/components/analysis/Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let priceLists: PriceList[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    priceLists = await getPriceLists(supabase);
  } catch {
    // El esquema puede no estar aplicado todavía: se muestra el estado vacío.
    priceLists = [];
  }

  return (
    <Dashboard
      user={{ name: user.name, role: user.role, email: user.email }}
      initialPriceLists={priceLists}
    />
  );
}
