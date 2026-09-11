"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const LIST_PATH = "/dashboard/bank-accounts";

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function createBankAccount(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }
  const bankName = str(formData.get("bank_name"));
  const accountNo = str(formData.get("account_no"));
  if (!bankName) return { error: "กรุณากรอกชื่อธนาคาร" };
  if (!accountNo) return { error: "กรุณากรอกเลขที่บัญชี" };

  const supabase = await createClient();
  const { error } = await supabase.from("bank_accounts").insert({
    bank_name: bankName,
    account_no: accountNo,
    account_type: str(formData.get("account_type")) ?? "กระแสรายวัน",
    account_name: str(formData.get("account_name")) ?? "บริษัท คูนเว จำกัด",
    opening_balance: num(formData.get("opening_balance")),
    actual_balance: num(formData.get("actual_balance")),
    actual_balance_updated_at: new Date().toISOString(),
  });
  if (error?.code === "23505") return { error: "มีบัญชีธนาคารนี้อยู่ในระบบแล้ว (ธนาคาร + เลขที่บัญชีซ้ำ)" };
  if (error) return { error: error.message };

  revalidatePath(LIST_PATH);
  return { error: null };
}

export async function updateBankAccount(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }
  const bankName = str(formData.get("bank_name"));
  const accountNo = str(formData.get("account_no"));
  if (!bankName) return { error: "กรุณากรอกชื่อธนาคาร" };
  if (!accountNo) return { error: "กรุณากรอกเลขที่บัญชี" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_accounts")
    .update({
      bank_name: bankName,
      account_no: accountNo,
      account_type: str(formData.get("account_type")) ?? "กระแสรายวัน",
      account_name: str(formData.get("account_name")) ?? "บริษัท คูนเว จำกัด",
      opening_balance: num(formData.get("opening_balance")),
      actual_balance: num(formData.get("actual_balance")),
      actual_balance_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error?.code === "23505") return { error: "มีบัญชีธนาคารนี้อยู่ในระบบแล้ว (ธนาคาร + เลขที่บัญชีซ้ำ)" };
  if (error) return { error: error.message };

  revalidatePath(LIST_PATH);
  return { error: null };
}

export async function setBankAccountActive(id: string, active: boolean) {
  if (!isSupabaseConfigured()) return { error: "ยังไม่ได้ตั้งค่า Supabase" };
  const supabase = await createClient();
  const { error } = await supabase.from("bank_accounts").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(LIST_PATH);
  return { error: null };
}

export async function deleteBankAccount(id: string) {
  if (!isSupabaseConfigured()) return { error: "ยังไม่ได้ตั้งค่า Supabase" };
  const supabase = await createClient();
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(LIST_PATH);
  return { error: null };
}
