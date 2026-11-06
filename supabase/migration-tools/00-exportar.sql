-- Somente leitura. Executar na origem; salvar o resultado em arquivo privado.
-- Um único SELECT fornece snapshot consistente das sete tabelas.
select jsonb_build_object(
  'jubarte_members', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.jubarte_members order by user_id) t),
  'jubarte_accounts', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.jubarte_accounts order by id) t),
  'jubarte_categories', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.jubarte_categories order by id) t),
  'jubarte_entries', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.jubarte_entries order by id) t),
  'jubarte_debtors', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.jubarte_debtors order by id) t),
  'jubarte_loans', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.jubarte_loans order by id) t),
  'jubarte_loan_receipts', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.jubarte_loan_receipts order by id) t)
) as snapshot;
