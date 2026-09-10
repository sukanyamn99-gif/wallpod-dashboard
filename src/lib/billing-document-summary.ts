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

// One bundled line's amount (VAT-inclusive, matching how every item amount
// is already stored app-wide) plus whether it counts toward the WHT base —
// staff can bundle several invoices/quotations into one document while
// withholding tax on only some of them (see billing_note_items.apply_wht).
export interface BillingDocumentLineAmount {
  amount: number;
  applyWht: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeBillingDocumentSummary(
  items: BillingDocumentLineAmount[],
  discountAmount: number,
  whtPercent: number,
  retentionPercent: number,
): BillingDocumentSummary {
  const subtotal = round2(items.reduce((sum, it) => sum + it.amount, 0) / 1.07);
  const afterDiscount = round2(subtotal - discountAmount);
  const vat = round2(afterDiscount * 0.07);
  const totalAfterVat = round2(afterDiscount + vat);
  // Discount isn't allocated per line in this data model, so the WHT base
  // is the flagged lines' own pre-VAT amounts, not further reduced by the
  // document-level discount — that discount already only ever applies to
  // small manual adjustments in practice.
  const whtBase = round2(items.filter((it) => it.applyWht).reduce((sum, it) => sum + it.amount, 0) / 1.07);
  const whtAmount = round2(whtBase * (whtPercent / 100));
  const retentionAmount = round2(totalAfterVat * (retentionPercent / 100));
  const netPayable = round2(totalAfterVat - whtAmount - retentionAmount);
  return { subtotal, discountAmount, afterDiscount, vat, totalAfterVat, whtAmount, retentionAmount, netPayable };
}
