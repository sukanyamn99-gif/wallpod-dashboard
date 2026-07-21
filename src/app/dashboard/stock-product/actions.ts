"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProductCategory } from "@/lib/types";

const PRODUCT_CATEGORIES: ProductCategory[] = [
  "WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER",
];

const IMAGE_BUCKET = "stock-product-images";

type ParsedStockProduct = {
  ok: true;
  sku: string | null;
  name: string;
  category: ProductCategory | null;
  color: string | null;
  size: string | null;
  thickness: string | null;
  location: string | null;
  note: string | null;
  unit: string;
  reorderPoint: number;
  unitCost: number;
  sellingPrice: number | null;
};

function parseStockProductForm(formData: FormData): { ok: false; error: string } | ParsedStockProduct {
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "");
  const category = PRODUCT_CATEGORIES.includes(categoryRaw as ProductCategory)
    ? (categoryRaw as ProductCategory)
    : null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const size = String(formData.get("size") ?? "").trim() || null;
  const thickness = String(formData.get("thickness") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const note = String(formData.get("product_note") ?? "").trim() || null;
  const unit = String(formData.get("unit") ?? "").trim() || "ชิ้น";
  const reorderPoint = Number(formData.get("reorder_point") ?? 0);
  const unitCost = Number(formData.get("unit_cost") ?? 0);
  const sellingPriceRaw = String(formData.get("selling_price") ?? "").trim();
  const sellingPrice = sellingPriceRaw === "" ? null : Number(sellingPriceRaw);

  if (!name) return { ok: false, error: "กรุณากรอกชื่อสินค้า" };

  return {
    ok: true,
    sku,
    name,
    category,
    color,
    size,
    thickness,
    location,
    note,
    unit,
    reorderPoint: Number.isFinite(reorderPoint) ? reorderPoint : 0,
    unitCost: Number.isFinite(unitCost) ? unitCost : 0,
    sellingPrice: sellingPrice !== null && Number.isFinite(sellingPrice) ? sellingPrice : null,
  };
}

async function uploadProductImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  file: File,
): Promise<string | null> {
  const path = `${productId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    contentType: "image/jpeg",
  });
  return error ? null : path;
}

export async function createStockProduct(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseStockProductForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const initialQty = Number(formData.get("initial_quantity") ?? 0);

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("stock_products")
    .insert({
      sku: parsed.sku,
      name: parsed.name,
      category: parsed.category,
      color: parsed.color,
      size: parsed.size,
      thickness: parsed.thickness,
      location: parsed.location,
      note: parsed.note,
      unit: parsed.unit,
      reorder_point: parsed.reorderPoint,
      unit_cost: parsed.unitCost,
      selling_price: parsed.sellingPrice,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (Number.isFinite(initialQty) && initialQty > 0) {
    const { error: movementErr } = await supabase.rpc("record_stock_movement", {
      p_product_id: product.id,
      p_type: "in",
      p_qty: initialQty,
      p_note: "สต๊อกเริ่มต้น",
    });
    if (movementErr) {
      return { error: `บันทึกสินค้าสำเร็จ แต่บันทึกจำนวนเริ่มต้นไม่สำเร็จ: ${movementErr.message}` };
    }
  }

  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    const path = await uploadProductImage(supabase, product.id, imageFile);
    if (path) {
      const { error: imageErr } = await supabase
        .from("stock_products")
        .update({ image_path: path })
        .eq("id", product.id);
      if (imageErr) return { error: `บันทึกสินค้าสำเร็จ แต่บันทึกรูปภาพไม่สำเร็จ: ${imageErr.message}` };
    }
  }

  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/inventory");
  return { error: null };
}

export async function updateStockProduct(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseStockProductForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stock_products")
    .update({
      sku: parsed.sku,
      name: parsed.name,
      category: parsed.category,
      color: parsed.color,
      size: parsed.size,
      thickness: parsed.thickness,
      location: parsed.location,
      note: parsed.note,
      unit: parsed.unit,
      reorder_point: parsed.reorderPoint,
      unit_cost: parsed.unitCost,
      selling_price: parsed.sellingPrice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  const removeImage = formData.get("remove_image") === "1";
  const imageFile = formData.get("image");
  const hasNewImage = imageFile instanceof File && imageFile.size > 0;

  if (removeImage || hasNewImage) {
    const { data: current } = await supabase.from("stock_products").select("image_path").eq("id", id).single();
    const oldPath = current?.image_path ?? null;
    if (oldPath) {
      await supabase.storage.from(IMAGE_BUCKET).remove([oldPath]);
    }

    const newPath = hasNewImage ? await uploadProductImage(supabase, id, imageFile as File) : null;
    const { error: imageErr } = await supabase.from("stock_products").update({ image_path: newPath }).eq("id", id);
    if (imageErr) return { error: `บันทึกข้อมูลสำเร็จ แต่บันทึกรูปภาพไม่สำเร็จ: ${imageErr.message}` };
  }

  revalidatePath(`/dashboard/stock-product/edit/${id}`);
  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/inventory");
  return { error: null };
}

export async function deleteStockProduct(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();

  // Best-effort: clean up the product's image folder before deleting the row.
  const { data: files } = await supabase.storage.from(IMAGE_BUCKET).list(id);
  if (files && files.length > 0) {
    await supabase.storage.from(IMAGE_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
  }

  const { error } = await supabase.from("stock_products").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/inventory");
  return { error: null };
}

export async function recordStockMovement(productId: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const movementType = String(formData.get("movement_type") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

  if (movementType !== "in" && movementType !== "out") return { error: "กรุณาเลือกประเภทการเคลื่อนไหว" };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "กรุณากรอกจำนวนให้ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_product_id: productId,
    p_type: movementType,
    p_qty: quantity,
    p_note: note,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/inventory");
  return { error: null };
}
