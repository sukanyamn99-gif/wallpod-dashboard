import * as XLSX from "xlsx";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const PRODUCT_CATEGORIES = [
  "WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER",
] as const;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return new Response("ยังไม่ได้ตั้งค่า Supabase", { status: 503 });
  }

  const supabase = await createClient();

  const { data: projects, error: projectsErr } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, project_name, customer_type, pre_vat, vat, total, customers(name), sales_reps(name)",
    )
    .eq("is_cancelled", false)
    .order("project_date", { ascending: true });
  if (projectsErr) return new Response(projectsErr.message, { status: 500 });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [{ data: items, error: itemsErr }, { data: costs, error: costsErr }, { data: payments, error: paymentsErr }] =
    await Promise.all([
      supabase.from("project_items").select("project_id, product_category, amount").in("project_id", projectIds),
      supabase.from("project_costs").select("*").in("project_id", projectIds),
      supabase.from("payments").select("*").in("project_id", projectIds).order("installment_no"),
    ]);
  if (itemsErr) return new Response(itemsErr.message, { status: 500 });
  if (costsErr) return new Response(costsErr.message, { status: 500 });
  if (paymentsErr) return new Response(paymentsErr.message, { status: 500 });

  const rows = (projects ?? []).map((p) => {
    const projectItems = (items ?? []).filter((it) => it.project_id === p.id);
    const projectCosts = (costs ?? []).find((c) => c.project_id === p.id);
    const projectPayments = (payments ?? []).filter((pay) => pay.project_id === p.id);
    const payment1 = projectPayments.find((pay) => pay.installment_no === 1);
    const payment2 = projectPayments.find((pay) => pay.installment_no === 2);
    const totalCost = projectCosts
      ? Number(projectCosts.material_cost) +
        Number(projectCosts.glue_cost) +
        Number(projectCosts.cutting_cost) +
        Number(projectCosts.install_cost) +
        Number(projectCosts.parking_cost) +
        Number(projectCosts.shipping_cost)
      : 0;

    const row: Record<string, string | number> = {
      "JOB NO.": p.job_no ?? "",
      "DATE": p.project_date,
      // @ts-expect-error -- Supabase types the joined relation loosely here
      "CUSTOMER NAMES": p.customers?.name ?? "",
      "PROJECT NAME": p.project_name,
      // @ts-expect-error -- Supabase types the joined relation loosely here
      "SALE": p.sales_reps?.name ?? "",
      "Customer Type": p.customer_type,
    };
    for (const cat of PRODUCT_CATEGORIES) {
      const found = projectItems.find((it) => it.product_category === cat);
      row[cat] = found ? Number(found.amount) : "";
    }
    row["PRE.VAT"] = Number(p.pre_vat);
    row["VAT"] = Number(p.vat);
    row["รวมทั้งสิ้น"] = Number(p.total);
    row["ค่าวัสดุ"] = projectCosts ? Number(projectCosts.material_cost) : "";
    row["ค่ากาว"] = projectCosts ? Number(projectCosts.glue_cost) : "";
    row["ค่าตัด"] = projectCosts ? Number(projectCosts.cutting_cost) : "";
    row["ค่าติดตั้งผู้รับเหมา"] = projectCosts ? Number(projectCosts.install_cost) : "";
    row["ค่าที่จอดรถ"] = projectCosts ? Number(projectCosts.parking_cost) : "";
    row["ค่าขนส่ง"] = projectCosts ? Number(projectCosts.shipping_cost) : "";
    row["รวมต้นทุน"] = projectCosts ? totalCost : "";
    row["กำไร"] = projectCosts ? Number(p.pre_vat) - totalCost : "";
    row["เลขที่เอกสาร (งวด 1)"] = payment1?.invoice_no ?? "";
    row["งวดที่ 1 จำนวนเงิน"] = payment1 ? Number(payment1.amount) : "";
    row["วันที่รับชำระ (งวด 1)"] = payment1?.paid_date ?? "";
    row["เลขที่เอกสาร (งวด 2)"] = payment2?.invoice_no ?? "";
    row["งวดที่ 2 จำนวนเงิน"] = payment2 ? Number(payment2.amount) : "";
    row["วันที่รับชำระ (งวด 2)"] = payment2?.paid_date ?? "";
    row["สถานะ"] = payment1?.status ?? payment2?.status ?? "";
    row["ยอดคงค้าง"] = payment1 ? Number(payment1.outstanding_amount) : payment2 ? Number(payment2.outstanding_amount) : "";

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Project Sales");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const filename = `WALLPOD_Project_Sales_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
