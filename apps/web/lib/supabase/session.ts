// Sesión y autorización por rol para Route Handlers y Server Components.
import { createSupabaseServerClient } from "./server";
import { HttpError } from "@/lib/http";

export type AppRole = "admin_importer" | "functional" | "tester";

export interface SessionUser {
  id: string;
  email: string;
  role: AppRole;
  name: string;
  isActive: boolean;
}

/** Devuelve el usuario autenticado y su perfil, o null si no hay sesión. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name, is_active, email")
    .eq("id", auth.user.id)
    .single();

  if (!profile) return null;
  return {
    id: auth.user.id,
    email: profile.email ?? auth.user.email ?? "",
    role: profile.role as AppRole,
    name: profile.name ?? "",
    isActive: profile.is_active ?? false,
  };
}

/** Exige sesión activa; lanza 401 si no hay. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "No autenticado");
  if (!user.isActive) throw new HttpError(403, "Usuario inactivo");
  return user;
}

/** Exige uno de los roles indicados; lanza 403 si no corresponde. */
export async function requireRole(...roles: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "No tenés permisos para esta acción");
  }
  return user;
}
