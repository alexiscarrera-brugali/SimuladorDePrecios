# Reglas de negocio confirmadas

## Fórmula comercial

El indicador denominado “margen” por el negocio es ganancia o recargo sobre costo.

- Ganancia en pesos = precio − costo.
- Ganancia porcentual = ganancia en pesos / costo × 100.
- Precio desde porcentaje = costo × (1 + porcentaje / 100).
- Precio desde importe = costo + ganancia en pesos.
- No se aplica redondeo comercial. Se conserva precisión decimal y la pantalla presenta dos decimales.

## Vigencia

Para una fecha de consulta se usa el registro cuya vigencia sea la más reciente que no supere esa fecha. El precio se resuelve por sucursal, lista y producto; el costo por sucursal y producto.

## Duplicados

- Misma clave, fecha y valor: advertencia, consolidación para cálculo y trazabilidad completa.
- Misma clave y fecha con valores diferentes: conflicto. La fila permanece visible y su simulación queda bloqueada.
- Nunca se elige un valor automáticamente para resolver un conflicto.

## Datos problemáticos

Los registros con cero, vacíos, estado inactivo o desconocido nunca se ocultan.

- Costo cero: permite precio o ganancia en pesos; el porcentaje no es calculable.
- Costo ausente: permite registrar precio, sin derivar ganancias.
- Precio cero con costo válido: equivale a −100%.
- Precio ausente: puede simularse desde costo y ganancia.
- Inactivo o desconocido: permite simular con advertencia permanente.
- Sin objetivo: permite simular con termómetro neutro.

## Objetivo teórico

Sólo se aplica una coincidencia exacta entre lista y producto. Los registros con código `varios` generan `objective_mapping_ambiguous` y no se aplican hasta que Sofía Masera confirme su significado.

## Exportación

El MVP genera un Excel analítico con `Resultados`, `Observaciones` y `Metadatos`. No se considera todavía un archivo apto para actualizar TOTVS.

