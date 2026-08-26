# Reconciliación de datos — detección de duplicados

**Fecha:** 26 de agosto de 2026
**Fuente:** `BD Lista de precios.xlsx` (2.054 precios · 853 costos · 10 listas)

## Objetivo

Verificar que la detección de conflictos del sistema coincide con la evidencia
documentada en el anexo técnico y explicar una discrepancia observada.

## Discrepancia investigada

- El **pipeline anterior (Python, retirado)** reportó **329 conflictos** sobre el
  Excel real.
- El anexo técnico documenta, con revisión humana, **7 claves duplicadas en BD_LP:
  6 conflictivas y 1 idéntica** (DUP‑01…07). No analizó duplicados en SB1.

## Método

Se comparó, de forma **independiente del importador**, una agrupación cruda de las
hojas contra el resultado del importador nuevo (TypeScript):

- Precios `BD_LP` por `(Sucursal, Cod. Tabla, Cod.Producto, Vigencia)`.
- Costos `SB1` por `(Sucursal, Codigo, Vigencia)`.

## Resultado

| Control | Crudo (independiente) | Importador TS | Anexo |
|---|---|---|---|
| BD_LP claves con >1 fila | 7 | 7 | 7 |
| BD_LP conflictivas | **6** | **6** | 6 |
| BD_LP idénticas | **1** | **1** | 1 |
| SB1 claves con >1 fila | **0** | **0** | (no analizado) |

El importador nuevo coincide **exactamente** con la verdad cruda y con la evidencia
del anexo. Los *warnings* de calidad totales (1.373) también coinciden con el pipeline
anterior; la única diferencia estaba en los conflictos.

## Conclusión

- La cifra de **329 conflictos** del pipeline anterior era un **sobreconteo (~55×)**.
  La causa más probable: agrupar el historial de costos de `SB1` sin considerar la
  fecha de vigencia, tomando **cambios de costo legítimos a lo largo del tiempo** como
  si fueran conflictos.
- `SB1` **no** contiene duplicados de misma clave y fecha: los **0** conflictos de
  costo son correctos, no una omisión.
- La detección vigente reporta **6 conflictos reales**, todos en `BD_LP`, trazables a
  las filas de origen. Esto evita alarmar al negocio con falsos positivos.

## Los 6 conflictos reales (BD_LP · vigencia 2026‑07‑03)

| Lista | Producto | Valores en conflicto |
|---|---|---|
| 1 · Franquicias Córdoba | L1000779 | 5.695,25 / 5.900,00 |
| 2 · Franquicias Interior | L1000675 | 678.733,32 / 1.357.466,00 |
| 2 · Franquicias Interior | L1000711 | 90.000,00 / 171.945,70 |
| 2 · Franquicias Interior | L1000725 | 35.000,00 / 125.695,46 |
| 2 · Franquicias Interior | L1000760 | 260.000,00 / 260.330,53 |
| 3 · Franquicias Neuquén | L1000779 | 5.695,25 / 5.900,00 |

Duplicado idéntico (se consolida, se advierte): Lista 2 · L1000763 · 1.245.000,00 (dos filas).
