"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { createProductCategory, deleteProductCategory, updateProductCategory } from "./actions";

type Category = { id: string; name: string; description: string | null; created_at: string };
type Summary = { count: number; quantity: number };

const CARD_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
];

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

function CategoryCard({
  category,
  canManage,
  color,
  summary,
}: {
  category: Category;
  canManage: boolean;
  color: string;
  summary: Summary;
}) {
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
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          <Tags className="h-4 w-4" />
        </div>
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
      </div>

      {editing ? (
        <div className="space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus disabled={pending} />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={pending}
            placeholder="รายละเอียด"
          />
        </div>
      ) : (
        <div>
          <p className="font-medium">{category.name}</p>
          <p className="text-sm text-muted-foreground">{category.description || "—"}</p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          {summary.count} สินค้า
        </span>
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {formatNumber(summary.quantity)} จำนวน
        </span>
      </div>

      <p className="mt-auto text-xs text-muted-foreground">
        {new Date(category.created_at).toLocaleDateString("th-TH")}
      </p>
    </div>
  );
}

export function CategoriesTable({
  categories,
  canManage,
  summary,
}: {
  categories: Category[];
  canManage: boolean;
  summary: Record<string, Summary>;
}) {
  return (
    <div className="space-y-4">
      {canManage && <AddCategoryForm />}

      {categories.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">ไม่มีหมวดหมู่</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c, i) => (
            <CategoryCard
              key={c.id}
              category={c}
              canManage={canManage}
              color={CARD_COLORS[i % CARD_COLORS.length]}
              summary={summary[c.name] ?? { count: 0, quantity: 0 }}
            />
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">แสดง {categories.length} หมวดหมู่</p>
    </div>
  );
}
