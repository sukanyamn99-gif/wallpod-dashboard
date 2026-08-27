"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Printer, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
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
import { deletePettyCashTransaction } from "./actions";

const TOTAL_COLUMNS_BASE = 8;

function DeleteButton({ transaction }: { transaction: PettyCashTransaction }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deletePettyCashTransaction(transaction.id);
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
            title={`ยืนยันลบ "${transaction.docNo}" (จะคำนวณยอดคงเหลือของรายการหลังจากนี้ใหม่ทั้งหมด)`}
          >
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
    <div className="flex flex-col gap-1">
      <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PettyCashTable({
  transactions,
  canManage = false,
}: {
  transactions: PettyCashTransaction[];
  canManage?: boolean;
}) {
  const totalColumns = TOTAL_COLUMNS_BASE + (canManage ? 1 : 0);
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
          <DateInput id="from_date" value={fromDate} onChange={setFromDate} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to_date" className="text-xs text-muted-foreground">
            ถึงวันที่
          </Label>
          <DateInput id="to_date" value={toDate} onChange={setToDate} className="w-[150px]" />
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
              {canManage && <TableHead className="whitespace-nowrap">จัดการ</TableHead>}
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
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/dashboard/expenses/petty-cash/edit/${t.id}`} />}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <DeleteButton transaction={t} />
                    </div>
                  </TableCell>
                )}
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
