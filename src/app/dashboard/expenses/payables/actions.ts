"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

async function generateOpeningBalanceDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `OB${yy}${mm}`;

  // Based on the highest existing sequence number, not a plain row count —
  // a deleted row leaves a gap, and count+1 would then collide with a
  // still-surviving higher-numbered row (hit in production for billing
  // documents' doc-no generator, which used the same flawed pattern).
  const { data, error } = await supabase.from("goods_receipts").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.doc_no.slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

// A supplier debt carried forward from before this system existed — not
// tied to any real stock delivery recorded here, so this deliberately
// skips goods_receipt_items' usual stock_product_id/record_goods_receipt
// RPC path entirely (no inventory effect, just a payable to track).
export async function createOpeningBalancePayable(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supplierId = str(formData.get("supplier_id"));
  if (!supplierId) return { error: "กรุณาเลือกผู้จำหน่าย" };

  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "กรุณากรอกจำนวนเงินให้ถูกต้อง" };

  const debtDate = str(formData.get("debt_date"));
  const note = str(formData.get("note")) ?? "ยอดคงค้างยกมาจากระบบเดิม";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateOpeningBalanceDocNo(supabase);

  const { data: receipt, error: insertErr } = await supabase
    .from("goods_receipts")
    .insert({
      doc_no: docNo,
      supplier_id: supplierId,
      received_by: user?.id ?? null,
      reference_no: null,
      note,
      payment_status: "ยังไม่จ่าย",
      paid_date: null,
      ...(debtDate ? { created_at: new Date(debtDate).toISOString() } : {}),
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemErr } = await supabase.from("goods_receipt_items").insert({
    receipt_id: receipt.id,
    stock_product_id: null,
    product_name_snapshot: "ยอดคงค้างยกมา",
    product_sku_snapshot: null,
    unit_snapshot: "รายการ",
    quantity: 1,
    unit_cost: amount,
  });
  if (itemErr) return { error: `บันทึกยอดยกมาสำเร็จ แต่บันทึกรายละเอียดไม่สำเร็จ: ${itemErr.message}` };

  revalidatePath("/dashboard/expenses/payables");
  revalidatePath("/dashboard/goods-receipt");
  return { error: null };
}
