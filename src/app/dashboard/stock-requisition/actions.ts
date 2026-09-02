"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getStockRequisitionById } from "@/lib/data/stock-requisitions";
import type { RequisitionPurpose } from "@/lib/types";

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function revalidateRequisitionConsumers() {
  revalidatePath("/dashboard/stock-requisition");
  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movement");
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0"); // BE short year, matches JOB NO. convention
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}${mm}`;

  const { count, error } = await supabase
    .from("stock_requisitions")
    .select("id", { count: "exact", head: true })
    .like("doc_no", `${prefix}%`);
  if (error) throw error;

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

interface ParsedRequisitionItem {
  stockProductId: string;
  name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  unitCost: number;
}

type ParsedRequisitionForm =
  | { error: string }
  | {
      error: null;
      departmentId: string;
      purpose: RequisitionPurpose;
      jobNo: string | null;
      projectName: string | null;
      customerName: string | null;
      note: string | null;
      items: ParsedRequisitionItem[];
    };

// Shared by create and update — both need the exact same fields validated
// and the item rows parsed identically.
function parseRequisitionForm(formData: FormData): ParsedRequisitionForm {
  const departmentId = str(formData.get("department_id"));
  if (!departmentId) return { error: "กรุณาเลือกแผนก" };

  const purposeRaw = str(formData.get("purpose"));
  if (purposeRaw !== "production" && purposeRaw !== "sample") {
    return { error: "กรุณาเลือกวัตถุประสงค์" };
  }
  const purpose = purposeRaw as RequisitionPurpose;

  const jobNo = str(formData.get("job_no"));
  const projectName = str(formData.get("project_name"));
  const customerName = str(formData.get("customer_name"));
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

  return { error: null, departmentId, purpose, jobNo, projectName, customerName, note, items };
}

// Only links to an existing customer by name — this form has no customer_type
// field to create a brand-new customer record with, so an unmatched name is
// simply left unlinked rather than silently creating a partial customer.
async function resolveCustomerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerName: string | null,
): Promise<string | null> {
  if (!customerName) return null;
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .ilike("name", customerName)
    .limit(1)
    .maybeSingle();
  return existingCustomer?.id ?? null;
}

export async function createStockRequisition(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseRequisitionForm(formData);
  if (parsed.error !== null) return { error: parsed.error };
  const { departmentId, purpose, jobNo, projectName, customerName, note, items } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const customerId = await resolveCustomerId(supabase, customerName);
  const docNo = await generateDocNo(supabase);

  const { data: requisition, error: insertErr } = await supabase
    .from("stock_requisitions")
    .insert({
      doc_no: docNo,
      department_id: departmentId,
      requested_by: user?.id ?? null,
      job_no: jobNo,
      project_name: projectName,
      purpose,
      customer_id: customerId,
      note,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemsErr } = await supabase.from("stock_requisition_items").insert(
    items.map((it) => ({
      requisition_id: requisition.id,
      stock_product_id: it.stockProductId,
      product_name_snapshot: it.name,
      product_sku_snapshot: it.sku,
      unit_snapshot: it.unit,
      quantity: it.quantity,
      unit_cost: it.unitCost,
    })),
  );
  if (itemsErr) return { error: `บันทึกใบเบิกสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  for (const it of items) {
    const { error: movementErr } = await supabase.rpc("record_stock_movement", {
      p_product_id: it.stockProductId,
      p_type: "out",
      p_qty: it.quantity,
      p_note: `เบิกตามใบเบิก ${docNo}`,
      p_reference: docNo,
    });
    if (movementErr) {
      return { error: `บันทึกใบเบิกสำเร็จ แต่ตัดสต็อกสินค้า "${it.name}" ไม่สำเร็จ: ${movementErr.message}` };
    }
  }

  revalidateRequisitionConsumers();
  return { error: null };
}

export async function updateStockRequisition(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  // Fresh read, not client-supplied — this is the true "before" state used
  // to compute stock deltas below, matching this app's established
  // audit/edit convention (e.g. Goods Receipt's updateGoodsReceipt).
  const existing = await getStockRequisitionById(id);
  if (!existing) return { error: "ไม่พบใบเบิกนี้ในระบบ" };

  const parsed = parseRequisitionForm(formData);
  if (parsed.error !== null) return { error: parsed.error };
  const { departmentId, purpose, jobNo, projectName, customerName, note, items } = parsed;

  const supabase = await createClient();
  const customerId = await resolveCustomerId(supabase, customerName);

  const { error: updateErr } = await supabase
    .from("stock_requisitions")
    .update({
      department_id: departmentId,
      job_no: jobNo,
      project_name: projectName,
      purpose,
      customer_id: customerId,
      note,
    })
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  const { error: deleteItemsErr } = await supabase.from("stock_requisition_items").delete().eq("requisition_id", id);
  if (deleteItemsErr) {
    return { error: `แก้ไขข้อมูลทั่วไปสำเร็จ แต่แก้ไขรายการสินค้าไม่สำเร็จ: ${deleteItemsErr.message}` };
  }

  const { error: insertItemsErr } = await supabase.from("stock_requisition_items").insert(
    items.map((it) => ({
      requisition_id: id,
      stock_product_id: it.stockProductId,
      product_name_snapshot: it.name,
      product_sku_snapshot: it.sku,
      unit_snapshot: it.unit,
      quantity: it.quantity,
      unit_cost: it.unitCost,
    })),
  );
  if (insertItemsErr) return { error: `แก้ไขรายการสินค้าไม่สำเร็จ: ${insertItemsErr.message}` };

  // Adjust stock by the per-product quantity delta only — unlike Goods
  // Receipt, a requisition line's unit_cost is just a reporting snapshot
  // and never feeds stock_products.unit_cost, so no cost-aware RPC is
  // needed here. An increase withdraws the extra amount ('out'); a
  // decrease/removal gives the difference back ('in') — the latter can't
  // restore the specific lot it originally came from (this app's lot
  // system only tracks lots created by Goods Receipts), which is the same
  // documented "unspecified lot" gap already accepted for every other
  // plain 'in' movement in this app (Stock Product's quick entry, Low
  // Stock Alert's Record IN, etc.).
  const oldByProduct = new Map(
    existing.items.filter((it) => it.stockProductId).map((it) => [it.stockProductId as string, it.quantity]),
  );
  const newByProduct = new Map(items.map((it) => [it.stockProductId, it.quantity]));
  const productIds = new Set([...oldByProduct.keys(), ...newByProduct.keys()]);

  for (const productId of productIds) {
    const oldQty = oldByProduct.get(productId) ?? 0;
    const newQty = newByProduct.get(productId) ?? 0;
    const delta = newQty - oldQty;
    if (delta === 0) continue;

    const { error: movementErr } = await supabase.rpc("record_stock_movement", {
      p_product_id: productId,
      p_type: delta > 0 ? "out" : "in",
      p_qty: Math.abs(delta),
      p_note: `แก้ไขใบเบิก ${existing.docNo}`,
      p_reference: existing.docNo,
    });
    if (movementErr) {
      return { error: `แก้ไขรายการสินค้าสำเร็จ แต่ปรับสต็อกไม่สำเร็จ: ${movementErr.message}` };
    }
  }

  await logActivity("แก้ไขใบเบิกสินค้า", existing.docNo);
  revalidateRequisitionConsumers();
  revalidatePath(`/dashboard/stock-requisition/edit/${id}`);
  revalidatePath(`/dashboard/stock-requisition/view/${id}`);
  return { error: null };
}

export async function deleteStockRequisition(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: requisition } = await supabase.from("stock_requisitions").select("doc_no").eq("id", id).single();
  const { error } = await supabase.from("stock_requisitions").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบใบเบิกสินค้า", requisition?.doc_no ?? null);
  revalidateRequisitionConsumers();
  return { error: null };
}
