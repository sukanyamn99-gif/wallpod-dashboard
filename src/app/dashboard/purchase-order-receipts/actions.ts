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
  revalidatePath("/dashboard/purchase-order-receipts");
  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/alerts");
  revalidatePath("/dashboard/stock-movement");
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `GR${yy}${mm}`;

  const { data, error } = await supabase.from("purchase_order_receipts").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.doc_no.slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export async function createPurchaseOrderReceipt(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const orderId = str(formData.get("order_id"));
  if (!orderId) return { error: "กรุณาเลือกใบสั่งซื้อ" };

  const note = str(formData.get("note"));

  const itemOrderItemIds = formData.getAll("item_order_item_id");
  const itemProductIds = formData.getAll("item_product_id");
  const itemNames = formData.getAll("item_name");
  const itemSkus = formData.getAll("item_sku");
  const itemUnits = formData.getAll("item_unit");
  const itemQuantities = formData.getAll("item_quantity");
  const itemUnitCosts = formData.getAll("item_unit_cost");
  const items = itemProductIds
    .map((id, i) => ({
      orderItemId: str(itemOrderItemIds[i] ?? null),
      stockProductId: String(id),
      name: String(itemNames[i] ?? ""),
      sku: String(itemSkus[i] ?? "").trim() || null,
      unit: String(itemUnits[i] ?? "ชิ้น"),
      quantity: num(itemQuantities[i]),
      unitCost: num(itemUnitCosts[i]),
    }))
    .filter((it) => it.stockProductId && it.quantity > 0);

  if (items.length === 0) return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateDocNo(supabase);

  const { data: receipt, error: insertErr } = await supabase
    .from("purchase_order_receipts")
    .insert({ doc_no: docNo, order_id: orderId, received_by: user?.id ?? null, note })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemsErr } = await supabase.from("purchase_order_receipt_items").insert(
    items.map((it) => ({
      receipt_id: receipt.id,
      order_item_id: it.orderItemId,
      stock_product_id: it.stockProductId,
      product_name_snapshot: it.name,
      product_sku_snapshot: it.sku,
      unit_snapshot: it.unit,
      quantity: it.quantity,
      unit_cost: it.unitCost,
    })),
  );
  if (itemsErr) return { error: `บันทึกใบรับสินค้าสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  // Reuses the existing record_goods_receipt RPC — same proven
  // weighted-average costing logic as the ad-hoc รับเข้าสินค้า feature,
  // rather than a second implementation of the same math.
  for (const it of items) {
    const { error: rpcErr } = await supabase.rpc("record_goods_receipt", {
      p_product_id: it.stockProductId,
      p_qty: it.quantity,
      p_unit_cost: it.unitCost,
      p_note: `รับเข้าตามใบสั่งซื้อ ${docNo}`,
      p_reference: docNo,
    });
    if (rpcErr) {
      return { error: `บันทึกใบรับสินค้าสำเร็จ แต่ตัดสต็อกสินค้า "${it.name}" ไม่สำเร็จ: ${rpcErr.message}` };
    }
  }

  revalidateConsumers();
  return { error: null, id: receipt.id as string };
}

export async function deletePurchaseOrderReceipt(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: receipt } = await supabase.from("purchase_order_receipts").select("doc_no").eq("id", id).single();
  const { error } = await supabase.from("purchase_order_receipts").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบใบรับสินค้า (ใบสั่งซื้อ)", receipt?.doc_no ?? null);
  revalidateConsumers();
  return { error: null };
}
