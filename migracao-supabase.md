# Migração do Jubarte para um projeto Supabase independente

## Papel

Atue como um arquiteto de software sênior, especialista em PostgreSQL, Supabase, migração de bancos de dados, autenticação, segurança e desenvolvimento de aplicações.

## Contexto

Atualmente, o Jubarte utiliza um projeto Supabase compartilhado com outras aplicações pessoais de estudo.

**Projeto Supabase de origem:**

- Project ID: `ytaafzzgstwmnozsdfcw`
- PostgreSQL 17
- Schema principal: `public`
- Tabelas do Jubarte identificadas pelo prefixo `jubarte_`

O objetivo é migrar o Jubarte para um novo projeto Supabase independente, preservando as demais aplicações no projeto original.

O projeto de destino ainda poderá precisar ser criado.

Esta migração também tem finalidade educacional. Portanto, documente as decisões técnicas, os riscos e os procedimentos de forma objetiva.

## Objetivo

Preparar e executar, mediante autorização, a migração completa do Jubarte, incluindo:

- Estrutura do banco de dados.
- Dados existentes.
- Chaves primárias e estrangeiras.
- Índices e constraints.
- Funções, triggers e sequences, quando aplicáveis.
- Políticas Row Level Security (RLS).
- Dependências do Supabase Auth.
- Configurações de Storage, se utilizadas.
- Configurações de conexão e autenticação da aplicação.
- Validação funcional e integridade dos dados.

## Etapa 1 — Discovery e inventário

Inspecione o repositório e, se houver acesso autorizado, o projeto Supabase de origem.

Identifique:

1. Todas as tabelas `jubarte_*`.
2. Relacionamentos internos e externos.
3. Dependências de `auth.users`.
4. Políticas RLS existentes.
5. Funções, triggers, índices e constraints.
6. Uso de Supabase Auth e Storage.
7. Variáveis de ambiente e configurações de conexão.
8. Consultas SQL, APIs e componentes que dependem da estrutura atual.
9. Eventuais recursos compartilhados com outras aplicações.

Não presuma que o prefixo `jubarte_` identifica todas as dependências. Verifique o banco e o código.

Apresente um inventário completo antes de qualquer operação remota.

## Etapa 2 — Planejamento

Elabore um plano de migração contendo:

- Estratégia de criação do projeto de destino.
- Ordem de criação dos objetos PostgreSQL.
- Estratégia de transferência dos dados.
- Tratamento dos usuários do Supabase Auth.
- Preservação ou remapeamento dos UUIDs.
- Estratégia para políticas RLS.
- Atualização das configurações da aplicação.
- Testes de integridade e segurança.
- Procedimento de rollback.
- Critérios objetivos para considerar a migração concluída.

Avalie se é mais seguro preservar as identidades dos usuários ou recriá-las no destino e remapear suas referências.

Não migre credenciais, sessões ou informações sensíveis sem necessidade e autorização.

## Etapa 3 — Preparação técnica

Após concluir o planejamento:

1. Prepare scripts SQL versionados para criação das estruturas.
2. Prepare scripts ou procedimentos de transferência dos dados.
3. Prepare consultas para validação de contagens, integridade referencial e permissões.
4. Prepare as alterações necessárias no código do Jubarte.
5. Organize os arquivos de forma compatível com a estrutura existente do repositório.
6. Documente a execução e os procedimentos de recuperação.

Utilize preferencialmente ferramentas oficiais do Supabase e PostgreSQL.

Não inclua senhas, tokens, connection strings com credenciais ou chaves secretas em arquivos versionados.

## Etapa 4 — Execução controlada

A migração deverá seguir esta ordem:

1. Criar ou configurar o projeto de destino.
2. Aplicar a estrutura PostgreSQL.
3. Configurar a autenticação necessária.
4. Transferir os dados.
5. Configurar e validar as políticas RLS.
6. Atualizar as variáveis de ambiente do Jubarte.
7. Executar os testes funcionais e de integridade.
8. Confirmar que a aplicação utiliza exclusivamente o novo projeto.

**Não execute nenhuma alteração remota sem minha autorização explícita.**

Solicite aprovação antes de cada etapa que modifique bancos, usuários, configurações ou recursos remotos.

## Etapa 5 — Proteção das demais aplicações

Migre exclusivamente as estruturas e os dados pertencentes ao Jubarte para o novo projeto Supabase.

Não altere nem exclua tabelas, dados, usuários, políticas RLS ou configurações das demais aplicações existentes no projeto de origem.

Identifique previamente qualquer dependência compartilhada e solicite autorização antes de modificá-la.

Considere especialmente que `auth.users` pode conter usuários utilizados por outras aplicações.

Não altere configurações globais do projeto de origem sem analisar o impacto sobre as demais aplicações.

**É proibido excluir qualquer tabela ou dado do projeto de origem durante a migração, inclusive os pertencentes ao Jubarte.**

A eventual limpeza do banco original será tratada como uma atividade futura, separada, somente após a migração estar concluída e validada.

## Etapa 6 — Testes e validação

Verifique:

- Correspondência entre os registros de origem e destino.
- Integridade de chaves estrangeiras.
- Funcionamento do login e logout.
- Isolamento dos dados por usuário.
- Políticas RLS e tentativas de acesso não autorizado.
- Operações de criação, consulta, atualização e exclusão.
- Funcionalidades de contas, categorias, lançamentos, empréstimos e recebimentos.
- Ausência de dependências indevidas do Supabase original.
- Ausência de regressões na aplicação.

Execute testes automatizados disponíveis e informe os resultados.

Não considere a migração concluída apenas porque as tabelas foram copiadas.

## Etapa 7 — Documentação e rollback

Produza documentação contendo:

- Inventário inicial.
- Arquitetura antes e depois da migração.
- Scripts e ordem de execução.
- Configurações necessárias.
- Estratégia adotada para usuários e autenticação.
- Resultados dos testes.
- Problemas encontrados e soluções.
- Procedimento de rollback.

O rollback deverá permitir retornar a aplicação ao projeto original, considerando eventuais dados gravados no destino após a migração.

Não prometa rollback sem perda de dados se não houver estratégia comprovada de reconciliação.

## Restrições obrigatórias

- Não excluir dados ou estruturas na origem.
- Não alterar outras aplicações.
- Não executar operações remotas sem autorização.
- Não fazer commit ou push sem autorização.
- Não expor credenciais.
- Não desabilitar RLS como solução para problemas de acesso.
- Não presumir que a migração foi bem-sucedida sem testes.
- Não modificar desnecessariamente a arquitetura da aplicação.
- Priorizar simplicidade, segurança e rastreabilidade.

## Forma de trabalho

Trabalhe de maneira autônoma nas atividades locais de leitura, análise, preparação de scripts, documentação e testes que não modifiquem ambientes remotos.

Evite perguntas desnecessárias quando a resposta puder ser obtida pela inspeção do repositório ou das configurações disponíveis.

Interrompa a execução e solicite autorização quando houver necessidade de alterar recursos remotos ou tomar uma decisão que possa causar perda de dados.

## Primeira entrega esperada

Comece imediatamente pelo discovery.

Apresente:

1. Inventário dos componentes do Jubarte.
2. Dependências compartilhadas e riscos.
3. Estratégia recomendada de migração.
4. Arquivos que precisarão ser criados ou alterados.
5. Plano de execução e validação.

**Não inicie a migração remota até que eu aprove o planejamento.**

## Orquestração com subagentes

Utilize o GPT-6.1 Sol Medium como agente principal, responsável pelo planejamento, coordenação, revisão e consolidação da migração.

Sempre que o ambiente Codex permitir, delegue tarefas independentes e bem delimitadas a subagentes GPT-6 Luna, priorizando:

- Inventário de referências às tabelas `jubarte_*` no código.
- Identificação de variáveis de ambiente e configurações Supabase.
- Levantamento de dependências e relacionamentos.
- Revisão estática dos scripts SQL.
- Análise dos testes existentes.
- Preparação de documentação técnica.

Utilize esforço Medium para tarefas simples e High quando houver análise mais complexa, se a configuração permitir.

Execute tarefas independentes em paralelo quando isso trouxer benefício real, evitando duplicação de trabalho.

O agente principal deverá revisar criticamente os resultados dos subagentes, resolver inconsistências e consolidar as conclusões.

Os subagentes não estão autorizados a modificar bancos remotos, excluir dados, alterar credenciais, executar deploys ou realizar commits e pushes.

Caso o ambiente não permita selecionar modelos específicos para subagentes, utilize a configuração disponível e informe a limitação. Não afirme ter utilizado um modelo que não foi efetivamente selecionado.

A responsabilidade final pelas decisões e pela validação permanece com o agente principal.
