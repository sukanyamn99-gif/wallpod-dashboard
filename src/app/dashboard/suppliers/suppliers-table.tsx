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
import type { Supplier } from "@/lib/types";
import { createSupplier, deleteSupplier, updateSupplier } from "./actions";

const addInitialState = { error: null as string | null };

function AddSupplierForm() {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: typeof addInitialState, formData: FormData) => {
    const result = await createSupplier(formData);
    if (!result.error) setFormKey((k) => k + 1);
    return result;
  }, addInitialState);

  return (
    <form key={formKey} action={formAction} className="flex flex-wrap items-start gap-2" noValidate>
      <Input name="name" placeholder="ชื่อผู้จำหน่าย" className="max-w-xs" required />
      <Input name="address" placeholder="ที่อยู่ (ถ้ามี)" className="max-w-xs" />
      <Input name="tax_id" placeholder="เลขประจำตัวผู้เสียภาษี (ถ้ามี)" className="max-w-[200px]" />
      <Input name="branch" placeholder="สำนักงาน/สาขา (ถ้ามี)" className="max-w-[160px]" />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "กำลังบันทึก..." : "เพิ่มผู้จำหน่าย"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function SupplierRow({ supplier, canManage }: { supplier: Supplier; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(supplier.name);
  const [address, setAddress] = useState(supplier.address ?? "");
  const [taxId, setTaxId] = useState(supplier.taxId ?? "");
  const [branch, setBranch] = useState(supplier.branch ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(supplier.name);
    setAddress(supplier.address ?? "");
    setTaxId(supplier.taxId ?? "");
    setBranch(supplier.branch ?? "");
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      reset();
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", trimmed);
      fd.set("address", address.trim());
      fd.set("tax_id", taxId.trim());
      fd.set("branch", branch.trim());
      const result = await updateSupplier(supplier.id, fd);
      if (result.error) {
        setError(result.error);
        reset();
      }
      setEditing(false);
    });
  }

  function handleConfirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSupplier(supplier.id);
      if (result.error) setError(result.error);
      setConfirmingDelete(false);
    });
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-[160px]" autoFocus disabled={pending} />
        ) : (
          supplier.name
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={address} onChange={(e) => setAddress(e.target.value)} className="max-w-[200px]" disabled={pending} />
        ) : (
          supplier.address || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="max-w-[160px]" disabled={pending} />
        ) : (
          supplier.taxId || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={branch} onChange={(e) => setBranch(e.target.value)} className="max-w-[120px]" disabled={pending} />
        ) : (
          supplier.branch || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
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
                      reset();
                    }}
                    disabled={pending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : confirmingDelete ? (
                <>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    onClick={handleConfirmDelete}
                    disabled={pending}
                    title={`ยืนยันลบผู้จำหน่าย "${supplier.name}"`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={pending} title="ยกเลิก">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="icon-sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
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

export function SuppliersTable({
  suppliers,
  canManage,
}: {
  suppliers: Supplier[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {canManage && <AddSupplierForm />}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อผู้จำหน่าย</TableHead>
              <TableHead>ที่อยู่</TableHead>
              <TableHead>เลขประจำตัวผู้เสียภาษี</TableHead>
              <TableHead>สำนักงาน/สาขา</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  ไม่มีผู้จำหน่าย
                </TableCell>
              </TableRow>
            )}
            {suppliers.map((s) => (
              <SupplierRow key={s.id} supplier={s} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">แสดง {suppliers.length} ผู้จำหน่าย</p>
    </div>
  );
}
