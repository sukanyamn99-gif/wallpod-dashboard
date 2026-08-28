"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { markGoodsReceiptPaymentStatus, recordGoodsReceiptPayment } from "@/app/dashboard/goods-receipt/actions";
import type { PayableRow } from "@/lib/data/payables";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function MarkPaidButton({ receiptId, docNo }: { receiptId: string; docNo: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function confirmMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markGoodsReceiptPaymentStatus(receiptId, "จ่ายแล้ว", todayISO());
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            onClick={confirmMarkPaid}
            disabled={pending}
            title={`ยืนยันว่าจ่ายใบ ${docNo} ครบแล้ว`}
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
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      <Check className="h-3.5 w-3.5" />
      ปิดยอด (จ่ายครบ)
    </Button>
  );
}

function RecordPaymentButton({
  receiptId,
  docNo,
  remainingBalance,
}: {
  receiptId: string;
  docNo: string;
  remainingBalance: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() => String(remainingBalance));
  const [paidDate, setPaidDate] = useState(todayISO());
  const [confirming, setConfirming] = useState(false);

  function submitPayment() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("amount", amount);
      fd.set("paid_date", paidDate);
      const result = await recordGoodsReceiptPayment(receiptId, fd);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setOpen(false);
      setConfirming(false);
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        บันทึกจ่ายบางส่วน
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
      <Input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="จำนวนเงิน"
        className="h-8 w-32"
      />
      <DateInput value={paidDate} onChange={setPaidDate} className="h-8 w-32" />
      {!confirming ? (
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setConfirming(true)} disabled={pending || Number(amount) <= 0}>
            บันทึก
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            onClick={submitPayment}
            disabled={pending}
            title={`ยืนยันบันทึกจ่าย ${docNo} จำนวน ${formatTHB(Number(amount))}`}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ยกเลิก">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PayablesTable({ rows, canManage }: { rows: PayableRow[]; canManage: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
            <TableHead className="whitespace-nowrap">เลขที่อ้างอิง</TableHead>
            <TableHead className="whitespace-nowrap">ผู้จำหน่าย</TableHead>
            <TableHead className="whitespace-nowrap">วันที่</TableHead>
            <TableHead className="text-right whitespace-nowrap">ยอดเต็ม</TableHead>
            <TableHead className="text-right whitespace-nowrap">จ่ายแล้ว</TableHead>
            <TableHead className="text-right whitespace-nowrap">คงเหลือ</TableHead>
            <TableHead className="text-right whitespace-nowrap">ค้างมา (วัน)</TableHead>
            {canManage && <TableHead className="whitespace-nowrap">จัดการ</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 9 : 8} className="text-center text-muted-foreground">
                ไม่มีเจ้าหนี้คงค้าง
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap font-medium">
                <Link href={`/dashboard/goods-receipt/view/${r.id}`} className="underline underline-offset-2">
                  {r.docNo}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">{r.referenceNo ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{r.supplierName ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("th-TH")}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{formatTHB(r.totalAmount)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{formatTHB(r.amountPaid)}</TableCell>
              <TableCell className="text-right whitespace-nowrap font-medium">{formatTHB(r.remainingBalance)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{r.ageDays}</TableCell>
              {canManage && (
                <TableCell>
                  <div className="flex flex-col items-start gap-1.5">
                    <RecordPaymentButton receiptId={r.id} docNo={r.docNo} remainingBalance={r.remainingBalance} />
                    <MarkPaidButton receiptId={r.id} docNo={r.docNo} />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
