"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Trash2, X } from "lucide-react";
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
import type { Profile, PurchaseOrderReceipt } from "@/lib/types";
import { deletePurchaseOrderReceipt } from "./actions";

const TOTAL_COLUMNS = 6;

function canDelete(profile: Profile, receipt: Omit<PurchaseOrderReceipt, "items">) {
  return profile.role === "owner" || profile.role === "manager" || receipt.receivedById === profile.id;
}

function DeleteButton({ receipt }: { receipt: Omit<PurchaseOrderReceipt, "items"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deletePurchaseOrderReceipt(receipt.id);
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
            title={`ยืนยันลบใบรับสินค้า "${receipt.docNo}" (จะไม่คืนสต็อกที่รับไปแล้ว)`}
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

export function PurchaseOrderReceiptsTable({
  receipts,
  currentProfile,
}: {
  receipts: Omit<PurchaseOrderReceipt, "items">[];
  currentProfile: Profile;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) => r.docNo.toLowerCase().includes(q) || r.orderDocNo.toLowerCase().includes(q));
  }, [receipts, query]);

  return (
    <div className="space-y-4">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่เอกสาร, เลขที่ใบสั่งซื้อ..." className="max-w-sm" />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">อ้างอิงใบสั่งซื้อ</TableHead>
              <TableHead className="whitespace-nowrap">ผู้รับ</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">หมายเหตุ</TableHead>
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
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/purchase-order-receipts/view/${r.id}`)}>
                <TableCell className="font-medium whitespace-nowrap">{r.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{r.orderDocNo}</TableCell>
                <TableCell className="whitespace-nowrap">{r.receivedByName}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString("th-TH")}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.note ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/purchase-order-receipts/view/${r.id}`} />}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete(currentProfile, r) && <DeleteButton receipt={r} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {receipts.length} รายการ
      </p>
    </div>
  );
}
