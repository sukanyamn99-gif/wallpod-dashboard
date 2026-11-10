import type { BillingDocument, PrimaryBankAccount, ReceiptVoucherLedgerLine } from "@/lib/types";

// Default chart-of-accounts codes, taken from the receipt vouchers the office already
// issues: money lands in the bank account (11121.01) against the "ใบเสร็จรอเรียกเก็บ"
// clearing account (11319). Both stay editable on the form.
const BANK_ACCOUNT_CODE = "11121.01";
const RECEIPT_CLEARING_CODE = "11319";
const RECEIPT_CLEARING_NAME = "ใบเสร็จรอเรียกเก็บ";

// The "ช่องทางรับเงิน" row and the ledger of a receipt voucher, worked out from the
// ใบเสร็จรับเงิน it is issued for: the receipt's own bank / date when it recorded one,
// the company account number from the primary bank account, and a debit-the-bank /
// credit-the-clearing-account pair for the amount received.
export function paymentDefaultsFromReceipt(
  receipt: Pick<BillingDocument, "paymentMethod" | "bankName" | "paymentDate">,
  bank: PrimaryBankAccount | null,
  amount: number,
): { bankName: string | null; bankAccountNo: string | null; payDate: string | null; ledgerLines: ReceiptVoucherLedgerLine[] } {
  const isCash = receipt.paymentMethod === "เงินสด";
  const bankName = receipt.bankName ?? bank?.bankName ?? null;
  // The primary account's number only belongs to the receipt's bank when it is that bank (or none was recorded).
  const sameAsPrimary = !receipt.bankName || receipt.bankName === bank?.bankName;
  return {
    bankName,
    bankAccountNo: sameAsPrimary ? (bank?.accountNo ?? null) : null,
    payDate: receipt.paymentDate,
    ledgerLines: [
      {
        accountCode: isCash ? null : BANK_ACCOUNT_CODE,
        description: isCash ? "เงินสด" : bank ? `${bank.bankName} ${bank.accountNo.replace(/\D/g, "")}` : null,
        debit: amount,
        credit: 0,
      },
      { accountCode: RECEIPT_CLEARING_CODE, description: RECEIPT_CLEARING_NAME, debit: 0, credit: amount },
    ],
  };
}
