"use client";

import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
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
import { formatNumber } from "@/lib/format";
import type { RequisitionReportRow } from "@/lib/data/stock-requisitions";

const TOTAL_COLUMNS = 8;

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${THAI_MONTHS[month - 1]} ${year}`;
}

export function RequisitionReportTable({ rows }: { rows: RequisitionReportRow[] }) {
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedSku, setSelectedSku] = useState("all");

  const monthOptions = useMemo(() => {
    const keys = new Set(rows.map((r) => monthKeyOf(r.createdAt)));
    return Array.from(keys)
      .sort()
      .reverse()
      .map((key) => ({ value: key, label: monthLabelOf(key) }));
  }, [rows]);

  const skuOptions = useMemo(() => {
    const skus = new Set(rows.map((r) => r.productSku).filter((s): s is string => !!s));
    return Array.from(skus)
      .sort()
      .map((sku) => ({ value: sku, label: sku }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedMonth !== "all" && monthKeyOf(r.createdAt) !== selectedMonth) return false;
      if (selectedSku !== "all" && r.productSku !== selectedSku) return false;
      return true;
    });
  }, [rows, selectedMonth, selectedSku]);

  const totalQuantity = filtered.reduce((sum, r) => sum + r.quantity, 0);

  function clearFilters() {
    setSelectedMonth("all");
    setSelectedSku("all");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">จำนวนรายการ</p>
          <p className="font-medium">{filtered.length} รายการ</p>
        </div>
        <div>
          <p className="text-muted-foreground">จำนวนที่เบิกรวม</p>
          <p className="font-medium">{formatNumber(totalQuantity)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">จำนวนใบเบิก</p>
          <p className="font-medium">{new Set(filtered.map((r) => r.docNo)).size} ใบ</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedMonth}
          onValueChange={(v) => setSelectedMonth(v as string)}
          items={[{ value: "all", label: "ทุกเดือน" }, ...monthOptions]}
        >
          <SelectTrigger className="w-[180px]">
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

        <Select
          value={selectedSku}
          onValueChange={(v) => setSelectedSku(v as string)}
          items={[{ value: "all", label: "ทุกรหัสสินค้า" }, ...skuOptions]}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ทุกรหัสสินค้า" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกรหัสสินค้า</SelectItem>
            {skuOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={clearFilters}>
          <FilterX className="h-4 w-4" />
          เคลียร์ตัวกรอง
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">เลขที่ใบเบิก</TableHead>
              <TableHead className="whitespace-nowrap">แผนก</TableHead>
              <TableHead className="whitespace-nowrap">ผู้เบิก</TableHead>
              <TableHead className="whitespace-nowrap">รหัสสินค้า</TableHead>
              <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวน</TableHead>
              <TableHead className="whitespace-nowrap">JOB NO.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={TOTAL_COLUMNS} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">{r.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{r.departmentName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.requestedByName || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.productSku ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.productName}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatNumber(r.quantity)} {r.unit}
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.jobNo ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {rows.length} รายการ
      </p>
    </div>
  );
}
