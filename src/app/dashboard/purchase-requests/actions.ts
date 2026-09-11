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
  revalidatePath("/dashboard/purchase-requests");
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PR${yy}${mm}`;

  const { data, error } = await supabase.from("purchase_requests").select("doc_no").like("doc_no", `${prefix}%`);
  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInt(row.doc_no.slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export async function createPurchaseRequest(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const departmentId = str(formData.get("department_id"));
  if (!departmentId) return { error: "กรุณาเลือกแผนก" };

  const purpose = str(formData.get("purpose"));
  const note = str(formData.get("note"));
  const jobNo = str(formData.get("job_no"));
  const projectName = str(formData.get("project_name"));
  const koonwayRefNo = str(formData.get("koonway_ref_no"));
  const flexiplanRefNo = str(formData.get("flexiplan_ref_no"));

  const itemIds = formData.getAll("item_product_id");
  const itemNames = formData.getAll("item_name");
  const itemSkus = formData.getAll("item_sku");
  const itemUnits = formData.getAll("item_unit");
  const itemQuantities = formData.getAll("item_quantity");
  const itemNotes = formData.getAll("item_note");
  const itemSupplierIds = formData.getAll("item_supplier_id");
  const itemUnitPrices = formData.getAll("item_unit_price");
  const items = itemIds
    .map((id, i) => ({
      stockProductId: String(id),
      name: String(itemNames[i] ?? ""),
      sku: String(itemSkus[i] ?? "").trim() || null,
      unit: String(itemUnits[i] ?? "ชิ้น"),
      quantity: num(itemQuantities[i]),
      note: str(itemNotes[i] ?? null),
      supplierId: str(itemSupplierIds[i] ?? null),
      unitPrice: num(itemUnitPrices[i]),
    }))
    .filter((it) => it.stockProductId && it.quantity > 0);

  if (items.length === 0) return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateDocNo(supabase);

  const { data: request, error: insertErr } = await supabase
    .from("purchase_requests")
    .insert({
      doc_no: docNo,
      department_id: departmentId,
      requested_by: user?.id ?? null,
      purpose,
      note,
      job_no: jobNo,
      project_name: projectName,
      koonway_ref_no: koonwayRefNo,
      flexiplan_ref_no: flexiplanRefNo,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemsErr } = await supabase.from("purchase_request_items").insert(
    items.map((it) => ({
      request_id: request.id,
      stock_product_id: it.stockProductId,
      product_name_snapshot: it.name,
      product_sku_snapshot: it.sku,
      unit_snapshot: it.unit,
      quantity: it.quantity,
      note: it.note,
      supplier_id: it.supplierId,
      unit_price: it.unitPrice,
    })),
  );
  if (itemsErr) return { error: `บันทึกใบขอซื้อสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  revalidateConsumers();
  return { error: null, id: request.id as string };
}

export async function deletePurchaseRequest(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: request } = await supabase.from("purchase_requests").select("doc_no").eq("id", id).single();
  const { error } = await supabase.from("purchase_requests").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบใบขอซื้อ", request?.doc_no ?? null);
  revalidateConsumers();
  return { error: null };
}

async function setPurchaseRequestStatus(id: string, status: "อนุมัติ" | "ไม่อนุมัติ") {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("purchase_requests")
    .update({ status, approved_by: user?.id ?? null, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidateConsumers();
  revalidatePath(`/dashboard/purchase-requests/view/${id}`);
  return { error: null };
}

export async function approvePurchaseRequest(id: string) {
  return setPurchaseRequestStatus(id, "อนุมัติ");
}

export async function rejectPurchaseRequest(id: string) {
  return setPurchaseRequestStatus(id, "ไม่อนุมัติ");
}
