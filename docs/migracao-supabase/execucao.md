# Execução da migração Supabase

Data: 06/11/2026. Autorização: criação/configuração e migração aprovadas pelo usuário; sem usuários ativos, com prioridade à simplicidade.

## Estado atual

- Origem preservada: `ytaafzzgstwmnozsdfcw`. Nenhuma escrita ou exclusão executada nela.
- Destino criado: **jubarte**, `omduuwlmkyfdupzgqtpq`, organização confirmada pelo usuário, região `us-east-1`, PostgreSQL 17.11. Custo informado pelo conector: US$ 0/mês.
- Aplicado no destino: `01-estrutura.sql`, registrado como `jubarte_estrutura_independente`. Confirmadas sete tabelas com RLS, sete políticas e as 49 constraints esperadas.
- Snapshot privado capturado em SELECT único: 1 membro, 1 conta, 19 categorias, 1 devedor e 1 empréstimo; zero lançamentos e recebimentos. Dados e configuração anterior guardados em `.migration-private/`, excluído do Git e com acesso restrito.
- **Carga real concluída:** as sete tabelas foram importadas em uma transação. A comparação integral confirmou todos os registros/colunas, preservando os UUIDs financeiros e substituindo somente `user_id` pelo mapa privado.
- Auth configurado: e-mail/senha habilitados, cadastro público desabilitado, URLs de retorno local e Pages cadastradas. Conta independente criada pelo endpoint administrativo oficial, com senha nova, sem copiar hashes/sessões da origem. Credenciais ficam em `.migration-private/login.json`; mapa em `uid-map.json`.
- Os seis triggers foram instalados após a carga, registrados em `jubarte_finalizacao_independente`. EXECUTE foi revogado de PUBLIC/anon/authenticated nas funções internas; apenas authenticated pode chamar o RPC de autorização.
- `.env.local` agora usa a nova URL/chave pública. Build regenerado e conferido: contém a URL do destino e não contém a URL da origem. Nenhuma alteração no código de negócio foi necessária.
- Publicação: **adiada por escolha do usuário**. As variáveis do GitHub Pages não foram alteradas e nenhum deploy foi executado; a publicação existente continua com sua configuração anterior.

## Artefatos e próxima execução

Os scripts estão em `supabase/migration-tools/`: exportação, estrutura, importação com mapa de UIDs, finalização de triggers/ACL, comparação exata dos dados, configuração Auth e smoke de login/API. As migrações históricas não foram alteradas. O mapa altera somente `user_id`; todos os UUIDs financeiros são preservados.

Sequência executada após disponibilização do token temporário em `.migration-private/admin.env`:

1. Executar `configurar-auth.mjs`, que configura e-mail/senha, desabilita cadastro público, define redirects e cria uma conta independente com senha nova. O usuário da origem permanece intacto.
2. Gerar o SQL privado com `preparar-carga.mjs`; executar `import.sql` **somente no destino**, depois `03-finalizacao.sql` e `validate.sql`. Não repetir 01: a estrutura já existe.
3. Executar `smoke-api.mjs`; comparar o snapshot com a origem antes do corte para confirmar que não houve mudanças.
4. Atualizar `.env.local`, executar build e conferir a URL de destino no bundle. A atualização das variáveis e publicação no GitHub Pages ficou fora desta execução, conforme orientação posterior do usuário.

Não repetir a importação em tabelas preenchidas: o script interrompe em vez de apagar ou sobrescrever registros. Não executar seeds após a cópia.

## Verificações realizadas

- Ensaio PGlite da estrutura → remapeamento/carga → finalização → validação: passou com fixtures fictícias, incluindo arquivamento e empréstimo fechado com recebimento excedente. Comparação exata de conteúdo/UUIDs, RLS, constraints e ACLs aprovada.
- `npm test`: 31/31 passaram.
- `npm run build`: passou; avisos existentes de anotações Zod e tamanho de chunks.
- Sintaxe dos scripts Node: aprovada com `node --check`.
- `git diff --check`: passou. Nenhum commit ou push realizado.
- Origem relida antes da carga: conteúdo idêntico ao snapshot privado, sem gravações pelo agente.
- `04-validar.sql` no destino: comparação exata de dados/UUIDs, contagens, RLS, políticas, constraints, índices, triggers e ACLs passou; repetida após os testes para confirmar ausência de resíduos.
- `smoke-api.mjs`: login real, autorização, leitura das sete tabelas, bloqueio anônimo, criação/consulta/alteração/remoção de um devedor temporário e logout passaram.
- `05-smoke-transacional.sql`: contas, categoria, lançamento, transferência, devedor, empréstimo, recebimentos excedentes em contas distintas, fechamento/reabertura e bloqueio de não membro passaram sob role authenticated. A transação foi revertida integralmente.
- Build com a conexão de destino: passou. O runtime continua sendo Node 26.13.0; não foi executado novamente o CI Node 22.
- `smoke-browser.mjs`: login na interface, seis tabelas de domínio carregadas, conta migrada visível, sessão após recarregar e logout passaram. Requisições Supabase exclusivamente ao destino, sem erros de execução no navegador. **Jubarte local funcionando no novo projeto.**
- **Não testados:** entrega de e-mail de recuperação e GitHub Pages no destino. SMTP personalizado não foi configurado.

O verificador de segurança apontou dois avisos: RPC `jubarte_is_authorized()` SECURITY DEFINER acessível a authenticated (intencional, limitado ao UID da sessão) e proteção contra senhas vazadas desativada. Não foram observados alertas de RLS ausente. Referências: [RPC SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Uso local

Execute `npm run dev` e abra `http://localhost:5173/jubarte/`. Use o e-mail e a senha nova de `.migration-private/login.json`; a senha antiga da origem não foi migrada. O token administrativo temporário pode ser revogado no painel Supabase após a conclusão.

As guardas SQL de Project Ref verificam os parâmetros declarados, não identificam por si só o servidor conectado. Nesta execução o destino foi selecionado explicitamente em cada chamada do conector (`project_id=omduuwlmkyfdupzgqtpq`). Não enviar esses scripts a outra conexão presumindo que os parâmetros a protegem.

## Retorno

A configuração original está no backup privado `origin.env`; a origem segue intacta. Antes de liberar escrita no destino, basta manter a configuração original. Depois de gravar dados exclusivos no destino, preservar ambos os estados e reconciliar diferenças antes de retornar; trocar apenas a URL pode perder alterações.

## Orquestração

Subagentes GPT-6 Luna: SQL e ensaio (High), configuração da aplicação (Medium). O principal revisou os scripts e executou as ações remotas. O modelo do principal não foi alterado pela sessão.
