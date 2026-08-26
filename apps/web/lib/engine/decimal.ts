// Aritmética decimal exacta para el motor comercial.
// Sin float, sin redondeo comercial: se conserva precisión y la presentación
// (dos decimales) se resuelve solo en la capa de formato.
import Decimal from "decimal.js";

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
export const HUNDRED = new Decimal(100);

/** Convierte un valor de entrada a Decimal, o null si está vacío. */
export function parseDecimalOrNull(value: string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw === "") return null;
  return new Decimal(raw);
}

/** Serializa un Decimal a string de precisión plena (sin notación exponencial). */
export function toStr(value: Decimal | null): string | null {
  return value === null ? null : value.toFixed();
}
