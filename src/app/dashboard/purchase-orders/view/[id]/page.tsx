import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPurchaseOrderById } from "@/lib/data/purchase-orders";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import type { PurchaseOrderReceivingStatus } from "@/lib/types";

function receivingVariant(status: PurchaseOrderReceivingStatus): "secondary" | "outline" | "default" {
  if (status === "รับครบแล้ว") return "secondary";
  if (status === "รับบางส่วน") return "default";
  return "outline";
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-orders")) redirect("/dashboard/sales");

  const { id } = await params;
  const order = await getPurchaseOrderById(id);
  const showCosts = canSeeCosts(profile.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{order ? `ใบสั่งซื้อ ${order.docNo}` : "ไม่พบข้อมูล"}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/purchase-orders" className="underline underline-offset-2">
              ← กลับไปหน้าใบสั่งซื้อ
            </Link>
          </p>
        </div>
        {order && order.receivingStatus !== "รับครบแล้ว" && (
          <Button size="sm" nativeButton={false} render={<Link href={`/dashboard/purchase-order-receipts/new?orderId=${id}`} />}>
            รับสินค้าตามใบสั่งซื้อนี้
          </Button>
        )}
      </div>

      {order ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลใบสั่งซื้อ</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">อ้างอิงใบขอซื้อ</p>
                <p className="font-medium">
                  <Link href={`/dashboard/purchase-requests/view/${order.requestId}`} className="underline underline-offset-2">
                    {order.requestDocNo}
                  </Link>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้จำหน่าย</p>
                <p className="font-medium">{order.supplierName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้สั่งซื้อ</p>
                <p className="font-medium">{order.orderedByName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่สั่งซื้อ</p>
                <p className="font-medium">{new Date(order.orderDate).toLocaleDateString("th-TH")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่คาดว่าจะได้รับ</p>
                <p className="font-medium">{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("th-TH") : "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สถานะรับสินค้า</p>
                <Badge variant={receivingVariant(order.receivingStatus)}>{order.receivingStatus}</Badge>
              </div>
              {order.note && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">หมายเหตุ</p>
                  <p className="font-medium">{order.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายการสินค้า ({order.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสสินค้า</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead className="text-right">สั่งซื้อ</TableHead>
                    <TableHead className="text-right">รับแล้ว</TableHead>
                    <TableHead className="text-right">คงเหลือ</TableHead>
                    {showCosts && <TableHead className="text-right">ราคา/หน่วย</TableHead>}
                    {showCosts && <TableHead className="text-right">รวม</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productSku ?? "—"}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">{item.receivedQuantity}</TableCell>
                      <TableCell className="text-right">{Math.max(0, item.quantity - item.receivedQuantity)}</TableCell>
                      {showCosts && <TableCell className="text-right">{formatTHB(item.unitPrice)}</TableCell>}
                      {showCosts && <TableCell className="text-right">{formatTHB(item.quantity * item.unitPrice)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {showCosts && (
                <p className="mt-4 text-right text-sm">
                  มูลค่ารวม: <span className="font-semibold">{formatTHB(order.totalAmount)}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบใบสั่งซื้อนี้ในระบบ</p>
      )}
    </div>
  );
}
