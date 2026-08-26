"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter";
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

type VoucherRow = Omit<PaymentVoucher, "ledgerLines">;

const TOTAL_COLUMNS = 7;

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(key: string) {
  const [, month] = key.split("-").map(Number);
  return THAI_MONTHS[month - 1];
}

function canManage(profile: Profile, voucher: VoucherRow) {
  return profile.role === "owner" || profile.role === "manager" || profile.role === "account" || voucher.recordedById === profile.id;
}

function DeleteButton({ voucher }: { voucher: VoucherRow }) {
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
  vouchers: VoucherRow[];
  currentProfile: Profile;
}) {
  const [query, setQuery] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  const monthOptions = useMemo(() => {
    const keys = new Set(vouchers.map((v) => monthKeyOf(v.voucherDate)));
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ value: key, label: monthLabelOf(key) }));
  }, [vouchers]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter(
      (v) =>
        v.docNo.toLowerCase().includes(q) ||
        v.payeeName.toLowerCase().includes(q) ||
        (v.category ?? "").toLowerCase().includes(q) ||
        (v.description ?? "").toLowerCase().includes(q),
    );
  }, [vouchers, query]);

  const filtered = useMemo(() => {
    if (selectedMonths.size === 0) return searched;
    return searched.filter((v) => selectedMonths.has(monthKeyOf(v.voucherDate)));
  }, [searched, selectedMonths]);

  const total = filtered.reduce((sum, v) => sum + v.amount, 0);

  // Group by calendar month (newest first) with a subtotal per month —
  // same shape as WALLPOD Project Sales' report table, so ค้นหา/ดูแต่ละเดือน
  // works the same way across both.
  // React Compiler can't auto-memoize this particular shape (tried several
  // rewrites without resolving it); the manual useMemo below still works
  // correctly as ordinary React memoization, this only forgoes the
  // compiler's own additional optimization pass for this one value.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const monthGroups = useMemo(() => {
    const keys = Array.from(new Set(filtered.map((v) => monthKeyOf(v.voucherDate)))).sort((a, b) =>
      b.localeCompare(a),
    );
    return keys.map((key) => {
      const rows = filtered.filter((v) => monthKeyOf(v.voucherDate) === key);
      return {
        key,
        label: monthLabelOf(key),
        rows,
        subtotal: rows.reduce((sum, v) => sum + v.amount, 0),
      };
    });
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 sm:max-w-xs">
        <p className="text-sm font-medium text-muted-foreground">ยอดรวม (ตามที่ค้นหา)</p>
        <p className="text-2xl font-semibold">{formatTHB(total)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสาร, ผู้รับเงิน, หมวดหมู่..."
          className="max-w-sm"
        />
        <MultiSelectFilter
          allLabel="ทุกเดือน"
          countLabel="เดือน"
          options={monthOptions}
          selected={selectedMonths}
          onChange={setSelectedMonths}
        />
      </div>

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
            {monthGroups.map((group) => (
              <Fragment key={group.key}>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableCell colSpan={TOTAL_COLUMNS} className="font-medium">
                    {group.label} ({group.rows.length} รายการ — รวม {formatTHB(group.subtotal)})
                  </TableCell>
                </TableRow>
                {group.rows.map((v) => (
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
                      <div className="flex gap-1">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/dashboard/expenses/payment-vouchers/print/${v.id}`} target="_blank" />}
                          title="พิมพ์"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        {canManage(currentProfile, v) && (
                          <>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              nativeButton={false}
                              render={<Link href={`/dashboard/expenses/payment-vouchers/edit/${v.id}`} />}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <DeleteButton voucher={v} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
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
