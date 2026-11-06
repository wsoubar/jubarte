-- Executar somente depois de 02-importar.sql; não desabilita RLS.
begin;
do $$ begin
  if not exists (select 1 from public.jubarte_members) then raise exception 'Carga não encontrada; finalização interrompida.'; end if;
  if (select count(*) from pg_trigger where tgname like 'jubarte_validate_%' and not tgisinternal) <> 0 then raise exception 'Triggers Jubarte já existem; finalização interrompida.'; end if;
end $$;
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
revoke all on function public.jubarte_is_authorized() from public, anon, authenticated;
grant execute on function public.jubarte_is_authorized() to authenticated;
revoke all on function public.jubarte_validate_entry(), public.jubarte_validate_parent(), public.jubarte_validate_loan(), public.jubarte_validate_receipt(), public.jubarte_validate_loan_account() from public, anon, authenticated;
commit;
