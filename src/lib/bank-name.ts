// Shared by both the server-side balance computation (src/lib/data/bank-accounts.ts)
// and the client-side transaction list (which can't import that server-only
// data module directly) so the two never drift on what counts as "the same
// bank account."
export function normalizeBankName(name: string | null): string {
  return (name ?? "").trim().toLowerCase();
}
