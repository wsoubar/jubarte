-- Execute uma única vez no SQL Editor, após 202610300001_jubarte.sql.
-- Apenas objetos Jubarte; não recria tabelas nem altera dados existentes.
begin;

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

create function public.jubarte_validate_loan() returns trigger language plpgsql set search_path = '' as $$
declare a record; d record;
begin
  if tg_op = 'DELETE' then
    if old.closed then raise exception 'Reabra o empréstimo antes de excluí-lo.'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then raise exception 'Não é permitido trocar o proprietário.'; end if;
    if old.closed and (new.closed or (to_jsonb(new) - array['closed','closed_date','closing_notes']) is distinct from (to_jsonb(old) - array['closed','closed_date','closing_notes'])) then
      raise exception 'Reabra o empréstimo antes de alterá-lo.';
    end if;
  end if;
  if new.date > (now() at time zone 'America/Sao_Paulo')::date or new.closed_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A saída e o fechamento não podem estar no futuro.';
  end if;
  select * into a from public.jubarte_accounts where user_id = new.user_id and id = new.account_id for update;
  if not found then raise exception 'Conta inválida.'; end if;
  if new.date < a.initial_date then raise exception 'O empréstimo não pode ser anterior ao saldo inicial da conta.'; end if;
  if a.archived and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then raise exception 'Conta arquivada.'; end if;
  select * into d from public.jubarte_debtors where user_id = new.user_id and id = new.debtor_id for update;
  if not found then raise exception 'Devedor inválido.'; end if;
  if d.archived and (tg_op = 'INSERT' or new.debtor_id is distinct from old.debtor_id) then raise exception 'Devedor arquivado.'; end if;
  if exists (select 1 from public.jubarte_loan_receipts where loan_id = new.id and user_id = new.user_id and (date < new.date or (new.closed_date is not null and date > new.closed_date))) then
    raise exception 'As datas devem respeitar os recebimentos existentes.';
  end if;
  return new;
end $$;
create trigger jubarte_validate_loan before insert or update or delete on public.jubarte_loans for each row execute function public.jubarte_validate_loan();

create function public.jubarte_validate_receipt() returns trigger language plpgsql set search_path = '' as $$
declare l record; a record;
begin
  if tg_op = 'DELETE' then
    select * into l from public.jubarte_loans where user_id = old.user_id and id = old.loan_id for update;
    if l.closed then raise exception 'Reabra o empréstimo antes de excluir recebimentos.'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.loan_id <> old.loan_id) then raise exception 'Não é permitido trocar o proprietário ou o empréstimo.'; end if;
  select * into l from public.jubarte_loans where user_id = new.user_id and id = new.loan_id for update;
  if not found then raise exception 'Empréstimo inválido.'; end if;
  if l.closed then raise exception 'Reabra o empréstimo antes de registrar ou alterar recebimentos.'; end if;
  if new.date < l.date or new.date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data do recebimento deve estar entre a saída e hoje.'; end if;
  select * into a from public.jubarte_accounts where user_id = new.user_id and id = new.account_id for update;
  if not found then raise exception 'Conta inválida.'; end if;
  if new.date < a.initial_date then raise exception 'O recebimento não pode ser anterior ao saldo inicial da conta.'; end if;
  if a.archived and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then raise exception 'Conta arquivada.'; end if;
  return new;
end $$;
create trigger jubarte_validate_receipt before insert or update or delete on public.jubarte_loan_receipts for each row execute function public.jubarte_validate_receipt();

create function public.jubarte_validate_loan_account() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.jubarte_loans where user_id = new.user_id and account_id = new.id and date < new.initial_date)
    or exists (select 1 from public.jubarte_loan_receipts where user_id = new.user_id and account_id = new.id and date < new.initial_date) then
    raise exception 'A data inicial não pode ficar depois de empréstimos ou recebimentos existentes.';
  end if;
  return new;
end $$;
create trigger jubarte_validate_loan_account before update on public.jubarte_accounts for each row execute function public.jubarte_validate_loan_account();
revoke all on function public.jubarte_validate_loan(), public.jubarte_validate_receipt(), public.jubarte_validate_loan_account() from public;
commit;
