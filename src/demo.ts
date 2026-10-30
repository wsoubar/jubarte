import type { Ledger } from "./types";
import { today, monthBounds } from "./finance";
export function demoLedger(): Ledger {
  const now = today(),
    month = now.slice(0, 7),
    uid = "demo";
  const accounts = [
    {
      id: "bank",
      user_id: uid,
      name: "Conta principal",
      initial_cents: 1245000,
      initial_date: month + "-01",
      color: "#267dba",
      archived: false,
    },
    {
      id: "reserve",
      user_id: uid,
      name: "Reserva de emergência",
      initial_cents: 2200000,
      initial_date: month + "-01",
      color: "#23a99c",
      archived: false,
    },
    {
      id: "wallet",
      user_id: uid,
      name: "Carteira",
      initial_cents: 18500,
      initial_date: month + "-01",
      color: "#9b80cb",
      archived: false,
    },
  ];
  const categories = [
    {
      id: "salary",
      name: "Salário",
      kind: "income" as const,
      color: "#23a99c",
      icon: "wallet",
    },
    {
      id: "home",
      name: "Moradia",
      kind: "expense" as const,
      color: "#347ab5",
      icon: "home",
    },
    {
      id: "food",
      name: "Alimentação",
      kind: "expense" as const,
      color: "#eab777",
      icon: "utensils",
    },
    {
      id: "transport",
      name: "Transporte",
      kind: "expense" as const,
      color: "#9b80cb",
      icon: "car",
    },
    {
      id: "fun",
      name: "Lazer",
      kind: "expense" as const,
      color: "#6bc1cb",
      icon: "coffee",
    },
  ].map((c) => ({ ...c, user_id: uid, archived: false }));
  const rows = [
    ["Salário mensal", "income", 850000, "salary", 1, true],
    ["Aluguel do apartamento", "expense", 235000, "home", 3, true],
    ["Supermercado", "expense", 64790, "food", 5, true],
    ["Café com amigos", "expense", 8900, "fun", 7, true],
    ["Combustível", "expense", 24000, "transport", 9, true],
    ["Internet residencial", "expense", 12990, "home", 12, true],
    ["Feira da semana", "expense", 18600, "food", 15, true],
    ["Energia elétrica", "expense", 18750, "home", 25, false],
  ] as const;
  return {
    accounts,
    categories,
    entries: rows.map((r, i) => ({
      id: "entry-" + i,
      user_id: uid,
      description: r[0],
      kind: r[1],
      amount_cents: r[2],
      account_id: "bank",
      destination_id: null,
      category_id: r[3],
      due_date:
        month +
        "-" +
        String(Math.min(r[4], Number(monthBounds(now).end.slice(-2)))).padStart(
          2,
          "0",
        ),
      paid_date: r[5]
        ? month +
          "-" +
          String(Math.min(r[4], Number(now.slice(-2)))).padStart(2, "0")
        : null,
      notes: "",
    })),
  };
}
