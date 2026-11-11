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

// RV + yyyymm (the voucher's own year and month, Gregorian — same year style as the
// other billing documents, e.g. INV202610120003) + a 4-digit running number that
// restarts each month, e.g. RV2026110001.
async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>, docDate: string): Promise<string> {
  const prefix = `RV${docDate.slice(0, 7).replace("-", "")}`;

  // Highest existing sequence, not a row count — a deleted voucher leaves a
  // gap and count+1 would then collide with a surviving higher number. Only a
  // plain 4-digit tail counts: vouchers numbered in the earlier yyyymmdd style
  // (RV202611100001) share this prefix but must not feed the sequence.
  const { data, error } = await supabase.from("receipt_vouchers").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const tail = row.doc_no.slice(prefix.length);
    if (/^\d{4}$/.test(tail)) max = Math.max(max, parseInt(tail, 10));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function parseForm(formData: FormData) {
  const contactName = str(formData.get("contact_name"));
  if (!contactName) return { ok: false as const, error: "กรุณากรอกชื่อผู้ติดต่อ (ลูกค้า)" };

  const descriptions = formData.getAll("item_description");
  const amounts = formData.getAll("item_amount");
  const items = descriptions
    .map((d, i) => ({ description: String(d ?? "").trim(), amount: round2(num(amounts[i] ?? null)) }))
    .filter((it) => it.description || it.amount);
  if (items.length === 0) return { ok: false as const, error: "กรุณากรอกรายการอย่างน้อย 1 รายการ" };
  if (items.some((it) => it.amount < 0)) return { ok: false as const, error: "จำนวนเงินต้องไม่ติดลบ" };

  const codes = formData.getAll("line_account_code");
  const lineDescriptions = formData.getAll("line_description");
  const debits = formData.getAll("line_debit");
  const credits = formData.getAll("line_credit");
  const ledgerLines = codes
    .map((code, i) => ({
      accountCode: str(code),
      description: str(lineDescriptions[i] ?? null),
      debit: round2(num(debits[i] ?? null)),
      credit: round2(num(credits[i] ?? null)),
    }))
    .filter((l) => l.accountCode || l.description || l.debit || l.credit);

  return {
    ok: true as const,
    docDate: str(formData.get("doc_date")) ?? new Date().toISOString().slice(0, 10),
    receiptId: str(formData.get("receipt_id")),
    receiptNo: str(formData.get("receipt_no")),
    contactName,
    contactTaxId: str(formData.get("contact_tax_id")),
    contactAddress: str(formData.get("contact_address")),
    note: str(formData.get("note")),
    bankName: str(formData.get("bank_name")),
    bankAccountNo: str(formData.get("bank_account_no")),
    payDate: str(formData.get("pay_date")),
    items,
    ledgerLines,
  };
}

async function replaceLedgerLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  voucherId: string,
  lines: { accountCode: string | null; description: string | null; debit: number; credit: number }[],
) {
  const { error: deleteErr } = await supabase.from("receipt_voucher_ledger_lines").delete().eq("voucher_id", voucherId);
  if (deleteErr) return deleteErr.message;
  if (lines.length === 0) return null;

  const { error: insertErr } = await supabase.from("receipt_voucher_ledger_lines").insert(
    lines.map((l, i) => ({
      voucher_id: voucherId,
      account_code: l.accountCode,
      description: l.description,
      debit: l.debit,
      credit: l.credit,
      sort_order: i,
    })),
  );
  return insertErr ? insertErr.message : null;
}

async function replaceItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  voucherId: string,
  items: { description: string; amount: number }[],
) {
  const { error: deleteErr } = await supabase.from("receipt_voucher_items").delete().eq("voucher_id", voucherId);
  if (deleteErr) return deleteErr.message;

  const { error: insertErr } = await supabase.from("receipt_voucher_items").insert(
    items.map((it, i) => ({ voucher_id: voucherId, description: it.description, amount: it.amount, sort_order: i })),
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
      note: parsed.note,
      bank_name: parsed.bankName,
      bank_account_no: parsed.bankAccountNo,
      pay_date: parsed.payDate,
      recorded_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const itemsError = await replaceItems(supabase, created.id, parsed.items);
  if (itemsError) return { error: `บันทึกใบสำคัญรับเงินสำเร็จ แต่บันทึกรายการไม่สำเร็จ: ${itemsError}` };
  const ledgerError = await replaceLedgerLines(supabase, created.id, parsed.ledgerLines);
  if (ledgerError) return { error: `บันทึกใบสำคัญรับเงินสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${ledgerError}` };

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
      receipt_no: parsed.receiptNo,
      contact_name: parsed.contactName,
      contact_tax_id: parsed.contactTaxId,
      contact_address: parsed.contactAddress,
      note: parsed.note,
      bank_name: parsed.bankName,
      bank_account_no: parsed.bankAccountNo,
      pay_date: parsed.payDate,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const itemsError = await replaceItems(supabase, id, parsed.items);
  if (itemsError) return { error: `บันทึกใบสำคัญรับเงินสำเร็จ แต่บันทึกรายการไม่สำเร็จ: ${itemsError}` };
  const ledgerError = await replaceLedgerLines(supabase, id, parsed.ledgerLines);
  if (ledgerError) return { error: `บันทึกใบสำคัญรับเงินสำเร็จ แต่บันทึกรายการบัญชีไม่สำเร็จ: ${ledgerError}` };

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
