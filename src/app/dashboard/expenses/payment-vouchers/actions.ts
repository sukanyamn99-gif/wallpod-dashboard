"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { generateWhtCertNo } from "@/lib/wht-cert-no";
import type { WhtFormType, WhtIncomeType } from "@/lib/types";

const WHT_FORM_TYPES: WhtFormType[] = ["ภ.ง.ด.1", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.53"];
const WHT_INCOME_TYPES: WhtIncomeType[] = ["1", "2", "3", "4a", "4b", "5", "6"];

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
  revalidatePath("/dashboard/project-sales");
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0"); // BE short year, matches JOB NO./doc-no convention
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PV${yy}${mm}`;

  // Based on the highest existing sequence number, not a plain row count —
  // a deleted voucher leaves a gap, and count+1 would then collide with a
  // still-surviving higher-numbered row (hit in production for billing
  // documents' doc-no generator, which used the same flawed pattern).
  const { data, error } = await supabase.from("payment_vouchers").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.doc_no.slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

function parseVoucherForm(formData: FormData) {
  const voucherDate = str(formData.get("voucher_date")) ?? new Date().toISOString().slice(0, 10);
  const payeeName = str(formData.get("payee_name"));
  const amount = num(formData.get("amount"));
  const whtFormType = str(formData.get("wht_form_type"));
  const incomeType = str(formData.get("income_type")) ?? "5";

  if (!payeeName) return { ok: false as const, error: "กรุณากรอกชื่อผู้รับเงิน" };
  if (amount <= 0) return { ok: false as const, error: "กรุณากรอกจำนวนเงินให้ถูกต้อง" };
  if (whtFormType && !WHT_FORM_TYPES.includes(whtFormType as WhtFormType)) {
    return { ok: false as const, error: "ประเภทแบบภาษีหัก ณ ที่จ่ายไม่ถูกต้อง" };
  }
  if (!WHT_INCOME_TYPES.includes(incomeType as WhtIncomeType)) {
    return { ok: false as const, error: "ประเภทเงินได้ไม่ถูกต้อง" };
  }

  // Cost attribution: one or more (JOB, amount) rows. A single row with no
  // amount means "the whole voucher" (the common case, same as the old single
  // JOB field); with several rows every amount is required and together they
  // must equal the voucher amount, so job cost totals stay exact.
  const allocJobNos = formData.getAll("alloc_job_no").map((v) => String(v).trim());
  const allocAmounts = formData.getAll("alloc_amount").map((v) => num(v));
  const rawAllocations = allocJobNos
    .map((jobNo, i) => ({ jobNo, amount: allocAmounts[i] ?? 0 }))
    .filter((row) => row.jobNo || row.amount > 0);
  if (rawAllocations.some((row) => !row.jobNo)) {
    return { ok: false as const, error: "กรุณาเลือกเลขที่ Job ให้ครบทุกแถวที่แบ่งต้นทุน" };
  }
  if (rawAllocations.length === 1 && rawAllocations[0].amount <= 0) rawAllocations[0].amount = amount;
  if (rawAllocations.some((row) => row.amount <= 0)) {
    return { ok: false as const, error: "กรุณากรอกยอดที่แบ่งให้แต่ละ Job" };
  }
  // The same JOB listed twice is just one allocation.
  const merged = new Map<string, number>();
  for (const row of rawAllocations) merged.set(row.jobNo, Math.round(((merged.get(row.jobNo) ?? 0) + row.amount) * 100) / 100);
  const jobAllocations = [...merged].map(([jobNo, allocAmount]) => ({ jobNo, amount: allocAmount }));
  const allocatedTotal = jobAllocations.reduce((sum, a) => sum + a.amount, 0);
  if (jobAllocations.length > 0 && Math.abs(allocatedTotal - amount) > 0.005) {
    return {
      ok: false as const,
      error: `ยอดที่แบ่งให้แต่ละ Job รวม ${allocatedTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท ต้องเท่ากับจำนวนเงิน ${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`,
    };
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
    socialSecurityAmount: num(formData.get("social_security_amount")),
    bankName: str(formData.get("bank_name")),
    bankAccountNo: str(formData.get("bank_account_no")),
    bankTransferDate: str(formData.get("bank_transfer_date")),
    // First allocated JOB doubles as the voucher's primary job for display.
    jobNo: jobAllocations[0]?.jobNo ?? null,
    jobAllocations,
    payeeTaxId: str(formData.get("payee_tax_id")),
    payeeAddress: str(formData.get("payee_address")),
    incomeType: incomeType as WhtIncomeType,
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

async function replaceJobAllocations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  voucherId: string,
  allocations: { jobNo: string; amount: number }[],
) {
  const { error: deleteErr } = await supabase.from("payment_voucher_job_allocations").delete().eq("voucher_id", voucherId);
  if (deleteErr) return deleteErr.message;

  if (allocations.length > 0) {
    const { error: insertErr } = await supabase.from("payment_voucher_job_allocations").insert(
      allocations.map((a, i) => ({ voucher_id: voucherId, job_no: a.jobNo, amount: a.amount, sort_order: i })),
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
  // See the same guard in updatePaymentVoucher — a ฿0 WHT amount never
  // keeps a cert no, even if one was typed/copied into the form.
  const whtCertNo =
    parsed.whtAmount > 0 ? parsed.whtCertNo || (await generateWhtCertNo(supabase)) : null;

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
      wht_cert_no: whtCertNo,
      description: parsed.description,
      wht_rate: parsed.whtRate,
      wht_form_type: parsed.whtFormType,
      wht_amount: parsed.whtAmount,
      social_security_amount: parsed.socialSecurityAmount,
      bank_name: parsed.bankName,
      bank_account_no: parsed.bankAccountNo,
      bank_transfer_date: parsed.bankTransferDate,
      job_no: parsed.jobNo,
      payee_tax_id: parsed.payeeTaxId,
      payee_address: parsed.payeeAddress,
      income_type: parsed.incomeType,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const ledgerError = await replaceLedgerLines(supabase, created.id, parsed.ledgerLines);
  if (ledgerError) return { error: `บันทึกใบสำคัญจ่ายสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${ledgerError}` };

  const allocError = await replaceJobAllocations(supabase, created.id, parsed.jobAllocations);
  if (allocError) return { error: `บันทึกใบสำคัญจ่ายสำเร็จ แต่บันทึกการแบ่งต้นทุนตาม Job ไม่สำเร็จ: ${allocError}` };

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
  // A ฿0 WHT amount means there's nothing to certify — clear any cert no
  // (auto-generated earlier, or still sitting in the form) rather than
  // carrying it over, which would leave a stale number showing on the
  // voucher for a deduction that no longer exists (e.g. after moving the
  // deduction to ประกันสังคม instead).
  const whtCertNo =
    parsed.whtAmount > 0 ? parsed.whtCertNo || (await generateWhtCertNo(supabase)) : null;
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
      wht_cert_no: whtCertNo,
      description: parsed.description,
      wht_rate: parsed.whtRate,
      wht_form_type: parsed.whtFormType,
      wht_amount: parsed.whtAmount,
      social_security_amount: parsed.socialSecurityAmount,
      bank_name: parsed.bankName,
      bank_account_no: parsed.bankAccountNo,
      bank_transfer_date: parsed.bankTransferDate,
      job_no: parsed.jobNo,
      payee_tax_id: parsed.payeeTaxId,
      payee_address: parsed.payeeAddress,
      income_type: parsed.incomeType,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const ledgerError = await replaceLedgerLines(supabase, id, parsed.ledgerLines);
  if (ledgerError) return { error: `บันทึกใบสำคัญจ่ายสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${ledgerError}` };

  const allocError = await replaceJobAllocations(supabase, id, parsed.jobAllocations);
  if (allocError) return { error: `บันทึกใบสำคัญจ่ายสำเร็จ แต่บันทึกการแบ่งต้นทุนตาม Job ไม่สำเร็จ: ${allocError}` };

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
