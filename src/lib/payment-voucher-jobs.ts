import type { PaymentVoucher } from "@/lib/types";

// Every JOB a voucher's cost is attributed to, for list/print display. Falls
// back to the header's single jobNo for a voucher with no allocation rows.
export function voucherJobNos(v: Pick<PaymentVoucher, "jobNo" | "jobAllocations">): string[] {
  if (v.jobAllocations.length > 0) return v.jobAllocations.map((a) => a.jobNo);
  return v.jobNo ? [v.jobNo] : [];
}

// What a JOB's cost report counts for one allocation of a voucher: the
// pre-VAT amount when the voucher is flagged as VAT-inclusive (vat_included),
// otherwise the allocation as entered.
export function jobCostAmount(amount: number, vatIncluded: boolean): number {
  return vatIncluded ? Math.round((amount / 1.07) * 100) / 100 : amount;
}

// What is actually paid out on a voucher: the amount less the tax withheld
// (หัก ณ ที่จ่าย) and any social security taken off — the "จำนวนเงินจ่าย" on the
// printed voucher.
export function voucherNetPaid(v: Pick<PaymentVoucher, "amount" | "whtAmount" | "socialSecurityAmount">): number {
  return Math.round((v.amount - v.whtAmount - v.socialSecurityAmount) * 100) / 100;
}
