# Empezar el desarrollo en Codex

## 1. Abrir el proyecto

Usá como workspace:

```text
C:\Users\Alexis\Documents\TablasBrugali
```

El archivo `AGENTS.md` de la raíz se cargará automáticamente y le indicará a Codex qué documentos leer y qué reglas no puede improvisar.

## 2. Crear una tarea nueva

En Codex, creá una tarea usando ese workspace y pegá este mensaje:

```text
Continuá la implementación del MVP de costos y precios de Brugali. Leé primero AGENTS.md, docs/CODEX_START_HERE.md y docs/MVP_IMPLEMENTATION_BRIEF.md completos. El código actual es un scaffold parcial y no está verificado: auditá su estado, corregí lo necesario y completá el primer corte vertical carga → validación → análisis → simulación → exportación. No publiques servicios externos. Trabajá localmente, mantené un plan visible y no declares finalizado hasta que typecheck, lint, pruebas del backend y el recorrido de aceptación estén aprobados.
```

## 3. Qué existe actualmente

- Un backend FastAPI parcial con dominio, importación, persistencia, endpoints y exportación.
- Una interfaz Next.js parcial con login, navegación, importación y tabla de análisis.
- El logo oficial copiado en `apps/web/public/brand/brugali-logo.jpg`.
- Documentación de arquitectura y reglas funcionales.

El estado actual **no es una entrega ejecutable**. Faltan componentes, estilos, dependencias, migraciones y pruebas. El primer trabajo de Codex debe ser ejecutar un diagnóstico, no asumir que el scaffold compila.

## 4. Fuente de datos

Archivo inicial:

```text
C:\Users\Alexis\Downloads\BD Lista de precios.xlsx
```

La planilla se usa para pruebas manuales y conciliación. No debe copiarse al repositorio ni incluirse en imágenes o contenedores.

## 5. Logo y sistema visual

Fuente original:

```text
C:\Users\Alexis\Downloads\brugalico_logo.jpg
```

Copia del proyecto:

```text
apps/web/public/brand/brugali-logo.jpg
```

Codex debe mantener la paleta y las reglas de uso indicadas en `AGENTS.md`.

## 6. Entrega esperada de la primera tarea

- Aplicación local iniciable con instrucciones claras.
- Usuario administrador creado mediante variables de entorno, sin contraseña comprometida.
- Importación del Excel real con vista previa.
- Detección visible de ceros, estados desconocidos y duplicados.
- Consulta por lista y fecha.
- Simulador de doble vía con aritmética decimal.
- Exportación analítica con tres hojas.
- Pruebas automáticas y evidencia del recorrido completo.

