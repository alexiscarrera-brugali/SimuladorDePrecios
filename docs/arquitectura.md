# Arquitectura vigente

## Componentes

- Next.js aloja la interfaz, los Server Components y los Route Handlers.
- Supabase provee PostgreSQL, autenticación y un bucket privado para importaciones.
- Vercel ejecuta la aplicación web desde `apps/web`.
- El motor comercial TypeScript recalcula en el servidor antes de guardar o exportar.

```text
Navegador → Next.js / Route Handlers → Supabase Auth, PostgreSQL y Storage
```

## Frontera de seguridad

- El navegador sólo recibe la URL de Supabase y su clave pública.
- La service role se importa exclusivamente desde módulos marcados `server-only`.
- Las lecturas del usuario están limitadas mediante RLS.
- Las escrituras privilegiadas requieren una sesión activa y un rol autorizado.
- `/login`, `/api/auth/*` y `/api/health` son las únicas rutas públicas.
- Los archivos se suben directamente a un bucket privado mediante URL firmada; Vercel los procesa desde el servidor.

## Organización

- `app`: rutas, páginas, layouts y endpoints.
- `components`: interfaz agrupada por dominio funcional.
- `lib/domain`: reglas y cálculos puros con pruebas colocadas junto al código.
- `lib/server`: acceso a datos, auditoría, entorno y clientes privilegiados.
- `lib/client`: integraciones permitidas en el navegador.
- `lib/config`: constantes y configuración compartida no sensible.

## Importaciones

Cada lote comienza como `processing`. Sólo pasa a `committed` cuando todas sus filas se guardaron; ante una falla queda `failed`. Las consultas usan exclusivamente el último lote confirmado.

