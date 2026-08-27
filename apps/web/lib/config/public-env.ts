function requiredPublicValue(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Falta la variable pública requerida: ${name}`);
  return value;
}

const supabaseUrl = requiredPublicValue(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

try {
  new URL(supabaseUrl);
} catch {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL no contiene una URL válida");
}

export const publicEnv = Object.freeze({
  supabaseUrl,
  supabaseAnonKey: requiredPublicValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
});
