import { describe, expect, it } from "vitest";
import { loanPortfolio, loanSummary, withLoanEntries } from "./loans";
import { balance, monthly, totals } from "./finance";
import type { Ledger, Loan, LoanReceipt } from "./types";

const loan: Loan = {
  id: "loan",
  user_id: "u",
  debtor_id: "d",
  account_id: "out",
  date: "2026-10-10",
  amount_cents: 10000,
  due_date: null,
  notes: "",
  closed: false,
  closed_date: null,
  closing_notes: "",
};
const receipts: LoanReceipt[] = [1, 2].map((i) => ({
  id: "r" + i,
  user_id: "u",
  loan_id: loan.id,
  account_id: "in",
  date: "2026-10-" + (10 + i),
  amount_cents: 6000,
  notes: "",
}));
const ledger: Ledger = {
  accounts: ["out", "in"].map((id) => ({
    id,
    user_id: "u",
    name: id,
    initial_cents: 100000,
    initial_date: "2026-10-01",
    color: "#123456",
    archived: false,
  })),
  categories: [],
  entries: [],
  loans: [loan],
  receipts,
};

describe("empréstimos e recebimentos livres", () => {
  it("mostra a carteira atual sem compensar excedentes, fechados ou vencimentos sem saldo", () => {
    const overdue = { ...loan, id: "overdue", due_date: "2026-10-20" };
    const closed = {
      ...loan,
      id: "closed",
      closed: true,
      due_date: "2026-10-01",
    };
    const result = loanPortfolio(
      {
        ...ledger,
        loans: [loan, overdue, closed],
        receipts: [
          ...receipts,
          { ...receipts[0], id: "closed-receipt", loan_id: closed.id },
        ],
      },
      "2026-10-31",
    );
    expect(result).toEqual({
      lent: 30000,
      received: 18000,
      outstanding: 10000,
      unrecovered: 4000,
      overdue: 10000,
      pendingCount: 1,
    });
    expect(
      loanPortfolio({ accounts: [], categories: [], entries: [] }, "2026-10-31")
        .outstanding,
    ).toBe(0);
  });
  it("aceita 2 x 60 para 100, sem fechar automaticamente", () => {
    expect(loanSummary(loan, receipts)).toEqual({
      received: 12000,
      remaining: 0,
      extra: 2000,
      outstanding: 0,
      unrecovered: 0,
    });
    expect(loan.closed).toBe(false);
  });
  it("separa pendências abertas e valor não recuperado no fechamento", () => {
    expect(loanSummary(loan, receipts.slice(0, 1)).outstanding).toBe(4000);
    expect(
      loanSummary({ ...loan, closed: true }, receipts.slice(0, 1)),
    ).toMatchObject({ outstanding: 0, unrecovered: 4000 });
    expect(loanSummary({ ...loan, closed: true }, []).unrecovered).toBe(10000);
  });
  it("movimenta contas distintas nas datas corretas sem compor receitas e despesas", () => {
    const result = withLoanEntries(ledger);
    expect(balance(ledger.accounts[0], result.entries, "2026-10-09")).toBe(
      100000,
    );
    expect(balance(ledger.accounts[0], result.entries, "2026-10-31")).toBe(
      90000,
    );
    expect(balance(ledger.accounts[1], result.entries, "2026-10-11")).toBe(
      106000,
    );
    expect(
      balance(ledger.accounts[1], result.entries, "2026-10-31", true),
    ).toBe(112000);
    expect(totals(result.entries)).toEqual({ income: 0, expense: 0 });
    expect(
      monthly(result, {
        start: "2026-10-01",
        end: "2026-10-31",
        account: "",
        category: "",
        status: "",
        search: "",
      })[0],
    ).toMatchObject({ income: 0, expense: 0, balance: 202000 });
    expect(withLoanEntries(result).entries).toHaveLength(3);
  });
  it("editar, excluir e fechar recalculam sem ajustes artificiais", () => {
    const changed = withLoanEntries({
      ...ledger,
      loans: [{ ...loan, amount_cents: 20000, closed: true }],
      receipts: receipts.slice(0, 1),
    });
    expect(changed.entries).toHaveLength(2);
    expect(balance(ledger.accounts[0], changed.entries, "2026-10-31")).toBe(
      80000,
    );
    expect(balance(ledger.accounts[1], changed.entries, "2026-10-31")).toBe(
      106000,
    );
    expect(
      withLoanEntries({ ...changed, loans: [], receipts: [] }).entries,
    ).toHaveLength(0);
  });
});
