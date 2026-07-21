import { AlertTriangle, Boxes, PackageSearch } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StockByCategoryChart } from "@/components/dashboard/stock-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStockDashboardData } from "@/lib/data/stock";
import { formatTHB } from "@/lib/format";

export default async function StockDashboardPage() {
  const data = await getStockDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมสต๊อกคงเหลือ</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="จำนวนรายการสินค้า" value={`${data.skuCount} รายการ`} icon={Boxes} />
        <KpiCard label="มูลค่าสต๊อกรวม" value={formatTHB(data.totalStockValue)} icon={PackageSearch} />
        <KpiCard label="รายการต่ำกว่าจุดสั่งซื้อ" value={`${data.lowStockCount} รายการ`} icon={AlertTriangle} />
      </div>

      <StockByCategoryChart data={data.categoryBreakdown} />

      <Card>
        <CardHeader>
          <CardTitle>รายการที่ต่ำกว่าจุดสั่งซื้อขั้นต่ำ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
                  <TableHead className="whitespace-nowrap">หมวดหมู่</TableHead>
                  <TableHead className="text-right whitespace-nowrap">คงเหลือ</TableHead>
                  <TableHead className="text-right whitespace-nowrap">จุดสั่งซื้อ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lowStockItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      ไม่มีรายการที่ต่ำกว่าจุดสั่งซื้อ
                    </TableCell>
                  </TableRow>
                )}
                {data.lowStockItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap font-medium">{p.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.category ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Badge variant="destructive">
                        {p.quantityOnHand} {p.unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p.reorderPoint} {p.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
