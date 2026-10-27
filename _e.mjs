import fs from "node:fs";
function edit(p, pairs){
  let s=fs.readFileSync(p,"utf-8"); const crlf=s.includes("\r\n"); s=s.replace(/\r\n/g,"\n");
  for(const [a,b] of pairs){ if(!s.includes(a)) throw new Error("missing in "+p+": "+a.slice(0,80)); s=s.replace(a,b); }
  if(crlf) s=s.replace(/\n/g,"\r\n"); fs.writeFileSync(p,s);
}
edit("src/app/dashboard/billing-documents/print-billing-document-view.tsx",[
[`  // Calculated round by round (see usesSplitRounds): the printed summary then
  // shows ONLY this installment — its own base, its own 7% VAT, its own WHT.`,`  // Calculated round by round (see usesSplitRounds): same printed layout as
  // before (whole total, หักมัดจำ, ยอดคงเหลือ), but the 7% VAT and the WHT
  // are worked out on this installment's own remainder, not as the whole
  // job's minus the deposit's.`],
[`              <td className="py-0.5 text-neutral-600">
                {isSplitInstallment
                  ? \`รวมเป็นเงิน (ส่วนที่เหลือหลังหักมัดจำ\${document.depositDeductionInvoiceNo ? \` \${document.depositDeductionInvoiceNo}\` : ""})\`
                  : "รวมเป็นเงิน"}
              </td>
              <td className="py-0.5 text-right">{formatTHB(isSplitInstallment ? (summary.installmentPreVat ?? 0) : summary.subtotal)}</td>`,`              <td className="py-0.5 text-neutral-600">รวมเป็นเงิน</td>
              <td className="py-0.5 text-right">{formatTHB(summary.subtotal)}</td>`],
[`            {summary.depositDeductionAmount > 0 && !isDepositTaxInvoice && !isSplitInstallment && (`,`            {summary.depositDeductionAmount > 0 && !isDepositTaxInvoice && (`],
[`            {summary.discountAmount > 0 && !isSplitInstallment && (`,`            {summary.discountAmount > 0 && (`],
[`            {isDepositTaxInvoice && !isSplitInstallment && (
              <>`,`            {isDepositTaxInvoice && (
              <>`]]);
// form
edit("src/app/dashboard/billing-documents/billing-document-form.tsx",[
[`          // A later installment is its own round: only this round's figures
          // are shown (the deposit already carried its own VAT/WHT).
          <div className="space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                รวมเป็นเงิน (ส่วนที่เหลือหลังหักมัดจำ{depositDeductionInvoiceNo && \` \${depositDeductionInvoiceNo}\`})
              </span>
              <span>{formatTHB(summary.installmentPreVat)}</span>
            </div>`,`          // A later installment is its own round: the whole total and the deposit
          // are shown, but VAT 7% and WHT are worked out on the remainder alone.
          <div className="space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">รวมเป็นเงิน</span>
              <span>{formatTHB(summary.afterDiscount)}</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>หักมัดจำ{depositDeductionInvoiceNo && \` (เลขที่ \${depositDeductionInvoiceNo})\`}</span>
              <span>{formatTHB(round2(summary.afterDiscount - summary.installmentPreVat))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ยอดคงเหลือหลังหักมัดจำ</span>
              <span>{formatTHB(summary.installmentPreVat)}</span>
            </div>`]]);
