import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return json(
    { status: configured ? "ok" : "unavailable", service: "brugali-costos-web" },
    configured ? 200 : 503,
  );
}
