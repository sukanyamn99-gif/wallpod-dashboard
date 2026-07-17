import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProjectSaleInitialData } from "@/app/dashboard/project-sales/project-sale-form";
import type { ProductCategory } from "@/lib/types";

export interface ProjectDetail {
  id: string;
  isCancelled: boolean;
  initialData: ProjectSaleInitialData;
}

const PRODUCT_CATEGORIES: ProductCategory[] = [
  "WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER",
];

export interface FullProjectRow {
  id: string;
  jobNo: string | null;
  projectDate: string;
  customerName: string;
  projectName: string;
  salesRepName: string;
  customerType: string;
  isCancelled: boolean;
  productionStatus: string | null;
  itemsByCategory: Record<ProductCategory, number>;
  preVat: number;
  vat: number;
  total: number;
  costs: {
    material: number;
    glue: number;
    cutting: number;
    install: number;
    parking: number;
    shipping: number;
    totalCost: number;
  } | null;
  profit: number | null;
  invoiceNo1: string | null;
  amount1: number | null;
  paidDate1: string | null;
  invoiceNo2: string | null;
  amount2: number | null;
  paidDate2: string | null;
  status: string | null;
  outstanding: number | null;
}

/**
 * Every column from the original Excel tracking sheet, one row per project.
 * Shared by the on-screen report table (shows cancelled jobs too) and the
 * Excel export route (excludes them) — callers filter `isCancelled` as needed.
 */
export async function getFullProjectReport(): Promise<FullProjectRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const { data: projects, error: projectsErr } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, project_name, customer_type, pre_vat, vat, total, is_cancelled, production_status, customers(name), sales_reps(name)",
    )
    .order("project_date", { ascending: false });
  if (projectsErr) throw projectsErr;

  const projectIds = (projects ?? []).map((p) => p.id);
  const [{ data: items, error: itemsErr }, { data: costs, error: costsErr }, { data: payments, error: paymentsErr }] =
    await Promise.all([
      supabase.from("project_items").select("project_id, product_category, amount").in("project_id", projectIds),
      supabase.from("project_costs").select("*").in("project_id", projectIds),
      supabase.from("payments").select("*").in("project_id", projectIds).order("installment_no"),
    ]);
  if (itemsErr) throw itemsErr;
  if (costsErr) throw costsErr;
  if (paymentsErr) throw paymentsErr;

  return (projects ?? []).map((p) => {
    const projectItems = (items ?? []).filter((it) => it.project_id === p.id);
    const projectCosts = (costs ?? []).find((c) => c.project_id === p.id);
    const projectPayments = (payments ?? []).filter((pay) => pay.project_id === p.id);
    const payment1 = projectPayments.find((pay) => pay.installment_no === 1);
    const payment2 = projectPayments.find((pay) => pay.installment_no === 2);

    const itemsByCategory = Object.fromEntries(
      PRODUCT_CATEGORIES.map((cat) => [
        cat,
        Number(projectItems.find((it) => it.product_category === cat)?.amount ?? 0),
      ]),
    ) as Record<ProductCategory, number>;

    const costs2 = projectCosts
      ? {
          material: Number(projectCosts.material_cost),
          glue: Number(projectCosts.glue_cost),
          cutting: Number(projectCosts.cutting_cost),
          install: Number(projectCosts.install_cost),
          parking: Number(projectCosts.parking_cost),
          shipping: Number(projectCosts.shipping_cost),
          totalCost: Number(projectCosts.total_cost),
        }
      : null;

    return {
      id: p.id,
      jobNo: p.job_no,
      projectDate: p.project_date,
      // @ts-expect-error -- Supabase types the joined relation loosely here
      customerName: p.customers?.name ?? "",
      projectName: p.project_name,
      // @ts-expect-error -- Supabase types the joined relation loosely here
      salesRepName: p.sales_reps?.name ?? "",
      customerType: p.customer_type,
      isCancelled: p.is_cancelled,
      productionStatus: p.production_status,
      itemsByCategory,
      preVat: Number(p.pre_vat),
      vat: Number(p.vat),
      total: Number(p.total),
      costs: costs2,
      profit: costs2 ? Number(p.pre_vat) - costs2.totalCost : null,
      invoiceNo1: payment1?.invoice_no ?? null,
      amount1: payment1 ? Number(payment1.amount) : null,
      paidDate1: payment1?.paid_date ?? null,
      invoiceNo2: payment2?.invoice_no ?? null,
      amount2: payment2 ? Number(payment2.amount) : null,
      paidDate2: payment2?.paid_date ?? null,
      status: payment1?.status ?? payment2?.status ?? null,
      outstanding: payment1 ? Number(payment1.outstanding_amount) : payment2 ? Number(payment2.outstanding_amount) : null,
    };
  });
}

export async function getProjectByJobNo(jobNo: string): Promise<ProjectDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, pre_vat, vat, is_cancelled, production_status, customers(name)",
    )
    .eq("job_no", jobNo)
    .maybeSingle();
  if (projectErr) throw projectErr;
  if (!project) return null;

  const [{ data: items, error: itemsErr }, { data: costs, error: costsErr }, { data: payments, error: paymentsErr }] =
    await Promise.all([
      supabase.from("project_items").select("product_category, amount").eq("project_id", project.id),
      supabase.from("project_costs").select("*").eq("project_id", project.id).maybeSingle(),
      supabase.from("payments").select("*").eq("project_id", project.id).order("installment_no"),
    ]);
  if (itemsErr) throw itemsErr;
  if (costsErr) throw costsErr;
  if (paymentsErr) throw paymentsErr;

  const payment1 = payments?.find((p) => p.installment_no === 1);
  const payment2 = payments?.find((p) => p.installment_no === 2);

  return {
    id: project.id,
    isCancelled: project.is_cancelled,
    initialData: {
      projectDate: project.project_date,
      jobNo: project.job_no,
      // @ts-expect-error -- Supabase types the joined relation loosely here
      customerName: project.customers?.name ?? "",
      projectName: project.project_name,
      salesRepId: project.sales_rep_id,
      customerType: project.customer_type,
      productionStatus: project.production_status ?? "",
      items: (items ?? []).map((it) => ({ category: it.product_category, amount: String(it.amount) })),
      costs: {
        material_cost: costs?.material_cost != null ? String(costs.material_cost) : "",
        glue_cost: costs?.glue_cost != null ? String(costs.glue_cost) : "",
        cutting_cost: costs?.cutting_cost != null ? String(costs.cutting_cost) : "",
        install_cost: costs?.install_cost != null ? String(costs.install_cost) : "",
        parking_cost: costs?.parking_cost != null ? String(costs.parking_cost) : "",
        shipping_cost: costs?.shipping_cost != null ? String(costs.shipping_cost) : "",
      },
      status: payment1?.status ?? payment2?.status ?? "",
      invoiceNo1: payment1?.invoice_no ?? "",
      amount1: payment1?.amount != null ? String(payment1.amount) : "",
      paidDate1: payment1?.paid_date ?? "",
      invoiceNo2: payment2?.invoice_no ?? "",
      amount2: payment2?.amount != null ? String(payment2.amount) : "",
      paidDate2: payment2?.paid_date ?? "",
    },
  };
}
