"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    if (!email || !password) return setError("Completá ambos campos");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) return setError(data.error || "Correo o contraseña inválidos");
      router.replace(params.get("redirect") || "/");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Error de conexión. Intentá de nuevo.");
    }
  }

  return (
    <form className="loginForm" onSubmit={submit}>
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
