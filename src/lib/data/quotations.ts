import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  BillableQuotation,
  ProductionOrder,
  Quotation,
  QuotationDetail,
  QuotationItem,
  QuotationItemDetail,
  QuotationPaymentTerm,
} from "@/lib/types";

const IMAGE_BUCKET = "quotation-item-images";

const HEADER_COLUMNS =
  "id, doc_no, quote_date, project_name, attn, customer_name, customer_address, customer_tel, customer_tax_id, " +
  "job_number, po_number, delivery_date, price_validity, remark, payment_terms, pre_vat, vat, total, " +
  "sales_rep_id, status, quotation_type, converted_project_id, created_at, sales_reps(name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  quote_date: string;
  project_name: string;
  attn: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_tel: string | null;
  customer_tax_id: string | null;
  job_number: string | null;
  po_number: string | null;
  delivery_date: string | null;
  price_validity: string | null;
  remark: string | null;
  payment_terms: QuotationPaymentTerm[];
  pre_vat: number;
  vat: number;
  total: number;
  sales_rep_id: string | null;
  status: Quotation["status"];
  quotation_type: Quotation["quotationType"];
  converted_project_id: string | null;
  created_at: string;
  sales_reps: { name: string } | null;
};

function mapHeader(row: HeaderRow): Quotation {
  return {
    id: row.id,
    docNo: row.doc_no,
    quoteDate: row.quote_date,
    projectName: row.project_name,
    attn: row.attn,
    customerName: row.customer_name,
    customerAddress: row.customer_address,
    customerTel: row.customer_tel,
    customerTaxId: row.customer_tax_id,
    jobNumber: row.job_number,
    poNumber: row.po_number,
    deliveryDate: row.delivery_date,
    priceValidity: row.price_validity,
    remark: row.remark,
    paymentTerms: row.payment_terms ?? [],
    preVat: Number(row.pre_vat),
    vat: Number(row.vat),
    total: Number(row.total),
    salesRepId: row.sales_rep_id,
    salesRepName: row.sales_reps?.name ?? null,
    status: row.status,
    quotationType: row.quotation_type,
    convertedProjectId: row.converted_project_id,
    createdAt: row.created_at,
  };
}

export async function getQuotations(): Promise<Quotation[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(HEADER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapHeader);
}

type ProductionItemRow = {
  id: string;
  product_name: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
  cutting_pattern: string | null;
  qty: number;
  unit: string;
  product_code: string | null;
  sort_order: number;
};

type ProductionQuotationRow = {
  id: string;
  doc_no: string;
  quote_date: string;
  project_name: string;
  customer_name: string;
  job_number: string | null;
  total: number;
  sales_reps: { name: string } | null;
  quotation_items: ProductionItemRow[] | null;
};

const PRODUCTION_ORDER_COLUMNS =
  "id, doc_no, quote_date, project_name, customer_name, job_number, total, sales_reps(name), " +
  "quotation_items(id, product_name, thickness, size, color, cutting_pattern, qty, unit, product_code, sort_order)";

function mapProductionOrderRow(row: ProductionQuotationRow): ProductionOrder {
  const salesRep = row.sales_reps;
  const items = row.quotation_items ?? [];
  return {
    id: row.id,
    docNo: row.doc_no,
    quoteDate: row.quote_date,
    projectName: row.project_name,
    customerName: row.customer_name,
    salesRepName: salesRep?.name ?? null,
    jobNumber: row.job_number,
    total: Number(row.total),
    items: [...items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => ({
        id: it.id,
        productName: it.product_name,
        thickness: it.thickness,
        size: it.size,
        color: it.color,
        cuttingPattern: it.cutting_pattern,
        qty: Number(it.qty),
        unit: it.unit,
        productCode: it.product_code,
      })),
  };
}

// ใบลงผลิต — every accepted (ลูกค้าตอบตกลง) quotation, for the production
// page where staff fill in the JOB number and each item's product code
// once the job is scheduled. Deliberately not filtered to only quotations
// missing that data, since staff also come back here to correct it later.
export async function getAcceptedQuotationsForProduction(): Promise<ProductionOrder[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(PRODUCTION_ORDER_COLUMNS)
    .eq("status", "ลูกค้าตอบตกลง")
    // Highest JOB NO. first — job_number's fixed-width JB+YYMM+seq shape
    // (see src/lib/job-no.ts) sorts lexicographically the same as
    // numerically, so this reads as "newest job first" without depending on
    // accepted_at/quote_date timestamps at all. accepted_at is the
    // tiebreaker for the rare case of two rows sharing one job_number (or
    // neither having one yet).
    .order("job_number", { ascending: false, nullsFirst: false })
    .order("accepted_at", { ascending: false, nullsFirst: false });
  if (error) throw error;

  // Supabase's select-string type parser doesn't cleanly resolve two
  // embedded relations (sales_reps + quotation_items) in one query, so the
  // row type it infers here is unusable — cast once via unknown rather than
  // scattering @ts-expect-error across every field access below.
  const rows = (data ?? []) as unknown as ProductionQuotationRow[];
  return rows.map(mapProductionOrderRow);
}

// Single-record counterpart of the above, for the ใบลงผลิต detail/edit page
// reached from the list's "แก้ไข" action.
export async function getProductionOrderById(id: string): Promise<ProductionOrder | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(PRODUCTION_ORDER_COLUMNS)
    .eq("id", id)
    .eq("status", "ลูกค้าตอบตกลง")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return mapProductionOrderRow(data as unknown as ProductionQuotationRow);
}

export async function getQuotationById(id: string): Promise<QuotationDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: header, error: headerErr } = await supabase
    .from("quotations")
    .select(HEADER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (headerErr) throw headerErr;
  if (!header) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("quotation_items")
    .select(
      "id, sort_order, product_code, product_name, thickness, size, color, cutting_pattern, image_path, unit_price, discount_percent, net_price, qty, unit, total_price",
    )
    .eq("quotation_id", id)
    .order("sort_order", { ascending: true });
  if (itemsErr) throw itemsErr;

  const mappedItems: QuotationItem[] = (items ?? []).map((row) => ({
    id: row.id,
    sortOrder: row.sort_order,
    productCode: row.product_code,
    productName: row.product_name,
    thickness: row.thickness,
    size: row.size,
    color: row.color,
    cuttingPattern: row.cutting_pattern,
    imagePath: row.image_path,
    unitPrice: Number(row.unit_price),
    discountPercent: Number(row.discount_percent),
    netPrice: Number(row.net_price),
    qty: Number(row.qty),
    unit: row.unit,
    totalPrice: Number(row.total_price),
  }));

  return {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(header),
    items: mappedItems,
  };
}

// Powers the Product Name/Thickness/Size/Color autocompletes in the item
// form — every distinct value ever typed into those fields, so a repeated
// spec (e.g. "9 mm.") is a click instead of a re-type. One query across all
// quotations' items, not scoped per-quotation, since the whole point is
// reusing values entered on OTHER quotes too.
export interface QuotationItemFieldSuggestions {
  productNames: string[];
  thicknesses: string[];
  sizes: string[];
  colors: string[];
  cuttingPatterns: string[];
}

// Always offered even before anyone has typed them on a real quotation yet —
// the two cutting styles the shop floor actually uses. Historical values
// (typed later, or anything else that ever gets used) merge in alongside
// these, same as every other suggestion list here.
const DEFAULT_CUTTING_PATTERNS = ["ตัดตรง", "เซาะร่อง"];

export async function getDistinctQuotationItemFields(): Promise<QuotationItemFieldSuggestions> {
  if (!isSupabaseConfigured())
    return { productNames: [], thicknesses: [], sizes: [], colors: [], cuttingPatterns: DEFAULT_CUTTING_PATTERNS };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_items")
    .select("product_name, thickness, size, color, cutting_pattern");
  if (error) throw error;

  const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => !!v))).sort();

  return {
    productNames: distinct((data ?? []).map((r) => r.product_name)),
    thicknesses: distinct((data ?? []).map((r) => r.thickness)),
    sizes: distinct((data ?? []).map((r) => r.size)),
    colors: distinct((data ?? []).map((r) => r.color)),
    cuttingPatterns: distinct([...DEFAULT_CUTTING_PATTERNS, ...(data ?? []).map((r) => r.cutting_pattern)]),
  };
}

// Looks up the itemized product/service detail behind a set of JOB
// NO.s, for printing on a tax invoice (see QuotationItemDetail). A JOB
// can have more than one quotation on file (revisions) — this picks the
// accepted one ("ลูกค้าตอบตกลง") when there is one, else the most
// recently created, matching how a real job would only have one
// quotation that actually became the order.
// Job numbers are free-typed in both `projects.job_no` and the quotation
// form's own JOB Number field, so a trailing space or case difference
// (confirmed present in this data — e.g. project_name spacing varies job
// to job) would silently break an exact match. Normalize before comparing.
export function normalizeJobNo(jobNo: string): string {
  return jobNo.trim().toUpperCase();
}

export async function getQuotationItemsByJobNumbers(
  jobNumbers: string[],
): Promise<Record<string, { quotationDocNo: string; items: QuotationItemDetail[] }>> {
  const uniqueJobNumbers = Array.from(new Set(jobNumbers.filter((j): j is string => !!j)));
  if (!isSupabaseConfigured() || uniqueJobNumbers.length === 0) return {};
  const wantedJobNos = new Set(uniqueJobNumbers.map(normalizeJobNo));

  const supabase = await createClient();
  const { data: quotes, error } = await supabase
    .from("quotations")
    .select("id, doc_no, job_number, status, created_at")
    .not("job_number", "is", null);
  if (error) throw error;

  // Map from the ORIGINAL (un-normalized) job number as passed in, so the
  // result's keys still match what the caller looks up by.
  const originalByNormalized = new Map(uniqueJobNumbers.map((j) => [normalizeJobNo(j), j]));
  const bestByJobNumber = new Map<string, { id: string; doc_no: string; status: string; created_at: string }>();
  for (const q of quotes ?? []) {
    if (!q.job_number) continue;
    const normalized = normalizeJobNo(q.job_number);
    if (!wantedJobNos.has(normalized)) continue;
    const jobNoKey = originalByNormalized.get(normalized) ?? q.job_number;
    const existing = bestByJobNumber.get(jobNoKey);
    if (!existing) {
      bestByJobNumber.set(jobNoKey, q);
      continue;
    }
    const existingAccepted = existing.status === "ลูกค้าตอบตกลง";
    const candidateAccepted = q.status === "ลูกค้าตอบตกลง";
    const candidateIsBetter =
      (candidateAccepted && !existingAccepted) ||
      (candidateAccepted === existingAccepted && q.created_at > existing.created_at);
    if (candidateIsBetter) bestByJobNumber.set(jobNoKey, q);
  }
  if (bestByJobNumber.size === 0) return {};

  const quotationIds = Array.from(bestByJobNumber.values()).map((q) => q.id);
  const itemsByQuotationId = await fetchQuotationItemDetailsByIds(supabase, quotationIds);

  const result: Record<string, { quotationDocNo: string; items: QuotationItemDetail[] }> = {};
  for (const [jobNo, q] of bestByJobNumber) {
    result[jobNo] = { quotationDocNo: q.doc_no, items: itemsByQuotationId.get(q.id) ?? [] };
  }
  return result;
}

// Shared by getQuotationItemsByJobNumbers (matches via JOB NO.) and
// getQuotationItemsByIds (matches via a direct quotation_id reference,
// used when a billing document line was billed straight from a quotation).
async function fetchQuotationItemDetailsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quotationIds: string[],
): Promise<Map<string, QuotationItemDetail[]>> {
  if (quotationIds.length === 0) return new Map();
  const { data: items, error } = await supabase
    .from("quotation_items")
    .select("quotation_id, sort_order, product_code, product_name, thickness, size, color, unit_price, qty, unit, total_price")
    .in("quotation_id", quotationIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const itemsByQuotationId = new Map<string, QuotationItemDetail[]>();
  for (const row of items ?? []) {
    const list = itemsByQuotationId.get(row.quotation_id) ?? [];
    list.push({
      productCode: row.product_code,
      productName: row.product_name,
      thickness: row.thickness,
      size: row.size,
      color: row.color,
      qty: Number(row.qty),
      unit: row.unit,
      unitPrice: Number(row.unit_price),
      totalPrice: Number(row.total_price),
    });
    itemsByQuotationId.set(row.quotation_id, list);
  }
  return itemsByQuotationId;
}

// Used when a billing document line was billed directly from a quotation
// (billing_note_items.quotation_id set) — no JOB-matching ambiguity since
// the exact quotation is already known.
export async function getQuotationItemsByIds(
  quotationIds: string[],
): Promise<Record<string, { quotationDocNo: string; items: QuotationItemDetail[] }>> {
  const uniqueIds = Array.from(new Set(quotationIds));
  if (!isSupabaseConfigured() || uniqueIds.length === 0) return {};

  const supabase = await createClient();
  const { data: quotes, error } = await supabase.from("quotations").select("id, doc_no").in("id", uniqueIds);
  if (error) throw error;
  if (!quotes || quotes.length === 0) return {};

  const itemsByQuotationId = await fetchQuotationItemDetailsByIds(supabase, uniqueIds);
  const result: Record<string, { quotationDocNo: string; items: QuotationItemDetail[] }> = {};
  for (const q of quotes) {
    result[q.id] = { quotationDocNo: q.doc_no, items: itemsByQuotationId.get(q.id) ?? [] };
  }
  return result;
}

// Accepted quotations for a customer that haven't been recorded as a real
// WALLPOD Project Sales job yet (converted_project_id is null) — eligible
// to be billed directly, ahead of the formal invoice. Matched by customer
// name (quotations has no customer_id FK), same convention already used
// by syncCustomerContactInfo/getCustomerByName.
export async function getAcceptedUnconvertedQuotationsForCustomer(customerName: string): Promise<BillableQuotation[]> {
  if (!customerName || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, doc_no, quote_date, project_name, total")
    .ilike("customer_name", customerName)
    .eq("status", "ลูกค้าตอบตกลง")
    .is("converted_project_id", null)
    .order("quote_date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    docNo: row.doc_no,
    quoteDate: row.quote_date,
    projectName: row.project_name,
    total: Number(row.total),
  }));
}

// One quotation item's descriptive/pricing fields, kept as raw separate
// columns (unlike QuotationItemDetail's combined `description` string) —
// used by Finished Goods to prefill its own thickness/size/color columns
// straight from the accepted quotation, rather than needing to re-parse a
// formatted string.
export interface QuotationItemRaw {
  id: string;
  productName: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
  qty: number;
  unit: string;
  unitPrice: number;
}

// Finds the accepted quotation for a JOB NO. (falling back to the most
// recently created one if none is accepted yet, same rule as
// getQuotationItemsByJobNumbers) and returns its raw item fields — used to
// prefill the "เพิ่มสินค้าสำเร็จรูป" form when producing a job's ordered
// goods. Returns null when no quotation matches the JOB at all.
export async function getAcceptedQuotationItemsByJobNo(
  jobNo: string,
): Promise<{ quotationDocNo: string; items: QuotationItemRaw[] } | null> {
  if (!jobNo || !isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const normalized = normalizeJobNo(jobNo);

  const { data: quotes, error } = await supabase
    .from("quotations")
    .select("id, doc_no, job_number, status, created_at")
    .not("job_number", "is", null);
  if (error) throw error;

  const matches = (quotes ?? []).filter((q) => q.job_number && normalizeJobNo(q.job_number) === normalized);
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aAccepted = a.status === "ลูกค้าตอบตกลง";
    const bAccepted = b.status === "ลูกค้าตอบตกลง";
    if (aAccepted !== bAccepted) return aAccepted ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
  const best = matches[0];

  const { data: items, error: itemsErr } = await supabase
    .from("quotation_items")
    .select("id, product_name, thickness, size, color, qty, unit, unit_price")
    .eq("quotation_id", best.id)
    .order("sort_order", { ascending: true });
  if (itemsErr) throw itemsErr;

  return {
    quotationDocNo: best.doc_no,
    items: (items ?? []).map((row) => ({
      id: row.id,
      productName: row.product_name,
      thickness: row.thickness,
      size: row.size,
      color: row.color,
      qty: Number(row.qty),
      unit: row.unit,
      unitPrice: Number(row.unit_price),
    })),
  };
}

export async function getSignedQuotationImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || paths.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
  if (error) return {};

  const result: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) result[entry.path] = entry.signedUrl;
  }
  return result;
}
