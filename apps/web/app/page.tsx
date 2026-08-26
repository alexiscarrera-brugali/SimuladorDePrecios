import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PriceList } from "@/lib/types";
import { Dashboard } from "@/components/Dashboard";

async function api<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost:8000"}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export default async function HomePage() {
  const token = (await cookies()).get("brugali_session")?.value;
  if (!token) redirect("/login");
  const [user, priceLists] = await Promise.all([
    api<{ name: string; role: string; email: string }>("/auth/me", token),
    api<PriceList[]>("/price-lists", token),
  ]);
  if (!user) redirect("/login");
  return <Dashboard user={user} initialPriceLists={priceLists ?? []} />;
}

