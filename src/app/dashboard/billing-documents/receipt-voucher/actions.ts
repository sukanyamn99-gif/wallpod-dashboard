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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function revalidateConsumers() {
  revalidatePath("/dashboard/billing-documents/receipt-voucher");
}

// RV + yyyymmdd (the voucher's own date, Gregorian — same shape as the other
// billing documents, e.g. INV202610120003) + a 4-digit running number per day.
async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>, docDate: string): Promise<string> {
  const prefix = `RV${docDate.replaceAll("-", "")}`;

  // Highest existing sequence, not a row count — a deleted voucher leaves a
  // gap and count+1 would then collide with a surviving higher number.
  const { data, error } = await supabase.from("receipt_vouchers").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.doc_no.slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function parseForm(formData: FormData) {
  const contactName = str(formData.get("contact_name"));
  if (!contactName) return { ok: false as const, error: "กรุณากรอกชื่อผู้ติดต่อ (ลูกค้า)" };

  const codes = formData.getAll("line_account_code");
  const names = formData.getAll("line_account_name");
  const debits = formData.getAll("line_debit");
  const credits = formData.getAll("line_credit");
  const lines = codes
    .map((code, i) => ({
      accountCode: str(code),
      accountName: str(names[i] ?? null),
      debit: round2(num(debits[i] ?? null)),
      credit: round2(num(credits[i] ?? null)),
    }))
    .filter((l) => l.accountCode || l.accountName || l.debit || l.credit);
  if (lines.length === 0) return { ok: false as const, error: "กรุณากรอกรายการบัญชีอย่างน้อย 1 รายการ" };
  if (lines.some((l) => l.debit < 0 || l.credit < 0)) return { ok: false as const, error: "จำนวนเงินต้องไม่ติดลบ" };

  const totalDebit = round2(lines.reduce((sum, l) => sum + l.debit, 0));
  const totalCredit = round2(lines.reduce((sum, l) => sum + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
    return {
      ok: false as const,
      error: `ยอดเดบิต (${fmt(totalDebit)}) ต้องเท่ากับยอดเครดิต (${fmt(totalCredit)})`,
    };
  }

  return {
    ok: true as const,
    docDate: str(formData.get("doc_date")) ?? new Date().toISOString().slice(0, 10),
    receiptId: str(formData.get("receipt_id")),
    receiptNo: str(formData.get("receipt_no")),
    contactName,
    contactTaxId: str(formData.get("contact_tax_id")),
    contactAddress: str(formData.get("contact_address")),
    description: str(formData.get("description")),
    note: str(formData.get("note")),
    lines,
  };
}

async function replaceLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  voucherId: string,
  lines: { accountCode: string | null; accountName: string | null; debit: number; credit: number }[],
) {
  const { error: deleteErr } = await supabase.from("receipt_voucher_lines").delete().eq("voucher_id", voucherId);
  if (deleteErr) return deleteErr.message;

  const { error: insertErr } = await supabase.from("receipt_voucher_lines").insert(
    lines.map((l, i) => ({
      voucher_id: voucherId,
      account_code: l.accountCode,
      account_name: l.accountName,
      debit: l.debit,
      credit: l.credit,
      sort_order: i,
    })),
  );
  return insertErr ? insertErr.message : null;
}

export async function createReceiptVoucher(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateDocNo(supabase, parsed.docDate);
  const { data: created, error } = await supabase
    .from("receipt_vouchers")
    .insert({
      doc_no: docNo,
      doc_date: parsed.docDate,
      receipt_id: parsed.receiptId,
      receipt_no: parsed.receiptNo,
      contact_name: parsed.contactName,
      contact_tax_id: parsed.contactTaxId,
      contact_address: parsed.contactAddress,
      description: parsed.description,
      note: parsed.note,
      recorded_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const linesError = await replaceLines(supabase, created.id, parsed.lines);
  if (linesError) return { error: `บันทึกใบสำคัญรับเงินสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${linesError}` };

  revalidateConsumers();
  return { error: null, docNo, id: created.id };
}

export async function updateReceiptVoucher(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("receipt_vouchers")
    .update({
      doc_date: parsed.docDate,
      contact_name: parsed.contactName,
      contact_tax_id: parsed.contactTaxId,
      contact_address: parsed.contactAddress,
      description: parsed.description,
      note: parsed.note,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const linesError = await replaceLines(supabase, id, parsed.lines);
  if (linesError) return { error: `บันทึกใบสำคัญรับเงินสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${linesError}` };

  revalidateConsumers();
  return { error: null };
}

export async function deleteReceiptVoucher(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: voucher } = await supabase.from("receipt_vouchers").select("doc_no").eq("id", id).single();
  const { error } = await supabase.from("receipt_vouchers").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบใบสำคัญรับเงิน", voucher?.doc_no ?? null);
  revalidateConsumers();
  return { error: null };
}
