"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTHB } from "@/lib/format";
import { createPayrollEntry, updatePayrollEntry } from "./actions";
import type { Employee, PayrollEntry } from "@/lib/types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const initialState: { error: string | null } = { error: null };

// Keeps the employee Select controlled from the very first render (Base UI
// warns/misbehaves if a Select switches between an undefined and a defined
// value across renders) — an empty employeeId maps to this sentinel instead
// of undefined, same pattern as JobNoSelect.
const NONE_VALUE = "__none__";

function parsePayPeriod(payPeriod: string | undefined): { month: string; beYear: string } {
  if (!payPeriod) {
    const now = new Date();
    return { month: String(now.getMonth() + 1), beYear: String(now.getFullYear() + 543) };
  }
  const [y, m] = payPeriod.split("-");
  return { month: String(Number(m)), beYear: String(Number(y) + 543) };
}

export function PayrollEntryForm({
  employees,
  mode = "create",
  entryId,
  initialData,
}: {
  employees: Employee[];
  mode?: "create" | "edit";
  entryId?: string;
  initialData?: PayrollEntry;
}) {
  const router = useRouter();
  const { month: initialMonth, beYear: initialBeYear } = parsePayPeriod(initialData?.payPeriod);

  const [employeeId, setEmployeeId] = useState(initialData?.employeeId ?? "");
  const [month, setMonth] = useState(initialMonth);
  const [beYear, setBeYear] = useState(initialBeYear);
  const [payDate, setPayDate] = useState(initialData?.payDate ?? "");
  const [baseSalary, setBaseSalary] = useState(initialData ? String(initialData.baseSalary) : "");
  const [fuelAllowance, setFuelAllowance] = useState(initialData ? String(initialData.fuelAllowance) : "");
  const [commission, setCommission] = useState(initialData ? String(initialData.commission) : "");
  const [incentive, setIncentive] = useState(initialData ? String(initialData.incentive) : "");
  const [socialSecurity, setSocialSecurity] = useState(initialData ? String(initialData.socialSecurity) : "");
  const [withholdingTax, setWithholdingTax] = useState(initialData ? String(initialData.withholdingTax) : "");
  const [otherDeductions, setOtherDeductions] = useState(initialData ? String(initialData.otherDeductions) : "");

  const totalIncome = (Number(baseSalary) || 0) + (Number(fuelAllowance) || 0) + (Number(commission) || 0) + (Number(incentive) || 0);
  const totalDeductions = (Number(socialSecurity) || 0) + (Number(withholdingTax) || 0) + (Number(otherDeductions) || 0);
  const netSalary = totalIncome - totalDeductions;

  const payPeriod = beYear && month ? `${Number(beYear) - 543}-${month.padStart(2, "0")}-01` : "";

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    formData.set("employee_id", employeeId);
    formData.set("pay_period", payPeriod);
    const result =
      mode === "edit" && entryId ? await updatePayrollEntry(entryId, formData) : await createPayrollEntry(formData);
    if (!result.error) {
      router.push("/dashboard/expenses/payroll");
    }
    return result;
  }, initialState);

  const employeeItems = employees.map((e) => ({ value: e.id, label: `${e.employeeCode} — ${e.fullName}` }));
  const monthItems = THAI_MONTHS.map((label, i) => ({ value: String(i + 1), label }));

  return (
    <form action={formAction} className="max-w-2xl space-y-4" noValidate>
      {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

      <div className="space-y-2">
        <Label htmlFor="employee_id">พนักงาน</Label>
        <Select
          value={employeeId || NONE_VALUE}
          onValueChange={(v) => setEmployeeId(v === NONE_VALUE ? "" : ((v as string) ?? ""))}
          items={[{ value: NONE_VALUE, label: "— เลือกพนักงาน —" }, ...employeeItems]}
        >
          <SelectTrigger id="employee_id" className="w-full">
            <SelectValue placeholder="— เลือกพนักงาน —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE} disabled>
              — เลือกพนักงาน —
            </SelectItem>
            {employeeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pay_month">เดือนที่จ่าย</Label>
          <Select value={month} onValueChange={(v) => setMonth((v as string) ?? month)} items={monthItems}>
            <SelectTrigger id="pay_month" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pay_year">ปี (พ.ศ.)</Label>
          <NumberInput id="pay_year" value={beYear} onChange={setBeYear} placeholder="2569" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pay_date">วันที่จ่ายจริง</Label>
        <DateInput id="pay_date" name="pay_date" value={payDate} onChange={setPayDate} />
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">รายได้</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="base_salary">เงินเดือน</Label>
            <NumberInput id="base_salary" name="base_salary" min={0} step={0.01} value={baseSalary} onChange={setBaseSalary} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuel_allowance">ค่าน้ำมัน</Label>
            <NumberInput id="fuel_allowance" name="fuel_allowance" min={0} step={0.01} value={fuelAllowance} onChange={setFuelAllowance} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission">ค่าคอมฯ</Label>
            <NumberInput id="commission" name="commission" min={0} step={0.01} value={commission} onChange={setCommission} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incentive">ค่า Incentive</Label>
            <NumberInput id="incentive" name="incentive" min={0} step={0.01} value={incentive} onChange={setIncentive} placeholder="0" />
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium">รายจ่าย (หัก)</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="social_security">หักประกันสังคม</Label>
            <NumberInput id="social_security" name="social_security" min={0} step={0.01} value={socialSecurity} onChange={setSocialSecurity} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="withholding_tax">ภ.ง.ด.1</Label>
            <NumberInput id="withholding_tax" name="withholding_tax" min={0} step={0.01} value={withholdingTax} onChange={setWithholdingTax} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="other_deductions">หักอื่นๆ</Label>
            <NumberInput id="other_deductions" name="other_deductions" min={0} step={0.01} value={otherDeductions} onChange={setOtherDeductions} placeholder="0" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 rounded-lg border bg-muted/40 p-4 text-sm">
        <div>
          <p className="text-muted-foreground">รวมรายได้</p>
          <p className="font-medium">{formatTHB(totalIncome)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">รวมรายการหัก</p>
          <p className="font-medium">{formatTHB(totalDeductions)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">เงินเดือนสุทธิ</p>
          <p className="font-semibold text-red-600 dark:text-red-400">{formatTHB(netSalary)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea id="note" name="note" defaultValue={initialData?.note ?? undefined} placeholder="หมายเหตุ (ถ้ามี)" />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
