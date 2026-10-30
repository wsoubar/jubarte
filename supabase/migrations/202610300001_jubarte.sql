-- Execute as the project owner in Supabase SQL Editor. Only Jubarte objects are created.
begin;
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
revoke all on function public.jubarte_is_authorized() from public;
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
-- Lock parent rows while validating to serialize concurrent account/category edits.
create function public.jubarte_validate_entry() returns trigger language plpgsql set search_path = '' as $$
declare a record; c record;
begin
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Não é permitido trocar o proprietário.'; end if;
 if new.paid_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Pagamento não pode estar no futuro.'; end if;
 for a in select * from public.jubarte_accounts where user_id=new.user_id and id in (new.account_id,new.destination_id) order by id for update loop
  if new.due_date<a.initial_date or new.paid_date<a.initial_date then raise exception 'Movimentação anterior ao saldo inicial.'; end if;
  if a.archived and (tg_op='INSERT') then raise exception 'Conta arquivada.'; end if;
  if a.archived and tg_op='UPDATE' and a.id<>old.account_id and a.id is distinct from old.destination_id then raise exception 'Conta arquivada.'; end if;
 end loop;
 if new.kind<>'transfer' then
  select * into c from public.jubarte_categories where id=new.category_id and user_id=new.user_id for update;
  if c.id is null or c.kind<>new.kind then raise exception 'Categoria incompatível com o tipo do lançamento.'; end if;
  if c.archived and tg_op='INSERT' then raise exception 'Categoria arquivada.'; end if;
  if c.archived and tg_op='UPDATE' and new.category_id is distinct from old.category_id then raise exception 'Categoria arquivada.'; end if;
 end if;
 return new;
end $$;
create trigger jubarte_validate_entry before insert or update on public.jubarte_entries for each row execute function public.jubarte_validate_entry();
create function public.jubarte_validate_parent() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.user_id<>old.user_id then raise exception 'Não é permitido trocar o proprietário.'; end if;
 if tg_table_name='jubarte_accounts' then
  if exists(select 1 from public.jubarte_entries e where e.user_id=new.user_id and (e.account_id=new.id or e.destination_id=new.id) and (e.due_date<new.initial_date or e.paid_date<new.initial_date)) then raise exception 'Data inicial posterior a movimentações existentes.'; end if;
 else
  if exists(select 1 from public.jubarte_entries e where e.user_id=new.user_id and e.category_id=new.id and e.kind<>new.kind) then raise exception 'Categoria utilizada: preserve o tipo original.'; end if;
 end if;
 return new;
end $$;
create trigger jubarte_validate_account before update on public.jubarte_accounts for each row execute function public.jubarte_validate_parent();
create trigger jubarte_validate_category before update on public.jubarte_categories for each row execute function public.jubarte_validate_parent();
revoke all on function public.jubarte_validate_entry(),public.jubarte_validate_parent() from public;
commit;
