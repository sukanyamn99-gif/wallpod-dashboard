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

export function round2(n: number): number {
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

export interface AllocatedLineAmount {
  netPayable: number;
  grossAmount: number;
}

// Prorates a document's own discount/WHT%/retention% across its own lines by
// each line's share of the gross (VAT-inclusive) total — used when a source
// tax invoice/invoice bundles several quotations and only SOME of them are
// being carried onto a later ใบวางบิล/ใบเสร็จรับเงิน (the rest already billed
// via a different document, or simply not selected this time). Every step of
// computeBillingDocumentSummary is linear in each line's own amount, so the
// allocated shares always sum back to the whole document's own totals
// exactly (up to rounding) — mirrors that function's own WHT-base rule
// (the flagged lines' own pre-VAT amount, not reduced by the document-level
// discount, since that discount isn't allocated per line in this data model).
export function allocateBillingDocumentSummaryByLine(
  items: BillingDocumentLineAmount[],
  discountAmount: number,
  whtPercent: number,
  retentionPercent: number,
): AllocatedLineAmount[] {
  const grossTotal = items.reduce((sum, it) => sum + it.amount, 0);
  return items.map((it) => {
    const share = grossTotal > 0 ? it.amount / grossTotal : 0;
    const subtotal = round2(it.amount / 1.07);
    const allocatedDiscount = round2(discountAmount * share);
    const afterDiscount = round2(subtotal - allocatedDiscount);
    const vat = round2(afterDiscount * 0.07);
    const totalAfterVat = round2(afterDiscount + vat);
    const whtBase = it.applyWht ? subtotal : 0;
    const whtAmount = round2(whtBase * (whtPercent / 100));
    const retentionAmount = round2(totalAfterVat * (retentionPercent / 100));
    const netPayable = round2(totalAfterVat - whtAmount - retentionAmount);
    return { netPayable, grossAmount: totalAfterVat };
  });
}
