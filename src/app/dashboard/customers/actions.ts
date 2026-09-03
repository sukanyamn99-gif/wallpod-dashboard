"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/profile";
import type { CustomerType } from "@/lib/types";

const CUSTOMER_TYPES: CustomerType[] = ["Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School"];

// Mirrors the customers_write RLS policy exactly (owner/manager/support_sale) —
// checked here too so a denied write returns a friendly Thai message instead
// of a raw RLS error.
function canManageCustomers(role: string): boolean {
  return role === "owner" || role === "manager" || role === "support_sale";
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

interface ParsedCustomer {
  name: string;
  customerType: CustomerType;
  contactPerson: string | null;
  address: string | null;
  phone: string | null;
  taxId: string | null;
}

function parseCustomerForm(formData: FormData): { error: string } | ({ error: null } & ParsedCustomer) {
  const name = str(formData.get("name"));
  if (!name) return { error: "กรุณากรอกชื่อลูกค้า" };

  const customerType = String(formData.get("customer_type") ?? "");
  if (!CUSTOMER_TYPES.includes(customerType as CustomerType)) return { error: "กรุณาเลือกประเภทลูกค้า" };

  return {
    error: null,
    name,
    customerType: customerType as CustomerType,
    contactPerson: str(formData.get("contact_person")),
    address: str(formData.get("address")),
    phone: str(formData.get("phone")),
    taxId: str(formData.get("tax_id")),
  };
}

export async function createCustomer(formData: FormData): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };

  const profile = await getCurrentProfile();
  if (!profile || !canManageCustomers(profile.role)) return { error: "คุณไม่มีสิทธิ์เพิ่มลูกค้า" };

  const parsed = parseCustomerForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name: parsed.name,
    customer_type: parsed.customerType,
    contact_person: parsed.contactPerson,
    address: parsed.address,
    phone: parsed.phone,
    tax_id: parsed.taxId,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/customers");
  return { error: null };
}

export async function updateCustomer(id: string, formData: FormData): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };

  const profile = await getCurrentProfile();
  if (!profile || !canManageCustomers(profile.role)) return { error: "คุณไม่มีสิทธิ์แก้ไขลูกค้า" };

  const parsed = parseCustomerForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.name,
      customer_type: parsed.customerType,
      contact_person: parsed.contactPerson,
      address: parsed.address,
      phone: parsed.phone,
      tax_id: parsed.taxId,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/customers");
  return { error: null };
}

export async function deleteCustomer(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };

  const profile = await getCurrentProfile();
  if (!profile || !canManageCustomers(profile.role)) return { error: "คุณไม่มีสิทธิ์ลบลูกค้า" };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    // Postgres foreign_key_violation — this customer is referenced by an
    // existing project/quotation/requisition/billing document.
    if (error.code === "23503") {
      return { error: "ไม่สามารถลบได้ เนื่องจากมีการใช้งานลูกค้ารายนี้อยู่ในระบบแล้ว" };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/customers");
  return { error: null };
}
