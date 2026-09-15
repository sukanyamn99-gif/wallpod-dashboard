"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Ban, Check, Eye, Pencil, RotateCcw, X } from "lucide-react";
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
import type { ProductionOrder } from "@/lib/types";
import { formatTHB } from "@/lib/format";
import { setProductionOrderCancelled } from "./actions";

function CancelButton({ order }: { order: ProductionOrder }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await setProductionOrderCancelled(order.id, !order.isCancelled);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  // Restoring is non-destructive — no confirm step needed, matches
  // cancel's own asymmetry elsewhere in this app (e.g. Project Sales'
  // cancel/restore).
  if (!order.isCancelled) {
    if (confirming) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="destructive"
              onClick={handleToggle}
              disabled={pending}
              title={`ยืนยันยกเลิกใบลงผลิต "${order.docNo}"`}
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
        <Button size="icon-sm" variant="outline" onClick={() => setConfirming(true)} title="ยกเลิกใบลงผลิต">
          <Ban className="h-3.5 w-3.5" />
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="icon-sm" variant="outline" onClick={handleToggle} disabled={pending} title="กู้คืนใบลงผลิต">
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ProductionOrdersTable({ orders }: { orders: ProductionOrder[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        (o.jobNumber ?? "").toLowerCase().includes(q) ||
        o.docNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.projectName.toLowerCase().includes(q) ||
        (o.salesRepName ?? "").toLowerCase().includes(q),
    );
  }, [orders, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาเลขที่ Job, เลขที่ใบเสนอราคา, ลูกค้า, ชื่อโครงการ..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">เลขที่ Job</TableHead>
              <TableHead className="whitespace-nowrap">วันที่</TableHead>
              <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
              <TableHead className="whitespace-nowrap">ชื่อโครงการ</TableHead>
              <TableHead className="whitespace-nowrap">พนักงานขาย</TableHead>
              <TableHead className="text-right whitespace-nowrap">ยอดรวม</TableHead>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {orders.length === 0 ? "ยังไม่มีใบเสนอราคาที่ลูกค้าตอบตกลง" : "ไม่พบรายการที่ค้นหา"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((o) => (
              <TableRow key={o.id} className={o.isCancelled ? "opacity-60" : undefined}>
                <TableCell className="font-medium whitespace-nowrap">{o.jobNumber ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(o.quoteDate).toLocaleDateString("th-TH")}</TableCell>
                <TableCell className="whitespace-nowrap">{o.customerName}</TableCell>
                <TableCell className="whitespace-nowrap">{o.projectName}</TableCell>
                <TableCell className="whitespace-nowrap">{o.salesRepName ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatTHB(o.total)}</TableCell>
                <TableCell>
                  {o.isCancelled ? (
                    <Badge variant="destructive">ยกเลิกแล้ว</Badge>
                  ) : (
                    <Badge variant="secondary">ลูกค้าตอบตกลง</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/quotations/view/${o.id}?from=production-orders`} />}
                      title="ดูใบเสนอราคา"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/dashboard/quotations/production-orders/${o.id}`} />}
                      title="กรอกเลขที่ Job / รหัสสินค้า"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <CancelButton order={o} />
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
