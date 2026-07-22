"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
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

export async function createStockRequisition(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

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
  const items = itemIds
    .map((id, i) => ({
      stockProductId: String(id),
      name: String(itemNames[i] ?? ""),
      sku: String(itemSkus[i] ?? "").trim() || null,
      unit: String(itemUnits[i] ?? "ชิ้น"),
      quantity: num(itemQuantities[i]),
    }))
    .filter((it) => it.stockProductId && it.quantity > 0);

  if (items.length === 0) {
    return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only links to an existing customer by name — this form has no customer_type
  // field to create a brand-new customer record with, so an unmatched name is
  // simply left unlinked rather than silently creating a partial customer.
  let customerId: string | null = null;
  if (customerName) {
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .ilike("name", customerName)
      .limit(1)
      .maybeSingle();
    customerId = existingCustomer?.id ?? null;
  }

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
    })),
  );
  if (itemsErr) return { error: `บันทึกใบเบิกสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  for (const it of items) {
    const { error: movementErr } = await supabase.rpc("record_stock_movement", {
      p_product_id: it.stockProductId,
      p_type: "out",
      p_qty: it.quantity,
      p_note: `เบิกตามใบเบิก ${docNo}`,
    });
    if (movementErr) {
      return { error: `บันทึกใบเบิกสำเร็จ แต่ตัดสต็อกสินค้า "${it.name}" ไม่สำเร็จ: ${movementErr.message}` };
    }
  }

  revalidateRequisitionConsumers();
  return { error: null };
}

export async function deleteStockRequisition(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_requisitions").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateRequisitionConsumers();
  return { error: null };
}
