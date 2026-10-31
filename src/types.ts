export type Account = {
  id: string;
  user_id: string;
  name: string;
  initial_cents: number;
  initial_date: string;
  color: string;
  archived: boolean;
};
export type Category = {
  id: string;
  user_id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  icon: string;
  archived: boolean;
};
export type Entry = {
  id: string;
  user_id: string;
  kind: "income" | "expense" | "transfer" | "loan_out" | "loan_in";
  loan_id?: string;
  description: string;
  amount_cents: number;
  account_id: string;
  destination_id: string | null;
  category_id: string | null;
  due_date: string;
  paid_date: string | null;
  notes: string;
};
export type Ledger = {
  accounts: Account[];
  categories: Category[];
  entries: Entry[];
  debtors?: Debtor[];
  loans?: Loan[];
  receipts?: LoanReceipt[];
};
export type Debtor = {
  id: string;
  user_id: string;
  name: string;
  kind: "person" | "company";
  phone: string;
  notes: string;
  archived: boolean;
};
export type Loan = {
  id: string;
  user_id: string;
  debtor_id: string;
  account_id: string;
  date: string;
  amount_cents: number;
  due_date: string | null;
  notes: string;
  closed: boolean;
  closed_date: string | null;
  closing_notes: string;
};
export type LoanReceipt = {
  id: string;
  user_id: string;
  loan_id: string;
  account_id: string;
  date: string;
  amount_cents: number;
  notes: string;
};
export type Filters = {
  start: string;
  end: string;
  account: string;
  category: string;
  status: string;
  search: string;
};
