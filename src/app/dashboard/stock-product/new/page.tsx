import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockProductForm } from "../stock-product-form";

export default function NewStockProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">เพิ่มสินค้าใหม่</h1>
        <p className="text-sm text-muted-foreground">เพิ่มรายการสินค้าคงคลังใหม่</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <StockProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
