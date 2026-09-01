"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { deleteCommissionEntry } from "./actions";
import type { CommissionEntry } from "@/lib/types";

function DeleteButton({ entryId, label }: { entryId: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCommissionEntry(entryId);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant="destructive"
          onClick={handleConfirm}
          disabled={pending}
          title={`ยืนยันลบรายการ ${label}`}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
          <X className="h-3.5 w-3.5" />
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button size="icon-sm" variant="destructive" onClick={() => setConfirming(true)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function EntriesTable({ entries }: { entries: CommissionEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.brokerName.toLowerCase().includes(q) ||
        e.projectTitle.toLowerCase().includes(q) ||
        (e.jobNo ?? "").toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหา เลขที่ Job / ชื่องาน / พนักงานขาย..."
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/expenses/commission/print" target="_blank" />}
          >
            พิมพ์รายงาน
          </Button>
          <Button nativeButton={false} render={<Link href="/dashboard/expenses/commission/new" />}>
            <Plus className="h-4 w-4" />
            เพิ่มรายการ
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">เลขที่ Job</TableHead>
              <TableHead className="whitespace-nowrap">ชื่องาน/บริษัท</TableHead>
              <TableHead className="whitespace-nowrap">พนักงานขาย/นายหน้า</TableHead>
              <TableHead className="text-right whitespace-nowrap">จำนวนเงิน</TableHead>
              <TableHead className="text-right whitespace-nowrap">ส่วนลด</TableHead>
              <TableHead className="text-right whitespace-nowrap">อัตราคอมฯ</TableHead>
              <TableHead className="text-right whitespace-nowrap">ค่าคอมมิชชั่น</TableHead>
              <TableHead className="whitespace-nowrap">วันที่รับชำระ</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  ยังไม่มีรายการค่าคอมมิชชั่น
                </TableCell>
              </TableRow>
            )}
            {filtered.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(entry.entryDate).toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="whitespace-nowrap">{entry.jobNo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{entry.projectTitle}</TableCell>
                <TableCell className="whitespace-nowrap">{entry.brokerName}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(entry.amount)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{entry.discountPercent}%</TableCell>
                <TableCell className="text-right whitespace-nowrap">{entry.commissionRatePercent}%</TableCell>
                <TableCell className="text-right whitespace-nowrap font-medium">
                  {formatTHB(entry.commissionAmount)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {entry.receivedDate ? new Date(entry.receivedDate).toLocaleDateString("th-TH") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/expenses/commission/edit/${entry.id}`} />}
                      title="แก้ไข"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <DeleteButton entryId={entry.id} label={`${entry.projectTitle} — ${entry.brokerName}`} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">แสดง {filtered.length} รายการ</p>
    </div>
  );
}
