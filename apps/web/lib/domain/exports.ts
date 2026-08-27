// Exportación analítica: genera un Excel de tres hojas (Resultados,
// Observaciones, Metadatos). Recalcula las simulaciones visibles en el servidor
// (autoridad). Archivo analítico; NO apto para carga automática en TOTVS.
import ExcelJS from "exceljs";
import { Decimal, toStr } from "./decimal";
import { simulate } from "./simulation";
import type { Driver } from "./types";
import type { AnalysisResponse } from "./analysis";
import type { ParsedIssue } from "./importer";

const PETROL = "FF224957";

export interface SimulationExportInput {
  cost: string | null;
  idealPercent: string | null;
  driver: Driver;
  driverValue: string;
  sourceInactive?: boolean;
  sourceUnknown?: boolean;
}

export interface ExportInput {
  queryDate: string;
  analysis: AnalysisResponse;
  issues: ParsedIssue[];
  simulations?: Record<string, SimulationExportInput>;
  metadata: { batchId: string | null; filename: string | null; exportedBy: string; exportedAt: string };
}

const dec = (s: string | null): Decimal | null => (s === null || s.trim() === "" ? null : new Decimal(s));

export async function buildExportWorkbook(input: ExportInput): Promise<Buffer> {
  const { analysis, queryDate } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Brugali · Costos y precios";
  wb.created = new Date(input.metadata.exportedAt);

  // ---- Resultados ----
  const results = wb.addWorksheet("Resultados");
  results.addRow([
    "Fecha consulta", "Lista", "Producto", "Descripción", "Sucursal",
    "Costo vigente", "Vigencia costo", "Precio original", "Vigencia precio",
    "Margen ideal %", "Conductor", "Precio simulado", "Ganancia $", "Ganancia %",
    "Diferencia $", "Diferencia p.p.", "Termómetro", "Estado", "Advertencias",
  ]);

  for (const row of analysis.rows) {
    const simInput = input.simulations?.[row.productCode];
    let calc: ReturnType<typeof simulate> | null = null;
    if (simInput && !row.simulationBlocked) {
      calc = simulate({
        cost: dec(simInput.cost),
        driver: simInput.driver,
        driverValue: new Decimal(simInput.driverValue || "0"),
        idealPercent: dec(simInput.idealPercent),
        sourceInactive: simInput.sourceInactive,
        sourceUnknown: simInput.sourceUnknown,
      });
    }
    results.addRow([
      queryDate,
      row.priceListName,
      row.productCode,
      row.description,
      row.branchCode,
      row.cost.value,
      row.cost.validFrom,
      row.price.value,
      row.price.validFrom,
      row.idealPercent,
      simInput ? simInput.driver : null,
      calc ? toStr(calc.price) : null,
      calc ? toStr(calc.gainAmount) : row.actualGainAmount,
      calc ? toStr(calc.gainPercent) : row.actualGainPercent,
      calc ? toStr(calc.gapAmount) : null,
      calc ? toStr(calc.gapPercentagePoints) : null,
      calc ? calc.thermometer : "neutral",
      row.dataStatus,
      row.warnings.join(", "),
    ]);
  }

  // ---- Observaciones ----
  const observations = wb.addWorksheet("Observaciones");
  observations.addRow(["Tipo", "Severidad", "Hoja", "Clave", "Explicación", "Filas", "Valores"]);
  for (const issue of input.issues) {
    observations.addRow([
      issue.issueType,
      issue.severity,
      issue.sheetName,
      issue.businessKey,
      issue.explanation,
      issue.sourceRows.join(", "),
      issue.values.map((v) => (v === null ? "" : v)).join(", "),
    ]);
  }

  // ---- Metadatos ----
  const metadata = wb.addWorksheet("Metadatos");
  metadata.addRow(["Campo", "Valor"]);
  metadata.addRow(["Lote", input.metadata.batchId ?? ""]);
  metadata.addRow(["Archivo", input.metadata.filename ?? ""]);
  metadata.addRow(["Fecha de consulta", queryDate]);
  metadata.addRow(["Lista", analysis.priceList.description]);
  metadata.addRow(["Exportado por", input.metadata.exportedBy]);
  metadata.addRow(["Fecha de exportación", input.metadata.exportedAt]);
  metadata.addRow(["Uso", "Archivo analítico; no apto para carga automática en TOTVS."]);

  for (const sheet of wb.worksheets) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const header = sheet.getRow(1);
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PETROL } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.alignment = { vertical: "middle" };
    });
    sheet.columns.forEach((col) => {
      let width = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        width = Math.max(width, String(cell.value ?? "").length + 2);
      });
      col.width = Math.min(width, 42);
    });
  }

  return Buffer.from((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
}
