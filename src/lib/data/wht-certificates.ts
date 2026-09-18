import { getPaymentVoucherById, getPaymentVouchers } from "@/lib/data/payment-vouchers";
import { getPettyCashTransactionById, getPettyCashTransactions } from "@/lib/data/petty-cash";
import type { PaymentVoucher, PettyCashTransaction, WhtCertificateRow, WhtCertificateSource } from "@/lib/types";

function fromVoucher(v: Omit<PaymentVoucher, "ledgerLines">): WhtCertificateRow {
  return {
    id: v.id,
    source: "payment_voucher",
    docNo: v.docNo,
    date: v.voucherDate,
    payeeName: v.payeeName,
    amount: v.amount,
    description: v.description,
    whtCertNo: v.whtCertNo,
    whtRate: v.whtRate,
    whtFormType: v.whtFormType,
    whtAmount: v.whtAmount,
    payeeTaxId: v.payeeTaxId,
    payeeAddress: v.payeeAddress,
    incomeType: v.incomeType,
    recordedByName: v.recordedByName,
  };
}

function fromPettyCash(t: PettyCashTransaction): WhtCertificateRow {
  return {
    id: t.id,
    source: "petty_cash",
    docNo: t.docNo,
    date: t.transactionDate,
    payeeName: t.billerName ?? "",
    // The official certificate's "จำนวนเงินที่จ่าย" is the pre-VAT base the
    // withholding tax was actually calculated on (matches whtAmount, which
    // the entry form already computes off the pre-VAT amount) — t.amount
    // itself is the VAT-inclusive total entered on the petty cash form, so
    // VAT is subtracted back out here. No separate pre-VAT column exists;
    // amount - vatAmount is exact since vatAmount was derived from the same
    // amount at entry time and both are stored to 2 decimals.
    amount: t.amount - t.vatAmount,
    description: t.description,
    whtCertNo: t.whtCertNo,
    whtRate: t.whtRate,
    whtFormType: t.whtFormType,
    whtAmount: t.whtAmount,
    payeeTaxId: t.payeeTaxId,
    payeeAddress: t.payeeAddress,
    incomeType: t.incomeType,
    recordedByName: t.recordedByName,
  };
}

// ใบหัก ณ ที่จ่าย is a filtered, merged view over two source tables —
// Payment Voucher and Petty Cash both record their own withholding-tax
// fields, so a certificate can originate from either one.
export async function getWhtCertificates(): Promise<WhtCertificateRow[]> {
  const [vouchers, pettyCash] = await Promise.all([getPaymentVouchers(), getPettyCashTransactions()]);
  const rows = [
    ...vouchers.filter((v) => v.whtAmount > 0).map(fromVoucher),
    ...pettyCash.filter((t) => t.whtAmount > 0).map(fromPettyCash),
  ];
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getWhtCertificateById(id: string, source: WhtCertificateSource): Promise<WhtCertificateRow | null> {
  if (source === "petty_cash") {
    const t = await getPettyCashTransactionById(id);
    return t ? fromPettyCash(t) : null;
  }
  const v = await getPaymentVoucherById(id);
  return v ? fromVoucher(v) : null;
}
