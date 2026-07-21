export type CustomerType =
  | "Owner"
  | "Designer"
  | "Turnkey"
  | "Contractor"
  | "Corporate"
  | "Dealer"
  | "School";

export type StagePercent = 0 | 10 | 30 | 50 | 100;

export const STAGE_LABELS: Record<StagePercent, string> = {
  0: "ไม่สำเร็จ",
  10: "นำเสนอ",
  30: "ใบเสนอราคา",
  50: "เจรจาต่อรอง",
  100: "ปิดการขาย",
};

export type Stage = "นำเสนอ" | "ใบเสนอราคา" | "เจรจาต่อรอง" | "ปิดการขาย" | "ไม่สำเร็จ";

export const STAGE_PERCENT_BY_STAGE: Record<Stage, StagePercent> = {
  "นำเสนอ": 10,
  "ใบเสนอราคา": 30,
  "เจรจาต่อรอง": 50,
  "ปิดการขาย": 100,
  "ไม่สำเร็จ": 0,
};

export type ProjectType =
  | "ออฟฟิศ"
  | "โรงแรม"
  | "โรงเรียน"
  | "โรงพยาบาล"
  | "บ้าน"
  | "คอนโด"
  | "ห้องซ้อมดนตรี"
  | "อื่นๆ";

export type ProductCategory =
  | "WALLPOD"
  | "ACOUSHEET"
  | "ACOUSOFT"
  | "ACUBOX"
  | "CNC"
  | "SERVICE"
  | "WALLPAPER"
  | "OTHER";

export type PaymentStatus = "เก็บเงินเรียบร้อย" | "ชำระมาแล้ว 50%" | "รอชำระเงิน";

export type ProductionStatus =
  | "รอเงินมัดจำ"
  | "รออนุมัติแบบ"
  | "ทำแบบผลิต (Cutting)"
  | "เบิกแผ่น"
  | "กำลังผลิต"
  | "ผลิตเสร็จ"
  | "ส่งของแล้ว"
  | "ติดตั้งเสร็จ"
  | "รอใบส่งมอบ"
  | "จบงาน"
  | "เก็บเงินงวดสุดท้าย";

export const PRODUCTION_STATUSES: ProductionStatus[] = [
  "รอเงินมัดจำ",
  "รออนุมัติแบบ",
  "ทำแบบผลิต (Cutting)",
  "เบิกแผ่น",
  "กำลังผลิต",
  "ผลิตเสร็จ",
  "ส่งของแล้ว",
  "ติดตั้งเสร็จ",
  "รอใบส่งมอบ",
  "จบงาน",
  "เก็บเงินงวดสุดท้าย",
];

export type Role =
  | "owner"
  | "manager"
  | "sales"
  | "design"
  | "support_sale"
  | "account"
  | "foreman"
  | "production";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  sales_rep_id: string | null;
}

export interface SalesRep {
  id: string;
  name: string;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  customer_type: CustomerType;
}

export interface Project {
  id: string;
  job_no: string | null;
  project_date: string;
  customer_id: string;
  customer_name: string;
  project_name: string;
  sales_rep_id: string;
  sales_rep_name: string;
  customer_type: CustomerType;
  stage_percent: StagePercent;
  production_status: string | null;
  pre_vat: number;
  vat: number;
  total: number;
}

export interface SaleReport {
  id: string;
  sales_rep_id: string;
  sales_rep_name: string;
  customer_name: string;
  project_name: string | null;
  customer_type: CustomerType;
  project_type: ProjectType;
  stage: Stage;
  stage_percent: StagePercent;
  est_value: number;
  location_text: string | null;
  next_action: string | null;
  note: string | null;
  phone: string | null;
  contact_name: string | null;
  image_paths: string[];
  created_at: string;
}

export interface SaleReportChangeLog {
  id: string;
  action: "update" | "delete";
  salesRepName: string;
  customerName: string;
  changedByName: string;
  stageBefore: Stage;
  estValueBefore: number;
  createdAt: string;
}

export interface StockProduct {
  id: string;
  sku: string | null;
  name: string;
  category: ProductCategory | null;
  color: string | null;
  size: string | null;
  thickness: string | null;
  location: string | null;
  note: string | null;
  unit: string;
  quantityOnHand: number;
  reorderPoint: number;
  unitCost: number;
  sellingPrice: number | null;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  stockProductId: string;
  movementType: "in" | "out";
  quantity: number;
  note: string | null;
  createdByName: string;
  createdAt: string;
}

export interface StockDashboardData {
  skuCount: number;
  totalStockValue: number;
  lowStockCount: number;
  categoryBreakdown: { category: string; value: number; count: number }[];
  lowStockItems: StockProduct[];
}

export interface SalesDashboardData {
  totalPipelineValue: number;
  openProjectsCount: number;
  closedThisMonthValue: number;
  pipelineByStage: { stage: StagePercent; label: string; value: number; count: number }[];
  customerTypeBreakdown: { type: CustomerType; value: number; count: number }[];
  categoryBreakdown: { category: ProductCategory; value: number; count: number }[];
  salesRepPerformance: { salesRepId: string; salesRepName: string; totalValue: number; closedValue: number; projectCount: number }[];
  monthlySales: { monthLabel: string; value: number; count: number }[];
  repMonthlyPerformance: {
    months: string[];
    rows: { salesRepId: string; salesRepName: string; values: number[]; total: number }[];
  };
}
