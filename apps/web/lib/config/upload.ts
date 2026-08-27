export const XLSX_MAX_BYTES = 25 * 1024 * 1024;
export const XLSX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
] as const;

export function isAllowedXlsxMime(contentType: string): boolean {
  return XLSX_MIME_TYPES.includes(contentType as (typeof XLSX_MIME_TYPES)[number]);
}
