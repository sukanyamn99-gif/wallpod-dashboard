"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const VALID_ROLES: Role[] = [
  "owner",
  "manager",
  "sales",
  "design",
  "support_sale",
  "account",
  "foreman",
  "production",
];

export async function updateUserAccount(userId: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const role = String(formData.get("role") ?? "");
  if (!VALID_ROLES.includes(role as Role)) return { error: "สิทธิ์ไม่ถูกต้อง" };
  const department = String(formData.get("department") ?? "").trim() || null;
  const active = formData.get("active") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, department, active })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/users");
  return { error: null };
}
