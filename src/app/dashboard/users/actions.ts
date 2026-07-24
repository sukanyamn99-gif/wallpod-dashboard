"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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

function friendlySignUpError(message: string): string {
  if (message.toLowerCase().includes("already registered")) return "มีบัญชีนี้ในระบบแล้ว";
  return message;
}

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

export async function createUserAccount(
  formData: FormData,
): Promise<{ error: string | null; needsConfirmation?: boolean }> {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถสร้างบัญชีได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "owner") {
    return { error: "เฉพาะเจ้าของกิจการเท่านั้นที่เพิ่มผู้ใช้งานได้" };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");
  const department = String(formData.get("department") ?? "").trim() || null;

  if (!fullName) return { error: "กรุณากรอกชื่อ-นามสกุล" };
  if (!email) return { error: "กรุณากรอกอีเมล" };
  if (password.length < 6) return { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };
  if (!VALID_ROLES.includes(role as Role)) return { error: "สิทธิ์ไม่ถูกต้อง" };

  // A fresh, non-cookie-bound client so this signUp never touches the owner's
  // own session cookies — auth.signUp() has no caller-identity requirement of
  // its own, which is why the owner check above happens before this point.
  const signupClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: signUpData, error: signUpError } = await signupClient.auth.signUp({ email, password });
  if (signUpError) return { error: friendlySignUpError(signUpError.message) };
  if (!signUpData.user) return { error: "สร้างบัญชีไม่สำเร็จ" };

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: signUpData.user.id, full_name: fullName, role, department });
  if (profileError) return { error: profileError.message };

  revalidatePath("/dashboard/users");
  return { error: null, needsConfirmation: !signUpData.session };
}
