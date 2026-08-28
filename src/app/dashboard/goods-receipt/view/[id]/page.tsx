import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getGoodsReceiptById, getGoodsReceiptPaymentHistory } from "@/lib/data/goods-receipts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import { PaymentHistoryCard } from "./payment-history-card";

export default async function GoodsReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/goods-receipt")) redirect("/dashboard/sales");

  const { id } = await params;
  const [receipt, paymentHistory] = await Promise.all([
    getGoodsReceiptById(id),
    getGoodsReceiptPaymentHistory(id),
  ]);
  const showCosts = canSeeCosts(profile.role);
  const totalValue = receipt ? receipt.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0) : 0;
  const canEdit =
    receipt &&
    (profile.role === "owner" ||
      profile.role === "manager" ||
      (profile.role === "production" && receipt.receivedById === profile.id));
  const canManagePayments = profile.role === "owner" || profile.role === "manager" || profile.role === "account";
  const amountPaid = paymentHistory.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = Math.round((totalValue - amountPaid) * 100) / 100;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {receipt ? `ใบรับสินค้า ${receipt.docNo}` : "ไม่พบข้อมูล"}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/goods-receipt" className="underline underline-offset-2">
              ← กลับไปหน้ารับเข้าสินค้า
            </Link>
          </p>
        </div>
        {canEdit && (
          <Link
            href={`/dashboard/goods-receipt/edit/${id}`}
            className="text-sm underline underline-offset-2"
          >
            แก้ไข
          </Link>
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
                <p className="text-sm text-muted-foreground">ผู้จำหน่าย</p>
                <p className="font-medium">{receipt.supplierName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้รับ</p>
                <p className="font-medium">{receipt.receivedByName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เลขที่อ้างอิง</p>
                <p className="font-medium">{receipt.referenceNo ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่</p>
                <p className="font-medium">{new Date(receipt.createdAt).toLocaleString("th-TH")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สถานะการจ่ายเงิน</p>
                <p className="font-medium">
                  {receipt.paymentStatus}
                  {receipt.paymentStatus === "จ่ายแล้ว" && receipt.paidDate && ` (${receipt.paidDate})`}
                </p>
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
              <CardTitle>รายการสินค้า ({receipt.items.length})</CardTitle>
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
                      {showCosts && (
                        <TableCell className="text-right">{formatTHB(item.quantity * item.unitCost)}</TableCell>
                      )}
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

          {showCosts && (
            <PaymentHistoryCard
              receiptId={receipt.id}
              docNo={receipt.docNo}
              totalAmount={totalValue}
              amountPaid={amountPaid}
              remainingBalance={remainingBalance}
              payments={paymentHistory}
              canManage={canManagePayments}
            />
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบใบรับสินค้านี้ในระบบ</p>
      )}
    </div>
  );
}
