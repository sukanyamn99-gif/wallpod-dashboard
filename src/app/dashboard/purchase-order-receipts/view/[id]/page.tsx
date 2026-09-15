import { redirect } from "next/navigation";
import Link from "next/link";
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
import { getPurchaseOrderReceiptById } from "@/lib/data/purchase-order-receipts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";

// Mirrors purchase_order_receipts_update's own RLS: owner/manager can edit
// any receipt, anyone else only their own.
function canEdit(role: string, receivedById: string | null, profileId: string) {
  if (role === "owner" || role === "manager") return true;
  return receivedById === profileId;
}

export default async function PurchaseOrderReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-order-receipts")) redirect("/dashboard/sales");

  const { id } = await params;
  const receipt = await getPurchaseOrderReceiptById(id);
  const showCosts = canSeeCosts(profile.role);
  const totalValue = receipt ? receipt.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{receipt ? `ใบรับสินค้า ${receipt.docNo}` : "ไม่พบข้อมูล"}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/purchase-order-receipts" className="underline underline-offset-2">
              ← กลับไปหน้าใบรับสินค้า
            </Link>
          </p>
        </div>
        {receipt && (
          <div className="flex items-start gap-2">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/purchase-order-receipts/print/${id}`} target="_blank" />}
            >
              พิมพ์
            </Button>
            {canEdit(profile.role, receipt.receivedById, profile.id) && (
              <Button size="sm" nativeButton={false} render={<Link href={`/dashboard/purchase-order-receipts/edit/${id}`} />}>
                แก้ไข
              </Button>
            )}
          </div>
        )}
      </div>

      {receipt ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลใบรับสินค้า</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">อ้างอิงใบสั่งซื้อ</p>
                <p className="font-medium">
                  <Link href={`/dashboard/purchase-orders/view/${receipt.orderId}`} className="underline underline-offset-2">
                    {receipt.orderDocNo}
                  </Link>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้รับสินค้า</p>
                <p className="font-medium">{receipt.receivedByName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่</p>
                <p className="font-medium">{new Date(receipt.createdAt).toLocaleString("th-TH")}</p>
              </div>
              {receipt.note && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">หมายเหตุ</p>
                  <p className="font-medium">{receipt.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายการที่รับเข้า ({receipt.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสสินค้า</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    {showCosts && <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>}
                    {showCosts && <TableHead className="text-right">รวม</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipt.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productSku ?? "—"}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      {showCosts && <TableCell className="text-right">{formatTHB(item.unitCost)}</TableCell>}
                      {showCosts && <TableCell className="text-right">{formatTHB(item.quantity * item.unitCost)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {showCosts && (
                <p className="mt-4 text-right text-sm">
                  มูลค่ารวม: <span className="font-semibold">{formatTHB(totalValue)}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบใบรับสินค้านี้ในระบบ</p>
      )}
    </div>
  );
}
