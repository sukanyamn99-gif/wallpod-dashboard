"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getAcceptedQuotationItemsByJobNo } from "@/lib/data/quotations";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Auto-running product code (KW0001, KW0002, ...) — never user-typed,
// unlike stock_products.sku. Based on the highest existing numeric suffix
// rather than a plain row count, so a deleted product never causes a
// collision with the next generated code.
async function generateFinishedGoodSku(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data, error } = await supabase.from("finished_goods").select("sku");
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const match = /^KW(\d+)$/.exec(row.sku ?? "");
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `KW${String(max + 1).padStart(4, "0")}`;
}

// Thin server-action wrapper so the create form (client component) can
// look up an accepted quotation's items the moment a JOB NO. is picked, to
// prefill product name/thickness/size/color/quantity — never unit_cost,
// since a quotation's unit price is what's charged to the customer, not
// this app's internal production cost.
export async function fetchAcceptedQuotationItemsForJob(jobNo: string) {
  return getAcceptedQuotationItemsByJobNo(jobNo);
}

// Creating a finished good IS the "รับเข้า" step — production output is
// typed in directly (quantity + cost), not derived from raw-material
// requisitions. The initial quantity/cost go through the same weighted-
// average RPC as every later receipt, so create and "receive more" stay
// on one consistent code path.
export async function createFinishedGood(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const name = str(formData.get("name"));
  if (!name) return { error: "กรุณากรอกชื่อสินค้า" };

  const jobNo = str(formData.get("job_no"));
  const thickness = str(formData.get("thickness"));
  const size = str(formData.get("size"));
  const color = str(formData.get("color"));
  const initialQty = Math.max(0, num(formData.get("initial_quantity")));
  const unitCost = Math.max(0, num(formData.get("unit_cost")));

  const supabase = await createClient();
  const sku = await generateFinishedGoodSku(supabase);
  const { data: product, error } = await supabase
    .from("finished_goods")
    .insert({ sku, job_no: jobNo, name, thickness, size, color })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (initialQty > 0) {
    const { error: movementErr } = await supabase.rpc("record_finished_goods_movement", {
      p_id: product.id,
      p_type: "in",
      p_qty: initialQty,
      p_note: "รับเข้าเริ่มต้น",
      p_unit_cost: unitCost,
    });
    if (movementErr) {
      return { error: `บันทึกสินค้าสำเร็จ แต่บันทึกจำนวนเริ่มต้นไม่สำเร็จ: ${movementErr.message}` };
    }
  }

  await logActivity("เพิ่มสินค้าสำเร็จรูป", name);
  revalidatePath("/dashboard/finished-goods");
  return { error: null };
}

export async function updateFinishedGood(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const name = str(formData.get("name"));
  if (!name) return { error: "กรุณากรอกชื่อสินค้า" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("finished_goods")
    .update({
      job_no: str(formData.get("job_no")),
      name,
      thickness: str(formData.get("thickness")),
      size: str(formData.get("size")),
      color: str(formData.get("color")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/finished-goods");
  return { error: null };
}

// "รับเพิ่ม" — a later production batch of the same item, blended into the
// running weighted-average cost (same formula/RPC the initial receipt uses).
export async function receiveFinishedGood(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const qty = num(formData.get("quantity"));
  if (qty <= 0) return { error: "กรุณากรอกจำนวนมากกว่า 0" };
  const unitCost = Math.max(0, num(formData.get("unit_cost")));
  const note = str(formData.get("note")) ?? "รับเพิ่ม";

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_finished_goods_movement", {
    p_id: id,
    p_type: "in",
    p_qty: qty,
    p_note: note,
    p_unit_cost: unitCost,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/finished-goods");
  return { error: null };
}

export async function deleteFinishedGood(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: product } = await supabase.from("finished_goods").select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("finished_goods").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบสินค้าสำเร็จรูป", product?.name ?? null);
  revalidatePath("/dashboard/finished-goods");
  return { error: null };
}
