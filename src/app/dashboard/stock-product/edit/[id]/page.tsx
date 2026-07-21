import Link from "next/link";
import { getDistinctStockSizes, getSignedStockProductImageUrl, getStockProductById } from "@/lib/data/stock";
import { StockProductForm } from "../../stock-product-form";

export default async function EditStockProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, sizeSuggestions] = await Promise.all([getStockProductById(id), getDistinctStockSizes()]);

  if (!product) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/stock-product" className="underline underline-offset-2">
            ← กลับไปหน้า Stock Product
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">ไม่พบสินค้านี้ในระบบ</p>
      </div>
    );
  }

  const imageUrl = await getSignedStockProductImageUrl(product.imagePath);

  return (
    <StockProductForm
      mode="edit"
      productId={product.id}
      sizeSuggestions={sizeSuggestions}
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
        sellingPrice: product.sellingPrice !== null ? String(product.sellingPrice) : "",
        quantityOnHand: product.quantityOnHand,
        imageUrl,
      }}
    />
  );
}
