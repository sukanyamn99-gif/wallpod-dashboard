export type CustomerType =
  | "Owner"
  | "Designer"
  | "Turnkey"
  | "Contractor"
  | "Corporate"
  | "Dealer"
  | "School";

export type StagePercent = 10 | 30 | 50 | 100;

export const STAGE_LABELS: Record<StagePercent, string> = {
  10: "นำเสนอ",
  30: "ใบเสนอราคา",
  50: "เจรจาต่อรอง",
  100: "ปิดการขาย",
};

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
  pre_vat: number;
  vat: number;
  total: number;
}

export interface Visit {
  id: string;
  sales_rep_id: string;
  sales_rep_name: string;
  customer_id: string | null;
  customer_name: string | null;
  project_id: string | null;
  visit_date: string;
  note: string | null;
}

export interface SalesDashboardData {
  totalPipelineValue: number;
  openProjectsCount: number;
  todayVisitsCount: number;
  closedThisMonthValue: number;
  pipelineByStage: { stage: StagePercent; label: string; value: number; count: number }[];
  customerTypeBreakdown: { type: CustomerType; value: number; count: number }[];
  salesRepPerformance: { salesRepId: string; salesRepName: string; totalValue: number; closedValue: number; projectCount: number }[];
}
