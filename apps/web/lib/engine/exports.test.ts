import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildExportWorkbook } from "./exports";
import type { AnalysisResponse } from "./analysis";
import type { ParsedIssue } from "./importer";

const analysis: AnalysisResponse = {
  queryDate: "2026-08-01",
  priceList: { code: "1", description: "Franquicias Cordoba" },
  rows: [
    {
      productCode: "P1",
      description: "Producto uno",
      branchCode: "101",
      priceListCode: "1",
      priceListName: "Franquicias Cordoba",
      price: { value: "1000", validFrom: "2026-07-20", status: "ok", warnings: [] },
      cost: { value: "800", validFrom: "2026-07-20", status: "ok", warnings: [] },
      idealPercent: "25",
      actualGainAmount: "200",
      actualGainPercent: "25",
      dataStatus: "ok",
      warnings: [],
      simulationBlocked: false,
    },
  ],
  counts: { total: 1, ok: 1, warning: 0, conflict: 0 },
};

const issues: ParsedIssue[] = [
  {
    issueType: "conflicting_duplicate",
    severity: "conflict",
    sheetName: "BD_LP",
    businessKey: "101|1|L1000779|2026-07-03",
    explanation: "Hay valores diferentes para la misma clave y fecha.",
    sourceRows: [1359, 1360],
    values: ["5695.25", "5900"],
  },
];

async function load(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

describe("buildExportWorkbook", () => {
  const meta = { batchId: "batch-1", filename: "base.xlsx", exportedBy: "admin@brugali.com.ar", exportedAt: "2026-08-26T00:00:00.000Z" };

  it("genera las tres hojas y la nota de TOTVS", async () => {
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis, issues, metadata: meta }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resultados", "Observaciones", "Metadatos"]);
    const metaText = wb.getWorksheet("Metadatos")!.getSheetValues().flat().map(String).join("\n");
    expect(metaText).toContain("no apto para carga automática en TOTVS");
  });

  it("incluye la fila de resultados con costo y precio", async () => {
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis, issues, metadata: meta }));
    const ws = wb.getWorksheet("Resultados")!;
    const dataRow = ws.getRow(2).values as unknown[];
    expect(dataRow).toContain("P1");
    expect(dataRow).toContain("800");
    expect(dataRow).toContain("1000");
  });

  it("recalcula la simulación visible (servidor prevalece)", async () => {
    const wb = await load(
      await buildExportWorkbook({
        queryDate: "2026-08-01",
        analysis,
        issues,
        simulations: { P1: { cost: "800", idealPercent: "25", driver: "gain_percent", driverValue: "30", sourceInactive: false, sourceUnknown: false } },
        metadata: meta,
      }),
    );
    const ws = wb.getWorksheet("Resultados")!;
    const values = (ws.getRow(2).values as unknown[]).map(String);
    // Precio simulado a 30% sobre costo 800 = 1040; ganancia % = 30.
    expect(values).toContain("1040");
    expect(values).toContain("30");
  });

  it("registra las observaciones", async () => {
    const wb = await load(await buildExportWorkbook({ queryDate: "2026-08-01", analysis, issues, metadata: meta }));
    const ws = wb.getWorksheet("Observaciones")!;
    const row = (ws.getRow(2).values as unknown[]).map(String);
    expect(row).toContain("conflicting_duplicate");
    expect(row).toContain("BD_LP");
  });
});
