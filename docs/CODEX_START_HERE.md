# Inicio de trabajo en Codex

## Workspace

Abrir `C:\Users\Alexis\Documents\TablasBrugali`. Antes de modificar código, leer `AGENTS.md`, `docs/reglas-de-negocio.md`, `docs/arquitectura.md` y `docs/puesta-en-marcha.md`.

## Estado de la solución

- La aplicación vive en `apps/web` y usa Next.js, TypeScript y Supabase.
- Los endpoints se implementan como Route Handlers dentro de `apps/web/app/api`.
- El motor comercial está en `apps/web/lib/domain` y usa aritmética decimal.
- Las migraciones y políticas de acceso están en `supabase/migrations`.
- El archivo comercial de prueba permanece fuera del repositorio.

La arquitectura inicial basada en un servicio Python fue reemplazada. Su brief se conserva únicamente como antecedente en `docs/archive` y no debe usarse como guía operativa.

## Verificación obligatoria

Antes de entregar un cambio ejecutar, dentro de `apps/web`:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Para cambios de despliegue, validar primero una URL Preview de Vercel y completar login, importación, análisis, simulación y exportación antes de promoverla.

