"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import type { PaymentVoucher, Profile } from "@/lib/types";
import { deletePaymentVoucher } from "./actions";

const TOTAL_COLUMNS = 7;

function canManage(profile: Profile, voucher: PaymentVoucher) {
  return profile.role === "owner" || profile.role === "manager" || voucher.recordedById === profile.id;
}

function DeleteButton({ voucher }: { voucher: PaymentVoucher }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deletePaymentVoucher(voucher.id);
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
            title={`ยืนยันลบใบสำคัญจ่าย "${voucher.docNo}"`}
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

export function PaymentVouchersTable({
  vouchers,
  currentProfile,
}: {
  vouchers: PaymentVoucher[];
  currentProfile: Profile;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter(
      (v) =>
        v.docNo.toLowerCase().includes(q) ||
        v.payeeName.toLowerCase().includes(q) ||
        (v.category ?? "").toLowerCase().includes(q),
    );
  }, [vouchers, query]);

  const total = filtered.reduce((sum, v) => sum + v.amount, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 sm:max-w-xs">
        <p className="text-sm font-medium text-muted-foreground">ยอดรวม (ตามที่ค้นหา)</p>
        <p className="text-2xl font-semibold">{formatTHB(total)}</p>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่เอกสาร, ผู้รับเงิน, หมวดหมู่..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ผู้รับเงิน</TableHead>
              <TableHead className="whitespace-nowrap">หมวดหมู่</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
              <TableHead className="whitespace-nowrap">ผู้บันทึก</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
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
            {filtered.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium whitespace-nowrap">{v.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(v.voucherDate).toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="whitespace-nowrap">{v.payeeName}</TableCell>
                <TableCell className="whitespace-nowrap">{v.category ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(v.amount)}</TableCell>
                <TableCell className="whitespace-nowrap">{v.recordedByName || "—"}</TableCell>
                <TableCell>
                  {canManage(currentProfile, v) && (
                    <div className="flex gap-1">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/dashboard/expenses/payment-vouchers/edit/${v.id}`} />}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <DeleteButton voucher={v} />
                    </div>
                  )}
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
