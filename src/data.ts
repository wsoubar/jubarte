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
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  const [accounts, categories, entries] = await Promise.all([
    all("jubarte_accounts"),
    all("jubarte_categories"),
    all("jubarte_entries"),
  ]);
  return { accounts, categories, entries } as Ledger;
}
