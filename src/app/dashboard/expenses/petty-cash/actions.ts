"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PettyCashTransactionType } from "@/lib/types";

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0"); // BE short year, matches JOB NO./doc-no convention
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PC${yy}${mm}`;

  const { count, error } = await supabase
    .from("petty_cash_transactions")
    .select("id", { count: "exact", head: true })
    .like("doc_no", `${prefix}%`);
  if (error) throw error;

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export async function createPettyCashTransaction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const transactionType = String(formData.get("transaction_type") ?? "");
  if (transactionType !== "topup" && transactionType !== "expense") {
    return { error: "กรุณาเลือกประเภทรายการ" };
  }
  const amount = num(formData.get("amount"));
  if (amount <= 0) return { error: "กรุณากรอกจำนวนเงินให้ถูกต้อง" };
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "กรุณากรอกรายละเอียด" };

  const supabase = await createClient();
  const docNo = await generateDocNo(supabase);

  const { error } = await supabase.rpc("record_petty_cash_transaction", {
    p_doc_no: docNo,
    p_type: transactionType satisfies PettyCashTransactionType,
    p_amount: amount,
    p_description: description,
    p_category: str(formData.get("category")),
    p_biller_name: str(formData.get("biller_name")),
    p_job_no: str(formData.get("job_no")),
    p_vat_amount: num(formData.get("vat_amount")),
    p_wht_amount: num(formData.get("wht_amount")),
    p_transaction_date: str(formData.get("transaction_date")) ?? new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/expenses/petty-cash");
  revalidatePath("/dashboard/expenses");
  return { error: null, docNo };
}

export async function updatePettyCashTransaction(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const transactionType = String(formData.get("transaction_type") ?? "");
  if (transactionType !== "topup" && transactionType !== "expense") {
    return { error: "กรุณาเลือกประเภทรายการ" };
  }
  const amount = num(formData.get("amount"));
  if (amount <= 0) return { error: "กรุณากรอกจำนวนเงินให้ถูกต้อง" };
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "กรุณากรอกรายละเอียด" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_petty_cash_transaction", {
    p_id: id,
    p_type: transactionType satisfies PettyCashTransactionType,
    p_amount: amount,
    p_description: description,
    p_category: str(formData.get("category")),
    p_biller_name: str(formData.get("biller_name")),
    p_job_no: str(formData.get("job_no")),
    p_vat_amount: num(formData.get("vat_amount")),
    p_wht_amount: num(formData.get("wht_amount")),
    p_transaction_date: str(formData.get("transaction_date")) ?? new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/expenses/petty-cash");
  revalidatePath("/dashboard/expenses");
  return { error: null };
}

export async function deletePettyCashTransaction(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_petty_cash_transaction", { p_id: id });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/expenses/petty-cash");
  revalidatePath("/dashboard/expenses");
  return { error: null };
}
