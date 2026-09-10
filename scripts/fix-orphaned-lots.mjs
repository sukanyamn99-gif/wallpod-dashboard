import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// One-time backfill: any stock_product_lots row whose reference_no no
// longer matches an existing goods_receipts.doc_no came from a receipt
// that was deleted BEFORE the auto-reverse-on-delete fix existed. Going
// forward, deleting a receipt zeroes its lot as part of the same
// transaction, so this condition can only describe pre-fix history.
// Subtracts each orphaned lot's still-remaining quantity from the
// product's aggregate and zeroes the lot, with an audit stock_movements
// row. Read-only unless --apply is passed.

function loadEnv(file) {
  const content = fs.readFileSync(file, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv(path.resolve(process.cwd(), ".env.import.local"));
loadEnv(path.resolve(process.cwd(), ".env.local"));

const APPLY = process.argv.includes("--apply");
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: lots, error: lotsErr } = await admin
  .from("stock_product_lots")
  .select("id, stock_product_id, quantity_received, quantity_remaining, reference_no, stock_products(name, sku, quantity_on_hand)")
  .gt("quantity_remaining", 0)
  .not("reference_no", "is", null);
if (lotsErr) throw lotsErr;

const { data: receipts, error: receiptsErr } = await admin.from("goods_receipts").select("doc_no");
if (receiptsErr) throw receiptsErr;
const existingDocNos = new Set(receipts.map((r) => r.doc_no));

const orphaned = lots.filter((l) => !existingDocNos.has(l.reference_no));

if (orphaned.length === 0) {
  console.log("No orphaned lots found.");
  process.exit(0);
}

console.log(`Found ${orphaned.length} orphaned lot(s):\n`);
for (const lot of orphaned) {
  const product = lot.stock_products;
  const remaining = Number(lot.quantity_remaining);
  const currentOnHand = Number(product.quantity_on_hand);
  const newOnHand = currentOnHand - remaining;
  console.log(
    `${product.name} (${product.sku ?? "no sku"}) — orphaned lot ${lot.reference_no}: ${remaining} ชิ้น remaining. ` +
      `On hand ${currentOnHand} -> ${newOnHand}`,
  );

  if (APPLY) {
    const { error: movementErr } = await admin.from("stock_movements").insert({
      stock_product_id: lot.stock_product_id,
      movement_type: "out",
      quantity: remaining,
      note: `แก้ไขข้อมูล: ลบสต็อกที่ค้างจากใบรับสินค้า ${lot.reference_no} ซึ่งถูกลบไปแล้วก่อนระบบจะหักสต็อกอัตโนมัติ`,
      balance_before: currentOnHand,
      balance_after: newOnHand,
      reference_no: null,
    });
    if (movementErr) {
      console.error("  FAILED to insert movement:", movementErr.message);
      continue;
    }
    const { error: prodErr } = await admin
      .from("stock_products")
      .update({ quantity_on_hand: newOnHand, updated_at: new Date().toISOString() })
      .eq("id", lot.stock_product_id);
    if (prodErr) {
      console.error("  FAILED to update product:", prodErr.message);
      continue;
    }
    const { error: lotErr } = await admin.from("stock_product_lots").update({ quantity_remaining: 0 }).eq("id", lot.id);
    if (lotErr) {
      console.error("  FAILED to zero lot:", lotErr.message);
      continue;
    }
    console.log("  fixed.");
  }
}

console.log(`\n${orphaned.length} orphaned lot(s)${APPLY ? " fixed" : " found (dry run — pass --apply to fix)"}.`);
