"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Pencil, Printer, Trash2, X } from "lucide-react";
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
import type { WhtCertificateRow } from "@/lib/types";
import { deletePaymentVoucher } from "../payment-vouchers/actions";
import { deletePettyCashTransaction } from "../petty-cash/actions";

const TOTAL_COLUMNS = 7;

// A ใบหัก ณ ที่จ่าย is only a view over its Payment Voucher / petty-cash entry,
// so deleting one deletes that source entry (the confirm step says so).
function DeleteButton({ row }: { row: WhtCertificateRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const sourceLabel = row.source === "petty_cash" ? "เงินสดย่อย" : "ใบสำคัญจ่าย";

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result =
        row.source === "petty_cash" ? await deletePettyCashTransaction(row.id) : await deletePaymentVoucher(row.id);
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
            title={`ยืนยันลบ ${row.whtCertNo ?? ""} — จะลบ${sourceLabel} ${row.docNo} ทั้งรายการ`}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending} title="ยกเลิก">
            <X className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-destructive whitespace-nowrap">
            ลบ{sourceLabel} {row.docNo} ทั้งรายการ?
          </span>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)} title="ลบใบหัก ณ ที่จ่าย">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

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

export function WhtCertificatesTable({ rows: allRows }: { rows: WhtCertificateRow[] }) {
  const [query, setQuery] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  const monthOptions = useMemo(() => {
    const keys = new Set(allRows.map((v) => monthKeyOf(v.date)));
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ value: key, label: monthLabelOf(key) }));
  }, [allRows]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (v) =>
        v.docNo.toLowerCase().includes(q) ||
        v.payeeName.toLowerCase().includes(q) ||
        (v.whtCertNo ?? "").toLowerCase().includes(q),
    );
  }, [allRows, query]);

  const filtered = useMemo(() => {
    if (selectedMonths.size === 0) return searched;
    return searched.filter((v) => selectedMonths.has(monthKeyOf(v.date)));
  }, [searched, selectedMonths]);

  const totalWht = filtered.reduce((sum, v) => sum + v.whtAmount, 0);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const monthGroups = useMemo(() => {
    const keys = Array.from(new Set(filtered.map((v) => monthKeyOf(v.date)))).sort((a, b) =>
      b.localeCompare(a),
    );
    return keys.map((key) => {
      const rows = filtered.filter((v) => monthKeyOf(v.date) === key);
      return {
        key,
        label: monthLabelOf(key),
        rows,
        subtotal: rows.reduce((sum, v) => sum + v.whtAmount, 0),
      };
    });
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 sm:max-w-xs">
        <p className="text-sm font-medium text-muted-foreground">ยอดภาษีหัก ณ ที่จ่ายรวม (ตามที่ค้นหา)</p>
        <p className="text-2xl font-semibold">{formatTHB(totalWht)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเลขที่เอกสาร, ผู้รับเงิน, เลขที่ใบหัก..."
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
              <TableHead className="whitespace-nowrap">เลขที่ใบหัก ณ ที่จ่าย</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ผู้ถูกหักภาษี</TableHead>
              <TableHead className="whitespace-nowrap">ประเภทแบบ</TableHead>
              <TableHead className="text-right whitespace-nowrap">อัตรา (%)</TableHead>
              <TableHead className="text-right whitespace-nowrap">ภาษีที่หัก</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={TOTAL_COLUMNS} className="text-center text-muted-foreground">
                  ไม่พบรายการที่มีการหักภาษี ณ ที่จ่าย
                </TableCell>
              </TableRow>
            )}
            {monthGroups.map((group) => (
              <Fragment key={group.key}>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableCell colSpan={TOTAL_COLUMNS} className="font-medium">
                    {group.label} ({group.rows.length} รายการ — รวมภาษีหัก {formatTHB(group.subtotal)})
                  </TableCell>
                </TableRow>
                {group.rows.map((v) => {
                  const editHref =
                    v.source === "petty_cash"
                      ? `/dashboard/expenses/petty-cash/edit/${v.id}`
                      : `/dashboard/expenses/payment-vouchers/edit/${v.id}`;
                  const editTitle = v.source === "petty_cash" ? "แก้ไขข้อมูล (ที่เงินสดย่อย)" : "แก้ไขข้อมูล (ที่ Payment Voucher)";
                  return (
                    <TableRow key={`${v.source}-${v.id}`}>
                      <TableCell className="font-medium whitespace-nowrap">{v.whtCertNo ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(v.date).toLocaleDateString("th-TH")}</TableCell>
                      <TableCell className="whitespace-nowrap">{v.payeeName}</TableCell>
                      <TableCell className="whitespace-nowrap">{v.whtFormType ?? "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{v.whtRate ?? "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatTHB(v.whtAmount)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            nativeButton={false}
                            render={
                              <Link
                                href={`/dashboard/expenses/wht-certificates/print/${v.id}?source=${v.source}`}
                                target="_blank"
                              />
                            }
                            title="พิมพ์ใบหัก ณ ที่จ่าย"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            nativeButton={false}
                            render={<Link href={editHref} />}
                            title={editTitle}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {v.source === "payment_voucher" && (
                            <Button
                              size="icon-sm"
                              variant="outline"
                              nativeButton={false}
                              render={<Link href={`/dashboard/expenses/payment-vouchers/new?copyFrom=${v.id}`} />}
                              title="คัดลอกเพื่อสร้างใบใหม่"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <DeleteButton row={v} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {allRows.length} รายการ
      </p>
    </div>
  );
}
