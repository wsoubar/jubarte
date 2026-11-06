-- Somente no destino. Exercita as operações financeiras sem deixar dados de teste.
begin;
do $$ begin
  perform set_config('request.jwt.claim.sub', (select user_id::text from public.jubarte_members limit 1), true);
end $$;
set local role authenticated;
do $$
declare
  u uuid := auth.uid();
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  l uuid := gen_random_uuid();
  e uuid := gen_random_uuid();
  t uuid := gen_random_uuid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.jubarte_is_authorized() then raise exception 'Usuário de teste não autorizado.'; end if;
  insert into public.jubarte_accounts(id,user_id,name,initial_cents,initial_date)
    values (a,u,'Teste transacional A',20000,today-2),(b,u,'Teste transacional B',0,today-2);
  insert into public.jubarte_categories(id,user_id,name,kind) values(c,u,'Teste transacional','expense');
  insert into public.jubarte_entries(id,user_id,kind,description,amount_cents,account_id,category_id,due_date,paid_date)
    values(e,u,'expense','Despesa de teste',100,a,c,today,today);
  update public.jubarte_entries set amount_cents=150 where id=e;
  if (select amount_cents from public.jubarte_entries where id=e) <> 150 then raise exception 'Alteração de lançamento falhou.'; end if;
  insert into public.jubarte_entries(id,user_id,kind,description,amount_cents,account_id,destination_id,due_date,paid_date)
    values(t,u,'transfer','Transferência de teste',200,a,b,today,today);
  insert into public.jubarte_debtors(id,user_id,name,kind) values(d,u,'Devedor de teste','person');
  insert into public.jubarte_loans(id,user_id,debtor_id,account_id,date,amount_cents)
    values(l,u,d,a,today-1,10000);
  insert into public.jubarte_loan_receipts(user_id,loan_id,account_id,date,amount_cents)
    values(u,l,a,today,6000),(u,l,b,today,6000);
  update public.jubarte_loans set closed=true,closed_date=today where id=l;
  if (select sum(amount_cents) from public.jubarte_loan_receipts where loan_id=l) <> 12000
     or not (select closed from public.jubarte_loans where id=l) then
    raise exception 'Recebimentos excedentes/fechamento falharam.';
  end if;
  update public.jubarte_loans set closed=false,closed_date=null,closing_notes='' where id=l;
  if (select count(*) from public.jubarte_entries where id in(e,t)) <> 2 then raise exception 'Lançamentos divergentes.'; end if;
end $$;
-- Um UID sem vínculo Auth/membership não pode consultar ou escrever dados.
do $$ begin perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true); end $$;
do $$ begin
  if public.jubarte_is_authorized() or exists(select 1 from public.jubarte_accounts) then
    raise exception 'Isolamento de não membro falhou.';
  end if;
  begin
    insert into public.jubarte_debtors(user_id,name,kind) values(auth.uid(),'Não autorizado','person');
    raise exception 'Escrita de não membro foi aceita.';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
