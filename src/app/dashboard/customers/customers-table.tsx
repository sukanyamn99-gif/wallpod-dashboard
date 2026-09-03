"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer, CustomerType } from "@/lib/types";
import { createCustomer, deleteCustomer, updateCustomer } from "./actions";

const CUSTOMER_TYPES: CustomerType[] = ["Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School"];
const CUSTOMER_TYPE_ITEMS = CUSTOMER_TYPES.map((t) => ({ value: t, label: t }));

const addInitialState = { error: null as string | null };

function AddCustomerForm() {
  const [formKey, setFormKey] = useState(0);
  const [customerType, setCustomerType] = useState<CustomerType>("Owner");
  const [state, formAction, pending] = useActionState(async (_prev: typeof addInitialState, formData: FormData) => {
    const result = await createCustomer(formData);
    if (!result.error) {
      setFormKey((k) => k + 1);
      setCustomerType("Owner");
    }
    return result;
  }, addInitialState);

  return (
    <form key={formKey} action={formAction} className="flex flex-wrap items-start gap-2" noValidate>
      <Input name="customer_code" placeholder="รหัสลูกค้า (ถ้ามี)" className="max-w-[140px]" />
      <Input name="name" placeholder="ชื่อลูกค้า/บริษัท" className="max-w-xs" required />
      <Select
        name="customer_type"
        value={customerType}
        onValueChange={(v) => setCustomerType((v as CustomerType) ?? "Owner")}
        items={CUSTOMER_TYPE_ITEMS}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="ประเภทลูกค้า" />
        </SelectTrigger>
        <SelectContent>
          {CUSTOMER_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="contact_person" placeholder="ผู้ติดต่อ (ถ้ามี)" className="max-w-[160px]" />
      <Input name="phone" placeholder="เบอร์โทร (ถ้ามี)" className="max-w-[140px]" />
      <Input name="tax_id" placeholder="เลขผู้เสียภาษี (ถ้ามี)" className="max-w-[160px]" />
      <Input name="address" placeholder="ที่อยู่ (ถ้ามี)" className="max-w-xs" />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "กำลังบันทึก..." : "เพิ่มลูกค้าใหม่"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function CustomerRow({ customer, canManage }: { customer: Customer; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(customer.name);
  const [customerType, setCustomerType] = useState<CustomerType>(customer.customer_type);
  const [customerCode, setCustomerCode] = useState(customer.customerCode ?? "");
  const [contactPerson, setContactPerson] = useState(customer.contactPerson ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [taxId, setTaxId] = useState(customer.taxId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(customer.name);
    setCustomerType(customer.customer_type);
    setCustomerCode(customer.customerCode ?? "");
    setContactPerson(customer.contactPerson ?? "");
    setAddress(customer.address ?? "");
    setPhone(customer.phone ?? "");
    setTaxId(customer.taxId ?? "");
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
      fd.set("customer_type", customerType);
      fd.set("customer_code", customerCode.trim());
      fd.set("contact_person", contactPerson.trim());
      fd.set("address", address.trim());
      fd.set("phone", phone.trim());
      fd.set("tax_id", taxId.trim());
      const result = await updateCustomer(customer.id, fd);
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
      const result = await deleteCustomer(customer.id);
      if (result.error) setError(result.error);
      setConfirmingDelete(false);
    });
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} className="max-w-[110px]" autoFocus disabled={pending} />
        ) : (
          customer.customerCode || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-[180px]" disabled={pending} />
        ) : (
          customer.name
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Select value={customerType} onValueChange={(v) => setCustomerType((v as CustomerType) ?? customerType)} items={CUSTOMER_TYPE_ITEMS}>
            <SelectTrigger className="w-[130px]" disabled={pending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          customer.customer_type
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="max-w-[140px]" disabled={pending} />
        ) : (
          customer.contactPerson || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="max-w-[120px]" disabled={pending} />
        ) : (
          customer.phone || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="max-w-[140px]" disabled={pending} />
        ) : (
          customer.taxId || "—"
        )}
      </TableCell>
      <TableCell className="min-w-[200px]">
        {editing ? (
          <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={pending} />
        ) : (
          customer.address || "—"
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
                    title={`ยืนยันลบลูกค้า "${customer.name}"`}
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

export function CustomersTable({ customers, canManage }: { customers: Customer[]; canManage: boolean }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.customerCode, c.contactPerson, c.phone, c.taxId, c.address].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [customers, search]);

  return (
    <div className="space-y-4">
      {canManage && <AddCustomerForm />}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ, รหัสลูกค้า, ผู้ติดต่อ, เบอร์โทร, เลขผู้เสียภาษี..."
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รหัสลูกค้า</TableHead>
              <TableHead>ชื่อลูกค้า/บริษัท</TableHead>
              <TableHead>ประเภทลูกค้า</TableHead>
              <TableHead>ผู้ติดต่อ</TableHead>
              <TableHead>เบอร์โทร</TableHead>
              <TableHead>เลขผู้เสียภาษี</TableHead>
              <TableHead>ที่อยู่</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {customers.length === 0 ? "ยังไม่มีลูกค้าในระบบ" : "ไม่พบลูกค้าที่ค้นหา"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <CustomerRow key={c.id} customer={c} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {customers.length} ลูกค้า
      </p>
    </div>
  );
}
