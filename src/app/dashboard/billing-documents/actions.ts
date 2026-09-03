"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getUnbilledInvoicesForCustomer } from "@/lib/data/billing-documents";
import { BILLING_DOCUMENT_LABELS } from "@/lib/types";
import type { BillingDocumentType, UnbilledInvoice } from "@/lib/types";

// Thin server-action wrapper so the create form (client component) can
// re-fetch a customer's open invoices the moment one is picked, without a
// full page reload.
export async function fetchUnbilledInvoices(customerId: string): Promise<UnbilledInvoice[]> {
  if (!customerId) return [];
  return getUnbilledInvoicesForCustomer(customerId);
}

const DOC_PREFIX: Record<BillingDocumentType, string> = {
  billing_note: "BL",
  tax_invoice: "TX",
  // Deliberately reuses the "RE" prefix payments.receipt_no values already
  // use elsewhere in this app (e.g. RE202608280003).
  receipt: "RE",
};

const LIST_PATH: Record<BillingDocumentType, string> = {
  billing_note: "/dashboard/billing-documents/billing-note",
  tax_invoice: "/dashboard/billing-documents/tax-invoice",
  receipt: "/dashboard/billing-documents/receipt",
};

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

export async function createBillingDocument(docType: BillingDocumentType, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง", id: null };
  }

  const customerId = str(formData.get("customer_id"));
  if (!customerId) return { error: "กรุณาเลือกลูกค้า", id: null };

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
  if (itemPaymentIds.length === 0) {
    return { error: "กรุณาเลือกรายการใบแจ้งหนี้อย่างน้อย 1 รายการ", id: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fresh read of the live payments rows — never trust client-submitted
  // amounts — used both to snapshot the item and to sync fields back after.
  const { data: livePayments, error: paymentsErr } = await supabase
    .from("payments")
    .select("id, invoice_no, paid_date, amount")
    .in("id", itemPaymentIds);
  if (paymentsErr) return { error: paymentsErr.message, id: null };
  if (!livePayments || livePayments.length !== itemPaymentIds.length) {
    return { error: "ไม่พบรายการใบแจ้งหนี้บางรายการ กรุณาลองใหม่", id: null };
  }

  const docNo = await generateBillingDocNo(supabase, docType);

  const { data: doc, error: insertErr } = await supabase
    .from("billing_notes")
    .insert({
      doc_no: docNo,
      customer_id: customerId,
      doc_date: docDate,
      credit_days: creditDays,
      due_date: dueDate.toISOString().slice(0, 10),
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

  const { error: itemsErr } = await supabase.from("billing_note_items").insert(
    livePayments.map((p) => ({
      billing_note_id: doc.id,
      payment_id: p.id,
      invoice_no_snapshot: p.invoice_no,
      invoice_date_snapshot: p.paid_date,
      amount: p.amount,
    })),
  );
  if (itemsErr) return { error: `บันทึกเอกสารสำเร็จ แต่บันทึกรายการไม่สำเร็จ: ${itemsErr.message}`, id: doc.id };

  // Sync the doc number back onto WALLPOD Project Sales, closing the loop —
  // which field depends on which document type was just issued.
  if (docType === "billing_note") {
    const { error: syncErr } = await supabase
      .from("payments")
      .update({ billing_note_no: docNo, billing_note_date: docDate })
      .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `บันทึกเอกสารสำเร็จ แต่อัปเดตเลขที่ใบวางบิลใน Project Sales ไม่สำเร็จ: ${syncErr.message}`, id: doc.id };
    }
  } else if (docType === "receipt") {
    const { error: syncErr } = await supabase
      .from("payments")
      .update({ receipt_no: docNo, received_date: docDate })
      .in("id", itemPaymentIds);
    if (syncErr) {
      return { error: `บันทึกเอกสารสำเร็จ แต่อัปเดตเลขที่ใบเสร็จใน Project Sales ไม่สำเร็จ: ${syncErr.message}`, id: doc.id };
    }
  }
  // tax_invoice: no field to sync — eligibility already requires invoice_no
  // to already be set on the payment, so this document formalizes/prints it.

  await logActivity(`สร้าง${BILLING_DOCUMENT_LABELS[docType]}`, docNo);
  revalidateBillingDocumentConsumers(docType);
  return { error: null, id: doc.id as string };
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
