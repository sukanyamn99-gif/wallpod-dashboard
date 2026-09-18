import type { createClient } from "@/lib/supabase/server";

// Same YY+MM+running-sequence convention as every other doc-no in this app,
// prefixed "WT" (WithHolding Tax) — generated once, the first time a
// record's wht_amount becomes > 0 with no cert number yet, and never
// regenerated on later edits. Shared by Payment Vouchers and Petty Cash
// (the two places a WHT certificate can originate from) so both draw from
// ONE sequence — checking either table alone would let both independently
// generate "WT2609001" for two different real certificates.
export async function generateWhtCertNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `WT${yy}${mm}`;

  const [vouchers, pettyCash] = await Promise.all([
    supabase.from("payment_vouchers").select("wht_cert_no").like("wht_cert_no", `${prefix}%`),
    supabase.from("petty_cash_transactions").select("wht_cert_no").like("wht_cert_no", `${prefix}%`),
  ]);
  if (vouchers.error) throw vouchers.error;
  if (pettyCash.error) throw pettyCash.error;

  let max = 0;
  for (const row of [...(vouchers.data ?? []), ...(pettyCash.data ?? [])]) {
    const n = parseInt((row.wht_cert_no ?? "").slice(prefix.length), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const seq = String(max + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}
