# Configuración de Supabase

## Esquema y seguridad

Aplicar en orden los scripts de `supabase/migrations`. Crean las tablas, perfiles, roles, RLS, auditoría y el bucket privado `imports`.

Comprobación mínima:

```sql
select tablename from pg_tables where schemaname = 'public' order by 1;
select count(*) from pg_policies where schemaname = 'public';
```

## Usuarios

Cada usuario nuevo recibe el rol mínimo `tester`. La promoción a administrador se hace explícitamente:

```sql
update public.profiles
set role = 'admin_importer', is_active = true
where email = 'alexis.carrera@brugali.com.ar';
```

La service role nunca se usa en el navegador. Sólo está disponible en Vercel y `apps/web/.env.local` para los Route Handlers autorizados.

## URLs de autenticación

Registrar localhost, la URL productiva y el patrón de Preview de Vercel en Authentication → URL Configuration. No habilitar dominios genéricos ajenos al proyecto.
