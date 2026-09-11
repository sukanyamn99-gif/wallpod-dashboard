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
  revalidatePath("/dashboard/purchase-orders");
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PO${yy}${mm}`;

  const { data, error } = await supabase.from("purchase_orders").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.doc_no.slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export async function createPurchaseOrder(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const requestId = str(formData.get("request_id"));
  if (!requestId) return { error: "กรุณาเลือกใบขอซื้อที่อนุมัติแล้ว" };

  const supplierId = str(formData.get("supplier_id"));
  const expectedDate = str(formData.get("expected_date"));
  const note = str(formData.get("note"));

  const itemIds = formData.getAll("item_product_id");
  const itemNames = formData.getAll("item_name");
  const itemSkus = formData.getAll("item_sku");
  const itemUnits = formData.getAll("item_unit");
  const itemQuantities = formData.getAll("item_quantity");
  const itemUnitPrices = formData.getAll("item_unit_price");
  const items = itemIds
    .map((id, i) => ({
      // Empty when this line came from a ใบขอซื้อ item with no catalog
      // entry yet — must not be dropped on that account.
      stockProductId: str(id),
      name: String(itemNames[i] ?? "").trim(),
      sku: String(itemSkus[i] ?? "").trim() || null,
      unit: String(itemUnits[i] ?? "ชิ้น"),
      quantity: num(itemQuantities[i]),
      unitPrice: num(itemUnitPrices[i]),
    }))
    .filter((it) => it.name && it.quantity > 0);

  if (items.length === 0) return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateDocNo(supabase);

  const { data: order, error: insertErr } = await supabase
    .from("purchase_orders")
    .insert({
      doc_no: docNo,
      request_id: requestId,
      supplier_id: supplierId,
      ordered_by: user?.id ?? null,
      expected_date: expectedDate,
      note,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemsErr } = await supabase.from("purchase_order_items").insert(
    items.map((it) => ({
      order_id: order.id,
      stock_product_id: it.stockProductId,
      product_name_snapshot: it.name,
      product_sku_snapshot: it.sku,
      unit_snapshot: it.unit,
      quantity: it.quantity,
      unit_price: it.unitPrice,
    })),
  );
  if (itemsErr) return { error: `บันทึกใบสั่งซื้อสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  revalidateConsumers();
  return { error: null, id: order.id as string };
}

export async function deletePurchaseOrder(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: order } = await supabase.from("purchase_orders").select("doc_no").eq("id", id).single();
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบใบสั่งซื้อ", order?.doc_no ?? null);
  revalidateConsumers();
  return { error: null };
}
