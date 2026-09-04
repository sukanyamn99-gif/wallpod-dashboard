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

// Was a fixed union; now a managed list (see product_categories table /
// getProductCategories()), so this stays a plain string alias to avoid
// touching every existing ProductCategory-typed field across the app.
export type ProductCategory = string;

export type PaymentStatus = "เก็บเงินเรียบร้อย" | "ชำระมาแล้ว 50%" | "รอชำระเงิน";

// "เก็บเงินงวดสุดท้าย" was removed from selectable options (still allowed by
// the DB check constraint so the handful of existing jobs already carrying
// it aren't broken — see the fallback rendering in project-sale-form.tsx).
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
  | "จบงาน";

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

export const ROLE_LABELS: Record<Role, string> = {
  owner: "เจ้าของกิจการ",
  manager: "ผู้จัดการ",
  sales: "Sales",
  design: "Designer",
  support_sale: "ทีม Support",
  account: "ธุรการบัญชี",
  foreman: "หัวหน้าช่าง",
  production: "ฝ่ายผลิต",
};

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  sales_rep_id: string | null;
  department: string | null;
  active: boolean;
}

export interface LoginLogEntry {
  id: string;
  profileId: string | null;
  fullNameSnapshot: string;
  email: string | null;
  loggedInAt: string;
}

export interface ActivityLogEntry {
  id: string;
  actorId: string | null;
  actorNameSnapshot: string;
  action: string;
  entityLabel: string | null;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string | null;
  role: Role;
  department: string | null;
  active: boolean;
  createdAt: string;
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
  contactPerson: string | null;
  address: string | null;
  phone: string | null;
  taxId: string | null;
  customerCode: string | null;
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
  // null = no payment recorded yet (never "closed"); 0 = fully collected
  // (last installment's receipt filled in) — same outstanding_amount value
  // already stored per installment by project-sales' save logic.
  outstanding: number | null;
  items: { category: ProductCategory; amount: number }[];
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
  balanceBefore: number | null;
  balanceAfter: number | null;
  referenceNo: string | null;
  productSku: string | null;
  productName: string;
  unit: string;
}

export interface StockProductLot {
  id: string;
  stockProductId: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  referenceNo: string | null;
  receivedAt: string;
  note: string | null;
}

// A fully separate system from StockProduct (raw materials) — finished
// goods produced from a JOB, received in freely (quantity + cost typed
// directly, not derived from raw-material requisitions), and withdrawn
// automatically when a ใบกำกับภาษี (tax invoice) is issued.
export interface FinishedGood {
  id: string;
  // Auto-generated on create (KW0001, KW0002, ...) — never user-typed,
  // unlike StockProduct.sku which stays manual.
  sku: string;
  jobNo: string | null;
  name: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
  quantityOnHand: number;
  unitCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinishedGoodMovement {
  id: string;
  finishedGoodId: string;
  movementType: "in" | "out";
  quantity: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  referenceNo: string | null;
  note: string | null;
  createdAt: string;
}

export interface DeadStockItem extends StockProduct {
  lastActivityAt: string;
  neverMoved: boolean;
  daysIdle: number;
}

export interface StockDashboardData {
  skuCount: number;
  totalStockValue: number;
  lowStockCount: number;
  categoryBreakdown: { category: string; value: number; count: number }[];
  lowStockItems: StockProduct[];
  deadStockCount: number;
  deadStockValue: number;
  deadStockItems: DeadStockItem[];
}

export interface SalesDashboardData {
  totalPipelineValue: number;
  totalProjectsCount: number;
  closedProjectsCount: number;
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

export interface Department {
  id: string;
  name: string;
  createdAt: string;
}

export type RequisitionPurpose = "production" | "sample";

export const REQUISITION_PURPOSE_LABELS: Record<RequisitionPurpose, string> = {
  production: "เบิกเพื่อผลิต",
  sample: "เบิกทำตัวอย่าง",
};

export interface StockRequisitionItem {
  id: string;
  stockProductId: string | null;
  productName: string;
  productSku: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  // True when unitCost is a live fallback (the product's current cost)
  // rather than the real snapshot taken at withdrawal time — requisitions
  // submitted before that snapshot existed (migration_038).
  isEstimatedCost: boolean;
}

export interface StockRequisition {
  id: string;
  docNo: string;
  departmentId: string | null;
  departmentName: string | null;
  requestedById: string | null;
  requestedByName: string;
  jobNo: string | null;
  projectName: string | null;
  purpose: RequisitionPurpose;
  customerName: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  items: StockRequisitionItem[];
}

export interface Supplier {
  id: string;
  name: string;
  address: string | null;
  taxId: string | null;
  branch: string | null;
  createdAt: string;
}

export interface GoodsReceiptItem {
  id: string;
  stockProductId: string | null;
  productName: string;
  productSku: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
}

export type GoodsReceiptPaymentStatus = "จ่ายแล้ว" | "ยังไม่จ่าย";

export interface GoodsReceipt {
  id: string;
  docNo: string;
  supplierId: string | null;
  supplierName: string | null;
  receivedById: string | null;
  receivedByName: string;
  referenceNo: string | null;
  note: string | null;
  createdAt: string;
  paymentStatus: GoodsReceiptPaymentStatus;
  paidDate: string | null;
  items: GoodsReceiptItem[];
}

export type WhtFormType = "ภ.ง.ด.1" | "ภ.ง.ด.2" | "ภ.ง.ด.3" | "ภ.ง.ด.53";

export interface PaymentVoucherLedgerLine {
  id: string;
  accountCode: string | null;
  description: string | null;
  debit: number;
  credit: number;
}

export interface PaymentVoucher {
  id: string;
  docNo: string;
  voucherDate: string;
  payeeName: string;
  category: string | null;
  amount: number;
  paymentMethod: string | null;
  referenceNo: string | null;
  note: string | null;
  recordedById: string | null;
  recordedByName: string;
  createdAt: string;
  whtCertNo: string | null;
  description: string | null;
  whtRate: number | null;
  whtFormType: WhtFormType | null;
  whtAmount: number;
  bankName: string | null;
  bankAccountNo: string | null;
  bankTransferDate: string | null;
  jobNo: string | null;
  ledgerLines: PaymentVoucherLedgerLine[];
}

export type PettyCashTransactionType = "topup" | "expense";

export interface PettyCashTransaction {
  id: string;
  docNo: string;
  transactionDate: string;
  transactionType: PettyCashTransactionType;
  amount: number;
  description: string;
  balanceAfter: number;
  recordedById: string | null;
  recordedByName: string;
  createdAt: string;
  category: string | null;
  billerName: string | null;
  jobNo: string | null;
  vatAmount: number;
  whtAmount: number;
}

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  idCardNo: string | null;
  startDate: string | null;
  active: boolean;
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeePosition: string | null;
  employeeIdCardNo: string | null;
  employeeStartDate: string | null;
  payPeriod: string;
  payDate: string | null;
  baseSalary: number;
  fuelAllowance: number;
  commission: number;
  incentive: number;
  socialSecurity: number;
  withholdingTax: number;
  otherDeductions: number;
  totalIncome: number;
  totalDeductions: number;
  netSalary: number;
  note: string | null;
  preparedByName: string | null;
  createdAt: string;
}

export interface PayrollYtdSummary {
  cumulativeIncome: number;
  cumulativeTax: number;
  cumulativeSocialSecurity: number;
  cumulativeOtherDeductions: number;
}

export interface CommissionRateTier {
  id: string;
  discountPercent: number;
  commissionRatePercent: number;
}

// One fully-collected WALLPOD Project Sales job, auto-pulled (job_no,
// customer, sales rep, amount, invoice/receipt no, received date all read
// live from projects/payments) with commission fields either from an
// existing commission_entries row or defaulted to 0/unsaved.
export interface CommissionableProject {
  projectId: string;
  jobNo: string | null;
  projectName: string;
  customerName: string;
  salesRepName: string;
  projectDate: string;
  preVat: number;
  total: number;
  invoiceNo: string | null;
  receiptNo: string | null;
  receivedDate: string;
  discountPercent: number;
  commissionRatePercent: number;
  commissionAmount: number;
  hasCommissionEntry: boolean;
}

export type QuotationStatus = "รอตอบรับ" | "ลูกค้าตอบตกลง" | "ปฏิเสธ";

export interface QuotationPaymentTerm {
  label: string;
  percent: number;
  amount: number;
}

export interface QuotationItem {
  id: string;
  sortOrder: number;
  productCode: string | null;
  productName: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
  imagePath: string | null;
  unitPrice: number;
  discountPercent: number;
  netPrice: number;
  qty: number;
  unit: string;
  totalPrice: number;
}

export interface Quotation {
  id: string;
  docNo: string;
  quoteDate: string;
  projectName: string;
  attn: string | null;
  customerName: string;
  customerAddress: string | null;
  customerTel: string | null;
  customerTaxId: string | null;
  jobNumber: string | null;
  poNumber: string | null;
  deliveryDate: string | null;
  priceValidity: string | null;
  remark: string | null;
  paymentTerms: QuotationPaymentTerm[];
  preVat: number;
  vat: number;
  total: number;
  salesRepId: string | null;
  salesRepName: string | null;
  status: QuotationStatus;
  convertedProjectId: string | null;
  createdAt: string;
}

export interface QuotationDetail extends Quotation {
  items: QuotationItem[];
}

export type BillingDocumentType = "invoice" | "billing_note" | "tax_invoice" | "receipt";

export const BILLING_DOCUMENT_LABELS: Record<BillingDocumentType, string> = {
  invoice: "ใบแจ้งหนี้",
  billing_note: "ใบวางบิล",
  tax_invoice: "ใบกำกับภาษี",
  receipt: "ใบเสร็จรับเงิน",
};

export const BILLING_DOCUMENT_LIST_PATH: Record<BillingDocumentType, string> = {
  invoice: "/dashboard/billing-documents/invoice",
  billing_note: "/dashboard/billing-documents/billing-note",
  tax_invoice: "/dashboard/billing-documents/tax-invoice",
  receipt: "/dashboard/billing-documents/receipt",
};

// A payment installment eligible to be bundled into a billing document —
// already invoiced (invoice_no set) and not yet fully received.
export interface UnbilledInvoice {
  paymentId: string;
  jobNo: string | null;
  projectName: string;
  invoiceNo: string;
  invoiceDate: string | null;
  amount: number;
}

// An accepted quotation not yet recorded as a WALLPOD Project Sales job
// (converted_project_id is null) — eligible to be billed directly, ahead
// of the formal invoice, when a customer has no open invoice on file yet.
export interface BillableQuotation {
  id: string;
  docNo: string;
  quoteDate: string;
  projectName: string;
  total: number;
}

// A ใบกำกับภาษี, quotation-sourced, not yet referenced by any ใบวางบิล —
// eligible to be billed directly. ใบวางบิล is created from this instead of
// from the quotation itself once a tax invoice exists for it (see
// getBillableTaxInvoicesForCustomer) — the item still records
// `quotationId` under the hood (same insert path as billing straight from
// a quotation), which is what lets the print view's existing
// tax-invoice-reference lookup resolve it correctly.
export interface BillableTaxInvoice {
  id: string;
  docNo: string;
  docDate: string;
  quotationId: string;
  netPayable: number;
}

// Descriptive product/service detail pulled from the quotation behind an
// invoice — used only to itemize a ใบกำกับภาษี (tax invoice), not to
// recompute any amount: the invoice's own `amount` above stays the figure
// VAT/summary math is based on, since it may not equal the full quotation
// total (e.g. a deposit installment).
export interface QuotationItemDetail {
  productCode: string | null;
  // Kept as separate fields (not a pre-joined description string) so the
  // itemized print table can give each one its own column.
  productName: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface BillingDocumentItem {
  id: string;
  paymentId: string | null;
  invoiceNo: string;
  invoiceDate: string | null;
  amount: number;
  // Set instead of paymentId when this line was billed directly from an
  // accepted-but-not-yet-converted quotation (see BillableQuotation) rather
  // than an existing invoiced payment.
  quotationId?: string | null;
  // Populated only for doc_type "tax_invoice" — either the quotation this
  // line was billed from directly (quotationId set), or one found by
  // matching the invoice's project JOB NO. against a quotation's own
  // job_number. null = no matching quotation found; undefined = not
  // attempted (other doc types).
  quotationDocNo?: string | null;
  quotationItems?: QuotationItemDetail[] | null;
  // A third source, alongside paymentId/quotationId: typed directly into
  // the document with no underlying invoice or quotation (e.g. a one-off
  // charge). Set together — all four or none.
  manualDescription?: string | null;
  manualQty?: number | null;
  manualUnit?: string | null;
  manualUnitPrice?: number | null;
  // ใบวางบิล only: when this line was billed from a quotation and a
  // ใบกำกับภาษี has since been issued for that same quotation, its doc
  // no./date — printed instead of the quotation's own, since the tax
  // invoice is the document actually being collected on.
  taxInvoiceDocNo?: string | null;
  taxInvoiceDocDate?: string | null;
}

export interface BillingDocument {
  id: string;
  docNo: string;
  docType: BillingDocumentType;
  customerId: string;
  customerName: string;
  customerAddress: string | null;
  customerTaxId: string | null;
  customerPhone: string | null;
  docDate: string;
  creditDays: number;
  dueDate: string;
  salesRepId: string | null;
  salesRepName: string | null;
  discountAmount: number;
  whtPercent: number;
  retentionPercent: number;
  note: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface BillingDocumentDetail extends BillingDocument {
  items: BillingDocumentItem[];
}
