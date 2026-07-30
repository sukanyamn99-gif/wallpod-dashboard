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

  let profileError = (await supabase
    .from("profiles")
    .insert({ id: signUpData.user.id, full_name: fullName, role, department })).error;
  if (profileError?.code === "23503") {
    // A foreign-key failure here means the id signUp() returned doesn't
    // actually exist in auth.users. Two known causes: (1) genuine replication
    // lag right after a real account was created — a short retry covers this;
    // (2) this email already has an unconfirmed pending signup from an earlier
    // attempt, in which case Supabase deliberately returns a decoy response
    // (no error, a fake id) to avoid leaking which emails are registered —
    // retrying will keep failing the same way no matter how long you wait,
    // since there's nothing to become consistent. Only an admin can clear the
    // stuck pending signup (Supabase Studio → Authentication → Users → delete
    // the unconfirmed entry for that email), which is why the message below
    // doesn't just say "try again."
    await new Promise((resolve) => setTimeout(resolve, 800));
    profileError = (await supabase
      .from("profiles")
      .insert({ id: signUpData.user.id, full_name: fullName, role, department })).error;
  }
  if (profileError) {
    return {
      error:
        profileError.code === "23503"
          ? "สร้างบัญชีไม่สำเร็จ — อีเมลนี้อาจเคยถูกใช้สร้างบัญชีที่ยังไม่ได้ยืนยันมาก่อน ลองใหม่อีกครั้งในอีกสักครู่ หากยังไม่สำเร็จซ้ำด้วยอีเมลเดิม กรุณาลบบัญชีที่ค้างอยู่ใน Supabase Studio (Authentication → Users) หรือใช้อีเมลอื่นแทน"
          : profileError.message,
    };
  }

  revalidatePath("/dashboard/users");
  return { error: null, needsConfirmation: !signUpData.session };
}
