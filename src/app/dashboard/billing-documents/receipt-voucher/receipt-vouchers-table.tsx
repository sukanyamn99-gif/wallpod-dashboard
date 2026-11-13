"use client";

import { useMemo, useState, useTransition } from "react";
import { MonthTabs, filterByMonth, useDocMonth } from "@/components/dashboard/month-tabs";
import Link from "next/link";
import { Check, Pencil, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import type { ReceiptVoucher } from "@/lib/types";
import { deleteReceiptVoucher } from "./actions";

function DeleteButton({ voucher }: { voucher: ReceiptVoucher }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteReceiptVoucher(voucher.id);
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
            title={`ยืนยันลบใบสำคัญรับเงิน "${voucher.docNo}"`}
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
      <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)} title="ลบ">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ReceiptVouchersTable({ vouchers }: { vouchers: ReceiptVoucher[] }) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useDocMonth();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Typing a search looks through every month; otherwise the chosen month applies.
    if (!q) return filterByMonth(vouchers, (row) => row.docDate, month);
    return vouchers.filter(
      (v) =>
        v.docNo.toLowerCase().includes(q) ||
        v.contactName.toLowerCase().includes(q) ||
        (v.receiptNo ?? "").toLowerCase().includes(q),
    );
  }, [vouchers, query, month]);

  return (
    <div className="space-y-4">
      <MonthTabs dates={vouchers.map((row) => row.docDate)} value={month} onChange={setMonth} />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่เอกสาร, ลูกค้า, เลขที่ใบเสร็จ..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ใบเสร็จรับเงิน</TableHead>
              <TableHead className="whitespace-nowrap">ผู้ติดต่อ</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
              <TableHead className="whitespace-nowrap">ผู้บันทึก</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium whitespace-nowrap">{v.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(v.docDate).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">{v.receiptNo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{v.contactName}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(v.amount)}</TableCell>
                <TableCell className="whitespace-nowrap">{v.recordedByName || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/billing-documents/receipt-voucher/print/${v.id}`} target="_blank" />}
                      title="พิมพ์"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/billing-documents/receipt-voucher/edit/${v.id}`} />}
                      title="แก้ไข"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <DeleteButton voucher={v} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {vouchers.length} รายการ
      </p>
    </div>
  );
}
