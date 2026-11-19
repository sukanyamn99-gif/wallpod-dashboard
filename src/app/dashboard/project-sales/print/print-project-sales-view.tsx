"use client";

import { Fragment, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import type { FullProjectRow } from "@/lib/data/project-sales";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() + 543).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

function num(value: number | null | undefined): string {
  return value ? formatTHB(value) : "-";
}

function pct(profit: number | null, preVat: number): string {
  if (profit == null || !preVat) return "-";
  return `${((profit / preVat) * 100).toFixed(1)}%`;
}

// Cancelled jobs are listed (struck through) but never counted, same rule as
// the Project Sales list's own totals.
function sumRows(rows: FullProjectRow[]) {
  const counted = rows.filter((p) => !p.isCancelled);
  return {
    count: counted.length,
    preVat: counted.reduce((s, p) => s + p.preVat, 0),
    vat: counted.reduce((s, p) => s + p.vat, 0),
    total: counted.reduce((s, p) => s + p.total, 0),
    totalCost: counted.reduce((s, p) => s + (p.costs?.totalCost ?? 0), 0),
    profit: counted.reduce((s, p) => s + (p.profit ?? 0), 0),
    outstanding: counted.reduce((s, p) => s + (p.outstanding ?? 0), 0),
  };
}

const th = "border border-black bg-[#c8d7d6] p-1 font-medium";
const td = "border border-black p-1";

export function PrintProjectSalesView({
  rows,
  canSeeCosts,
  filterLabels,
  preparerName,
}: {
  rows: FullProjectRow[];
  canSeeCosts: boolean;
  filterLabels: string[];
  preparerName: string;
}) {
  const router = useRouter();

  const groups = useMemo(() => {
    const map = new Map<string, FullProjectRow[]>();
    for (const p of rows) {
      const key = monthKeyOf(p.projectDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.keys())
      .sort()
      .map((key) => {
        const list = map
          .get(key)!
          .slice()
          .sort((a, b) => (a.jobNo ?? "").localeCompare(b.jobNo ?? "", undefined, { numeric: true }));
        return { key, label: monthLabelOf(key), rows: list, subtotal: sumRows(list) };
      });
  }, [rows]);

  const grand = useMemo(() => sumRows(rows), [rows]);
  // With one customer the name goes in the header instead of repeating on
  // every line; with several it stays as a column so rows remain identifiable.
  const singleCustomer = new Set(rows.map((p) => p.customerName)).size === 1 ? rows[0]?.customerName : null;
  const showCustomerColumn = !singleCustomer;
  // Leading columns: JOB NO., วันที่, [ลูกค้า], ชื่อโครงการ, เซลล์, สถานะ.
  const leadColumns = 5 + (showCustomerColumn ? 1 : 0);
  const totalColumns = leadColumns + 3 + (canSeeCosts ? 3 : 0) + 1;

  const monthSpan =
    groups.length === 0
      ? ""
      : groups.length === 1
        ? groups[0].label
        : `${groups[0].label} — ${groups[groups.length - 1].label}`;

  const summaryCells = (s: ReturnType<typeof sumRows>, bold: boolean) => (
    <>
      <td className={`${td} text-right ${bold ? "font-semibold" : ""}`}>{num(s.preVat)}</td>
      <td className={`${td} text-right ${bold ? "font-semibold" : ""}`}>{num(s.vat)}</td>
      <td className={`${td} text-right ${bold ? "font-semibold" : ""}`}>{num(s.total)}</td>
      {canSeeCosts && (
        <>
          <td className={`${td} text-right ${bold ? "font-semibold" : ""}`}>{num(s.totalCost)}</td>
          <td className={`${td} text-right ${bold ? "font-semibold" : ""}`}>{num(s.profit)}</td>
          <td className={`${td} text-right ${bold ? "font-semibold" : ""}`}>{pct(s.profit, s.preVat)}</td>
        </>
      )}
      <td className={`${td} text-right ${bold ? "font-semibold" : ""}`}>{num(s.outstanding)}</td>
    </>
  );

  return (
    <div>
      <style>{`
        @media print { @page { size: landscape; margin: 10mm; } }
        table { page-break-inside: auto; }
        thead { display: table-header-group; }
        tbody tr { page-break-inside: avoid; break-inside: avoid; }
      `}</style>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        {/* Opened in a new tab, so there is no history to go back to — close the
            tab, and fall back to the list if the browser refuses to close it. */}
        <Button
          variant="outline"
          onClick={() => {
            window.close();
            router.push("/dashboard/project-sales");
          }}
        >
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="mx-auto max-w-[1400px] bg-white p-6 text-black print:p-0">
        <div className="text-[11px] leading-tight">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">รายงานงานขาย{singleCustomer ? ` — ${singleCustomer}` : ""}</p>
              <p>{monthSpan || "ไม่พบรายการ"}</p>
              {filterLabels.length > 0 && <p className="text-neutral-600">{filterLabels.join(" · ")}</p>}
            </div>
            <div className="text-right">
              <p className="text-neutral-600">ยอดรวมทั้งสิ้น (รวม VAT)</p>
              <p className="text-xl font-semibold">{formatTHB(grand.total)}</p>
              <p className="text-neutral-600">{grand.count} งาน (ไม่รวมงานที่ยกเลิก)</p>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-center">
            <thead>
              <tr>
                <th className={th}>JOB NO.</th>
                <th className={th}>วันที่</th>
                {showCustomerColumn && <th className={th}>ลูกค้า</th>}
                <th className={th}>ชื่อโครงการ</th>
                <th className={th}>เซลล์</th>
                <th className={th}>สถานะงาน</th>
                <th className={th}>PRE.VAT</th>
                <th className={th}>VAT</th>
                <th className={th}>รวมทั้งสิ้น</th>
                {canSeeCosts && (
                  <>
                    <th className={th}>ต้นทุน</th>
                    <th className={th}>กำไร</th>
                    <th className={th}>%กำไร</th>
                  </>
                )}
                <th className={th}>คงค้าง</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className={`${td} text-neutral-600`} colSpan={totalColumns}>
                    ไม่พบรายการตามตัวกรองที่เลือก
                  </td>
                </tr>
              )}
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <tr>
                    <td className={`${td} bg-neutral-200 text-left font-semibold`} colSpan={totalColumns}>
                      {g.label} ({g.subtotal.count} งาน)
                    </td>
                  </tr>
                  {g.rows.map((p) => (
                    <tr key={p.id} className={p.isCancelled ? "text-neutral-500 line-through" : undefined}>
                      <td className={`${td} whitespace-nowrap text-left`}>{p.jobNo ?? "-"}</td>
                      <td className={`${td} whitespace-nowrap`}>{shortDate(p.projectDate)}</td>
                      {showCustomerColumn && <td className={`${td} text-left`}>{p.customerName}</td>}
                      <td className={`${td} text-left`}>
                        {p.projectName}
                        {p.isCancelled && " (ยกเลิก)"}
                      </td>
                      <td className={`${td} text-left`}>{p.salesRepName || "-"}</td>
                      <td className={`${td} whitespace-nowrap`}>{p.productionStatus ?? "-"}</td>
                      <td className={`${td} text-right`}>{num(p.preVat)}</td>
                      <td className={`${td} text-right`}>{num(p.vat)}</td>
                      <td className={`${td} text-right`}>{num(p.total)}</td>
                      {canSeeCosts && (
                        <>
                          <td className={`${td} text-right`}>{num(p.costs?.totalCost)}</td>
                          <td className={`${td} text-right`}>{num(p.profit)}</td>
                          <td className={`${td} text-right`}>{pct(p.profit, p.preVat)}</td>
                        </>
                      )}
                      <td className={`${td} text-right`}>{num(p.outstanding)}</td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-100">
                    <td className={`${td} text-left font-medium`} colSpan={leadColumns}>
                      สรุป{g.label}
                    </td>
                    {summaryCells(g.subtotal, false)}
                  </tr>
                </Fragment>
              ))}
              {groups.length > 0 && (
                <tr>
                  <td className={`${td} text-left font-semibold text-red-600`} colSpan={leadColumns}>
                    รวมทั้งสิ้น ({grand.count} งาน)
                  </td>
                  {summaryCells(grand, true)}
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-8 flex justify-between px-8 text-center text-sm">
            <div>
              <p>___________________________</p>
              <p>{preparerName || " "}</p>
              <p>ผู้จัดทำ</p>
            </div>
            <div>
              <p>___________________________</p>
              <p>&nbsp;</p>
              <p>ผู้อนุมัติ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
