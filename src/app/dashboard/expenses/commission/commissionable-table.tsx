"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
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
import { formatTHB } from "@/lib/format";
import { clearProjectCommission, saveProjectCommission } from "./actions";
import type { CommissionableProject } from "@/lib/types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function ProjectRow({ project }: { project: CommissionableProject }) {
  const [discountPercent, setDiscountPercent] = useState(String(project.discountPercent));
  const [saved, setSaved] = useState(project.hasCommissionEntry);
  const [rate, setRate] = useState(project.commissionRatePercent);
  const [commissionAmount, setCommissionAmount] = useState(project.commissionAmount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveProjectCommission(project.projectId, Number(discountPercent));
      if (result.error) {
        setError(result.error);
        return;
      }
      setRate(result.commissionRatePercent ?? 0);
      setCommissionAmount(result.commissionAmount ?? 0);
      setSaved(true);
    });
  }

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearProjectCommission(project.projectId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDiscountPercent("0");
      setRate(0);
      setCommissionAmount(0);
      setSaved(false);
    });
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{project.jobNo ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">{project.customerName}</TableCell>
      <TableCell className="whitespace-nowrap">{project.projectName}</TableCell>
      <TableCell className="text-right whitespace-nowrap">{formatTHB(project.preVat)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">{formatTHB(project.total)}</TableCell>
      <TableCell className="whitespace-nowrap">{project.invoiceNo ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">{project.receiptNo ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {new Date(project.receivedDate).toLocaleDateString("th-TH")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={discountPercent}
            onChange={(e) => {
              setDiscountPercent(e.target.value);
              setSaved(false);
            }}
            className="h-8 w-20"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">{saved ? `${rate}%` : "—"}</TableCell>
      <TableCell className="text-right whitespace-nowrap font-medium">
        {saved ? formatTHB(commissionAmount) : "—"}
      </TableCell>
      <TableCell>
        {saved ? (
          <Button size="icon-sm" variant="outline" onClick={handleClear} disabled={pending} title="ล้างค่าคอมมิชชั่น">
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="icon-sm" onClick={handleSave} disabled={pending} title="บันทึกส่วนลด/คำนวณค่าคอมมิชชั่น">
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        {error && <p className="mt-1 max-w-40 text-xs text-destructive">{error}</p>}
      </TableCell>
    </TableRow>
  );
}

export function CommissionableTable({ projects }: { projects: CommissionableProject[] }) {
  const [salesRepFilter, setSalesRepFilter] = useState("all");

  const salesReps = useMemo(
    () => Array.from(new Set(projects.map((p) => p.salesRepName))).sort(),
    [projects],
  );

  const filtered = useMemo(
    () => (salesRepFilter === "all" ? projects : projects.filter((p) => p.salesRepName === salesRepFilter)),
    [projects, salesRepFilter],
  );

  const grouped = useMemo(() => {
    const byMonth = new Map<string, Map<string, CommissionableProject[]>>();
    for (const p of filtered) {
      const month = monthLabel(p.receivedDate);
      if (!byMonth.has(month)) byMonth.set(month, new Map());
      const byRep = byMonth.get(month)!;
      if (!byRep.has(p.salesRepName)) byRep.set(p.salesRepName, []);
      byRep.get(p.salesRepName)!.push(p);
    }
    return byMonth;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">พนักงานขาย:</span>
          <button
            type="button"
            onClick={() => setSalesRepFilter("all")}
            className={salesRepFilter === "all" ? "font-medium text-primary underline" : "text-muted-foreground"}
          >
            ทั้งหมด
          </button>
          {salesReps.map((rep) => (
            <button
              key={rep}
              type="button"
              onClick={() => setSalesRepFilter(rep)}
              className={salesRepFilter === rep ? "font-medium text-primary underline" : "text-muted-foreground"}
            >
              {rep}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/dashboard/expenses/commission/print" target="_blank" />}
        >
          พิมพ์รายงาน
        </Button>
      </div>

      {grouped.size === 0 && <p className="text-center text-sm text-muted-foreground">ไม่พบ Project ที่เก็บเงินเรียบร้อยแล้ว</p>}

      {Array.from(grouped.entries()).map(([month, byRep]) => (
        <div key={month} className="space-y-3">
          <h3 className="font-semibold">{month}</h3>
          {Array.from(byRep.entries()).map(([rep, rows]) => (
            <div key={rep} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{rep}</p>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">เลขที่ Job</TableHead>
                      <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
                      <TableHead className="whitespace-nowrap">ชื่องาน</TableHead>
                      <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
                      <TableHead className="text-right whitespace-nowrap">รวม +VAT</TableHead>
                      <TableHead className="whitespace-nowrap">เลขที่ใบกำกับ</TableHead>
                      <TableHead className="whitespace-nowrap">เลขที่ใบรับเงิน</TableHead>
                      <TableHead className="whitespace-nowrap">วันที่รับชำระ</TableHead>
                      <TableHead className="whitespace-nowrap">ส่วนลด</TableHead>
                      <TableHead className="text-right whitespace-nowrap">อัตราคอมฯ</TableHead>
                      <TableHead className="text-right whitespace-nowrap">ค่าคอมมิชชั่น</TableHead>
                      <TableHead className="whitespace-nowrap">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((project) => (
                      <ProjectRow key={project.projectId} project={project} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
