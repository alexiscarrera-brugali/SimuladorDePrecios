# Puesta en marcha de Supabase

Proyecto: `hdwzkzukxxfmmntgrrgx` · `https://hdwzkzukxxfmmntgrrgx.supabase.co`

> El conector de Supabase de la sesión de Claude está autenticado en **otra
> cuenta** (ve `O2 Prode` y `WAZPRODE`, no este proyecto). Por eso la migración
> se aplica manualmente. Alternativa: conectar la cuenta de Brugali al conector
> de Claude (claude.ai → Settings → Connectors) para que Claude pueda aplicarla
> y generar tipos automáticamente.

## 1. Aplicar el esquema y la seguridad (RLS)

En el panel de Supabase → **SQL Editor** → New query, pegar y ejecutar el
contenido de [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).

Crea: tablas normalizadas (`NUMERIC(20,8)`), perfiles/roles, RLS (solo lectura
por JWT de usuario; escritura por service-role), el trigger de alta de perfil, y
el bucket privado `imports` de Storage.

Verificación rápida (debería devolver las tablas y políticas):

```sql
select tablename from pg_tables where schemaname = 'public' order by 1;
select count(*) from pg_policies where schemaname = 'public';
```

## 2. Claves de entorno

En `apps/web/.env.local` (local) y en Vercel (Project → Settings → Environment
Variables):

| Variable | Dónde se obtiene | Ámbito |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ya configurada | público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya configurada (publishable) | público |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` (secreto) | **solo backend** |
| `SUPABASE_IMPORTS_BUCKET` | `imports` | backend |

> La `service_role` **nunca** va al navegador ni al repositorio. Solo la usan
> los Route Handlers del backend. Sin ella, los endpoints de importación,
> simulación guardada y exportación responden error controlado.

## 3. Primer administrador

El trigger crea cada perfil nuevo con rol `tester`. Para habilitar la
importación, promover al responsable a `admin_importer` **después** de que se
registre por primera vez (o de crearlo en Authentication → Users):

```sql
update public.profiles
set role = 'admin_importer', is_active = true
where email = 'alexis.carrera@brugali.com.ar';
```

Roles: `admin_importer` (importa y todo lo demás), `functional` (analiza y
simula), `tester` (valida el recorrido).

## 4. Verificación

- `select role from public.profiles where email = '...';` → `admin_importer`.
- Con la app corriendo, iniciar sesión, importar la planilla y consultar una
  lista/fecha. La conciliación de una muestra se hace contra la fuente.
