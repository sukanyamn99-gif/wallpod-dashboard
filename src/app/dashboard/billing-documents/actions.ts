"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import {
  getBillableTaxInvoicesForCustomer,
  getBillingDocumentById,
  getUnbilledInvoicesForCustomer,
} from "@/lib/data/billing-documents";
import { getAcceptedUnconvertedQuotationsForCustomer, normalizeJobNo } from "@/lib/data/quotations";
import { BILLING_DOCUMENT_LABELS, BILLING_DOCUMENT_LIST_PATH } from "@/lib/types";
import type { BillableQuotation, BillableTaxInvoice, BillingDocumentType, UnbilledInvoice } from "@/lib/types";

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

// ใบวางบิล-only: browse issued tax invoices directly instead of the
// quotations behind them, per the user's explicit request.
export async function fetchBillableTaxInvoices(customerId: string, excludeBillingNoteId?: string): Promise<BillableTaxInvoice[]> {
  if (!customerId) return [];
  return getBillableTaxInvoicesForCustomer(customerId, excludeBillingNoteId);
}

const DOC_PREFIX: Record<BillingDocumentType, string> = {
  // ใบแจ้งหนี้ and ใบกำกับภาษี deliberately share the "INV" prefix — they
  // share one running number series (a common Thai billing convention),
  // so generateBillingDocNo's same-day count naturally covers both types.
  invoice: "INV",
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
// write the doc number straight onto it. Best-effort throughout — a job
// with no matching project yet, or with all 3 slots already used, is
// skipped silently rather than failing the whole document.
async function syncQuotationSourcedInstallments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  docType: BillingDocumentType,
  docNo: string,
  docDate: string,
  liveQuotations: { id: string; job_number: string | null; total: number }[],
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
    const project = projectByJobNo.get(normalizeJobNo(q.job_number));
    if (!project) continue;

    const { data: existing, error: existingErr } = await supabase
      .from("payments")
      .select("installment_no")
      .eq("project_id", project.id);
    if (existingErr) continue;
    const usedSlots = new Set((existing ?? []).map((p) => p.installment_no));
    const nextSlot = [1, 2, 3].find((n) => !usedSlots.has(n));
    if (!nextSlot) continue;

    const { error: insertErr } = await supabase.from("payments").insert({
      project_id: project.id,
      installment_no: nextSlot,
      amount: q.total,
      status: received ? "เก็บเงินเรียบร้อย" : "รอชำระเงิน",
      outstanding_amount: received ? 0 : q.total,
      [syncFields.no]: docNo,
      [syncFields.date]: docDate,
    });
    if (insertErr) continue;
    affectedJobNos.push(project.job_no);
  }
  return affectedJobNos;
}

interface ParsedManualItem {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

// A third source of line items, alongside existing invoices and
// quotations: typed straight into the document (e.g. a one-off charge
// with nothing tracked elsewhere). Parallel repeated fields, one entry
// per row; rows with an empty description are dropped rather than
// rejected, since the client always submits every row it's rendering.
function parseManualItems(formData: FormData): ParsedManualItem[] {
  const descriptions = formData.getAll("item_manual_description").map((v) => String(v));
  const qtys = formData.getAll("item_manual_qty").map((v) => String(v));
  const units = formData.getAll("item_manual_unit").map((v) => String(v));
  const unitPrices = formData.getAll("item_manual_unit_price").map((v) => String(v));

  return descriptions
    .map((description, i) => {
      const qty = num(qtys[i]) || 1;
      const unitPrice = Math.max(0, num(unitPrices[i]));
      return {
        description: description.trim(),
        qty,
        unit: str(units[i]) ?? "หน่วย",
        unitPrice,
        amount: Math.round(qty * unitPrice * 100) / 100,
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
  itemPaymentIds: string[];
  itemQuotationIds: string[];
  manualItems: ParsedManualItem[];
}

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

  const itemPaymentIds = formData.getAll("item_payment_id").map((v) => String(v));
  const itemQuotationIds = formData.getAll("item_quotation_id").map((v) => String(v));
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
    itemPaymentIds,
    itemQuotationIds,
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
    itemPaymentIds,
    itemQuotationIds,
    manualItems,
  } = parsed;

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
  const [livePaymentsResult, liveQuotationsResult] = await Promise.all([
    itemPaymentIds.length > 0
      ? supabase.from("payments").select("id, invoice_no, paid_date, amount, projects(job_no)").in("id", itemPaymentIds)
      : Promise.resolve({ data: [], error: null }),
    itemQuotationIds.length > 0
      ? supabase.from("quotations").select("id, doc_no, quote_date, total, job_number").in("id", itemQuotationIds)
      : Promise.resolve({ data: [], error: null }),
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
    createdBy: user?.id ?? null,
  });
  if (!headerResult.ok) return { error: headerResult.error, id: null };
  const { docNo, id: docId } = headerResult;
  const doc = { id: docId };

  const { error: itemsErr } = await supabase.from("billing_note_items").insert([
    ...livePayments.map((p) => ({
      billing_note_id: doc.id,
      payment_id: p.id,
      invoice_no_snapshot: p.invoice_no,
      invoice_date_snapshot: p.paid_date,
      amount: p.amount,
    })),
    ...liveQuotations.map((q) => ({
      billing_note_id: doc.id,
      quotation_id: q.id,
      invoice_no_snapshot: q.doc_no,
      invoice_date_snapshot: q.quote_date,
      amount: q.total,
    })),
    ...manualItems.map((m) => ({
      billing_note_id: doc.id,
      invoice_no_snapshot: m.description,
      amount: m.amount,
      manual_description: m.description,
      manual_qty: m.qty,
      manual_unit: m.unit,
      manual_unit_price: m.unitPrice,
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
    const { error: syncErr } = await supabase
      .from("payments")
      .update({ [syncFields.no]: docNo, [syncFields.date]: docDate })
      .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `บันทึกเอกสารสำเร็จ แต่อัปเดตเลขที่เอกสารใน Project Sales ไม่สำเร็จ: ${syncErr.message}`, id: doc.id };
    }
    for (const p of livePayments) {
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
  const quotationJobNos = await syncQuotationSourcedInstallments(supabase, docType, docNo, docDate, liveQuotations);

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
    itemPaymentIds,
    itemQuotationIds,
    manualItems,
  } = parsed;

  const supabase = await createClient();

  const [livePaymentsResult, liveQuotationsResult] = await Promise.all([
    itemPaymentIds.length > 0
      ? supabase.from("payments").select("id, invoice_no, paid_date, amount, projects(job_no)").in("id", itemPaymentIds)
      : Promise.resolve({ data: [], error: null }),
    itemQuotationIds.length > 0
      ? supabase.from("quotations").select("id, doc_no, quote_date, total, job_number").in("id", itemQuotationIds)
      : Promise.resolve({ data: [], error: null }),
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
      customer_id: customerId,
      doc_date: docDate,
      credit_days: creditDays,
      due_date: dueDate,
      sales_rep_id: salesRepId,
      discount_amount: discountAmount,
      wht_percent: whtPercent,
      retention_percent: retentionPercent,
      note,
    })
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  const { error: deleteItemsErr } = await supabase.from("billing_note_items").delete().eq("billing_note_id", id);
  if (deleteItemsErr) {
    return { error: `แก้ไขข้อมูลทั่วไปสำเร็จ แต่แก้ไขรายการไม่สำเร็จ: ${deleteItemsErr.message}` };
  }

  const { error: itemsErr } = await supabase.from("billing_note_items").insert([
    ...livePayments.map((p) => ({
      billing_note_id: id,
      payment_id: p.id,
      invoice_no_snapshot: p.invoice_no,
      invoice_date_snapshot: p.paid_date,
      amount: p.amount,
    })),
    ...liveQuotations.map((q) => ({
      billing_note_id: id,
      quotation_id: q.id,
      invoice_no_snapshot: q.doc_no,
      invoice_date_snapshot: q.quote_date,
      amount: q.total,
    })),
    ...manualItems.map((m) => ({
      billing_note_id: id,
      invoice_no_snapshot: m.description,
      amount: m.amount,
      manual_description: m.description,
      manual_qty: m.qty,
      manual_unit: m.unit,
      manual_unit_price: m.unitPrice,
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
    const { error: syncErr } =
      itemPaymentIds.length === 0
        ? { error: null }
        : await supabase
            .from("payments")
            .update({ [syncFields.no]: existing.docNo, [syncFields.date]: docDate })
            .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `แก้ไขเอกสารสำเร็จ แต่อัปเดตเลขที่เอกสารใน Project Sales ไม่สำเร็จ: ${syncErr.message}` };
    }
    for (const p of livePayments) {
      // @ts-expect-error -- Supabase types the joined relation loosely here
      const jobNo = (p.projects as { job_no: string | null } | null)?.job_no;
      if (jobNo) paymentJobNos.push(jobNo);
    }
  }

  await logActivity(`แก้ไข${BILLING_DOCUMENT_LABELS[docType]}`, existing.docNo);
  const routeSegment = docType.replace("_", "-");
  revalidateBillingDocumentConsumers(docType, paymentJobNos);
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

  await logActivity(`ลบ${BILLING_DOCUMENT_LABELS[docType]}`, doc?.doc_no ?? null);
  revalidateBillingDocumentConsumers(docType);
  return { error: null };
}
