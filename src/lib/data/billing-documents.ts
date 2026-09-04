import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getQuotationItemsByIds, getQuotationItemsByJobNumbers } from "@/lib/data/quotations";
import type { BillingDocument, BillingDocumentDetail, BillingDocumentType, QuotationItemDetail, UnbilledInvoice } from "@/lib/types";

// Payment installments already invoiced (invoice_no set) and not yet fully
// received — the real-world "please pay these open invoices" set, shared
// by all 3 billing document types (issuing a receipt is what marks them
// received, so they're still eligible right up until that point).
export async function getUnbilledInvoicesForCustomer(customerId: string): Promise<UnbilledInvoice[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, invoice_no, paid_date, amount, projects!inner(job_no, project_name, customer_id)")
    .eq("projects.customer_id", customerId)
    .not("invoice_no", "is", null)
    .is("received_date", null)
    .order("paid_date", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    const project = row.projects as { job_no: string | null; project_name: string } | null;
    return {
      paymentId: row.id,
      jobNo: project?.job_no ?? null,
      projectName: project?.project_name ?? "",
      invoiceNo: row.invoice_no as string,
      invoiceDate: row.paid_date,
      amount: Number(row.amount),
    };
  });
}

// A ใบวางบิล line sourced straight from a quotation (no formal invoice
// recorded yet) should reference the ใบกำกับภาษี for that same quotation
// once one exists, not the quotation itself — the tax invoice is the real
// document being collected on. Batched (one query for every quotation-
// sourced item on the document) rather than per-item.
async function getTaxInvoiceRefsForQuotationIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quotationIds: string[],
): Promise<Record<string, { docNo: string; docDate: string }>> {
  if (quotationIds.length === 0) return {};
  const { data, error } = await supabase
    .from("billing_note_items")
    .select("quotation_id, billing_notes!inner(doc_no, doc_date, doc_type, created_at)")
    .in("quotation_id", quotationIds)
    .eq("billing_notes.doc_type", "tax_invoice")
    .order("created_at", { ascending: false, referencedTable: "billing_notes" });
  if (error) throw error;

  const result: Record<string, { docNo: string; docDate: string }> = {};
  for (const row of data ?? []) {
    const quotationId = row.quotation_id as string | null;
    // @ts-expect-error -- Supabase types the joined relation loosely here
    const note = row.billing_notes as { doc_no: string; doc_date: string } | null;
    if (!quotationId || !note || result[quotationId]) continue; // keep the most recent only
    result[quotationId] = { docNo: note.doc_no, docDate: note.doc_date };
  }
  return result;
}

const HEADER_COLUMNS =
  "id, doc_no, doc_type, customer_id, doc_date, credit_days, due_date, sales_rep_id, discount_amount, wht_percent, retention_percent, note, created_by, created_at, customers(name, address, phone, tax_id), sales_reps(name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  doc_type: BillingDocumentType;
  customer_id: string;
  doc_date: string;
  credit_days: number;
  due_date: string;
  sales_rep_id: string | null;
  discount_amount: number;
  wht_percent: number;
  retention_percent: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  customers: { name: string; address: string | null; phone: string | null; tax_id: string | null } | null;
  sales_reps: { name: string } | null;
};

function mapHeader(row: HeaderRow): BillingDocument {
  return {
    id: row.id,
    docNo: row.doc_no,
    docType: row.doc_type,
    customerId: row.customer_id,
    customerName: row.customers?.name ?? "",
    customerAddress: row.customers?.address ?? null,
    customerTaxId: row.customers?.tax_id ?? null,
    customerPhone: row.customers?.phone ?? null,
    docDate: row.doc_date,
    creditDays: row.credit_days,
    dueDate: row.due_date,
    salesRepId: row.sales_rep_id,
    salesRepName: row.sales_reps?.name ?? null,
    discountAmount: Number(row.discount_amount),
    whtPercent: Number(row.wht_percent),
    retentionPercent: Number(row.retention_percent),
    note: row.note,
    createdById: row.created_by,
    createdAt: row.created_at,
  };
}

export async function getBillingDocuments(docType: BillingDocumentType): Promise<BillingDocument[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_notes")
    .select(HEADER_COLUMNS)
    .eq("doc_type", docType)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapHeader);
}

export async function getBillingDocumentById(id: string): Promise<BillingDocumentDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: header, error: headerErr } = await supabase
    .from("billing_notes")
    .select(HEADER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (headerErr) throw headerErr;
  if (!header) return null;

  // For invoices and tax invoices — the two document types that legally
  // need itemized detail — also pull each line's JOB NO. (via its payment's
  // project) so the product/service detail from that job's quotation can be
  // printed underneath — see getQuotationItemsByJobNumbers. quotation_id is
  // always selected (cheap) since it also drives the "ใบเสนอราคา" vs
  // "เลขที่เอกสาร" label on every doc type, not just these two.
  const showsItemizedDetail = header.doc_type === "invoice" || header.doc_type === "tax_invoice";
  const MANUAL_COLUMNS = "manual_description, manual_qty, manual_unit, manual_unit_price";
  const itemsSelect = showsItemizedDetail
    ? `id, payment_id, quotation_id, invoice_no_snapshot, invoice_date_snapshot, amount, ${MANUAL_COLUMNS}, payments(projects(job_no))`
    : `id, payment_id, quotation_id, invoice_no_snapshot, invoice_date_snapshot, amount, ${MANUAL_COLUMNS}`;
  const { data: items, error: itemsErr } = await supabase
    .from("billing_note_items")
    .select(itemsSelect)
    .eq("billing_note_id", id);
  if (itemsErr) throw itemsErr;

  type ItemRow = {
    id: string;
    payment_id: string | null;
    quotation_id: string | null;
    invoice_no_snapshot: string;
    invoice_date_snapshot: string | null;
    amount: number;
    manual_description: string | null;
    manual_qty: number | null;
    manual_unit: string | null;
    manual_unit_price: number | null;
    payments?: { projects: { job_no: string | null } | null } | null;
  };
  const itemRows = (items ?? []) as unknown as ItemRow[];

  let quotationDetailByJobNo: Record<string, { quotationDocNo: string; items: QuotationItemDetail[] }> = {};
  let quotationDetailById: Record<string, { quotationDocNo: string; items: QuotationItemDetail[] }> = {};
  if (showsItemizedDetail) {
    const jobNos = itemRows.filter((it) => !it.quotation_id).map((it) => it.payments?.projects?.job_no ?? null);
    const quotationIds = itemRows.filter((it) => it.quotation_id).map((it) => it.quotation_id as string);
    [quotationDetailByJobNo, quotationDetailById] = await Promise.all([
      getQuotationItemsByJobNumbers(jobNos.filter((j): j is string => !!j)),
      getQuotationItemsByIds(quotationIds),
    ]);
  }

  let taxInvoiceRefsByQuotationId: Record<string, { docNo: string; docDate: string }> = {};
  if (header.doc_type === "billing_note") {
    const quotationIds = itemRows.filter((it) => it.quotation_id).map((it) => it.quotation_id as string);
    taxInvoiceRefsByQuotationId = await getTaxInvoiceRefsForQuotationIds(supabase, quotationIds);
  }

  return {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(header),
    items: itemRows.map((it) => {
      const jobNo = it.payments?.projects?.job_no ?? null;
      const quotationDetail = it.quotation_id
        ? quotationDetailById[it.quotation_id]
        : jobNo
          ? quotationDetailByJobNo[jobNo]
          : undefined;
      const taxInvoiceRef = it.quotation_id ? taxInvoiceRefsByQuotationId[it.quotation_id] : undefined;
      return {
        id: it.id,
        paymentId: it.payment_id,
        quotationId: it.quotation_id,
        invoiceNo: it.invoice_no_snapshot,
        invoiceDate: it.invoice_date_snapshot,
        amount: Number(it.amount),
        manualDescription: it.manual_description,
        manualQty: it.manual_qty !== null ? Number(it.manual_qty) : null,
        manualUnit: it.manual_unit,
        manualUnitPrice: it.manual_unit_price !== null ? Number(it.manual_unit_price) : null,
        taxInvoiceDocNo: taxInvoiceRef?.docNo ?? null,
        taxInvoiceDocDate: taxInvoiceRef?.docDate ?? null,
        ...(showsItemizedDetail
          ? { quotationDocNo: quotationDetail?.quotationDocNo ?? null, quotationItems: quotationDetail?.items ?? null }
          : {}),
      };
    }),
  };
}
