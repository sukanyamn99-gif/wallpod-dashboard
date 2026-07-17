"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PaymentStatus, ProductCategory, ProductionStatus } from "@/lib/types";
import { PRODUCTION_STATUSES } from "@/lib/types";

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

type ParsedForm = {
  ok: true;
  projectDate: string;
  jobNo: string | null;
  customerName: string;
  projectName: string;
  salesRepId: string;
  customerType: string;
  productionStatus: ProductionStatus | null;
  items: { category: string; amount: number }[];
  preVat: number;
  vat: number;
  total: number;
  costs: {
    material_cost: number;
    glue_cost: number;
    cutting_cost: number;
    install_cost: number;
    parking_cost: number;
    shipping_cost: number;
  };
  hasCosts: boolean;
  status: string;
  installment1Amount: number;
  installment2Amount: number;
  outstanding: number;
  invoiceNo1: string | null;
  paidDate1: string | null;
  invoiceNo2: string | null;
  paidDate2: string | null;
};

function parseForm(formData: FormData): { ok: false; error: string } | ParsedForm {
  const projectDate = str(formData.get("project_date")) ?? new Date().toISOString().slice(0, 10);
  const jobNo = str(formData.get("job_no"));
  const customerName = str(formData.get("customer_name"));
  const projectName = str(formData.get("project_name"));
  const salesRepId = str(formData.get("sales_rep_id"));
  const customerType = str(formData.get("customer_type"));
  const productionStatusRaw = str(formData.get("production_status"));
  const productionStatus =
    productionStatusRaw && PRODUCTION_STATUSES.includes(productionStatusRaw as ProductionStatus)
      ? (productionStatusRaw as ProductionStatus)
      : null;

  if (!customerName) return { ok: false, error: "กรุณากรอกชื่อลูกค้า" };
  if (!projectName) return { ok: false, error: "กรุณากรอกชื่องาน/โปรเจกต์" };
  if (!salesRepId) return { ok: false, error: "กรุณาเลือกเซลล์" };
  if (!customerType) return { ok: false, error: "กรุณาเลือกกลุ่มลูกค้า" };

  const itemCategories = formData.getAll("item_category");
  const itemAmounts = formData.getAll("item_amount");
  const items = itemCategories
    .map((category, i) => ({ category: String(category), amount: num(itemAmounts[i]) }))
    .filter((it) => it.category && PRODUCT_CATEGORIES.includes(it.category as ProductCategory) && it.amount > 0);

  if (items.length === 0) {
    return { ok: false, error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
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
    return { ok: false, error: "กรุณาเลือกสถานะการชำระเงิน" };
  }

  const installment1Amount = num(formData.get("amount_1"));
  const installment2Amount = num(formData.get("amount_2"));
  const outstanding = Math.max(0, Math.round((total - installment1Amount - installment2Amount) * 100) / 100);

  return {
    ok: true,
    projectDate,
    jobNo,
    customerName,
    projectName,
    salesRepId,
    customerType,
    productionStatus,
    items,
    preVat,
    vat,
    total,
    costs,
    hasCosts,
    status,
    installment1Amount,
    installment2Amount,
    outstanding,
    invoiceNo1: str(formData.get("invoice_no_1")),
    paidDate1: str(formData.get("paid_date_1")),
    invoiceNo2: str(formData.get("invoice_no_2")),
    paidDate2: str(formData.get("paid_date_2")),
  };
}

async function resolveCustomerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerName: string,
  customerType: string,
): Promise<{ customerId: string } | { error: string }> {
  // Match an existing customer by name (case-insensitive) so re-typing the same
  // name reuses their record instead of creating a duplicate; otherwise create one.
  const { data: existingCustomer, error: lookupErr } = await supabase
    .from("customers")
    .select("id")
    .ilike("name", customerName)
    .limit(1)
    .maybeSingle();
  if (lookupErr) return { error: `ค้นหาลูกค้าไม่สำเร็จ: ${lookupErr.message}` };

  if (existingCustomer?.id) return { customerId: existingCustomer.id };

  const { data: newCustomer, error: customerErr } = await supabase
    .from("customers")
    .insert({ name: customerName, customer_type: customerType })
    .select("id")
    .single();
  if (customerErr) return { error: `สร้างลูกค้าใหม่ไม่สำเร็จ: ${customerErr.message}` };
  return { customerId: newCustomer.id };
}

function buildPayments(projectId: string, parsed: ParsedForm) {
  const payments = [];
  if (parsed.installment1Amount > 0 || parsed.invoiceNo1) {
    payments.push({
      project_id: projectId,
      invoice_no: parsed.invoiceNo1,
      installment_no: 1,
      amount: parsed.installment1Amount,
      paid_date: parsed.paidDate1,
      status: parsed.status,
      outstanding_amount: parsed.outstanding,
    });
  }
  if (parsed.installment2Amount > 0 || parsed.invoiceNo2) {
    payments.push({
      project_id: projectId,
      invoice_no: parsed.invoiceNo2,
      installment_no: 2,
      amount: parsed.installment2Amount,
      paid_date: parsed.paidDate2,
      status: parsed.status,
      outstanding_amount: parsed.outstanding,
    });
  }
  return payments;
}

export async function createProjectSale(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  const customerResult = await resolveCustomerId(supabase, parsed.customerName, parsed.customerType);
  if ("error" in customerResult) return { error: customerResult.error };

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .insert({
      job_no: parsed.jobNo,
      project_date: parsed.projectDate,
      customer_id: customerResult.customerId,
      project_name: parsed.projectName,
      sales_rep_id: parsed.salesRepId,
      customer_type: parsed.customerType,
      production_status: parsed.productionStatus,
      stage_percent: 100,
      pre_vat: parsed.preVat,
      vat: parsed.vat,
    })
    .select("id")
    .single();

  if (projectErr) return { error: projectErr.message };

  const { error: itemsErr } = await supabase
    .from("project_items")
    .insert(parsed.items.map((it) => ({ project_id: project.id, product_category: it.category, amount: it.amount })));
  if (itemsErr) return { error: `บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  if (parsed.hasCosts) {
    const { error: costErr } = await supabase.from("project_costs").insert({ ...parsed.costs, project_id: project.id });
    if (costErr) return { error: `บันทึกต้นทุนไม่สำเร็จ: ${costErr.message}` };
  }

  const payments = buildPayments(project.id, parsed);
  if (payments.length > 0) {
    const { error: payErr } = await supabase.from("payments").insert(payments);
    if (payErr) return { error: `บันทึกการชำระเงินไม่สำเร็จ: ${payErr.message}` };
  }

  revalidatePath("/dashboard/project-sales");
  revalidatePath("/dashboard/sales");
  return { error: null };
}

export async function updateProjectSale(projectId: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  const customerResult = await resolveCustomerId(supabase, parsed.customerName, parsed.customerType);
  if ("error" in customerResult) return { error: customerResult.error };

  const { error: projectErr } = await supabase
    .from("projects")
    .update({
      project_date: parsed.projectDate,
      customer_id: customerResult.customerId,
      project_name: parsed.projectName,
      sales_rep_id: parsed.salesRepId,
      customer_type: parsed.customerType,
      production_status: parsed.productionStatus,
      pre_vat: parsed.preVat,
      vat: parsed.vat,
    })
    .eq("id", projectId);
  if (projectErr) return { error: projectErr.message };

  const { error: deleteItemsErr } = await supabase.from("project_items").delete().eq("project_id", projectId);
  if (deleteItemsErr) return { error: `ลบรายการสินค้าเดิมไม่สำเร็จ: ${deleteItemsErr.message}` };
  const { error: itemsErr } = await supabase
    .from("project_items")
    .insert(parsed.items.map((it) => ({ project_id: projectId, product_category: it.category, amount: it.amount })));
  if (itemsErr) return { error: `บันทึกรายการสินค้าไม่สำเร็จ: ${itemsErr.message}` };

  const { error: deleteCostsErr } = await supabase.from("project_costs").delete().eq("project_id", projectId);
  if (deleteCostsErr) return { error: `ลบต้นทุนเดิมไม่สำเร็จ: ${deleteCostsErr.message}` };
  if (parsed.hasCosts) {
    const { error: costErr } = await supabase.from("project_costs").insert({ ...parsed.costs, project_id: projectId });
    if (costErr) return { error: `บันทึกต้นทุนไม่สำเร็จ: ${costErr.message}` };
  }

  const { error: deletePaymentsErr } = await supabase.from("payments").delete().eq("project_id", projectId);
  if (deletePaymentsErr) return { error: `ลบข้อมูลการชำระเงินเดิมไม่สำเร็จ: ${deletePaymentsErr.message}` };
  const payments = buildPayments(projectId, parsed);
  if (payments.length > 0) {
    const { error: payErr } = await supabase.from("payments").insert(payments);
    if (payErr) return { error: `บันทึกการชำระเงินไม่สำเร็จ: ${payErr.message}` };
  }

  revalidatePath(`/dashboard/project-sales/edit/${parsed.jobNo ?? ""}`);
  revalidatePath("/dashboard/project-sales");
  revalidatePath("/dashboard/sales");
  return { error: null };
}

export async function setProjectCancelled(projectId: string, jobNo: string | null, cancelled: boolean) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ is_cancelled: cancelled }).eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/project-sales/edit/${jobNo ?? ""}`);
  revalidatePath("/dashboard/project-sales");
  revalidatePath("/dashboard/sales");
  return { error: null };
}

export async function deleteProjectSale(projectId: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/project-sales");
  revalidatePath("/dashboard/sales");
  return { error: null };
}
