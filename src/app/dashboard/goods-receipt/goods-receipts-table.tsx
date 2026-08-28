"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Eye, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { GoodsReceipt, Profile } from "@/lib/types";
import { deleteGoodsReceipt, markGoodsReceiptPaymentStatus } from "./actions";

const TOTAL_COLUMNS = 7;

function PaymentStatusCell({
  receipt,
  canManage,
}: {
  receipt: Omit<GoodsReceipt, "items">;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const next = receipt.paymentStatus === "จ่ายแล้ว" ? "ยังไม่จ่าย" : "จ่ายแล้ว";

  function confirmToggle() {
    setError(null);
    startTransition(async () => {
      const result = await markGoodsReceiptPaymentStatus(
        receipt.id,
        next,
        next === "จ่ายแล้ว" ? new Date().toISOString().slice(0, 10) : null,
      );
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <span className="text-xs whitespace-nowrap text-muted-foreground">เปลี่ยนเป็น &quot;{next}&quot;?</span>
          <Button size="icon-sm" variant="outline" onClick={confirmToggle} disabled={pending} title="ยืนยัน">
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
      <button type="button" onClick={canManage ? () => setConfirming(true) : undefined} disabled={!canManage}>
        <Badge variant={receipt.paymentStatus === "จ่ายแล้ว" ? "secondary" : "destructive"}>
          {receipt.paymentStatus}
        </Badge>
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Owner/manager can edit/delete any receipt; production can edit/delete
// only its own. support_sale/account can create receipts (see canCreate on
// the list page) but never edit/delete, even their own — "add but not edit".
function canDelete(profile: Profile, receipt: Omit<GoodsReceipt, "items">) {
  if (profile.role === "owner" || profile.role === "manager") return true;
  return profile.role === "production" && receipt.receivedById === profile.id;
}

// Payment status alone is a narrower permission than full edit/delete —
// 'account' can toggle it (matches goods_receipts_update's RLS, widened
// specifically for the เจ้าหนี้คงค้าง page) even though they can't touch
// items/stock on a receipt.
function canTogglePayment(profile: Profile, receipt: Omit<GoodsReceipt, "items">) {
  if (profile.role === "account") return true;
  return canDelete(profile, receipt);
}

function DeleteButton({ receipt }: { receipt: Omit<GoodsReceipt, "items"> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteGoodsReceipt(receipt.id);
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
            title={`ยืนยันลบใบรับสินค้า "${receipt.docNo}" (จะไม่คืนสต็อก/ต้นทุนที่รับเข้าไปแล้ว)`}
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

export function GoodsReceiptsTable({
  receipts,
  currentProfile,
}: {
  receipts: Omit<GoodsReceipt, "items">[];
  currentProfile: Profile;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        (r.supplierName ?? "").toLowerCase().includes(q) ||
        r.receivedByName.toLowerCase().includes(q) ||
        (r.referenceNo ?? "").toLowerCase().includes(q),
    );
  }, [receipts, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่เอกสาร, ผู้จำหน่าย, ผู้รับ..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">ผู้จำหน่าย</TableHead>
              <TableHead className="whitespace-nowrap">ผู้รับ</TableHead>
              <TableHead className="whitespace-nowrap">เลขที่อ้างอิง</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">สถานะจ่ายเงิน</TableHead>
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
              <TableRow key={r.id}>
                <TableCell className="font-medium whitespace-nowrap">{r.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{r.supplierName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.receivedByName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.referenceNo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString("th-TH")}
                </TableCell>
                <TableCell>
                  <PaymentStatusCell receipt={r} canManage={canTogglePayment(currentProfile, r)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/goods-receipt/view/${r.id}`} />}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete(currentProfile, r) && (
                      <Button
                        size="icon-sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/dashboard/goods-receipt/edit/${r.id}`} />}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
