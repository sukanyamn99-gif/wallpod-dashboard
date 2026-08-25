"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import type { WhtFormType } from "@/lib/types";

const WHT_FORM_TYPES: WhtFormType[] = ["ภ.ง.ด.1", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.53"];

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
  revalidatePath("/dashboard/expenses");
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
  const whtFormType = str(formData.get("wht_form_type"));

  if (!payeeName) return { ok: false as const, error: "กรุณากรอกชื่อผู้รับเงิน" };
  if (amount <= 0) return { ok: false as const, error: "กรุณากรอกจำนวนเงินให้ถูกต้อง" };
  if (whtFormType && !WHT_FORM_TYPES.includes(whtFormType as WhtFormType)) {
    return { ok: false as const, error: "ประเภทแบบภาษีหัก ณ ที่จ่ายไม่ถูกต้อง" };
  }

  const itemAccountCodes = formData.getAll("line_account_code");
  const itemDescriptions = formData.getAll("line_description");
  const itemDebits = formData.getAll("line_debit");
  const itemCredits = formData.getAll("line_credit");
  const ledgerLines = itemAccountCodes
    .map((code, i) => ({
      accountCode: str(code),
      description: str(itemDescriptions[i] ?? null),
      debit: num(itemDebits[i]),
      credit: num(itemCredits[i]),
    }))
    .filter((line) => line.accountCode || line.description || line.debit || line.credit);

  return {
    ok: true as const,
    voucherDate,
    payeeName,
    amount,
    category: str(formData.get("category")),
    paymentMethod: str(formData.get("payment_method")),
    referenceNo: str(formData.get("reference_no")),
    note: str(formData.get("note")),
    whtCertNo: str(formData.get("wht_cert_no")),
    description: str(formData.get("description")),
    whtRate: formData.get("wht_rate") ? num(formData.get("wht_rate")) : null,
    whtFormType: whtFormType as WhtFormType | null,
    whtAmount: num(formData.get("wht_amount")),
    bankName: str(formData.get("bank_name")),
    bankAccountNo: str(formData.get("bank_account_no")),
    bankTransferDate: str(formData.get("bank_transfer_date")),
    ledgerLines,
  };
}

async function replaceLedgerLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  voucherId: string,
  lines: { accountCode: string | null; description: string | null; debit: number; credit: number }[],
) {
  const { error: deleteErr } = await supabase.from("payment_voucher_ledger_lines").delete().eq("voucher_id", voucherId);
  if (deleteErr) return deleteErr.message;

  if (lines.length > 0) {
    const { error: insertErr } = await supabase.from("payment_voucher_ledger_lines").insert(
      lines.map((line, i) => ({
        voucher_id: voucherId,
        account_code: line.accountCode,
        description: line.description,
        debit: line.debit,
        credit: line.credit,
        sort_order: i,
      })),
    );
    if (insertErr) return insertErr.message;
  }
  return null;
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

  const { data: created, error } = await supabase
    .from("payment_vouchers")
    .insert({
      doc_no: docNo,
      voucher_date: parsed.voucherDate,
      payee_name: parsed.payeeName,
      category: parsed.category,
      amount: parsed.amount,
      payment_method: parsed.paymentMethod,
      reference_no: parsed.referenceNo,
      note: parsed.note,
      recorded_by: user?.id ?? null,
      wht_cert_no: parsed.whtCertNo,
      description: parsed.description,
      wht_rate: parsed.whtRate,
      wht_form_type: parsed.whtFormType,
      wht_amount: parsed.whtAmount,
      bank_name: parsed.bankName,
      bank_account_no: parsed.bankAccountNo,
      bank_transfer_date: parsed.bankTransferDate,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const ledgerError = await replaceLedgerLines(supabase, created.id, parsed.ledgerLines);
  if (ledgerError) return { error: `บันทึกใบสำคัญจ่ายสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${ledgerError}` };

  revalidateConsumers();
  return { error: null, docNo, id: created.id };
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
      wht_cert_no: parsed.whtCertNo,
      description: parsed.description,
      wht_rate: parsed.whtRate,
      wht_form_type: parsed.whtFormType,
      wht_amount: parsed.whtAmount,
      bank_name: parsed.bankName,
      bank_account_no: parsed.bankAccountNo,
      bank_transfer_date: parsed.bankTransferDate,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const ledgerError = await replaceLedgerLines(supabase, id, parsed.ledgerLines);
  if (ledgerError) return { error: `บันทึกใบสำคัญจ่ายสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${ledgerError}` };

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
