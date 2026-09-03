"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getBillingDocumentById, getUnbilledInvoicesForCustomer } from "@/lib/data/billing-documents";
import { getAcceptedUnconvertedQuotationsForCustomer } from "@/lib/data/quotations";
import { BILLING_DOCUMENT_LABELS, BILLING_DOCUMENT_LIST_PATH } from "@/lib/types";
import type { BillableQuotation, BillingDocumentType, UnbilledInvoice } from "@/lib/types";

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

  const { count, error } = await supabase
    .from("billing_notes")
    .select("id", { count: "exact", head: true })
    .like("doc_no", `${prefix}%`);
  if (error) throw error;

  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}

function revalidateBillingDocumentConsumers(docType: BillingDocumentType) {
  revalidatePath(LIST_PATH[docType]);
  revalidatePath("/dashboard/project-sales");
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
      ? supabase.from("payments").select("id, invoice_no, paid_date, amount").in("id", itemPaymentIds)
      : Promise.resolve({ data: [], error: null }),
    itemQuotationIds.length > 0
      ? supabase.from("quotations").select("id, doc_no, quote_date, total").in("id", itemQuotationIds)
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

  const docNo = await generateBillingDocNo(supabase, docType);

  const { data: doc, error: insertErr } = await supabase
    .from("billing_notes")
    .insert({
      doc_no: docNo,
      customer_id: customerId,
      doc_date: docDate,
      credit_days: creditDays,
      due_date: dueDate,
      sales_rep_id: salesRepId,
      doc_type: docType,
      discount_amount: discountAmount,
      wht_percent: whtPercent,
      retention_percent: retentionPercent,
      note,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message, id: null };

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

  // Sync the doc number back onto WALLPOD Project Sales, closing the loop —
  // which field depends on which document type was just issued. Only
  // applies to payment-sourced items — quotation-sourced ones have no
  // payments row yet to sync onto (see the fresh-read comment above).
  if (docType === "billing_note" && itemPaymentIds.length > 0) {
    const { error: syncErr } = await supabase
      .from("payments")
      .update({ billing_note_no: docNo, billing_note_date: docDate })
      .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `บันทึกเอกสารสำเร็จ แต่อัปเดตเลขที่ใบวางบิลใน Project Sales ไม่สำเร็จ: ${syncErr.message}`, id: doc.id };
    }
  } else if (docType === "receipt" && itemPaymentIds.length > 0) {
    const { error: syncErr } = await supabase
      .from("payments")
      .update({ receipt_no: docNo, received_date: docDate })
      .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `บันทึกเอกสารสำเร็จ แต่อัปเดตเลขที่ใบเสร็จใน Project Sales ไม่สำเร็จ: ${syncErr.message}`, id: doc.id };
    }
  }
  // invoice / tax_invoice: no field to sync — eligibility already requires
  // invoice_no to already be set on the payment, so this document just
  // formalizes/prints it.

  await logActivity(`สร้าง${BILLING_DOCUMENT_LABELS[docType]}`, docNo);
  revalidateBillingDocumentConsumers(docType);
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
      ? supabase.from("payments").select("id, invoice_no, paid_date, amount").in("id", itemPaymentIds)
      : Promise.resolve({ data: [], error: null }),
    itemQuotationIds.length > 0
      ? supabase.from("quotations").select("id, doc_no, quote_date, total").in("id", itemQuotationIds)
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

  if (docType === "billing_note") {
    if (removedPaymentIds.length > 0) {
      const { error: clearErr } = await supabase
        .from("payments")
        .update({ billing_note_no: null, billing_note_date: null })
        .in("id", removedPaymentIds);
      if (clearErr) {
        return { error: `แก้ไขเอกสารสำเร็จ แต่ล้างเลขที่ใบวางบิลของรายการที่ถูกเอาออกไม่สำเร็จ: ${clearErr.message}` };
      }
    }
    const { error: syncErr } = itemPaymentIds.length === 0
      ? { error: null }
      : await supabase
          .from("payments")
          .update({ billing_note_no: existing.docNo, billing_note_date: docDate })
          .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `แก้ไขเอกสารสำเร็จ แต่อัปเดตเลขที่ใบวางบิลใน Project Sales ไม่สำเร็จ: ${syncErr.message}` };
    }
  } else if (docType === "receipt") {
    if (removedPaymentIds.length > 0) {
      const { error: clearErr } = await supabase
        .from("payments")
        .update({ receipt_no: null, received_date: null })
        .in("id", removedPaymentIds);
      if (clearErr) {
        return { error: `แก้ไขเอกสารสำเร็จ แต่ล้างเลขที่ใบเสร็จของรายการที่ถูกเอาออกไม่สำเร็จ: ${clearErr.message}` };
      }
    }
    const { error: syncErr } = itemPaymentIds.length === 0
      ? { error: null }
      : await supabase
      .from("payments")
      .update({ receipt_no: existing.docNo, received_date: docDate })
      .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `แก้ไขเอกสารสำเร็จ แต่อัปเดตเลขที่ใบเสร็จใน Project Sales ไม่สำเร็จ: ${syncErr.message}` };
    }
  }

  await logActivity(`แก้ไข${BILLING_DOCUMENT_LABELS[docType]}`, existing.docNo);
  const routeSegment = docType.replace("_", "-");
  revalidateBillingDocumentConsumers(docType);
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
