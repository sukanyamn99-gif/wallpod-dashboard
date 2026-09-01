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
import { getQuotationById } from "@/lib/data/quotations";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import { QuotationStatusActions } from "../quotation-actions";

function statusVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "ลูกค้าตอบตกลง") return "secondary";
  if (status === "ปฏิเสธ") return "destructive";
  return "outline";
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations")) redirect("/dashboard/sales");

  const { id } = await params;
  const quotation = await getQuotationById(id);

  if (!quotation) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">ไม่พบข้อมูล</h1>
        <p className="text-sm text-muted-foreground">ไม่พบใบเสนอราคานี้ในระบบ</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบเสนอราคา {quotation.docNo}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard/quotations" className="underline underline-offset-2">
              ← กลับไปหน้ารายการใบเสนอราคา
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(quotation.status)}>{quotation.status}</Badge>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/quotations/print/${id}`} target="_blank" />}>
            พิมพ์
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/quotations/edit/${id}`} />}>
            แก้ไข
          </Button>
        </div>
      </div>

      <QuotationStatusActions quotationId={id} status={quotation.status} />

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลลูกค้า/โครงการ</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">ชื่อโครงการ</p>
            <p className="font-medium">{quotation.projectName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">ลูกค้า</p>
            <p className="font-medium">{quotation.customerName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Attn</p>
            <p className="font-medium">{quotation.attn ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">พนักงานขาย</p>
            <p className="font-medium">{quotation.salesRepName ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">วันที่</p>
            <p className="font-medium">{new Date(quotation.quoteDate).toLocaleDateString("th-TH")}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">JOB Number / PO Number</p>
            <p className="font-medium">
              {quotation.jobNumber ?? "—"} / {quotation.poNumber ?? "—"}
            </p>
          </div>
          {quotation.remark && (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">หมายเหตุ</p>
              <p className="font-medium">{quotation.remark}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการสินค้า ({quotation.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสสินค้า</TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead className="text-right">ราคาต่อหน่วย</TableHead>
                <TableHead className="text-right">ส่วนลด</TableHead>
                <TableHead className="text-right">ราคาหลังส่วนลด</TableHead>
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead className="text-right">รวม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productCode ?? "—"}</TableCell>
                  <TableCell className="whitespace-pre-line">{item.description}</TableCell>
                  <TableCell className="text-right">{formatTHB(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{item.discountPercent}%</TableCell>
                  <TableCell className="text-right">{formatTHB(item.netPrice)}</TableCell>
                  <TableCell className="text-right">
                    {item.qty} {item.unit}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatTHB(item.totalPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">รวมเป็นเงิน</span>
              <span>{formatTHB(quotation.preVat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ภาษีมูลค่าเพิ่ม 7%</span>
              <span>{formatTHB(quotation.vat)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-semibold">
              <span>รวมทั้งสิ้น</span>
              <span>{formatTHB(quotation.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {quotation.paymentTerms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>เงื่อนไขการชำระเงิน</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>งวด</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.paymentTerms.map((term, i) => (
                  <TableRow key={i}>
                    <TableCell>{term.label}</TableCell>
                    <TableCell className="text-right">{term.percent}%</TableCell>
                    <TableCell className="text-right">{formatTHB(term.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
