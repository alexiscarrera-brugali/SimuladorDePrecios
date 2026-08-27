import { describe, expect, it } from "vitest";
import { XLSX_MAX_BYTES } from "@/lib/config/upload";
import { importPathSchema, signUploadSchema } from "@/lib/schemas";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("signUploadSchema", () => {
  it("acepta un Excel dentro del límite", () => {
    expect(
      signUploadSchema.safeParse({
        filename: "lista-precios.xlsx",
        size: 1024,
        contentType: XLSX_MIME,
      }).success,
    ).toBe(true);
  });

  it.each([
    { filename: "lista.csv", size: 1024, contentType: XLSX_MIME },
    { filename: "../lista.xlsx", size: 1024, contentType: XLSX_MIME },
    { filename: "lista.xlsx", size: XLSX_MAX_BYTES + 1, contentType: XLSX_MIME },
    { filename: "lista.xlsx", size: 1024, contentType: "text/plain" },
  ])("rechaza archivos fuera del contrato", (input) => {
    expect(signUploadSchema.safeParse(input).success).toBe(false);
  });
});

describe("importPathSchema", () => {
  it("acepta únicamente rutas emitidas por el servidor", () => {
    expect(
      importPathSchema.safeParse({
        path: "15c74b5f-b60e-44c2-90d2-14fb9f8589a5-lista.xlsx",
      }).success,
    ).toBe(true);
    expect(importPathSchema.safeParse({ path: "otra-carpeta/lista.xlsx" }).success).toBe(false);
  });
});
