-- Execute as the project owner in Supabase SQL Editor. Only Jubarte objects are created.
begin;
do $$
begin
  if to_regclass('public.jubarte_members') is not null
     or to_regclass('public.jubarte_accounts') is not null
     or to_regclass('public.jubarte_categories') is not null
     or to_regclass('public.jubarte_entries') is not null
     or to_regclass('public.jubarte_debtors') is not null
     or to_regclass('public.jubarte_loans') is not null
     or to_regclass('public.jubarte_loan_receipts') is not null then
    raise exception 'Destino contém objetos Jubarte; estrutura interrompida sem alterações.';
  end if;
end
$$;
create table public.jubarte_members (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.jubarte_members enable row level security;
create policy jubarte_member_self on public.jubarte_members for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.jubarte_members from anon, authenticated;
grant select on public.jubarte_members to authenticated;
create function public.jubarte_is_authorized() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.jubarte_members where user_id = (select auth.uid()));
$$;
revoke all on function public.jubarte_is_authorized() from public, anon, authenticated;
grant execute on function public.jubarte_is_authorized() to authenticated;
create table public.jubarte_accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), initial_cents bigint not null check(initial_cents between 0 and 100000000000),
 initial_date date not null, color text not null default '#267dba' check(color ~ '^#[0-9a-fA-F]{6}$'), archived boolean not null default false,
 unique(user_id,id)
);
create table public.jubarte_categories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), kind text not null check(kind in ('income','expense')),
 color text not null default '#267dba' check(color ~ '^#[0-9a-fA-F]{6}$'), icon text not null default 'wallet' check(icon in ('wallet','home','utensils','car','coffee','heart','book')),
 archived boolean not null default false, unique(user_id,id)
);
create table public.jubarte_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('income','expense','transfer')),
 description text not null check(length(trim(description)) between 1 and 100), amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 account_id uuid not null, destination_id uuid, category_id uuid,
 due_date date not null, paid_date date, notes text not null default '' check(length(notes)<=2000),
 foreign key(user_id,account_id) references public.jubarte_accounts(user_id,id),
 foreign key(user_id,destination_id) references public.jubarte_accounts(user_id,id),
 foreign key(user_id,category_id) references public.jubarte_categories(user_id,id),
 check((kind='transfer' and destination_id is not null and destination_id<>account_id and category_id is null) or (kind in ('income','expense') and destination_id is null and category_id is not null))
);
create index jubarte_entries_user_dates on public.jubarte_entries(user_id,due_date,paid_date);
create index jubarte_entries_account on public.jubarte_entries(user_id,account_id);
create index jubarte_entries_destination on public.jubarte_entries(user_id,destination_id);
create index jubarte_entries_category on public.jubarte_entries(user_id,category_id);
alter table public.jubarte_accounts enable row level security;
alter table public.jubarte_categories enable row level security;
alter table public.jubarte_entries enable row level security;
create policy jubarte_accounts_owner on public.jubarte_accounts for all to authenticated using (user_id=(select auth.uid()) and (select public.jubarte_is_authorized())) with check (user_id=(select auth.uid()) and (select public.jubarte_is_authorized()));
create policy jubarte_categories_owner on public.jubarte_categories for all to authenticated using (user_id=(select auth.uid()) and (select public.jubarte_is_authorized())) with check (user_id=(select auth.uid()) and (select public.jubarte_is_authorized()));
create policy jubarte_entries_owner on public.jubarte_entries for all to authenticated using (user_id=(select auth.uid()) and (select public.jubarte_is_authorized())) with check (user_id=(select auth.uid()) and (select public.jubarte_is_authorized()));
revoke all on public.jubarte_accounts, public.jubarte_categories, public.jubarte_entries from anon, authenticated;
grant select,insert,update,delete on public.jubarte_accounts, public.jubarte_categories, public.jubarte_entries to authenticated;
create table public.jubarte_debtors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  kind text not null check (kind in ('person', 'company')),
  phone text not null default '' check (length(phone) <= 50),
  notes text not null default '' check (length(notes) <= 2000),
  archived boolean not null default false,
  unique (user_id, id)
);
create table public.jubarte_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debtor_id uuid not null,
  account_id uuid not null,
  date date not null,
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  due_date date,
  notes text not null default '' check (length(notes) <= 2000),
  closed boolean not null default false,
  closed_date date,
  closing_notes text not null default '' check (length(closing_notes) <= 2000),
  unique (user_id, id),
  foreign key (user_id, debtor_id) references public.jubarte_debtors(user_id, id),
  foreign key (user_id, account_id) references public.jubarte_accounts(user_id, id),
  check (due_date is null or due_date >= date),
  check (closed or (closed_date is null and closing_notes = '')),
  check (closed_date is null or closed_date >= date)
);
create table public.jubarte_loan_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null,
  account_id uuid not null,
  date date not null,
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  notes text not null default '' check (length(notes) <= 2000),
  foreign key (user_id, loan_id) references public.jubarte_loans(user_id, id),
  foreign key (user_id, account_id) references public.jubarte_accounts(user_id, id)
);
create index jubarte_loans_debtor on public.jubarte_loans(user_id, debtor_id);
create index jubarte_loans_account on public.jubarte_loans(user_id, account_id, date);
create index jubarte_receipts_loan on public.jubarte_loan_receipts(user_id, loan_id);
create index jubarte_receipts_account on public.jubarte_loan_receipts(user_id, account_id, date);

alter table public.jubarte_debtors enable row level security;
alter table public.jubarte_loans enable row level security;
alter table public.jubarte_loan_receipts enable row level security;
create policy jubarte_debtors_owner on public.jubarte_debtors for all to authenticated
  using (user_id = (select auth.uid()) and (select public.jubarte_is_authorized()))
  with check (user_id = (select auth.uid()) and (select public.jubarte_is_authorized()));
create policy jubarte_loans_owner on public.jubarte_loans for all to authenticated
  using (user_id = (select auth.uid()) and (select public.jubarte_is_authorized()))
  with check (user_id = (select auth.uid()) and (select public.jubarte_is_authorized()));
create policy jubarte_receipts_owner on public.jubarte_loan_receipts for all to authenticated
  using (user_id = (select auth.uid()) and (select public.jubarte_is_authorized()))
  with check (user_id = (select auth.uid()) and (select public.jubarte_is_authorized()));
revoke all on public.jubarte_debtors, public.jubarte_loans, public.jubarte_loan_receipts from anon, authenticated;
grant select, insert, update, delete on public.jubarte_debtors, public.jubarte_loans, public.jubarte_loan_receipts to authenticated;

-- Triggers de validação serão criados em 03-finalizacao.sql, após a importação.
commit;
