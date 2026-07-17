"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PaymentStatus, ProductCategory } from "@/lib/types";

const PRODUCT_CATEGORIES: ProductCategory[] = [
  "WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["เก็บเงินเรียบร้อย", "ชำระมาแล้ว 50%", "รอชำระเงิน"];

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function createProjectSale(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const projectDate = str(formData.get("project_date")) ?? new Date().toISOString().slice(0, 10);
  const jobNo = str(formData.get("job_no"));
  const customerName = str(formData.get("customer_name"));
  const projectName = str(formData.get("project_name"));
  const salesRepId = str(formData.get("sales_rep_id"));
  const customerType = str(formData.get("customer_type"));

  if (!customerName) return { error: "กรุณากรอกชื่อลูกค้า" };
  if (!projectName) return { error: "กรุณากรอกชื่องาน/โปรเจกต์" };
  if (!salesRepId) return { error: "กรุณาเลือกเซลล์" };
  if (!customerType) return { error: "กรุณาเลือกกลุ่มลูกค้า" };

  const itemCategories = formData.getAll("item_category");
  const itemAmounts = formData.getAll("item_amount");
  const items = itemCategories
    .map((category, i) => ({ category: String(category), amount: num(itemAmounts[i]) }))
    .filter((it) => it.category && PRODUCT_CATEGORIES.includes(it.category as ProductCategory) && it.amount > 0);

  if (items.length === 0) {
    return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
  }

  const preVat = Math.round(items.reduce((sum, it) => sum + it.amount, 0) * 100) / 100;
  const vat = Math.round(preVat * 0.07 * 100) / 100;
  const total = preVat + vat;

  const costs = {
    material_cost: num(formData.get("material_cost")),
    glue_cost: num(formData.get("glue_cost")),
    cutting_cost: num(formData.get("cutting_cost")),
    install_cost: num(formData.get("install_cost")),
    parking_cost: num(formData.get("parking_cost")),
    shipping_cost: num(formData.get("shipping_cost")),
  };
  const hasCosts = Object.values(costs).some((v) => v > 0);

  const status = str(formData.get("status"));
  if (!status || !PAYMENT_STATUSES.includes(status as PaymentStatus)) {
    return { error: "กรุณาเลือกสถานะการชำระเงิน" };
  }

  const installment1Amount = num(formData.get("amount_1"));
  const installment2Amount = num(formData.get("amount_2"));
  const outstanding = Math.max(0, Math.round((total - installment1Amount - installment2Amount) * 100) / 100);

  const supabase = await createClient();

  // Match an existing customer by name (case-insensitive) so re-typing the same
  // name reuses their record instead of creating a duplicate; otherwise create one.
  const { data: existingCustomer, error: lookupErr } = await supabase
    .from("customers")
    .select("id")
    .ilike("name", customerName)
    .limit(1)
    .maybeSingle();
  if (lookupErr) return { error: `ค้นหาลูกค้าไม่สำเร็จ: ${lookupErr.message}` };

  let customerId = existingCustomer?.id;
  if (!customerId) {
    const { data: newCustomer, error: customerErr } = await supabase
      .from("customers")
      .insert({ name: customerName, customer_type: customerType })
      .select("id")
      .single();
    if (customerErr) return { error: `สร้างลูกค้าใหม่ไม่สำเร็จ: ${customerErr.message}` };
    customerId = newCustomer.id;
  }

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .insert({
      job_no: jobNo,
      project_date: projectDate,
      customer_id: customerId,
      project_name: projectName,
      sales_rep_id: salesRepId,
      customer_type: customerType,
      stage_percent: 100,
      pre_vat: preVat,
      vat,
    })
    .select("id")
    .single();

  if (projectErr) return { error: projectErr.message };

  const { error: itemsErr } = await supabase
    .from("project_items")
    .insert(items.map((it) => ({ project_id: project.id, product_category: it.category, amount: it.amount })));
  if (itemsErr) return { error: `บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  if (hasCosts) {
    const { error: costErr } = await supabase.from("project_costs").insert({ ...costs, project_id: project.id });
    if (costErr) return { error: `บันทึกต้นทุนไม่สำเร็จ: ${costErr.message}` };
  }

  const payments = [];
  if (installment1Amount > 0 || str(formData.get("invoice_no_1"))) {
    payments.push({
      project_id: project.id,
      invoice_no: str(formData.get("invoice_no_1")),
      installment_no: 1,
      amount: installment1Amount,
      paid_date: str(formData.get("paid_date_1")),
      status,
      outstanding_amount: outstanding,
    });
  }
  if (installment2Amount > 0 || str(formData.get("invoice_no_2"))) {
    payments.push({
      project_id: project.id,
      invoice_no: str(formData.get("invoice_no_2")),
      installment_no: 2,
      amount: installment2Amount,
      paid_date: str(formData.get("paid_date_2")),
      status,
      outstanding_amount: outstanding,
    });
  }
  if (payments.length > 0) {
    const { error: payErr } = await supabase.from("payments").insert(payments);
    if (payErr) return { error: `บันทึกการชำระเงินไม่สำเร็จ: ${payErr.message}` };
  }

  revalidatePath("/dashboard/project-sales");
  revalidatePath("/dashboard/sales");
  return { error: null };
}
