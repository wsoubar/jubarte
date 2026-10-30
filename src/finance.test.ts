import { describe, it, expect } from "vitest";
import { balance, cents, monthly, selectEntries, totals } from "./finance";
import type { Account, Entry, Filters } from "./types";
const a: Account = {
  id: "a",
  user_id: "u",
  name: "Conta",
  initial_cents: 10000,
  initial_date: "2026-01-01",
  color: "#000000",
  archived: false,
};
const b: Account = { ...a, id: "b", initial_cents: 0 };
const e: Entry = {
  id: "e",
  user_id: "u",
  kind: "expense",
  description: "Teste",
  amount_cents: 2500,
  account_id: "a",
  destination_id: null,
  category_id: "c",
  due_date: "2026-01-10",
  paid_date: "2026-01-12",
  notes: "",
};
const f: Filters = {
  start: "2026-01-01",
  end: "2026-01-31",
  account: "",
  category: "",
  status: "",
  search: "",
};
describe("Valores em centavos", () => {
  it("preserva centavos sem erro de ponto flutuante", () => {
    expect(cents("0,29")).toBe(29);
    expect(cents("1234.56")).toBe(123456);
    expect(cents("5")).toBe(500);
  });
  it("rejeita valores ambíguos, negativos e imprecisos", () => {
    for (const value of ["-1", "1.234,56", "NaN", "1,234", "1e6", ""])
      expect(() => cents(value)).toThrow();
  });
});
describe("Saldos", () => {
  it("usa pagamento no realizado e vencimento no previsto", () => {
    expect(balance(a, [e], "2026-01-10")).toBe(10000);
    expect(balance(a, [e], "2026-01-12")).toBe(7500);
    expect(balance(a, [{ ...e, paid_date: null }], "2026-01-12")).toBe(10000);
    expect(balance(a, [{ ...e, paid_date: null }], "2026-01-12", true)).toBe(
      7500,
    );
  });
  it("não duplica lançamento já pago ao projetar", () => {
    expect(balance(a, [e], "2026-01-31", true)).toBe(7500);
  });
  it("não contabiliza conta antes da data inicial", () => {
    expect(balance(a, [e], "2025-12-31")).toBe(0);
  });
  it("transferência preserva patrimônio e não altera receitas ou despesas", () => {
    const transfer: Entry = {
      ...e,
      kind: "transfer",
      category_id: null,
      destination_id: "b",
    };
    expect(balance(a, [transfer], f.end)).toBe(7500);
    expect(balance(b, [transfer], f.end)).toBe(2500);
    expect(balance(a, [transfer], f.end) + balance(b, [transfer], f.end)).toBe(
      10000,
    );
    expect(totals([transfer])).toEqual({ income: 0, expense: 0 });
  });
});
describe("Relatórios", () => {
  it("considera recebimento efetivo e ignora pendências nos totais", () => {
    expect(
      totals([
        e,
        { ...e, id: "p", paid_date: null },
        { ...e, id: "i", kind: "income", amount_cents: 6000 },
      ]),
    ).toEqual({ income: 6000, expense: 2500 });
  });
  it("filtra por pagamento, conta de destino, busca e situação", () => {
    expect(
      selectEntries([e], { ...f, start: "2026-01-11", search: "tes" }),
    ).toHaveLength(1);
    expect(selectEntries([e], { ...f, status: "pending" })).toHaveLength(0);
    expect(
      selectEntries([{ ...e, destination_id: "b" }], { ...f, account: "b" }),
    ).toHaveLength(1);
    expect(selectEntries([e], { ...f, category: "other" })).toHaveLength(0);
  });
  it("agrupa meses sem perder o histórico de saldo fora do período", () => {
    const ledger = {
      accounts: [a],
      categories: [],
      entries: [e, { ...e, id: "feb", paid_date: "2026-02-12" }],
    };
    const result = monthly(ledger, {
      ...f,
      start: "2026-02-01",
      end: "2026-03-31",
    });
    expect(result).toHaveLength(2);
    expect(result[0].expense).toBe(2500);
    expect(result[0].balance).toBe(5000);
    expect(result[1].expense).toBe(0);
    expect(result[1].balance).toBe(5000);
  });
  it("não ignora saldo inicial de contas arquivadas nos históricos", () => {
    expect(balance({ ...a, archived: true }, [e], f.end)).toBe(7500);
  });
});
