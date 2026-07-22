"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Department } from "@/lib/types";
import { createDepartment, deleteDepartment, updateDepartment } from "./actions";

const addInitialState = { error: null as string | null };

function AddDepartmentForm() {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: typeof addInitialState, formData: FormData) => {
    const result = await createDepartment(formData);
    if (!result.error) setFormKey((k) => k + 1);
    return result;
  }, addInitialState);

  return (
    <form key={formKey} action={formAction} className="flex flex-wrap items-start gap-2">
      <Input name="name" placeholder="ชื่อแผนกใหม่" className="max-w-xs" required />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "กำลังบันทึก..." : "เพิ่มแผนก"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function DepartmentRow({ department, canManage }: { department: Department; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(department.name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === department.name) {
      setEditing(false);
      setName(department.name);
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", trimmed);
      const result = await updateDepartment(department.id, fd);
      if (result.error) {
        setError(result.error);
        setName(department.name);
      }
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!window.confirm(`ลบแผนก "${department.name}"? ใบเบิกที่เคยใช้แผนกนี้จะไม่ถูกลบ`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDepartment(department.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" autoFocus disabled={pending} />
        ) : (
          department.name
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {new Date(department.createdAt).toLocaleDateString("th-TH")}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {canManage && (
            <div className="flex gap-1">
              {editing ? (
                <>
                  <Button size="icon-sm" variant="outline" onClick={handleSave} disabled={pending}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setName(department.name);
                    }}
                    disabled={pending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="icon-sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="destructive" onClick={handleDelete} disabled={pending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function DepartmentsTable({
  departments,
  canManage,
}: {
  departments: Department[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {canManage && <AddDepartmentForm />}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อแผนก</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  ไม่มีแผนก
                </TableCell>
              </TableRow>
            )}
            {departments.map((d) => (
              <DepartmentRow key={d.id} department={d} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">แสดง {departments.length} แผนก</p>
    </div>
  );
}
