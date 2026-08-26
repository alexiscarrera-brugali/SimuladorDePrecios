# Instrucciones del proyecto para Codex

## Antes de modificar código

1. Leer `docs/CODEX_START_HERE.md`.
2. Leer completamente `docs/MVP_IMPLEMENTATION_BRIEF.md`.
3. Leer `docs/reglas-de-negocio.md` y `docs/arquitectura.md`.
4. Revisar el estado real del código: el scaffold existente es parcial y no debe asumirse compilable.
5. Mantener un plan visible y ejecutar por cortes verticales verificables.

## Reglas bloqueadas

- El porcentaje comercial es ganancia sobre costo, no margen sobre precio.
- No aplicar redondeo comercial. Usar aritmética decimal.
- Un duplicado conflictivo bloquea sólo la fila afectada y nunca se resuelve automáticamente.
- Ceros, vacíos, inactivos y estados desconocidos permanecen visibles.
- `varios` en `Margen_teorico` no se aplica automáticamente.
- El Excel generado por el MVP es analítico y no debe presentarse como archivo apto para TOTVS.
- No mencionar ni incorporar Power BI.

## Arquitectura

- Single-tenant: Brugali.
- `apps/web`: Next.js, TypeScript, Server Components por defecto.
- `apps/api`: FastAPI, SQLAlchemy, Pydantic y Alembic.
- PostgreSQL como destino; SQLite permitido únicamente para desarrollo local y pruebas.
- La interfaz nunca accede directamente a la base de datos.
- Secretos, archivos importados y exportaciones quedan fuera de Git.
- Autenticación obligatoria salvo `/health`.

## Sistema visual

La identidad nace de `apps/web/public/brand/brugali-logo.jpg`.

- Tinta: `#1D1D1B`.
- Azul petróleo: `#224957`.
- Turquesa: `#379B8C`.
- Amarillo: `#E5AD29`.
- Naranja: `#EA782E`.
- Rojo: `#E43023`.
- Fondo marfil: `#F7F5EF`.

Usar turquesa para estados correctos, amarillo/naranja para advertencias y rojo exclusivamente para conflictos o errores. La estética debe ser editorial, sobria y accesible; evitar dashboards genéricos y gradientes morados.

## Calidad y seguridad

- Validar entradas tanto en Next.js como en FastAPI.
- No usar `float` para cálculos comerciales.
- No registrar planillas completas, credenciales ni valores comerciales sensibles en logs.
- Auditar importaciones confirmadas, simulaciones guardadas y exportaciones.
- Agregar pruebas antes de declarar una funcionalidad terminada.
- Ejecutar typecheck, lint, pruebas del backend y un recorrido de aceptación antes de finalizar.

## Forma de trabajo

- Preservar cambios existentes que no pertenezcan a la tarea.
- No borrar el scaffold parcial sin justificarlo; corregirlo incrementalmente.
- No publicar ni contratar infraestructura externa.
- Si falta una definición funcional, mostrar el estado como pendiente o ambiguo; nunca inventar una regla silenciosa.

