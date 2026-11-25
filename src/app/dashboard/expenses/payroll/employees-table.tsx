"use client";

import { useState, useTransition } from "react";
import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { createEmployee, deleteEmployee, setEmployeeActive, updateEmployee } from "./actions";
import type { Employee } from "@/lib/types";

// Counted through today regardless of active/พ้นสภาพ status — there's no
// separate "leave date" field on file, only start_date, so this is always
// "how long since they started" rather than "how long they actually
// worked" for someone who's left. An honest reading of the data available,
// not a claim about a former employee's real tenure.
function tenureLabel(startDate: string | null): string {
  if (!startDate) return "—";
  const start = new Date(startDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    // Days in the month right before `now` — the correct "borrow" amount
    // for a calendar-based date difference (not always 30).
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "—";
  if (years === 0 && months === 0 && days === 0) return "วันนี้";
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ปี`);
  if (months > 0) parts.push(`${months} เดือน`);
  if (days > 0) parts.push(`${days} วัน`);
  return parts.join(" ");
}

// `actions` sits next to the "เพิ่มพนักงาน" button while the form is closed.
function AddEmployeeForm({ onAdded, actions }: { onAdded: () => void; actions?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [idCardNo, setIdCardNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setEmployeeCode("");
    setFullName("");
    setPosition("");
    setIdCardNo("");
    setStartDate("");
    setBaseSalary("");
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("employee_code", employeeCode);
      fd.set("full_name", fullName);
      fd.set("position", position);
      fd.set("id_card_no", idCardNo);
      fd.set("start_date", startDate);
      fd.set("base_salary", baseSalary);
      const result = await createEmployee(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      reset();
      setOpen(false);
      onAdded();
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          เพิ่มพนักงาน
        </Button>
        {actions}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Input placeholder="รหัสพนักงาน" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
        <Input placeholder="ชื่อ-นามสกุล" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input placeholder="ตำแหน่ง" value={position} onChange={(e) => setPosition(e.target.value)} />
        <Input placeholder="เลขบัตรประชาชน" value={idCardNo} onChange={(e) => setIdCardNo(e.target.value)} />
        <DateInput value={startDate} onChange={setStartDate} />
        <NumberInput min={0} step={0.01} value={baseSalary} onChange={setBaseSalary} placeholder="เงินเดือน" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          บันทึก
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            reset();
            setError(null);
            setOpen(false);
          }}
          disabled={pending}
        >
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: Employee }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [employeeCode, setEmployeeCode] = useState(employee.employeeCode);
  const [fullName, setFullName] = useState(employee.fullName);
  const [position, setPosition] = useState(employee.position ?? "");
  const [idCardNo, setIdCardNo] = useState(employee.idCardNo ?? "");
  const [startDate, setStartDate] = useState(employee.startDate ?? "");
  const [baseSalary, setBaseSalary] = useState(employee.baseSalary > 0 ? String(employee.baseSalary) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetFields() {
    setEmployeeCode(employee.employeeCode);
    setFullName(employee.fullName);
    setPosition(employee.position ?? "");
    setIdCardNo(employee.idCardNo ?? "");
    setStartDate(employee.startDate ?? "");
    setBaseSalary(employee.baseSalary > 0 ? String(employee.baseSalary) : "");
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("employee_code", employeeCode);
      fd.set("full_name", fullName);
      fd.set("position", position);
      fd.set("id_card_no", idCardNo);
      fd.set("start_date", startDate);
      fd.set("base_salary", baseSalary);
      const result = await updateEmployee(employee.id, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      await setEmployeeActive(employee.id, !employee.active);
    });
  }

  function handleConfirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);
      if (result.error) setError(result.error);
      setConfirmingDelete(false);
    });
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={9}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="รหัสพนักงาน" />
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="ตำแหน่ง" />
            <Input value={idCardNo} onChange={(e) => setIdCardNo(e.target.value)} placeholder="เลขบัตรประชาชน" />
            <DateInput value={startDate} onChange={setStartDate} />
            <NumberInput min={0} step={0.01} value={baseSalary} onChange={setBaseSalary} placeholder="เงินเดือน" />
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          <div className="mt-2 flex items-center gap-1">
            <Button size="icon-sm" variant="outline" onClick={handleSave} disabled={pending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => {
                resetFields();
                setError(null);
                setEditing(false);
              }}
              disabled={pending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium">{employee.employeeCode}</TableCell>
      <TableCell className="whitespace-nowrap">{employee.fullName}</TableCell>
      <TableCell className="whitespace-nowrap">{employee.position ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">{employee.idCardNo ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {employee.startDate ? new Date(employee.startDate).toLocaleDateString("th-TH") : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap">{tenureLabel(employee.startDate)}</TableCell>
      <TableCell className="whitespace-nowrap text-right">
        {employee.baseSalary > 0 ? formatTHB(employee.baseSalary) : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <button type="button" onClick={handleToggleActive} disabled={pending}>
          <Badge variant={employee.active ? "secondary" : "outline"}>
            {employee.active ? "ทำงานอยู่" : "พ้นสภาพ"}
          </Badge>
        </button>
      </TableCell>
      <TableCell>
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={pending}
              title={`ยืนยันลบพนักงาน "${employee.fullName}"`}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-sm" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={pending}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {error && !editing && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </TableCell>
    </TableRow>
  );
}

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const [formKey, setFormKey] = useState(0);
  // Names, ID-card numbers and salaries stay hidden until asked for, so the
  // page can be open on screen without showing them. Not remembered: every
  // visit starts hidden again.
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-3">
      <AddEmployeeForm
        key={formKey}
        onAdded={() => setFormKey((k) => k + 1)}
        actions={
          <Button size="sm" variant="outline" onClick={() => setRevealed((v) => !v)} aria-pressed={revealed}>
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? "ซ่อนข้อมูลพนักงาน" : "แสดงข้อมูลพนักงาน"}
          </Button>
        }
      />
      {!revealed ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          ซ่อนข้อมูลพนักงานไว้ ({employees.length} คน) — กดปุ่ม &ldquo;แสดงข้อมูลพนักงาน&rdquo; เพื่อดู
        </p>
      ) : (
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">รหัสพนักงาน</TableHead>
              <TableHead className="whitespace-nowrap">ชื่อ-นามสกุล</TableHead>
              <TableHead className="whitespace-nowrap">ตำแหน่ง</TableHead>
              <TableHead className="whitespace-nowrap">เลขบัตรประชาชน</TableHead>
              <TableHead className="whitespace-nowrap">วันที่เริ่มงาน</TableHead>
              <TableHead className="whitespace-nowrap">อายุงาน</TableHead>
              <TableHead className="whitespace-nowrap text-right">เงินเดือน</TableHead>
              <TableHead className="whitespace-nowrap">สถานะ</TableHead>
              <TableHead className="whitespace-nowrap">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  ยังไม่มีพนักงาน
                </TableCell>
              </TableRow>
            )}
            {employees.map((employee) => (
              <EmployeeRow key={employee.id} employee={employee} />
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
