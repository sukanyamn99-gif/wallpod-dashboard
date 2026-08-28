import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getProductCategories } from "@/lib/data/reference";
import type { ProjectSaleInitialData } from "@/app/dashboard/project-sales/project-sale-form";
import type { ProductCategory } from "@/lib/types";

export interface ProjectDetail {
  id: string;
  isCancelled: boolean;
  initialData: ProjectSaleInitialData;
}

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
  receiptNo1: string | null;
  receivedDate1: string | null;
  invoiceNo2: string | null;
  amount2: number | null;
  paidDate2: string | null;
  receiptNo2: string | null;
  receivedDate2: string | null;
  invoiceNo3: string | null;
  amount3: number | null;
  paidDate3: string | null;
  receiptNo3: string | null;
  receivedDate3: string | null;
  status: string | null;
  outstanding: number | null;
}

export interface FullProjectReport {
  categories: string[];
  rows: FullProjectRow[];
}

/**
 * Every column from the original Excel tracking sheet, one row per project.
 * Shared by the on-screen report table (shows cancelled jobs too) and the
 * Excel export route (excludes them) — callers filter `isCancelled` as needed.
 *
 * `categories` is the union of the live product_categories list and every
 * product_category value actually present in project_items — so a renamed
 * or deleted category never makes its historical items silently drop off
 * the report/export; it just keeps its own column under its old name.
 */
export async function getFullProjectReport(): Promise<FullProjectReport> {
  if (!isSupabaseConfigured()) return { categories: [], rows: [] };

  const supabase = await createClient();

  // One round trip: PostgREST embeds project_items/project_costs/payments
  // via their project_id foreign keys instead of fetching each table
  // separately and joining client-side — this used to be 2 sequential
  // round trips (projects, then Promise.all of the child tables), which
  // mattered a lot more before the Vercel function was colocated with
  // Supabase, but still adds up since this function backs 4 different pages.
  const [{ data: projects, error: projectsErr }, liveCategories] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, job_no, project_date, project_name, customer_type, pre_vat, vat, total, is_cancelled, production_status, customers(name), sales_reps(name), project_items(product_category, amount), project_costs(material_cost, glue_cost, cutting_cost, install_cost, parking_cost, shipping_cost, total_cost), payments(invoice_no, installment_no, amount, paid_date, status, outstanding_amount, receipt_no, received_date)",
      )
      .order("project_date", { ascending: false })
      .order("installment_no", { foreignTable: "payments", ascending: true }),
    getProductCategories(),
  ]);
  if (projectsErr) throw projectsErr;

  type EmbeddedItem = { product_category: string; amount: number };
  type EmbeddedCosts = {
    material_cost: number;
    glue_cost: number;
    cutting_cost: number;
    install_cost: number;
    parking_cost: number;
    shipping_cost: number;
    total_cost: number;
  };
  type EmbeddedPayment = {
    invoice_no: string | null;
    installment_no: number;
    amount: number;
    paid_date: string | null;
    status: string | null;
    outstanding_amount: number;
    receipt_no: string | null;
    received_date: string | null;
  };

  const categorySet = new Set(liveCategories.map((c) => c.name));
  for (const p of projects ?? []) {
    for (const it of (p.project_items as unknown as EmbeddedItem[]) ?? []) categorySet.add(it.product_category);
  }
  const categories = Array.from(categorySet).sort();

  const rows = (projects ?? []).map((p) => {
    const projectItems = (p.project_items as unknown as EmbeddedItem[]) ?? [];
    const projectCosts = (p.project_costs as unknown as EmbeddedCosts | null) ?? null;
    const projectPayments = (p.payments as unknown as EmbeddedPayment[]) ?? [];
    const payment1 = projectPayments.find((pay) => pay.installment_no === 1);
    const payment2 = projectPayments.find((pay) => pay.installment_no === 2);
    const payment3 = projectPayments.find((pay) => pay.installment_no === 3);

    const itemsByCategory = Object.fromEntries(
      categories.map((cat) => [
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
      receiptNo1: payment1?.receipt_no ?? null,
      receivedDate1: payment1?.received_date ?? null,
      invoiceNo2: payment2?.invoice_no ?? null,
      amount2: payment2 ? Number(payment2.amount) : null,
      paidDate2: payment2?.paid_date ?? null,
      receiptNo2: payment2?.receipt_no ?? null,
      receivedDate2: payment2?.received_date ?? null,
      invoiceNo3: payment3?.invoice_no ?? null,
      amount3: payment3 ? Number(payment3.amount) : null,
      paidDate3: payment3?.paid_date ?? null,
      receiptNo3: payment3?.receipt_no ?? null,
      receivedDate3: payment3?.received_date ?? null,
      status: payment1?.status ?? payment2?.status ?? payment3?.status ?? null,
      outstanding:
        payment1 ? Number(payment1.outstanding_amount)
        : payment2 ? Number(payment2.outstanding_amount)
        : payment3 ? Number(payment3.outstanding_amount)
        : null,
    };
  });

  return { categories, rows };
}

export async function getProjectByJobNo(jobNo: string): Promise<ProjectDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  // One round trip via PostgREST embedding instead of fetching the project
  // then its children separately — same optimization as getFullProjectReport().
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, pre_vat, vat, is_cancelled, production_status, customers(name), project_items(product_category, amount), project_costs(material_cost, glue_cost, cutting_cost, install_cost, parking_cost, shipping_cost), payments(invoice_no, installment_no, amount, paid_date, status, receipt_no, received_date)",
    )
    .eq("job_no", jobNo)
    .order("installment_no", { foreignTable: "payments", ascending: true })
    .maybeSingle();
  if (projectErr) throw projectErr;
  if (!project) return null;

  type EmbeddedItem = { product_category: string; amount: number };
  type EmbeddedCosts = {
    material_cost: number;
    glue_cost: number;
    cutting_cost: number;
    install_cost: number;
    parking_cost: number;
    shipping_cost: number;
  };
  type EmbeddedPayment = {
    invoice_no: string | null;
    installment_no: number;
    amount: number;
    paid_date: string | null;
    status: string | null;
    receipt_no: string | null;
    received_date: string | null;
  };
  const items = (project.project_items as unknown as EmbeddedItem[]) ?? [];
  const costs = (project.project_costs as unknown as EmbeddedCosts | null) ?? null;
  const payments = (project.payments as unknown as EmbeddedPayment[]) ?? [];

  const payment1 = payments.find((p) => p.installment_no === 1);
  const payment2 = payments.find((p) => p.installment_no === 2);
  const payment3 = payments.find((p) => p.installment_no === 3);

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
      status: payment1?.status ?? payment2?.status ?? payment3?.status ?? "",
      invoiceNo1: payment1?.invoice_no ?? "",
      amount1: payment1?.amount != null ? String(payment1.amount) : "",
      paidDate1: payment1?.paid_date ?? "",
      receiptNo1: payment1?.receipt_no ?? "",
      receivedDate1: payment1?.received_date ?? "",
      invoiceNo2: payment2?.invoice_no ?? "",
      amount2: payment2?.amount != null ? String(payment2.amount) : "",
      paidDate2: payment2?.paid_date ?? "",
      receiptNo2: payment2?.receipt_no ?? "",
      receivedDate2: payment2?.received_date ?? "",
      invoiceNo3: payment3?.invoice_no ?? "",
      amount3: payment3?.amount != null ? String(payment3.amount) : "",
      paidDate3: payment3?.paid_date ?? "",
      receiptNo3: payment3?.receipt_no ?? "",
      receivedDate3: payment3?.received_date ?? "",
    },
  };
}

export interface AdjacentJobNos {
  prevJobNo: string | null;
  nextJobNo: string | null;
}

// Powers the "ย้อนกลับ/หน้าถัดไป" buttons on the edit page — lets someone
// walk through jobs one after another (e.g. filling in cost data) without
// returning to the list and searching each time. Ordered by job_no since
// that's also the order jobs read in visually within the report table's
// per-month groups (JB2601001, 002, 003, ...).
export async function getAdjacentJobNos(jobNo: string): Promise<AdjacentJobNos> {
  if (!isSupabaseConfigured()) return { prevJobNo: null, nextJobNo: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("job_no")
    .not("job_no", "is", null)
    .order("job_no", { ascending: true });
  if (error) throw error;

  const jobNos = (data ?? []).map((r) => r.job_no as string);
  const index = jobNos.indexOf(jobNo);
  if (index === -1) return { prevJobNo: null, nextJobNo: null };

  return {
    prevJobNo: index > 0 ? jobNos[index - 1] : null,
    nextJobNo: index < jobNos.length - 1 ? jobNos[index + 1] : null,
  };
}
