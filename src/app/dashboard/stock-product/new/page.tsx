import { getDistinctStockSizes } from "@/lib/data/stock";
import { StockProductForm } from "../stock-product-form";

export default async function NewStockProductPage() {
  const sizeSuggestions = await getDistinctStockSizes();

  return <StockProductForm sizeSuggestions={sizeSuggestions} />;
}
