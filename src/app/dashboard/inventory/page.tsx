import { AlertTriangle, Boxes, PackageSearch, PackageX } from "lucide-react";
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
import { getCurrentProfile } from "@/lib/data/profile";
import { canSeeCosts } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";

export default async function StockDashboardPage() {
  const [data, profile] = await Promise.all([getStockDashboardData(), getCurrentProfile()]);
  const showCosts = profile ? canSeeCosts(profile.role) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมสต๊อกคงเหลือ</p>
      </div>

      <div className={`grid gap-4 ${showCosts ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <KpiCard label="จำนวนรายการสินค้า" value={`${data.skuCount} รายการ`} icon={Boxes} tone="blue" />
        {showCosts && (
          <KpiCard label="มูลค่าสต๊อกรวม" value={formatTHB(data.totalStockValue)} icon={PackageSearch} tone="green" />
        )}
        <KpiCard label="รายการต่ำกว่าจุดสั่งซื้อ" value={`${data.lowStockCount} รายการ`} icon={AlertTriangle} tone="rose" />
        <KpiCard label="สินค้า Dead Stock" value={`${data.deadStockCount} รายการ`} icon={PackageX} tone="amber" />
      </div>

      {showCosts && <StockByCategoryChart data={data.categoryBreakdown} />}

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

      <Card>
        <CardHeader>
          <CardTitle>สินค้า Dead Stock (ไม่มีความเคลื่อนไหวเกิน 6 เดือน)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
                  <TableHead className="whitespace-nowrap">หมวดหมู่</TableHead>
                  <TableHead className="text-right whitespace-nowrap">คงเหลือ</TableHead>
                  <TableHead className="whitespace-nowrap">เคลื่อนไหวล่าสุด</TableHead>
                  <TableHead className="text-right whitespace-nowrap">ไม่เคลื่อนไหว (วัน)</TableHead>
                  {showCosts && <TableHead className="text-right whitespace-nowrap">มูลค่าคงค้าง</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.deadStockItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={showCosts ? 6 : 5} className="text-center text-muted-foreground">
                      ไม่มีสินค้า Dead Stock
                    </TableCell>
                  </TableRow>
                )}
                {data.deadStockItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap font-medium">{p.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.category ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p.quantityOnHand} {p.unit}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.neverMoved ? (
                        <span className="text-muted-foreground">ไม่เคยเคลื่อนไหว (นับจากวันเพิ่มสินค้า)</span>
                      ) : (
                        new Date(p.lastActivityAt).toLocaleDateString("th-TH")
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Badge variant="secondary">{p.daysIdle} วัน</Badge>
                    </TableCell>
                    {showCosts && (
                      <TableCell className="text-right whitespace-nowrap">
                        {formatTHB(p.quantityOnHand * p.unitCost)}
                      </TableCell>
                    )}
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
