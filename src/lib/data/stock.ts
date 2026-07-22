import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProductCategory, StockDashboardData, StockMovement, StockProduct } from "@/lib/types";

const STOCK_PRODUCT_COLUMNS =
  "id, sku, name, category, color, size, thickness, location, note, unit, quantity_on_hand, reorder_point, unit_cost, selling_price, image_path, created_at, updated_at";

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

export async function getStockDashboardData(): Promise<StockDashboardData> {
  const products = await getStockProducts();

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
  };
}
