import { supabase } from "./supabase";
import type { Ledger } from "./types";
export async function loadLedger(): Promise<Ledger> {
  const db = supabase!;
  const member = await db.rpc("jubarte_is_authorized");
  if (member.error) throw member.error;
  if (!member.data)
    throw new Error(
      "Seu usuário não está autorizado no Jubarte. Peça ao administrador para liberar seu UID.",
    );
  async function all(table: string) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .order("id")
        .range(offset, offset + 999);
      if (error) {
        if (
          ["PGRST205", "42P01"].includes(error.code) &&
          [
            "jubarte_debtors",
            "jubarte_loans",
            "jubarte_loan_receipts",
          ].includes(table)
        )
          throw new Error(
            "Aplique a migração 202610310001_jubarte_loans.sql no SQL Editor do Supabase para habilitar os empréstimos.",
          );
        throw error;
      }
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  const [accounts, categories, entries, debtors, loans, receipts] =
    await Promise.all([
      all("jubarte_accounts"),
      all("jubarte_categories"),
      all("jubarte_entries"),
      all("jubarte_debtors"),
      all("jubarte_loans"),
      all("jubarte_loan_receipts"),
    ]);
  return { accounts, categories, entries, debtors, loans, receipts } as Ledger;
}
