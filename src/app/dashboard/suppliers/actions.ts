"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "มีผู้จำหน่ายรายนี้อยู่แล้ว";
  return error.message;
}

function revalidateSupplierConsumers() {
  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/goods-receipt/new");
}

function supplierFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim() || null,
    tax_id: String(formData.get("tax_id") ?? "").trim() || null,
    branch: String(formData.get("branch") ?? "").trim() || null,
  };
}

export async function createSupplier(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const fields = supplierFields(formData);
  if (!fields.name) return { error: "กรุณากรอกชื่อผู้จำหน่าย" };

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert(fields);
  if (error) return { error: friendlyError(error) };

  revalidateSupplierConsumers();
  return { error: null };
}

export async function updateSupplier(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const fields = supplierFields(formData);
  if (!fields.name) return { error: "กรุณากรอกชื่อผู้จำหน่าย" };

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(fields).eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidateSupplierConsumers();
  return { error: null };
}

export async function deleteSupplier(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateSupplierConsumers();
  return { error: null };
}
