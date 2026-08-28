"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { markGoodsReceiptPaymentStatus } from "@/app/dashboard/goods-receipt/actions";
import type { PayableRow } from "@/lib/data/payables";

function MarkPaidButton({ receiptId, docNo }: { receiptId: string; docNo: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function confirmMarkPaid() {
    setError(null);
    startTransition(async () => {
      const result = await markGoodsReceiptPaymentStatus(receiptId, "จ่ายแล้ว", new Date().toISOString().slice(0, 10));
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
            title={`ยืนยันว่าจ่ายใบ ${docNo} แล้ว`}
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
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        <Check className="h-3.5 w-3.5" />
        จ่ายแล้ว
      </Button>
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
            <TableHead className="whitespace-nowrap">ผู้จำหน่าย</TableHead>
            <TableHead className="whitespace-nowrap">วันที่</TableHead>
            <TableHead className="text-right whitespace-nowrap">ยอดเงิน</TableHead>
            <TableHead className="text-right whitespace-nowrap">ค้างมา (วัน)</TableHead>
            {canManage && <TableHead className="whitespace-nowrap">จัดการ</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground">
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
              <TableCell className="whitespace-nowrap">{r.supplierName ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("th-TH")}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{formatTHB(r.totalAmount)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{r.ageDays}</TableCell>
              {canManage && (
                <TableCell>
                  <MarkPaidButton receiptId={r.id} docNo={r.docNo} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
