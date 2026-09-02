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
import { getStockRequisitionById } from "@/lib/data/stock-requisitions";
import { getCurrentProfile } from "@/lib/data/profile";
import { canSeeRequisitionCosts } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import { REQUISITION_PURPOSE_LABELS } from "@/lib/types";

// Mirrors requisitions-table.tsx's canDelete rule — owner/manager can edit
// any requisition, anyone else only their own.
function canEdit(role: string, requestedById: string | null, profileId: string) {
  if (role === "owner" || role === "manager") return true;
  return requestedById === profileId;
}

export default async function StockRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [requisition, profile] = await Promise.all([getStockRequisitionById(id), getCurrentProfile()]);
  const showCosts = canSeeRequisitionCosts(profile?.role ?? "sales");
  const allowEdit =
    !!requisition && !!profile && canEdit(profile.role, requisition.requestedById, profile.id);
  const totalValue = requisition ? requisition.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0) : 0;
  // getStockRequisitionById() already falls back to the product's current
  // cost (isEstimatedCost) when the withdrawal-time snapshot is missing —
  // only an item whose product was later deleted (no snapshot, no live
  // product to fall back to) still has a genuine 0 here.
  const hasAnyCost = requisition ? requisition.items.some((it) => it.unitCost > 0) : false;
  const hasEstimatedCost = requisition ? requisition.items.some((it) => it.isEstimatedCost) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {requisition ? `ใบเบิกสินค้า ${requisition.docNo}` : "ไม่พบข้อมูล"}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/stock-requisition" className="underline underline-offset-2">
              ← กลับไปหน้าใบเบิกสินค้า
            </Link>
          </p>
        </div>
        {requisition && (
          <div className="flex gap-2">
            {allowEdit && (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/dashboard/stock-requisition/edit/${id}`} />}
              >
                แก้ไข
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/stock-requisition/print/${id}`} target="_blank" />}
            >
              พิมพ์
            </Button>
          </div>
        )}
      </div>

      {requisition ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลใบเบิก</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">แผนก</p>
                <p className="font-medium">{requisition.departmentName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้เบิก</p>
                <p className="font-medium">{requisition.requestedByName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เลข JOB</p>
                <p className="font-medium">{requisition.jobNo ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ชื่องาน / โครงการ</p>
                <p className="font-medium">{requisition.projectName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วัตถุประสงค์</p>
                <p className="font-medium">{REQUISITION_PURPOSE_LABELS[requisition.purpose]}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ลูกค้า</p>
                <p className="font-medium">{requisition.customerName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สถานะ</p>
                <Badge variant="secondary">{requisition.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่</p>
                <p className="font-medium">{new Date(requisition.createdAt).toLocaleString("th-TH")}</p>
              </div>
              {requisition.note && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">หมายเหตุ</p>
                  <p className="font-medium">{requisition.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายการสินค้า ({requisition.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสสินค้า</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    {showCosts && <TableHead className="text-right">ราคาต้นทุน/หน่วย</TableHead>}
                    {showCosts && <TableHead className="text-right">รวม</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisition.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productSku ?? "—"}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      {showCosts && (
                        <TableCell className="text-right">
                          {item.unitCost > 0 ? formatTHB(item.unitCost) : "—"}
                          {item.isEstimatedCost && "*"}
                        </TableCell>
                      )}
                      {showCosts && (
                        <TableCell className="text-right">
                          {item.unitCost > 0 ? formatTHB(item.quantity * item.unitCost) : "—"}
                          {item.isEstimatedCost && "*"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {showCosts &&
                (hasAnyCost ? (
                  <div className="mt-4 text-right text-sm">
                    <p>
                      มูลค่ารวม: <span className="font-semibold">{formatTHB(totalValue)}</span>
                    </p>
                    {hasEstimatedCost && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        * ประมาณจากต้นทุน/หน่วยปัจจุบันของสินค้า (ใบเบิกนี้บันทึกก่อนระบบเริ่มบันทึกราคาต้นทุน ณ วันที่เบิกจริง)
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-right text-sm text-muted-foreground">
                    ไม่มีข้อมูลต้นทุน (สินค้าถูกลบออกจากระบบแล้ว)
                  </p>
                ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบใบเบิกนี้ในระบบ</p>
      )}
    </div>
  );
}
