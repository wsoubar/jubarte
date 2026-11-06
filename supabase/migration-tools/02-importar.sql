do $$
declare
  snapshot jsonb := current_setting('jubarte_migration.snapshot', true)::jsonb;
  uid_map jsonb := current_setting('jubarte_migration.uid_map', true)::jsonb;
  target_ref text := current_setting('jubarte_migration.target_ref', true);
  expected_ref text := current_setting('jubarte_migration.expected_target_ref', true);
  table_name text;
  rows jsonb;
  sql text;
begin
  if snapshot is null or uid_map is null or target_ref is null or target_ref = '' or target_ref is distinct from expected_ref or target_ref = 'ytaafzzgstwmnozsdfcw' then
    raise exception 'Defina snapshot, uid_map e target_ref; target_ref deve coincidir com expected_target_ref.';
  end if;
  if jsonb_typeof(snapshot) <> 'object' or jsonb_typeof(uid_map) <> 'object' then
    raise exception 'Snapshot e mapa devem ser objetos JSON.';
  end if;
  if exists (select 1 from (values
    ('jubarte_members'),('jubarte_accounts'),('jubarte_categories'),('jubarte_entries'),
    ('jubarte_debtors'),('jubarte_loans'),('jubarte_loan_receipts')
  ) as t(name) where to_regclass('public.' || t.name) is null) then
    raise exception 'Estrutura Jubarte ausente; aplique 01-estrutura.sql antes da importação.';
  end if;
  if not (snapshot ?& array['jubarte_members','jubarte_accounts','jubarte_categories','jubarte_entries','jubarte_debtors','jubarte_loans','jubarte_loan_receipts']) then
    raise exception 'Snapshot precisa conter arrays para as sete tabelas Jubarte.';
  end if;
  if exists (select 1 from public.jubarte_members) or exists (select 1 from public.jubarte_accounts)
     or exists (select 1 from public.jubarte_categories) or exists (select 1 from public.jubarte_entries)
     or exists (select 1 from public.jubarte_debtors) or exists (select 1 from public.jubarte_loans)
     or exists (select 1 from public.jubarte_loan_receipts) then
    raise exception 'Destino já contém dados Jubarte; importação cancelada sem exclusões.';
  end if;
  if exists (select 1 from jsonb_each_text(uid_map) m where m.value !~* '^[0-9a-f-]{36}$') then
    raise exception 'Mapa contém UID de destino inválido.';
  end if;
  if (select count(distinct value) from jsonb_each_text(uid_map)) <> (select count(*) from jsonb_each(uid_map)) then
    raise exception 'Mapa de UIDs precisa ser bijetivo: dois usuários de origem não podem compartilhar o mesmo UID destino.';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(snapshot->'jubarte_members', '[]'::jsonb)) r where uid_map->>(r->>'user_id') is null) then
    raise exception 'Todo usuário exportado precisa de mapeamento UID origem → UID destino.';
  end if;
  foreach table_name in array array['jubarte_members','jubarte_accounts','jubarte_categories','jubarte_entries','jubarte_debtors','jubarte_loans','jubarte_loan_receipts'] loop
    if exists (select 1 from jsonb_array_elements(snapshot->table_name) r where uid_map->>(r->>'user_id') is null) then
      raise exception 'Falta mapeamento de UID para linhas em %.', table_name;
    end if;
  end loop;
  if exists (select 1 from jsonb_each_text(uid_map) m where not exists (select 1 from auth.users u where u.id = m.value::uuid)) then
    raise exception 'UID destino do mapa não existe em auth.users deste projeto.';
  end if;
  foreach table_name in array array['jubarte_members', 'jubarte_accounts', 'jubarte_categories', 'jubarte_debtors', 'jubarte_entries', 'jubarte_loans', 'jubarte_loan_receipts'] loop
    rows := coalesce(snapshot->table_name, '[]'::jsonb);
    if jsonb_typeof(rows) <> 'array' then raise exception 'Snapshot de % deve ser um array JSON.', table_name; end if;
    select coalesce(jsonb_agg(jsonb_set(r, '{user_id}', to_jsonb(uid_map->>(r->>'user_id')))), '[]'::jsonb)
      into rows from jsonb_array_elements(rows) r;
    sql := format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)', table_name, table_name);
    execute sql using rows;
  end loop;
end
$$;
