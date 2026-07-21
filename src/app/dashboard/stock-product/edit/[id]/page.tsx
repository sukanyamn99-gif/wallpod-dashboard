import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStockProductById } from "@/lib/data/stock";
import { StockProductForm } from "../../stock-product-form";

export default async function EditStockProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getStockProductById(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขสินค้า</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/stock-product" className="underline underline-offset-2">
            ← กลับไปหน้า Stock Product
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{product ? "แก้ไขข้อมูลสินค้า" : "ไม่พบข้อมูล"}</CardTitle>
        </CardHeader>
        <CardContent>
          {product ? (
            <StockProductForm
              mode="edit"
              productId={product.id}
              initialData={{
                sku: product.sku ?? "",
                name: product.name,
                category: product.category ?? "",
                color: product.color ?? "",
                size: product.size ?? "",
                thickness: product.thickness ?? "",
                location: product.location ?? "",
                note: product.note ?? "",
                unit: product.unit,
                reorderPoint: String(product.reorderPoint),
                unitCost: String(product.unitCost),
                quantityOnHand: product.quantityOnHand,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">ไม่พบสินค้านี้ในระบบ</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
