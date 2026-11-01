-- Execute este arquivo completo no SQL Editor do Supabase como proprietário.
-- Requer a migração inicial e o usuário autorizado em jubarte_members.
-- Substitua somente o valor SEU-UID abaixo pelo UUID em Authentication → Users.
-- Apenas insere receitas ausentes; preserva categorias existentes/arquivadas.
-- Não cria tabelas nem altera RLS. Execute uma vez por vez.

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
  select usuario_id, c.name, 'income', c.color, c.icon
  from (values
    ('Salário', '#16a34a', 'wallet'),
    ('Pró-labore', '#059669', 'wallet'),
    ('Serviços e trabalhos extras', '#0d9488', 'wallet'),
    ('Vendas', '#0891b2', 'wallet'),
    ('Aluguéis', '#2563eb', 'home'),
    ('Rendimentos', '#4f46e5', 'wallet'),
    ('Dividendos', '#7c3aed', 'wallet'),
    ('Aposentadoria e pensão', '#65a30d', 'wallet'),
    ('Bônus e comissões', '#ca8a04', 'wallet'),
    ('Presentes e doações', '#db2777', 'heart'),
    ('Reembolsos', '#0284c7', 'wallet'),
    ('Outras receitas', '#0d9488', 'wallet')
  ) as c(name, color, icon)
  where not exists (
    select 1
    from public.jubarte_categories existente
    where existente.user_id = usuario_id
      and existente.name = c.name
      and existente.kind = 'income'
  );

  get diagnostics quantidade = row_count;
  raise notice '% categoria(s) de receita inserida(s) para o usuário %.', quantidade, usuario_id;
end;
$$;
