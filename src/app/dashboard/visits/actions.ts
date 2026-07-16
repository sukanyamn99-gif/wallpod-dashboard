"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function logVisit(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const salesRepId = String(formData.get("sales_rep_id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "") || null;
  const note = String(formData.get("note") ?? "") || null;

  if (!salesRepId) {
    return { error: "กรุณาเลือกเซลล์" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("visits").insert({
    sales_rep_id: salesRepId,
    customer_id: customerId,
    note,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard/sales");
  return { error: null };
}
