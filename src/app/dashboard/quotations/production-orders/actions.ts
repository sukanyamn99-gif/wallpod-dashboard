"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// Writes straight onto quotations.job_number / quotation_items.product_code
// — the same columns the original quotation form already edits — so this
// page is a second, focused entry point onto that data, not a separate
// copy of it. Everything else about the quotation (items' pricing,
// customer info, remark, etc.) is untouched.
export async function updateProductionInfo(quotationId: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const jobNumber = str(formData.get("job_number"));
  const itemIds = formData.getAll("item_id").map((v) => String(v));
  const itemProductCodes = formData.getAll("item_product_code").map((v) => str(v));

  const supabase = await createClient();

  const { error: quoteErr } = await supabase.from("quotations").update({ job_number: jobNumber }).eq("id", quotationId);
  if (quoteErr) return { error: quoteErr.message };

  for (let i = 0; i < itemIds.length; i++) {
    const { error } = await supabase
      .from("quotation_items")
      .update({ product_code: itemProductCodes[i] })
      .eq("id", itemIds[i]);
    if (error) {
      return { error: `บันทึกเลขที่ Job สำเร็จ แต่บันทึกรหัสสินค้าบางรายการไม่สำเร็จ: ${error.message}` };
    }
  }

  revalidatePath("/dashboard/quotations/production-orders");
  revalidatePath("/dashboard/quotations");
  revalidatePath(`/dashboard/quotations/view/${quotationId}`);
  return { error: null };
}

// Cancels/restores just this quotation's ใบลงผลิต — a separate, reversible
// flag from quotations.status (see production_cancelled's own comment in
// the schema), so cancelling here never touches "ลูกค้าตอบตกลง" and the
// row stays visible (with a badge) rather than disappearing from every
// other view that depends on that status.
export async function setProductionOrderCancelled(quotationId: string, cancelled: boolean) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotations")
    .update({ production_cancelled: cancelled })
    .eq("id", quotationId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/quotations/production-orders");
  revalidatePath(`/dashboard/quotations/production-orders/${quotationId}`);
  return { error: null };
}
