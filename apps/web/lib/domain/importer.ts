// Importador de la planilla comercial (4 hojas) — parser + detección de calidad.
// Port fiel de la lógica de dominio Python. No modifica la fuente.
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { Decimal } from "./decimal";
import type { SourceStatus } from "./types";
import { detectCapabilities, type DataCapabilities } from "./capabilities";

export const REQUIRED_COLUMNS: Record<string, string[]> = {
  BD_LP: ["Sucursal", "Cod. Tabla", "Cod.Producto", "Precio Venta", "Vigencia", "Activo"],
  SB1: ["Sucursal", "Codigo", "Descripcion", "Costo Estand", "Vigencia", "Desactivado?"],
  Mapeo_Listas: ["Cod. Tabla", "Descripcion"],
  Margen_teorico: ["Lista", "Código", "Descripción", "Margen"],
};

export type Severity = "warning" | "conflict";

export interface ParsedIssue {
  issueType: string;
  severity: Severity;
  sheetName: string;
  businessKey: string;
  explanation: string;
  sourceRows: number[];
  values: (string | null)[];
}

export interface PriceRecord {
  branchCode: string;
  priceListCode: string;
  productCode: string;
  value: Decimal | null;
  validFrom: string;
  sourceStatus: SourceStatus;
  sourceRow: number;
  origin?: string | null;
}

export interface CostRecord {
  branchCode: string;
  productCode: string;
  description: string | null;
  value: Decimal | null;
  validFrom: string;
  sourceStatus: SourceStatus;
  sourceRow: number;
}

export interface MarginRecord {
  priceListName: string;
  productCode: string;
  percentage: Decimal | null;
  isAmbiguous: boolean;
  sourceRow: number;
}

export interface ParsedWorkbook {
  sha256: string;
  priceLists: { code: string; description: string }[];
  prices: PriceRecord[];
  costs: CostRecord[];
  margins: MarginRecord[];
  issues: ParsedIssue[];
  capabilities: DataCapabilities;
  summary: {
    priceRows: number;
    costRows: number;
    marginRows: number;
    priceLists: number;
    warnings: number;
    conflicts: number;
  };
}

// Normalización de valores de origen.

export function normalizeCode(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (typeof value === "number" && Number.isFinite(value) && value === Math.trunc(value)) {
    return String(Math.trunc(value));
  }
  return String(value).trim();
}

export function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const s = value.trim();
    // Acepta ISO (YYYY-MM-DD[...]) directamente.
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  throw new Error(`Fecha inválida: ${JSON.stringify(value)}`);
}

/** Parser decimal comercial: maneja $, %, y coma/punto como Python parse_decimal. */
export function parseCommercialDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Decimal) return value;
  if (typeof value === "boolean") throw new Error("Un booleano no es un valor monetario");
  if (typeof value === "number") return new Decimal(String(value));
  let raw = String(value).trim().replace(/\$/g, "").replace(/\s/g, "");
  if (raw === "") return null;
  if (raw.endsWith("%")) raw = raw.slice(0, -1);
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  if (hasComma && hasDot) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    raw = raw.replace(",", ".");
  }
  try {
    return new Decimal(raw);
  } catch {
    throw new Error(`Valor decimal inválido: ${JSON.stringify(value)}`);
  }
}

export function priceStatus(value: unknown): SourceStatus {
  const n = String(value ?? "").trim().toLowerCase();
  if (["si", "sí", "s"].includes(n)) return "active";
  if (["no", "n"].includes(n)) return "inactive";
  return "unknown";
}

export function productStatus(value: unknown): SourceStatus {
  // Columna "Desactivado?": No → activo; Si → inactivo.
  const n = String(value ?? "").trim().toLowerCase();
  if (["no", "n"].includes(n)) return "active";
  if (["si", "sí", "s"].includes(n)) return "inactive";
  return "unknown";
}

// Lectura segura de celdas ExcelJS.

function cellValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("result" in obj) return obj.result ?? null; // celda con fórmula
    if ("text" in obj) return obj.text; // hyperlink / rich text plano
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((t) => t.text).join("");
    }
  }
  return raw;
}

interface SheetData {
  headers: string[];
  headerIndex: Record<string, number>;
  rows: { rowNumber: number; cells: unknown[] }[];
}

function readSheet(ws: ExcelJS.Worksheet): SheetData {
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  const headerIndex: Record<string, number> = {};
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const v = cellValue(cell.value);
    const name = v === null ? "" : String(v).trim();
    headers[colNumber] = name;
    if (name && !(name in headerIndex)) headerIndex[name] = colNumber;
  });

  const rows: { rowNumber: number; cells: unknown[] }[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber] = cellValue(cell.value);
    });
    rows.push({ rowNumber, cells });
  });
  return { headers, headerIndex, rows };
}

// Parser de las hojas requeridas.

export async function parseWorkbook(data: ArrayBuffer | Buffer): Promise<ParsedWorkbook> {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const present = new Set(workbook.worksheets.map((w) => w.name));
  const missingSheets = Object.keys(REQUIRED_COLUMNS).filter((s) => !present.has(s));
  if (missingSheets.length) {
    throw new Error(`Missing required sheets: ${missingSheets.sort().join(", ")}`);
  }

  const sheets: Record<string, SheetData> = {};
  for (const [name, required] of Object.entries(REQUIRED_COLUMNS)) {
    const sheet = readSheet(workbook.getWorksheet(name)!);
    const missingCols = required.filter((c) => !(c in sheet.headerIndex));
    if (missingCols.length) {
      throw new Error(`Sheet ${name} is missing columns: ${missingCols.sort().join(", ")}`);
    }
    sheets[name] = sheet;
  }

  // Mapeo_Listas
  const listSheet = sheets["Mapeo_Listas"];
  const priceLists: { code: string; description: string }[] = [];
  for (const { cells } of listSheet.rows) {
    const codeCell = cells[listSheet.headerIndex["Cod. Tabla"]];
    if (codeCell === null || codeCell === undefined) continue;
    priceLists.push({
      code: normalizeCode(codeCell),
      description: String(cells[listSheet.headerIndex["Descripcion"]] ?? "").trim(),
    });
  }

  const issues: ParsedIssue[] = [];

  // BD_LP → precios
  const lp = sheets["BD_LP"];
  const prices: PriceRecord[] = [];
  for (const { rowNumber, cells } of lp.rows) {
    try {
      prices.push({
        branchCode: normalizeCode(cells[lp.headerIndex["Sucursal"]]) || "1",
        priceListCode: normalizeCode(cells[lp.headerIndex["Cod. Tabla"]]),
        productCode: normalizeCode(cells[lp.headerIndex["Cod.Producto"]]),
        value: parseCommercialDecimal(cells[lp.headerIndex["Precio Venta"]]),
        validFrom: normalizeDate(cells[lp.headerIndex["Vigencia"]]),
        sourceStatus: priceStatus(cells[lp.headerIndex["Activo"]]),
        sourceRow: rowNumber,
      });
    } catch (error) {
      issues.push({
        issueType: "invalid_price_row",
        severity: "conflict",
        sheetName: "BD_LP",
        businessKey: `row:${rowNumber}`,
        explanation: (error as Error).message,
        sourceRows: [rowNumber],
        values: [],
      });
    }
  }

  // SB1 → costos
  const sb1 = sheets["SB1"];
  const costs: CostRecord[] = [];
  for (const { rowNumber, cells } of sb1.rows) {
    try {
      costs.push({
        branchCode: normalizeCode(cells[sb1.headerIndex["Sucursal"]]) || "1",
        productCode: normalizeCode(cells[sb1.headerIndex["Codigo"]]),
        description: String(cells[sb1.headerIndex["Descripcion"]] ?? "").trim() || null,
        value: parseCommercialDecimal(cells[sb1.headerIndex["Costo Estand"]]),
        validFrom: normalizeDate(cells[sb1.headerIndex["Vigencia"]]),
        sourceStatus: productStatus(cells[sb1.headerIndex["Desactivado?"]]),
        sourceRow: rowNumber,
      });
    } catch (error) {
      issues.push({
        issueType: "invalid_cost_row",
        severity: "conflict",
        sheetName: "SB1",
        businessKey: `row:${rowNumber}`,
        explanation: (error as Error).message,
        sourceRows: [rowNumber],
        values: [],
      });
    }
  }

  // Margen_teorico → objetivos
  const mt = sheets["Margen_teorico"];
  const margins: MarginRecord[] = [];
  for (const { rowNumber, cells } of mt.rows) {
    const productCode = normalizeCode(cells[mt.headerIndex["Código"]]);
    const isAmbiguous = productCode.toLowerCase() === "varios";
    const priceListName = String(cells[mt.headerIndex["Lista"]] ?? "").trim();
    const percentage = parseCommercialDecimal(cells[mt.headerIndex["Margen"]]);
    margins.push({ priceListName, productCode, percentage, isAmbiguous, sourceRow: rowNumber });
    if (isAmbiguous) {
      issues.push({
        issueType: "objective_mapping_ambiguous",
        severity: "warning",
        sheetName: "Margen_teorico",
        businessKey: `${priceListName}|varios`,
        explanation: "No se aplica hasta confirmar si 'varios' es un objetivo general.",
        sourceRows: [rowNumber],
        values: [percentage === null ? null : percentage.toFixed()],
      });
    }
  }

  issues.push(...qualityIssues(prices, "price"));
  issues.push(...qualityIssues(costs, "cost"));

  // Capacidades opcionales: se leen de las hojas de precio y costo, donde el
  // negocio podría sumar columnas de volumen o rubro sin romper el import.
  const capabilities = detectCapabilities([
    ...sheets["BD_LP"].headers,
    ...sheets["SB1"].headers,
  ].filter(Boolean));

  const summary = {
    priceRows: prices.length,
    costRows: costs.length,
    marginRows: margins.length,
    priceLists: priceLists.length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    conflicts: issues.filter((i) => i.severity === "conflict").length,
  };

  return { sha256, priceLists, prices, costs, margins, issues, capabilities, summary };
}

// Detección de problemas de calidad.

type AnyRecord = PriceRecord | CostRecord;

export function qualityIssues(records: AnyRecord[], kind: "price" | "cost"): ParsedIssue[] {
  const issues: ParsedIssue[] = [];
  const sheet = kind === "price" ? "BD_LP" : "SB1";
  const groups = new Map<string, AnyRecord[]>();

  for (const record of records) {
    const priceListCode = "priceListCode" in record ? record.priceListCode : "";
    const key = [record.branchCode, priceListCode, record.productCode, record.validFrom].join("|");
    const bucket = groups.get(key);
    if (bucket) bucket.push(record);
    else groups.set(key, [record]);

    if (record.value === null) {
      issues.push(one(`missing_${kind}`, "warning", sheet, key, `El ${kind} está vacío.`, [record.sourceRow]));
    } else if (record.value.isZero()) {
      issues.push(one(`zero_${kind}`, "warning", sheet, key, `El ${kind} es cero.`, [record.sourceRow], ["0"]));
    } else if (record.value.lessThan(0)) {
      issues.push(
        one(`negative_${kind}`, "warning", sheet, key, `El ${kind} es negativo.`, [record.sourceRow], [record.value.toFixed()]),
      );
    }
    if (record.sourceStatus === "inactive") {
      issues.push(one("inactive_source", "warning", sheet, key, "El registro está marcado como inactivo.", [record.sourceRow]));
    } else if (record.sourceStatus === "unknown") {
      issues.push(
        one("unknown_source_status", "warning", sheet, key, "El estado está vacío o no reconocido; no se interpreta como inactivo.", [record.sourceRow]),
      );
    }
  }

  for (const [key, matches] of groups) {
    if (matches.length < 2) continue;
    const distinct = new Set(matches.map((m) => (m.value === null ? " null" : m.value.toFixed())));
    const conflicting = distinct.size > 1;
    issues.push(
      one(
        conflicting ? "conflicting_duplicate" : "identical_duplicate",
        conflicting ? "conflict" : "warning",
        sheet,
        key,
        conflicting
          ? "Hay valores diferentes para la misma clave y fecha; la fila queda bloqueada."
          : "La misma clave, fecha y valor aparece más de una vez; se consolida para calcular.",
        matches.map((m) => m.sourceRow),
        matches.map((m) => (m.value === null ? null : m.value.toFixed())),
      ),
    );
  }
  return issues;
}

function one(
  issueType: string,
  severity: Severity,
  sheetName: string,
  businessKey: string,
  explanation: string,
  sourceRows: number[],
  values: (string | null)[] = [],
): ParsedIssue {
  return { issueType, severity, sheetName, businessKey, explanation, sourceRows, values };
}
