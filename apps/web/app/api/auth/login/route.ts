import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { loginSchema } from "@/lib/contracts";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // No se registra el detalle del proveedor: el mensaje puede revelar si la
    // cuenta existe o su estado. Sólo el código de estado, para diagnóstico.
    console.error("[AUTH] login fallido", { status: error.status });
    return NextResponse.json({ error: "Correo o contraseña inválidos" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
