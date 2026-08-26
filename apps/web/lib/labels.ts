// Traducción de identificadores técnicos a lenguaje humano.
// El código interno conserva claves como `conflicting_duplicate`, pero la
// pantalla siempre muestra una explicación comprensible (brief §6).

export const warningLabels: Record<string, string> = {
  identical_duplicate: "Duplicado idéntico",
  conflicting_duplicate: "Valores en conflicto",
  zero_value: "Valor cero",
  zero_cost: "Costo cero",
  zero_price: "Precio cero",
  missing_value: "Dato vacío",
  missing_cost: "Costo vacío",
  missing_price: "Precio vacío",
  negative_cost: "Costo negativo",
  negative_price: "Precio negativo",
  inactive_source: "Registro inactivo",
  unknown_source_status: "Estado desconocido",
  mixed_source_status: "Estados mezclados",
  missing_ideal_margin: "Sin objetivo exacto",
  ideal_not_calculable: "Objetivo no calculable",
  percentage_not_calculable: "Porcentaje no calculable",
  driver_requires_cost: "Requiere costo",
  objective_mapping_ambiguous: "Objetivo ‘varios’ pendiente",
  invalid_price_row: "Fila de precio inválida",
  invalid_cost_row: "Fila de costo inválida",
};

export const warningExplanations: Record<string, string> = {
  identical_duplicate:
    "La misma lista, producto y fecha aparece más de una vez con igual valor; se consolida para calcular y se conserva el origen.",
  conflicting_duplicate:
    "Hay dos valores distintos para la misma lista, producto y fecha. La fila queda visible pero su simulación se bloquea.",
  zero_value: "El valor vigente es cero.",
  zero_cost: "El costo es cero: se puede fijar precio o ganancia en pesos, pero no el porcentaje.",
  zero_price: "El precio vigente es cero. Con costo válido equivale a −100% de ganancia.",
  missing_value: "No hay un valor vigente para la fecha consultada.",
  missing_cost: "No hay costo vigente: sólo se puede fijar un precio manual.",
  missing_price: "No hay precio vigente: puede simularse desde el costo y la ganancia.",
  negative_cost: "El costo cargado es negativo; revisar la fuente.",
  negative_price: "El precio cargado es negativo; revisar la fuente.",
  inactive_source: "El registro está marcado como inactivo. Se permite simular con advertencia.",
  unknown_source_status:
    "El estado está vacío o no se reconoce; no se interpreta como inactivo, pero se avisa.",
  mixed_source_status: "Los registros de la misma clave tienen estados distintos.",
  missing_ideal_margin:
    "No hay un objetivo exacto de lista y producto; el termómetro queda neutro.",
  ideal_not_calculable: "El objetivo no puede calcularse sin un costo válido.",
  percentage_not_calculable: "Con costo cero no se puede calcular el porcentaje de ganancia.",
  driver_requires_cost: "Ese conductor necesita un costo válido para derivar el resultado.",
  objective_mapping_ambiguous:
    "El objetivo cargado como ‘varios’ no se aplica automáticamente hasta confirmar su significado.",
  invalid_price_row: "No se pudo interpretar el precio de esta fila.",
  invalid_cost_row: "No se pudo interpretar el costo de esta fila.",
};

export function labelFor(key: string): string {
  return warningLabels[key] ?? key;
}

export function explain(key: string): string {
  return warningExplanations[key] ?? warningLabels[key] ?? key;
}
