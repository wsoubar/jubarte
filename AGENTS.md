# Orientações para agentes

Responda e escreva documentação e textos da interface em português do Brasil. Preserve os nomes técnicos existentes no código.

## Projeto e estrutura

O Jubarte é um aplicativo de controle financeiro pessoal com React 19, TypeScript estrito, Vite, Tailwind CSS 4 e Supabase. Preserve o tema claro, a identidade azul oceano/turquesa e a responsividade.

- `src/App.tsx`: navegação, páginas e integração da interface.
- `src/finance.ts` e `src/types.ts`: cálculos financeiros e tipos do domínio.
- `src/Auth.tsx`, `src/supabase.ts` e `src/data.ts`: autenticação, cliente e consultas.
- `src/forms.tsx`, `src/components/ui/` e `src/styles.css`: formulários, componentes reutilizáveis e estilos.
- `src/demo.ts`: demonstração fictícia em memória; `src/report.tsx`: geração local de PDFs.
- `src/*.test.ts`: testes de cálculos e banco com Vitest/PGlite; `e2e/`: testes Playwright.
- `supabase/migrations/`: SQL; `.github/workflows/`: verificação e publicação no GitHub Pages.

## Preparação e comandos

Use Node.js 22.12+ ou 24 e npm com `package-lock.json`.

```sh
npm ci
cp .env.example .env.local # apenas se o arquivo local ainda não existir
npm run dev
npm test
npm run test:e2e
npm run build
```

`npm run preview` serve o build. `npm run format` aplica Prettier a vários diretórios; evite reformatações alheias à tarefa. Não existe script de lint. Siga o estilo existente: dois espaços, aspas duplas, ponto e vírgula e componentes funcionais.

O Playwright usa `/usr/bin/chromium` localmente e o navegador instalado pelo Playwright no CI. Informe bloqueios de ambiente e distinga testes locais de validação real no Supabase.

## Contratos que devem ser preservados

- Valores monetários inteiros em centavos, exclusivamente BRL; datas de calendário e dia atual em `America/Sao_Paulo`.
- Realizado considera pagamento; projeção inclui pendências. Transferências são atômicas e não integram receitas/despesas.
- Arquivamento preserva histórico. Mantenha cálculos e validações coerentes entre interface, domínio e SQL.
- Demonstração permanece em memória, sem persistir dados financeiros no `localStorage`.
- Preserve `base: "/jubarte/"` e `HashRouter` para compatibilidade com GitHub Pages.

## Segurança e entrega

O Supabase é compartilhado: use objetos `jubarte_`, preserve outros aplicativos e nunca execute `supabase db reset`. Preserve RLS, autorização por `jubarte_members` e isolamento por usuário. Nunca exponha chaves secretas ou `service_role` em variáveis `VITE_*` ou no repositório.

Consulte o `README.md` antes de alterar migrações, configuração ou publicação. Para mudanças funcionais, execute testes pertinentes e build; ajuste testes quando regras mudarem. Revise o diff e relate verificações realizadas e etapas externas pendentes. Não faça commit ou push sem solicitação explícita.
