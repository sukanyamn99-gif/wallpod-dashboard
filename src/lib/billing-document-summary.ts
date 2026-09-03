// Shared by the create form's live preview and the print view so the two
// never drift. WHT is computed on the pre-VAT, post-discount base; retention
// is computed on the VAT-inclusive total — verified against two real
// reference documents to reproduce every figure exactly.
export interface BillingDocumentSummary {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  vat: number;
  totalAfterVat: number;
  whtAmount: number;
  retentionAmount: number;
  netPayable: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeBillingDocumentSummary(
  itemAmounts: number[],
  discountAmount: number,
  whtPercent: number,
  retentionPercent: number,
): BillingDocumentSummary {
  const subtotal = round2(itemAmounts.reduce((sum, a) => sum + a, 0) / 1.07);
  const afterDiscount = round2(subtotal - discountAmount);
  const vat = round2(afterDiscount * 0.07);
  const totalAfterVat = round2(afterDiscount + vat);
  const whtAmount = round2(afterDiscount * (whtPercent / 100));
  const retentionAmount = round2(totalAfterVat * (retentionPercent / 100));
  const netPayable = round2(totalAfterVat - whtAmount - retentionAmount);
  return { subtotal, discountAmount, afterDiscount, vat, totalAfterVat, whtAmount, retentionAmount, netPayable };
}
