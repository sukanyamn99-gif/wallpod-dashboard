"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import type { PettyCashTransaction } from "@/lib/types";

const TOTAL_COLUMNS = 8;

export function PettyCashTable({ transactions }: { transactions: PettyCashTransaction[] }) {
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (fromDate && t.transactionDate < fromDate) return false;
      if (toDate && t.transactionDate > toDate) return false;
      if (!q) return true;
      return (
        t.docNo.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [transactions, query, fromDate, toDate]);

  const printHref = `/dashboard/expenses/petty-cash/print${
    fromDate || toDate ? `?from=${fromDate}&to=${toDate}` : ""
  }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสาร, รายละเอียด, หมวดหมู่..."
          className="max-w-sm"
        />
        <div className="space-y-1">
          <Label htmlFor="from_date" className="text-xs text-muted-foreground">
            ตั้งแต่วันที่
          </Label>
          <Input id="from_date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to_date" className="text-xs text-muted-foreground">
            ถึงวันที่
          </Label>
          <Input id="to_date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href={printHref} target="_blank" />}>
          <Printer className="h-3.5 w-3.5" />
          พิมพ์รายงานตามช่วงวันที่
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ประเภท</TableHead>
              <TableHead className="whitespace-nowrap">หมวดหมู่</TableHead>
              <TableHead className="whitespace-nowrap">รายละเอียด</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
              <TableHead className="text-right whitespace-nowrap">คงเหลือ</TableHead>
              <TableHead className="whitespace-nowrap">ผู้บันทึก</TableHead>
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
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium whitespace-nowrap">{t.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(t.transactionDate).toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {t.transactionType === "topup" ? (
                    <Badge variant="secondary">เติมเงิน</Badge>
                  ) : (
                    <Badge variant="destructive">ใช้จ่าย</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{t.category ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{t.description}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {t.transactionType === "topup" ? "+" : "-"}
                  {formatTHB(t.amount)}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatTHB(t.balanceAfter)}
                </TableCell>
                <TableCell className="whitespace-nowrap">{t.recordedByName || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {transactions.length} รายการ
      </p>
    </div>
  );
}
