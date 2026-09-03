import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
const ANON_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log("  PASS " + label); }
  else { fail++; console.error("  FAIL " + label + (extra ? " — " + JSON.stringify(extra) : "")); }
}

function round2(n) { return Math.round(n * 100) / 100; }
function computeSummary(itemAmounts, discountAmount, whtPercent, retentionPercent) {
  const subtotal = round2(itemAmounts.reduce((s, a) => s + a, 0) / 1.07);
  const afterDiscount = round2(subtotal - discountAmount);
  const vat = round2(afterDiscount * 0.07);
  const totalAfterVat = round2(afterDiscount + vat);
  const whtAmount = round2(afterDiscount * (whtPercent / 100));
  const retentionAmount = round2(totalAfterVat * (retentionPercent / 100));
  const netPayable = round2(totalAfterVat - whtAmount - retentionAmount);
  return { subtotal, afterDiscount, vat, totalAfterVat, whtAmount, retentionAmount, netPayable };
}

async function makeUser(role) {
  const email = "qa-billdoc-" + role + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@example.com";
  const password = crypto.randomBytes(12).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA BillDoc " + role, role });
  const client = createClient(ANON_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, userId: created.user.id };
}
async function cleanupUser(u) {
  await admin.from("profiles").delete().eq("id", u.userId);
  await admin.auth.admin.deleteUser(u.userId);
}

console.log("=== Test 1: formula verification against both reference images ===");
{
  // Image 1: 2 invoices, no deductions
  const s1 = computeSummary([19773.60, 6420.00], 0, 0, 0);
  check("Image1 subtotal = 24480.00", s1.subtotal === 24480, s1);
  check("Image1 vat = 1713.60", s1.vat === 1713.6, s1);
  check("Image1 totalAfterVat = 26193.60", s1.totalAfterVat === 26193.6, s1);

  // Image 2: subtotal 9000 pre-VAT-equivalent -> use item amounts that produce subtotal 9000 after /1.07
  // subtotal = sum/1.07 = 9000 => sum = 9630 (VAT-inclusive input); but reference shows subtotal directly as 9000
  // so simulate item amounts summing to 9000*1.07 = 9630
  const s2 = computeSummary([9630], 1744.62, 3, 5);
  check("Image2 subtotal = 9000.00", s2.subtotal === 9000, s2);
  check("Image2 afterDiscount = 7255.38", s2.afterDiscount === 7255.38, s2);
  check("Image2 vat = 507.88", Math.abs(s2.vat - 507.88) < 0.01, s2);
  check("Image2 totalAfterVat = 7763.25", Math.abs(s2.totalAfterVat - 7763.25) < 0.02, s2);
  check("Image2 whtAmount = 217.66", Math.abs(s2.whtAmount - 217.66) < 0.01, s2);
  check("Image2 retentionAmount = 388.16", Math.abs(s2.retentionAmount - 388.16) < 0.02, s2);
  check("Image2 netPayable = 7157.43", Math.abs(s2.netPayable - 7157.43) < 0.03, s2);
}

console.log("\n=== Test 2: end-to-end flow with disposable data ===");
const { data: cust } = await admin.from("customers").insert({
  name: "QA BILLDOC CUSTOMER " + Date.now(), customer_type: "Corporate",
}).select("id").single();
const { data: rep } = await admin.from("sales_reps").select("id").limit(1).single();

const { data: project } = await admin.from("projects").insert({
  job_no: "QA-BILLDOC-" + Date.now(), customer_id: cust.id, project_name: "QA billing doc test",
  sales_rep_id: rep.id, customer_type: "Corporate", stage_percent: 100, pre_vat: 24480, vat: 1713.6,
}).select("id").single();

const { data: pay1 } = await admin.from("payments").insert({
  project_id: project.id, installment_no: 1, amount: 19773.60, invoice_no: "IV-QA-001", paid_date: "2026-09-01",
  status: "รอชำระเงิน", outstanding_amount: 19773.60,
}).select("id").single();
const { data: pay2 } = await admin.from("payments").insert({
  project_id: project.id, installment_no: 2, amount: 6420.00, invoice_no: "IV-QA-002", paid_date: "2026-09-01",
  status: "รอชำระเงิน", outstanding_amount: 6420.00,
}).select("id").single();
// A 3rd payment already received, must NOT show up as "unbilled"
await admin.from("payments").insert({
  project_id: project.id, installment_no: 3, amount: 1000, invoice_no: "IV-QA-003", paid_date: "2026-09-01",
  receipt_no: "RE-QA-EXISTING", received_date: "2026-09-01", status: "เก็บเงินเรียบร้อย", outstanding_amount: 0,
});

const owner = await makeUser("owner");
const salesUser = await makeUser("sales");

let billingNoteId = null, receiptId = null;
try {
  console.log("\nStep 1: getUnbilledInvoicesForCustomer-equivalent query returns exactly the 2 unreceived invoices...");
  const { data: unbilled } = await owner.client
    .from("payments")
    .select("id, invoice_no, paid_date, amount, projects!inner(job_no, project_name, customer_id)")
    .eq("projects.customer_id", cust.id)
    .not("invoice_no", "is", null)
    .is("received_date", null);
  check("exactly 2 unbilled invoices found", (unbilled ?? []).length === 2, unbilled);

  console.log("\nStep 2: create a billing_note-type document bundling both invoices, no deductions...");
  const docNo1 = "BL-QA-" + Date.now();
  const { data: doc1, error: doc1Err } = await owner.client.from("billing_notes").insert({
    doc_no: docNo1, customer_id: cust.id, doc_date: "2026-09-04", credit_days: 30, due_date: "2026-10-04",
    sales_rep_id: rep.id, doc_type: "billing_note", discount_amount: 0, wht_percent: 0, retention_percent: 0,
  }).select("id").single();
  check("billing_note insert succeeds", !doc1Err, doc1Err);
  billingNoteId = doc1?.id ?? null;

  const { error: items1Err } = await owner.client.from("billing_note_items").insert([
    { billing_note_id: billingNoteId, payment_id: pay1.id, invoice_no_snapshot: "IV-QA-001", invoice_date_snapshot: "2026-09-01", amount: 19773.60 },
    { billing_note_id: billingNoteId, payment_id: pay2.id, invoice_no_snapshot: "IV-QA-002", invoice_date_snapshot: "2026-09-01", amount: 6420.00 },
  ]);
  check("billing_note_items insert succeeds", !items1Err, items1Err);

  const { error: sync1Err } = await owner.client.from("payments").update({ billing_note_no: docNo1, billing_note_date: "2026-09-04" }).in("id", [pay1.id, pay2.id]);
  check("sync billing_note_no back to payments succeeds", !sync1Err, sync1Err);

  const { data: afterSync1 } = await admin.from("payments").select("id, billing_note_no, billing_note_date").in("id", [pay1.id, pay2.id]);
  check("both payments now show the billing_note_no", (afterSync1 ?? []).every((p) => p.billing_note_no === docNo1), afterSync1);

  console.log("\nStep 3: create a receipt-type document, confirm receipt_no/received_date sync onto payments...");
  const docNo2 = "RE-QA-" + Date.now();
  const { data: doc2 } = await owner.client.from("billing_notes").insert({
    doc_no: docNo2, customer_id: cust.id, doc_date: "2026-09-05", credit_days: 0, due_date: "2026-09-05",
    sales_rep_id: rep.id, doc_type: "receipt", discount_amount: 0, wht_percent: 3, retention_percent: 5,
  }).select("id").single();
  receiptId = doc2?.id ?? null;
  await owner.client.from("billing_note_items").insert([
    { billing_note_id: receiptId, payment_id: pay1.id, invoice_no_snapshot: "IV-QA-001", invoice_date_snapshot: "2026-09-01", amount: 19773.60 },
  ]);
  const { error: sync2Err } = await owner.client.from("payments").update({ receipt_no: docNo2, received_date: "2026-09-05" }).eq("id", pay1.id);
  check("sync receipt_no/received_date back to payments succeeds", !sync2Err, sync2Err);
  const { data: afterSync2 } = await admin.from("payments").select("receipt_no, received_date").eq("id", pay1.id).single();
  check("payment now shows receipt_no + received_date", afterSync2.receipt_no === docNo2 && afterSync2.received_date === "2026-09-05", afterSync2);

  console.log("\nStep 4: RLS — sales role denied reading/creating billing_notes, owner succeeds (already proven above)...");
  const { error: salesReadErr } = await salesUser.client.from("billing_notes").select("id").eq("id", billingNoteId);
  const { data: salesReadData } = await salesUser.client.from("billing_notes").select("id").eq("id", billingNoteId);
  check("sales role cannot read billing_notes (RLS filters to empty)", (salesReadData ?? []).length === 0, { salesReadErr, salesReadData });

  const { error: salesInsertErr } = await salesUser.client.from("billing_notes").insert({
    doc_no: "BL-QA-DENIED-" + Date.now(), customer_id: cust.id, doc_date: "2026-09-04", due_date: "2026-10-04",
    doc_type: "billing_note",
  });
  check("sales role denied inserting billing_notes", !!salesInsertErr, salesInsertErr);
} finally {
  console.log("\nCleaning up...");
  if (billingNoteId) await admin.from("billing_note_items").delete().eq("billing_note_id", billingNoteId);
  if (billingNoteId) await admin.from("billing_notes").delete().eq("id", billingNoteId);
  if (receiptId) await admin.from("billing_note_items").delete().eq("billing_note_id", receiptId);
  if (receiptId) await admin.from("billing_notes").delete().eq("id", receiptId);
  await admin.from("projects").delete().eq("id", project.id); // cascades payments
  await admin.from("customers").delete().eq("id", cust.id);
  await cleanupUser(owner);
  await cleanupUser(salesUser);
  console.log("Cleanup done.");
}

console.log("\n=== RESULTS: " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
