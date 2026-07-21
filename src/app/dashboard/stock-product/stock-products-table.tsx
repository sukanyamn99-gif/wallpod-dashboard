"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { PackagePlus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { deleteStockProduct, recordStockMovement } from "./actions";
import type { Profile, StockProduct } from "@/lib/types";

const TOTAL_COLUMNS = 15;

const movementInitialState = { error: null as string | null };

function canManage(profile: Profile) {
  return profile.role === "owner" || profile.role === "manager";
}

function canRecordMovement(profile: Profile) {
  return profile.role === "owner" || profile.role === "manager" || profile.role === "production";
}

function DeleteButton({ product }: { product: StockProduct }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`ยืนยันลบสินค้า "${product.name}" ถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStockProduct(product.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="icon-sm" variant="destructive" onClick={handleDelete} disabled={pending}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function MovementSheet({
  product,
  onOpenChange,
}: {
  product: StockProduct | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: typeof movementInitialState, formData: FormData) => {
    if (!product) return movementInitialState;
    const result = await recordStockMovement(product.id, formData);
    if (!result.error) {
      setFormKey((k) => k + 1);
      onOpenChange(false);
    }
    return result;
  }, movementInitialState);

  return (
    <Sheet open={product !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        {product && (
          <>
            <SheetHeader>
              <SheetTitle>รับเข้า/เบิกออก</SheetTitle>
              <SheetDescription>
                {product.name} — คงเหลือ {product.quantityOnHand} {product.unit}
              </SheetDescription>
            </SheetHeader>
            <form key={formKey} action={formAction} className="space-y-4 px-4 pb-4">
              {state.error && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="movement_type">ประเภท</Label>
                <Select name="movement_type" required defaultValue="in">
                  <SelectTrigger id="movement_type" className="w-full">
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">รับเข้า</SelectItem>
                    <SelectItem value="out">เบิกออก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">จำนวน ({product.unit})</Label>
                <Input id="quantity" name="quantity" type="number" min="0" step="1" required placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">หมายเหตุ</Label>
                <Input id="note" name="note" placeholder="เช่น รับของจากซัพพลายเออร์" />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function StockProductsTable({
  products,
  currentProfile,
}: {
  products: StockProduct[];
  currentProfile: Profile;
}) {
  const [query, setQuery] = useState("");
  const [movementProduct, setMovementProduct] = useState<StockProduct | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.color ?? "").toLowerCase().includes(q) ||
        (p.size ?? "").toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหา รหัส / ชื่อสินค้า / หมวดหมู่ / สี / ขนาด / ตำแหน่งจัดเก็บ"
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">รหัส</TableHead>
              <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
              <TableHead className="whitespace-nowrap">หมวดหมู่</TableHead>
              <TableHead className="whitespace-nowrap">สี</TableHead>
              <TableHead className="whitespace-nowrap">ขนาด</TableHead>
              <TableHead className="whitespace-nowrap">ความหนา</TableHead>
              <TableHead className="text-right whitespace-nowrap">คงเหลือ</TableHead>
              <TableHead className="text-right whitespace-nowrap">จุดสั่งซื้อ</TableHead>
              <TableHead className="text-right whitespace-nowrap">ต้นทุน/หน่วย</TableHead>
              <TableHead className="text-right whitespace-nowrap">มูลค่าคงเหลือ</TableHead>
              <TableHead className="whitespace-nowrap">ตำแหน่งจัดเก็บ</TableHead>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="whitespace-nowrap">อัปเดตล่าสุด</TableHead>
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
            {filtered.map((p) => {
              const isLow = p.quantityOnHand <= p.reorderPoint;
              return (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{p.sku ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{p.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.category ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.color ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.size ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.thickness ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {p.quantityOnHand} {p.unit}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {p.reorderPoint} {p.unit}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatTHB(p.unitCost)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatTHB(p.quantityOnHand * p.unitCost)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{p.location ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {isLow ? (
                      <Badge variant="destructive">สินค้าใกล้หมด</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(p.updatedAt).toLocaleDateString("th-TH")}
                  </TableCell>
                  <TableCell className="max-w-[16rem] whitespace-normal">{p.note ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canRecordMovement(currentProfile) && (
                        <Button size="icon-sm" variant="outline" onClick={() => setMovementProduct(p)}>
                          <PackagePlus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canManage(currentProfile) && (
                        <>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            nativeButton={false}
                            render={<Link href={`/dashboard/stock-product/edit/${p.id}`} />}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <DeleteButton product={p} />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {products.length} รายการ
      </p>

      <MovementSheet product={movementProduct} onOpenChange={(open) => !open && setMovementProduct(null)} />
    </div>
  );
}
