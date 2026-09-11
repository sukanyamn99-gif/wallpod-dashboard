"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Trash2, X } from "lucide-react";
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
import { formatTHB } from "@/lib/format";
import type { Profile, PurchaseOrder, PurchaseOrderReceivingStatus } from "@/lib/types";
import { deletePurchaseOrder } from "./actions";

function receivingVariant(status: PurchaseOrderReceivingStatus): "secondary" | "outline" | "default" {
  if (status === "รับครบแล้ว") return "secondary";
  if (status === "รับบางส่วน") return "default";
  return "outline";
}

function canDelete(profile: Profile, order: PurchaseOrder) {
  return profile.role === "owner" || profile.role === "manager" || order.orderedById === profile.id;
}

function DeleteButton({ order }: { order: PurchaseOrder }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deletePurchaseOrder(order.id);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <Button size="icon-sm" variant="destructive" onClick={handleConfirm} disabled={pending} title={`ยืนยันลบใบสั่งซื้อ "${order.docNo}"`}>
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

export function PurchaseOrdersTable({
  orders,
  currentProfile,
  showAmount,
}: {
  orders: PurchaseOrder[];
  currentProfile: Profile;
  showAmount: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const TOTAL_COLUMNS = showAmount ? 8 : 7;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.docNo.toLowerCase().includes(q) ||
        o.requestDocNo.toLowerCase().includes(q) ||
        (o.supplierName ?? "").toLowerCase().includes(q),
    );
  }, [orders, query]);

  return (
    <div className="space-y-4">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่เอกสาร, เลขที่ใบขอซื้อ, ผู้จำหน่าย..." className="max-w-sm" />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่เอกสาร</TableHead>
              <TableHead className="whitespace-nowrap">อ้างอิงใบขอซื้อ</TableHead>
              <TableHead className="whitespace-nowrap">ผู้จำหน่าย</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              {showAmount && <TableHead className="text-right whitespace-nowrap">มูลค่ารวม</TableHead>}
              <TableHead className="whitespace-nowrap">สถานะรับสินค้า</TableHead>
              <TableHead className="whitespace-nowrap">ผู้สั่งซื้อ</TableHead>
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
            {filtered.map((o) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/purchase-orders/view/${o.id}`)}>
                <TableCell className="font-medium whitespace-nowrap">{o.docNo}</TableCell>
                <TableCell className="whitespace-nowrap">{o.requestDocNo}</TableCell>
                <TableCell className="whitespace-nowrap">{o.supplierName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(o.orderDate).toLocaleDateString("th-TH")}</TableCell>
                {showAmount && <TableCell className="text-right whitespace-nowrap">{formatTHB(o.totalAmount)}</TableCell>}
                <TableCell className="whitespace-nowrap">
                  <Badge variant={receivingVariant(o.receivingStatus)}>{o.receivingStatus}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{o.orderedByName}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/purchase-orders/view/${o.id}`} />}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete(currentProfile, o) && <DeleteButton order={o} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {orders.length} รายการ
      </p>
    </div>
  );
}
