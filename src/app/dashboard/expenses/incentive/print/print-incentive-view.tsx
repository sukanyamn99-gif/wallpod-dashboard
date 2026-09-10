"use client";

import { Fragment } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import type { IncentiveReport } from "@/lib/types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function monthLabel(month: number, year: number): string {
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

function shortDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() + 543).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function num(value: number | null): string {
  if (value == null) return "-";
  return value ? formatTHB(value) : "-";
}

function pct(value: number | null): string {
  return value == null ? "-" : `${value.toFixed(2)}%`;
}

const th = "border-r border-b border-black p-1 font-medium break-words bg-[#c8d7d6]";
const td = "border-r border-b border-black p-1 whitespace-nowrap";
const tdWrap = "border-r border-b border-black p-1 break-words";

const SALES_THRESHOLD_FOR_PAYOUT = 800_000;

export function PrintIncentiveView({ report, names }: { report: IncentiveReport; names: string[] }) {
  const router = useRouter();
  const { month, year, rows, totals, eligible, totalSales, allCollected } = report;
  const sharePerPerson =
    eligible && names.length > 0 ? Math.round((totals.incentiveAmount / names.length) * 100) / 100 : 0;
  const supportPoolAssigned = sharePerPerson * names.length;
  const incentivePercentOfSales = totals.preVat ? (totals.incentiveAmount / totals.preVat) * 100 : 0;

  return (
    <div>
      <style>{`
        @media print { @page { size: landscape; } }
        table { page-break-inside: auto; }
        thead { display: table-header-group; }
        tbody tr { page-break-inside: avoid; break-inside: avoid; }
      `}</style>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="mx-auto max-w-[1400px] bg-white p-6 text-black print:p-0">
        <div className="text-[9px] leading-tight">
          <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-6 w-auto" priority />
          <p className="mt-2 font-medium">บริษัท คูนเว จำกัด</p>
          <p className="font-medium">ค่าคอมมิชชั่นทีม (7.5%จากกำไรสุทธิ)</p>
          <p className="font-medium">ประจำเดือน {monthLabel(month, year)}</p>

          <table className="mt-3 w-full table-fixed border-collapse border-t border-l border-black text-center">
            <colgroup>
              <col className="w-[2%]" />
              <col className="w-[4%]" />
              <col className="w-[5%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[5%]" />
              <col className="w-[4%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={th} rowSpan={2}>ลำดับ</th>
                <th className={th} rowSpan={2}>วันที่</th>
                <th className={th} rowSpan={2}>เลขที่ Job</th>
                <th className={th} rowSpan={2}>ชื่องาน/บริษัท</th>
                <th className={th} rowSpan={2}>ชื่อโปรเจค</th>
                <th className={th} rowSpan={2}>พนักงานขาย</th>
                <th className={th} rowSpan={2}>จำนวนเงิน</th>
                <th className={th} rowSpan={2}>รวมต้นทุน</th>
                <th className={th} rowSpan={2}>กำไร</th>
                <th className={th} rowSpan={2}>กำไร%</th>
                <th className={th} colSpan={5}>รายการ</th>
                <th className={th} rowSpan={2}>กำไรขั้นต้น
                  <br />Koonway 70%</th>
                <th className={th} rowSpan={2}>ค่าคอมบริษัท
                  <br />15%</th>
                <th className={th} rowSpan={2}>ค่า Incentive
                  <br />5%</th>
              </tr>
              <tr>
                <th className={th}>งวดที่</th>
                <th className={th}>จำนวนเงิน +VAT</th>
                <th className={th}>เลขที่ใบกำกับ IV</th>
                <th className={th}>วันที่ชำระ</th>
                <th className={th}>เลขที่ใบรับเงิน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const installmentRows = r.installments.length > 0 ? r.installments : [null];
                return (
                  <Fragment key={r.projectId}>
                    {installmentRows.map((it, j) => (
                      <tr key={j}>
                        {j === 0 && (
                          <>
                            <td className={td} rowSpan={installmentRows.length}>{i + 1}</td>
                            <td className={td} rowSpan={installmentRows.length}>{shortDate(r.projectDate)}</td>
                            <td className={td} rowSpan={installmentRows.length}>{r.jobNo ?? "-"}</td>
                            <td className={tdWrap + " text-left"} rowSpan={installmentRows.length}>{r.customerName}</td>
                            <td className={tdWrap + " text-left"} rowSpan={installmentRows.length}>{r.projectName}</td>
                            <td className={tdWrap} rowSpan={installmentRows.length}>{r.salesRepName}</td>
                            <td className={td} rowSpan={installmentRows.length}>{num(r.preVat)}</td>
                            <td className={td} rowSpan={installmentRows.length}>{num(r.totalCost)}</td>
                            <td className={td} rowSpan={installmentRows.length}>{num(r.profit)}</td>
                            <td className={td} rowSpan={installmentRows.length}>{pct(r.profitPercent)}</td>
                          </>
                        )}
                        {it ? (
                          <>
                            <td className={td}>
                              {it.label} {it.percentOfTotal}%
                            </td>
                            <td className={td}>{num(it.amountWithVat)}</td>
                            <td className={tdWrap}>{it.invoiceNo ?? "-"}</td>
                            <td className={td}>{shortDate(it.paidDate)}</td>
                            <td className={td}>{it.receiptNo ?? "-"}</td>
                          </>
                        ) : (
                          <td className={td} colSpan={5}>-</td>
                        )}
                        {j === 0 && (
                          <>
                            <td className={td} rowSpan={installmentRows.length}>{num(r.koonwayShare)}</td>
                            <td className={td} rowSpan={installmentRows.length}>{num(r.companyCommission)}</td>
                            <td className={td} rowSpan={installmentRows.length}>{num(r.incentiveAmount)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              <tr style={{ backgroundColor: "#fff9c4" }}>
                <td className={td} colSpan={6}></td>
                <td className={td + " font-medium"}>{num(totals.preVat)}</td>
                <td className={td + " font-medium"}>{num(totals.totalCost)}</td>
                <td className={td + " font-medium"}>{num(totals.profit)}</td>
                <td className={td + " font-medium"}>{pct(totals.profitPercent)}</td>
                <td className={td}></td>
                <td className={td + " font-medium"}>{num(totals.amountWithVat)}</td>
                <td className={td} colSpan={3}></td>
                <td className={td + " font-medium"}>{num(totals.koonwayShare)}</td>
                <td className={td + " font-medium"}>{num(totals.companyCommission)}</td>
                <td className={td + " font-medium"}>{num(totals.incentiveAmount)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-right text-[15px] font-medium text-red-600">
            % ค่า Incentive ต่อยอดขาย {incentivePercentOfSales.toFixed(2)}%
          </p>

          <div className="mt-16 flex items-baseline justify-end gap-2">
            <span className="w-56 border-b border-dotted border-black" />
            <span className="w-20 whitespace-nowrap">ผู้จัดทำ</span>
          </div>
        </div>
      </div>

      {/* Support-team incentive split — separate page/section, matching the
          reference report's own layout (main table, then this summary). */}
      <div className="mx-auto max-w-[1400px] break-before-page bg-white p-6 text-black print:p-0">
        <div className="text-[11px] leading-tight">
          <p className="font-medium">บริษัท คูนเว จำกัด</p>
          <p className="font-medium">ค่าคอมมิชชั่นทีม Support</p>
          <p className="mb-4 font-medium">ประจำเดือน {monthLabel(month, year)}</p>

          <div className="grid max-w-xl grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-2">
            <span>สรุปยอดขาย ประจำเดือน {monthLabel(month, year)}</span>
            <span>ยอดขายทั้งสิ้น</span>
            <span className="font-medium">{formatTHB(totals.preVat)} บาท</span>

            <span>สรุปค่าคอมมิชชั่นทีม Support</span>
            <span>จำนวนเงิน</span>
            <span className="font-medium">{formatTHB(totals.incentiveAmount)} บาท</span>

            {!eligible && (
              <p className="col-span-3 mt-2 rounded border border-red-300 bg-red-50 p-2 text-red-700">
                เดือนนี้ยังไม่เข้าเงื่อนไขจ่ายค่า Incentive — ต้องมียอดขายครบ {formatTHB(SALES_THRESHOLD_FOR_PAYOUT)} บาท
                และเก็บเงินครบทุกงาน (ยอดขายเดือนนี้ {formatTHB(totalSales)} บาท,{" "}
                {allCollected ? "เก็บเงินครบทุกงานแล้ว" : "ยังมีงานที่ยังไม่เก็บเงินครบ"})
              </p>
            )}
            {eligible && names.length === 0 && (
              <p className="col-span-3 mt-2 text-muted-foreground">
                ยังไม่ได้กรอกชื่อผู้รับค่า Incentive — กลับไปกรอกชื่อที่หน้าคำนวณ Incentive ก่อนพิมพ์รายงาน
              </p>
            )}
            {eligible &&
              names.map((name, i) => (
                <Fragment key={i}>
                  <span className="col-start-2">
                    {i + 1}. คุณ{name}
                  </span>
                  <span className="font-medium">{formatTHB(sharePerPerson)} บาท</span>
                </Fragment>
              ))}

            {eligible && names.length > 0 && (
              <>
                <span />
                <span className="col-start-2 border-t border-black pt-1">รวม</span>
                <span className="border-t border-black pt-1 font-medium">{formatTHB(supportPoolAssigned)} บาท</span>
              </>
            )}
          </div>

          <div className="mt-16 flex items-baseline justify-end gap-2">
            <span className="w-56 border-b border-dotted border-black" />
            <span className="w-20 whitespace-nowrap">ผู้อนุมัติ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
