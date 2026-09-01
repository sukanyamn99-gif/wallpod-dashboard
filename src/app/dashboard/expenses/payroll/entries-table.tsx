"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { deletePayrollEntry } from "./actions";
import type { Employee, PayrollEntry } from "@/lib/types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function payPeriodLabel(payPeriod: string): string {
  const [y, m] = payPeriod.split("-");
  const monthName = THAI_MONTHS[Number(m) - 1] ?? m;
  const beYear = Number(y) + 543;
  return `${monthName} ${beYear}`;
}

function DeleteButton({ entryId, label }: { entryId: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deletePayrollEntry(entryId);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant="destructive"
          onClick={handleConfirm}
          disabled={pending}
          title={`ยืนยันลบรายการเงินเดือนของ ${label}`}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
          <X className="h-3.5 w-3.5" />
        </Button>
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

export function EntriesTable({ entries, employees }: { entries: PayrollEntry[]; employees: Employee[] }) {
  const [employeeFilter, setEmployeeFilter] = useState("all");

  const filtered = useMemo(() => {
    if (employeeFilter === "all") return entries;
    return entries.filter((e) => e.employeeId === employeeFilter);
  }, [entries, employeeFilter]);

  const employeeItems = [
    { value: "all", label: "ทุกคน" },
    ...employees.map((e) => ({ value: e.id, label: `${e.employeeCode} — ${e.fullName}` })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter((v as string) ?? "all")} items={employeeItems}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {employeeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button nativeButton={false} render={<Link href="/dashboard/expenses/payroll/new" />}>
          <Plus className="h-4 w-4" />
          บันทึกเงินเดือน
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">พนักงาน</TableHead>
              <TableHead className="whitespace-nowrap">เดือนที่จ่าย</TableHead>
              <TableHead className="text-right whitespace-nowrap">รวมรายได้</TableHead>
              <TableHead className="text-right whitespace-nowrap">รวมรายการหัก</TableHead>
              <TableHead className="text-right whitespace-nowrap">เงินเดือนสุทธิ</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  ยังไม่มีรายการเงินเดือน
                </TableCell>
              </TableRow>
            )}
            {filtered.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">
                  {entry.employeeCode} — {entry.employeeName}
                </TableCell>
                <TableCell className="whitespace-nowrap">{payPeriodLabel(entry.payPeriod)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(entry.totalIncome)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(entry.totalDeductions)}</TableCell>
                <TableCell className="text-right whitespace-nowrap font-medium">
                  {formatTHB(entry.netSalary)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/expenses/payroll/print/${entry.id}`} target="_blank" />}
                      title="พิมพ์ใบจ่ายเงินเดือน"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/expenses/payroll/edit/${entry.id}`} />}
                      title="แก้ไข"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <DeleteButton entryId={entry.id} label={`${entry.employeeName} (${payPeriodLabel(entry.payPeriod)})`} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">แสดง {filtered.length} รายการ</p>
    </div>
  );
}
