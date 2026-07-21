"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createProductCategory, deleteProductCategory, updateProductCategory } from "./actions";

type Category = { id: string; name: string; description: string | null; created_at: string };

const addInitialState = { error: null as string | null };

function AddCategoryForm() {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: typeof addInitialState, formData: FormData) => {
    const result = await createProductCategory(formData);
    if (!result.error) setFormKey((k) => k + 1);
    return result;
  }, addInitialState);

  return (
    <form key={formKey} action={formAction} className="flex flex-wrap items-start gap-2">
      <Input name="name" placeholder="ชื่อหมวดหมู่ใหม่" className="max-w-xs" required />
      <Textarea name="description" placeholder="รายละเอียด (ถ้ามี)" className="max-w-sm" rows={1} />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "กำลังบันทึก..." : "เพิ่มหมวดหมู่"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function CategoryRow({ category, canManage }: { category: Category; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || (trimmedName === category.name && trimmedDescription === (category.description ?? ""))) {
      setEditing(false);
      setName(category.name);
      setDescription(category.description ?? "");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", trimmedName);
      fd.set("description", trimmedDescription);
      const result = await updateProductCategory(category.id, fd);
      if (result.error) {
        setError(result.error);
        setName(category.name);
        setDescription(category.description ?? "");
      }
      setEditing(false);
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        `ลบหมวดหมู่ "${category.name}"? สินค้าที่เคยใช้หมวดหมู่นี้จะไม่ถูกลบ แต่จะไม่แสดงในตัวเลือกอีกต่อไป`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProductCategory(category.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" autoFocus disabled={pending} />
        ) : (
          category.name
        )}
      </TableCell>
      <TableCell className="max-w-[20rem] whitespace-normal">
        {editing ? (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="max-w-sm"
            rows={2}
            disabled={pending}
          />
        ) : (
          category.description || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {new Date(category.created_at).toLocaleDateString("th-TH")}
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
                      setName(category.name);
                      setDescription(category.description ?? "");
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

export function CategoriesTable({
  categories,
  canManage,
}: {
  categories: Category[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {canManage && <AddCategoryForm />}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อหมวดหมู่</TableHead>
              <TableHead>รายละเอียด</TableHead>
              <TableHead>วันที่สร้าง</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  ไม่มีหมวดหมู่
                </TableCell>
              </TableRow>
            )}
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">แสดง {categories.length} หมวดหมู่</p>
    </div>
  );
}
