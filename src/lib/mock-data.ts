import type { Customer, CustomerType, Project, ProductCategory, SaleReport, SalesRep, Stage } from "@/lib/types";
import { STAGE_PERCENT_BY_STAGE } from "@/lib/types";

// Sample data so the dashboard is browsable before a real Supabase project
// and Excel import are wired up. Shape matches the live schema in supabase/schema.sql.

export const mockSalesReps: SalesRep[] = [
  { id: "rep-1", name: "กิตติ", active: true },
  { id: "rep-2", name: "นารี", active: true },
  { id: "rep-3", name: "สมชาย", active: true },
];

export const mockCustomers: Customer[] = [
  { id: "cus-1", name: "บจก. สยามดีไซน์", customer_type: "Designer" },
  { id: "cus-2", name: "โรงเรียนวัดสุทธิ", customer_type: "School" },
  { id: "cus-3", name: "บจก. เทิร์นคีย์ โปร", customer_type: "Turnkey" },
  { id: "cus-4", name: "คุณวรรณา (เจ้าของบ้าน)", customer_type: "Owner" },
  { id: "cus-5", name: "บจก. คอร์ปอเรท กรุ๊ป", customer_type: "Corporate" },
  { id: "cus-6", name: "หจก. รับเหมาก่อสร้างไทย", customer_type: "Contractor" },
  { id: "cus-7", name: "ดีลเลอร์ภาคเหนือ", customer_type: "Dealer" },
];

const repById = Object.fromEntries(mockSalesReps.map((r) => [r.id, r.name]));
const cusById = Object.fromEntries(mockCustomers.map((c) => [c.id, c]));

function project(p: {
  id: string;
  job_no: string;
  daysAgo: number;
  customer_id: string;
  project_name: string;
  sales_rep_id: string;
  stage_percent: 10 | 30 | 50 | 100;
  pre_vat: number;
}): Project {
  const date = new Date();
  date.setDate(date.getDate() - p.daysAgo);
  const vat = Math.round(p.pre_vat * 0.07);
  return {
    id: p.id,
    job_no: p.job_no,
    project_date: date.toISOString().slice(0, 10),
    customer_id: p.customer_id,
    customer_name: cusById[p.customer_id].name,
    project_name: p.project_name,
    sales_rep_id: p.sales_rep_id,
    sales_rep_name: repById[p.sales_rep_id],
    customer_type: cusById[p.customer_id].customer_type,
    stage_percent: p.stage_percent,
    production_status: null,
    pre_vat: p.pre_vat,
    vat,
    total: p.pre_vat + vat,
  };
}

export const mockProjects: Project[] = [
  project({ id: "p1", job_no: "J-2607-01", daysAgo: 2, customer_id: "cus-1", project_name: "สตูดิโอบันทึกเสียง สยามดีไซน์", sales_rep_id: "rep-1", stage_percent: 50, pre_vat: 420000 }),
  project({ id: "p2", job_no: "J-2607-02", daysAgo: 10, customer_id: "cus-2", project_name: "ห้องดนตรี รร.วัดสุทธิ", sales_rep_id: "rep-2", stage_percent: 30, pre_vat: 180000 }),
  project({ id: "p3", job_no: "J-2607-03", daysAgo: 1, customer_id: "cus-3", project_name: "คอนโด เทิร์นคีย์ เฟส 2", sales_rep_id: "rep-3", stage_percent: 10, pre_vat: 950000 }),
  project({ id: "p4", job_no: "J-2607-04", daysAgo: 15, customer_id: "cus-4", project_name: "ห้องโฮมเธียเตอร์ คุณวรรณา", sales_rep_id: "rep-1", stage_percent: 100, pre_vat: 95000 }),
  project({ id: "p5", job_no: "J-2607-05", daysAgo: 5, customer_id: "cus-5", project_name: "ห้องประชุมสำนักงานใหญ่", sales_rep_id: "rep-2", stage_percent: 100, pre_vat: 260000 }),
  project({ id: "p6", job_no: "J-2607-06", daysAgo: 20, customer_id: "cus-6", project_name: "อาคารพาณิชย์ 5 ชั้น", sales_rep_id: "rep-3", stage_percent: 50, pre_vat: 610000 }),
  project({ id: "p7", job_no: "J-2607-07", daysAgo: 3, customer_id: "cus-7", project_name: "โชว์รูมตัวแทนจำหน่ายภาคเหนือ", sales_rep_id: "rep-1", stage_percent: 30, pre_vat: 150000 }),
  project({ id: "p8", job_no: "J-2607-08", daysAgo: 8, customer_id: "cus-1", project_name: "ห้องประชุมเล็ก สยามดีไซน์", sales_rep_id: "rep-2", stage_percent: 100, pre_vat: 88000 }),
  project({ id: "p9", job_no: "J-2607-09", daysAgo: 12, customer_id: "cus-3", project_name: "คอนโด เทิร์นคีย์ เฟส 1", sales_rep_id: "rep-3", stage_percent: 100, pre_vat: 720000 }),
  project({ id: "p10", job_no: "J-2607-10", daysAgo: 0, customer_id: "cus-4", project_name: "ผนังกันเสียงห้องซ้อมดนตรี", sales_rep_id: "rep-1", stage_percent: 10, pre_vat: 65000 }),
];

export const mockCustomerTypes: CustomerType[] = [
  "Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School",
];

export const mockCategoryBreakdown: { category: ProductCategory; value: number; count: number }[] = [
  { category: "WALLPOD", value: 620000, count: 4 },
  { category: "ACOUSHEET", value: 980000, count: 6 },
  { category: "ACOUSOFT", value: 210000, count: 2 },
  { category: "ACUBOX", value: 95000, count: 1 },
  { category: "CNC", value: 150000, count: 3 },
  { category: "SERVICE", value: 60000, count: 2 },
  { category: "WALLPAPER", value: 40000, count: 1 },
  { category: "OTHER", value: 25000, count: 1 },
];

function saleReport(r: {
  id: string;
  sales_rep_id: string;
  customer_name: string;
  project_name: string;
  customer_type: CustomerType;
  project_type: SaleReport["project_type"];
  stage: Stage;
  est_value: number;
  location_text?: string;
  next_action?: string;
  note?: string;
  hoursAgo: number;
}): SaleReport {
  const created = new Date();
  created.setHours(created.getHours() - r.hoursAgo);
  return {
    id: r.id,
    sales_rep_id: r.sales_rep_id,
    sales_rep_name: repById[r.sales_rep_id],
    customer_name: r.customer_name,
    project_name: r.project_name,
    customer_type: r.customer_type,
    project_type: r.project_type,
    stage: r.stage,
    stage_percent: STAGE_PERCENT_BY_STAGE[r.stage],
    est_value: r.est_value,
    location_text: r.location_text ?? null,
    next_action: r.next_action ?? null,
    note: r.note ?? null,
    created_at: created.toISOString(),
  };
}

export const mockSaleReports: SaleReport[] = [
  saleReport({ id: "sl1", sales_rep_id: "rep-1", customer_name: "บจก. สยามดีไซน์", project_name: "สตูดิโอบันทึกเสียง", customer_type: "Designer", project_type: "ออฟฟิศ", stage: "เจรจาต่อรอง", est_value: 420000, location_text: "https://maps.google.com/?q=13.7563,100.5018", next_action: "รอเซ็นสัญญาสัปดาห์หน้า", hoursAgo: 2 }),
  saleReport({ id: "sl2", sales_rep_id: "rep-2", customer_name: "บจก. คอร์ปอเรท กรุ๊ป", project_name: "ห้องประชุมสำนักงานใหญ่", customer_type: "Corporate", project_type: "ออฟฟิศ", stage: "ปิดการขาย", est_value: 260000, next_action: "ส่งทีมติดตั้ง", hoursAgo: 4 }),
  saleReport({ id: "sl3", sales_rep_id: "rep-3", customer_name: "บจก. เทิร์นคีย์ โปร", project_name: "คอนโด เฟส 2", customer_type: "Turnkey", project_type: "คอนโด", stage: "นำเสนอ", est_value: 950000, next_action: "นัดสำรวจหน้างานอีกครั้ง", hoursAgo: 6 }),
  saleReport({ id: "sl4", sales_rep_id: "rep-1", customer_name: "ดีลเลอร์ภาคเหนือ", project_name: "โชว์รูมภาคเหนือ", customer_type: "Dealer", project_type: "อื่นๆ", stage: "ใบเสนอราคา", est_value: 150000, next_action: "รอลูกค้าอนุมัติงบ", hoursAgo: 20 }),
  saleReport({ id: "sl5", sales_rep_id: "rep-2", customer_name: "โรงเรียนวัดสุทธิ", project_name: "ห้องดนตรี", customer_type: "School", project_type: "โรงเรียน", stage: "ไม่สำเร็จ", est_value: 180000, note: "งบไม่พอ เลื่อนไปปีหน้า", hoursAgo: 30 }),
];
