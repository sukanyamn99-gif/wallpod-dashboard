"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProductionInfo } from "../actions";
import type { ProductionOrder } from "@/lib/types";

export function ProductionOrderForm({ order }: { order: ProductionOrder }) {
  const [jobNumber, setJobNumber] = useState(order.jobNumber ?? "");
  const [productCodes, setProductCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(order.items.map((it) => [it.id, it.productCode ?? ""])),
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string | null; savedAt: number } | null>(null);

  function handleSave() {
    const fd = new FormData();
    fd.set("job_number", jobNumber);
    for (const it of order.items) {
      fd.append("item_id", it.id);
      fd.append("item_product_code", productCodes[it.id] ?? "");
    }
    startTransition(async () => {
      const res = await updateProductionInfo(order.id, fd);
      setResult({ error: res.error, savedAt: Date.now() });
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="w-48 space-y-1">
          <Label htmlFor={`job_number_${order.id}`} className="text-xs">
            เลขที่ Job
          </Label>
          <Input
            id={`job_number_${order.id}`}
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            placeholder="เช่น JB2609001"
            className="text-base font-semibold"
          />
          <p className="text-sm text-muted-foreground">
            {order.projectName} — {order.customerName}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.quoteDate).toLocaleDateString("th-TH")}
            {order.salesRepName && ` • ${order.salesRepName}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">เลขที่ใบเสนอราคา</p>
          <CardTitle className="text-base">{order.docNo}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="p-2 font-medium">สินค้า</th>
                <th className="p-2 font-medium">ความหนา</th>
                <th className="p-2 font-medium">ขนาด</th>
                <th className="p-2 font-medium">สี</th>
                <th className="p-2 font-medium">รูปแบบการตัด</th>
                <th className="p-2 font-medium">จำนวน</th>
                <th className="w-40 p-2 font-medium">รหัสสินค้า</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b last:border-b-0">
                  <td className="p-2">{it.productName}</td>
                  <td className="p-2 text-muted-foreground">{it.thickness ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{it.size ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{it.color ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{it.cuttingPattern ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">
                    {it.qty} {it.unit}
                  </td>
                  <td className="p-1">
                    <Input
                      value={productCodes[it.id] ?? ""}
                      onChange={(e) => setProductCodes((prev) => ({ ...prev, [it.id]: e.target.value }))}
                      placeholder="รหัสสินค้า"
                      className="h-8"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={pending}>
            <Save className="h-4 w-4" />
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
          {result && !result.error && <p className="text-sm text-muted-foreground">บันทึกแล้ว</p>}
        </div>
      </CardContent>
    </Card>
  );
}
