"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "มีแผนกนี้อยู่แล้ว";
  return error.message;
}

function revalidateDepartmentConsumers() {
  revalidatePath("/dashboard/stock-requisition/departments");
  revalidatePath("/dashboard/stock-requisition/new");
}

export async function createDepartment(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อแผนก" };

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({ name });
  if (error) return { error: friendlyError(error) };

  revalidateDepartmentConsumers();
  return { error: null };
}

export async function updateDepartment(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อแผนก" };

  const supabase = await createClient();
  const { error } = await supabase.from("departments").update({ name }).eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidateDepartmentConsumers();
  return { error: null };
}

export async function deleteDepartment(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateDepartmentConsumers();
  return { error: null };
}
