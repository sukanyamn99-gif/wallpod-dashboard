import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv(file) {
  const content = fs.readFileSync(file, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv(path.resolve(process.cwd(), ".env.import.local"));
loadEnv(path.resolve(process.cwd(), ".env.local"));

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: products } = await admin.from("stock_products").select("id, sku, name, quantity_on_hand, unit_cost").ilike("name", "%BONE%");
console.log("products matching BONE:", products);

for (const product of products ?? []) {
  const { data: lots } = await admin.from("stock_product_lots").select("*").eq("stock_product_id", product.id).order("received_at");
  console.log(`\nlots for ${product.name} (${product.sku}):`, lots);
}

const { data: allReceipts } = await admin.from("goods_receipts").select("id, doc_no, created_at").order("created_at");
console.log("\nALL goods_receipts currently in DB:", allReceipts);
