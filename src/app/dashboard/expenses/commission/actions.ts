"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "มีอัตราส่วนลดนี้อยู่แล้วในตารางค่าคอมมิชชั่น";
  return error.message;
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function revalidateCommissionConsumers() {
  revalidatePath("/dashboard/expenses/commission");
}

export async function createRateTier(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const discountPercent = num(formData.get("discount_percent"));
  const commissionRatePercent = num(formData.get("commission_rate_percent"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_rate_tiers")
    .insert({ discount_percent: discountPercent, commission_rate_percent: commissionRatePercent });
  if (error) return { error: friendlyError(error) };

  revalidateCommissionConsumers();
  return { error: null };
}

export async function updateRateTier(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const discountPercent = num(formData.get("discount_percent"));
  const commissionRatePercent = num(formData.get("commission_rate_percent"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_rate_tiers")
    .update({ discount_percent: discountPercent, commission_rate_percent: commissionRatePercent })
    .eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidateCommissionConsumers();
  return { error: null };
}

export async function deleteRateTier(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("commission_rate_tiers").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateCommissionConsumers();
  return { error: null };
}

// The only real write path in this feature now — everything else about a
// commissionable job (customer, amount, sales rep, received date) is read
// live from projects/payments, so saving a job's commission is just: look
// up the rate for this discount % (falls back to 0 if the discount doesn't
// match any known tier — an unusual discount needs a rate tier added
// first, rather than silently guessing), compute the amount from the
// project's own pre_vat, and upsert.
export async function saveProjectCommission(projectId: string, discountPercent: number) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0) {
    return { error: "กรุณาระบุส่วนลดให้ถูกต้อง" };
  }

  const supabase = await createClient();

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("pre_vat")
    .eq("id", projectId)
    .single();
  if (projectErr) return { error: projectErr.message };

  const { data: tier } = await supabase
    .from("commission_rate_tiers")
    .select("commission_rate_percent")
    .eq("discount_percent", discountPercent)
    .maybeSingle();
  if (!tier) {
    return {
      error: `ไม่พบอัตราค่าคอมมิชชั่นสำหรับส่วนลด ${discountPercent}% — กรุณาเพิ่มอัตรานี้ในตารางด้านบนก่อน`,
    };
  }

  const commissionRatePercent = Number(tier.commission_rate_percent);
  const preVat = Number(project.pre_vat);
  const commissionAmount = Math.round(((preVat * commissionRatePercent) / 100) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("commission_entries").upsert(
    {
      project_id: projectId,
      discount_percent: discountPercent,
      commission_rate_percent: commissionRatePercent,
      commission_amount: commissionAmount,
      created_by: user?.id ?? null,
    },
    { onConflict: "project_id" },
  );
  if (error) return { error: error.message };

  revalidateCommissionConsumers();
  return { error: null, commissionRatePercent, commissionAmount };
}

export async function clearProjectCommission(projectId: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("commission_entries").delete().eq("project_id", projectId);
  if (error) return { error: error.message };

  revalidateCommissionConsumers();
  return { error: null };
}
