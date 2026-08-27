# Simulador de costos y precios — Brugali

MVP local para importar la planilla comercial, revisar calidad de datos, consultar costos y precios vigentes, simular márgenes en doble vía y exportar un Excel analítico.

## Arquitectura

- `apps/web`: aplicación Next.js, APIs del servidor y motor comercial TypeScript.
- `supabase/migrations`: esquema PostgreSQL, perfiles, auditoría y políticas RLS.
- `docs`: reglas funcionales, arquitectura, operación y despliegue.

El navegador no accede a PostgreSQL con privilegios administrativos. Las lecturas respetan RLS y las escrituras privilegiadas se realizan en Route Handlers después de validar sesión y rol.

## Inicio rápido

1. Copiar `.env.example` como `apps/web/.env.local` y completar las variables sin subirlas a Git.
2. Aplicar las migraciones de `supabase/migrations` al proyecto de Supabase.
3. Ejecutar `npm ci` dentro de `apps/web`.
4. Ejecutar `npm run dev` y abrir `http://localhost:3000`.

Las instrucciones completas se encuentran en `docs/puesta-en-marcha.md`.
