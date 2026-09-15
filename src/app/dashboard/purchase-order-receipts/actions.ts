"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getPurchaseOrderReceiptById } from "@/lib/data/purchase-order-receipts";

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

// Only adjusts quantity/unit cost of the lines that were already received —
// doesn't add or remove lines, since each one is tied to a specific PO
// item's own "received so far" tracking (purchase_order_items.receivedQuantity,
// summed live from these rows — see getItemsByOrderIds). Updates each row
// in place instead of delete-then-reinsert so order_item_id never needs
// touching. Reuses edit_goods_receipt_item — the same weighted-average
// reversal-then-reapply RPC already built for the ad-hoc รับเข้าสินค้า
// feature, since it's product-id/qty/cost based, not tied to which table
// the receipt document itself lives in.
export async function updatePurchaseOrderReceipt(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const existing = await getPurchaseOrderReceiptById(id);
  if (!existing) return { error: "ไม่พบใบรับสินค้านี้ในระบบ" };

  const note = str(formData.get("note"));
  const itemIds = formData.getAll("item_id").map((v) => String(v));
  const itemQuantities = formData.getAll("item_quantity");
  const itemUnitCosts = formData.getAll("item_unit_cost");
  const newValuesById = new Map(
    itemIds.map((itemId, i) => [itemId, { quantity: num(itemQuantities[i]), unitCost: num(itemUnitCosts[i]) }]),
  );

  const supabase = await createClient();

  const { error: headerErr } = await supabase.from("purchase_order_receipts").update({ note }).eq("id", id);
  if (headerErr) return { error: headerErr.message };

  for (const it of existing.items) {
    const newValues = newValuesById.get(it.id);
    if (!newValues || newValues.quantity <= 0) continue;
    const { quantity: newQty, unitCost: newCost } = newValues;
    if (newQty === it.quantity && newCost === it.unitCost) continue;

    // .select() so RLS silently filtering the row to zero matches surfaces
    // as an empty array here instead of a false "success" with a null
    // error — .update() alone returns no error for that case, which would
    // otherwise let the RPC below adjust stock while the item row itself
    // stayed unchanged.
    const { data: updatedRows, error: itemErr } = await supabase
      .from("purchase_order_receipt_items")
      .update({ quantity: newQty, unit_cost: newCost })
      .eq("id", it.id)
      .select("id");
    if (itemErr) return { error: `แก้ไขรายการ "${it.productName}" ไม่สำเร็จ: ${itemErr.message}` };
    if (!updatedRows || updatedRows.length === 0) {
      return { error: `แก้ไขรายการ "${it.productName}" ไม่สำเร็จ: ไม่มีสิทธิ์แก้ไขรายการนี้` };
    }

    if (it.stockProductId) {
      const { error: rpcErr } = await supabase.rpc("edit_goods_receipt_item", {
        p_product_id: it.stockProductId,
        p_old_qty: it.quantity,
        p_old_cost: it.unitCost,
        p_new_qty: newQty,
        p_new_cost: newCost,
        p_note: `แก้ไขใบรับสินค้า ${existing.docNo}`,
        p_reference: existing.docNo,
      });
      if (rpcErr) {
        return { error: `แก้ไขรายการ "${it.productName}" สำเร็จ แต่ปรับสต็อกไม่สำเร็จ: ${rpcErr.message}` };
      }
    }
  }

  revalidateConsumers();
  revalidatePath(`/dashboard/purchase-order-receipts/edit/${id}`);
  revalidatePath(`/dashboard/purchase-order-receipts/view/${id}`);
  return { error: null };
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
