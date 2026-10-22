// The cost columns on the Project Sales report (ค่าวัสดุ, ค่ากาว, ...) are
// each the sum of what was keyed by hand on the JOB plus everything pulled in
// automatically from ใบเบิก / Payment Voucher / เงินสดย่อย tagged with the
// JOB — this file decides which column each pulled-in document lands in.
export type CostBucket = "material" | "glue" | "cutting" | "install" | "parking" | "shipping" | "other";

export const COST_BUCKET_LABELS: Record<CostBucket, string> = {
  material: "ค่าวัสดุ",
  glue: "ค่ากาว",
  cutting: "ค่าตัด",
  install: "ค่าติดตั้งผู้รับเหมา",
  parking: "ค่าเดินทาง+ค่าที่จอดรถ",
  shipping: "ค่าขนส่ง",
  other: "อื่นๆ (ไม่ลงช่อง นับเฉพาะในรวมต้นทุน)",
};

export const COST_BUCKET_ORDER: CostBucket[] = ["material", "glue", "cutting", "install", "parking", "shipping", "other"];

export type CostEntrySource = "manual" | "requisition" | "voucher" | "pettyCash";

export const COST_SOURCE_LABELS: Record<CostEntrySource, string> = {
  manual: "คีย์เอง (หน้าแก้ไข Project Sales)",
  requisition: "ใบเบิก",
  voucher: "Payment Voucher",
  pettyCash: "เงินสดย่อย",
};

export interface CostEntry {
  source: CostEntrySource;
  docNo: string | null;
  // The category/description the bucket was decided from, shown so staff can
  // see WHY an amount landed where it did.
  detail: string | null;
  amount: number;
}

// Stock requisitions are always material. PV / petty-cash categories are
// free text (a suggestion list, not a locked set), so match by keyword, in
// this order — "ค่าขนส่งสินค้า" contains both "ขนส่ง" and "สินค้า" and must
// land in shipping, not material.
export function bucketForCategory(category: string | null | undefined): CostBucket {
  const c = (category ?? "").trim();
  if (!c) return "other";
  if (c.includes("ขนส่ง")) return "shipping";
  if (c.includes("กาว")) return "glue";
  if (c.includes("ตัด")) return "cutting";
  if (c.includes("เดินทาง") || c.includes("จอดรถ") || c.includes("ที่จอด")) return "parking";
  if (c.includes("บริการ") || c.includes("ค่าจ้าง") || c.includes("ติดตั้ง")) return "install";
  if (c.includes("สินค้า") || c.includes("วัสดุ")) return "material";
  return "other";
}

// What each source offers in its "ประเภทต้นทุน" picker.
export const REQUISITION_COST_BUCKETS: CostBucket[] = ["material", "glue"];
export const VOUCHER_COST_BUCKETS: CostBucket[] = ["material", "cutting", "install", "shipping", "parking", "other"];

// Short label for a picker option ("other" is spelled out at length elsewhere).
export function costBucketOptionLabel(bucket: CostBucket): string {
  return bucket === "other" ? "อื่นๆ" : COST_BUCKET_LABELS[bucket];
}

export function isCostBucket(value: unknown): value is CostBucket {
  return typeof value === "string" && (COST_BUCKET_ORDER as string[]).includes(value);
}
