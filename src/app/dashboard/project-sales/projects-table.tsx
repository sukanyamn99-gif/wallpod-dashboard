"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <TableCell className="font-medium whitespace-nowrap">
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
      <TableCell className="whitespace-nowrap">{p.projectDate}</TableCell>
      <TableCell className="whitespace-nowrap">{p.customerName}</TableCell>
      <TableCell className="whitespace-nowrap">{p.projectName}</TableCell>
      <TableCell className="whitespace-nowrap">{p.salesRepName}</TableCell>
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
  const [year, month] = key.split("-").map(Number);
  return `${THAI_MONTHS[month - 1]} ${year}`;
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
  const [selectedMonth, setSelectedMonth] = useState("all");
  const totalColumns =
    BASE_COLUMNS + categories.length + TAIL_COLUMNS - (canSeeCosts ? 0 : COST_COLUMNS);

  const monthOptions = useMemo(() => {
    const keys = new Set(projects.map((p) => monthKeyOf(p.projectDate)));
    return Array.from(keys)
      .sort()
      .map((key) => ({ value: key, label: monthLabelOf(key) }));
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
    if (selectedMonth === "all") return searched;
    return searched.filter((p) => monthKeyOf(p.projectDate) === selectedMonth);
  }, [searched, selectedMonth]);

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
        <Select
          value={selectedMonth}
          onValueChange={(v) => setSelectedMonth(v as string)}
          items={[{ value: "all", label: "ทุกเดือน" }, ...monthOptions]}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="ทุกเดือน" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกเดือน</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">จำนวนงาน (ไม่รวมยกเลิก)</p>
          <p className="font-medium">{summary.count} งาน</p>
        </div>
        <div>
          <p className="text-muted-foreground">PRE.VAT รวม</p>
          <p className="font-medium">{formatTHB(summary.preVat)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">VAT รวม</p>
          <p className="font-medium">{formatTHB(summary.vat)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">รวมทั้งสิ้น</p>
          <p className="font-medium">{formatTHB(summary.total)}</p>
        </div>
        {canSeeCosts && (
          <>
            <div>
              <p className="text-muted-foreground">ต้นทุนรวม</p>
              <p className="font-medium">{formatTHB(summary.totalCost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">กำไรรวม</p>
              <p className="font-medium">{formatTHB(summary.profit)}</p>
            </div>
          </>
        )}
        <div>
          <p className="text-muted-foreground">ยอดคงค้างรวม</p>
          <p className="font-medium">{formatTHB(summary.outstanding)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">JOB NO.</TableHead>
              <TableHead className="whitespace-nowrap">DATE</TableHead>
              <TableHead className="whitespace-nowrap">CUSTOMER NAMES</TableHead>
              <TableHead className="whitespace-nowrap">PROJECT NAME</TableHead>
              <TableHead className="whitespace-nowrap">SALE</TableHead>
              <TableHead className="whitespace-nowrap">Customer Type</TableHead>
              <TableHead className="whitespace-nowrap">สถานะของงาน</TableHead>
              {categories.map((cat) => (
                <TableHead key={cat} className={cn("text-right whitespace-nowrap", CATEGORY_GROUP_CLASS)}>
                  {cat}
                </TableHead>
              ))}
              <TableHead className={cn("text-right whitespace-nowrap", VAT_GROUP_CLASS)}>PRE.VAT</TableHead>
              <TableHead className={cn("text-right whitespace-nowrap", VAT_GROUP_CLASS)}>VAT</TableHead>
              <TableHead className={cn("text-right whitespace-nowrap", VAT_GROUP_CLASS)}>รวมทั้งสิ้น</TableHead>
              {canSeeCosts && (
                <>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>ค่าวัสดุ</TableHead>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>ค่ากาว</TableHead>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>ค่าตัด</TableHead>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>ค่าติดตั้งผู้รับเหมา</TableHead>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>ค่าที่จอดรถ</TableHead>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>ค่าขนส่ง</TableHead>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>รวมต้นทุน</TableHead>
                  <TableHead className={cn("text-right whitespace-nowrap", COST_GROUP_CLASS)}>กำไร</TableHead>
                </>
              )}
              <TableHead className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>เลขที่เอกสาร (งวด 1)</TableHead>
              <TableHead className={cn("text-right whitespace-nowrap", PAYMENT_GROUP_CLASS)}>งวดที่ 1 จำนวนเงิน</TableHead>
              <TableHead className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>วันที่รับชำระ (งวด 1)</TableHead>
              <TableHead className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>เลขที่เอกสาร (งวด 2)</TableHead>
              <TableHead className={cn("text-right whitespace-nowrap", PAYMENT_GROUP_CLASS)}>งวดที่ 2 จำนวนเงิน</TableHead>
              <TableHead className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>วันที่รับชำระ (งวด 2)</TableHead>
              <TableHead className={cn("whitespace-nowrap", PAYMENT_GROUP_CLASS)}>สถานะ</TableHead>
              <TableHead className={cn("text-right whitespace-nowrap", PAYMENT_GROUP_CLASS)}>ยอดคงค้าง</TableHead>
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
