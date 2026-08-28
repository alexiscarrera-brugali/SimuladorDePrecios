// Detección de capacidades de datos a partir de las columnas de la planilla.
// Las features que dependen de volumen de ventas o de categoría/rubro se
// construyen igual, pero se muestran bloqueadas hasta que la fuente trae la
// columna correspondiente. Al detectarse, se habilitan sin cambios de código.

export interface DataCapabilities {
  /** Hay volumen/cantidad de ventas → margen ponderado por ingreso, ABC/Pareto. */
  hasVolume: boolean;
  /** Hay categoría/rubro/familia → segmentación de cartera. */
  hasCategory: boolean;
}

export const NO_CAPABILITIES: DataCapabilities = { hasVolume: false, hasCategory: false };

// Alias aceptados (se comparan normalizados: sin acentos, minúsculas, sin signos).
export const VOLUME_COLUMN_ALIASES = ["cantidad", "volumen", "unidades vendidas", "qty", "cantidad vendida"];
export const CATEGORY_COLUMN_ALIASES = ["rubro", "categoria", "familia", "linea", "segmento"];

const COMBINING_MARKS = /[̀-ͯ]/g;

function normalize(header: string): string {
  return header
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(headers: string[], aliases: string[]): boolean {
  const set = new Set(headers.map(normalize));
  return aliases.some((alias) => set.has(normalize(alias)));
}

/** Deriva las capacidades a partir de los encabezados presentes en la planilla. */
export function detectCapabilities(headers: Iterable<string>): DataCapabilities {
  const list = [...headers];
  return {
    hasVolume: matchesAny(list, VOLUME_COLUMN_ALIASES),
    hasCategory: matchesAny(list, CATEGORY_COLUMN_ALIASES),
  };
}
