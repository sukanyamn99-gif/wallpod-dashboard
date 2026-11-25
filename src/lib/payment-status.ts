// A job's payment status is one of two fixed words that other parts of the app
// act on — "เก็บเงินเรียบร้อย" (commission and incentive count only these) and
// "รอชำระเงิน" (nothing received yet) — or "ชำระมาแล้ว N%" for anything in
// between, where N is whatever share has actually been paid (e.g. a 40% deposit).
export const PAID_IN_FULL = "เก็บเงินเรียบร้อย";
export const AWAITING_PAYMENT = "รอชำระเงิน";

const PARTIAL_PATTERN = /^ชำระมาแล้ว (\d{1,2}(?:\.\d{1,2})?)%$/;

// The percent inside a "ชำระมาแล้ว N%" status, or null for any other value
// (including 0% and 100%, which are the other two statuses).
export function parsePartialPercent(status: string | null | undefined): number | null {
  const match = PARTIAL_PATTERN.exec((status ?? "").trim());
  if (!match) return null;
  const percent = Number(match[1]);
  return percent > 0 && percent < 100 ? percent : null;
}

export function partialPaymentStatus(percent: number | string): string {
  return `ชำระมาแล้ว ${Number(percent)}%`;
}

export function isPaymentStatus(status: string | null | undefined): boolean {
  return status === PAID_IN_FULL || status === AWAITING_PAYMENT || parsePartialPercent(status) !== null;
}
