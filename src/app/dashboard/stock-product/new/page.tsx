import { getDistinctStockSizes } from "@/lib/data/stock";
import { getProductCategories } from "@/lib/data/reference";
import { StockProductForm } from "../stock-product-form";

export default async function NewStockProductPage() {
  const [sizeSuggestions, categories] = await Promise.all([getDistinctStockSizes(), getProductCategories()]);

  return <StockProductForm sizeSuggestions={sizeSuggestions} categories={categories.map((c) => c.name)} />;
}
