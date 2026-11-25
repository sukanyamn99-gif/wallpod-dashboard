import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// Tax id and address kept on the supplier / customer master records, looked up
// by name. A payment voucher only stores what was typed on that voucher, so
// when a payee's details were added to the master afterwards (or never typed
// on the voucher) this is where they come from.
export interface PayeeDetails {
  // The name as written on the master record (the map key is the normalised one).
  name: string;
  // True when a supplier record exists for the name (customers alone don't count).
  isSupplier: boolean;
  taxId: string | null;
  address: string | null;
}

// Same payee written with different spacing or letter case still matches.
export function payeeKey(name: string | null | undefined): string {
  return String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function clean(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim();
  return v === "" ? null : v;
}

// Suppliers first, customers only for what a supplier leaves blank — a payee
// is far more often a supplier, and a name on both lists keeps the supplier's
// details.
export async function getPayeeDirectory(): Promise<Map<string, PayeeDetails>> {
  const directory = new Map<string, PayeeDetails>();
  if (!isSupabaseConfigured()) return directory;

  const supabase = await createClient();
  const [suppliers, customers] = await Promise.all([
    supabase.from("suppliers").select("name, tax_id, address"),
    supabase.from("customers").select("name, tax_id, address"),
  ]);
  if (suppliers.error) throw suppliers.error;
  if (customers.error) throw customers.error;

  const add = (rows: { name: string; tax_id: string | null; address: string | null }[], isSupplier: boolean) => {
    for (const row of rows) {
      const key = payeeKey(row.name);
      if (!key) continue;
      const existing = directory.get(key) ?? { name: String(row.name).trim(), isSupplier, taxId: null, address: null };
      existing.taxId ??= clean(row.tax_id);
      existing.address ??= clean(row.address);
      directory.set(key, existing);
    }
  };
  add(suppliers.data ?? [], true);
  add(customers.data ?? [], false);
  return directory;
}
