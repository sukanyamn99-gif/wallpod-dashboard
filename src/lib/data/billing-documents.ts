import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getQuotationItemsByIds, getQuotationItemsByJobNumbers } from "@/lib/data/quotations";
import { computeBillingDocumentSummary } from "@/lib/billing-document-summary";
import type {
  BillableBillingNoteItem,
  BillableTaxInvoice,
  BillingDocument,
  BillingDocumentDetail,
  BillingDocumentType,
  PaymentMethod,
  QuotationItemDetail,
  UnbilledInvoice,
} from "@/lib/types";

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

// ใบกำกับภาษี documents for a customer, quotation-sourced (payment-sourced
// ones already have a real WALLPOD invoice on file and go through
// getUnbilledInvoicesForCustomer instead), excluding any whose quotation is
// already referenced by an existing document of the SAME target type —
// e.g. already billed (ใบวางบิล), so not offered again when creating
// another ใบวางบิล. Originally built just for ใบวางบิล (per the user's
// explicit "ไม่ต้องผ่านใบเสนอราคา" request — staff browse issued tax
// invoices, not the quotations behind them) and now shared by ใบเสร็จรับเงิน
// too, which needs the same source but checked against prior receipts
// instead — a tax invoice already billed via ใบวางบิล is still perfectly
// receiptable, so reusing the billing_note-only check for receipts would
// have wrongly hidden the normal invoice → billing note → receipt flow.
//
// ใบเสร็จรับเงิน additionally browses issued ใบวางบิล documents directly (per
// the user's "ดึงข้อมูลจากใบวางบิลมาให้หน่อย" request) — a quotation-sourced
// line billed via ใบวางบิล has no tax_invoice-type document at all, so
// without this it would be stuck with no way to be receipted except typing
// it in again as a manual line. ใบวางบิล isn't offered as a source for
// ANOTHER ใบวางบิล, only for receipts.
export async function getBillableTaxInvoicesForCustomer(
  customerId: string,
  targetDocType: "billing_note" | "receipt",
  // When editing an existing document, exclude its own items from the
  // "already claimed" check — otherwise the document being edited would
  // hide the very tax invoice it was created from.
  excludeDocId?: string,
): Promise<BillableTaxInvoice[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const sourceDocTypes = targetDocType === "receipt" ? ["tax_invoice", "billing_note"] : ["tax_invoice"];
  const { data: invoices, error } = await supabase
    .from("billing_notes")
    .select(
      "id, doc_no, doc_date, discount_amount, wht_percent, retention_percent, billing_note_items(quotation_id, amount, apply_wht)",
    )
    .in("doc_type", sourceDocTypes)
    .eq("customer_id", customerId);
  if (error) throw error;

  let claimedQuery = supabase
    .from("billing_note_items")
    .select("quotation_id, billing_note_id, billing_notes!inner(doc_type)")
    .eq("billing_notes.doc_type", targetDocType)
    .not("quotation_id", "is", null);
  if (excludeDocId) claimedQuery = claimedQuery.neq("billing_note_id", excludeDocId);
  const { data: claimed, error: claimedErr } = await claimedQuery;
  if (claimedErr) throw claimedErr;
  const billedQuotationIds = new Set((claimed ?? []).map((row) => row.quotation_id as string));

  const result: BillableTaxInvoice[] = [];
  for (const inv of invoices ?? []) {
    const items = (inv.billing_note_items ?? []) as unknown as {
      quotation_id: string | null;
      amount: number;
      apply_wht: boolean;
    }[];
    const quotationId = items.find((it) => it.quotation_id)?.quotation_id;
    if (!quotationId || billedQuotationIds.has(quotationId)) continue;

    const summary = computeBillingDocumentSummary(
      items.map((it) => ({ amount: Number(it.amount), applyWht: it.apply_wht })),
      Number(inv.discount_amount),
      Number(inv.wht_percent),
      Number(inv.retention_percent),
    );
    result.push({
      id: inv.id,
      docNo: inv.doc_no,
      docDate: inv.doc_date,
      quotationId,
      netPayable: summary.netPayable,
      whtPercent: Number(inv.wht_percent),
    });
  }
  return result;
}

// Manually-typed line items for a customer (no quotation_id/payment_id at
// all — e.g. a deposit typed straight into the document before any formal
// quotation/invoice existed for it), offered as a source for ใบวางบิล/
// ใบเสร็จรับเงิน. A quotation-sourced line already surfaces through
// getBillableTaxInvoicesForCustomer once its parent document is scanned
// there too; a payment-sourced line already surfaces through
// getUnbilledInvoicesForCustomer regardless of billing-note status — this
// fills the one remaining gap, since a manual line has no id to browse by
// through either of those. Same source-doc-type rule as
// getBillableTaxInvoicesForCustomer (ใบวางบิล only browses ใบกำกับภาษี;
// ใบเสร็จรับเงิน browses both, since it can also close out an issued
// ใบวางบิล directly). Excludes lines already copied onto an existing
// document of the target type (billing_note_items.source_item_id), so the
// same line isn't offered twice.
export async function getBillableBillingNoteItemsForCustomer(
  customerId: string,
  targetDocType: "billing_note" | "receipt",
  excludeDocId?: string,
): Promise<BillableBillingNoteItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const sourceDocTypes = targetDocType === "receipt" ? ["tax_invoice", "billing_note"] : ["tax_invoice"];
  const { data: notes, error } = await supabase
    .from("billing_notes")
    .select(
      "id, doc_no, doc_date, billing_note_items(id, quotation_id, payment_id, manual_description, manual_qty, manual_unit, manual_unit_price, amount, apply_wht)",
    )
    .in("doc_type", sourceDocTypes)
    .eq("customer_id", customerId);
  if (error) throw error;

  let claimedQuery = supabase
    .from("billing_note_items")
    .select("billing_note_id, source_item_id, billing_notes!inner(doc_type)")
    .eq("billing_notes.doc_type", targetDocType)
    .not("source_item_id", "is", null);
  if (excludeDocId) claimedQuery = claimedQuery.neq("billing_note_id", excludeDocId);
  const { data: claimed, error: claimedErr } = await claimedQuery;
  if (claimedErr) throw claimedErr;
  const claimedItemIds = new Set((claimed ?? []).map((row) => row.source_item_id as string));

  const result: BillableBillingNoteItem[] = [];
  for (const note of notes ?? []) {
    const items = (note.billing_note_items ?? []) as unknown as {
      id: string;
      quotation_id: string | null;
      payment_id: string | null;
      manual_description: string | null;
      manual_qty: number | null;
      manual_unit: string | null;
      manual_unit_price: number | null;
      amount: number;
      apply_wht: boolean;
    }[];
    for (const it of items) {
      if (it.quotation_id || it.payment_id || claimedItemIds.has(it.id)) continue;
      result.push({
        id: it.id,
        billingNoteDocNo: note.doc_no,
        billingNoteDate: note.doc_date,
        description: it.manual_description ?? "",
        qty: Number(it.manual_qty) || 1,
        unit: it.manual_unit ?? "หน่วย",
        unitPrice: Number(it.manual_unit_price) || 0,
        amount: Number(it.amount),
        applyWht: it.apply_wht,
      });
    }
  }
  return result;
}

// A quotation-sourced line being bundled into a ใบวางบิล/ใบเสร็จรับเงิน
// should be billed at the ใบกำกับภาษี's own net-payable amount (after that
// tax invoice's own discount/WHT/retention) once one exists for that
// quotation — not the quotation's raw gross total, which would ignore a
// withholding tax the tax invoice already accounted for and overstate what's
// actually owed. Batched (one query covering every quotation-sourced item on
// the document) rather than per-item. Also scans ใบวางบิล documents (not
// just ใบกำกับภาษี) — a receipt can now reference an issued ใบวางบิล
// directly (see getBillableTaxInvoicesForCustomer), and its net payable
// needs the same treatment so the receipt bills the right amount rather
// than falling back to the quotation's raw total.
export async function getNetPayableForQuotationIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quotationIds: string[],
): Promise<Record<string, { netPayable: number; grossAmount: number }>> {
  if (quotationIds.length === 0) return {};
  const { data, error } = await supabase
    .from("billing_notes")
    .select(
      "discount_amount, wht_percent, retention_percent, created_at, billing_note_items!inner(quotation_id, amount, apply_wht)",
    )
    .in("doc_type", ["tax_invoice", "billing_note"])
    .in("billing_note_items.quotation_id", quotationIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const result: Record<string, { netPayable: number; grossAmount: number }> = {};
  for (const inv of data ?? []) {
    const items = (inv.billing_note_items ?? []) as unknown as {
      quotation_id: string | null;
      amount: number;
      apply_wht: boolean;
    }[];
    const quotationId = items.find((it) => it.quotation_id && quotationIds.includes(it.quotation_id))?.quotation_id;
    if (!quotationId || result[quotationId] !== undefined) continue; // keep the most recent only

    const summary = computeBillingDocumentSummary(
      items.map((it) => ({ amount: Number(it.amount), applyWht: it.apply_wht })),
      Number(inv.discount_amount),
      Number(inv.wht_percent),
      Number(inv.retention_percent),
    );
    // grossAmount = the tax invoice's own total before its WHT/retention
    // deduction — kept alongside netPayable so a later ใบวางบิล/ใบเสร็จรับเงิน
    // can bill at (and collect toward) the net-payable amount while still
    // printing the invoice's real face value in its "ยอดรวมตามเอกสาร" column.
    result[quotationId] = { netPayable: summary.netPayable, grossAmount: summary.totalAfterVat };
  }
  return result;
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
  "id, doc_no, doc_type, customer_id, doc_date, credit_days, due_date, sales_rep_id, discount_amount, wht_percent, retention_percent, note, created_by, created_at, payment_method, bank_name, payment_reference_no, payment_date, customers(name, address, phone, tax_id), sales_reps(name), profiles(full_name)";

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
  payment_method: PaymentMethod | null;
  bank_name: string | null;
  payment_reference_no: string | null;
  payment_date: string | null;
  customers: { name: string; address: string | null; phone: string | null; tax_id: string | null } | null;
  sales_reps: { name: string } | null;
  // The staff member who issued the document — auto-fills the ผู้วางบิล/
  // ผู้อนุมัติ signature line's name on print, alongside the doc date.
  profiles: { full_name: string } | null;
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
    createdByName: row.profiles?.full_name ?? null,
    createdAt: row.created_at,
    paymentMethod: row.payment_method,
    bankName: row.bank_name,
    paymentReferenceNo: row.payment_reference_no,
    paymentDate: row.payment_date,
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
    ? `id, payment_id, quotation_id, invoice_no_snapshot, invoice_date_snapshot, amount, apply_wht, ${MANUAL_COLUMNS}, payments(projects(job_no))`
    : `id, payment_id, quotation_id, invoice_no_snapshot, invoice_date_snapshot, amount, apply_wht, ${MANUAL_COLUMNS}`;
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
    apply_wht: boolean;
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

  // ใบวางบิล and ใบเสร็จรับเงิน both bill straight from ใบกำกับภาษี now (see
  // getBillableTaxInvoicesForCustomer) — a quotation-sourced line on either
  // should print the tax invoice's doc no. once one exists, not the
  // quotation's, the same rule already applied to ใบวางบิล alone before.
  let taxInvoiceRefsByQuotationId: Record<string, { docNo: string; docDate: string }> = {};
  // The line's stored amount is already the tax invoice's net-payable (after
  // its own WHT/retention — see getNetPayableForQuotationIds), so the
  // itemized table's "ยอดรวมตามเอกสาร" column needs this separately to show
  // the invoice's real face value, with the WHT/retention shown as its own
  // explicit deduction column instead of silently baked into a lower total.
  let grossAmountByQuotationId: Record<string, number> = {};
  if (header.doc_type === "billing_note" || header.doc_type === "receipt") {
    const quotationIds = itemRows.filter((it) => it.quotation_id).map((it) => it.quotation_id as string);
    const [refs, netPayable] = await Promise.all([
      getTaxInvoiceRefsForQuotationIds(supabase, quotationIds),
      getNetPayableForQuotationIds(supabase, quotationIds),
    ]);
    taxInvoiceRefsByQuotationId = refs;
    grossAmountByQuotationId = Object.fromEntries(
      Object.entries(netPayable).map(([qid, v]) => [qid, v.grossAmount]),
    );
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
      const amount = Number(it.amount);
      return {
        id: it.id,
        paymentId: it.payment_id,
        quotationId: it.quotation_id,
        invoiceNo: it.invoice_no_snapshot,
        invoiceDate: it.invoice_date_snapshot,
        amount,
        // Falls back to amount itself for payment-sourced/manual lines,
        // which were never netted against a tax invoice's own WHT.
        grossAmount: (it.quotation_id ? grossAmountByQuotationId[it.quotation_id] : undefined) ?? amount,
        applyWht: it.apply_wht,
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
