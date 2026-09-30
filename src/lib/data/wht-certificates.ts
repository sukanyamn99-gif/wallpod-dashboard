import { getPaymentVoucherById, getPaymentVouchers } from "@/lib/data/payment-vouchers";
import { getPettyCashTransactionById, getPettyCashTransactions } from "@/lib/data/petty-cash";
import type { PaymentVoucher, PettyCashTransaction, WhtCertificateRow, WhtCertificateSource } from "@/lib/types";

function fromVoucher(v: Omit<PaymentVoucher, "ledgerLines">): WhtCertificateRow {
  return {
    id: v.id,
    source: "payment_voucher",
    docNo: v.docNo,
    // The certificate's own "date paid" — the voucher itself is often dated
    // earlier than the money actually goes out (e.g. prepared on the 24th,
    // transferred on the 30th), so bankTransferDate is the truer date when
    // it's on file; voucherDate is only a fallback for vouchers with no
    // recorded transfer date (e.g. paid in cash).
    date: v.bankTransferDate || v.voucherDate,
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
    // withholding tax was actually calculated on. t.amount is the cash that
    // left the fund, which can be net of WHT (bill paid after deduction), so
    // the stored base is used; rows saved before that column existed were
    // always entered as the VAT-inclusive total, where amount - vat is exact.
    amount: t.preVatAmount ?? t.amount - t.vatAmount,
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
