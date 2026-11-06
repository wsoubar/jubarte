# Ferramentas de migração do Jubarte

Scripts para exportar seletivamente as sete tabelas e restaurá-las no projeto dedicado. Os SQL não contêm dados reais; devem ser enviados à conexão indicada. Os scripts Node abaixo fazem somente as operações explicitamente descritas, nunca alteram a origem.

## Automação desta execução

- `00-exportar.sql`: SELECT único na origem, com snapshot consistente. Salvar o resultado em `.migration-private/source.json`, no formato `{ "snapshot": { ... }, "owners": [{ "id": "UID_ORIGEM", "email": "EMAIL" }] }`. Os proprietários devem incluir todos os usuários com histórico.
- `node supabase/migration-tools/configurar-auth.mjs`: lê `SUPABASE_ACCESS_TOKEN` de `.migration-private/admin.env`; configura Auth **somente** em `omduuwlmkyfdupzgqtpq`, cria o login e grava senha nova e mapa em arquivos privados. Não imprime credenciais, não copia senha da origem e não redefine a senha de usuário existente.
- `node supabase/migration-tools/preparar-carga.mjs`: gera `.migration-private/import.sql` e `validate.sql` com os parâmetros para os SQL 02 e 04. Não executa consultas nem envia dados.
- `node supabase/migration-tools/smoke-api.mjs`: testa login, autorização, leitura das sete tabelas, bloqueio anônimo, CRUD de um devedor temporário e logout no destino. Remove apenas o registro temporário criado pelo próprio teste.
- `05-smoke-transacional.sql`: testa os principais fluxos financeiros sob role authenticated e não membro; termina com ROLLBACK, sem deixar dados de teste. Executar somente no destino explicitamente selecionado.
- `node supabase/migration-tools/smoke-browser.mjs`: com o servidor local na porta 5173, testa o login pela interface, o carregamento dos dados e o uso exclusivo do destino. Requer o Chromium instalado pelo Playwright.

O diretório privado está no `.gitignore`, com acesso restrito. Não cole seu conteúdo em documentação, commits ou logs. Os scripts Node estão deliberadamente limitados ao destino desta execução. Para outro destino, revise as referências primeiro.

Os parâmetros de Project Ref não autenticam a identidade da conexão SQL. Confira o destino no cliente/conector antes de enviar cada script; nesta execução todas as escritas usam explicitamente `omduuwlmkyfdupzgqtpq`.

## Ordem e pré-condições

1. Crie/provisione manualmente um novo projeto Supabase e os usuários Auth aprovados. A conexão ativa deve ser a do destino. O banco deve estar novo, sem nenhuma das sete tabelas `jubarte_*`.
2. Execute `01-estrutura.sql` como proprietário do projeto. Ele falha se qualquer tabela Jubarte já existir. As tabelas já nascem com RLS, políticas, grants, PK/FK/UNIQUE/CHECK e índices; os triggers de negócio ainda não existem.
3. Reúna, fora do repositório, um snapshot JSON único contendo arrays com os registros integrais destas sete tabelas: `jubarte_members`, `jubarte_accounts`, `jubarte_categories`, `jubarte_entries`, `jubarte_debtors`, `jubarte_loans`, `jubarte_loan_receipts`. Inclua todos os usuários com histórico, mesmo que não sejam membros autorizados no corte. Preserve os UUIDs `id` dos registros.
4. Prepare mapa JSON privado `{ "UID_ORIGEM": "UID_DESTINO" }`. Todos os UIDs destino precisam existir em `auth.users`. Não copie senha, sessão, token, `auth.users` ou dados de outros aplicativos.
5. Execute `02-importar.sql` na conexão do destino, passando os parâmetros de sessão `jubarte_migration.snapshot`, `jubarte_migration.uid_map`, `jubarte_migration.target_ref` e `jubarte_migration.expected_target_ref`. O snapshot e mapa são valores JSON; os dois `target_ref` devem ser o mesmo Project Ref que você verificou fora do SQL. Defina os quatro via `set_config(..., true)` dentro do mesmo `BEGIN` que executará a importação. A transação de importação confirma tudo ou reverte tudo. O script recusa tabelas ausentes, dados Jubarte existentes e UIDs destino inexistentes. Não execute em uma conexão da origem.
6. Execute `03-finalizacao.sql` depois da carga. Ele instala os triggers de validação e deixa explícito que somente `authenticated` pode executar `jubarte_is_authorized()`; `PUBLIC`, `anon` e `authenticated` não podem executar as cinco funções internas de trigger.
7. Defina `jubarte_migration.snapshot`, `jubarte_migration.uid_map`, `jubarte_migration.target_ref` e `jubarte_migration.expected_target_ref` para a validação na mesma transação/chamada e execute `04-validar.sql`. Ele compara contagens e cada linha do snapshot após remapear apenas `user_id`, preserva/verifica os demais valores e UUIDs, e verifica constraints/FKs validadas, índices, RLS, políticas, triggers, ACL e correspondência de membros com Auth.

Os arquivos JSON, o mapa e qualquer exportação permanecem locais e devem ser tratados como dados financeiros sensíveis. Não os adicione ao Git. Os scripts SQL de estrutura e finalização são deliberadamente separados: triggers de negócio podem recusar histórico legítimo já associado a objetos arquivados ou empréstimos fechados. FKs e constraints continuam ativas durante toda a importação; RLS nunca é desativada. Importar dados não muda `jubarte_members` para usuários que não estavam autorizados na origem.

## Limites

Os SQL 01–04 não criam projeto nem provisionam usuários Auth. A configuração da aplicação continua usando as duas variáveis existentes; não há alteração de arquitetura. O smoke não testa entrega de e-mail de recuperação. Não há rollback após novas gravações na aplicação de destino sem reconciliação explícita.
