import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Quotation, QuotationDetail, QuotationItem, QuotationPaymentTerm } from "@/lib/types";

const IMAGE_BUCKET = "quotation-item-images";

const HEADER_COLUMNS =
  "id, doc_no, quote_date, project_name, attn, customer_name, customer_address, customer_tel, customer_tax_id, " +
  "job_number, po_number, delivery_date, price_validity, remark, payment_terms, pre_vat, vat, total, " +
  "sales_rep_id, status, converted_project_id, created_at, sales_reps(name)";

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
    .select("id, sort_order, product_code, description, image_path, unit_price, discount_percent, net_price, qty, unit, total_price")
    .eq("quotation_id", id)
    .order("sort_order", { ascending: true });
  if (itemsErr) throw itemsErr;

  const mappedItems: QuotationItem[] = (items ?? []).map((row) => ({
    id: row.id,
    sortOrder: row.sort_order,
    productCode: row.product_code,
    description: row.description,
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
