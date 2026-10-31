import type { Entry, Ledger, Loan, LoanReceipt } from "./types";

export function loanSummary(loan: Loan, receipts: LoanReceipt[]) {
  const received = receipts
    .filter((r) => r.loan_id === loan.id)
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const difference = loan.amount_cents - received;
  return {
    received,
    remaining: Math.max(0, difference),
    extra: Math.max(0, -difference),
    outstanding: loan.closed ? 0 : Math.max(0, difference),
    unrecovered: loan.closed ? Math.max(0, difference) : 0,
  };
}

export function loanPortfolio(ledger: Ledger, currentDate: string) {
  return (ledger.loans || []).reduce(
    (result, loan) => {
      const summary = loanSummary(loan, ledger.receipts || []);
      result.lent += loan.amount_cents;
      result.received += summary.received;
      result.outstanding += summary.outstanding;
      result.unrecovered += summary.unrecovered;
      if (summary.outstanding > 0) {
        result.pendingCount++;
        if (loan.due_date && loan.due_date < currentDate)
          result.overdue += summary.outstanding;
      }
      return result;
    },
    {
      lent: 0,
      received: 0,
      outstanding: 0,
      unrecovered: 0,
      overdue: 0,
      pendingCount: 0,
    },
  );
}

// Movimentações derivadas: a fonte é o empréstimo/recebimento, sem cópia gravada.
// Remover as derivadas permite reaplicar a função sem duplicar lançamentos.
export function withLoanEntries(ledger: Ledger): Ledger {
  const entries = ledger.entries.filter((e) => !e.loan_id);
  const loans = ledger.loans || [];
  function movement(loan: Loan, receipt?: LoanReceipt): Entry {
    const item = receipt || loan;
    const name =
      ledger.debtors?.find((d) => d.id === loan.debtor_id)?.name || "Devedor";
    return {
      id: (receipt ? "loan-in-" : "loan-out-") + item.id,
      user_id: item.user_id,
      loan_id: loan.id,
      kind: receipt ? "loan_in" : "loan_out",
      description:
        (receipt ? "Recebimento de empréstimo · " : "Empréstimo concedido · ") +
        name,
      account_id: item.account_id,
      amount_cents: item.amount_cents,
      due_date: item.date,
      paid_date: item.date,
      category_id: null,
      destination_id: null,
      notes: item.notes,
    };
  }
  return {
    ...ledger,
    entries: [
      ...entries,
      ...loans.map((loan) => movement(loan)),
      ...(ledger.receipts || []).flatMap((r) => {
        const loan = loans.find((l) => l.id === r.loan_id);
        return loan ? [movement(loan, r)] : [];
      }),
    ],
  };
}
