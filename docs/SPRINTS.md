# Estado de implementación

## Base completada

- Arquitectura Next.js + Supabase.
- Motor comercial TypeScript con aritmética decimal.
- Migraciones, RLS, autenticación y roles.
- Importación con URL firmada, preview y confirmación.
- Análisis, observaciones, simulador, histórico y exportación analítica.

## Recuperación de despliegue

- [x] Normalizar `apps/web` dentro del repositorio.
- [x] Versionar la capa de acceso a datos que estaba ignorada.
- [x] Alinear estructura y documentación con la arquitectura vigente.
- [ ] Completar typecheck, lint, Vitest y build de producción.
- [ ] Vincular el proyecto Vercel existente y configurar sus variables.
- [ ] Validar Preview Deployment.
- [ ] Completar aceptación con Tomás Garzón y conciliación con Sofía Masera.

## Posterior al MVP

- Integración automática con TOTVS.
- Formato de actualización aprobado para TOTVS.
- Flujo de aprobaciones, alertas y monitoreo operativo.
- Pruebas de carga y observabilidad productiva.

Cada corte se considera terminado solamente con controles locales en verde y un recorrido funcional verificable.
