import type { Account, Entry, Filters, Ledger } from "./types";
export const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );
export function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export function monthBounds(date = today()) {
  const d = new Date(date + "T12:00:00Z");
  return {
    start: date.slice(0, 7) + "-01",
    end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10),
  };
}
export function cents(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Use um valor positivo com até duas casas decimais.");
  const [whole, decimal = ""] = value.replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 100000000000)
    throw new Error("Valor acima do limite.");
  return amount;
}
export function effect(entry: Entry, accountId: string) {
  if (entry.kind === "transfer")
    return entry.account_id === accountId
      ? -entry.amount_cents
      : entry.destination_id === accountId
        ? entry.amount_cents
        : 0;
  return entry.account_id === accountId
    ? (entry.kind === "income" ? 1 : -1) * entry.amount_cents
    : 0;
}
export function balance(
  account: Account,
  entries: Entry[],
  until: string,
  projected = false,
) {
  if (until < account.initial_date) return 0;
  return (
    account.initial_cents +
    entries.reduce((n, e) => {
      const date = e.paid_date || (projected ? e.due_date : null);
      return date && date >= account.initial_date && date <= until
        ? n + effect(e, account.id)
        : n;
    }, 0)
  );
}
export function selectEntries(entries: Entry[], f: Filters) {
  return entries
    .filter((e) => {
      const date = e.paid_date || e.due_date;
      return (
        date >= f.start &&
        date <= f.end &&
        (!f.account ||
          e.account_id === f.account ||
          e.destination_id === f.account) &&
        (!f.category || e.category_id === f.category) &&
        (!f.status || (f.status === "paid" ? !!e.paid_date : !e.paid_date)) &&
        (!f.search ||
          e.description
            .toLocaleLowerCase("pt-BR")
            .includes(f.search.toLocaleLowerCase("pt-BR")))
      );
    })
    .sort((a, b) =>
      (b.paid_date || b.due_date).localeCompare(a.paid_date || a.due_date),
    );
}
export function totals(entries: Entry[]) {
  return entries.reduce(
    (r, e) => {
      if (e.paid_date && e.kind !== "transfer") r[e.kind] += e.amount_cents;
      return r;
    },
    { income: 0, expense: 0 },
  );
}
export function monthly(ledger: Ledger, f: Filters) {
  const result = [];
  const start = new Date(f.start.slice(0, 7) + "-01T12:00:00Z");
  const last = new Date(f.end.slice(0, 7) + "-01T12:00:00Z");
  for (
    let d = start;
    d <= last;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12))
  ) {
    const month = d.toISOString().slice(0, 7);
    const b = monthBounds(month + "-01");
    const end = b.end < f.end ? b.end : f.end;
    const rows = selectEntries(ledger.entries, {
      ...f,
      start: b.start < f.start ? f.start : b.start,
      end,
    });
    const t = totals(rows);
    result.push({
      month,
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }).format(d),
      ...t,
      balance: ledger.accounts
        .filter((a) => !f.account || a.id === f.account)
        .reduce((s, a) => s + balance(a, ledger.entries, end), 0),
    });
  }
  return result;
}
export function categoryTotals(ledger: Ledger, entries: Entry[]) {
  return ledger.categories
    .map((c) => ({
      ...c,
      value: entries
        .filter((e) => e.category_id === c.id && e.paid_date)
        .reduce((s, e) => s + e.amount_cents, 0),
    }))
    .filter((c) => c.value > 0);
}
