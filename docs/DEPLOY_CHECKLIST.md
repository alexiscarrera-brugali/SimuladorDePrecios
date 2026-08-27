# Checklist de despliegue en Vercel

## Antes del Preview

- [x] `apps/web` es una carpeta real dentro del repositorio.
- [x] La capa `lib/server/data` está versionada.
- [x] Typecheck, lint, Vitest y build local están en verde.
- [x] La auditoría de dependencias de producción informa cero vulnerabilidades.
- [x] No hay tokens de Vercel en el árbol ni en el historial Git.
- [ ] Revocar el token compartido fuera del repositorio.
- [x] Iniciar sesión mediante `vercel login` y confirmar la integración GitHub existente.
- [x] Configurar `apps/web` como Root Directory.
- [x] Cargar las variables de Preview y Production; la service role queda marcada como sensible.
- [ ] Aplicar `0002_import_batch_status.sql` en Supabase.
- [ ] Registrar en Supabase las URLs de localhost, Preview y producción.

## Validación del Preview

- [x] `GET /api/health` responde 200.
- [x] La portada sin sesión redirige a `/login`.
- [x] Las APIs protegidas responden 401 sin sesión.
- [ ] Un usuario válido puede iniciar y cerrar sesión.
- [ ] Un archivo distinto de `.xlsx`, vacío o mayor a 25 MB es rechazado.
- [ ] Carga, preview y confirmación generan un lote `committed` y auditoría.
- [ ] Análisis, simulación e histórico consultan el último lote confirmado.
- [ ] La exportación abre y conserva Resultados, Observaciones y Metadatos.
- [ ] Los logs no contienen secretos, planillas completas ni valores comerciales innecesarios.

## Promoción y reversión

- [ ] Tomás Garzón completa el recorrido funcional.
- [ ] Sofía Masera concilia la muestra seleccionada.
- [ ] Promover el deployment validado, sin recompilar código distinto.
- [ ] Observar errores y tiempos de respuesta durante los primeros 15 minutos.
- [ ] Ante fallas de autenticación, importación o exportación, restaurar el deployment estable anterior.
