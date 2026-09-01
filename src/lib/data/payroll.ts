import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Employee, PayrollEntry, PayrollYtdSummary } from "@/lib/types";

function mapEmployee(row: {
  id: string;
  employee_code: string;
  full_name: string;
  position: string | null;
  id_card_no: string | null;
  start_date: string | null;
  active: boolean;
  created_at: string;
}): Employee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    position: row.position,
    idCardNo: row.id_card_no,
    startDate: row.start_date,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function getEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_code, full_name, position, id_card_no, start_date, active, created_at")
    .order("employee_code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEmployee);
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_code, full_name, position, id_card_no, start_date, active, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEmployee(data) : null;
}

const ENTRY_COLUMNS =
  "id, employee_id, pay_period, pay_date, base_salary, fuel_allowance, commission, incentive, " +
  "social_security, withholding_tax, other_deductions, total_income, total_deductions, net_salary, " +
  "note, created_at, employees(employee_code, full_name, position, id_card_no, start_date), profiles(full_name)";

type EntryRow = {
  id: string;
  employee_id: string;
  pay_period: string;
  pay_date: string | null;
  base_salary: number;
  fuel_allowance: number;
  commission: number;
  incentive: number;
  social_security: number;
  withholding_tax: number;
  other_deductions: number;
  total_income: number;
  total_deductions: number;
  net_salary: number;
  note: string | null;
  created_at: string;
  employees: {
    employee_code: string;
    full_name: string;
    position: string | null;
    id_card_no: string | null;
    start_date: string | null;
  } | null;
  profiles: { full_name: string } | null;
};

function mapEntry(row: EntryRow): PayrollEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeCode: row.employees?.employee_code ?? "",
    employeeName: row.employees?.full_name ?? "",
    employeePosition: row.employees?.position ?? null,
    employeeIdCardNo: row.employees?.id_card_no ?? null,
    employeeStartDate: row.employees?.start_date ?? null,
    payPeriod: row.pay_period,
    payDate: row.pay_date,
    baseSalary: Number(row.base_salary),
    fuelAllowance: Number(row.fuel_allowance),
    commission: Number(row.commission),
    incentive: Number(row.incentive),
    socialSecurity: Number(row.social_security),
    withholdingTax: Number(row.withholding_tax),
    otherDeductions: Number(row.other_deductions),
    totalIncome: Number(row.total_income),
    totalDeductions: Number(row.total_deductions),
    netSalary: Number(row.net_salary),
    note: row.note,
    preparedByName: row.profiles?.full_name ?? null,
    createdAt: row.created_at,
  };
}

export async function getPayrollEntries(): Promise<PayrollEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_entries")
    .select(ENTRY_COLUMNS)
    .order("pay_period", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapEntry);
}

export async function getPayrollEntryById(id: string): Promise<PayrollEntry | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("payroll_entries").select(ENTRY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  // @ts-expect-error -- Supabase types the joined relation loosely here
  return data ? mapEntry(data) : null;
}

// Cumulative-to-date figures shown on the print slip's "สะสมต่อปี" row —
// every entry for this employee in the same calendar year, up to and
// including this entry's own pay_period, summed live rather than stored
// (an edited/deleted earlier-month entry is reflected immediately).
export async function getPayrollYtdSummary(
  employeeId: string,
  payPeriod: string,
): Promise<PayrollYtdSummary> {
  const empty: PayrollYtdSummary = {
    cumulativeIncome: 0,
    cumulativeTax: 0,
    cumulativeSocialSecurity: 0,
    cumulativeOtherDeductions: 0,
  };
  if (!isSupabaseConfigured()) return empty;

  const year = payPeriod.slice(0, 4);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_entries")
    .select("total_income, withholding_tax, social_security, other_deductions")
    .eq("employee_id", employeeId)
    .gte("pay_period", `${year}-01-01`)
    .lte("pay_period", payPeriod);
  if (error) throw error;

  return (data ?? []).reduce(
    (acc, row) => ({
      cumulativeIncome: acc.cumulativeIncome + Number(row.total_income),
      cumulativeTax: acc.cumulativeTax + Number(row.withholding_tax),
      cumulativeSocialSecurity: acc.cumulativeSocialSecurity + Number(row.social_security),
      cumulativeOtherDeductions: acc.cumulativeOtherDeductions + Number(row.other_deductions),
    }),
    empty,
  );
}
