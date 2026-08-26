"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { loginSchema } from "@/lib/contracts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setError("");
    const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revisá los datos");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (authError) return setError("Correo o contraseña inválidos");
    router.replace(params.get("redirect") || "/");
    router.refresh();
  }

  return (
    <form className="loginForm" action={submit}>
      <div className="loginIcon"><LockKeyhole size={22} /></div>
      <span className="eyebrow">Acceso privado</span>
      <h2>Ingresar al tablero</h2>
      <p>Usá tu cuenta individual. Los accesos y las acciones relevantes quedan registrados.</p>
      <label>Correo corporativo<input name="email" type="email" autoComplete="email" placeholder="nombre@brugali.com.ar" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <div className="formError" role="alert">{error}</div>}
      <button className="primaryButton" disabled={loading}>{loading ? "Ingresando…" : "Continuar"}<ArrowRight size={18} /></button>
      <small>Acceso corporativo · Acciones registradas</small>
    </form>
  );
}
