# MVP de costos y precios · Brief de implementación

**Fecha:** 25 de agosto de 2026  
**Decisión funcional:** Sofía Masera  
**Validación ejecutiva:** Tomás Garzón  
**Proveedor y desarrollo:** Alexis Carrera  
**Origen:** propuesta ejecutiva, anexo técnico, backlog y devolución funcional sobre el Excel base.  
**Estado:** alcance cerrado para el primer corte vertical; scaffold parcial, aún no verificado.

## 1. Qué se está construyendo

Una aplicación web privada para importar la planilla comercial de Brugali, explicar sus problemas de calidad, obtener precio y costo vigentes por fecha, comparar la ganancia real contra un objetivo, simular en doble vía y exportar un Excel analítico sin modificar la fuente original.

El primer corte debe completar este recorrido real:

```text
iniciar sesión → cargar Excel → revisar problemas → confirmar lote
→ elegir lista y fecha → abrir producto → simular → exportar
```

## 2. Decisión arquitectónica

La solución se separa en Next.js, FastAPI y PostgreSQL para que la futura integración con TOTVS reemplace la entrada de datos sin rehacer la interfaz ni el motor comercial.

- **Tenancy:** una sola empresa, Brugali.
- **Acceso:** roles `admin_importer`, `functional` y `tester`.
- **Datos:** FastAPI es la autoridad. Next.js no consulta la base directamente.
- **Persistencia:** PostgreSQL; SQLite es un adaptador local temporal.
- **Auditoría:** importación confirmada, simulación guardada y exportación.
- **Render:** Server Components por defecto; cliente sólo para interacción genuina.
- **Infraestructura:** contenedores locales. No contratar ni publicar servicios externos en este corte.

Se descartó una aplicación sólo Python porque implicaría renovar después la interfaz. Vercel + Supabase, Azure y Google Cloud permanecen fuera de la implementación inicial.

## 3. Estado actual y componentes

El scaffold se inició antes de preparar este handoff y debe auditarse antes de continuar.

| Área | Ubicación | Estado real |
|---|---|---|
| Reglas comerciales | `apps/api/app/domain/` | Implementación inicial; requiere pruebas exhaustivas. |
| Lectura del Excel | `apps/api/app/services/importer.py` | Implementación inicial; probar contra el archivo real. |
| Persistencia | `apps/api/app/db/` | Modelos iniciales; faltan Alembic y prueba PostgreSQL. |
| API | `apps/api/app/api/` | Endpoints iniciales; faltan pruebas, endurecimiento y correcciones. |
| Exportación | `apps/api/app/services/exports.py` | Implementación inicial; verificar tipos y formato visual. |
| Login y proxy | `apps/web/app/` | Parcial; no verificado. |
| Dashboard | `apps/web/components/Dashboard.tsx` | Parcial; depende de componentes y estilos ausentes. |
| Simulador visual | `apps/web/components/SimulatorPanel.tsx` | No existe. |
| Sistema visual | `apps/web/app/globals.css` | No existe. |
| Pruebas | `apps/api/tests`, pruebas web | No existen. |
| Dependencias | lockfiles / entornos | No instaladas ni fijadas. |

### Componentes que deben completarse

#### `SimulatorPanel`

```ts
type SimulatorPanelProps = {
  row: AnalysisRow;
  queryDate: string;
  onClose: () => void;
  onChange: (simulation: SimulationPayload) => void;
};
```

Estructura visual:

```text
producto + estado + cerrar
├── costo, precio actual y objetivo
├── selector conductor: precio | ganancia $ | ganancia %
├── campo numérico + deslizador adaptable
├── resultados derivados
├── termómetro y diferencias
├── advertencias explicadas
└── histórico escalonado de costo y precio
```

#### `HistoryChart`

Debe recibir series de precio y costo con fecha, ordenar los puntos y representarlos como escalones. Los conflictos se muestran como interrupción o marcador, no como una línea inventada.

#### Sistema visual

Crear `apps/web/app/globals.css` usando las variables de marca definidas en `AGENTS.md`. El motivo formal nace de las piezas redondeadas apiladas del isotipo. Mantener fondo marfil, tinta cálida y alta densidad de información sin apariencia genérica.

## 4. Integración exacta

- `apps/web/app/page.tsx` obtiene usuario y listas desde FastAPI y entrega ambos a `Dashboard`.
- `Dashboard` consulta `/api/backend/analysis` y abre `SimulatorPanel` al seleccionar una fila.
- `SimulatorPanel` calcula localmente mediante `apps/web/lib/simulation.ts`.
- Al guardar, envía el mismo contrato a `/api/backend/simulations/save`.
- FastAPI recalcula mediante `apps/api/app/domain/simulation.py` y prevalece ante diferencias.
- La exportación recibe las simulaciones visibles y vuelve a calcularlas en el servidor.
- La carga usa `/imports/preview` y sólo persiste después de `/imports/{preview_id}/commit`.
- Todas las consultas de vigencia utilizan el último lote confirmado y la fecha solicitada.

## 5. Entradas secundarias

- Navegación lateral: `Análisis`, `Observaciones`, `Importar base`.
- La métrica de advertencias debe abrir o filtrar observaciones.
- Una fila de análisis abre el simulador del producto.
- La exportación está disponible en la cabecera del análisis.
- No agregar navegación o módulos ajenos a este recorrido.

## 6. Textos de interfaz

Textos bloqueados:

- “La falla se muestra, no se tapa.”
- “Todos, sin ocultar” para el filtro general.
- “Los conflictos seguirán visibles y bloquearán únicamente la fila afectada.”
- “Archivo analítico; no apto para carga automática en TOTVS.”
- Usar “ganancia” cuando se explique la fórmula; mantener “margen” cuando se reproduzca el lenguaje comercial de las tablas.

Los mensajes técnicos deben traducirse a explicaciones humanas. El código interno puede conservar identificadores como `conflicting_duplicate`, pero la pantalla debe mostrar “Hay dos valores distintos para la misma lista, producto y fecha”.

## 7. Reglas bloqueadas

### Fórmulas

- `ganancia_$ = precio − costo`
- `ganancia_% = ganancia_$ / costo × 100`
- `precio = costo × (1 + ganancia_% / 100)`
- `precio = costo + ganancia_$`
- No usar `float` ni redondeo comercial.

### Vigencias

Seleccionar la mayor vigencia menor o igual a la fecha consultada. El precio se resuelve por sucursal, lista y producto; el costo por sucursal y producto.

### Duplicados

- Igual clave, fecha y valor: consolidar para calcular, advertir y conservar origen.
- Igual clave y fecha con valores diferentes: conflicto y bloqueo exclusivo de esa fila.
- Nunca seleccionar primero, último, mínimo o máximo automáticamente.

### Ceros, vacíos y estados

- Ningún registro desaparece.
- Costo cero: precio o ganancia en pesos permitidos; porcentaje no calculable.
- Costo vacío: sólo precio manual; ganancias no calculables.
- Precio cero con costo válido: −100%.
- Inactivo o desconocido: simulación permitida con advertencia.
- Conflicto: simulación bloqueada.
- Sin objetivo: simulación permitida y termómetro neutro.

### Objetivos

Aplicar solamente lista + producto exactos. `varios` genera `objective_mapping_ambiguous`; no funciona como valor general hasta una nueva confirmación funcional.

## 8. Accesibilidad

- Contraste mínimo WCAG AA para texto y estados.
- No depender solamente del color: cada estado lleva ícono y etiqueta.
- Orden de foco coherente en importación, filtros, tabla y panel lateral.
- `Escape` cierra el simulador y devuelve el foco a la fila que lo abrió.
- Tabla navegable por teclado; controles con nombre accesible.
- Errores anunciados mediante `role="alert"`.
- Deslizadores acompañados por entrada numérica y valor textual.
- Respetar `prefers-reduced-motion`.

## 9. Pruebas

### Dominio

- Costo 100 + 25% = ganancia 25 y precio 125.
- Costo 100 + precio 130 = ganancia 30 y 30%.
- Costo 100 + ganancia 40 = precio 140 y 40%.
- Ideal 25%, simulado 20% = rojo, −5 pesos y −5 puntos.
- Ideal 25%, simulado 30% = verde, +5 pesos y +5 puntos.
- Costo cero nunca divide por cero.
- Porcentaje menor a −100 y precio negativo se rechazan.

### Datos

- Probar vigencia antes, en y después de cada cambio.
- Probar duplicado idéntico y conflictivo.
- Probar estados `Si`, `No` y vacío de ambas fuentes.
- Probar `varios` como objetivo ambiguo.
- Conciliar ejemplos reales del Excel, incluyendo las claves duplicadas documentadas en el backlog.

### Integración

- Login permitido y denegado.
- Tester no puede confirmar importaciones.
- Preview no persiste datos.
- Commit crea lote y auditoría.
- Simulación guardada no modifica fuentes.
- Exportación contiene `Resultados`, `Observaciones` y `Metadatos`.
- Ningún secreto o dato completo aparece en logs.

### Aceptación

Tomás Garzón completa carga → revisión → análisis → simulación → exportación. Sofía Masera concilia una muestra contra el Excel fuente.

## 10. Qué no se construye

- Integración automática con TOTVS.
- Archivo de actualización apto para TOTVS.
- Publicación en Internet.
- Contratación de Vercel, Supabase, Azure o Google Cloud.
- Power BI.
- Alertas por correo o mensajería.
- Flujo de aprobaciones comerciales.
- Escenarios persistentes complejos.
- Analítica predictiva o recomendaciones automáticas.
- Multiempresa o franquiciados como tenants independientes.

## 11. Sprint y estimación

Estimación total restante: **60–76 horas**.

- Diagnóstico, dependencias y reparación del scaffold: 5–7 h.
- Motor, importación y persistencia: 14–18 h.
- API, permisos, auditoría y exportación: 10–12 h.
- Interfaz, simulador, histórico y sistema visual: 20–24 h.
- Pruebas, correcciones y documentación operativa: 11–15 h.

El primer corte vertical verificable debe alcanzarse en 18–24 horas de trabajo antes de ampliar detalles visuales o productivos.

## 12. Prompt de inicio sugerido

```text
Continuá la implementación del MVP de costos y precios de Brugali siguiendo AGENTS.md y docs/MVP_IMPLEMENTATION_BRIEF.md; empezá auditando el scaffold parcial y completá el corte carga → validación → análisis → simulación → exportación con pruebas, sin publicar servicios externos.
```

