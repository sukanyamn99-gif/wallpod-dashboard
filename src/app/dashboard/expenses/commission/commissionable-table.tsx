"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { clearProjectCommission, saveProjectCommission } from "./actions";
import type { CommissionableProject } from "@/lib/types";

const ALL_VALUE = "all";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
  const [monthFilter, setMonthFilter] = useState(ALL_VALUE);
  const [salesRepFilter, setSalesRepFilter] = useState(ALL_VALUE);

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      const key = monthKey(p.receivedDate);
      if (!map.has(key)) map.set(key, monthLabel(p.receivedDate));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [projects]);

  const salesReps = useMemo(
    () => Array.from(new Set(projects.map((p) => p.salesRepName))).sort(),
    [projects],
  );

  const monthSelectItems = useMemo(
    () => [{ value: ALL_VALUE, label: "ทุกเดือน" }, ...monthOptions],
    [monthOptions],
  );
  const salesRepSelectItems = useMemo(
    () => [{ value: ALL_VALUE, label: "พนักงานขายทั้งหมด" }, ...salesReps.map((rep) => ({ value: rep, label: rep }))],
    [salesReps],
  );

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (monthFilter !== ALL_VALUE && monthKey(p.receivedDate) !== monthFilter) return false;
        if (salesRepFilter !== ALL_VALUE && p.salesRepName !== salesRepFilter) return false;
        return true;
      }),
    [projects, monthFilter, salesRepFilter],
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">เดือน</Label>
          <Select
            value={monthFilter}
            onValueChange={(v) => setMonthFilter((v as string) ?? ALL_VALUE)}
            items={monthSelectItems}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">พนักงานขาย</Label>
          <Select
            value={salesRepFilter}
            onValueChange={(v) => setSalesRepFilter((v as string) ?? ALL_VALUE)}
            items={salesRepSelectItems}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {salesRepSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {grouped.size === 0 && <p className="text-center text-sm text-muted-foreground">ไม่พบ Project ตามเงื่อนไขที่เลือก</p>}

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
