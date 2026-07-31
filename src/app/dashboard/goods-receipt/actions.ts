"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function revalidateGoodsReceiptConsumers() {
  revalidatePath("/dashboard/goods-receipt");
  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/alerts");
  revalidatePath("/dashboard/stock-movement");
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0"); // BE short year, matches JOB NO./doc-no convention
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `RI${yy}${mm}`;

  const { count, error } = await supabase
    .from("goods_receipts")
    .select("id", { count: "exact", head: true })
    .like("doc_no", `${prefix}%`);
  if (error) throw error;

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export async function createGoodsReceipt(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supplierId = str(formData.get("supplier_id"));
  const referenceNo = str(formData.get("reference_no"));
  const note = str(formData.get("note"));

  const itemIds = formData.getAll("item_product_id");
  const itemNames = formData.getAll("item_name");
  const itemSkus = formData.getAll("item_sku");
  const itemUnits = formData.getAll("item_unit");
  const itemQuantities = formData.getAll("item_quantity");
  const itemUnitCosts = formData.getAll("item_unit_cost");
  const items = itemIds
    .map((id, i) => ({
      stockProductId: String(id),
      name: String(itemNames[i] ?? ""),
      sku: String(itemSkus[i] ?? "").trim() || null,
      unit: String(itemUnits[i] ?? "ชิ้น"),
      quantity: num(itemQuantities[i]),
      unitCost: num(itemUnitCosts[i]),
    }))
    .filter((it) => it.stockProductId && it.quantity > 0);

  if (items.length === 0) {
    return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateDocNo(supabase);

  const { data: receipt, error: insertErr } = await supabase
    .from("goods_receipts")
    .insert({
      doc_no: docNo,
      supplier_id: supplierId,
      received_by: user?.id ?? null,
      reference_no: referenceNo,
      note,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemsErr } = await supabase.from("goods_receipt_items").insert(
    items.map((it) => ({
      receipt_id: receipt.id,
      stock_product_id: it.stockProductId,
      product_name_snapshot: it.name,
      product_sku_snapshot: it.sku,
      unit_snapshot: it.unit,
      quantity: it.quantity,
      unit_cost: it.unitCost,
    })),
  );
  if (itemsErr) return { error: `บันทึกใบรับสินค้าสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  for (const it of items) {
    const { error: receiptErr } = await supabase.rpc("record_goods_receipt", {
      p_product_id: it.stockProductId,
      p_qty: it.quantity,
      p_unit_cost: it.unitCost,
      p_note: `รับเข้าตามใบรับสินค้า ${docNo}`,
      p_reference: docNo,
    });
    if (receiptErr) {
      return { error: `บันทึกใบรับสินค้าสำเร็จ แต่รับเข้าสต็อกสินค้า "${it.name}" ไม่สำเร็จ: ${receiptErr.message}` };
    }
  }

  revalidateGoodsReceiptConsumers();
  return { error: null };
}

export async function deleteGoodsReceipt(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("goods_receipts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateGoodsReceiptConsumers();
  return { error: null };
}
