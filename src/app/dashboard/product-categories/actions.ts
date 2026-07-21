"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "มีหมวดหมู่นี้อยู่แล้ว";
  return error.message;
}

function revalidateCategoryConsumers() {
  revalidatePath("/dashboard/product-categories");
  revalidatePath("/dashboard/stock-product");
  revalidatePath("/dashboard/stock-product/new");
  revalidatePath("/dashboard/project-sales");
  revalidatePath("/dashboard/project-sales/new");
}

export async function createProductCategory(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อหมวดหมู่" };
  const description = String(formData.get("description") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").insert({ name, description });
  if (error) return { error: friendlyError(error) };

  revalidateCategoryConsumers();
  return { error: null };
}

export async function updateProductCategory(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อหมวดหมู่" };
  const description = String(formData.get("description") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").update({ name, description }).eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidateCategoryConsumers();
  return { error: null };
}

export async function deleteProductCategory(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateCategoryConsumers();
  return { error: null };
}
