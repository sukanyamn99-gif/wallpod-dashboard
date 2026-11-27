"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";

export interface RequisitionLine {
  docNo: string;
  date: string;
  description: string;
  jobNo: string | null;
  biller: string | null;
  amount: number;
}

const MIN_ROWS = 8;
const cell = "border border-black px-2 py-1";

function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH");
}

// "first – last" when the entries differ, the single value otherwise.
function range(values: string[], format: (v: string) => string = (v) => v): string {
  const unique = Array.from(new Set(values));
  if (unique.length === 0) return "";
  if (unique.length === 1) return format(unique[0]);
  return `${format(unique[0])} – ${format(unique[unique.length - 1])}`;
}

export function PrintPettyCashRequisitionView({ lines, autoPrint = false }: { lines: RequisitionLine[]; autoPrint?: boolean }) {
  const router = useRouter();

  // Opened with the row's print button: bring up the print dialog straight away
  // (a moment later, so the logo has loaded and is on the page).
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);
  const filled = lines.length > 0;
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const rowCount = Math.max(MIN_ROWS, lines.length);
  const blanks = Array.from({ length: rowCount - lines.length });

  const billers = Array.from(new Set(lines.map((l) => l.biller).filter((b): b is string => !!b)));

  return (
    <div>
      <style>{`@media print { @page { margin: 10mm; } }`}</style>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="mx-auto max-w-[860px] bg-white p-4 text-black print:max-w-none print:p-0">
        <table className="w-full table-fixed border-collapse border border-black text-sm">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[37%]" />
            <col className="w-[16%]" />
            <col className="w-[17%]" />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} className="border border-black border-r-0 px-2 py-2">
                <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-7 w-auto" priority />
              </td>
              <td colSpan={2} className="border border-black border-l-0 px-2 py-2 text-right text-xl font-bold">
                ใบเบิกสดย่อย
              </td>
            </tr>
            <tr className="font-bold">
              <td className={`${cell} text-center`}>ชื่อผู้เบิก</td>
              <td className={`${cell} text-center`}>ตำแหน่ง</td>
              <td className={`${cell} text-center`}>วันที่</td>
              <td className={`${cell} text-center font-normal`}>No.</td>
            </tr>
            <tr>
              <td className={`${cell} h-8 text-center text-gray-600`}>{filled && billers.length > 0 ? billers.join(", ") : "สดย่อย"}</td>
              <td className={cell}></td>
              <td className={`${cell} text-center`}>{filled ? range(lines.map((l) => l.date), thaiDate) : ""}</td>
              <td className={`${cell} text-center text-xs`}>{filled ? range(lines.map((l) => l.docNo)) : ""}</td>
            </tr>

            <tr className="font-bold">
              <td colSpan={3} className={`${cell} text-center`}>
                รายการ
              </td>
              <td className={`${cell} text-center`}>จำนวนเงิน</td>
            </tr>
            {lines.map((l) => (
              <tr key={l.docNo} className="h-9">
                <td colSpan={3} className={cell}>
                  {l.description}
                  {l.jobNo ? <span className="text-gray-600"> ({l.jobNo})</span> : null}
                </td>
                <td className={`${cell} text-right tabular-nums`}>{formatTHB(l.amount)}</td>
              </tr>
            ))}
            {blanks.map((_, i) => (
              <tr key={`blank-${i}`} className="h-9">
                <td colSpan={3} className={cell}></td>
                <td className={cell}></td>
              </tr>
            ))}

            <tr className="font-bold">
              <td className={cell}>รวมเงิน (ตัวอักษร)</td>
              <td colSpan={2} className={cell}>
                {filled ? thaiBahtText(total) : ""}
              </td>
              <td className={`${cell} text-right tabular-nums`}>{filled ? formatTHB(total) : ""}</td>
            </tr>
            <tr>
              <td colSpan={4} className={`${cell} py-2`}>
                จ่ายเป็น <span className="inline-block w-56 border-b border-dotted border-black align-bottom">&nbsp;</span>{" "}
                วันที่ <span className="inline-block w-56 border-b border-dotted border-black align-bottom">&nbsp;</span>
              </td>
            </tr>
            <tr className="h-24 align-top">
              <td className={`${cell} text-center font-medium`}>ผู้จัดการฝ่ายต้นสังกัด</td>
              <td colSpan={2} className={`${cell} text-center font-medium`}>
                ฝ่ายบัญชี
              </td>
              <td className={`${cell} text-center font-medium`}>ผู้รับเงิน</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
