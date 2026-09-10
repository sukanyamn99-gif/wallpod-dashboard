import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// One-time backfill: goods receipts edited BEFORE migration_022 (the
// edit_goods_receipt_item lot-sync fix) landed left their matching
// stock_product_lots row stuck at whatever quantity/cost it had at
// creation time, even though the receipt itself (and the aggregate
// stock_products.quantity_on_hand) was correctly updated. This script
// reconciles every lot against its current goods_receipt_items value,
// using the same "preserve already-consumed quantity" math the RPC now
// applies on every future edit. Read-only unless --apply is passed.

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

const { data: items, error: itemsErr } = await admin
  .from("goods_receipt_items")
  .select("stock_product_id, quantity, unit_cost, product_name_snapshot, goods_receipts(doc_no)")
  .not("stock_product_id", "is", null);
if (itemsErr) throw itemsErr;

const { data: lots, error: lotsErr } = await admin
  .from("stock_product_lots")
  .select("id, stock_product_id, quantity_received, quantity_remaining, unit_cost, reference_no");
if (lotsErr) throw lotsErr;

const lotByKey = new Map(lots.map((l) => [l.stock_product_id + "|" + l.reference_no, l]));

let staleCount = 0;
for (const item of items) {
  const docNo = item.goods_receipts?.doc_no;
  if (!docNo) continue;
  const key = item.stock_product_id + "|" + docNo;
  const lot = lotByKey.get(key);
  if (!lot) continue; // no lot ever existed for this line (pre-lots-feature or was never synced) — out of scope, correctly shows as "unspecified"

  const currentQty = Number(item.quantity);
  const currentCost = Number(item.unit_cost);
  const lotQty = Number(lot.quantity_received);
  const lotCost = Number(lot.unit_cost);

  if (lotQty === currentQty && lotCost === currentCost) continue; // already in sync

  staleCount++;
  const consumed = lotQty - Number(lot.quantity_remaining);
  const newRemaining = Math.max(0, currentQty - consumed);
  console.log(
    `STALE: ${item.product_name_snapshot} (doc ${docNo}) — lot says ${lotQty}@${lotCost}, receipt line now ${currentQty}@${currentCost}. ` +
      `consumed so far: ${consumed}. Fixing to received=${currentQty}, remaining=${newRemaining}, cost=${currentCost}`,
  );

  if (APPLY) {
    const { error: updErr } = await admin
      .from("stock_product_lots")
      .update({ quantity_received: currentQty, quantity_remaining: newRemaining, unit_cost: currentCost })
      .eq("id", lot.id);
    if (updErr) console.error("  FAILED to update:", updErr.message);
    else console.log("  fixed.");
  }
}

console.log(`\n${staleCount} stale lot(s) found${APPLY ? ", fixed" : " (dry run — pass --apply to fix)"}.`);
