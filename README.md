# Jubarte 🐋

Controle financeiro pessoal em português do Brasil, com temas claro e escuro, React, Vite, TypeScript, Tailwind CSS, componentes baseados em shadcn/ui e Supabase. Identidade: azul oceano, turquesa e uma baleia jubarte saltando.

## O que está incluído

- Login e recuperação de senha; somente usuários autorizados têm acesso aos dados.
- Contas com saldo inicial, categorias, lançamentos manuais e transferências atômicas.
- Pagamentos e pendências, saldo realizado e projetado, filtros e paginação.
- Dashboard, comparativos mensais e relatórios PDF com gráficos e detalhamento.
- Layout responsivo e demonstração em memória, separada dos dados reais.
- Devedores (pessoas/empresas), empréstimos, recebimentos livres e fechamento manual, integrados aos saldos das contas.

## Executar

Node.js 22.12+ (ou 24) e npm:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Sem variáveis, o aplicativo permite explorar uma demonstração fictícia. As alterações da demonstração são descartadas ao recarregar/sair; nenhum dado real fica no localStorage. Sessões de autenticação seguem o armazenamento padrão do Supabase.

```sh
npm test
npm run test:e2e
npm run build
npm run preview
```

Os testes de navegador usam Chromium em `/usr/bin/chromium` localmente; no CI, instalam o navegador do Playwright. Para outro sistema, ajuste `executablePath` em `playwright.config.ts`.

## Configurar Supabase compartilhado

1. Faça um backup do projeto e revise a migração `supabase/migrations/202610300001_jubarte.sql`.
2. Execute essa migração **uma única vez**, como proprietário, no SQL Editor do Supabase. Em seguida, execute também `supabase/migrations/202610310001_jubarte_loans.sql`, uma única vez. Elas usam exclusivamente objetos com prefixo `jubarte_` no schema `public`, sem alterar dados, tabelas ou configurações de outros aplicativos. Não execute `supabase db reset` neste projeto compartilhado.
3. Use um usuário de e-mail e senha já existente em **Authentication → Users**, ou crie-o pelo painel administrativo. Não há cadastro público na interface Jubarte. Não mude a configuração global de cadastros do projeto compartilhado.
4. Copie o UUID desse usuário e autorize-o pelo SQL Editor:

```sql
insert into public.jubarte_members (user_id)
values ('UUID-DO-USUARIO');
```

5. Preencha `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (chave publishable ou anon). Nunca use service_role, senha do banco ou chave secret no frontend, no GitHub ou nas variáveis VITE.
6. Em **Authentication → URL Configuration → Redirect URLs**, adicione `https://wsoubar.github.io/jubarte/` e, para desenvolvimento, `http://localhost:5173/jubarte/`. Preserve os endereços dos outros aplicativos. A recuperação informa explicitamente o destino; não é necessário trocar a Site URL global.
7. Confirme a configuração de envio de e-mails/SMTP do Supabase e faça o teste de recuperação com uma conta real.

A lista de membros é somente leitura para usuários autenticados e só permite ler o próprio registro. A inclusão de membros é administrativa. RLS protege todas as tabelas; referências compostas impedem associar contas/categorias de outro usuário. Transferência é uma única linha com origem e destino e, portanto, não pode ser gravada pela metade. Triggers também validam datas, tipos e uso de contas/categorias arquivadas.

Para revogar acesso:

```sql
delete from public.jubarte_members where user_id = 'UUID-DO-USUARIO';
```

Isso revoga acesso aos dados do Jubarte sem remover o usuário compartilhado do Supabase ou interferir nos outros aplicativos.

### Categorias iniciais por usuário

Na tela **Categorias**, use a busca por nome (com ou sem acentos) e combine os filtros de **Receitas/Despesas** e **Ativas/Arquivadas**. A contagem mostra os resultados encontrados; **Limpar filtros** restaura a listagem completa. Esses filtros não alteram os filtros de lançamentos e relatórios.

O arquivo [supabase/seeds/categorias_iniciais.sql](supabase/seeds/categorias_iniciais.sql) permite cadastrar categorias prontas para um usuário: Salário e Outras receitas; Moradia, Alimentação, Transporte, Saúde, Educação, Lazer e Outras despesas.

1. Aplique a migração e autorize o usuário em `jubarte_members`, conforme os passos acima.
2. Em **Authentication → Users**, copie o UUID do usuário que receberá as categorias.
3. Abra o arquivo SQL e preencha `usuario_uid text := 'SEU-UID';` com o UUID copiado, mantendo as aspas.
4. Execute o conteúdo completo no **SQL Editor** do mesmo projeto Supabase, como proprietário.
5. Recarregue a aplicação para visualizar as categorias.

O script apenas insere dados nas tabelas existentes; não execute novamente a migração para cadastrar categorias. Ele valida se o UID foi preenchido e se o usuário está autorizado em `jubarte_members`; ao concluir, emite uma mensagem `NOTICE` com a quantidade inserida.

O cadastro é opcional e manual, sem execução automática ao iniciar o aplicativo. Para outro usuário, repita com o UUID correspondente. O script preserva categorias existentes e insere apenas as que não possuem o mesmo nome e tipo para o usuário escolhido. Categorias arquivadas também contam como existentes e não são reativadas. É possível repetir a execução sequencialmente sem duplicar essas categorias; evite execuções simultâneas. A demonstração continua usando suas próprias categorias em memória.

### Categorias adicionais de receitas

Use [supabase/seeds/categorias_receitas.sql](supabase/seeds/categorias_receitas.sql) para cadastrar somente categorias de **Receita**: Salário, Pró-labore, Serviços e trabalhos extras, Vendas, Aluguéis, Rendimentos, Dividendos, Aposentadoria e pensão, Bônus e comissões, Presentes e doações, Reembolsos e Outras receitas.

No arquivo, substitua o valor em `usuario_uid text := 'SEU-UID';` pelo UUID do usuário autorizado e execute o conteúdo completo no **SQL Editor do Supabase**, como proprietário. Depois, recarregue o aplicativo. O script não exige repetir as migrações ou executar o seed inicial; preserva categorias e despesas existentes, não reativa arquivadas e não duplica receitas de mesmo nome para o usuário em execuções sequenciais. Pode ser usado mesmo que você já tenha executado `categorias_iniciais.sql`. Os recebimentos de empréstimos continuam no módulo **Devedores**, separados dessas receitas.

## Devedores e empréstimos

**Atualização de uma instalação existente:** faça backup e execute somente a nova migração [202610310001_jubarte_loans.sql](supabase/migrations/202610310001_jubarte_loans.sql), como proprietário no **SQL Editor do mesmo Supabase**, uma única vez. Não repita a migração inicial nem recrie as tabelas existentes. A nova migração cria `jubarte_debtors`, `jubarte_loans` e `jubarte_loan_receipts`, com RLS e referências por usuário, e adiciona uma validação às contas para proteger as datas de empréstimos/recebimentos. Os usuários já autorizados em `jubarte_members` continuam autorizados. Aplique antes de publicar esta versão e recarregue a aplicação após concluir.

Em **Devedores**, cadastre a pessoa ou empresa, telefone e observações opcionais. Selecione o devedor e use **Novo empréstimo** para informar valor, data da saída, conta de saída, vencimento opcional e observações. Cada devedor pode ter vários empréstimos. Use **Registrar recebimento** para informar valor, data e conta de entrada: cada recebimento pode ir para uma conta diferente da saída e dos demais recebimentos.

Na **Visão geral**, o card **Emprestado a receber**, ao lado dos demais indicadores, mostra o saldo atual a receber dos empréstimos abertos. Ele considera todo o histórico, independentemente do período selecionado, e leva à área **Devedores** ao clicar. Fechados e excedentes não compensam pendências de outros empréstimos. O detalhamento completo permanece em **Devedores**.

- Não há cálculo de juros nem calendário automático de parcelas. São permitidos recebimentos parciais e valores excedentes: R$ 100 emprestados e duas entradas de R$ 60 resultam em R$ 120 recebidos e R$ 20 recebidos a mais.
- O fechamento é sempre manual, pela ação **Fechar empréstimo**, com data e observação opcionais. Pode ocorrer com qualquer valor recebido e não cria ajustes financeiros. Um empréstimo integralmente recebido permanece aberto até você fechá-lo.
- Empréstimos fechados com diferença mostram o valor **não recuperado**, separado do **a receber dos abertos**. O saldo a receber nunca fica negativo; excedentes aparecem como **recebido a mais**, sem compensar pendências de outros empréstimos. Vencimentos atrasados só sinalizam acordos abertos com valor pendente.
- **Reabrir empréstimo** permite corrigir ou adicionar recebimentos. Para alterar um empréstimo fechado ou seus recebimentos, reabra primeiro. A reabertura limpa a data e observação do fechamento atual, preservando as movimentações financeiras; não há trilha de auditoria de fechamentos anteriores.
- Edições e exclusões recalculam os saldos. Para excluir um empréstimo, exclua antes seus recebimentos; há confirmação nas exclusões. Arquivar o devedor preserva o histórico e permite continuar os recebimentos de acordos abertos, mas impede novos empréstimos até restaurá-lo.
- Saídas e recebimentos não podem estar no futuro ou antes do saldo inicial da conta; recebimentos não podem ser anteriores ao empréstimo. Contas arquivadas preservam o histórico, mas não podem ser escolhidas para novas movimentações.
- As movimentações são derivadas dos registros, sem duplicação em `jubarte_entries`. Aparecem identificadas no histórico, nos saldos, na evolução financeira e no PDF, separadas das receitas/despesas comuns. Vencimentos de empréstimos não criam previsões automáticas de entrada nas contas. Clique na movimentação para abrir o empréstimo correspondente.
- Busca por devedor, inclusão de arquivados e filtros de empréstimos abertos, fechados e atrasados estão disponíveis. Os totais do módulo consideram todo o histórico, independentemente dos filtros da listagem. A demonstração permite explorar os fluxos em memória, sem salvar dados reais.

Os testes locais validam cálculos, alterações de saldo, RLS e invariantes PostgreSQL com PGlite e fluxos de navegador com Playwright. A migração e o isolamento no Supabase remoto precisam ser confirmados após a aplicação administrativa.

## Publicar no GitHub Pages

1. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions → Variables**, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Execute **Actions → Verify and deploy Jubarte → Run workflow**, ou faça push em `main`.
4. O endereço esperado é **https://wsoubar.github.io/jubarte/**. O workflow verifica testes e build antes de publicar. Pull requests são verificados sem publicação.

As duas variáveis são públicas e fazem parte do bundle do navegador. A privacidade depende de autenticação e RLS, não de esconder essa chave. Sem as variáveis, a publicação funciona apenas como demonstração. O repositório e os arquivos estáticos são públicos; os dados financeiros permanecem no Supabase e só são consultados após login autorizado.

O projeto usa base `/jubarte/` e HashRouter (`#/relatorios`, por exemplo), compatíveis com recarregamento e links diretos no Pages. Para outro nome de repositório, ajuste `base` no Vite e os Redirect URLs.

## Regras financeiras

- Valores inteiros em centavos, exclusivamente BRL. Saldo inicial não negativo; limite por valor de R$ 1 bilhão.
- Datas financeiras são datas de calendário, sem conversão de fuso. O dia atual considera America/Sao_Paulo.
- Saldo realizado: saldo inicial + movimentações efetivadas até a data consultada. Uma conta ainda não iniciada tem saldo zero nessa data.
- Saldo previsto: realizado mais pendências vencidas ou a vencer até a data consultada.
- Receitas e despesas realizadas usam a **data de pagamento**; pendências usam **vencimento**. Uma movimentação já paga não é contada novamente como previsão.
- Transferências não compõem receitas e despesas e preservam o saldo consolidado.
- Empréstimos e recebimentos afetam os saldos, mas não compõem receitas e despesas comuns. O fechamento manual não altera o saldo das contas.
- Categorias, busca e situação filtram lançamentos/totais do relatório. Os saldos e a curva de evolução sempre representam o histórico integral das contas selecionadas, inclusive arquivadas.
- Alterar saldo/data inicial recalcula o histórico. A data inicial não pode ser posterior a movimentos existentes. Não há lançamento antes do início da conta nem pagamento no futuro.
- Arquivar oculta contas e categorias dos novos lançamentos, preservando histórico e relatórios. Não há exclusão de contas/categorias pela interface.
- PDFs são gerados no dispositivo, sem upload ou armazenamento no Supabase. O detalhe inclui a situação de cada lançamento e o comparativo usa valores efetivados.

## Verificação de acesso real

Após aplicar a migração, valide com usuários de teste:

- Sem login: nenhuma tabela Jubarte pode ser lida ou alterada.
- Autenticado sem registro em `jubarte_members`: RPC de autorização retorna falso; acesso bloqueado.
- Usuário autorizado A: pode acessar apenas seus registros.
- Usuário autorizado B: não pode ler, alterar ou relacionar contas, categorias e lançamentos de A.
- Usuários autenticados não conseguem incluir membros na lista de autorização.
- Recusa de categorias incompatíveis, valores inválidos, datas anteriores à conta e pagamento futuro, mesmo em chamadas diretas à API.

Testes locais cobrem cálculos, autorização SQL e invariantes do banco. Login real, e-mail e RLS no projeto compartilhado devem ser confirmados após fornecer conexão e aplicar a migração.

## Identidade visual

O tema claro é o padrão. Use o botão de sol/lua no topo (também disponível no login) ou **Configurações → Aparência → Claro/Escuro** para alternar. A preferência fica no `localStorage`, na chave `jubarte.theme`, e é aplicada antes da renderização para evitar um clarão ao recarregar. Ela vale para esse navegador, inclusive na demonstração, sem armazenar dados financeiros ou alterar o tema dos PDFs. Se o navegador bloquear armazenamento, a troca funciona durante a sessão, sem persistência ao recarregar.

`public/logo.png` é o símbolo original gerado para o Jubarte, com fundo transparente. A marca no aplicativo combina o símbolo com o nome Jubarte. O mesmo símbolo é usado como favicon e nos PDFs.

## Fora desta versão

Cartões/faturas, parcelas, recorrências, metas, orçamentos, investimentos, importação e Open Finance.

O histórico anterior Java/Maven permanece no Git; a substituição usa commits normais, sem reescrever histórico. Para reverter uma publicação, reverta o commit correspondente e deixe o workflow publicar novamente.
