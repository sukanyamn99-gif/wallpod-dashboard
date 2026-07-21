"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProjectSale, updateProjectSale } from "./actions";
import { formatTHB } from "@/lib/format";
import { CustomerAutocomplete } from "@/components/dashboard/customer-autocomplete";
import type { Customer, CustomerType, PaymentStatus, SalesRep } from "@/lib/types";
import { PRODUCTION_STATUSES } from "@/lib/types";

const initialState = { error: null as string | null };

const CUSTOMER_TYPES: CustomerType[] = [
  "Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["เก็บเงินเรียบร้อย", "ชำระมาแล้ว 50%", "รอชำระเงิน"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function suggestedJobNo() {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0"); // BE short year, matches original sheet
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `JB${yy}${mm}`;
}

interface ItemRow {
  key: number;
  category: string;
  amount: string;
}

export interface ProjectSaleInitialData {
  projectDate: string;
  jobNo: string | null;
  customerName: string;
  projectName: string;
  salesRepId: string;
  customerType: string;
  productionStatus: string;
  items: { category: string; amount: string }[];
  costs: {
    material_cost: string;
    glue_cost: string;
    cutting_cost: string;
    install_cost: string;
    parking_cost: string;
    shipping_cost: string;
  };
  status: string;
  invoiceNo1: string;
  amount1: string;
  paidDate1: string;
  invoiceNo2: string;
  amount2: string;
  paidDate2: string;
}

export function ProjectSaleForm({
  salesReps,
  customers,
  categories,
  mode = "create",
  projectId,
  initialData,
}: {
  salesReps: SalesRep[];
  customers: Customer[];
  categories: string[];
  mode?: "create" | "edit";
  projectId?: string;
  initialData?: ProjectSaleInitialData;
}) {
  const nextRowKey = useRef(initialData?.items.length ?? 1);
  const [items, setItems] = useState<ItemRow[]>(
    initialData?.items.length
      ? initialData.items.map((it, i) => ({ key: i, category: it.category, amount: it.amount }))
      : [{ key: 0, category: "", amount: "" }],
  );
  const [customerName, setCustomerName] = useState(initialData?.customerName ?? "");
  const [installment2, setInstallment2] = useState(
    Boolean(initialData?.amount2 || initialData?.invoiceNo2),
  );
  const [amount1, setAmount1] = useState(initialData?.amount1 ?? "");
  const [amount2, setAmount2] = useState(initialData?.amount2 ?? "");
  const [savedMessage, setSavedMessage] = useState(false);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && projectId
        ? await updateProjectSale(projectId, formData)
        : await createProjectSale(formData);

    if (!result.error) {
      if (mode === "create") {
        setItems([{ key: 0, category: "", amount: "" }]);
        setCustomerName("");
        setInstallment2(false);
        setAmount1("");
        setAmount2("");
      } else {
        setSavedMessage(true);
      }
    }
    return result;
  }, initialState);

  const preVat = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
    [items],
  );
  const vat = Math.round(preVat * 0.07 * 100) / 100;
  const total = preVat + vat;
  const outstanding = Math.max(0, total - (Number(amount1) || 0) - (Number(amount2) || 0));

  function addRow() {
    setItems((prev) => [...prev, { key: nextRowKey.current++, category: "", amount: "" }]);
  }
  function removeRow(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }
  function updateRow(key: number, field: "category" | "amount", value: string) {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setSavedMessage(false);
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
      )}
      {savedMessage && (
        <p className="rounded-md bg-green-100 p-3 text-sm text-green-900">บันทึกการแก้ไขเรียบร้อย</p>
      )}

      {/* Section 1: job info */}
      <div className="space-y-4">
        <h3 className="font-medium">ข้อมูลงาน</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="project_date">วันที่</Label>
            <Input
              id="project_date"
              name="project_date"
              type="date"
              defaultValue={initialData?.projectDate ?? todayISO()}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job_no">JOB NO.</Label>
            <Input
              id="job_no"
              name="job_no"
              defaultValue={mode === "edit" ? initialData?.jobNo ?? "" : suggestedJobNo()}
              readOnly={mode === "edit"}
              className={mode === "edit" ? "bg-muted" : undefined}
              placeholder="เช่น JB2607001"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_name">ชื่อลูกค้า</Label>
          <CustomerAutocomplete
            id="customer_name"
            name="customer_name"
            required
            value={customerName}
            onChange={(v) => {
              setCustomerName(v);
              setSavedMessage(false);
            }}
            customers={customers}
            placeholder="เช่น บจก. ABC"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project_name">ชื่องาน/โปรเจกต์</Label>
          <Input
            id="project_name"
            name="project_name"
            required
            defaultValue={initialData?.projectName}
            placeholder="เช่น โรงแรม XYZ ชั้น 3"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sales_rep_id">เซลล์</Label>
            <Select
              name="sales_rep_id"
              required
              defaultValue={initialData?.salesRepId}
              items={salesReps.map((rep) => ({ value: rep.id, label: rep.name }))}
            >
              <SelectTrigger id="sales_rep_id" className="w-full">
                <SelectValue placeholder="เลือกเซลล์" />
              </SelectTrigger>
              <SelectContent>
                {salesReps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_type">กลุ่มลูกค้า</Label>
            <Select name="customer_type" required defaultValue={initialData?.customerType}>
              <SelectTrigger id="customer_type" className="w-full">
                <SelectValue placeholder="เลือก" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="production_status">สถานะของงาน</Label>
          <Select
            name="production_status"
            defaultValue={initialData?.productionStatus || undefined}
          >
            <SelectTrigger id="production_status" className="w-full">
              <SelectValue placeholder="เลือกสถานะของงาน" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Section 2: product items */}
      <div className="space-y-4">
        <h3 className="font-medium">รายการสินค้า</h3>
        <div className="space-y-2">
          {items.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">ประเภทสินค้า</Label>
                <Select
                  name="item_category"
                  value={row.category}
                  onValueChange={(v) => updateRow(row.key, "category", v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-xs text-muted-foreground">จำนวนเงิน</Label>
                <Input
                  name="item_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, "amount", e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeRow(row.key)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            เพิ่มรายการ
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 rounded-md border p-3 text-sm">
          <div>
            <p className="text-muted-foreground">PRE.VAT</p>
            <p className="font-medium">{formatTHB(preVat)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">VAT (7%)</p>
            <p className="font-medium">{formatTHB(vat)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">รวมทั้งสิ้น</p>
            <p className="font-medium">{formatTHB(total)}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 3: costs */}
      <div className="space-y-4">
        <h3 className="font-medium">ต้นทุน (ถ้ามี)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="material_cost">ค่าวัสดุ</Label>
            <Input id="material_cost" name="material_cost" type="number" min="0" step="0.01" defaultValue={initialData?.costs.material_cost} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="glue_cost">ค่ากาว</Label>
            <Input id="glue_cost" name="glue_cost" type="number" min="0" step="0.01" defaultValue={initialData?.costs.glue_cost} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cutting_cost">ค่าตัด</Label>
            <Input id="cutting_cost" name="cutting_cost" type="number" min="0" step="0.01" defaultValue={initialData?.costs.cutting_cost} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="install_cost">ค่าติดตั้งผู้รับเหมา</Label>
            <Input id="install_cost" name="install_cost" type="number" min="0" step="0.01" defaultValue={initialData?.costs.install_cost} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parking_cost">ค่าที่จอดรถ</Label>
            <Input id="parking_cost" name="parking_cost" type="number" min="0" step="0.01" defaultValue={initialData?.costs.parking_cost} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_cost">ค่าขนส่ง</Label>
            <Input id="shipping_cost" name="shipping_cost" type="number" min="0" step="0.01" defaultValue={initialData?.costs.shipping_cost} placeholder="0" />
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 4: payments */}
      <div className="space-y-4">
        <h3 className="font-medium">การชำระเงิน</h3>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">งวดที่ 1</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_no_1">เลขที่เอกสาร</Label>
              <Input id="invoice_no_1" name="invoice_no_1" defaultValue={initialData?.invoiceNo1} placeholder="IV..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount_1">จำนวนเงิน</Label>
              <Input
                id="amount_1"
                name="amount_1"
                type="number"
                min="0"
                step="0.01"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid_date_1">วันที่รับชำระ</Label>
              <Input id="paid_date_1" name="paid_date_1" type="date" defaultValue={initialData?.paidDate1} />
            </div>
          </div>
        </div>

        {installment2 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">งวดที่ 2</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_no_2">เลขที่เอกสาร</Label>
                <Input id="invoice_no_2" name="invoice_no_2" defaultValue={initialData?.invoiceNo2} placeholder="IV..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount_2">จำนวนเงิน</Label>
                <Input
                  id="amount_2"
                  name="amount_2"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount2}
                  onChange={(e) => setAmount2(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_date_2">วันที่รับชำระ</Label>
                <Input id="paid_date_2" name="paid_date_2" type="date" defaultValue={initialData?.paidDate2} />
              </div>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setInstallment2(true)}>
            <Plus className="h-4 w-4" />
            เพิ่มงวดที่ 2
          </Button>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">สถานะ</Label>
            <Select name="status" required defaultValue={initialData?.status}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="เลือก" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">ยอดคงค้าง (คำนวณอัตโนมัติ)</Label>
            <p className="flex h-8 items-center text-sm font-medium">{formatTHB(outstanding)}</p>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : "บันทึกงานขาย"}
      </Button>
    </form>
  );
}
