<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:banco-ngv-squad (gerado por "fw compile banco-ngv"; canonico em C:/meu-framework/squads/banco-ngv — nao editar a mao) -->
# Squad: banco-ngv

> AGENTS.md canonico compilado pelo `fw compile` (visao de squad — compilada). Fonte de verdade: `C:/meu-framework/squads/banco-ngv/`. O agente principal le esta secao como contexto da squad antes de delegar.

Dashboard administrativo interno da NGV Digital (operacao de marketing digital com VSLs/TSLs multi-nicho/idioma): projetos, ofertas, criativos, equipe, VSLs, metricas e a aba /agentes (operacao dos 3 agentes IA de negocio Black/White/Triagem). Em PRODUCAO no Vercel, repo privado ngvdigital-ia/Banco-de-Dados-NGV. Stack Next.js 16 + Drizzle/Neon + Clerk + shadcn/Tailwind v4 + Recharts. 18 tabelas, 25 rotas, 5 integracoes externas (VTurb, ClickUp, UTMify, Slack, webhook de vendas). ATENCAO: as tabelas relacionais estao vazias — a verdade dos dados vive em offer_tracking + metrics_snapshots.

## Governanca

- Peso: **media** (propriedade da squad — CHARTER G9).
- Lead: `db-agent`.
- Dominio: internal-dashboard-analytics.
- Stack: nextjs-16, typescript-5, react-19, shadcn-ui-v4, tailwind-v4, drizzle-orm-0.45, neon-postgres, clerk-v7, zod-v4, recharts-v3, playwright-1.59, vercel-pro, vturb, clickup, utmify, slack, n8n, anthropic-managed-agents.

## Ownership (exclusividade por arquivo)

- `agentes-ops-agent` -> `src/lib/agentes/`, `src/app/(dashboard)/agentes/`, `src/app/api/agentes/`
- `analytics-agent` -> `src/app/(dashboard)/analytics/`, `src/app/(dashboard)/analytics/actions.ts`, `src/app/(dashboard)/metrics/`, `src/components/charts/`, `src/components/analytics/`
- `api-agent` -> `src/app/(dashboard)/**/*-actions.ts`, `src/app/api/webhooks/`, `src/app/api/admin/`
- `data-sync-agent` -> `src/app/api/cron/`, `src/lib/utmify.ts`, `src/lib/vturb.ts`, `src/lib/site-urls.ts`
- `db-agent` -> `src/db/schema.ts`, `src/db/index.ts`, `drizzle/`, `drizzle.config.ts`
- `deploy-agent` -> `vercel.json`, `.vercel/`
- `review-agent` -> `(read-only — nao escreve nenhum arquivo; revisa o diff/PR)`
- `test-agent` -> `tests/`, `playwright.config.ts`, `.auth/`
- `ui-agent` -> `src/app/(dashboard)/**/page.tsx`, `src/app/(dashboard)/**/layout.tsx`, `src/components/`, `src/components/ui/`, `src/components/offers/offer-table.tsx`

## Agentes (10)

### agentes-ops-agent (agentes-ops-agent)
- Papel: Especialista na aba /agentes — orquestracao dos agentes IA de negocio Black/White/Triagem (n8n + Anthropic Managed Agents + ClickUp + Slack + Groq). Dono do fluxo de agregacao, aprovacao/rejeicao e re-execucao do Black. Conhece os IDs PROD hardcoded e o gotcha da subtarefa "Traducao da VSL".
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Mexer em qualquer coisa de `src/lib/agentes/` (n8n, anthropic, clickup, triagem, ofertas/aggregate.ts, notify.ts).
- Comandos: operar-agente-negocio.

### analytics-agent (analytics-agent)
- Papel: Especialista em analytics de marketing digital — KPIs (ROAS/CPA/CTR/CPC/CPM/LTV/margem), graficos Recharts, agregacao em SQL (Drizzle) e moeda por idioma do dashboard NGV.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Criar/modificar **grafico Recharts** (ResponsiveContainer + LineChart/BarChart + Tooltip + Legend) em `src/components/charts/` ou `analytics/`.
- Comandos: criar-grafico-recharts.

### api-agent (api-agent)
- Papel: Especialista em backend Next.js 16 (App Router) — Server Actions (padrao principal), API routes (webhooks/admin) e chamadas pontuais a integracoes via MCP do dashboard NGV. Crons de sync e os clients VTurb/UTMify sao do data-sync-agent.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Criar/modificar **Server Action** (`*-actions.ts`): busca/mutacao de dados do dashboard — `"use server"` + Drizzle + Zod + `revalidatePath()`.
- Comandos: criar-server-action, sincronizar-integracao-externa.

### data-sync-agent (data-sync-agent)
- Papel: Dono dos crons de sincronizacao (VTurb/ClickUp/UTMify) e dos mapeamentos oferta<->externo (extractOfferFromCampaignName, PRODUCT_TO_OFFER, site-urls). Onde mora a maior parte dos bugs recorrentes de integracao (403, rate-limit, nome de oferta sem match).
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Ajustar/depurar **cron** (`src/app/api/cron/sync-*`) ou seu client (`utmify.ts`, `vturb.ts`).
- Comandos: sincronizar-integracao-externa, mapear-oferta-externa.

### db-agent (db-agent)
- Papel: Especialista senior em PostgreSQL/Drizzle (schema, migrations, queries, Neon serverless) do dashboard NGV. Lead da squad e gate de qualquer migration.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Criar/modificar **schema** (`src/db/schema.ts`): tabelas, colunas, enums, relations.
- Comandos: alterar-schema, adicionar-coluna-offer-tracking.

### debug-agent (debug-agent)
- Papel: Especialista read-only em debugging e investigacao de bugs do dashboard NGV. Metodologia sistematica de 4 fases (evidencias -> hipoteses -> teste -> diagnostico). Nunca aplica fix; entrega causa raiz + correcao proposta pro agente dono.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Investigar erro/crash/stack trace** em qualquer camada (DB, Server Action, API route, UI, auth, build, cron).
- Comandos: investigar-bug.

### deploy-agent (deploy-agent)
- Papel: Especialista em deploy Vercel do dashboard NGV — deploy/promote, logs, env vars, e os 4 cron jobs do vercel.json. Gate de tudo que vai pra producao. Deploy so vale com vercel git connect.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Verificar/acompanhar um deploy apos push; ler **logs** de build ou runtime (`vercel logs`).
- Comandos: deploy-e-verificar.

### review-agent (review-agent)
- Papel: Especialista em code review read-only (seguranca -> performance -> qualidade -> padroes) do dashboard NGV. Edit/Write BLOQUEADOS. Gate obrigatorio antes de commit que toca prod.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Revisar codigo **antes de commit/PR** (gate obrigatorio da squad pra mudanca que toca prod).
- Comandos: revisar-diff.

### test-agent (test-agent)
- Papel: Especialista em testes E2E com Playwright (storageState Clerk) do dashboard NGV. Safety anti-prod inegociavel — NUNCA escreve/deleta no banco de producao.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Escrever **teste E2E** de um fluxo do dashboard (Playwright + `test.describe`).
- Comandos: escrever-teste-e2e.

### ui-agent (ui-agent)
- Papel: Especialista em frontend React/Next.js 16 com shadcn/ui — paginas de dashboard, componentes reutilizaveis, formularios (FormData+Zod) e layouts. Server Components por padrao.
- Modelo recomendado: sonnet (nota: Codex e monolitico — sem model por agente).
- Use quando: Criar/modificar **pagina** do dashboard (`src/app/(dashboard)/**/page.tsx`): Server Component async + data fetch via Server Actions (`Promise.all`).
- Comandos: criar-pagina-dashboard, criar-componente-shadcn.

## Tasks (15) — referencia

| Task | Executor | Entrada | Saida |
|---|---|---|---|
| `adicionar-coluna-offer-tracking` | db-agent | nome e tipo da coluna nova em offer_tracking + valor default (ou se e nullable); se a coluna sera editavel inline na offer-table (entra no allowlist) ou so...; confirmacao do ambiente (NUNCA push direto em prod sem confirmacao humana) | coluna em offer_tracking (schema.ts) com .default() ou nullable; migration drizzle/NNNN_*.sql aplicada com seguranca; allowlist de updateOfferField atualizada (se editavel) + coluna na... |
| `alterar-schema` | db-agent | mudanca desejada no schema (nova tabela, coluna, enum, relation ou alteracao de...; se a mudanca e destrutiva (drop/alter de tipo que perde dado) ou aditiva; confirmacao do ambiente (NUNCA aplicar push direto em prod sem confirmacao... | src/db/schema.ts editado (tabela/coluna/enum/relation); drizzle/NNNN_*.sql (migration gerada por drizzle-kit generate); tipos Drizzle atualizados e batendo com o codigo consumidor |
| `auditar-seguranca` | review-agent | escopo (diff atual / area especifica / varredura completa do repo); se e pre-commit (gate de governanca) ou auditoria avulsa | report de findings por severidade (CRITICO/ALTO/MEDIO/BAIXO), arquivo+linha +...; confirmacao das categorias limpas; itens novos roteados pra... |
| `corrigir-issue-auditoria` | api-agent | numero/linha do item em docs/audit/PRIORITY-FIXES.md (ou SECURITY-AUDIT.md) a...; confirmacao de que o item ainda esta aberto (varios CRITICOS podem ja ter sido...; se o fix toca schema (db-agent gate) e/ou prod (review-agent gate) | codigo corrigido no arquivo apontado pela auditoria; item marcado/anotado como corrigido (referencia ao commit); diff revisado pelo review-agent antes do commit que toca prod |
| `criar-componente-shadcn` | ui-agent | o que o componente faz (form, dialog, tabela, filtro) e onde sera usado; quais primitivos de src/components/ui/ ja existem pra reusar (nao reinventar); se ha submit -> qual Server Action recebe o FormData | componente em src/components/<grupo>/<nome>.tsx (forms/, filters/, offers/,...; "use client" so se houver hooks/eventos; submit via FormData nativo + Zod no... |
| `criar-grafico-recharts` | analytics-agent | qual KPI/serie exibir (ROAS, CPA, CTR, spend x revenue, etc.) e dimensao (por...; de onde vem o dado agregado (Server Action de analytics; agregacao SEMPRE em...; idioma da oferta (define moeda: EN -> USD, demais -> BRL) | componente de grafico em src/components/charts/<nome>.tsx ("use client"); dado agregado via Server Action em SQL (nao agregar no frontend) |
| `criar-pagina-dashboard` | ui-agent | rota desejada dentro de (dashboard)/ + o que a pagina mostra (entidade, KPIs,...; de onde vem o dado (qual Server Action; criar com criar-server-action se nao...; se a pagina tem interatividade (filtros, form, edicao inline) que exija... | src/app/(dashboard)/<rota>/page.tsx (Server Component default); componentes client extraidos ("use client") so onde ha hooks/eventos; loading.tsx se a pagina agrega dado lento (opcional) |
| `criar-server-action` | api-agent | acao desejada (mutacao ou leitura): qual entidade, quais campos, qual rota...; schema atual da tabela alvo (ler src/db/schema.ts antes; pode ter mudado); se a action escreve em offer_tracking (cuidado com allowlist) ou em metrics... | funcao "use server" em src/app/(dashboard)/<rota>/<feature>-actions.ts; validacao Zod do input + try/catch + console.error + re-throw; revalidatePath() apos mutacao |
| `deploy-e-verificar` | deploy-agent | branch/commit pronto, ja revisado pelo review-agent (gate de governanca media); se e push pra prod (deploy automatico) ou preview; confirmacao humana pra qualquer deploy que toca prod (preferencia do Pedro) | push feito -> deploy automatico Vercel disparado; deploy verificado: build verde, preview/prod no ar, logs de cron/funcao sem... |
| `escrever-teste-e2e` | test-agent | fluxo a testar (rota, acao, resultado esperado) dentro de (dashboard)/; confirmacao de que DATABASE_URL aponta pra Neon branch/banco de TESTE (nunca...; storageState Clerk valido em .auth/user.json (sessao autenticada) | spec Playwright em tests/<fluxo>.spec.ts usando storageState; teste idempotente (sem lixo em prod; cleanup so em banco de teste) |
| `investigar-bug` | debug-agent | mensagem de erro completa (stack trace inteiro, nao so a 1a linha) ou descricao...; rota/tela/action onde acontece + se e prod ou local; se possivel, logs do console/terminal e o que mudou recentemente | diagnostico no formato fixo (Evidencias / Causa raiz / Correcao proposta /...; arquivo + linha da causa raiz; handoff pro agente dono do fix (db-agent / api-agent / ui-agent / etc.) — NUNCA... |
| `mapear-oferta-externa` | data-sync-agent | nome externo que nao esta batendo (player VTurb, produto UTMify ou campanha) +...; qual mapa atualizar: extractOfferName (VTurb), PRODUCT_TO_OFFER (UTMify),...; exemplos reais do nome como ele chega (case/sufixos) | mapa atualizado (knownOffers em extractOfferName, ou PRODUCT_TO_OFFER, ou regra...; oferta aparecendo corretamente no dashboard/analytics apos o sync |
| `operar-agente-negocio` | agentes-ops-agent | qual agente (Black / White) e qual acao (disparar, re-executar com feedback,...; task_id da oferta-MAE no ClickUp (o dashboard sempre manda o da mae); feedback (texto ou audio transcrito via Groq) quando for re-execucao por... | webhook do agente disparado com a subtarefa correta + feedback; ClickUp movido pra "Em ajustes" + comentario; Slack; approval gravado em agent_approvals |
| `revisar-diff` | review-agent | diff pronto pra commit (git diff / staged) que toca codigo de producao; contexto da mudanca (qual task/agente produziu, o que deveria fazer) | parecer de review por ordem seguranca -> perf -> qualidade -> padroes; veredito: APROVADO | BLOQUEADO (com issues CRITICO/ALTO listadas +... |
| `sincronizar-integracao-externa` | data-sync-agent | qual integracao (VTurb, ClickUp, UTMify, Slack, webhook de vendas) e o sintoma...; se e o cron (src/app/api/cron/) ou o client (src/lib/); confirmacao do ambiente (sync escreve em metrics_snapshots de PROD — nunca... | cron/client ajustado com tratamento de erro correto (403/rate-limit/timeout); sync nao falha o lote inteiro por causa de 1 item (log + continua); confirmacao de qual env var / header / param de data esta correto |

## Conventions e Gotchas

Consulte (na squad canonica) antes de declarar "pronto":
- Convencoes: `C:/meu-framework/squads/banco-ngv/config/conventions.md`
- Gotchas: `C:/meu-framework/squads/banco-ngv/config/gotchas.md`
<!-- END:banco-ngv-squad -->
