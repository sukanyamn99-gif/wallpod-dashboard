"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, PackagePlus, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile, StockProduct } from "@/lib/types";
import { RecordInDialog } from "./record-in-dialog";

const TOTAL_COLUMNS = 10;

function canRecordMovement(profile: Profile) {
  return profile.role === "owner" || profile.role === "manager" || profile.role === "production";
}

export function LowStockAlertView({
  lowStockItems,
  currentProfile,
}: {
  lowStockItems: StockProduct[];
  currentProfile: Profile;
}) {
  const [recordProduct, setRecordProduct] = useState<StockProduct | null>(null);

  const outOfStock = useMemo(() => lowStockItems.filter((p) => p.quantityOnHand <= 0), [lowStockItems]);
  const lowButNotEmpty = useMemo(() => lowStockItems.filter((p) => p.quantityOnHand > 0), [lowStockItems]);

  const canRecord = canRecordMovement(currentProfile);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">แจ้งเตือนสินค้าใกล้หมด</p>
          <p className="text-2xl font-semibold">{lowStockItems.length}</p>
        </div>
        <div className="rounded-xl border bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Out of Stock</p>
          <p className="text-2xl font-semibold">{outOfStock.length}</p>
        </div>
        <div className="rounded-xl border bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">สินค้าใกล้หมด</p>
          <p className="text-2xl font-semibold">{lowButNotEmpty.length}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" nativeButton={false} render={<a href="/api/export-low-stock" download />}>
          <Download className="h-4 w-4" />
          ส่งออก
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="whitespace-nowrap">รหัส</TableHead>
              <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
              <TableHead className="whitespace-nowrap">หมวดหมู่</TableHead>
              <TableHead className="text-right whitespace-nowrap">ปัจจุบัน</TableHead>
              <TableHead className="text-right whitespace-nowrap">ขั้นต่ำ</TableHead>
              <TableHead className="text-right whitespace-nowrap">ขาด</TableHead>
              <TableHead className="whitespace-nowrap">หน่วย</TableHead>
              <TableHead className="whitespace-nowrap">ตำแหน่งจัดเก็บ</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lowStockItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={TOTAL_COLUMNS} className="text-center text-muted-foreground">
                  ไม่มีสินค้าที่ใกล้หมดหรือหมดสต๊อก
                </TableCell>
              </TableRow>
            )}
            {lowStockItems.map((p) => {
              const isOut = p.quantityOnHand <= 0;
              const shortfall = Math.max(0, p.reorderPoint - p.quantityOnHand);
              return (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">
                    {isOut ? (
                      <Badge variant="destructive">
                        <PackageX className="h-3 w-3" />
                        OUT OF STOCK
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        สินค้าใกล้หมด
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{p.sku ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{p.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.category ? <Badge variant="outline">{p.category}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{p.quantityOnHand}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{p.reorderPoint}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{shortfall}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.unit}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.location ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {canRecord && (
                      <Button size="sm" onClick={() => setRecordProduct(p)}>
                        <PackagePlus className="h-3.5 w-3.5" />
                        Record IN
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">{lowStockItems.length} รายการที่ถึงหรือต่ำกว่าระดับขั้นต่ำ</p>

      <RecordInDialog product={recordProduct} onOpenChange={(open) => !open && setRecordProduct(null)} />
    </div>
  );
}
