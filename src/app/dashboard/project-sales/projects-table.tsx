"use client";

import { Fragment, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FullProjectRow } from "@/lib/data/project-sales";

const BASE_COLUMNS = 7;
const TAIL_COLUMNS = 19;
const COST_COLUMNS = 8;

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  return (
    <TableCell className={cn("text-right whitespace-nowrap", className)}>
      {value ? formatTHB(value) : "—"}
    </TableCell>
  );
}

// Tints each block of related columns in this very wide table with its own
// pale hue (reusing the app's existing chart palette) so every group reads
// as a distinct zone while scrolling horizontally — not just "category" vs
// "everything else," but category / VAT-and-totals / cost / payment each
// getting their own color.
const CATEGORY_GROUP_CLASS = "bg-[color-mix(in_oklch,var(--chart-1),transparent_82%)]";
const VAT_GROUP_CLASS = "bg-[color-mix(in_oklch,var(--chart-3),transparent_78%)]";
const COST_GROUP_CLASS = "bg-[color-mix(in_oklch,var(--chart-5),transparent_84%)]";
const PAYMENT_GROUP_CLASS = "bg-[color-mix(in_oklch,var(--chart-2),transparent_84%)]";

// The header row is sticky (stays on screen while body rows scroll
// underneath it), so — unlike the body cells above — its background must
// be fully opaque or the scrolling row text shows through and overlaps
// the header text. Same hues, mixed into the opaque card color instead of
// transparent, so the header still reads as the same tinted group.
const CATEGORY_GROUP_HEADER_CLASS = "bg-[color-mix(in_oklch,var(--card),var(--chart-1)_18%)]";
const VAT_GROUP_HEADER_CLASS = "bg-[color-mix(in_oklch,var(--card),var(--chart-3)_22%)]";
const COST_GROUP_HEADER_CLASS = "bg-[color-mix(in_oklch,var(--card),var(--chart-5)_16%)]";
const PAYMENT_GROUP_HEADER_CLASS = "bg-[color-mix(in_oklch,var(--card),var(--chart-2)_16%)]";

// The first 5 columns (JOB NO. through SALE) stay pinned to the left edge
// while the rest of this very wide table scrolls horizontally — fixed
// widths are required so each column's sticky `left` offset lines up
// exactly between the header row and every body row.
const FROZEN_COL_WIDTHS = [96, 92, 220, 200, 100];
const FROZEN_COL_OFFSETS = FROZEN_COL_WIDTHS.reduce<number[]>((acc, w, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + FROZEN_COL_WIDTHS[i - 1]);
  return acc;
}, []);

function frozenColStyle(index: number): CSSProperties {
  return {
    left: FROZEN_COL_OFFSETS[index],
    width: FROZEN_COL_WIDTHS[index],
    minWidth: FROZEN_COL_WIDTHS[index],
    maxWidth: FROZEN_COL_WIDTHS[index],
  };
}

// Standalone stat card used in the summary bar above the table. Unlike a CSS
// grid (which stretches N equal columns across however wide the parent is —
// the parent grows to match this very wide table, pushing later stats off
// screen), a flex item keeps its own natural width and wraps, so every group
// stays visible without needing to scroll the page horizontally.
function SummaryGroup({
  title,
  titleClassName,
  boxClassName,
  children,
}: {
  title: string;
  titleClassName?: string;
  boxClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-[180px] space-y-2 rounded-lg border p-3", boxClassName)}>
      <p className={cn("text-xs font-semibold", titleClassName)}>{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatTHB(value)}</span>
    </div>
  );
}

function SubtotalStat({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string;
  value: number;
  tone?: "profit" | "outstanding";
  emphasize?: boolean;
}) {
  let valueClassName = "font-semibold tabular-nums";
  if (tone === "profit") {
    valueClassName += value < 0 ? " text-[var(--destructive)]" : " text-[var(--chart-2)]";
  } else if (tone === "outstanding") {
    valueClassName += value > 0 ? " text-[var(--chart-3)]" : "";
  } else if (emphasize) {
    valueClassName += " text-base";
  }

  return (
    <div className="flex flex-col justify-center border-l pl-4 first:border-l-0 first:pl-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={valueClassName}>{formatTHB(value)}</span>
    </div>
  );
}

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

function ProjectRow({
  p,
  categories,
  canSeeCosts,
}: {
  p: FullProjectRow;
  categories: string[];
  canSeeCosts: boolean;
}) {
  return (
    <TableRow className={p.isCancelled ? "opacity-60" : undefined}>
      <TableCell
        className={cn("sticky z-10 truncate bg-card font-medium", p.isCancelled && "bg-card/60")}
        style={frozenColStyle(0)}
      >
        {p.jobNo ? (
          <Link
            href={`/dashboard/project-sales/edit/${encodeURIComponent(p.jobNo)}`}
            className="underline underline-offset-2"
          >
            {p.jobNo}
          </Link>
        ) : (
          "—"
        )}
        {p.isCancelled && (
          <Badge variant="destructive" className="ml-1">
            ยกเลิก
          </Badge>
        )}
      </TableCell>
      <TableCell
        className={cn("sticky z-10 truncate bg-card", p.isCancelled && "bg-card/60")}
        style={frozenColStyle(1)}
      >
        {p.projectDate}
      </TableCell>
      <TableCell
        className={cn("sticky z-10 truncate bg-card", p.isCancelled && "bg-card/60")}
        style={frozenColStyle(2)}
      >
        {p.customerName}
      </TableCell>
      <TableCell
        className={cn("sticky z-10 truncate bg-card", p.isCancelled && "bg-card/60")}
        style={frozenColStyle(3)}
      >
        {p.projectName}
      </TableCell>
      <TableCell
        className={cn("sticky z-10 truncate bg-card", p.isCancelled && "bg-card/60")}
        style={frozenColStyle(4)}
      >
        {p.salesRepName}
      </TableCell>
      <TableCell className="whitespace-nowrap">{p.customerType}</TableCell>
      <TableCell className="whitespace-nowrap">{p.productionStatus ?? "—"}</TableCell>
      {categories.map((cat) => (
        <Money key={cat} value={p.itemsByCategory[cat]} className={CATEGORY_GROUP_CLASS} />
      ))}
      <Money value={p.preVat} className={VAT_GROUP_CLASS} />
      <Money value={p.vat} className={VAT_GROUP_CLASS} />
      <Money value={p.total} className={VAT_GROUP_CLASS} />
      {canSeeCosts && (
        <>
          <Money value={p.costs?.material} className={COST_GROUP_CLASS} />
          <Money value={p.costs?.glue} className={COST_GROUP_CLASS} />
          <Money value={p.costs?.cutting} className={COST_GROUP_CLASS} />
          <Money value={p.costs?.install} className={COST_GROUP_CLASS} />
          <Money value={p.costs?.parking} className={COST_GROUP_CLASS} />
          <Money value={p.costs?.shipping} className={COST_GROUP_CLASS} />
          <Money value={p.costs?.totalCost} className={COST_GROUP_CLASS} />
          <Money value={p.profit} className={COST_GROUP_CLASS} />
        </>
      )}
      <TableCell className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>{p.invoiceNo1 ?? "—"}</TableCell>
      <Money value={p.amount1} className={PAYMENT_GROUP_CLASS} />
      <TableCell className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>{p.paidDate1 ?? "—"}</TableCell>
      <TableCell className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>{p.invoiceNo2 ?? "—"}</TableCell>
      <Money value={p.amount2} className={PAYMENT_GROUP_CLASS} />
      <TableCell className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>{p.paidDate2 ?? "—"}</TableCell>
      <TableCell className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>{p.status ?? "—"}</TableCell>
      <Money value={p.outstanding} className={PAYMENT_GROUP_CLASS} />
    </TableRow>
  );
}

function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(key: string) {
  const [, month] = key.split("-").map(Number);
  return THAI_MONTHS[month - 1];
}

export function ProjectsTable({
  projects,
  categories,
  canSeeCosts,
}: {
  projects: FullProjectRow[];
  categories: string[];
  canSeeCosts: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedSalesReps, setSelectedSalesReps] = useState<Set<string>>(new Set());
  const totalColumns =
    BASE_COLUMNS + categories.length + TAIL_COLUMNS - (canSeeCosts ? 0 : COST_COLUMNS);

  const monthOptions = useMemo(() => {
    const keys = new Set(projects.map((p) => monthKeyOf(p.projectDate)));
    return Array.from(keys)
      .sort()
      .map((key) => ({ value: key, label: monthLabelOf(key) }));
  }, [projects]);

  const salesRepOptions = useMemo(() => {
    const names = new Set(projects.map((p) => p.salesRepName).filter(Boolean));
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "th"))
      .map((name) => ({ value: name, label: name }));
  }, [projects]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        (p.jobNo ?? "").toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        p.salesRepName.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const filtered = useMemo(() => {
    return searched.filter((p) => {
      if (selectedMonths.size > 0 && !selectedMonths.has(monthKeyOf(p.projectDate))) return false;
      if (selectedSalesReps.size > 0 && !selectedSalesReps.has(p.salesRepName)) return false;
      return true;
    });
  }, [searched, selectedMonths, selectedSalesReps]);

  const summary = useMemo(() => sumRows(filtered), [filtered]);

  // Group by calendar month (Jan → Dec, oldest year first) so each month's
  // jobs sit together with their own subtotal — mirrors the "Week N" subtotal
  // rows the original Excel sheet used, just at month granularity.
  const monthGroups = useMemo(() => {
    const groups = new Map<string, FullProjectRow[]>();
    for (const p of filtered) {
      const key = monthKeyOf(p.projectDate);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return Array.from(groups.keys())
      .sort()
      .map((key) => {
        const rows = groups
          .get(key)!
          .slice()
          .sort((a, b) => (a.jobNo ?? "").localeCompare(b.jobNo ?? "", undefined, { numeric: true }));
        return {
          key,
          label: monthLabelOf(key),
          rows,
          subtotal: sumRows(rows),
        };
      });
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหา JOB NO. / ลูกค้า / ชื่องาน / เซลล์"
          className="max-w-sm"
        />
        <MultiSelectFilter
          allLabel="ทุกเดือน"
          countLabel="เดือน"
          options={monthOptions}
          selected={selectedMonths}
          onChange={setSelectedMonths}
        />
        <MultiSelectFilter
          allLabel="ทุกเซลล์"
          countLabel="เซลล์"
          options={salesRepOptions}
          selected={selectedSalesReps}
          onChange={setSelectedSalesReps}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <SummaryGroup title="จำนวนงาน" boxClassName="bg-muted/30">
          <p className="text-2xl font-semibold tabular-nums">{summary.count} งาน</p>
          <p className="text-xs text-muted-foreground">ไม่รวมงานที่ยกเลิก</p>
        </SummaryGroup>

        <SummaryGroup
          title="สรุปยอดขาย"
          titleClassName="text-[var(--chart-3)]"
          boxClassName={VAT_GROUP_CLASS}
        >
          <SummaryStat label="ก่อนภาษีมูลค่าเพิ่มรวม" value={summary.preVat} />
          <SummaryStat label="ภาษีมูลค่าเพิ่ม" value={summary.vat} />
          <SummaryStat label="ยอดรวมภาษีมูลค่าเพิ่มรวม" value={summary.total} />
        </SummaryGroup>

        {canSeeCosts && (
          <SummaryGroup
            title="ต้นทุน & กำไร"
            titleClassName="text-[var(--chart-5)]"
            boxClassName={COST_GROUP_CLASS}
          >
            <SummaryStat label="ต้นทุนรวม" value={summary.totalCost} />
            <SummaryStat label="กำไรรวม" value={summary.profit} />
          </SummaryGroup>
        )}

        <SummaryGroup
          title="การชำระเงิน"
          titleClassName="text-[var(--chart-2)]"
          boxClassName={PAYMENT_GROUP_CLASS}
        >
          <SummaryStat label="ยอดคงค้างรวม" value={summary.outstanding} />
        </SummaryGroup>
      </div>

      <div className="rounded-md border">
        <Table containerClassName="max-h-[70vh] overflow-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(0)}>
                JOB NO.
              </TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(1)}>
                DATE
              </TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(2)}>
                CUSTOMER NAMES
              </TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(3)}>
                PROJECT NAME
              </TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(4)}>
                SALE
              </TableHead>
              <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-card">Customer Type</TableHead>
              <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-card">สถานะของงาน</TableHead>
              {categories.map((cat) => (
                <TableHead key={cat} className={cn("sticky top-0 z-10 text-right whitespace-nowrap", CATEGORY_GROUP_HEADER_CLASS)}>
                  {cat}
                </TableHead>
              ))}
              <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", VAT_GROUP_HEADER_CLASS)}>PRE.VAT</TableHead>
              <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", VAT_GROUP_HEADER_CLASS)}>VAT</TableHead>
              <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", VAT_GROUP_HEADER_CLASS)}>รวมทั้งสิ้น</TableHead>
              {canSeeCosts && (
                <>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>ค่าวัสดุ</TableHead>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>ค่ากาว</TableHead>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>ค่าตัด</TableHead>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>ค่าติดตั้งผู้รับเหมา</TableHead>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>ค่าที่จอดรถ</TableHead>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>ค่าขนส่ง</TableHead>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>รวมต้นทุน</TableHead>
                  <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", COST_GROUP_HEADER_CLASS)}>กำไร</TableHead>
                </>
              )}
              <TableHead className={cn("sticky top-0 z-10 whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>เลขที่เอกสาร (งวด 1)</TableHead>
              <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>งวดที่ 1 จำนวนเงิน</TableHead>
              <TableHead className={cn("sticky top-0 z-10 whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>วันที่รับชำระ (งวด 1)</TableHead>
              <TableHead className={cn("sticky top-0 z-10 whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>เลขที่เอกสาร (งวด 2)</TableHead>
              <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>งวดที่ 2 จำนวนเงิน</TableHead>
              <TableHead className={cn("sticky top-0 z-10 whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>วันที่รับชำระ (งวด 2)</TableHead>
              <TableHead className={cn("sticky top-0 z-10 whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>สถานะ</TableHead>
              <TableHead className={cn("sticky top-0 z-10 text-right whitespace-nowrap", PAYMENT_GROUP_HEADER_CLASS)}>ยอดคงค้าง</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {monthGroups.map((group) => (
              <Fragment key={group.key}>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableCell colSpan={totalColumns} className="font-medium">
                    {group.label} ({group.subtotal.count} งาน)
                  </TableCell>
                </TableRow>
                {group.rows.map((p) => (
                  <ProjectRow key={p.id} p={p} categories={categories} canSeeCosts={canSeeCosts} />
                ))}
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={totalColumns} className="py-3">
                    <div className="flex flex-wrap items-stretch gap-x-6 gap-y-2">
                      <span className="text-sm font-medium text-muted-foreground">สรุป{group.label}</span>
                      <SubtotalStat label="PRE.VAT" value={group.subtotal.preVat} />
                      <SubtotalStat label="VAT" value={group.subtotal.vat} />
                      <SubtotalStat label="รวมทั้งสิ้น" value={group.subtotal.total} emphasize />
                      {canSeeCosts && (
                        <>
                          <SubtotalStat label="ต้นทุน" value={group.subtotal.totalCost} />
                          <SubtotalStat label="กำไร" value={group.subtotal.profit} tone="profit" />
                        </>
                      )}
                      <SubtotalStat label="คงค้าง" value={group.subtotal.outstanding} tone="outstanding" />
                    </div>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {projects.length} งาน
      </p>
    </div>
  );
}
