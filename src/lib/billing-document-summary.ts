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
  // What to print on the "หัก ณ ที่จ่าย" line/WHT certificate — the portion
  // of whtAmount withheld THIS round, net of whatever a bundled deposit
  // already withheld. Deliberately NOT used in netPayable (see below): the
  // deposit figure being subtracted is already net of its own WHT, so
  // netPayable must still subtract the FULL whtAmount to balance — reducing
  // both would credit the deposit's WHT twice. Equals whtAmount when there's
  // no depositWhtAmount.
  whtAmountThisRound: number;
  retentionAmount: number;
  depositDeductionAmount: number;
  // Satang rounding included in netPayable — the document's own stored
  // value (billing_notes.rounding_amount), 0 for anything issued before it
  // existed. See withSatangRounding for how a new document gets its value.
  roundingAmount: number;
  // Set only when the document is calculated round by round (splitRounds):
  // THIS installment's own pre-VAT base, VAT and total — VAT 7% worked out on
  // that base by itself, not as "whole job's VAT minus the deposit's".
  installmentPreVat: number | null;
  // Satang the remainder was nudged by so it matches the deposit's own pre-VAT
  // (0 when none) — not printed as a line of its own (staff asked for no
  // "ปัดเศษ" wording), so the printed lines can differ from the sum by it.
  installmentAdjustment: number;
  installmentVat: number | null;
  installmentTotal: number | null;
  netPayable: number;
}

// Documents created from this date on calculate a later installment's VAT and
// WHT round by round (see computeBillingDocumentSummary's splitRounds).
// Anything issued before keeps the whole-job calculation it was printed and
// billed with, so older amounts never move by a satang.
const SPLIT_ROUNDS_FROM = "2026-10-27";

// A document being created uses it; a saved one by its created_at (ISO).
// Only ใบแจ้งหนี้ / ใบกำกับภาษี: ใบวางบิล and ใบเสร็จรับเงิน collect on what was
// already billed and keep their own layout and arithmetic.
export function usesSplitRounds(createdAt: string | null | undefined, docType: string): boolean {
  if (docType !== "invoice" && docType !== "tax_invoice") return false;
  return !createdAt || createdAt.slice(0, 10) >= SPLIT_ROUNDS_FROM;
}

// One bundled line's amount (VAT-inclusive, matching how every item amount
// is already stored app-wide) plus whether it counts toward the WHT base —
// staff can bundle several invoices/quotations into one document while
// withholding tax on only some of them (see billing_note_items.apply_wht).
export interface BillingDocumentLineAmount {
  amount: number;
  applyWht: boolean;
}

// Half-up to the satang: a 3rd decimal of 5 or more rounds up (37,162.385 →
// 37,162.39). toPrecision(15) first strips float noise so an exact half like
// 1.005 (stored as 1.00499999…) isn't rounded down.
export function round2(n: number): number {
  const scaled = Number((Math.abs(n) * 100).toPrecision(15));
  return (Math.sign(n) * Math.round(scaled)) / 100;
}

export function computeBillingDocumentSummary(
  items: BillingDocumentLineAmount[],
  discountAmount: number,
  whtPercent: number,
  retentionPercent: number,
  depositDeductionAmount = 0,
  // WHT already withheld on the deposit(s) that depositDeductionAmount
  // bundles — e.g. a job billed 50% deposit then 50% final both carry the
  // same 3% WHT, so the deposit invoice already withheld half the job's
  // total WHT. Only affects whtAmountThisRound (the printed/certificate
  // figure) below, never whtAmount or netPayable — verified against a real
  // linked pair that crediting it into netPayable directly double-counts
  // the deposit's own WHT (depositDeductionAmount is already net of it).
  depositWhtAmount = 0,
  roundingAmount = 0,
  // A later installment (a deposit is being deducted) is its own round: its
  // base is what's left after the deposit's pre-VAT share, VAT 7% is
  // computed on that base by itself, WHT follows the same round, and the
  // satang-rounding hack is not needed because both rounds are now
  // calculated the same way (see usesSplitRounds).
  splitRounds = false,
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
  let whtAmount = round2(whtBase * (whtPercent / 100));
  let whtAmountThisRound = round2(Math.max(0, whtAmount - depositWhtAmount));
  // Two equal installments split an odd-satang total WHT a satang apart
  // (334.91 -> 167.45 withheld at the deposit, 167.46 now). Each installment
  // carries its own WHT certificate, so keep the two rounds identical: this
  // round repeats the deposit's figure and the document's total WHT becomes
  // their sum (334.90), which also keeps the printed lines adding up.
  if (depositWhtAmount > 0 && whtAmountThisRound !== depositWhtAmount && round2(Math.abs(whtAmountThisRound - depositWhtAmount)) <= 0.01) {
    whtAmountThisRound = depositWhtAmount;
    whtAmount = round2(depositWhtAmount + whtAmountThisRound);
  }
  const retentionAmount = round2(totalAfterVat * (retentionPercent / 100));
  let installmentPreVat: number | null = null;
  let installmentAdjustment = 0;
  let installmentVat: number | null = null;
  let installmentTotal: number | null = null;
  let netPayable = round2(totalAfterVat - whtAmount - retentionAmount - depositDeductionAmount + roundingAmount);
  let retention = retentionAmount;
  if (splitRounds && depositDeductionAmount > 0) {
    // The stored deposit is VAT-inclusive and net of its own WHT.
    const depositGross = round2(depositDeductionAmount + depositWhtAmount);
    const depositPreVat = round2(depositGross / 1.07);
    installmentPreVat = round2(afterDiscount - depositPreVat);
    // Two equal installments of an odd-satang total land a satang or two
    // apart (the deposit, quoted VAT-inclusive, rounds up; the remainder
    // takes what's left). The balance is billed at the same amount as the
    // deposit, the difference shown as ปัดเศษ.
    const gap = round2(depositPreVat - installmentPreVat);
    if (gap !== 0 && Math.abs(gap) <= 0.02) {
      installmentAdjustment = gap;
      installmentPreVat = depositPreVat;
    }
    installmentVat = round2(installmentPreVat * 0.07);
    installmentTotal = round2(installmentPreVat + installmentVat);
    retention = round2(installmentTotal * (retentionPercent / 100));
    // A round-by-round document ignores any stored satang rounding (written
    // by the earlier whole-job rounding) — its own rounding is the line above.
    netPayable = round2(installmentTotal - whtAmountThisRound - retention);
  }
  return {
    subtotal,
    discountAmount,
    afterDiscount,
    vat,
    totalAfterVat,
    whtAmount,
    whtAmountThisRound,
    retentionAmount: retention,
    depositDeductionAmount,
    roundingAmount: installmentTotal !== null ? 0 : roundingAmount,
    installmentPreVat,
    installmentAdjustment,
    installmentVat,
    installmentTotal,
    netPayable,
  };
}

// A balance billed after a deposit lands on stray satang — the deposit itself
// was rounded half-up from an odd-satang half of the job total, so the
// remainder is often 1 satang off the figure staff expect. For a document
// being created/edited (the form's live preview, which is also what gets
// saved), round the net to the nearest 5 satang and show the difference as
// its own "ปัดเศษ" line so the printed arithmetic still adds up. Only when a
// deposit is deducted. Stored with the document — never recomputed on read,
// so older documents are untouched.
export function withSatangRounding(summary: BillingDocumentSummary): BillingDocumentSummary {
  // A round-by-round document needs no rounding hack (see splitRounds).
  if (summary.depositDeductionAmount <= 0 || summary.installmentTotal !== null) return summary;
  const exact = round2(summary.netPayable - summary.roundingAmount);
  const rounding = round2(Math.round(exact * 20) / 20 - exact);
  return { ...summary, roundingAmount: rounding, netPayable: round2(exact + rounding) };
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
