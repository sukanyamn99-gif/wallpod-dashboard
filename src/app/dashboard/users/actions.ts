"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { ROLE_LABELS, type Role } from "@/lib/types";

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

function friendlyDeleteUserError(message: string): string {
  if (message.toLowerCase().includes("foreign key")) {
    return "ไม่สามารถลบผู้ใช้งานนี้ได้ เนื่องจากมีประวัติการทำรายการในระบบ (เช่น ใบรับสินค้า/ใบเบิก/ใบสำคัญจ่าย) — แนะนำให้ระงับการใช้งานแทนการลบ";
  }
  return message;
}

export async function updateUserAccount(userId: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "owner" && callerProfile?.role !== "manager") {
    return { error: "เฉพาะเจ้าของกิจการหรือผู้จัดการเท่านั้นที่แก้ไขผู้ใช้งานได้" };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const department = String(formData.get("department") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "กรุณากรอกชื่อ-นามสกุล" };
  if (!VALID_ROLES.includes(role as Role)) return { error: "สิทธิ์ไม่ถูกต้อง" };
  if (password && password.length < 6) return { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" };

  const { data: before } = await supabase.from("profiles").select("role, active").eq("id", userId).single();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, role, department, active })
    .eq("id", userId);
  if (profileError) return { error: profileError.message };

  // Only log when something risky actually changed — editing a name or
  // department isn't the kind of thing this log is for.
  if (before && before.role !== role) {
    await logActivity(
      "เปลี่ยนสิทธิ์ผู้ใช้งาน",
      `${fullName}: ${ROLE_LABELS[before.role as Role] ?? before.role} → ${ROLE_LABELS[role as Role] ?? role}`,
    );
  }
  if (before && before.active !== active) {
    await logActivity(active ? "เปิดใช้งานบัญชี" : "ระงับการใช้งานบัญชี", fullName);
  }

  // Email and password live in auth.users, not profiles, so they need the
  // admin API (same trusted, server-side-only service-role key already used
  // by createUserAccount) — the caller-is-owner check above happens before
  // this point specifically because this call bypasses RLS entirely.
  if (email || password) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        error:
          "บันทึกชื่อ/สิทธิ์/แผนกเรียบร้อย แต่ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์ — ไม่สามารถเปลี่ยนอีเมลหรือรหัสผ่านได้",
      };
    }
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const attrs: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (email) {
      attrs.email = email;
      attrs.email_confirm = true;
    }
    if (password) attrs.password = password;
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, attrs);
    if (authError) return { error: friendlyCreateUserError(authError.message) };
    if (password) await logActivity("รีเซ็ตรหัสผ่านผู้ใช้งาน", fullName);
  }

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

  await logActivity("สร้างผู้ใช้งานใหม่", `${fullName} (${ROLE_LABELS[role as Role] ?? role})`);
  revalidatePath("/dashboard/users");
  return { error: null, needsConfirmation: false };
}

export async function deleteUserAccount(userId: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์ — ไม่สามารถลบผู้ใช้งานได้" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "owner" && callerProfile?.role !== "manager") {
    return { error: "เฉพาะเจ้าของกิจการหรือผู้จัดการเท่านั้นที่ลบผู้ใช้งานได้" };
  }
  if (userId === user.id) return { error: "ไม่สามารถลบบัญชีของตัวเองได้" };

  const { data: target } = await supabase.from("profiles").select("full_name, role").eq("id", userId).single();
  if (!target) return { error: "ไม่พบผู้ใช้งานนี้" };

  // Never let the last owner account be deleted — would strand the system
  // with no one able to reach /dashboard/users, add accounts, or grant
  // owner-level access again.
  if (target.role === "owner") {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner");
    if ((count ?? 0) <= 1) return { error: "ไม่สามารถลบเจ้าของกิจการคนสุดท้ายได้" };
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  // profiles.id references auth.users(id) on delete cascade, so this also
  // removes the profile row — but tables that reference profiles for
  // historical attribution (stock_movements.created_by, goods_receipts.
  // received_by, payment_vouchers.recorded_by, etc.) have no cascade/set-null
  // on that FK, so deleting a user with any recorded activity fails with a
  // foreign-key violation rather than silently rewriting history.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) return { error: friendlyDeleteUserError(deleteError.message) };

  await logActivity("ลบผู้ใช้งาน", `${target.full_name} (${ROLE_LABELS[target.role as Role] ?? target.role})`);
  revalidatePath("/dashboard/users");
  return { error: null };
}
