import { differenceInDays } from "date-fns";
import { getGoodsReceiptsForPayables, type GoodsReceiptForPayables } from "@/lib/data/goods-receipts";

export interface PayableRow extends GoodsReceiptForPayables {
  ageDays: number;
}

export interface PayablesDashboardData {
  kpis: {
    totalOutstanding: number;
    unpaidCount: number;
    supplierCount: number;
    oldestAgeDays: number;
  };
  bySupplier: { supplierName: string; amount: number; count: number }[];
  list: PayableRow[];
}

export async function getPayablesDashboardData(): Promise<PayablesDashboardData> {
  const receipts = await getGoodsReceiptsForPayables();
  const now = new Date();

  const unpaid: PayableRow[] = receipts
    .filter((r) => r.paymentStatus === "ยังไม่จ่าย")
    .map((r) => ({ ...r, ageDays: differenceInDays(now, new Date(r.createdAt)) }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const totalOutstanding = unpaid.reduce((sum, r) => sum + r.totalAmount, 0);
  const unpaidCount = unpaid.length;
  const supplierNames = Array.from(new Set(unpaid.map((r) => r.supplierName ?? "ไม่ระบุผู้จำหน่าย")));
  const oldestAgeDays = unpaidCount > 0 ? Math.max(...unpaid.map((r) => r.ageDays)) : 0;

  const bySupplier = supplierNames
    .map((supplierName) => {
      const inSupplier = unpaid.filter((r) => (r.supplierName ?? "ไม่ระบุผู้จำหน่าย") === supplierName);
      return {
        supplierName,
        amount: inSupplier.reduce((sum, r) => sum + r.totalAmount, 0),
        count: inSupplier.length,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    kpis: { totalOutstanding, unpaidCount, supplierCount: supplierNames.length, oldestAgeDays },
    bySupplier,
    list: unpaid,
  };
}
