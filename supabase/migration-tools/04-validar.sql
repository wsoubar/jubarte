-- Executar no destino depois da importação e da finalização.
do $$
declare
  snapshot jsonb := current_setting('jubarte_migration.snapshot', true)::jsonb;
  target_ref text := current_setting('jubarte_migration.target_ref', true);
  expected_ref text := current_setting('jubarte_migration.expected_target_ref', true);
  uid_map jsonb := current_setting('jubarte_migration.uid_map', true)::jsonb;
  table_name text;
  expected bigint;
  actual bigint;
  rows jsonb;
  different boolean;
  sql text;
begin
  if snapshot is null or uid_map is null then raise exception 'Defina snapshot e uid_map para comparar a carga.'; end if;
  if target_ref is null or target_ref = 'ytaafzzgstwmnozsdfcw' or target_ref is distinct from expected_ref then
    raise exception 'A validação precisa estar conectada ao Project Ref de destino confirmado.';
  end if;
  foreach table_name in array array['jubarte_members','jubarte_accounts','jubarte_categories','jubarte_entries','jubarte_debtors','jubarte_loans','jubarte_loan_receipts'] loop
    expected := jsonb_array_length(snapshot->table_name);
    execute format('select count(*) from public.%I', table_name) into actual;
    if actual <> expected then raise exception 'Contagem divergente em %: esperado %, encontrado %.', table_name, expected, actual; end if;
    rows := snapshot->table_name;
    select coalesce(jsonb_agg(jsonb_set(r, '{user_id}', to_jsonb(uid_map->>(r->>'user_id')))), '[]'::jsonb)
      into rows from jsonb_array_elements(rows) r;
    sql := format(
      'select exists (select 1 from ((select to_jsonb(t) from public.%I t except select to_jsonb(x) from jsonb_populate_recordset(null::public.%I, $1) x) union all (select to_jsonb(x) from jsonb_populate_recordset(null::public.%I, $1) x except select to_jsonb(t) from public.%I t)) differences)',
      table_name, table_name, table_name, table_name
    );
    execute sql into different using rows;
    if different then raise exception 'Há divergência de conteúdo (incluindo UUIDs) em %.', table_name; end if;
  end loop;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'jubarte\_%' escape '\' and c.relkind='r' and c.relrowsecurity) <> 7 then
    raise exception 'RLS não está habilitada nas sete tabelas.';
  end if;
  if (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname like 'jubarte_validate_%' and not t.tgisinternal and t.tgenabled='O') <> 6 then
    raise exception 'Não foram encontrados os seis triggers habilitados.';
  end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename like 'jubarte\_%' escape '\') <> 7 then
    raise exception 'Não foram encontradas as sete políticas RLS.';
  end if;
  if (select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname like 'jubarte\_%' escape '\' and c.contype='p') <> 7
     or (select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname like 'jubarte\_%' escape '\' and c.contype='u') <> 4
     or (select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname like 'jubarte\_%' escape '\' and c.contype='f' and c.convalidated) <> 14
     or (select count(*) from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname like 'jubarte\_%' escape '\' and c.contype='c' and c.convalidated) <> 24 then
    raise exception 'Constraints PK/UNIQUE/FK/CHECK divergentes ou FK/CHECK sem validação.';
  end if;
  if (select count(*) from pg_index i join pg_class t on t.oid=i.indrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname like 'jubarte\_%' escape '\') <> 19 then
    raise exception 'Quantidade divergente de índices Jubarte.';
  end if;
  if has_function_privilege('anon','public.jubarte_is_authorized()','EXECUTE') or not has_function_privilege('authenticated','public.jubarte_is_authorized()','EXECUTE') then
    raise exception 'ACL incorreta na RPC jubarte_is_authorized.';
  end if;
  if exists (select 1 from (values ('jubarte_members'),('jubarte_accounts'),('jubarte_categories'),('jubarte_entries'),('jubarte_debtors'),('jubarte_loans'),('jubarte_loan_receipts')) t(name) where has_table_privilege('anon', format('public.%I', t.name), 'select')) then
    raise exception 'anon tem privilégio SELECT em tabela Jubarte.';
  end if;
  if has_table_privilege('authenticated','public.jubarte_members','insert') or has_table_privilege('authenticated','public.jubarte_members','update') or has_table_privilege('authenticated','public.jubarte_members','delete') then
    raise exception 'authenticated pode alterar a lista de autorização.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'jubarte_validate_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then
    raise exception 'Função interna de trigger executável por anon/authenticated.';
  end if;
  if exists (select 1 from public.jubarte_members m left join auth.users u on u.id=m.user_id where u.id is null) then
    raise exception 'Há proprietário sem usuário Auth correspondente.';
  end if;
end
$$;

select 'jubarte_members' as tabela, count(*) as registros from public.jubarte_members
union all select 'jubarte_accounts', count(*) from public.jubarte_accounts
union all select 'jubarte_categories', count(*) from public.jubarte_categories
union all select 'jubarte_entries', count(*) from public.jubarte_entries
union all select 'jubarte_debtors', count(*) from public.jubarte_debtors
union all select 'jubarte_loans', count(*) from public.jubarte_loans
union all select 'jubarte_loan_receipts', count(*) from public.jubarte_loan_receipts;

select c.relname as tabela, c.relrowsecurity as rls, count(p.policyname) as politicas
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
where n.nspname='public' and c.relname like 'jubarte\_%' escape '\' and c.relkind='r'
group by c.relname, c.relrowsecurity order by c.relname;
