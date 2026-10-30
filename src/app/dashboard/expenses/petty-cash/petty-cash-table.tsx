"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Ban, Check, Pencil, Printer, Trash2, Undo2, X } from "lucide-react";
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
import { cancelPettyCashTransaction, deletePettyCashTransaction } from "./actions";

const TOTAL_COLUMNS_BASE = 10;

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

// ยกเลิก / กู้คืน: the entry stays on the ledger but stops counting.
function CancelButton({ transaction }: { transaction: PettyCashTransaction }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const restoring = transaction.isCancelled;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelPettyCashTransaction(transaction.id, !restoring);
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
                ? `ยืนยันกู้คืน "${transaction.docNo}" (กลับมานับในยอดคงเหลือและต้นทุน)`
                : `ยืนยันยกเลิก "${transaction.docNo}" (ไม่นับในยอดคงเหลือ ต้นทุน Job และรายงาน แต่ยังเห็นรายการอยู่)`
            }
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ไม่ทำรายการ">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="icon-sm"
        variant="outline"
        onClick={() => setConfirming(true)}
        title={restoring ? "กู้คืนรายการที่ยกเลิก" : "ยกเลิกรายการนี้ (ไม่ลบ)"}
      >
        {restoring ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
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
  // เลขที่เอกสาร ticked for printing — only ใช้จ่าย entries that still count
  // (the printed report lists expenses, and a cancelled one is left out).
  const [selectedDocNos, setSelectedDocNos] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (fromDate && t.transactionDate < fromDate) return false;
      if (toDate && t.transactionDate > toDate) return false;
      if (!q) return true;
      return (
        t.docNo.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.jobNo ?? "").toLowerCase().includes(q)
      );
    });
  }, [transactions, query, fromDate, toDate]);

  const printHref = `/dashboard/expenses/petty-cash/print${
    fromDate || toDate ? `?from=${fromDate}&to=${toDate}` : ""
  }`;
  const selectable = filtered.filter((t) => t.transactionType === "expense" && !t.isCancelled);
  const allSelected = selectable.length > 0 && selectable.every((t) => selectedDocNos.has(t.docNo));
  const selectedPrintHref = `/dashboard/expenses/petty-cash/print?docs=${encodeURIComponent(
    Array.from(selectedDocNos).join(","),
  )}`;
  function toggleDoc(docNo: string) {
    setSelectedDocNos((prev) => {
      const next = new Set(prev);
      if (next.has(docNo)) next.delete(docNo);
      else next.add(docNo);
      return next;
    });
  }
  function toggleAll() {
    setSelectedDocNos((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const t of selectable) next.delete(t.docNo);
      else for (const t of selectable) next.add(t.docNo);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสาร, รายละเอียด, หมวดหมู่, เลขที่ Job..."
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
        {selectedDocNos.size > 0 ? (
          <Button variant="outline" nativeButton={false} render={<Link href={selectedPrintHref} target="_blank" />}>
            <Printer className="h-3.5 w-3.5" />
            พิมพ์รายการที่เลือก ({selectedDocNos.size})
          </Button>
        ) : (
          <Button variant="outline" disabled title="ติ๊กเลือกรายการใช้จ่ายที่ต้องการพิมพ์ในตารางก่อน">
            <Printer className="h-3.5 w-3.5" />
            พิมพ์รายการที่เลือก (0)
          </Button>
        )}
        {selectedDocNos.size > 0 && (
          <Button variant="ghost" onClick={() => setSelectedDocNos(new Set())}>
            ล้างที่เลือก
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectable.length === 0}
                  className="h-4 w-4"
                  aria-label="เลือกทุกรายการใช้จ่ายที่แสดง"
                  title="เลือกทุกรายการใช้จ่ายที่แสดงอยู่เพื่อพิมพ์"
                />
              </TableHead>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ประเภท</TableHead>
              <TableHead className="whitespace-nowrap">หมวดหมู่</TableHead>
              <TableHead className="whitespace-nowrap">เลขที่ Job</TableHead>
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
              <TableRow key={t.id} className={t.isCancelled ? "opacity-60" : undefined}>
                <TableCell>
                  {t.transactionType === "expense" && !t.isCancelled && (
                    <input
                      type="checkbox"
                      checked={selectedDocNos.has(t.docNo)}
                      onChange={() => toggleDoc(t.docNo)}
                      className="h-4 w-4"
                      aria-label={`เลือก ${t.docNo} เพื่อพิมพ์`}
                    />
                  )}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {t.docNo}
                  {t.isCancelled && (
                    <Badge variant="outline" className="ml-2">
                      ยกเลิก
                    </Badge>
                  )}
                </TableCell>
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
                <TableCell className="whitespace-nowrap">{t.jobNo ?? "—"}</TableCell>
                <TableCell className={t.isCancelled ? "whitespace-nowrap line-through" : "whitespace-nowrap"}>
                  {t.description}
                </TableCell>
                <TableCell className={t.isCancelled ? "text-right whitespace-nowrap line-through" : "text-right whitespace-nowrap"}>
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
                      <CancelButton transaction={t} />
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
