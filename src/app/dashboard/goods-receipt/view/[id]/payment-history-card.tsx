"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { deleteGoodsReceiptPayment, recordGoodsReceiptPayment } from "@/app/dashboard/goods-receipt/actions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface PaymentRow {
  id: string;
  amount: number;
  paidDate: string;
  note: string | null;
}

function DeletePaymentButton({ receiptId, paymentId }: { receiptId: string; paymentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteGoodsReceiptPayment(receiptId, paymentId);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="outline" onClick={confirmDelete} disabled={pending} title="ยืนยันลบรายการนี้">
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ยกเลิก">
          <X className="h-3.5 w-3.5" />
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button size="icon-sm" variant="ghost" onClick={() => setConfirming(true)} title="ลบรายการจ่ายนี้">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function AddPaymentForm({
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
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("amount", amount);
      fd.set("paid_date", paidDate);
      fd.set("note", note);
      const result = await recordGoodsReceiptPayment(receiptId, fd);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setOpen(false);
      setConfirming(false);
      setNote("");
    });
  }

  if (remainingBalance <= 0) return null;

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + บันทึกการจ่าย
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-end sm:gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">จำนวนเงิน</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 w-32"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">วันที่จ่าย</label>
        <DateInput value={paidDate} onChange={setPaidDate} className="h-8 w-32" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">หมายเหตุ (ไม่บังคับ)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8 w-40" placeholder="เช่น งวดที่ 3" />
      </div>
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
            onClick={submit}
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
      {error && <p className="text-xs text-destructive sm:basis-full">{error}</p>}
    </div>
  );
}

export function PaymentHistoryCard({
  receiptId,
  docNo,
  totalAmount,
  amountPaid,
  remainingBalance,
  payments,
  canManage,
}: {
  receiptId: string;
  docNo: string;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  payments: PaymentRow[];
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>ประวัติการจ่ายเงิน</CardTitle>
        {canManage && <AddPaymentForm receiptId={receiptId} docNo={docNo} remainingBalance={remainingBalance} />}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">ยอดเต็ม</p>
            <p className="font-medium">{formatTHB(totalAmount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">จ่ายไปแล้ว</p>
            <p className="font-medium">{formatTHB(amountPaid)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">คงเหลือ</p>
            <p className="font-semibold">{formatTHB(remainingBalance)}</p>
          </div>
        </div>

        {payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">วันที่จ่าย</TableHead>
                <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
                <TableHead className="whitespace-nowrap">หมายเหตุ</TableHead>
                {canManage && <TableHead className="whitespace-nowrap">จัดการ</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{new Date(p.paidDate).toLocaleDateString("th-TH")}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatTHB(p.amount)}</TableCell>
                  <TableCell>{p.note ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell>
                      <DeletePaymentButton receiptId={receiptId} paymentId={p.id} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีการบันทึกการจ่ายเงินบางส่วน</p>
        )}
      </CardContent>
    </Card>
  );
}
