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
import { getPurchaseRequestById } from "@/lib/data/purchase-requests";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import { RequestApprovalActions } from "../../request-approval-actions";

function statusVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "อนุมัติ") return "secondary";
  if (status === "ไม่อนุมัติ") return "destructive";
  return "outline";
}

export default async function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-requests")) redirect("/dashboard/sales");

  const { id } = await params;
  const request = await getPurchaseRequestById(id);
  const canApprove = profile.role === "owner" || profile.role === "manager";
  const showCosts = canSeeCosts(profile.role);
  const grandTotal = request ? request.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{request ? `ใบขอซื้อ ${request.docNo}` : "ไม่พบข้อมูล"}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/purchase-requests" className="underline underline-offset-2">
              ← กลับไปหน้าใบขอซื้อ
            </Link>
          </p>
        </div>
        {request && (
          <div className="flex items-start gap-2">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/purchase-requests/print/${id}`} target="_blank" />}
            >
              พิมพ์
            </Button>
            {canApprove && request.status === "รออนุมัติ" && <RequestApprovalActions requestId={id} />}
            {request.status === "อนุมัติ" && (
              <Button size="sm" nativeButton={false} render={<Link href={`/dashboard/purchase-orders/new?requestId=${id}`} />}>
                สร้างใบสั่งซื้อจากใบขอซื้อนี้
              </Button>
            )}
          </div>
        )}
      </div>

      {request ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลใบขอซื้อ</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">ฝ่าย/แผนก</p>
                <p className="font-medium">{request.departmentName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้ขอซื้อ</p>
                <p className="font-medium">{request.requestedByName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่ขอ</p>
                <p className="font-medium">{new Date(request.requestDate).toLocaleDateString("th-TH")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สถานะ</p>
                <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PROJECT</p>
                <p className="font-medium">
                  {request.jobNo || request.projectName
                    ? [request.jobNo, request.projectName].filter(Boolean).join("_")
                    : "—"}
                </p>
              </div>
              {(request.koonwayRefNo || request.flexiplanRefNo) && (
                <div>
                  <p className="text-sm text-muted-foreground">เลขที่อ้างอิง</p>
                  <p className="font-medium">
                    {request.koonwayRefNo && `No. Koonway: ${request.koonwayRefNo}`}
                    {request.koonwayRefNo && request.flexiplanRefNo && " · "}
                    {request.flexiplanRefNo && `No. Flexiplan: ${request.flexiplanRefNo}`}
                  </p>
                </div>
              )}
              {request.purpose && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">เหตุผล / วัตถุประสงค์</p>
                  <p className="font-medium">{request.purpose}</p>
                </div>
              )}
              {request.approvedByName && (
                <div>
                  <p className="text-sm text-muted-foreground">ผู้อนุมัติ</p>
                  <p className="font-medium">
                    {request.approvedByName}
                    {request.approvedAt && ` (${new Date(request.approvedAt).toLocaleString("th-TH")})`}
                  </p>
                </div>
              )}
              {request.note && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">หมายเหตุ</p>
                  <p className="font-medium">{request.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายการสินค้าที่ขอซื้อ ({request.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสสินค้า</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead>ผู้ขาย (Supplier)</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    {showCosts && <TableHead className="text-right">ราคา/หน่วย</TableHead>}
                    {showCosts && <TableHead className="text-right">รวม</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productSku ?? "—"}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.supplierName ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      {showCosts && <TableCell className="text-right">{formatTHB(item.unitPrice)}</TableCell>}
                      {showCosts && <TableCell className="text-right">{formatTHB(item.quantity * item.unitPrice)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {showCosts && (
                <p className="mt-4 text-right text-sm">
                  มูลค่ารวม: <span className="font-semibold">{formatTHB(grandTotal)}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบใบขอซื้อนี้ในระบบ</p>
      )}
    </div>
  );
}
