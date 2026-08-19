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

function friendlyCreateUserError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already been registered") || lower.includes("already registered")) {
    return "มีบัญชีนี้ในระบบแล้ว";
  }
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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์ — ไม่สามารถสร้างบัญชีผู้ใช้งานได้" };
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

  // Uses the service-role key server-side only (never sent to the browser) via
  // the trusted admin API instead of the public signUp() endpoint — signUp()
  // proved unreliable in production for three separate reasons: a decoy
  // response for emails with a stuck pending signup, Supabase's default
  // email-send rate limit (confirmation emails), and its public email
  // validator rejecting some genuinely valid addresses outright. The admin
  // API creates the account synchronously with none of those failure modes,
  // and email_confirm:true means the new user can log in immediately.
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) return { error: friendlyCreateUserError(createError.message) };
  if (!createdUser.user) return { error: "สร้างบัญชีไม่สำเร็จ" };

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: createdUser.user.id, full_name: fullName, role, department });
  if (profileError) {
    // The auth account exists but has no profile row — best-effort cleanup so
    // a failed attempt doesn't leave a stuck account behind (unlike the old
    // signUp()-based flow, we have the admin API right here to reverse it).
    await adminClient.auth.admin.deleteUser(createdUser.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/dashboard/users");
  return { error: null, needsConfirmation: false };
}
