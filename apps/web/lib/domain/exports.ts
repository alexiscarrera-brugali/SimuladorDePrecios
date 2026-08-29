// Exportación "lista de precios lista para usar": una planilla legible en
// español con los precios vigentes y su margen, más una hoja con lo que hay que
// revisar. Sin claves técnicas ni identificadores en inglés. Archivo analítico;
// NO apto para carga automática en TOTVS.
import ExcelJS from "exceljs";
import type { AnalysisResponse } from "./analysis";

const PETROL = "FF224957";
const RED = "FFE43023";
const GREEN = "FF1F7469";
const MONEY = '"$" #,##0.00';
const PCT = '0.00"%"';
const GAP_FMT = '+0.00;-0.00;0.00';

// Coincide con la tolerancia de la UI: por debajo de esto es ruido de redondeo.
const TOLERANCE_PP = 0.5;

export interface ExportInput {
  queryDate: string;
  analysis: AnalysisResponse;
  metadata: { exportedBy: string; exportedAt: string };
}

const num = (s: string | null): number | null => (s === null || s.trim() === "" ? null : Number(s));

function gapPoints(actual: string | null, ideal: string | null): number | null {
  const a = num(actual);
  const i = num(ideal);
  return a === null || i === null ? null : a - i;
}

export async function buildExportWorkbook(input: ExportInput): Promise<Buffer> {
  const { analysis, queryDate } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Brugali · Costos y precios";
  wb.created = new Date(input.metadata.exportedAt);

  // ---- Lista de precios ----
  const list = wb.addWorksheet("Lista de precios");
  list.columns = [
    { header: "Producto", key: "code", width: 16 },
    { header: "Descripción", key: "desc", width: 38 },
    { header: "Costo", key: "cost", width: 14, style: { numFmt: MONEY } },
    { header: "Precio vigente", key: "price", width: 16, style: { numFmt: MONEY } },
    { header: "Vigencia", key: "validFrom", width: 12 },
    { header: "Margen actual", key: "margin", width: 14, style: { numFmt: PCT } },
    { header: "Objetivo", key: "ideal", width: 12, style: { numFmt: PCT } },
    { header: "Desvío (pp)", key: "gap", width: 12, style: { numFmt: GAP_FMT } },
    { header: "Origen", key: "origin", width: 14 },
  ];

  for (const row of analysis.rows) {
    const gap = gapPoints(row.actualGainPercent, row.idealPercent);
    const added = list.addRow({
      code: row.productCode,
      desc: row.description ?? "",
      cost: num(row.cost.value),
      price: num(row.price.value),
      validFrom: row.price.validFrom ?? "Sin vigencia",
      margin: num(row.actualGainPercent),
      ideal: num(row.idealPercent),
      gap,
      origin: row.price.origin === "manual" ? "Establecido" : "Importado",
    });
    // Color del desvío: rojo si está por debajo del objetivo (más allá de la
    // tolerancia), verde si está en o por encima.
    if (gap !== null) {
      added.getCell("gap").font = { color: { argb: gap < -TOLERANCE_PP ? RED : GREEN }, bold: true };
    }
    if (row.price.origin === "manual") {
      added.getCell("origin").font = { color: { argb: PETROL }, bold: true };
    }
  }

  // ---- Para revisar ----
  const review = wb.addWorksheet("Para revisar");
  review.columns = [
    { header: "Producto", key: "code", width: 16 },
    { header: "Descripción", key: "desc", width: 38 },
    { header: "Motivo", key: "reason", width: 30 },
    { header: "Precio vigente", key: "price", width: 16, style: { numFmt: MONEY } },
    { header: "Margen actual", key: "margin", width: 14, style: { numFmt: PCT } },
    { header: "Objetivo", key: "ideal", width: 12, style: { numFmt: PCT } },
  ];

  for (const row of analysis.rows) {
    const gap = gapPoints(row.actualGainPercent, row.idealPercent);
    let reason: string | null = null;
    if (row.dataStatus === "conflict") reason = "Conflicto de datos: revisar";
    else if (num(row.cost.value) === null) reason = "Sin costo vigente";
    else if (gap !== null && gap < -TOLERANCE_PP) reason = `Bajo objetivo (${gap.toFixed(2)} pp)`;
    if (!reason) continue;

    review.addRow({
      code: row.productCode,
      desc: row.description ?? "",
      reason,
      price: num(row.price.value),
      margin: num(row.actualGainPercent),
      ideal: num(row.idealPercent),
    });
  }
  if (review.rowCount === 1) {
    review.addRow({ code: "", desc: "", reason: "Sin observaciones: todo en orden." });
  }

  // ---- Información (pie discreto) ----
  const info = wb.addWorksheet("Información");
  info.columns = [{ width: 22 }, { width: 40 }];
  info.addRow(["Lista", analysis.priceList.description]);
  info.addRow(["Vigente al", queryDate]);
  info.addRow(["Exportado por", input.metadata.exportedBy]);
  info.addRow(["Exportado el", new Date(input.metadata.exportedAt).toLocaleString("es-AR")]);
  info.addRow(["Nota", "Archivo analítico. No apto para carga automática en TOTVS."]);
  info.getColumn(1).font = { bold: true };

  // Estilo de encabezados de las dos hojas de datos.
  for (const sheet of [list, review]) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const header = sheet.getRow(1);
    header.height = 20;
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PETROL } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.alignment = { vertical: "middle" };
    });
  }

  return Buffer.from((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
}
