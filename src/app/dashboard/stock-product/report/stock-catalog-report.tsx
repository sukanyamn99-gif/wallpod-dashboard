"use client";

import { useMemo, useState } from "react";
import { FilterX, ImageOff, MapPin, Phone, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StockProduct } from "@/lib/types";

// Matches the company's own printed COLOR CHART sheet so the printout looks
// like their real document rather than a generic app report.
function Letterhead() {
  return (
    <div>
      <div className="flex items-start justify-between pb-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-black">COLOR CHART</p>
          <p className="text-base font-semibold text-black">THEWALLPOD.COM</p>
          <div className="mt-2 space-y-1 text-xs text-neutral-700">
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              24/3 H-CAPE BIZ PLUS, SOI SUKHAPHIBAN 2, PRAWET, BANGKOK 10250
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 shrink-0" />
              (+66) 2 329 1336 – 9
            </p>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static print asset in public/, no benefit from next/image's runtime optimization here */}
        <img src="/wallpod-logo.png" alt="WallPOD" className="h-14 w-auto" />
      </div>
      <div className="border-t-2 border-neutral-800" />
    </div>
  );
}

function SwatchCard({
  product,
  imageUrl,
  showCode,
  previewMode = false,
}: {
  product: StockProduct;
  imageUrl: string | null;
  showCode: boolean;
  // The print-preview overlay is itself print:hidden (never actually
  // prints), so it needs the SKU line to actually appear/disappear on
  // screen to simulate what will print. The real report page, outside the
  // overlay, is what actually gets printed — there the SKU line always
  // shows on screen and print:hidden (not previewMode's plain removal)
  // controls whether it survives into the real printout.
  previewMode?: boolean;
}) {
  const lowStock = product.quantityOnHand <= product.reorderPoint;
  return (
    <div className="rounded-lg border bg-white p-2 shadow-sm print:break-inside-avoid print:shadow-none">
      <div className="relative aspect-square overflow-hidden rounded-md bg-neutral-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URLs, not a static/local asset next/image can optimize
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-neutral-400">
            <ImageOff className="h-5 w-5" />
            <span className="text-[10px]">ไม่มีรูป</span>
          </div>
        )}
        <span
          className={`absolute right-1 top-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold shadow-sm ${
            lowStock ? "border-destructive/40 bg-destructive/90 text-white" : "border-neutral-300 bg-white text-neutral-900"
          }`}
          title="จำนวนคงเหลือ"
        >
          {product.quantityOnHand}
        </span>
      </div>
      <div className="mt-1.5 text-center">
        {previewMode
          ? showCode &&
            product.sku && <p className="truncate text-[9px] font-medium text-neutral-500">{product.sku}</p>
          : product.sku && (
              <p className={`truncate text-[9px] font-medium text-neutral-500 ${showCode ? "" : "print:hidden"}`}>
                {product.sku}
              </p>
            )}
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-800" title={product.name}>
          {product.name}
        </p>
        {(product.size || product.thickness) && (
          <p className="truncate text-[9px] text-neutral-500">
            {product.size && `${product.size} มม.`}
            {product.size && product.thickness && " • "}
            {product.thickness && `หนา ${product.thickness} มม.`}
          </p>
        )}
      </div>
    </div>
  );
}

function CatalogGrid({
  products,
  imageUrls,
  showCode,
  previewMode,
  className,
}: {
  products: StockProduct[];
  imageUrls: Record<string, string>;
  showCode: boolean;
  previewMode?: boolean;
  className: string;
}) {
  return (
    <div className={className}>
      {products.map((p) => (
        <SwatchCard
          key={p.id}
          product={p}
          imageUrl={p.imagePath ? (imageUrls[p.imagePath] ?? null) : null}
          showCode={showCode}
          previewMode={previewMode}
        />
      ))}
    </div>
  );
}

export function StockCatalogReport({
  products,
  imageUrls,
  categories,
}: {
  products: StockProduct[];
  imageUrls: Record<string, string>;
  categories: string[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showCode, setShowCode] = useState(true);

  const categoryOptions = [{ value: "all", label: "ทุกหมวดหมู่" }, ...categories.map((c) => ({ value: c, label: c }))];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.color ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, category]);

  function clearFilters() {
    setSearch("");
    setCategory("all");
  }

  return (
    <div className="space-y-4">
      {/* Screen-hidden, print-only — shows only when the browser is actually
          printing (or the on-screen preview below is open). */}
      <div className="hidden print:block">
        <Letterhead />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Input
          placeholder="ค้นหาชื่อสินค้า, รหัส, สี..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[220px]"
        />
        <Select value={category} onValueChange={(v) => setCategory((v as string) ?? "all")} items={categoryOptions}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ทุกหมวดหมู่" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={clearFilters}>
          <FilterX className="h-4 w-4" />
          เคลียร์ตัวกรอง
        </Button>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          <Printer className="h-4 w-4" />
          พิมพ์
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          แสดง {filtered.length} จาก {products.length} รายการ
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">ไม่พบสินค้า</div>
      ) : (
        <CatalogGrid
          products={filtered}
          imageUrls={imageUrls}
          showCode={showCode}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 print:grid-cols-6 print:gap-2"
        />
      )}

      {/* On-screen preview of exactly what will print, before the OS print
          dialog opens — this overlay itself is print:hidden so it never
          appears in the actual printout; only the blocks above (marked
          print:block / print:grid-*) do, driven by the real @media print. */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/60 p-4 print:hidden">
          <div className="mx-auto max-w-5xl rounded-lg bg-white p-6 text-black shadow-xl">
            <div className="mb-4 flex items-center justify-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showCode}
                  onChange={(e) => setShowCode(e.target.checked)}
                  className="h-4 w-4"
                />
                แสดงรหัส
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                  <X className="h-4 w-4" />
                  ปิดตัวอย่าง
                </Button>
                <Button onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  พิมพ์
                </Button>
              </div>
            </div>
            <Letterhead />
            <div className="mt-4">
              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-neutral-500">ไม่พบสินค้า</p>
              ) : (
                <CatalogGrid
                  products={filtered}
                  imageUrls={imageUrls}
                  showCode={showCode}
                  previewMode
                  className="grid grid-cols-6 gap-2"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
