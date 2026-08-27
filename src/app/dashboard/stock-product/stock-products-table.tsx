"use client";

import { useActionState, useMemo, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { Check, Layers, PackagePlus, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { canSeeCosts } from "@/lib/permissions";
import { deleteStockProduct, recordStockMovement } from "./actions";
import type { Profile, StockProduct, StockProductLot } from "@/lib/types";

const movementInitialState = { error: null as string | null };

// The first 6 columns (รูป through ความหนา) stay pinned to the left edge
// while the rest of this wide table scrolls horizontally — fixed widths
// are required so each column's sticky `left` offset lines up exactly
// between the header row and every body row (same pattern as the
// WALLPOD Project Sales report table).
const FROZEN_COL_WIDTHS = [56, 90, 180, 110, 100, 90];
const FROZEN_COL_OFFSETS = FROZEN_COL_WIDTHS.reduce<number[]>((acc, w, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + FROZEN_COL_WIDTHS[i - 1]);
  return acc;
}, []);

function frozenColStyle(index: number): CSSProperties {
  return {
    left: FROZEN_COL_OFFSETS[index],
    width: FROZEN_COL_WIDTHS[index],
    minWidth: FROZEN_COL_WIDTHS[index],
    maxWidth: FROZEN_COL_WIDTHS[index],
  };
}

function canManage(profile: Profile) {
  return profile.role === "owner" || profile.role === "manager";
}

function canRecordMovement(profile: Profile) {
  return profile.role === "owner" || profile.role === "manager" || profile.role === "production";
}

function DeleteButton({ product }: { product: StockProduct }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteStockProduct(product.id);
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
            title={`ยืนยันลบ "${product.name}" ถาวร`}
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
                <NumberInput id="quantity" name="quantity" min={0} step={1} required placeholder="0" />
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

function LotsDialog({
  product,
  lots,
  showCosts,
  onOpenChange,
}: {
  product: StockProduct | null;
  lots: StockProductLot[];
  showCosts: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lotTotal = lots.reduce((sum, l) => sum + l.quantityRemaining, 0);
  const unspecified = product ? Math.max(0, product.quantityOnHand - lotTotal) : 0;

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>Lot คงเหลือ — {product.name}</DialogTitle>
              <DialogDescription>
                รวมคงเหลือ {product.quantityOnHand} {product.unit}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3 py-4">
              {lots.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่มีข้อมูล Lot สำหรับสินค้านี้</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">วันที่รับเข้า</TableHead>
                      <TableHead className="text-right whitespace-nowrap">คงเหลือ / รับเข้า</TableHead>
                      {showCosts && <TableHead className="text-right whitespace-nowrap">ต้นทุน/หน่วย</TableHead>}
                      <TableHead className="whitespace-nowrap">เลขที่อ้างอิง</TableHead>
                      <TableHead className="whitespace-nowrap">หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(lot.receivedAt).toLocaleDateString("th-TH")}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {lot.quantityRemaining} / {lot.quantityReceived} {product.unit}
                        </TableCell>
                        {showCosts && (
                          <TableCell className="text-right whitespace-nowrap">{formatTHB(lot.unitCost)}</TableCell>
                        )}
                        <TableCell className="whitespace-nowrap">{lot.referenceNo ?? "—"}</TableCell>
                        <TableCell className="max-w-[12rem] whitespace-normal">{lot.note ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {unspecified > 0 && (
                <p className="text-xs text-muted-foreground">
                  คงเหลือ {unspecified} {product.unit} ไม่ทราบ Lot ที่มา (สต็อกเดิมก่อนเริ่มใช้ระบบ Lot หรือรับเข้าแบบไม่ผ่านใบรับสินค้า)
                </p>
              )}
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StockProductsTable({
  products,
  currentProfile,
  imageUrls,
  lotsByProduct,
}: {
  products: StockProduct[];
  currentProfile: Profile;
  imageUrls: Record<string, string>;
  lotsByProduct: Record<string, StockProductLot[]>;
}) {
  const [query, setQuery] = useState("");
  const [movementProduct, setMovementProduct] = useState<StockProduct | null>(null);
  const [lotsProduct, setLotsProduct] = useState<StockProduct | null>(null);
  const showCosts = canSeeCosts(currentProfile.role);
  const totalColumns = showCosts ? 15 : 13;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.size ?? "").toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหา รหัส / ชื่อสินค้า / หมวดหมู่ / ขนาด / ตำแหน่งจัดเก็บ"
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table containerClassName="max-h-[70vh] overflow-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(0)}>รูป</TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(1)}>รหัส</TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(2)}>ชื่อสินค้า</TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(3)}>หมวดหมู่</TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(4)}>ขนาด</TableHead>
              <TableHead className="sticky top-0 z-20 truncate bg-card" style={frozenColStyle(5)}>ความหนา</TableHead>
              <TableHead className="sticky top-0 z-10 text-right whitespace-nowrap bg-card">คงเหลือ</TableHead>
              <TableHead className="sticky top-0 z-10 text-right whitespace-nowrap bg-card">จุดสั่งซื้อ</TableHead>
              {showCosts && (
                <>
                  <TableHead className="sticky top-0 z-10 text-right whitespace-nowrap bg-card">ต้นทุน/หน่วย</TableHead>
                  <TableHead className="sticky top-0 z-10 text-right whitespace-nowrap bg-card">มูลค่าคงเหลือ</TableHead>
                </>
              )}
              <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-card">ตำแหน่งจัดเก็บ</TableHead>
              <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-card">สถานะ</TableHead>
              <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-card">อัปเดตล่าสุด</TableHead>
              <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-card">หมายเหตุ</TableHead>
              <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-card">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const isLow = p.quantityOnHand <= p.reorderPoint;
              const imageUrl = p.imagePath ? imageUrls[p.imagePath] : undefined;
              return (
                <TableRow key={p.id}>
                  <TableCell className="sticky z-10 bg-card" style={frozenColStyle(0)}>
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={p.name}
                        className="h-10 w-10 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="sticky z-10 truncate bg-card" style={frozenColStyle(1)}>{p.sku ?? "—"}</TableCell>
                  <TableCell className="sticky z-10 truncate bg-card font-medium" style={frozenColStyle(2)}>{p.name}</TableCell>
                  <TableCell className="sticky z-10 truncate bg-card" style={frozenColStyle(3)}>{p.category ?? "—"}</TableCell>
                  <TableCell className="sticky z-10 truncate bg-card" style={frozenColStyle(4)}>{p.size ?? "—"}</TableCell>
                  <TableCell className="sticky z-10 truncate bg-card" style={frozenColStyle(5)}>{p.thickness ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {p.quantityOnHand} {p.unit}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {p.reorderPoint} {p.unit}
                  </TableCell>
                  {showCosts && (
                    <>
                      <TableCell className="text-right whitespace-nowrap">{formatTHB(p.unitCost)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatTHB(p.quantityOnHand * p.unitCost)}
                      </TableCell>
                    </>
                  )}
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
                      {(lotsByProduct[p.id]?.length ?? 0) > 0 && (
                        <Button size="icon-sm" variant="outline" onClick={() => setLotsProduct(p)} title="ดู Lot คงเหลือ">
                          <Layers className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
      <LotsDialog
        product={lotsProduct}
        lots={lotsProduct ? (lotsByProduct[lotsProduct.id] ?? []) : []}
        showCosts={showCosts}
        onOpenChange={(open) => !open && setLotsProduct(null)}
      />
    </div>
  );
}
