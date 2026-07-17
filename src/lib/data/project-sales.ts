import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProjectSaleInitialData } from "@/app/dashboard/project-sales/project-sale-form";

export interface ProjectDetail {
  id: string;
  initialData: ProjectSaleInitialData;
}

export async function getProjectByJobNo(jobNo: string): Promise<ProjectDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, pre_vat, vat, customers(name)",
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
    initialData: {
      projectDate: project.project_date,
      jobNo: project.job_no,
      // @ts-expect-error -- Supabase types the joined relation loosely here
      customerName: project.customers?.name ?? "",
      projectName: project.project_name,
      salesRepId: project.sales_rep_id,
      customerType: project.customer_type,
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
