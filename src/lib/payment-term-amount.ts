// A quotation payment term's amount: the share of the grand total with the
// satang cut off (no rounding up or down), so equal percentages always give
// equal amounts — 50% of 17,517.51 is 8,758.75 for both terms. toPrecision
// first strips float noise (17,517.51 x 50% x 100 = 875875.4999...).
export function paymentTermAmount(total: number, percent: number): number {
  const scaled = Number((((total * percent) / 100) * 100).toPrecision(12));
  return Math.floor(scaled + 1e-9) / 100;
}

// Re-derives each saved term's amount from the quotation's total, so
// quotations saved before this rule read the same way as new ones.
export function withTermAmounts<T extends { percent: number; amount: number }>(terms: T[], total: number): T[] {
  return terms.map((t) => ({ ...t, amount: paymentTermAmount(total, Number(t.percent)) }));
}
