import type { PaymentVoucher } from "@/lib/types";

// Every JOB a voucher's cost is attributed to, for list/print display. Falls
// back to the header's single jobNo for a voucher with no allocation rows.
export function voucherJobNos(v: Pick<PaymentVoucher, "jobNo" | "jobAllocations">): string[] {
  if (v.jobAllocations.length > 0) return v.jobAllocations.map((a) => a.jobNo);
  return v.jobNo ? [v.jobNo] : [];
}
