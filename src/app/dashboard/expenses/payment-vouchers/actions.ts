"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function revalidateConsumers() {
  revalidatePath("/dashboard/expenses/payment-vouchers");
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0"); // BE short year, matches JOB NO./doc-no convention
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PV${yy}${mm}`;

  const { count, error } = await supabase
    .from("payment_vouchers")
    .select("id", { count: "exact", head: true })
    .like("doc_no", `${prefix}%`);
  if (error) throw error;

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

function parseVoucherForm(formData: FormData) {
  const voucherDate = str(formData.get("voucher_date")) ?? new Date().toISOString().slice(0, 10);
  const payeeName = str(formData.get("payee_name"));
  const amount = num(formData.get("amount"));

  if (!payeeName) return { ok: false as const, error: "กรุณากรอกชื่อผู้รับเงิน" };
  if (amount <= 0) return { ok: false as const, error: "กรุณากรอกจำนวนเงินให้ถูกต้อง" };

  return {
    ok: true as const,
    voucherDate,
    payeeName,
    amount,
    category: str(formData.get("category")),
    paymentMethod: str(formData.get("payment_method")),
    referenceNo: str(formData.get("reference_no")),
    note: str(formData.get("note")),
  };
}

export async function createPaymentVoucher(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseVoucherForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateDocNo(supabase);

  const { error } = await supabase.from("payment_vouchers").insert({
    doc_no: docNo,
    voucher_date: parsed.voucherDate,
    payee_name: parsed.payeeName,
    category: parsed.category,
    amount: parsed.amount,
    payment_method: parsed.paymentMethod,
    reference_no: parsed.referenceNo,
    note: parsed.note,
    recorded_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidateConsumers();
  return { error: null, docNo };
}

export async function updatePaymentVoucher(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseVoucherForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_vouchers")
    .update({
      voucher_date: parsed.voucherDate,
      payee_name: parsed.payeeName,
      category: parsed.category,
      amount: parsed.amount,
      payment_method: parsed.paymentMethod,
      reference_no: parsed.referenceNo,
      note: parsed.note,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateConsumers();
  return { error: null };
}

export async function deletePaymentVoucher(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: voucher } = await supabase.from("payment_vouchers").select("doc_no").eq("id", id).single();
  const { error } = await supabase.from("payment_vouchers").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบใบสำคัญจ่าย", voucher?.doc_no ?? null);
  revalidateConsumers();
  return { error: null };
}
