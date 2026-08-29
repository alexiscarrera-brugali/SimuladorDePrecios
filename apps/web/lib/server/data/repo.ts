import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDecimalOrNull, toStr } from "@/lib/domain/decimal";
import type { CostRecord, MarginRecord, ParsedWorkbook, PriceRecord } from "@/lib/domain/importer";
import type { PriceListRef, ProductRef } from "@/lib/domain/analysis";
import type { SourceStatus } from "@/lib/domain/types";
import { HttpError } from "@/lib/server/http";

function asStatus(value: string | null): SourceStatus {
  return value === "active" || value === "inactive" ? value : "unknown";
}

export async function getLatestBatchId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client
    .from("import_batches")
    .select("id")
    .eq("status", "committed")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return data?.id ?? null;
}

export async function getPriceLists(client: SupabaseClient): Promise<PriceListRef[]> {
  const { data, error } = await client.from("price_lists").select("code, description").order("code");
  if (error) throw new HttpError(500, error.message);
  return (data ?? []).map((r) => ({ code: r.code, description: r.description }));
}

export async function getPriceListByCode(client: SupabaseClient, code: string): Promise<PriceListRef> {
  const { data, error } = await client
    .from("price_lists")
    .select("code, description")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, `Lista ${code} no encontrada`);
  return { code: data.code, description: data.description };
}

export interface AnalysisData {
  prices: PriceRecord[];
  costs: CostRecord[];
  margins: MarginRecord[];
  products: Map<string, ProductRef>;
}

export async function getAnalysisData(
  client: SupabaseClient,
  batchId: string,
  priceListCode: string,
): Promise<AnalysisData> {
  const [pricesRes, costsRes, marginsRes, productsRes] = await Promise.all([
    client.from("price_facts").select("*").eq("batch_id", batchId).eq("price_list_code", priceListCode),
    client.from("cost_facts").select("*").eq("batch_id", batchId),
    client.from("theoretical_margins").select("*").eq("batch_id", batchId),
    client.from("products").select("code, description"),
  ]);
  for (const res of [pricesRes, costsRes, marginsRes, productsRes]) {
    if (res.error) throw new HttpError(500, res.error.message);
  }

  const prices: PriceRecord[] = (pricesRes.data ?? []).map((r) => ({
    branchCode: r.branch_code,
    priceListCode: r.price_list_code,
    productCode: r.product_code,
    value: parseDecimalOrNull(r.value),
    validFrom: r.valid_from,
    sourceStatus: asStatus(r.source_status),
    sourceRow: r.source_row,
    origin: r.origin ?? "import",
  }));
  const costs: CostRecord[] = (costsRes.data ?? []).map((r) => ({
    branchCode: r.branch_code,
    productCode: r.product_code,
    description: r.description,
    value: parseDecimalOrNull(r.value),
    validFrom: r.valid_from,
    sourceStatus: asStatus(r.source_status),
    sourceRow: r.source_row,
  }));
  const margins: MarginRecord[] = (marginsRes.data ?? []).map((r) => ({
    priceListName: r.price_list_name,
    productCode: r.product_code,
    percentage: parseDecimalOrNull(r.percentage),
    isAmbiguous: r.is_ambiguous,
    sourceRow: r.source_row,
  }));
  const products = new Map<string, ProductRef>(
    (productsRes.data ?? []).map((r) => [r.code, { code: r.code, description: r.description }]),
  );
  return { prices, costs, margins, products };
}

export interface HistoryPoint {
  date: string;
  value: string | null;
}

export async function getHistory(
  client: SupabaseClient,
  batchId: string,
  productCode: string,
  priceListCode: string,
): Promise<{ prices: HistoryPoint[]; costs: HistoryPoint[] }> {
  const [pricesRes, costsRes] = await Promise.all([
    client
      .from("price_facts")
      .select("valid_from, value")
      .eq("batch_id", batchId)
      .eq("product_code", productCode)
      .eq("price_list_code", priceListCode)
      .order("valid_from"),
    client
      .from("cost_facts")
      .select("valid_from, value")
      .eq("batch_id", batchId)
      .eq("product_code", productCode)
      .order("valid_from"),
  ]);
  for (const res of [pricesRes, costsRes]) {
    if (res.error) throw new HttpError(500, res.error.message);
  }
  const map = (rows: { valid_from: string; value: string | null }[] | null): HistoryPoint[] =>
    (rows ?? []).map((r) => ({ date: r.valid_from, value: toStr(parseDecimalOrNull(r.value)) }));
  return { prices: map(pricesRes.data), costs: map(costsRes.data) };
}

export async function persistImport(
  admin: SupabaseClient,
  parsed: ParsedWorkbook,
  filename: string,
  importedBy: string,
): Promise<string> {
  const { data: batch, error: batchErr } = await admin
    .from("import_batches")
    .insert({
      filename,
      sha256: parsed.sha256,
      status: "processing",
      imported_by: importedBy,
      summary: parsed.summary,
    })
    .select("id")
    .single();
  if (batchErr || !batch) throw new HttpError(500, batchErr?.message ?? "No se pudo crear el lote");
  const batchId = batch.id as string;

  try {
    if (parsed.priceLists.length) {
      const { error } = await admin
        .from("price_lists")
        .upsert(parsed.priceLists.map((l) => ({ code: l.code, description: l.description })), { onConflict: "code" });
      if (error) throw new HttpError(500, error.message);
    }
    const productCodes = new Map<string, string | null>();
    for (const p of parsed.prices) if (!productCodes.has(p.productCode)) productCodes.set(p.productCode, null);
    for (const c of parsed.costs) productCodes.set(c.productCode, c.description ?? productCodes.get(c.productCode) ?? null);
    if (productCodes.size) {
      const rows = [...productCodes].map(([code, description]) => ({ code, description }));
      const { error } = await admin.from("products").upsert(rows, { onConflict: "code" });
      if (error) throw new HttpError(500, error.message);
    }

    await insertChunked(admin, "price_facts", parsed.prices.map((p) => ({
      batch_id: batchId,
      branch_code: p.branchCode,
      price_list_code: p.priceListCode,
      product_code: p.productCode,
      valid_from: p.validFrom,
      value: toStr(p.value),
      source_status: p.sourceStatus,
      source_row: p.sourceRow,
    })));
    await insertChunked(admin, "cost_facts", parsed.costs.map((c) => ({
      batch_id: batchId,
      branch_code: c.branchCode,
      product_code: c.productCode,
      description: c.description,
      valid_from: c.validFrom,
      value: toStr(c.value),
      source_status: c.sourceStatus,
      source_row: c.sourceRow,
    })));
    await insertChunked(admin, "theoretical_margins", parsed.margins.map((m) => ({
      batch_id: batchId,
      price_list_name: m.priceListName,
      product_code: m.productCode,
      percentage: toStr(m.percentage),
      is_ambiguous: m.isAmbiguous,
      source_row: m.sourceRow,
    })));
    await insertChunked(admin, "quality_issues", parsed.issues.map((i) => ({
      batch_id: batchId,
      issue_type: i.issueType,
      severity: i.severity,
      sheet_name: i.sheetName,
      business_key: i.businessKey,
      explanation: i.explanation,
      source_rows: i.sourceRows,
      values: i.values,
    })));

    const { error: commitError } = await admin
      .from("import_batches")
      .update({ status: "committed" })
      .eq("id", batchId);
    if (commitError) throw new HttpError(500, commitError.message);
    return batchId;
  } catch (error) {
    await admin.from("import_batches").update({ status: "failed" }).eq("id", batchId);
    throw error;
  }
}

async function insertChunked(admin: SupabaseClient, table: string, rows: Record<string, unknown>[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + size));
    if (error) throw new HttpError(500, `Error al guardar ${table}: ${error.message}`);
  }
}
