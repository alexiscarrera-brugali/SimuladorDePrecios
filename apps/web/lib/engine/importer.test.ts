import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseWorkbook } from "./importer";

const VIG = new Date(Date.UTC(2026, 6, 20)); // 2026-07-20

async function buildWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const ml = wb.addWorksheet("Mapeo_Listas");
  ml.addRow(["Cod. Tabla", "Descripcion"]);
  ml.addRow([1, "Franquicias Cordoba"]);

  const lp = wb.addWorksheet("BD_LP");
  lp.addRow(["Sucursal", "Cod. Tabla", "Cod.Producto", "Precio Venta", "Vigencia", "Activo"]);
  lp.addRow([101, 1, "P1", 1000, VIG, "Si"]); // correcto
  lp.addRow([101, 1, "P2", 0, VIG, "Si"]); // precio cero
  lp.addRow([101, 1, "P3", null, VIG, ""]); // vacío + estado desconocido
  lp.addRow([101, 1, "P4", 500, VIG, "Si"]); // duplicado idéntico
  lp.addRow([101, 1, "P4", 500, VIG, "Si"]);
  lp.addRow([101, 1, "P5", 700, VIG, "Si"]); // duplicado conflictivo
  lp.addRow([101, 1, "P5", 900, VIG, "Si"]);
  lp.addRow([101, 1, "P6", 1200, VIG, "No"]); // inactivo

  const sb1 = wb.addWorksheet("SB1");
  sb1.addRow(["Sucursal", "Codigo", "Descripcion", "Costo Estand", "Vigencia", "Desactivado?"]);
  sb1.addRow([1, "P1", "Producto uno", 800, VIG, "No"]);
  sb1.addRow([1, "P5", "Producto cinco", 600, VIG, "No"]);

  const mt = wb.addWorksheet("Margen_teorico");
  mt.addRow(["Lista", "Código", "Descripción", "Margen"]);
  mt.addRow(["Franquicias Cordoba", "P1", "Producto uno", "25,0%"]);
  mt.addRow(["Franquicias Cordoba", "varios", "Varios", "30,0%"]);

  return Buffer.from((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
}

function types(issues: { issueType: string }[]) {
  return new Set(issues.map((i) => i.issueType));
}

describe("parseWorkbook", () => {
  it("cuenta filas por hoja", async () => {
    const parsed = await parseWorkbook(await buildWorkbook());
    expect(parsed.summary.priceRows).toBe(8);
    expect(parsed.summary.costRows).toBe(2);
    expect(parsed.summary.marginRows).toBe(2);
    expect(parsed.summary.priceLists).toBe(1);
  });

  it("detecta precio cero y vacío", async () => {
    const t = types((await parseWorkbook(await buildWorkbook())).issues);
    expect(t.has("zero_price")).toBe(true);
    expect(t.has("missing_price")).toBe(true);
  });

  it("detecta duplicados idénticos y conflictivos", async () => {
    const parsed = await parseWorkbook(await buildWorkbook());
    const t = types(parsed.issues);
    expect(t.has("identical_duplicate")).toBe(true);
    expect(t.has("conflicting_duplicate")).toBe(true);
    expect(parsed.summary.conflicts).toBeGreaterThanOrEqual(1);
  });

  it("detecta estados inactivo y desconocido", async () => {
    const t = types((await parseWorkbook(await buildWorkbook())).issues);
    expect(t.has("inactive_source")).toBe(true);
    expect(t.has("unknown_source_status")).toBe(true);
  });

  it("marca objetivo ambiguo sin aplicarlo", async () => {
    const parsed = await parseWorkbook(await buildWorkbook());
    expect(types(parsed.issues).has("objective_mapping_ambiguous")).toBe(true);
    const ambiguous = parsed.margins.filter((m) => m.isAmbiguous);
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0].productCode).toBe("varios");
  });

  it("normaliza coma decimal y porcentaje del margen", async () => {
    const parsed = await parseWorkbook(await buildWorkbook());
    const p1 = parsed.margins.find((m) => m.productCode === "P1");
    expect(p1?.percentage?.toFixed()).toBe("25");
  });

  it("hoja faltante lanza error", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Mapeo_Listas");
    ws.addRow(["Cod. Tabla", "Descripcion"]);
    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
    await expect(parseWorkbook(buf)).rejects.toThrow(/Missing required sheets/);
  });
});
