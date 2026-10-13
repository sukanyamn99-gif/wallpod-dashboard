"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { getCurrentProfile } from "@/lib/data/profile";
import { getPurchaseRequestById } from "@/lib/data/purchase-requests";
import { canEditPurchaseRequest } from "@/lib/purchase-request-edit";

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

// Shared by create and update — both validate and parse the same fields.
function parseRequestForm(formData: FormData) {
  const departmentId = str(formData.get("department_id"));
  if (!departmentId) return { ok: false as const, error: "กรุณาเลือกแผนก" };

  const purpose = str(formData.get("purpose"));
  const note = str(formData.get("note"));
  const jobNo = str(formData.get("job_no"));
  const projectName = str(formData.get("project_name"));
  const supplierId = str(formData.get("supplier_id"));

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
      // Empty when this row was typed in free-text rather than picked from
      // the catalog (no stock_products row exists for it yet) — a real
      // ใบขอซื้อ need, since the whole point is often requesting something
      // not already in the system.
      stockProductId: str(id),
      name: String(itemNames[i] ?? "").trim(),
      sku: String(itemSkus[i] ?? "").trim() || null,
      unit: String(itemUnits[i] ?? "ชิ้น"),
      quantity: num(itemQuantities[i]),
      note: str(itemNotes[i] ?? null),
      supplierId: str(itemSupplierIds[i] ?? null),
      unitPrice: num(itemUnitPrices[i]),
    }))
    .filter((it) => it.name && it.quantity > 0);

  if (items.length === 0) return { ok: false as const, error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  return { ok: true as const, departmentId, purpose, note, jobNo, projectName, supplierId, items };
}

type ParsedItems = Extract<ReturnType<typeof parseRequestForm>, { ok: true }>["items"];

function itemRows(requestId: string, items: ParsedItems) {
  return items.map((it) => ({
    request_id: requestId,
    stock_product_id: it.stockProductId,
    product_name_snapshot: it.name,
    product_sku_snapshot: it.sku,
    unit_snapshot: it.unit,
    quantity: it.quantity,
    note: it.note,
    supplier_id: it.supplierId,
    unit_price: it.unitPrice,
  }));
}

export async function createPurchaseRequest(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseRequestForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { departmentId, purpose, note, jobNo, projectName, supplierId, items } = parsed;

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
      supplier_id: supplierId,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemsErr } = await supabase.from("purchase_request_items").insert(itemRows(request.id, items));
  if (itemsErr) return { error: `บันทึกใบขอซื้อสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  revalidateConsumers();
  return { error: null, id: request.id as string };
}

export async function updatePurchaseRequest(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  // Re-checked here, not just by hiding the button: a fresh read of who may
  // edit this request right now (status can have changed since the form
  // opened, e.g. it was approved or a ใบสั่งซื้อ was created from it).
  const profile = await getCurrentProfile();
  if (!profile) return { error: "กรุณาเข้าสู่ระบบ" };
  const existing = await getPurchaseRequestById(id);
  if (!existing) return { error: "ไม่พบใบขอซื้อนี้ในระบบ" };
  if (existing.hasPurchaseOrder) return { error: "แก้ไขไม่ได้ — ได้ออกใบสั่งซื้อจากใบขอซื้อนี้ไปแล้ว" };
  if (!canEditPurchaseRequest(profile, existing)) return { error: "ไม่มีสิทธิ์แก้ไขใบขอซื้อนี้" };

  const parsed = parseRequestForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { departmentId, purpose, note, jobNo, projectName, supplierId, items } = parsed;

  const supabase = await createClient();

  // Changing an already-decided request means the decision no longer applies
  // to what it now says — back to pending, to be approved again.
  const resetsApproval = existing.status !== "รออนุมัติ";
  const { error: updateErr } = await supabase
    .from("purchase_requests")
    .update({
      department_id: departmentId,
      purpose,
      note,
      job_no: jobNo,
      project_name: projectName,
      supplier_id: supplierId,
      ...(resetsApproval ? { status: "รออนุมัติ", approved_by: null, approved_at: null } : {}),
    })
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  // Items are replaced: the new rows go in FIRST and the old ones are removed
  // after, so a failure part-way leaves duplicated lines the user can see and
  // fix rather than a request with its items silently gone.
  const oldItemIds = existing.items.map((it) => it.id);
  const { error: insertErr } = await supabase.from("purchase_request_items").insert(itemRows(id, items));
  if (insertErr) return { error: `บันทึกข้อมูลทั่วไปสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${insertErr.message}` };
  if (oldItemIds.length > 0) {
    const { error: deleteErr } = await supabase.from("purchase_request_items").delete().in("id", oldItemIds);
    if (deleteErr) {
      return { error: `บันทึกรายการใหม่แล้ว แต่ลบรายการเก่าไม่สำเร็จ (อาจเห็นรายการซ้ำ): ${deleteErr.message}` };
    }
  }

  await logActivity(
    resetsApproval ? "แก้ไขใบขอซื้อ (กลับไปรออนุมัติ)" : "แก้ไขใบขอซื้อ",
    existing.docNo,
  );
  revalidateConsumers();
  revalidatePath(`/dashboard/purchase-requests/view/${id}`);
  return { error: null };
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
