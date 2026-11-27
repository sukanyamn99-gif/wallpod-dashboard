"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ALL_MONTHS, MonthTabs, filterByMonth, useDocMonth } from "@/components/dashboard/month-tabs";
import { MonthlyAmountDonut, buildMonthlySlices } from "@/components/dashboard/monthly-amount-donut";
import Link from "next/link";
import { Ban, Check, Copy, Eye, Factory, Pencil, Trash2, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Quotation } from "@/lib/types";
import { formatTHB } from "@/lib/format";
import { cancelQuotation, deleteQuotation } from "./actions";

function statusVariant(status: Quotation["status"]): "secondary" | "destructive" | "outline" {
  if (status === "ลูกค้าตอบตกลง") return "secondary";
  if (status === "ปฏิเสธ") return "destructive";
  return "outline";
}

function DeleteButton({ quotation }: { quotation: Quotation }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuotation(quotation.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button size="icon-sm" variant="destructive" onClick={handleConfirm} disabled={pending} title={`ยืนยันลบใบเสนอราคา "${quotation.docNo}"`}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ยกเลิก">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

// ยกเลิก / กู้คืน: the quotation stays on the list but stops counting.
function CancelButton({ quotation }: { quotation: Quotation }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const restoring = quotation.isCancelled;
  // Already in production (accepted, and its ใบลงผลิต not cancelled): not cancellable.
  const inProduction = !restoring && quotation.status === "ลูกค้าตอบตกลง" && !quotation.productionCancelled;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelQuotation(quotation.id, !restoring);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button
            size="icon-sm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
            title={
              restoring
                ? `ยืนยันกู้คืน "${quotation.docNo}"`
                : `ยืนยันยกเลิก "${quotation.docNo}" (ไม่นับในยอดรวม แต่ยังเห็นรายการอยู่)`
            }
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ไม่ทำรายการ">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="max-w-48 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="icon-sm"
        variant="outline"
        onClick={() => setConfirming(true)}
        disabled={inProduction}
        title={
          restoring
            ? "กู้คืนใบเสนอราคาที่ยกเลิก"
            : inProduction
              ? "ลงผลิตแล้ว — ต้องยกเลิกใบลงผลิตก่อนจึงจะยกเลิกใบเสนอราคาได้"
              : "ยกเลิกใบเสนอราคานี้ (ไม่ลบ)"
        }
      >
        {restoring ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
      </Button>
      {error && <p className="max-w-48 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function QuotationsTable({ quotations }: { quotations: Quotation[] }) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useDocMonth();
  const monthRows = useMemo(() => filterByMonth(quotations, (row) => row.quoteDate, month), [quotations, month]);
  // A cancelled quotation is listed but left out of the totals.
  const activeMonthRows = useMemo(() => monthRows.filter((row) => !row.isCancelled), [monthRows]);
  const cancelledMonthRows = useMemo(() => monthRows.filter((row) => row.isCancelled), [monthRows]);
  // The ring covers every month; cancelled quotations are left out of it like the totals.
  const monthlySlices = useMemo(
    () =>
      buildMonthlySlices(
        quotations.filter((row) => !row.isCancelled),
        (row) => row.quoteDate,
        (row) => row.preVat,
      ),
    [quotations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Typing a search looks through every month; otherwise the chosen month applies.
    if (!q) return filterByMonth(quotations, (row) => row.quoteDate, month);
    return quotations.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        (r.salesRepName ?? "").toLowerCase().includes(q),
    );
  }, [quotations, query, month]);

  // Size the table to the room left on this screen, so its own scrollbars
  // (sideways and up/down) sit at the bottom edge of the window instead of
  // far below the last of dozens of rows. The header row stays pinned.
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);
  useEffect(() => {
    function updateHeight() {
      const el = tableWrapperRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // Leaves room for the "แสดง N จาก M รายการ" line and the page padding below.
      setTableMaxHeight(Math.max(240, window.innerHeight - top - 76));
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [month]);

  return (
    <div className="space-y-4">
      <MonthTabs
        dates={quotations.map((row) => row.quoteDate)}
        value={month}
        onChange={setMonth}
        total={activeMonthRows.reduce((sum, row) => sum + row.preVat, 0)}
        count={activeMonthRows.length}
        breakdown={[
          ...(
            [
              { status: "ลูกค้าตอบตกลง", label: "ได้งาน", tone: "good" },
              { status: "ปฏิเสธ", label: "ไม่ได้งาน", tone: "bad" },
              { status: "รอตอบรับ", label: "รอตอบรับ", tone: "pending" },
            ] as const
          ).map(({ status, label, tone }) => {
            const rows = activeMonthRows.filter((row) => row.status === status);
            return { label, tone, count: rows.length, amount: rows.reduce((sum, row) => sum + row.preVat, 0) };
          }),
          ...(cancelledMonthRows.length > 0
            ? [
                {
                  label: "ยกเลิก (ไม่นับ)",
                  tone: "muted" as const,
                  count: cancelledMonthRows.length,
                  amount: cancelledMonthRows.reduce((sum, row) => sum + row.preVat, 0),
                },
              ]
            : []),
        ]}
      />
      {monthlySlices.length > 0 && (
        <MonthlyAmountDonut
          className="max-w-3xl"
          title="ยอดใบเสนอราคาแต่ละเดือน (ก่อน VAT)"
          countUnit="ใบ"
          slices={monthlySlices}
          selectedKey={month === ALL_MONTHS ? null : month}
          clickable
          onSelect={setMonth}
        />
      )}
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่ใบเสนอราคา, ลูกค้า, ชื่อโครงการ..."
        className="max-w-sm"
      />

      <div
        ref={tableWrapperRef}
        className="overflow-auto rounded-md border"
        style={{ maxHeight: tableMaxHeight ?? undefined }}
      >
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-card whitespace-nowrap">เลขที่</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card whitespace-nowrap">วันที่</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card whitespace-nowrap">ลูกค้า</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card whitespace-nowrap">ชื่อโครงการ</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card whitespace-nowrap">พนักงานขาย</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card text-right whitespace-nowrap">ยอดรวม</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((q) => (
              <TableRow key={q.id} className={q.isCancelled ? "opacity-60" : undefined}>
                <TableCell className={q.isCancelled ? "font-medium whitespace-nowrap line-through" : "font-medium whitespace-nowrap"}>{q.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(q.quoteDate).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">{q.customerName}</TableCell>
                <TableCell className="whitespace-nowrap">{q.projectName}</TableCell>
                <TableCell className="whitespace-nowrap">{q.salesRepName ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(q.total)}</TableCell>
                <TableCell>
                  {q.isCancelled ? <Badge variant="destructive">ยกเลิก</Badge> : <Badge variant={statusVariant(q.status)}>{q.status}</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/quotations/view/${q.id}`} />}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/quotations/edit/${q.id}`} />}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/quotations/new?copyFrom=${q.id}`} />}
                      title="คัดลอกเป็นใบเสนอราคาใหม่"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {!q.isCancelled && q.status !== "ปฏิเสธ" &&
                      (q.status === "ลูกค้าตอบตกลง" && !q.productionCancelled ? (
                        // Already in production (red) — opens its ใบลงผลิต.
                        <Button
                          size="icon-sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/dashboard/quotations/production-orders/${q.id}`} />}
                          title="ลงผลิตแล้ว — กดเพื่อดูใบลงผลิต"
                          className="border-red-500/50 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                        >
                          <Factory className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        // Not in production yet (green) — the quotation's page has
                        // the "ลูกค้าตอบตกลง" button that sends it to production.
                        <Button
                          size="icon-sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/dashboard/quotations/view/${q.id}`} />}
                          title="ยังไม่ได้ลงผลิต — เปิดใบเสนอราคาเพื่อกด ลูกค้าตอบตกลง"
                          className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          <Factory className="h-3.5 w-3.5" />
                        </Button>
                      ))}
                    <CancelButton quotation={q} />
                    <DeleteButton quotation={q} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {quotations.length} รายการ
      </p>
    </div>
  );
}
