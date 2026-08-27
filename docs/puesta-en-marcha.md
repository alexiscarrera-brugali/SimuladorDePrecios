# Puesta en marcha y despliegue

## Desarrollo local

Requisitos: Node.js 24.x, npm y un proyecto Supabase con las migraciones aplicadas.

```powershell
Copy-Item .env.example apps/web/.env.local
cd apps/web
npm ci
npm run dev
```

Completar `apps/web/.env.local` con:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_IMPORTS_BUCKET=imports`

El archivo local contiene secretos y debe permanecer ignorado por Git.

## Preparar Supabase

1. Aplicar en orden los archivos de `supabase/migrations`.
2. Crear usuarios desde Authentication.
3. Asignar `admin_importer`, `functional` o `tester` en `public.profiles`.
4. Configurar como Site URL el dominio productivo.
5. Autorizar `http://localhost:3000/**`, el dominio productivo y el patrón Preview del proyecto de Vercel.

## Configurar Vercel

1. Importar o vincular el repositorio de GitHub existente.
2. Definir `apps/web` como Root Directory.
3. Usar Next.js autodetectado, `npm ci` y `npm run build`.
4. No definir Output Directory.
5. Seleccionar Node.js 24.x.
6. Cargar las cuatro variables de entorno para Preview y Production; marcar la service role como sensible.
7. Generar un Preview Deployment y probarlo antes de promoverlo.

Para vincular localmente el proyecto se usa `npx vercel@latest login` y luego `npx vercel@latest link` dentro de `apps/web`. No se pegan tokens en archivos, comandos compartidos ni conversaciones.

## Control previo

```powershell
cd apps/web
npm run typecheck
npm run lint
npm test
npm run build
```

El endpoint `GET /api/health` debe responder 200. Luego se valida el recorrido login → importación → análisis → simulación → exportación.

## Reversión

Si el Preview falla, no se promueve. Si producción falla, Vercel permite restaurar el deployment estable anterior; las migraciones sólo se aplican antes de promover cuando fueron verificadas por separado.
