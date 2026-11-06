# Discovery da migração Supabase — Jubarte

Data: 06/11/2026. Origem: `ytaafzzgstwmnozsdfcw`. PostgreSQL confirmado: **17.11**.

Este documento consolida a etapa 1 de `migracao-supabase.md` e uma proposta de planejamento para revisão. **A migração não foi executada.** Não foram criados projetos, exportados registros individuais, alterados usuários, configurações, credenciais ou objetos remotos. Na origem foram executadas apenas consultas SELECT de catálogo e contagens agregadas pelo conector Supabase.

## Método e orquestração

- Leitura integral de `AGENTS.md`, `migracao-supabase.md` e `README.md`; inspeção do código, migrações, seeds, testes e CI.
- Três subagentes efetivamente selecionados como **GPT-6 Luna**: código/API (Medium), SQL/relacionamentos (High) e testes/configuração (Medium). Trabalharam em paralelo, somente em leitura local. O agente principal revisou e consolidou os resultados e realizou as consultas remotas.
- O ambiente não oferece troca do modelo do agente principal durante a sessão; a solicitação de GPT-6.1 Sol Medium para esse papel não foi aplicada por ferramenta. Não se atribui ao principal um modelo não verificado.
- As contagens e os metadados remotos abaixo são um snapshot, não um backup consistente para restauração. Devem ser repetidos no corte, dentro do procedimento de exportação.
- Não foram consultados e-mails, nomes de pessoas, telefones, observações financeiras, hashes de senha ou tokens como resultados. A verificação de conta com senha usou apenas contagem por existência de senha.

## Inventário confirmado na origem

As sete tabelas estão em `public`, todas com RLS habilitada e sem `FORCE ROW LEVEL SECURITY`. Cada tabela possui FK `user_id → auth.users(id) ON DELETE CASCADE`.

| Tabela                  | Registros | Colunas e relações internas                                                                                                                                                                 |
| ----------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jubarte_members`       |         1 | `user_id` UUID, PK; autorização administrativa                                                                                                                                              |
| `jubarte_accounts`      |         1 | `id`, `user_id`, `name`, `initial_cents`, `initial_date`, `color`, `archived`                                                                                                               |
| `jubarte_categories`    |        19 | `id`, `user_id`, `name`, `kind`, `color`, `icon`, `archived`                                                                                                                                |
| `jubarte_entries`       |         0 | `id`, `user_id`, `kind`, `description`, `amount_cents`, `account_id`, `destination_id`, `category_id`, `due_date`, `paid_date`, `notes`; conta e destino → accounts, categoria → categories |
| `jubarte_debtors`       |         1 | `id`, `user_id`, `name`, `kind`, `phone`, `notes`, `archived`                                                                                                                               |
| `jubarte_loans`         |         1 | `id`, `user_id`, `debtor_id`, `account_id`, `date`, `amount_cents`, `due_date`, `notes`, `closed`, `closed_date`, `closing_notes`; devedor → debtors, saída → accounts                      |
| `jubarte_loan_receipts` |         0 | `id`, `user_id`, `loan_id`, `account_id`, `date`, `amount_cents`, `notes`; empréstimo → loans, entrada → accounts                                                                           |

Nas seis tabelas de domínio, `id` é PK UUID com `gen_random_uuid()`. `members` usa o próprio `user_id` como PK. As sete relações internas usam FKs compostas `(user_id, referência) → (user_id, id)`, impedindo associação entre proprietários distintos. Accounts, categories, debtors e loans têm `UNIQUE(user_id,id)`.

Foram confirmados **49 constraints**: 7 PKs, 4 UNIQUEs, 14 FKs (7 para Auth e 7 internas) e 24 CHECKs. Não foram encontradas FKs de tabelas externas apontando para tabelas Jubarte.

Os CHECKs preservam nomes/descrições de 1–100 caracteres, cores hexadecimais, tipos e ícones permitidos, limites de textos, valores inteiros em centavos (até `100000000000`), formato de transferência e coerência do fechamento/vencimento de empréstimos. Saldo inicial permite zero; movimentações exigem valor positivo. Datas adicionais e uso de arquivados são verificados pelos triggers. As definições locais completas estão nas duas migrações, sem alterações nesta entrega.

### Índices

Confirmados **19 índices**: 11 implícitos de PK/UNIQUE e 8 explícitos:

| Índice explícito              | Colunas                        |
| ----------------------------- | ------------------------------ |
| `jubarte_entries_user_dates`  | `user_id, due_date, paid_date` |
| `jubarte_entries_account`     | `user_id, account_id`          |
| `jubarte_entries_destination` | `user_id, destination_id`      |
| `jubarte_entries_category`    | `user_id, category_id`         |
| `jubarte_loans_debtor`        | `user_id, debtor_id`           |
| `jubarte_loans_account`       | `user_id, account_id, date`    |
| `jubarte_receipts_loan`       | `user_id, loan_id`             |
| `jubarte_receipts_account`    | `user_id, account_id, date`    |

Os implícitos são `<tabela>_pkey` nas sete tabelas e `<tabela>_user_id_id_key` em accounts, categories, debtors e loans, sempre com o prefixo `jubarte_`. Não foram encontradas sequences Jubarte. Não há extensão adicional declarada nas migrações; `gen_random_uuid()` é a dependência para geração de IDs. Não há enum PostgreSQL próprio: os tipos de domínio são `text` com CHECK.

### Funções e triggers

Confirmadas **seis funções e seis triggers**; os triggers estão habilitados:

| Função                            | Trigger / tabela                                                                | Responsabilidade                                                          |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `jubarte_is_authorized()`         | RPC, sem trigger                                                                | Confere `jubarte_members` para `auth.uid()`; SQL STABLE, SECURITY DEFINER |
| `jubarte_validate_entry()`        | `jubarte_validate_entry` / entries                                              | INSERT/UPDATE; datas, proprietário, categorias compatíveis e arquivamento |
| `jubarte_validate_parent()`       | `jubarte_validate_account` / accounts; `jubarte_validate_category` / categories | UPDATE; protege proprietário, início da conta e tipo de categoria usada   |
| `jubarte_validate_loan()`         | `jubarte_validate_loan` / loans                                                 | INSERT/UPDATE/DELETE; datas, devedor, conta e fechamento manual           |
| `jubarte_validate_receipt()`      | `jubarte_validate_receipt` / loan_receipts                                      | INSERT/UPDATE/DELETE; conta, datas e empréstimo aberto                    |
| `jubarte_validate_loan_account()` | `jubarte_validate_loan_account` / accounts                                      | UPDATE; início da conta compatível com empréstimos e recebimentos         |

Todas têm `search_path=''`. As cinco funções de trigger usam SECURITY INVOKER. O RPC usa SECURITY DEFINER para consultar a lista administrativa, limitado ao UID da sessão. Os corpos consultados são compatíveis com as responsabilidades descritas nos scripts; não foi produzido um diff canônico automático entre todo o DDL local e remoto.

### RLS e privilégios: diferença encontrada

- `jubarte_member_self`: SELECT para `authenticated`, somente `user_id=auth.uid()`; a tabela members concede apenas SELECT a esse papel.
- `jubarte_accounts_owner`, `jubarte_categories_owner`, `jubarte_entries_owner`, `jubarte_debtors_owner`, `jubarte_loans_owner` e `jubarte_receipts_owner`: ALL para `authenticated`, com proprietário e autorização tanto em USING quanto em WITH CHECK.
- As seis tabelas de domínio concedem SELECT/INSERT/UPDATE/DELETE a `authenticated`; não apareceu grant de tabela para `anon`. `postgres` e `service_role` têm privilégios administrativos na origem; o frontend não usa service role.
- **Diferença confirmada:** as seis funções concedem EXECUTE explicitamente a `anon`, `authenticated` e `service_role` na origem. Os scripts locais revogam PUBLIC e concedem explicitamente apenas o RPC a `authenticated`. Revogar PUBLIC não remove grants diretos herdados dos privilégios padrão de criação.
- Impacto: a superfície de funções remotas é mais ampla que a intenção do código SQL. Isso, isoladamente, não comprova vazamento: o RPC continua usando `auth.uid()` e funções que retornam trigger não são RPCs de uso comum. A origem não foi corrigida. No destino, preparar revogações explícitas de `anon`/`authenticated` nas funções de validação e de `anon` no RPC; conceder EXECUTE do RPC somente ao papel necessário. Verificar também os privilégios padrão do proprietário e testar o resultado real.

## Auth e recursos compartilhados

- Há **um membro**, com usuário Auth correspondente, e-mail confirmado e identidade do provedor `email`; a conta possui senha. Nenhum proprietário dos dados está fora de `jubarte_members` neste snapshot. A contagem de membros, sozinha, não deve ser usada como filtro definitivo de exportação: preservar também histórico de usuários eventualmente revogados.
- `auth.users` também é referenciada por **`public.greenmond_profiles` e `public.profiles`**. Isso confirma o compartilhamento estrutural de Auth. Não se verificou se o membro do Jubarte é o mesmo usuário de cada outra aplicação; essa associação não é necessária para copiar exclusivamente os dados Jubarte e jamais autoriza excluir o usuário na origem.
- O acesso do frontend depende de `auth.uid()` nas políticas/funções, roles Supabase, Data API/PostgREST e o RPC. Tokens e sessões da origem não devem ser levados ao destino: será necessário novo login.
- Existe **um bucket** na origem e nenhum com nome/ID contendo Jubarte. Não há uso de Storage no código nem referência Jubarte nas políticas de outras tabelas pesquisadas. Não copiar esse bucket com base no prefixo: sua propriedade funcional não foi comprovada. PDFs são gerados localmente.
- Não foram encontradas views, materialized views, funções sem prefixo, políticas de outras tabelas ou triggers de outras tabelas referenciando Jubarte nas buscas de catálogo/texto realizadas. As tabelas Jubarte não pertencem a publications consultadas.
- Limite: essas buscas não provam ausência de SQL dinâmico, tarefas agendadas, consumidores externos ou Edge Functions que façam chamadas por strings construídas em execução. Não houve inspeção dos serviços de outras aplicações, configurações SMTP/Auth do painel ou dados do bucket. Nenhum recurso desses será migrado sem identificação de vínculo.

## Inventário do aplicativo e configuração

| Arquivo/componente                               | Dependência da migração                                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/supabase.ts`                                | URL/chave parametrizadas; `detectSessionInUrl: true`, fluxo `implicit`                                                                                                     |
| `src/Auth.tsx`                                   | Login e-mail/senha, recuperação por e-mail e `updateUser`; não há cadastro público na interface                                                                            |
| `src/App.tsx`                                    | Sessão, eventos de Auth, logout e limpeza de cache; CRUD PostgREST em tabelas `jubarte_${key}`, com exceção `receipts → loan_receipts`; novo registro recebe UID da sessão |
| `src/data.ts`                                    | RPC de autorização antes de seis consultas paginadas (lotes de 1000), ordenadas por ID; erro orienta aplicar migração de empréstimos ausente                               |
| `src/types.ts`, `src/finance.ts`, `src/loans.ts` | Tipos/cálculos em centavos, datas BR e movimentos de empréstimos derivados, sem gravá-los em entries                                                                       |
| `src/LoansPage.tsx`, `src/forms.tsx`             | Contas de saída/entrada distintas, excedentes, fechamento manual e histórico                                                                                               |
| `src/demo.ts`, `src/report.tsx`                  | Demo em memória e PDF local; não requerem cópia remota                                                                                                                     |
| `.env.local`                                     | Existe; apenas as duas variáveis esperadas. URL conferida contra a origem, sem imprimir chave                                                                              |
| `.env.example`                                   | Contrato `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`                                                                                                             |
| `.github/workflows/pages.yml`                    | Mesmas variáveis vêm de GitHub Actions `vars` no build; trocar só `.env.local` não migra a publicação                                                                      |
| `vite.config.ts`, roteamento                     | Preservar `/jubarte/` e HashRouter                                                                                                                                         |

Login usa `signInWithPassword`; sessão usa `getSession`/`onAuthStateChange`; recuperação usa `resetPasswordForEmail` com redirect para `origin + BASE_URL`, incluindo o fluxo de configurações da conta. O cliente usa o armazenamento padrão de sessão Supabase. O destino terá sua própria sessão; os dados financeiros continuam fora do localStorage. Não foram encontrados outros RPCs, canais Realtime, Storage ou chamadas Edge Functions no código inspecionado.

O destino precisa das URLs de retorno `https://wsoubar.github.io/jubarte/` e `http://localhost:5173/jubarte/`, envio de e-mail validado, provedor e-mail/senha e política administrativa de cadastro. Não alterar a Site URL, redirects, SMTP ou usuários da origem.

## Estratégia recomendada para revisão

**Migrar somente o domínio Jubarte para um projeto novo e recriar a identidade de login com remapeamento explícito do proprietário.** Para o cenário observado (um usuário e pequeno volume), é mais simples e limita o tratamento de credenciais. Preservar todos os UUIDs dos registros financeiros; alterar apenas `user_id` conforme mapa privado e verificado `UID_ORIGEM → UID_DESTINO` nas sete tabelas. O mapa não deve ser versionado com dados reais.

| Alternativa Auth                                          | Avaliação                                                                                                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recriar usuário administrativamente e remapear `user_id`  | Recomendada: não copia hash/sessões, permite senha nova e separa o ciclo de vida do login; exige mapa completo e teste de recuperação                                                 |
| Preservar o UUID Auth mediante provisionamento compatível | Pode reduzir remapeamento, mas exige comprovar suporte do procedimento escolhido e consistência de identities; não presumir que qualquer API administrativa aceita UUID escolhido     |
| Importar usuário e credenciais Auth seletivamente         | Somente se a continuidade da senha for requisito aprovado; envolve dados sensíveis, compatibilidade de esquema e mais validação. Não copiar `auth.*` inteiro do projeto compartilhado |

A recomendação ainda depende da aprovação do planejamento; não é decisão executada. A seleção de organização, região, plano/custo e nome do destino também precisa ser definida antes da criação. Preferir PostgreSQL 17 compatível com a origem e com as ferramentas oficiais, sem assumir versão disponível no painel.

### Cópia e ordem de carga

1. Confirmar escopo, usuários, mapa de IDs, destino e janela sem gravações no Jubarte. A janela é operacional: não alterar configurações globais nem paralisar as outras aplicações. Um aviso só na UI não garante que abas antigas parem de gravar; combinar interrupção efetiva de clientes e conferência de ausência de mudanças. Se isso não puder ser garantido, exigir estratégia adicional de captura/reconciliação antes do corte.
2. Ensaiar localmente a carga usando fixtures com arquivados e empréstimos fechados, além do snapshot permitido. Preparar extração seletiva e consistente das sete tabelas em uma mesma transação/snapshot de leitura. Usar lista explícita de tabelas, sem dump integral de `public`, roles ou Auth.
3. Após aprovação específica, criar/configurar o destino, provisionar Auth, configurar redirects/SMTP e verificar o UID escolhido. A criação pode ter custo e exige aprovação própria.
4. Reaproveitar as definições das duas migrações existentes, com artefato de restauração revisado dividido em estrutura e finalização; manter PK/FK/CHECK e RLS. Não reaplicar os scripts históricos sobre tabelas já criadas e não executar comandos de reset.
5. Carregar `members`, accounts/categories/debtors, entries/loans e, por último, loan_receipts, com colunas e UUIDs explícitos. Não executar seeds sobre dados copiados: as categorias existentes já serão preservadas.
6. Finalizar os triggers/privilégios antes de disponibilizar a aplicação e validar todo o histórico carregado, não apenas novas operações.
7. Testar destino isoladamente; somente depois aprovar a troca das duas variáveis locais e de publicação, rebuild e deploy. Confirmar pelas requisições de rede do aplicativo publicado que usa exclusivamente o destino.

**Risco específico de restauração:** inserir movimentações que referenciem contas/categorias/devedores arquivados e recebimentos de empréstimos já fechados pode ser recusado pelos triggers mesmo que represente histórico legítimo. Hoje as contagens de arquivados e de fechados com recebimentos são zero, mas isso pode mudar. Não presumir que aplicar as duas migrações e importar qualquer histórico funcionará. A preparação deverá criar os triggers de negócio após a carga, em ambiente de destino ainda indisponível para clientes, com validação retrospectiva explícita de todas as regras. Não usar `session_replication_role=replica` como atalho: isso também pode suprimir checagens referenciais. Não desabilitar RLS.

### Riscos prioritários

| Prioridade | Risco                                                      | Tratamento proposto                                                                                                    |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Alta       | Cópia indiscriminada de Auth/recursos de outras aplicações | Allowlist de sete tabelas, identidade aprovada e nenhuma exclusão na origem                                            |
| Alta       | Perda de vínculo com o proprietário                        | Mapa bijetivo de UIDs, FKs e comparação exata após normalização do UID                                                 |
| Alta       | Escritas concorrentes e divergência no corte/rollback      | Snapshot consistente, janela controlada e evidência de ausência de novas escritas; reconciliação se houver divergência |
| Alta       | Histórico recusado pelos triggers de INSERT                | Ensaio e finalização separada dos triggers com validação retrospectiva                                                 |
| Média      | Grants de funções diferentes dos scripts                   | Revogações explícitas e testes de privilégios no destino, sem copiar ACLs cegamente                                    |
| Média      | Publicação continuar conectada à origem                    | Atualizar variáveis de build, republicar com aprovação e conferir rede                                                 |
| Média      | Login/recuperação falharem no destino                      | Usuário/identities coerentes, redirects e SMTP testados com conta real                                                 |

## Arquivos previstos, sem implementação de migração nesta etapa

| Arquivo/recurso                                 | Ação posterior                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/migracao-supabase/discovery.md`           | Criado nesta entrega; inventário e planejamento proposto                                                                              |
| `docs/migracao-supabase/plano.md`               | Decisões aprovadas, responsáveis, sequência e pontos de autorização                                                                   |
| `docs/migracao-supabase/execucao.md`            | Comandos exatos, versões, identificadores não secretos, resultados e rollback                                                         |
| `supabase/migration-tools/` (novo, proposto)    | Consultas de catálogo/validação, extração seletiva, importação, estrutura/finalização revisadas e guardas de projeto origem/destino   |
| Testes de restauração locais (novos, propostos) | Fixtures com arquivados/fechados e remapeamento de UIDs; comparação integral após cópia                                               |
| `.gitignore`                                    | Se necessário, excluir diretório privado de dumps/mapas e artefatos com dados pessoais                                                |
| `README.md`                                     | Atualizar operação no destino após execução validada, mantendo histórico/procedimento de retorno                                      |
| `.env.local` / GitHub Actions Variables         | Alterar apenas no corte aprovado; preservar configuração anterior em local privado                                                    |
| Migrações existentes e código `src/`            | Nenhuma alteração obrigatória identificada; preservar contratos e histórico. Correções SQL necessárias serão preparadas separadamente |

Não foram criados scripts de transferência nem arquivos de configuração do destino. Não há razão identificada para mudar arquitetura, nomes de tabela, cálculos, roteamento, interface ou sistema de temas.

## Validação e critérios de aceite

Antes do corte, repetir inventário e contagens, conferir esquema/ACLs reais contra os artefatos preparados e tratar diferenças. No destino, exigir:

- Igualdade de todos os registros/colunas das sete tabelas, normalizando somente o UID remapeado; comparação determinística por PK, sem depender apenas de contagens ou amostras. Preservar `NULL`, datas, centavos e textos; exportar bigint sem perda de precisão.
- Zero órfãos em todas as FKs, zero proprietários sem usuário Auth correspondente e manutenção da situação de autorização/revogação dos usuários que possuam histórico.
- Mesmas contagens e somas em centavos por usuário/conta; saldos realizados/projetados, transferências, pendências e valores de empréstimos/recebimentos idênticos para datas de referência explícitas em `America/Sao_Paulo`.
- Conferência das 7 PKs, 4 UNIQUEs, 14 FKs, 24 CHECKs, 19 índices, 6 funções, 6 triggers e 7 políticas; comparar definições, não apenas quantidades.
- Testes via Data API com anon, autenticado não membro e usuários autorizados A/B: leitura e escrita isoladas, associação cruzada negada, alteração de proprietário negada e inclusão de membros proibida. Criar dados de teste apenas no destino, mediante autorização.
- Login/logout, novo login após troca de projeto, recuperação por e-mail e criação/consulta/alteração/exclusão pertinentes para contas, categorias, lançamentos, transferências, devedores, empréstimos e recebimentos. Arquivamento preserva histórico; fechamento manual não ajusta saldos e excedentes continuam permitidos.
- Teste real de navegador no destino e na publicação; confirmar ausência de requisições à origem. Os E2E atuais em demonstração não satisfazem esse requisito.
- Origem intacta; registrar resultados antes de considerar concluída a migração.

### Verificações executadas nesta entrega

- `npm test`: **31/31 passaram**, em quatro arquivos; PGlite usa `auth.users`, roles e `auth.uid()` simulados. Valida regras SQL locais, não Auth/PostgREST remoto.
- `npm run build`: **passou** (TypeScript e Vite); avisos de anotações em Zod e chunks acima de 500 kB. Nenhuma mudança funcional foi feita para tratar avisos preexistentes fora do escopo.
- `npm run test:e2e`: primeira tentativa bloqueada por EPERM na porta local; com permissão de execução, o Chromium em `/usr/bin/chromium` não existe. **`CI=true npm run test:e2e`: 8/8 passaram**, usando o navegador já instalado pelo Playwright, sem alterar configuração do repositório. Os fluxos exercitados usam demonstração em memória.
- Runtime disponível: Node **26.13.0**, diferente das versões 22/24 recomendadas no projeto/CI; os resultados acima refletem esse ambiente, não uma nova execução do CI Node 22.
- Consultas SELECT remotas: catálogo, definições, RLS, privilégios, índices, constraints, dependências, contagens e resumo Auth/Storage. Nenhum teste remoto de escrita ou de isolamento com sessão A/B foi executado.
- Conferência adicional local em PGlite: aplicação das duas migrações e consulta de catálogo confirmaram os 24 CHECKs versionados (accounts 3, categories 4, entries 5, debtors 4, loans 6 e receipts 2), correspondentes à quantidade remota.

## Rollback proposto e decisões pendentes

Antes de permitir escritas no destino, falhas podem ser tratadas mantendo a aplicação na origem. A origem não será limpa nem alterada durante a migração. Depois de mudar variáveis, um retorno exige rebuild/republicação do bundle anterior ou com a configuração anterior, mediante aprovação.

**Depois de qualquer escrita exclusiva no destino, apontar a aplicação de volta à origem pode perder alterações.** Nesse caso, interromper novas escritas no Jubarte, preservar snapshot do destino, calcular diferenças por PK/coluna (incluindo exclusões e alterações de datas/saldos), resolver conflitos e aprovar a reconciliação antes do retorno. Os registros não têm trilha geral de auditoria nem `updated_at`; não existe mecanismo pronto de merge incremental confiável. Guardar o baseline do corte é necessário. A reconciliação que escreva na origem seria uma ação separada, sujeita às restrições do documento original; não está autorizada nem comprovada por esta entrega.

Pendências para aprovar o planejamento: projeto/organização/região/plano de destino; recriação do login versus preservação seletiva de identidade; janela e controle de gravações; local privado de backup/mapa; critérios de validação real e procedimento de reconciliação. Cada etapa que crie/altere recursos remotos terá aprovação específica antes da execução, conforme `migracao-supabase.md`.

## Referências oficiais consultadas

- [Backup e restore com CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): referência geral; os exemplos de cópia integral não devem ser aplicados ao projeto compartilhado sem restringir escopo.
- [Gestão de usuários](https://supabase.com/docs/guides/auth/managing-user-data): dependência de `auth.users` e referências por chave primária.
- [CLI v3: alvo local por padrão](https://supabase.com/changelog/supabase-cli-v3): verificar versão e `--help` ao preparar comandos; a sintaxe e o alvo remoto não devem ser presumidos.
- [Exposição explícita das tabelas na Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): grants e RLS são camadas distintas; testar ambas no destino.

O endpoint Markdown do changelog não pôde ser obtido nesta sessão; foi consultado o changelog HTML e as páginas relevantes de mudanças incompatíveis. Nenhum comando de CLI de migração foi executado.
