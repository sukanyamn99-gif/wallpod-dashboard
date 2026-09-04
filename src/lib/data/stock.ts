import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { DeadStockItem, ProductCategory, StockDashboardData, StockMovement, StockProduct, StockProductLot, StockType } from "@/lib/types";

// A product counts as Dead Stock once it's sat with no in/out movement for
// this many months — matches the definition the user gave directly, not an
// industry-standard threshold.
const DEAD_STOCK_MONTHS = 6;

const STOCK_PRODUCT_COLUMNS =
  "id, sku, name, category, color, size, thickness, location, note, unit, quantity_on_hand, reorder_point, unit_cost, selling_price, image_path, stock_type, created_at, updated_at";

const IMAGE_BUCKET = "stock-product-images";

function mapRow(row: {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  color: string | null;
  size: string | null;
  thickness: string | null;
  location: string | null;
  note: string | null;
  unit: string;
  quantity_on_hand: string | number;
  reorder_point: string | number;
  unit_cost: string | number;
  selling_price: string | number | null;
  image_path: string | null;
  stock_type: string;
  created_at: string;
  updated_at: string;
}): StockProduct {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category as ProductCategory | null,
    color: row.color,
    size: row.size,
    thickness: row.thickness,
    location: row.location,
    note: row.note,
    unit: row.unit,
    quantityOnHand: Number(row.quantity_on_hand),
    reorderPoint: Number(row.reorder_point),
    unitCost: Number(row.unit_cost),
    sellingPrice: row.selling_price === null ? null : Number(row.selling_price),
    imagePath: row.image_path,
    stockType: row.stock_type as StockType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getStockProducts(): Promise<StockProduct[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_products")
    .select(STOCK_PRODUCT_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getStockProductById(id: string): Promise<StockProduct | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_products")
    .select(STOCK_PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function getDistinctStockSizes(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.from("stock_products").select("size").not("size", "is", null);

  if (error) throw error;
  const sizes = new Set((data ?? []).map((row) => row.size as string).filter((s) => s.trim().length > 0));
  return Array.from(sizes).sort();
}

export async function getFrequentlyUsedStockProducts(limit = 6): Promise<StockProduct[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("stock_product_id, created_at")
    .eq("movement_type", "out")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (seen.has(row.stock_product_id)) continue;
    seen.add(row.stock_product_id);
    orderedIds.push(row.stock_product_id);
    if (orderedIds.length >= limit) break;
  }
  if (orderedIds.length === 0) return [];

  const { data: productRows, error: productsErr } = await supabase
    .from("stock_products")
    .select(STOCK_PRODUCT_COLUMNS)
    .in("id", orderedIds);
  if (productsErr) throw productsErr;

  const byId = new Map((productRows ?? []).map((row) => [row.id, mapRow(row)]));
  return orderedIds.map((id) => byId.get(id)).filter((p): p is StockProduct => p !== undefined);
}

export async function getStockMovements(): Promise<StockMovement[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, stock_product_id, movement_type, quantity, note, created_at, balance_before, balance_after, reference_no, stock_products(sku, name, unit), profiles(full_name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    stockProductId: row.stock_product_id,
    movementType: row.movement_type as "in" | "out",
    quantity: Number(row.quantity),
    note: row.note,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    createdByName: row.profiles?.full_name ?? "",
    createdAt: row.created_at,
    balanceBefore: row.balance_before === null ? null : Number(row.balance_before),
    balanceAfter: row.balance_after === null ? null : Number(row.balance_after),
    referenceNo: row.reference_no,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    productSku: row.stock_products?.sku ?? null,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    productName: row.stock_products?.name ?? "",
    // @ts-expect-error -- Supabase types the joined relation loosely here
    unit: row.stock_products?.unit ?? "",
  }));
}

export async function getSignedStockProductImageUrl(path: string | null): Promise<string | null> {
  if (!path || !isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function getSignedStockProductImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || paths.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return {};

  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}

export async function getStockProductLotsByProduct(): Promise<Record<string, StockProductLot[]>> {
  if (!isSupabaseConfigured()) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_product_lots")
    .select("id, stock_product_id, quantity_received, quantity_remaining, unit_cost, reference_no, received_at")
    .gt("quantity_remaining", 0)
    .order("received_at", { ascending: true });
  if (error) throw error;

  // Lots have no note of their own — pull the originating goods receipt's
  // note by matching reference_no to doc_no (the same key used to keep the
  // lot in sync on edit/delete).
  const docNos = Array.from(new Set((data ?? []).map((row) => row.reference_no).filter((r): r is string => !!r)));
  const noteByDocNo = new Map<string, string | null>();
  if (docNos.length > 0) {
    const { data: receipts } = await supabase.from("goods_receipts").select("doc_no, note").in("doc_no", docNos);
    for (const r of receipts ?? []) noteByDocNo.set(r.doc_no, r.note);
  }

  const byProduct: Record<string, StockProductLot[]> = {};
  for (const row of data ?? []) {
    const lot: StockProductLot = {
      id: row.id,
      stockProductId: row.stock_product_id,
      quantityReceived: Number(row.quantity_received),
      quantityRemaining: Number(row.quantity_remaining),
      unitCost: Number(row.unit_cost),
      referenceNo: row.reference_no,
      receivedAt: row.received_at,
      note: row.reference_no ? (noteByDocNo.get(row.reference_no) ?? null) : null,
    };
    (byProduct[lot.stockProductId] ??= []).push(lot);
  }
  return byProduct;
}

export async function getStockDashboardData(): Promise<StockDashboardData> {
  const [products, movements] = await Promise.all([getStockProducts(), getStockMovements()]);

  const lowStockItems = products
    .filter((p) => p.quantityOnHand <= p.reorderPoint)
    .sort((a, b) => a.quantityOnHand - a.reorderPoint - (b.quantityOnHand - b.reorderPoint));

  const byCategory = new Map<string, { value: number; count: number }>();
  for (const p of products) {
    const key = p.category ?? "OTHER";
    const entry = byCategory.get(key) ?? { value: 0, count: 0 };
    entry.value += p.quantityOnHand * p.unitCost;
    entry.count += 1;
    byCategory.set(key, entry);
  }

  // Last movement per product — the app's own `updatedAt` on stock_products
  // also changes on non-movement edits (renaming, changing reorder point),
  // so it can't stand in for "last time this actually moved"; movements are
  // the real signal.
  const lastMovementByProduct = new Map<string, string>();
  for (const m of movements) {
    const existing = lastMovementByProduct.get(m.stockProductId);
    if (!existing || new Date(m.createdAt) > new Date(existing)) {
      lastMovementByProduct.set(m.stockProductId, m.createdAt);
    }
  }

  const now = Date.now();
  const deadStockCutoff = new Date();
  deadStockCutoff.setMonth(deadStockCutoff.getMonth() - DEAD_STOCK_MONTHS);

  const deadStockItems: DeadStockItem[] = products
    // Only stock actually sitting on hand counts as "dead" — a product with
    // zero quantity that hasn't moved is just out of stock, not dead stock.
    .filter((p) => p.quantityOnHand > 0)
    .map((p) => {
      const lastMovement = lastMovementByProduct.get(p.id);
      const lastActivityAt = lastMovement ?? p.createdAt;
      return {
        ...p,
        lastActivityAt,
        neverMoved: !lastMovement,
        daysIdle: Math.floor((now - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)),
      };
    })
    .filter((p) => new Date(p.lastActivityAt) < deadStockCutoff)
    .sort((a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime());

  return {
    skuCount: products.length,
    totalStockValue: products.reduce((sum, p) => sum + p.quantityOnHand * p.unitCost, 0),
    lowStockCount: lowStockItems.length,
    categoryBreakdown: Array.from(byCategory.entries()).map(([category, { value, count }]) => ({
      category,
      value,
      count,
    })),
    lowStockItems,
    deadStockCount: deadStockItems.length,
    deadStockValue: deadStockItems.reduce((sum, p) => sum + p.quantityOnHand * p.unitCost, 0),
    deadStockItems,
  };
}
