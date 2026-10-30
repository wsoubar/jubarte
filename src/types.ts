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
  kind: "income" | "expense" | "transfer";
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
};
export type Filters = {
  start: string;
  end: string;
  account: string;
  category: string;
  status: string;
  search: string;
};
