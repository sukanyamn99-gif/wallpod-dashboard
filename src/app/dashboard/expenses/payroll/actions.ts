"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "มีข้อมูลนี้ในระบบอยู่แล้ว (รหัสพนักงาน หรือ เดือน/พนักงานนี้ถูกบันทึกไปแล้ว)";
  return error.message;
}

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function revalidatePayrollConsumers() {
  revalidatePath("/dashboard/expenses/payroll");
}

export async function createEmployee(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const employeeCode = str(formData.get("employee_code"));
  const fullName = str(formData.get("full_name"));
  if (!employeeCode) return { error: "กรุณากรอกรหัสพนักงาน" };
  if (!fullName) return { error: "กรุณากรอกชื่อ-นามสกุล" };

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    employee_code: employeeCode,
    full_name: fullName,
    position: str(formData.get("position")),
    id_card_no: str(formData.get("id_card_no")),
    start_date: str(formData.get("start_date")),
  });
  if (error) return { error: friendlyError(error) };

  revalidatePayrollConsumers();
  return { error: null };
}

export async function updateEmployee(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const employeeCode = str(formData.get("employee_code"));
  const fullName = str(formData.get("full_name"));
  if (!employeeCode) return { error: "กรุณากรอกรหัสพนักงาน" };
  if (!fullName) return { error: "กรุณากรอกชื่อ-นามสกุล" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      employee_code: employeeCode,
      full_name: fullName,
      position: str(formData.get("position")),
      id_card_no: str(formData.get("id_card_no")),
      start_date: str(formData.get("start_date")),
    })
    .eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidatePayrollConsumers();
  return { error: null };
}

export async function setEmployeeActive(id: string, active: boolean) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("employees").update({ active }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePayrollConsumers();
  return { error: null };
}

export async function deleteEmployee(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: employee } = await supabase.from("employees").select("full_name").eq("id", id).single();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบพนักงาน", employee?.full_name ?? null);
  revalidatePayrollConsumers();
  return { error: null };
}

function parsePayrollEntryForm(formData: FormData) {
  const employeeId = str(formData.get("employee_id"));
  const payPeriod = str(formData.get("pay_period"));
  if (!employeeId) return { ok: false as const, error: "กรุณาเลือกพนักงาน" };
  if (!payPeriod) return { ok: false as const, error: "กรุณาเลือกเดือนที่จ่าย" };

  return {
    ok: true as const,
    employeeId,
    payPeriod,
    payDate: str(formData.get("pay_date")),
    baseSalary: num(formData.get("base_salary")),
    fuelAllowance: num(formData.get("fuel_allowance")),
    commission: num(formData.get("commission")),
    incentive: num(formData.get("incentive")),
    socialSecurity: num(formData.get("social_security")),
    withholdingTax: num(formData.get("withholding_tax")),
    otherDeductions: num(formData.get("other_deductions")),
    note: str(formData.get("note")),
  };
}

export async function createPayrollEntry(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parsePayrollEntryForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("payroll_entries")
    .insert({
      employee_id: parsed.employeeId,
      pay_period: parsed.payPeriod,
      pay_date: parsed.payDate,
      base_salary: parsed.baseSalary,
      fuel_allowance: parsed.fuelAllowance,
      commission: parsed.commission,
      incentive: parsed.incentive,
      social_security: parsed.socialSecurity,
      withholding_tax: parsed.withholdingTax,
      other_deductions: parsed.otherDeductions,
      note: parsed.note,
      prepared_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };

  revalidatePayrollConsumers();
  return { error: null, id: data.id };
}

export async function updatePayrollEntry(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parsePayrollEntryForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_entries")
    .update({
      employee_id: parsed.employeeId,
      pay_period: parsed.payPeriod,
      pay_date: parsed.payDate,
      base_salary: parsed.baseSalary,
      fuel_allowance: parsed.fuelAllowance,
      commission: parsed.commission,
      incentive: parsed.incentive,
      social_security: parsed.socialSecurity,
      withholding_tax: parsed.withholdingTax,
      other_deductions: parsed.otherDeductions,
      note: parsed.note,
    })
    .eq("id", id);
  if (error) return { error: friendlyError(error) };

  revalidatePayrollConsumers();
  revalidatePath(`/dashboard/expenses/payroll/print/${id}`);
  return { error: null };
}

export async function deletePayrollEntry(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("payroll_entries")
    .select("pay_period, employees(full_name)")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("payroll_entries").delete().eq("id", id);
  if (error) return { error: error.message };

  // @ts-expect-error -- Supabase types the joined relation loosely here
  const employeeName = entry?.employees?.full_name ?? null;
  await logActivity("ลบรายการเงินเดือน", employeeName ? `${employeeName} (${entry?.pay_period ?? ""})` : null);
  revalidatePayrollConsumers();
  return { error: null };
}
