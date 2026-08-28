import { describe, expect, it } from "vitest";
import { detectCapabilities, NO_CAPABILITIES } from "./capabilities";

describe("detectCapabilities", () => {
  it("sin columnas opcionales → todo bloqueado", () => {
    expect(detectCapabilities(["Sucursal", "Codigo", "Costo Estand"])).toEqual(NO_CAPABILITIES);
  });

  it("detecta volumen por alias e ignora acentos y mayúsculas", () => {
    expect(detectCapabilities(["Producto", "Cantidad"]).hasVolume).toBe(true);
    expect(detectCapabilities(["Producto", "Unidades Vendidas"]).hasVolume).toBe(true);
    expect(detectCapabilities(["Producto", "VOLUMEN"]).hasVolume).toBe(true);
  });

  it("detecta categoría por alias con acentos", () => {
    expect(detectCapabilities(["Rubro"]).hasCategory).toBe(true);
    expect(detectCapabilities(["Categoría"]).hasCategory).toBe(true);
    expect(detectCapabilities(["Línea"]).hasCategory).toBe(true);
  });

  it("detecta ambas capacidades a la vez", () => {
    expect(detectCapabilities(["Cod.Producto", "Cantidad", "Rubro"])).toEqual({ hasVolume: true, hasCategory: true });
  });

  it("no confunde columnas no relacionadas", () => {
    expect(detectCapabilities(["Precio Venta", "Vigencia", "Activo"])).toEqual(NO_CAPABILITIES);
  });
});
