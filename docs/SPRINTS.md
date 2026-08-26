# Plan de sprints — Herramienta corporativa de costos y precios

**Stack cerrado:** Next.js (Vercel) + Supabase (Postgres, Auth, Storage). Cómputo de
negocio en TypeScript sobre Route Handlers/Server Actions. Sin FastAPI.

**Modo de entrega:** todo listo-para-deploy y verificado localmente; la creación del
proyecto Supabase y el deploy a Vercel se hacen juntos en un *gate* acordado.

**Reglas comerciales:** bloqueadas por `AGENTS.md` (% sobre costo, sin redondeo,
conflicto bloquea solo su fila, `varios` ambiguo, etc.). Precisión `NUMERIC(20,8)`.

---

## Estado de sprints

### Sprint 0 — Fundaciones y motor (en curso)
- [x] Resolver disco (artefactos pesados a E: vía junction; C: liberado).
- [x] Decidir arquitectura (Next.js + Supabase) y modo de deploy (gate).
- [ ] Dependencias del nuevo stack (@supabase/ssr, supabase-js, vitest).
- [ ] Portar el motor comercial a TypeScript con pruebas (vitest) equivalentes a los 39 tests de pytest.
- [ ] Clientes Supabase (server, browser, admin service-role solo backend).
- [ ] Migraciones Supabase: esquema normalizado + RLS + funciones.
- [ ] Auth con Supabase (login, middleware de sesión, roles).
- [ ] Retirar FastAPI una vez el motor TS alcanza paridad y verde.
- [ ] CI (typecheck + lint + vitest + escaneo de secretos).

### Sprint 1 — Datos & calidad
- [ ] Pipeline de importación: subida a Storage con URL firmada → parse → preview → commit idempotente.
- [ ] Detección de calidad (ceros, vacíos, inactivos/desconocidos, duplicados).
- [ ] **Reconciliación 329 vs 7**: cuadrar nuestra detección de conflictos con la evidencia documentada (DUP-01…07 en BD_LP; verificar aporte de SB1/sucursal/lista).
- [ ] Auditoría de importaciones (lote, huella SHA-256, responsable, conteos).

### Sprint 2 — Motor de consulta
- [ ] Vigencias (mayor ≤ fecha) para precio (sucursal+lista+producto) y costo (sucursal+producto).
- [ ] Margen, objetivo y estados como autoridad de servidor.
- [ ] Pruebas de vigencia (antes/en/después) y estados.

### Sprint 3 — Análisis & Observaciones
- [ ] Tabla por lista/fecha, filtros de estado, búsqueda.
- [ ] Vista de observaciones (calidad) trazable a filas de origen.

### Sprint 4 — Simulador
- [ ] Doble vía (precio / ganancia $ / ganancia %) con aritmética decimal.
- [ ] Histórico escalonado (sin interpolación) y termómetro.
- [ ] Accesibilidad (Escape, foco, role=alert, deslizador + numérico).

### Sprint 5 — Exportación & Auditoría
- [ ] Excel/CSV con precisión, fórmulas neutralizadas, tres hojas.
- [ ] Auditoría de simulaciones guardadas y exportaciones.

### Sprint 6 — Seguridad & escala
- [ ] RLS probada por rol; `service-role` solo en backend.
- [ ] Headers de seguridad, rate limiting, validación server-side doble.
- [ ] Observabilidad básica y prueba de volumen.

### Sprint 7 — Deploy & aceptación
- [ ] Gate de provisión: crear proyecto Supabase, aplicar migraciones, deploy a Vercel.
- [ ] Recorrido de aceptación (Tomás/Sofía) y conciliación de muestra.
- [ ] Documentación operativa y de entrega.

---

## Definición de "hecho" por sprint
Cada sprint cierra con: `typecheck` + `lint` + `vitest` en verde, un commit descriptivo,
y evidencia del comportamiento (pruebas o recorrido). No se declara terminado sin eso.
