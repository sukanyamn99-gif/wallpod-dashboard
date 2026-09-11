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
import { canAccessPage } from "@/lib/permissions";
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
                <p className="text-sm text-muted-foreground">แผนก</p>
                <p className="font-medium">{request.departmentName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้ขอซื้อ</p>
                <p className="font-medium">{request.requestedByName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่</p>
                <p className="font-medium">{new Date(request.requestDate).toLocaleDateString("th-TH")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สถานะ</p>
                <Badge variant={statusVariant(request.status)}>{request.status}</Badge>
              </div>
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
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productSku ?? "—"}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell>{item.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบใบขอซื้อนี้ในระบบ</p>
      )}
    </div>
  );
}
