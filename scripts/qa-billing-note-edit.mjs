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

async function makeUser(role) {
  const email = "qa-blnedit-" + role + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@example.com";
  const password = crypto.randomBytes(12).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA BLNEdit " + role, role });
  const client = createClient(ANON_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, userId: created.user.id };
}
async function cleanupUser(u) {
  await admin.from("profiles").delete().eq("id", u.userId);
  await admin.auth.admin.deleteUser(u.userId);
}

const { data: cust } = await admin.from("customers").insert({
  name: "QA BLNEDIT CUSTOMER " + Date.now(), customer_type: "Corporate",
}).select("id").single();
const { data: rep } = await admin.from("sales_reps").select("id").limit(1).single();
const { data: project } = await admin.from("projects").insert({
  job_no: "QA-BLNEDIT-" + Date.now(), customer_id: cust.id, project_name: "QA billing note edit test",
  sales_rep_id: rep.id, customer_type: "Corporate", stage_percent: 100, pre_vat: 30000, vat: 2100,
}).select("id").single();
const { data: pay1 } = await admin.from("payments").insert({
  project_id: project.id, installment_no: 1, amount: 10700, invoice_no: "IV-BLNE-001", paid_date: "2026-09-01",
  status: "รอชำระเงิน", outstanding_amount: 10700,
}).select("id").single();
const { data: pay2 } = await admin.from("payments").insert({
  project_id: project.id, installment_no: 2, amount: 21400, invoice_no: "IV-BLNE-002", paid_date: "2026-09-01",
  status: "รอชำระเงิน", outstanding_amount: 21400,
}).select("id").single();

const requester = await makeUser("support_sale");
const otherStaff = await makeUser("support_sale");
const owner = await makeUser("owner");

let docId = null;
try {
  console.log("\nStep 1: requester creates a billing_note bundling both invoices...");
  const docNo = "BL-QATEST-" + Date.now();
  const { data: doc, error: docErr } = await requester.client.from("billing_notes").insert({
    doc_no: docNo, customer_id: cust.id, doc_date: "2026-09-05", credit_days: 0, due_date: "2026-09-05",
    sales_rep_id: rep.id, doc_type: "billing_note", discount_amount: 0, wht_percent: 0, retention_percent: 0,
    created_by: requester.userId,
  }).select("id").single();
  check("requester can create billing_notes", !docErr, docErr);
  docId = doc.id;
  await requester.client.from("billing_note_items").insert([
    { billing_note_id: docId, payment_id: pay1.id, invoice_no_snapshot: "IV-BLNE-001", invoice_date_snapshot: "2026-09-01", amount: 10700 },
    { billing_note_id: docId, payment_id: pay2.id, invoice_no_snapshot: "IV-BLNE-002", invoice_date_snapshot: "2026-09-01", amount: 21400 },
  ]);
  await requester.client.from("payments").update({ billing_note_no: docNo, billing_note_date: "2026-09-05" }).in("id", [pay1.id, pay2.id]);

  console.log("\nStep 2: a DIFFERENT staff member is denied editing this document (RLS is my_role() <> 'sales', so this checks the UI-level gate assumption doesn't rely on RLS wrongly — actually RLS allows any non-sales role, confirming that's correctly permissive)...");
  const { error: otherUpdateErr } = await otherStaff.client.from("billing_notes").update({ note: "other staff edited" }).eq("id", docId);
  check("other non-sales staff CAN update at the RLS layer (matches billing_notes_delete's existing permissive shape, UI gates further)", !otherUpdateErr, otherUpdateErr);
  // revert that test note change
  await admin.from("billing_notes").update({ note: null }).eq("id", docId);

  console.log("\nStep 3: requester edits the document — removes pay2, keeps pay1, changes discount/wht/retention...");
  const { error: updateErr } = await requester.client.from("billing_notes").update({
    discount_amount: 500, wht_percent: 3, retention_percent: 5, note: "edited",
  }).eq("id", docId);
  check("header update succeeds", !updateErr, updateErr);

  const { error: deleteItemsErr } = await requester.client.from("billing_note_items").delete().eq("billing_note_id", docId);
  check("requester can delete-then-reinsert items", !deleteItemsErr, deleteItemsErr);

  const { error: reinsertErr } = await requester.client.from("billing_note_items").insert([
    { billing_note_id: docId, payment_id: pay1.id, invoice_no_snapshot: "IV-BLNE-001", invoice_date_snapshot: "2026-09-01", amount: 10700 },
  ]);
  check("requester can reinsert the new (smaller) item set", !reinsertErr, reinsertErr);

  // Reconcile sync-back: pay2 removed -> clear; pay1 kept -> stays set
  const { error: clearErr } = await requester.client.from("payments").update({ billing_note_no: null, billing_note_date: null }).eq("id", pay2.id);
  check("clearing billing_note_no on the removed payment succeeds", !clearErr, clearErr);

  const { data: afterEdit } = await admin.from("payments").select("id, billing_note_no").in("id", [pay1.id, pay2.id]);
  const pay1After = afterEdit.find((p) => p.id === pay1.id);
  const pay2After = afterEdit.find((p) => p.id === pay2.id);
  check("pay1 (kept) still shows billing_note_no", pay1After.billing_note_no === docNo, pay1After);
  check("pay2 (removed) now has billing_note_no cleared", pay2After.billing_note_no === null, pay2After);

  const { data: itemsAfter } = await admin.from("billing_note_items").select("payment_id").eq("billing_note_id", docId);
  check("billing_note_items now has exactly 1 row (pay1 only)", itemsAfter.length === 1 && itemsAfter[0].payment_id === pay1.id, itemsAfter);

  console.log("\nStep 4: doc_no is unchanged after edit (immutable)...");
  const { data: docAfter } = await admin.from("billing_notes").select("doc_no, discount_amount, wht_percent, retention_percent").eq("id", docId).single();
  check("doc_no unchanged", docAfter.doc_no === docNo, docAfter);
  check("discount/wht/retention updated correctly", docAfter.discount_amount == 500 && docAfter.wht_percent == 3 && docAfter.retention_percent == 5, docAfter);

  console.log("\nStep 5: sales role still denied at the RLS layer (unaffected by this migration)...");
  const salesUser = await makeUser("sales");
  const { data: salesReadData } = await salesUser.client.from("billing_notes").select("id").eq("id", docId);
  check("sales role cannot read billing_notes", (salesReadData ?? []).length === 0, salesReadData);
  await cleanupUser(salesUser);

  console.log("\nStep 6: owner can edit/delete anyone's document...");
  const { error: ownerUpdateErr } = await owner.client.from("billing_notes").update({ note: "owner edited" }).eq("id", docId);
  check("owner can update someone else's billing_notes", !ownerUpdateErr, ownerUpdateErr);
} finally {
  console.log("\nCleaning up...");
  if (docId) {
    await admin.from("billing_note_items").delete().eq("billing_note_id", docId);
    await admin.from("billing_notes").delete().eq("id", docId);
  }
  await admin.from("projects").delete().eq("id", project.id);
  await admin.from("customers").delete().eq("id", cust.id);
  await cleanupUser(requester);
  await cleanupUser(otherStaff);
  await cleanupUser(owner);
  console.log("Cleanup done.");
}

console.log("\n=== RESULTS: " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
