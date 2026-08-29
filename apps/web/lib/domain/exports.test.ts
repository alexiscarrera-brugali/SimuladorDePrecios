import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildExportWorkbook } from "./exports";
import type { AnalysisResponse } from "./analysis";

function makeRow(over: Partial<AnalysisResponse["rows"][number]> = {}): AnalysisResponse["rows"][number] {
  return {
    productCode: "P1",
    description: "Producto uno",
    branchCode: "101",
    priceListCode: "1",
    priceListName: "Franquicias Cordoba",
    price: { value: "1000", validFrom: "2026-07-20", status: "ok", warnings: [], origin: "import" },
    cost: { value: "800", validFrom: "2026-07-20", status: "ok", warnings: [], origin: "import" },
    idealPercent: "25",
    actualGainAmount: "200",
    actualGainPercent: "25",
    dataStatus: "ok",
    warnings: [],
    simulationBlocked: false,
    ...over,
  };
}

function analysisWith(rows: AnalysisResponse["rows"]): AnalysisResponse {
  return {
    queryDate: "2026-08-01",
    priceList: { code: "1", description: "Franquicias Cordoba" },
    rows,
    counts: { total: rows.length, ok: 0, warning: 0, conflict: 0 },
    capabilities: { hasVolume: false, hasCategory: false },
  };
}

const meta = { exportedBy: "admin@brugali.com.ar", exportedAt: "2026-08-26T00:00:00.000Z" };

async function load(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

describe("buildExportWorkbook", () => {
  it("genera las hojas en español: Lista de precios, Para revisar e Información", async () => {
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis: analysisWith([makeRow()]), metadata: meta }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Lista de precios", "Para revisar", "Información"]);
  });

  it("la lista trae producto, costo y precio como números, y el origen legible", async () => {
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis: analysisWith([makeRow()]), metadata: meta }));
    const ws = wb.getWorksheet("Lista de precios")!;
    const row = ws.getRow(2);
    // Tras recargar del buffer las columnas se leen por índice: 1=Producto,
    // 3=Costo, 4=Precio, 9=Origen.
    expect(row.getCell(1).value).toBe("P1");
    expect(row.getCell(3).value).toBe(800);
    expect(row.getCell(4).value).toBe(1000);
    expect(row.getCell(9).value).toBe("Importado");
  });

  it("marca 'Establecido' cuando el precio vigente es manual", async () => {
    const rows = [makeRow({ price: { value: "1200", validFrom: "2026-08-29", status: "ok", warnings: [], origin: "manual" } })];
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis: analysisWith(rows), metadata: meta }));
    expect(wb.getWorksheet("Lista de precios")!.getRow(2).getCell(9).value).toBe("Establecido");
  });

  it("lista para revisar sólo lo accionable, con motivo en español", async () => {
    const rows = [
      makeRow({ productCode: "OK", actualGainPercent: "25", idealPercent: "25" }), // en objetivo → no aparece
      makeRow({ productCode: "BAJO", actualGainPercent: "10", idealPercent: "25" }), // bajo objetivo
      makeRow({ productCode: "SINCOSTO", cost: { value: null, validFrom: null, status: "missing", warnings: [], origin: "import" } }),
    ];
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis: analysisWith(rows), metadata: meta }));
    const ws = wb.getWorksheet("Para revisar")!;
    const codes = ws.getSheetValues().flat().map(String);
    expect(codes).toContain("BAJO");
    expect(codes).toContain("SINCOSTO");
    expect(codes.some((c) => c.includes("Bajo objetivo"))).toBe(true);
    expect(codes.some((c) => c.includes("Sin costo"))).toBe(true);
    expect(codes).not.toContain("OK");
  });

  it("no expone claves técnicas ni identificadores en inglés en los encabezados", async () => {
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis: analysisWith([makeRow()]), metadata: meta }));
    const headers = (wb.getWorksheet("Lista de precios")!.getRow(1).values as unknown[]).map(String);
    expect(headers).toContain("Precio vigente");
    expect(headers).not.toContain("Termómetro");
    expect(headers).not.toContain("dataStatus");
  });
});
