"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "มีอัตราส่วนลดนี้อยู่แล้วในตารางค่าคอมมิชชั่น";
  return error.message;
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function revalidateCommissionConsumers() {
  revalidatePath("/dashboard/expenses/commission");
}

export async function createRateTier(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const discountPercent = num(formData.get("discount_percent"));
  const commissionRatePercent = num(formData.get("commission_rate_percent"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_rate_tiers")
    .insert({ discount_percent: discountPercent, commission_rate_percent: commissionRatePercent });
  if (error) return { error: friendlyError(error) };

  revalidateCommissionConsumers();
  return { error: null };
}

export async function updateRateTier(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const discountPercent = num(formData.get("discount_percent"));
  const commissionRatePercent = num(formData.get("commission_rate_percent"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_rate_tiers")
    .update({ discount_percent: discountPercent, commission_rate_percent: commissionRatePercent })
    .eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidateCommissionConsumers();
  return { error: null };
}

export async function deleteRateTier(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("commission_rate_tiers").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateCommissionConsumers();
  return { error: null };
}

function parseCommissionEntryForm(formData: FormData) {
  const entryDate = str(formData.get("entry_date"));
  const projectTitle = str(formData.get("project_title"));
  const brokerName = str(formData.get("broker_name"));
  if (!entryDate) return { ok: false as const, error: "กรุณาระบุวันที่" };
  if (!projectTitle) return { ok: false as const, error: "กรุณาระบุชื่องาน/บริษัท" };
  if (!brokerName) return { ok: false as const, error: "กรุณาระบุพนักงานขาย/นายหน้า" };

  return {
    ok: true as const,
    entryDate,
    jobNo: str(formData.get("job_no")),
    projectTitle,
    projectName: str(formData.get("project_name")),
    brokerName,
    amount: num(formData.get("amount")),
    discountPercent: num(formData.get("discount_percent")),
    commissionRatePercent: num(formData.get("commission_rate_percent")),
    installmentLabel: str(formData.get("installment_label")),
    paidAmount: formData.get("paid_amount") ? num(formData.get("paid_amount")) : null,
    invoiceNo: str(formData.get("invoice_no")),
    receiptNo: str(formData.get("receipt_no")),
    receivedDate: str(formData.get("received_date")),
    note: str(formData.get("note")),
  };
}

export async function createCommissionEntry(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseCommissionEntryForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("commission_entries").insert({
    entry_date: parsed.entryDate,
    job_no: parsed.jobNo,
    project_title: parsed.projectTitle,
    project_name: parsed.projectName,
    broker_name: parsed.brokerName,
    amount: parsed.amount,
    discount_percent: parsed.discountPercent,
    commission_rate_percent: parsed.commissionRatePercent,
    installment_label: parsed.installmentLabel,
    paid_amount: parsed.paidAmount,
    invoice_no: parsed.invoiceNo,
    receipt_no: parsed.receiptNo,
    received_date: parsed.receivedDate,
    note: parsed.note,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidateCommissionConsumers();
  return { error: null };
}

export async function updateCommissionEntry(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseCommissionEntryForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_entries")
    .update({
      entry_date: parsed.entryDate,
      job_no: parsed.jobNo,
      project_title: parsed.projectTitle,
      project_name: parsed.projectName,
      broker_name: parsed.brokerName,
      amount: parsed.amount,
      discount_percent: parsed.discountPercent,
      commission_rate_percent: parsed.commissionRatePercent,
      installment_label: parsed.installmentLabel,
      paid_amount: parsed.paidAmount,
      invoice_no: parsed.invoiceNo,
      receipt_no: parsed.receiptNo,
      received_date: parsed.receivedDate,
      note: parsed.note,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateCommissionConsumers();
  return { error: null };
}

export async function deleteCommissionEntry(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("commission_entries")
    .select("project_title, broker_name")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("commission_entries").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบรายการค่าคอมมิชชั่น", entry ? `${entry.project_title} — ${entry.broker_name}` : null);
  revalidateCommissionConsumers();
  return { error: null };
}
