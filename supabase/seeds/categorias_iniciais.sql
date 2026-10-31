-- Execute este arquivo completo no SQL Editor do Supabase como proprietário.
-- As tabelas devem existir e o usuário deve estar em jubarte_members.
-- Altere apenas o valor SEU-UID abaixo pelo UUID em Authentication → Users.
-- Este script não cria tabelas nem altera políticas de segurança.

do $$
declare
  usuario_uid text := 'SEU-UID';
  usuario_id uuid;
  quantidade integer;
begin
  if usuario_uid = 'SEU-' || 'UID' or trim(usuario_uid) = '' then
    raise exception 'Preencha usuario_uid com o UUID do usuário em Authentication → Users.';
  end if;

  usuario_id := usuario_uid::uuid;

  if not exists (
    select 1 from public.jubarte_members where user_id = usuario_id
  ) then
    raise exception 'O usuário % não está autorizado em jubarte_members.', usuario_id;
  end if;

  insert into public.jubarte_categories (user_id, name, kind, color, icon)
  select usuario_id, c.name, c.kind, c.color, c.icon
  from (values
    ('Salário', 'income', '#16a34a', 'wallet'),
    ('Outras receitas', 'income', '#0d9488', 'wallet'),
    ('Moradia', 'expense', '#2563eb', 'home'),
    ('Alimentação', 'expense', '#ea580c', 'utensils'),
    ('Transporte', 'expense', '#7c3aed', 'car'),
    ('Saúde', 'expense', '#dc2626', 'heart'),
    ('Educação', 'expense', '#0891b2', 'book'),
    ('Lazer', 'expense', '#db2777', 'coffee'),
    ('Outras despesas', 'expense', '#64748b', 'wallet')
  ) as c(name, kind, color, icon)
  where not exists (
    select 1
    from public.jubarte_categories existente
    where existente.user_id = usuario_id
      and existente.name = c.name
      and existente.kind = c.kind
  );

  get diagnostics quantidade = row_count;
  raise notice '% categoria(s) inserida(s) para o usuário %.', quantidade, usuario_id;
end;
$$;
