"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getGoodsReceiptById } from "@/lib/data/goods-receipts";

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

export async function updateGoodsReceipt(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const existing = await getGoodsReceiptById(id);
  if (!existing) return { error: "ไม่พบใบรับสินค้านี้ในระบบ" };

  const supplierId = str(formData.get("supplier_id"));
  const referenceNo = str(formData.get("reference_no"));
  const note = str(formData.get("note"));

  const itemIds = formData.getAll("item_product_id");
  const itemNames = formData.getAll("item_name");
  const itemSkus = formData.getAll("item_sku");
  const itemUnits = formData.getAll("item_unit");
  const itemQuantities = formData.getAll("item_quantity");
  const itemUnitCosts = formData.getAll("item_unit_cost");
  const newItems = itemIds
    .map((rawId, i) => ({
      stockProductId: String(rawId),
      name: String(itemNames[i] ?? ""),
      sku: String(itemSkus[i] ?? "").trim() || null,
      unit: String(itemUnits[i] ?? "ชิ้น"),
      quantity: num(itemQuantities[i]),
      unitCost: num(itemUnitCosts[i]),
    }))
    .filter((it) => it.stockProductId && it.quantity > 0);

  if (newItems.length === 0) {
    return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
  }

  const supabase = await createClient();

  const { error: updateErr } = await supabase
    .from("goods_receipts")
    .update({ supplier_id: supplierId, reference_no: referenceNo, note })
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  const { error: deleteItemsErr } = await supabase.from("goods_receipt_items").delete().eq("receipt_id", id);
  if (deleteItemsErr) {
    return { error: `แก้ไขข้อมูลทั่วไปสำเร็จ แต่แก้ไขรายการสินค้าไม่สำเร็จ: ${deleteItemsErr.message}` };
  }

  const { error: insertItemsErr } = await supabase.from("goods_receipt_items").insert(
    newItems.map((it) => ({
      receipt_id: id,
      stock_product_id: it.stockProductId,
      product_name_snapshot: it.name,
      product_sku_snapshot: it.sku,
      unit_snapshot: it.unit,
      quantity: it.quantity,
      unit_cost: it.unitCost,
    })),
  );
  if (insertItemsErr) return { error: `แก้ไขรายการสินค้าไม่สำเร็จ: ${insertItemsErr.message}` };

  const oldByProduct = new Map(
    existing.items.filter((it) => it.stockProductId).map((it) => [it.stockProductId as string, it]),
  );
  const newByProduct = new Map(newItems.filter((it) => it.stockProductId).map((it) => [it.stockProductId, it]));
  const productIds = new Set([...oldByProduct.keys(), ...newByProduct.keys()]);

  for (const productId of productIds) {
    const oldItem = oldByProduct.get(productId);
    const newItem = newByProduct.get(productId);
    const oldQty = oldItem?.quantity ?? 0;
    const oldCost = oldItem?.unitCost ?? 0;
    const newQty = newItem?.quantity ?? 0;
    const newCost = newItem?.unitCost ?? 0;
    if (oldQty === newQty && oldCost === newCost) continue;

    const { error: rpcErr } = await supabase.rpc("edit_goods_receipt_item", {
      p_product_id: productId,
      p_old_qty: oldQty,
      p_old_cost: oldCost,
      p_new_qty: newQty,
      p_new_cost: newCost,
      p_note: `แก้ไขใบรับสินค้า ${existing.docNo}`,
      p_reference: existing.docNo,
    });
    if (rpcErr) {
      return { error: `แก้ไขรายการสินค้าสำเร็จ แต่ปรับสต็อกไม่สำเร็จ: ${rpcErr.message}` };
    }
  }

  revalidateGoodsReceiptConsumers();
  revalidatePath(`/dashboard/goods-receipt/edit/${id}`);
  revalidatePath(`/dashboard/goods-receipt/view/${id}`);
  return { error: null };
}

export async function deleteGoodsReceipt(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const existing = await getGoodsReceiptById(id);
  if (!existing) return { error: "ไม่พบใบรับสินค้านี้ในระบบ" };

  const supabase = await createClient();

  // Block the delete if any line's lot has already been partially/fully
  // withdrawn — reversing would need to claw back stock that's already gone
  // out the door (via a requisition or manual movement), which is exactly
  // the negative-on-hand edge case this guard exists to prevent.
  const productIds = existing.items.map((it) => it.stockProductId).filter((pid): pid is string => !!pid);
  if (productIds.length > 0) {
    const { data: lots, error: lotsErr } = await supabase
      .from("stock_product_lots")
      .select("stock_product_id, quantity_received, quantity_remaining")
      .eq("reference_no", existing.docNo)
      .in("stock_product_id", productIds);
    if (lotsErr) return { error: lotsErr.message };

    const consumedItems = existing.items.filter((item) => {
      const lot = (lots ?? []).find((l) => l.stock_product_id === item.stockProductId);
      return lot && Number(lot.quantity_remaining) < Number(lot.quantity_received);
    });
    if (consumedItems.length > 0) {
      const names = consumedItems.map((it) => it.productName).join(", ");
      return {
        error: `ไม่สามารถลบได้ เนื่องจากมีสินค้าที่เบิกออกไปแล้วจากใบรับนี้: ${names} — กรุณาแก้ไขจำนวนในใบรับสินค้าแทนหากต้องการแก้ไข`,
      };
    }
  }

  // Reverse each line's stock/lot contribution before deleting the paperwork
  // — reuses edit_goods_receipt_item's exact reverse-then-reapply math by
  // editing every line down to zero, so delete no longer leaves stock or a
  // stock_product_lots row behind (matches what editing a receipt to zero
  // already does correctly).
  for (const item of existing.items) {
    if (!item.stockProductId || item.quantity <= 0) continue;
    const { error: reverseErr } = await supabase.rpc("edit_goods_receipt_item", {
      p_product_id: item.stockProductId,
      p_old_qty: item.quantity,
      p_old_cost: item.unitCost,
      p_new_qty: 0,
      p_new_cost: 0,
      p_note: `ลบใบรับสินค้า ${existing.docNo}`,
      p_reference: existing.docNo,
    });
    if (reverseErr) {
      return { error: `คืนสต็อกสินค้า "${item.productName}" ไม่สำเร็จ: ${reverseErr.message}` };
    }
  }

  const { error } = await supabase.from("goods_receipts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateGoodsReceiptConsumers();
  return { error: null };
}
