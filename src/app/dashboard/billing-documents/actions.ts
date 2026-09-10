"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import {
  getBillableBillingNoteItemsForCustomer,
  getBillableTaxInvoicesForCustomer,
  getBillingDocumentById,
  getNetPayableForQuotationIds,
  getUnbilledInvoicesForCustomer,
} from "@/lib/data/billing-documents";
import { getAcceptedUnconvertedQuotationsForCustomer, normalizeJobNo } from "@/lib/data/quotations";
import { computeBillingDocumentSummary } from "@/lib/billing-document-summary";
import { BILLING_DOCUMENT_LABELS, BILLING_DOCUMENT_LIST_PATH } from "@/lib/types";
import type {
  BillableBillingNoteItem,
  BillableQuotation,
  BillableTaxInvoice,
  BillingDocumentType,
  PaymentMethod,
  UnbilledInvoice,
} from "@/lib/types";

// Thin server-action wrapper so the create form (client component) can
// re-fetch a customer's open invoices the moment one is picked, without a
// full page reload.
export async function fetchUnbilledInvoices(customerId: string): Promise<UnbilledInvoice[]> {
  if (!customerId) return [];
  return getUnbilledInvoicesForCustomer(customerId);
}

// Same idea, for the alternative "bill straight from an accepted quotation"
// path used when a job hasn't been recorded (and invoiced) in WALLPOD
// Project Sales yet. Matched by name, not id — see
// getAcceptedUnconvertedQuotationsForCustomer.
export async function fetchBillableQuotations(customerName: string): Promise<BillableQuotation[]> {
  if (!customerName) return [];
  return getAcceptedUnconvertedQuotationsForCustomer(customerName);
}

// ใบวางบิล and ใบเสร็จรับเงิน: browse issued tax invoices directly instead
// of the quotations behind them, per the user's explicit request — each
// checked against its own prior documents (a tax invoice already billed is
// still receiptable, and vice versa).
export async function fetchBillableTaxInvoices(
  customerId: string,
  targetDocType: "billing_note" | "receipt",
  excludeDocId?: string,
): Promise<BillableTaxInvoice[]> {
  if (!customerId) return [];
  return getBillableTaxInvoicesForCustomer(customerId, targetDocType, excludeDocId);
}

// ใบวางบิล/ใบเสร็จรับเงิน — issued documents' manually-typed lines with no
// quotation/payment to browse by otherwise (see
// getBillableBillingNoteItemsForCustomer).
export async function fetchBillableBillingNoteItems(
  customerId: string,
  targetDocType: "billing_note" | "receipt",
  excludeDocId?: string,
): Promise<BillableBillingNoteItem[]> {
  if (!customerId) return [];
  return getBillableBillingNoteItemsForCustomer(customerId, targetDocType, excludeDocId);
}

const DOC_PREFIX: Record<BillingDocumentType, string> = {
  invoice: "IV",
  billing_note: "BL",
  tax_invoice: "INV",
  // Deliberately reuses the "RE" prefix payments.receipt_no values already
  // use elsewhere in this app (e.g. RE202608280003).
  receipt: "RE",
};

const LIST_PATH = BILLING_DOCUMENT_LIST_PATH;

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

async function generateBillingDocNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docType: BillingDocumentType,
): Promise<string> {
  const now = new Date();
  const yyyymmdd =
    String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0");
  const prefix = `${DOC_PREFIX[docType]}${yyyymmdd}`;

  // Based on the highest existing sequence number for today, not a plain
  // row count — a deleted document (e.g. a test row cleaned up earlier)
  // leaves a gap, and count+1 would then collide with a still-surviving
  // higher-numbered row every time, since nothing about that count changes
  // between retries. Same fix already applied to Finished Goods' SKU
  // generator for the same reason.
  const { data, error } = await supabase.from("billing_notes").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.doc_no.slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const seq = String(max + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

// generateBillingDocNo's "count existing rows, use count+1" isn't atomic —
// two submissions close together can both read the same count and both
// try to insert the same doc_no. The unique constraint on doc_no is what
// actually prevents the duplicate; this retries with a freshly recomputed
// number instead of surfacing the raw Postgres "duplicate key" error to
// the user, since a re-read a moment later resolves the race on its own.
const DOC_NO_MAX_ATTEMPTS = 5;

async function insertBillingNoteHeader(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docType: BillingDocumentType,
  fields: {
    customerId: string;
    docDate: string;
    creditDays: number;
    dueDate: string;
    salesRepId: string | null;
    discountAmount: number;
    whtPercent: number;
    retentionPercent: number;
    note: string | null;
    paymentMethod: PaymentMethod | null;
    bankName: string | null;
    paymentReferenceNo: string | null;
    paymentDate: string | null;
    createdBy: string | null;
  },
): Promise<{ ok: true; docNo: string; id: string } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < DOC_NO_MAX_ATTEMPTS; attempt++) {
    const docNo = await generateBillingDocNo(supabase, docType);
    const { data, error } = await supabase
      .from("billing_notes")
      .insert({
        doc_no: docNo,
        customer_id: fields.customerId,
        doc_date: fields.docDate,
        credit_days: fields.creditDays,
        due_date: fields.dueDate,
        sales_rep_id: fields.salesRepId,
        doc_type: docType,
        discount_amount: fields.discountAmount,
        wht_percent: fields.whtPercent,
        retention_percent: fields.retentionPercent,
        note: fields.note,
        payment_method: fields.paymentMethod,
        bank_name: fields.bankName,
        payment_reference_no: fields.paymentReferenceNo,
        payment_date: fields.paymentDate,
        created_by: fields.createdBy,
      })
      .select("id")
      .single();
    if (!error) return { ok: true, docNo, id: data.id as string };
    if (error.code !== "23505") return { ok: false, error: error.message };
  }
  return { ok: false, error: "ไม่สามารถออกเลขที่เอกสารได้ กรุณาลองใหม่อีกครั้ง" };
}

// Beyond the list page itself, a document that syncs doc numbers onto
// Koonway Project Sales needs the specific edit route for each affected JOB
// revalidated too — the edit form's payments come from a server-fetched
// snapshot, so without this a page already open (or opened right after)
// can show stale data until some other navigation happens to revalidate it.
function revalidateBillingDocumentConsumers(docType: BillingDocumentType, affectedJobNos: string[] = []) {
  revalidatePath(LIST_PATH[docType]);
  revalidatePath("/dashboard/project-sales");
  for (const jobNo of new Set(affectedJobNos)) {
    revalidatePath(`/dashboard/project-sales/edit/${encodeURIComponent(jobNo)}`);
  }
}

const SYNC_FIELDS: Record<BillingDocumentType, { no: string; date: string } | null> = {
  invoice: null,
  billing_note: { no: "billing_note_no", date: "billing_note_date" },
  tax_invoice: { no: "tax_invoice_no", date: "tax_invoice_date" },
  receipt: { no: "receipt_no", date: "received_date" },
};

// A JOB billed straight from an accepted quotation (no WALLPOD Project
// Sales payment installment recorded yet — e.g. a job billed the moment it
// closes, before anyone has entered it into Project Sales) has nowhere for
// the new doc number to land. Per the user's explicit choice ("สร้างงวดการ
// ชำระใหม่ให้อัตโนมัติ"), auto-create the next available installment slot
// (1-3, matching the form's 3 fixed slots) on the matching project and
// write the doc number straight onto it — but only the FIRST time.
//
// Correlated by payments.source_tax_invoice_id — the SPECIFIC tax invoice
// that "owns" an installment, not just its quotation. For a tax_invoice/
// invoice document billing directly from a quotation, that's the document's
// own id (it creates/owns whichever installment it lands on, and finds that
// SAME one again on a later edit). For a ใบวางบิล/ใบเสร็จรับเงิน — which
// never bill a quotation directly, only a specific already-issued tax
// invoice (see billing-document-form.tsx) — it's that referenced tax
// invoice's id, passed through as ownerTaxInvoiceId per quotation entry.
// This is what lets a quotation be billed via multiple PARTIAL tax invoices
// (each getting its own installment) without one later document colliding
// with another's slot — matching on quotation id alone couldn't tell two
// partial tax invoices for the same quotation apart. Best-effort throughout
// — a job with no matching project yet, or with all 3 slots already used
// and no existing match, is skipped silently rather than failing the whole
// document.
async function syncQuotationSourcedInstallments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docType: BillingDocumentType,
  docNo: string,
  docDate: string,
  liveQuotations: { id: string; job_number: string | null; total: number }[],
  netPayableByQuotationId: Record<string, { netPayable: number; grossAmount: number }>,
  ownerTaxInvoiceIdByQuotationId: Record<string, string>,
  installmentAmountByQuotationId: Record<string, number> = {},
  whtAmountByQuotationId: Record<string, number> = {},
): Promise<string[]> {
  const syncFields = SYNC_FIELDS[docType];
  const withJobNo = liveQuotations.filter(
    (q): q is { id: string; job_number: string; total: number } => !!q.job_number,
  );
  if (!syncFields || withJobNo.length === 0) return [];

  const { data: projects, error: projErr } = await supabase.from("projects").select("id, job_no").not("job_no", "is", null);
  if (projErr) return [];
  const projectByJobNo = new Map<string, { id: string; job_no: string }>();
  for (const p of projects ?? []) {
    if (p.job_no) projectByJobNo.set(normalizeJobNo(p.job_no), { id: p.id, job_no: p.job_no });
  }

  // Money isn't in hand yet for billing_note/tax_invoice (only issuing a
  // receipt means it's been received) — mirrors parseForm's own
  // paidAmount rule in project-sales/actions.ts (receipt_no is what counts
  // an installment as paid, not an invoice/billing-note number alone).
  const received = docType === "receipt";

  const affectedJobNos: string[] = [];
  for (const q of withJobNo) {
    const ownerTaxInvoiceId = ownerTaxInvoiceIdByQuotationId[q.id];
    if (!ownerTaxInvoiceId) continue; // shouldn't happen — every caller supplies one

    const project = projectByJobNo.get(normalizeJobNo(q.job_number));
    if (!project) continue;

    const { data: existing, error: existingErr } = await supabase
      .from("payments")
      .select("id, installment_no, source_tax_invoice_id, receipt_no")
      .eq("project_id", project.id);
    if (existingErr) continue;

    const netAmount = installmentAmountByQuotationId[q.id] ?? netPayableByQuotationId[q.id]?.netPayable ?? q.total;
    const whtAmount = whtAmountByQuotationId[q.id] ?? 0;
    const priorRow = (existing ?? []).find((p) => p.source_tax_invoice_id === ownerTaxInvoiceId);

    if (priorRow) {
      // Already-received installments keep their status — a later edit to
      // the tax invoice/billing note that produced this installment
      // shouldn't silently un-receive money that already came in.
      const patch: Record<string, unknown> = {
        amount: netAmount,
        wht_amount: whtAmount,
        [syncFields.no]: docNo,
        [syncFields.date]: docDate,
      };
      if (received) {
        patch.status = "เก็บเงินเรียบร้อย";
        patch.outstanding_amount = 0;
      } else if (!priorRow.receipt_no) {
        patch.status = "รอชำระเงิน";
        patch.outstanding_amount = netAmount;
      }
      const { error: updateErr } = await supabase.from("payments").update(patch).eq("id", priorRow.id);
      if (updateErr) continue;
      affectedJobNos.push(project.job_no);
      continue;
    }

    const usedSlots = new Set((existing ?? []).map((p) => p.installment_no));
    const nextSlot = [1, 2, 3].find((n) => !usedSlots.has(n));
    if (!nextSlot) continue;

    const { error: insertErr } = await supabase.from("payments").insert({
      project_id: project.id,
      installment_no: nextSlot,
      amount: netAmount,
      wht_amount: whtAmount,
      status: received ? "เก็บเงินเรียบร้อย" : "รอชำระเงิน",
      outstanding_amount: received ? 0 : netAmount,
      source_quotation_id: q.id,
      source_tax_invoice_id: ownerTaxInvoiceId,
      [syncFields.no]: docNo,
      [syncFields.date]: docDate,
    });
    if (insertErr) continue;
    affectedJobNos.push(project.job_no);
  }
  return affectedJobNos;
}

// Clears this document's own sync fields off whatever installment(s) it
// previously wrote them to, before syncQuotationSourcedInstallments
// re-applies them for whatever's still selected on this edit — simpler and
// more robust than tracking which quotation ids were removed, since it's
// scoped by source_tax_invoice_id (never set on a manually-linked,
// payment-sourced row) rather than by quotation id, which can no longer
// uniquely identify one installment now that a quotation may be split
// across several partial tax invoices.
async function clearQuotationSourcedSyncFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docType: BillingDocumentType,
  docNo: string,
): Promise<void> {
  const syncFields = SYNC_FIELDS[docType];
  if (!syncFields) return;
  await supabase
    .from("payments")
    .update({ [syncFields.no]: null, [syncFields.date]: null })
    .eq(syncFields.no, docNo)
    .not("source_tax_invoice_id", "is", null);
}

interface ParsedManualItem {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
  applyWht: boolean;
  // Set when this row was copied from an issued ใบวางบิล's own manual line
  // (see BillableBillingNoteItem) — stored so that source line isn't
  // offered again once this receipt actually saves.
  sourceItemId: string | null;
  // The source document's own doc_date, when this row was copied from one
  // — stored as invoice_date_snapshot so the printed "เอกสารวันที่" column
  // isn't blank for a copied line. A plain typed row has no date of its own.
  sourceDate: string | null;
}

// A third source of line items, alongside existing invoices and
// quotations: typed straight into the document (e.g. a one-off charge
// with nothing tracked elsewhere) — or copied from an issued ใบวางบิล's own
// manual line, which is submitted through these exact same fields (see
// billing-document-form.tsx's toggleBillingNoteItem). Parallel repeated
// fields, one entry per row; rows with an empty description are dropped
// rather than rejected, since the client always submits every row it's
// rendering.
function parseManualItems(formData: FormData): ParsedManualItem[] {
  const descriptions = formData.getAll("item_manual_description").map((v) => String(v));
  const qtys = formData.getAll("item_manual_qty").map((v) => String(v));
  const units = formData.getAll("item_manual_unit").map((v) => String(v));
  const unitPrices = formData.getAll("item_manual_unit_price").map((v) => String(v));
  const applyWhts = formData.getAll("item_manual_apply_wht").map((v) => String(v));
  const sourceItemIds = formData.getAll("item_manual_source_id").map((v) => String(v));
  const sourceDates = formData.getAll("item_manual_date").map((v) => String(v));

  return descriptions
    .map((description, i) => {
      const qty = num(qtys[i]) || 1;
      const unitPrice = Math.max(0, num(unitPrices[i]));
      return {
        description: description.trim(),
        qty,
        unit: str(units[i]) ?? "หน่วย",
        unitPrice,
        // ราคาต่อหน่วย is entered pre-VAT — stored amount is VAT-inclusive,
        // matching every other item source and computeBillingDocumentSummary
        // (mirrors manualItemAmount in billing-document-form.tsx).
        amount: Math.round(qty * unitPrice * 1.07 * 100) / 100,
        applyWht: applyWhts[i] !== "false",
        sourceItemId: sourceItemIds[i] || null,
        sourceDate: sourceDates[i] || null,
      };
    })
    .filter((it) => it.description);
}

interface ParsedBillingDocument {
  customerId: string;
  docDate: string;
  creditDays: number;
  dueDate: string;
  salesRepId: string | null;
  discountAmount: number;
  whtPercent: number;
  retentionPercent: number;
  note: string | null;
  // ใบเสร็จรับเงิน-only — always parsed (harmless when absent) since only
  // that document type's form ever submits these fields.
  paymentMethod: PaymentMethod | null;
  bankName: string | null;
  paymentReferenceNo: string | null;
  paymentDate: string | null;
  itemPaymentIds: string[];
  itemPaymentApplyWht: boolean[];
  itemQuotationIds: string[];
  itemQuotationApplyWht: boolean[];
  // ใบกำกับภาษี/ใบแจ้งหนี้ only — a partial-billing override (staff editing
  // the amount down from the quotation's full total), parallel to
  // itemQuotationIds. Empty/non-positive entries mean "no override" (bill
  // the full amount, today's existing behavior).
  itemQuotationAmountOverrides: (number | null)[];
  // ใบวางบิล/ใบเสร็จรับเงิน only — the SPECIFIC tax invoice id each
  // quotation-sourced entry was selected from (parallel to
  // itemQuotationIds), needed once a quotation can be billed via multiple
  // partial tax invoices — quotation id alone can no longer say which
  // installment this document's referenced tax invoice actually owns.
  itemQuotationTaxInvoiceRefIds: (string | null)[];
  manualItems: ParsedManualItem[];
}

const PAYMENT_METHODS: PaymentMethod[] = ["เงินสด", "เช็ค", "โอนเงิน", "บัตรเครดิต"];

// Shared by create and update — both need the exact same fields validated
// and parsed identically.
function parseBillingDocumentForm(formData: FormData): { error: string } | ({ error: null } & ParsedBillingDocument) {
  const customerId = str(formData.get("customer_id"));
  if (!customerId) return { error: "กรุณาเลือกลูกค้า" };

  const docDate = str(formData.get("doc_date")) ?? new Date().toISOString().slice(0, 10);
  const creditDays = Math.max(0, Math.round(num(formData.get("credit_days"))));
  const dueDate = new Date(docDate);
  dueDate.setDate(dueDate.getDate() + creditDays);

  const salesRepId = str(formData.get("sales_rep_id"));
  const discountAmount = Math.max(0, num(formData.get("discount_amount")));
  const whtPercent = Math.max(0, num(formData.get("wht_percent")));
  const retentionPercent = Math.max(0, num(formData.get("retention_percent")));
  const note = str(formData.get("note"));

  const paymentMethodRaw = str(formData.get("payment_method"));
  const paymentMethod = PAYMENT_METHODS.includes(paymentMethodRaw as PaymentMethod) ? (paymentMethodRaw as PaymentMethod) : null;
  const bankName = str(formData.get("bank_name"));
  const paymentReferenceNo = str(formData.get("payment_reference_no"));
  const paymentDate = str(formData.get("payment_date"));

  const itemPaymentIds = formData.getAll("item_payment_id").map((v) => String(v));
  const itemPaymentApplyWht = formData.getAll("item_payment_apply_wht").map((v) => String(v) !== "false");
  const itemQuotationIds = formData.getAll("item_quotation_id").map((v) => String(v));
  const itemQuotationApplyWht = formData.getAll("item_quotation_apply_wht").map((v) => String(v) !== "false");
  const itemQuotationAmountOverrides = formData.getAll("item_quotation_amount").map((v) => {
    const n = num(v);
    return n > 0 ? n : null;
  });
  const itemQuotationTaxInvoiceRefIds = formData.getAll("item_quotation_tax_invoice_ref_id").map((v) => {
    const s = String(v);
    return s === "" ? null : s;
  });
  const manualItems = parseManualItems(formData);
  if (itemPaymentIds.length === 0 && itemQuotationIds.length === 0 && manualItems.length === 0) {
    return { error: "กรุณาเลือกหรือกรอกรายการอย่างน้อย 1 รายการ" };
  }

  return {
    error: null,
    customerId,
    docDate,
    creditDays,
    dueDate: dueDate.toISOString().slice(0, 10),
    salesRepId,
    discountAmount,
    whtPercent,
    retentionPercent,
    note,
    paymentMethod,
    bankName,
    paymentReferenceNo,
    paymentDate,
    itemPaymentIds,
    itemPaymentApplyWht,
    itemQuotationIds,
    itemQuotationApplyWht,
    itemQuotationAmountOverrides,
    itemQuotationTaxInvoiceRefIds,
    manualItems,
  };
}

export async function createBillingDocument(docType: BillingDocumentType, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง", id: null };
  }

  const parsed = parseBillingDocumentForm(formData);
  if (parsed.error !== null) return { error: parsed.error, id: null };
  const {
    customerId,
    docDate,
    creditDays,
    dueDate,
    salesRepId,
    discountAmount,
    whtPercent,
    retentionPercent,
    note,
    paymentMethod,
    bankName,
    paymentReferenceNo,
    paymentDate,
    itemPaymentIds,
    itemPaymentApplyWht,
    itemQuotationIds,
    itemQuotationApplyWht,
    itemQuotationAmountOverrides,
    itemQuotationTaxInvoiceRefIds,
    manualItems,
  } = parsed;
  // Keyed lookups, not positional zipping — Supabase's .in(...) result
  // order isn't guaranteed to match itemPaymentIds/itemQuotationIds, but
  // these maps were built from the exact same parallel arrays the form
  // submitted, so they're correct regardless of DB row order.
  const paymentApplyWhtMap = new Map(itemPaymentIds.map((id, i) => [id, itemPaymentApplyWht[i] ?? true]));
  const quotationApplyWhtMap = new Map(itemQuotationIds.map((id, i) => [id, itemQuotationApplyWht[i] ?? true]));
  const quotationAmountOverrideMap = new Map(itemQuotationIds.map((id, i) => [id, itemQuotationAmountOverrides[i]]));
  const quotationTaxInvoiceRefMap = new Map(itemQuotationIds.map((id, i) => [id, itemQuotationTaxInvoiceRefIds[i]]));
  // ใบกำกับภาษี/ใบแจ้งหนี้ bill a quotation directly and own whichever
  // installment they create; ใบวางบิล/ใบเสร็จรับเงิน only ever reference an
  // already-issued tax invoice, so the installment they update is that
  // referenced invoice's own — see syncQuotationSourcedInstallments.
  const billsQuotationDirectly = docType === "tax_invoice" || docType === "invoice";

  // Finished-goods stock deduction — only meaningful for tax_invoice, per
  // the user's explicit "ตัดกับบิลขาย...ตอนออกใบกำกับภาษี...ตัดอัตโนมัติ"
  // requirement. Silently ignored for every other doc type even if somehow
  // present in the submitted form.
  const finishedGoodIds = formData.getAll("item_finished_good_id").map((v) => String(v));
  const finishedGoodQtys = formData.getAll("item_finished_good_qty").map((v) => num(v));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fresh read of the live rows — never trust client-submitted amounts —
  // used both to snapshot each item and (for payments) to sync fields
  // back after. Quotation-sourced items have no payment to sync back onto
  // yet (the job hasn't been recorded in WALLPOD Project Sales) — staff
  // fill that in manually once it has been.
  const [livePaymentsResult, liveQuotationsResult, netPayableByQuotationId] = await Promise.all([
    itemPaymentIds.length > 0
      ? supabase.from("payments").select("id, invoice_no, paid_date, amount, projects(job_no)").in("id", itemPaymentIds)
      : Promise.resolve({ data: [], error: null }),
    itemQuotationIds.length > 0
      ? supabase.from("quotations").select("id, doc_no, quote_date, total, job_number").in("id", itemQuotationIds)
      : Promise.resolve({ data: [], error: null }),
    getNetPayableForQuotationIds(supabase, itemQuotationIds),
  ]);
  if (livePaymentsResult.error) return { error: livePaymentsResult.error.message, id: null };
  if (liveQuotationsResult.error) return { error: liveQuotationsResult.error.message, id: null };
  const livePayments = livePaymentsResult.data ?? [];
  const liveQuotations = liveQuotationsResult.data ?? [];
  if (livePayments.length !== itemPaymentIds.length) {
    return { error: "ไม่พบรายการใบแจ้งหนี้บางรายการ กรุณาลองใหม่", id: null };
  }
  if (liveQuotations.length !== itemQuotationIds.length) {
    return { error: "ไม่พบรายการใบเสนอราคาบางรายการ กรุณาลองใหม่", id: null };
  }

  const headerResult = await insertBillingNoteHeader(supabase, docType, {
    customerId,
    docDate,
    creditDays,
    dueDate,
    salesRepId,
    discountAmount,
    whtPercent,
    retentionPercent,
    note,
    paymentMethod,
    bankName,
    paymentReferenceNo,
    paymentDate,
    createdBy: user?.id ?? null,
  });
  if (!headerResult.ok) return { error: headerResult.error, id: null };
  const { docNo, id: docId } = headerResult;
  const doc = { id: docId };

  // A ใบกำกับภาษี/ใบแจ้งหนี้ billing a quotation directly owns whichever
  // installment it creates (its own doc id is the correlator); a ใบวางบิล/
  // ใบเสร็จรับเงิน updates the installment already owned by the specific tax
  // invoice it selected. Also resolves each quotation-sourced line's real
  // billed amount — a staff-entered partial override when billing directly
  // (billsQuotationDirectly), else the referenced tax invoice's own
  // net-payable (after its own discount/WHT/retention), else the
  // quotation's raw total.
  const ownerTaxInvoiceIdByQuotationId: Record<string, string> = {};
  // What THIS document's own billing_note_items row stores — gross when
  // billing a quotation directly (matches the tax invoice's real face
  // value, per the itemized print view), already-net when referencing an
  // existing tax invoice.
  const quotationBilledAmountById: Record<string, number> = {};
  // What actually lands on the Project Sales installment — always the net,
  // cash-equivalent amount (gross minus this line's own WHT/retention),
  // distinct from quotationBilledAmountById when billing a quotation
  // directly (which stores gross).
  const installmentAmountByQuotationId: Record<string, number> = {};
  const whtAmountByQuotationId: Record<string, number> = {};
  for (const q of liveQuotations) {
    const owner = billsQuotationDirectly ? doc.id : quotationTaxInvoiceRefMap.get(q.id);
    if (owner) ownerTaxInvoiceIdByQuotationId[q.id] = owner;
    const override = billsQuotationDirectly ? quotationAmountOverrideMap.get(q.id) : null;
    quotationBilledAmountById[q.id] = override ?? netPayableByQuotationId[q.id]?.netPayable ?? q.total;
    // How much of this installment is already settled via a WHT
    // certificate rather than cash — synced onto the installment so
    // Project Sales can tell "still owed" apart from "settled, just not in
    // cash" (see getFullProjectReport/getProjectByJobNo). Billing a
    // quotation directly: this document's own WHT%/retention% applies to
    // its own gross billed amount — computed via the same summary function
    // the print view uses, so the installment nets out exactly like the
    // document itself does. Referencing an existing tax invoice instead:
    // the gap between that invoice's gross and its already-net amount IS
    // its WHT (and retention, if any) — already settled at that invoice's
    // own issuance, not recomputed from this document's (typically 0) WHT%.
    if (billsQuotationDirectly) {
      const applyWht = quotationApplyWhtMap.get(q.id) ?? true;
      const grossAmount = quotationBilledAmountById[q.id];
      const lineSummary = computeBillingDocumentSummary([{ amount: grossAmount, applyWht }], 0, whtPercent, retentionPercent);
      installmentAmountByQuotationId[q.id] = lineSummary.netPayable;
      whtAmountByQuotationId[q.id] = Math.round((lineSummary.whtAmount + lineSummary.retentionAmount) * 100) / 100;
    } else {
      const gross = netPayableByQuotationId[q.id]?.grossAmount ?? q.total;
      installmentAmountByQuotationId[q.id] = quotationBilledAmountById[q.id];
      whtAmountByQuotationId[q.id] = Math.round((gross - quotationBilledAmountById[q.id]) * 100) / 100;
    }
  }

  const { error: itemsErr } = await supabase.from("billing_note_items").insert([
    ...livePayments.map((p) => ({
      billing_note_id: doc.id,
      payment_id: p.id,
      invoice_no_snapshot: p.invoice_no,
      invoice_date_snapshot: p.paid_date,
      amount: p.amount,
      apply_wht: paymentApplyWhtMap.get(p.id) ?? true,
    })),
    ...liveQuotations.map((q) => ({
      billing_note_id: doc.id,
      quotation_id: q.id,
      invoice_no_snapshot: q.doc_no,
      invoice_date_snapshot: q.quote_date,
      amount: quotationBilledAmountById[q.id],
      apply_wht: quotationApplyWhtMap.get(q.id) ?? true,
    })),
    ...manualItems.map((m) => ({
      billing_note_id: doc.id,
      invoice_no_snapshot: m.description,
      invoice_date_snapshot: m.sourceDate,
      amount: m.amount,
      manual_description: m.description,
      manual_qty: m.qty,
      manual_unit: m.unit,
      manual_unit_price: m.unitPrice,
      apply_wht: m.applyWht,
      source_item_id: m.sourceItemId,
    })),
  ]);
  if (itemsErr) return { error: `บันทึกเอกสารสำเร็จ แต่บันทึกรายการไม่สำเร็จ: ${itemsErr.message}`, id: doc.id };

  // Deduct finished-goods stock, automatically, only when issuing a
  // ใบกำกับภาษี — matches the user's explicit requirement that this
  // deduction happen at tax-invoice time with no separate confirmation
  // step. Best-effort per line: a failed deduction is surfaced but doesn't
  // roll back the already-created document, consistent with this app's
  // existing convention for secondary writes after the primary record
  // lands (e.g. image uploads in Sale Report/Stock Product).
  if (docType === "tax_invoice" && finishedGoodIds.length > 0) {
    for (let i = 0; i < finishedGoodIds.length; i++) {
      const qty = finishedGoodQtys[i];
      if (!(qty > 0)) continue;
      const { error: deductErr } = await supabase.rpc("record_finished_goods_movement", {
        p_id: finishedGoodIds[i],
        p_type: "out",
        p_qty: qty,
        p_note: `ตัดสต๊อกตามใบกำกับภาษี ${docNo}`,
        p_reference: docNo,
      });
      if (deductErr) {
        return {
          error: `บันทึกใบกำกับภาษีสำเร็จ (${docNo}) แต่ตัดสต๊อกสินค้าสำเร็จรูปบางรายการไม่สำเร็จ: ${deductErr.message}`,
          id: doc.id,
        };
      }
    }
    revalidatePath("/dashboard/finished-goods");
  }

  // Sync the doc number back onto WALLPOD Project Sales, closing the loop —
  // which field depends on which document type was just issued.
  const syncFields = SYNC_FIELDS[docType];
  const paymentJobNos: string[] = [];
  if (syncFields && itemPaymentIds.length > 0) {
    // Per-row, not a bulk .update().in() — each payment's own WHT
    // deduction (this document's WHT% against its own amount) can differ
    // per line depending on its applyWht flag.
    for (const p of livePayments) {
      const applyWht = paymentApplyWhtMap.get(p.id) ?? true;
      const whtAmount = applyWht ? Math.round(((p.amount / 1.07) * (whtPercent / 100)) * 100) / 100 : 0;
      const { error: syncErr } = await supabase
        .from("payments")
        .update({ [syncFields.no]: docNo, [syncFields.date]: docDate, wht_amount: whtAmount })
        .eq("id", p.id);
      if (syncErr) {
        return { error: `บันทึกเอกสารสำเร็จ แต่อัปเดตเลขที่เอกสารใน Project Sales ไม่สำเร็จ: ${syncErr.message}`, id: doc.id };
      }
      // @ts-expect-error -- Supabase types the joined relation loosely here
      const jobNo = (p.projects as { job_no: string | null } | null)?.job_no;
      if (jobNo) paymentJobNos.push(jobNo);
    }
  }
  // invoice: no field to sync — eligibility already requires invoice_no to
  // already be set on the payment, so this document just formalizes/prints it.

  // Quotation-sourced items (JOB billed directly from an accepted
  // quotation, no payment installment recorded yet) get a brand-new
  // installment auto-created on the matching JOB instead — see
  // syncQuotationSourcedInstallments.
  const quotationJobNos = await syncQuotationSourcedInstallments(
    supabase,
    docType,
    docNo,
    docDate,
    liveQuotations,
    netPayableByQuotationId,
    ownerTaxInvoiceIdByQuotationId,
    installmentAmountByQuotationId,
    whtAmountByQuotationId,
  );

  await logActivity(`สร้าง${BILLING_DOCUMENT_LABELS[docType]}`, docNo);
  revalidateBillingDocumentConsumers(docType, [...paymentJobNos, ...quotationJobNos]);
  return { error: null, id: doc.id as string };
}

export async function updateBillingDocument(docType: BillingDocumentType, id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  // Fresh read, not client-supplied — this is the true "before" state used
  // to work out which invoices were removed from the bundle below, matching
  // this app's established audit/edit convention (e.g. Goods Receipt's
  // updateGoodsReceipt, Stock Requisition's updateStockRequisition).
  const existing = await getBillingDocumentById(id);
  if (!existing) return { error: "ไม่พบเอกสารนี้ในระบบ" };

  const newDocNo = str(formData.get("doc_no")) ?? existing.docNo;

  const parsed = parseBillingDocumentForm(formData);
  if (parsed.error !== null) return { error: parsed.error };
  const {
    customerId,
    docDate,
    creditDays,
    dueDate,
    salesRepId,
    discountAmount,
    whtPercent,
    retentionPercent,
    note,
    paymentMethod,
    bankName,
    paymentReferenceNo,
    paymentDate,
    itemPaymentIds,
    itemPaymentApplyWht,
    itemQuotationIds,
    itemQuotationApplyWht,
    itemQuotationAmountOverrides,
    itemQuotationTaxInvoiceRefIds,
    manualItems,
  } = parsed;
  const paymentApplyWhtMap = new Map(itemPaymentIds.map((id, i) => [id, itemPaymentApplyWht[i] ?? true]));
  const quotationApplyWhtMap = new Map(itemQuotationIds.map((id, i) => [id, itemQuotationApplyWht[i] ?? true]));
  const quotationAmountOverrideMap = new Map(itemQuotationIds.map((id, i) => [id, itemQuotationAmountOverrides[i]]));
  const quotationTaxInvoiceRefMap = new Map(itemQuotationIds.map((id, i) => [id, itemQuotationTaxInvoiceRefIds[i]]));
  // See createBillingDocument's identical logic.
  const billsQuotationDirectly = docType === "tax_invoice" || docType === "invoice";

  const supabase = await createClient();

  const [livePaymentsResult, liveQuotationsResult, netPayableByQuotationId] = await Promise.all([
    itemPaymentIds.length > 0
      ? supabase.from("payments").select("id, invoice_no, paid_date, amount, projects(job_no)").in("id", itemPaymentIds)
      : Promise.resolve({ data: [], error: null }),
    itemQuotationIds.length > 0
      ? supabase.from("quotations").select("id, doc_no, quote_date, total, job_number").in("id", itemQuotationIds)
      : Promise.resolve({ data: [], error: null }),
    getNetPayableForQuotationIds(supabase, itemQuotationIds),
  ]);
  if (livePaymentsResult.error) return { error: livePaymentsResult.error.message };
  if (liveQuotationsResult.error) return { error: liveQuotationsResult.error.message };
  const livePayments = livePaymentsResult.data ?? [];
  const liveQuotations = liveQuotationsResult.data ?? [];
  if (livePayments.length !== itemPaymentIds.length) {
    return { error: "ไม่พบรายการใบแจ้งหนี้บางรายการ กรุณาลองใหม่" };
  }
  if (liveQuotations.length !== itemQuotationIds.length) {
    return { error: "ไม่พบรายการใบเสนอราคาบางรายการ กรุณาลองใหม่" };
  }

  const { error: updateErr } = await supabase
    .from("billing_notes")
    .update({
      doc_no: newDocNo,
      customer_id: customerId,
      doc_date: docDate,
      credit_days: creditDays,
      due_date: dueDate,
      sales_rep_id: salesRepId,
      discount_amount: discountAmount,
      wht_percent: whtPercent,
      retention_percent: retentionPercent,
      note,
      payment_method: paymentMethod,
      bank_name: bankName,
      payment_reference_no: paymentReferenceNo,
      payment_date: paymentDate,
    })
    .eq("id", id);
  if (updateErr?.code === "23505") return { error: "แก้ไขไม่สำเร็จ — เลขที่เอกสารนี้มีอยู่ในระบบแล้ว กรุณาใช้เลขที่อื่น" };
  if (updateErr) return { error: updateErr.message };

  const { error: deleteItemsErr } = await supabase.from("billing_note_items").delete().eq("billing_note_id", id);
  if (deleteItemsErr) {
    return { error: `แก้ไขข้อมูลทั่วไปสำเร็จ แต่แก้ไขรายการไม่สำเร็จ: ${deleteItemsErr.message}` };
  }

  // See createBillingDocument's identical logic — resolves each
  // quotation-sourced line's owning tax invoice and real billed amount.
  const ownerTaxInvoiceIdByQuotationId: Record<string, string> = {};
  const quotationBilledAmountById: Record<string, number> = {};
  const installmentAmountByQuotationId: Record<string, number> = {};
  const whtAmountByQuotationId: Record<string, number> = {};
  for (const q of liveQuotations) {
    const owner = billsQuotationDirectly ? id : quotationTaxInvoiceRefMap.get(q.id);
    if (owner) ownerTaxInvoiceIdByQuotationId[q.id] = owner;
    const override = billsQuotationDirectly ? quotationAmountOverrideMap.get(q.id) : null;
    quotationBilledAmountById[q.id] = override ?? netPayableByQuotationId[q.id]?.netPayable ?? q.total;
    if (billsQuotationDirectly) {
      const applyWht = quotationApplyWhtMap.get(q.id) ?? true;
      const grossAmount = quotationBilledAmountById[q.id];
      const lineSummary = computeBillingDocumentSummary([{ amount: grossAmount, applyWht }], 0, whtPercent, retentionPercent);
      installmentAmountByQuotationId[q.id] = lineSummary.netPayable;
      whtAmountByQuotationId[q.id] = Math.round((lineSummary.whtAmount + lineSummary.retentionAmount) * 100) / 100;
    } else {
      const gross = netPayableByQuotationId[q.id]?.grossAmount ?? q.total;
      installmentAmountByQuotationId[q.id] = quotationBilledAmountById[q.id];
      whtAmountByQuotationId[q.id] = Math.round((gross - quotationBilledAmountById[q.id]) * 100) / 100;
    }
  }

  const { error: itemsErr } = await supabase.from("billing_note_items").insert([
    ...livePayments.map((p) => ({
      billing_note_id: id,
      payment_id: p.id,
      invoice_no_snapshot: p.invoice_no,
      invoice_date_snapshot: p.paid_date,
      amount: p.amount,
      apply_wht: paymentApplyWhtMap.get(p.id) ?? true,
    })),
    ...liveQuotations.map((q) => ({
      billing_note_id: id,
      quotation_id: q.id,
      invoice_no_snapshot: q.doc_no,
      invoice_date_snapshot: q.quote_date,
      amount: quotationBilledAmountById[q.id],
      apply_wht: quotationApplyWhtMap.get(q.id) ?? true,
    })),
    ...manualItems.map((m) => ({
      billing_note_id: id,
      invoice_no_snapshot: m.description,
      invoice_date_snapshot: m.sourceDate,
      amount: m.amount,
      manual_description: m.description,
      manual_qty: m.qty,
      manual_unit: m.unit,
      manual_unit_price: m.unitPrice,
      apply_wht: m.applyWht,
      source_item_id: m.sourceItemId,
    })),
  ]);
  if (itemsErr) return { error: `แก้ไขรายการไม่สำเร็จ: ${itemsErr.message}` };

  // Reconcile the sync-back: clear the field on any invoice that was
  // removed from the bundle (it's no longer represented by this document),
  // then (re)set it on every invoice now selected — same fields
  // createBillingDocument syncs on create, just with an extra "removed"
  // step edit needs and create doesn't.
  const oldPaymentIds = new Set(existing.items.map((it) => it.paymentId).filter((pid): pid is string => !!pid));
  const removedPaymentIds = [...oldPaymentIds].filter((pid) => !itemPaymentIds.includes(pid));

  const syncFields = SYNC_FIELDS[docType];
  const paymentJobNos: string[] = [];
  if (syncFields) {
    if (removedPaymentIds.length > 0) {
      const { error: clearErr } = await supabase
        .from("payments")
        .update({ [syncFields.no]: null, [syncFields.date]: null })
        .in("id", removedPaymentIds);
      if (clearErr) {
        return { error: `แก้ไขเอกสารสำเร็จ แต่ล้างเลขที่เอกสารของรายการที่ถูกเอาออกไม่สำเร็จ: ${clearErr.message}` };
      }
    }
    // Per-row, not a bulk .update().in() — each payment's own WHT
    // deduction can differ per line depending on its applyWht flag.
    for (const p of livePayments) {
      const applyWht = paymentApplyWhtMap.get(p.id) ?? true;
      const whtAmount = applyWht ? Math.round(((p.amount / 1.07) * (whtPercent / 100)) * 100) / 100 : 0;
      const { error: syncErr } = await supabase
        .from("payments")
        .update({ [syncFields.no]: newDocNo, [syncFields.date]: docDate, wht_amount: whtAmount })
        .eq("id", p.id);
      if (syncErr) {
        return { error: `แก้ไขเอกสารสำเร็จ แต่อัปเดตเลขที่เอกสารใน Project Sales ไม่สำเร็จ: ${syncErr.message}` };
      }
      // @ts-expect-error -- Supabase types the joined relation loosely here
      const jobNo = (p.projects as { job_no: string | null } | null)?.job_no;
      if (jobNo) paymentJobNos.push(jobNo);
    }
  }

  // Same reconciliation, for quotation-sourced items — previously only done
  // on create, which is exactly why editing a document never propagated
  // changes back to WALLPOD Project Sales at all for this source. Clear
  // first (scoped to whatever this document itself previously synced),
  // then resync so only the still-selected lines get their fields set
  // again — see clearQuotationSourcedSyncFields.
  // Clear scoped to the OLD doc_no (whatever was previously synced under
  // it), then resync using the NEW one — so a renamed doc_no propagates to
  // every installment it's already linked to, not just future syncs.
  await clearQuotationSourcedSyncFields(supabase, docType, existing.docNo);
  const quotationJobNos = await syncQuotationSourcedInstallments(
    supabase,
    docType,
    newDocNo,
    docDate,
    liveQuotations,
    netPayableByQuotationId,
    ownerTaxInvoiceIdByQuotationId,
    installmentAmountByQuotationId,
    whtAmountByQuotationId,
  );

  await logActivity(
    `แก้ไข${BILLING_DOCUMENT_LABELS[docType]}`,
    newDocNo !== existing.docNo ? `${newDocNo} (เปลี่ยนจาก ${existing.docNo})` : newDocNo,
  );
  const routeSegment = docType.replace("_", "-");
  revalidateBillingDocumentConsumers(docType, [...paymentJobNos, ...quotationJobNos]);
  revalidatePath(`/dashboard/billing-documents/${routeSegment}/edit/${id}`);
  revalidatePath(`/dashboard/billing-documents/${routeSegment}/view/${id}`);
  return { error: null };
}

export async function deleteBillingDocument(docType: BillingDocumentType, id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: doc } = await supabase.from("billing_notes").select("doc_no").eq("id", id).single();
  const { error } = await supabase.from("billing_notes").delete().eq("id", id);
  if (error) return { error: error.message };

  // A deleted ใบวางบิล/ใบกำกับภาษี/ใบเสร็จรับเงิน shouldn't keep showing its
  // doc no./date on a WALLPOD Project Sales installment as if it still
  // existed — clear whichever pair this doc type syncs (matched by doc_no,
  // since that's the stable link regardless of whether the item was
  // payment-sourced or a quotation-sourced auto-created installment). Only
  // the two synced columns are cleared — the installment's amount/status
  // and any other doc number on it are left untouched.
  const syncFields = SYNC_FIELDS[docType];
  let affectedJobNos: string[] = [];
  if (syncFields && doc?.doc_no) {
    const { data: affectedPayments } = await supabase
      .from("payments")
      .select("id, projects(job_no)")
      .eq(syncFields.no, doc.doc_no);
    if (affectedPayments && affectedPayments.length > 0) {
      affectedJobNos = affectedPayments
        // @ts-expect-error -- Supabase types the joined relation loosely here
        .map((p) => (p.projects as { job_no: string | null } | null)?.job_no)
        .filter((j): j is string => !!j);
      await supabase.from("payments").update({ [syncFields.no]: null, [syncFields.date]: null }).eq(syncFields.no, doc.doc_no);
    }
  }

  await logActivity(`ลบ${BILLING_DOCUMENT_LABELS[docType]}`, doc?.doc_no ?? null);
  revalidateBillingDocumentConsumers(docType, affectedJobNos);
  return { error: null };
}
