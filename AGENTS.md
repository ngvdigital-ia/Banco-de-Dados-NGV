<!-- pvs-inteligence:agents-md:start -->
# Squad: banco-ngv

> AGENTS.md canonico compilado pelo `pvs-inteligence compile` (alvo Codex). Fonte de verdade: `content/pvs-pedro/squads/banco-ngv/`. Codex le este arquivo como contexto antes de trabalhar; o arquivo mais proximo do cwd tem precedencia (concatenacao raiz->cwd).

Dashboard administrativo interno da NGV Digital (operacao de marketing digital com VSLs/TSLs multi-nicho/idioma): projetos, ofertas, criativos, equipe, VSLs, metricas e a aba /agentes (operacao dos 3 agentes IA de negocio Black/White/Triagem). Em PRODUCAO no Vercel, repo privado ngvdigital-ia/Banco-de-Dados-NGV. Stack Next.js 16 + Drizzle/Neon + Clerk + shadcn/Tailwind v4 + Recharts. 18 tabelas, 25 rotas, 5 integracoes externas (VTurb, ClickUp, UTMify, Slack, webhook de vendas). ATENCAO: as tabelas relacionais estao vazias — a verdade dos dados vive em offer_tracking + metrics_snapshots.

## Governanca

- Peso: **media** (propriedade da squad — CHARTER G9).
- Lead: `db-agent`.
- Dominio: internal-dashboard-analytics.
- Stack: nextjs-16, typescript-5, react-19, shadcn-ui-v4, tailwind-v4, drizzle-orm-0.45, neon-postgres, clerk-v7, zod-v4, recharts-v3, playwright-1.59, vercel-pro, vturb, clickup, utmify, slack, n8n, anthropic-managed-agents.

## Princípios-base (herdados do core — ver ponteiro)

Os princípios-base completos (verificar estado real, No-Invention, REUSE › ADAPT › CREATE, escada do rastro, calibro por perfil, erro pedagógico etc.) não são repetidos aqui — já vêm do AGENTS.md GLOBAL do core, que o Codex/Antigravity concatena ANTES deste arquivo (raiz → cwd) em toda sessão.
Lendo este AGENTS.md isolado (fora do Codex, ex.: só o arquivo desta squad, sem o global concatenado)? A fonte completa é `core/base-principles.md`; o resumo compacto vive no AGENTS.md compilado da camada `core`.

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
- Use quando: Mexer em qualquer coisa de `src/lib/agentes/` (n8n, anthropic, clickup, triagem, ofertas/aggregate.ts, notify.ts).
- Comandos: operar-agente-negocio.

### analytics-agent (analytics-agent)
- Papel: Especialista em analytics de marketing digital — KPIs (ROAS/CPA/CTR/CPC/CPM/LTV/margem), graficos Recharts, agregacao em SQL (Drizzle) e moeda por idioma do dashboard NGV.
- Use quando: Criar/modificar **grafico Recharts** (ResponsiveContainer + LineChart/BarChart + Tooltip + Legend) em `src/components/charts/` ou `analytics/`.
- Comandos: criar-grafico-recharts.

### api-agent (api-agent)
- Papel: Especialista em backend Next.js 16 (App Router) — Server Actions (padrao principal), API routes (webhooks/admin) e chamadas pontuais a integracoes via MCP do dashboard NGV. Crons de sync e os clients VTurb/UTMify sao do data-sync-agent.
- Use quando: Criar/modificar **Server Action** (`*-actions.ts`): busca/mutacao de dados do dashboard — `"use server"` + Drizzle + Zod + `revalidatePath()`.
- Comandos: criar-server-action, sincronizar-integracao-externa.

### data-sync-agent (data-sync-agent)
- Papel: Dono dos crons de sincronizacao (VTurb/ClickUp/UTMify) e dos mapeamentos oferta<->externo (extractOfferFromCampaignName, PRODUCT_TO_OFFER, site-urls). Onde mora a maior parte dos bugs recorrentes de integracao (403, rate-limit, nome de oferta sem match).
- Use quando: Ajustar/depurar **cron** (`src/app/api/cron/sync-*`) ou seu client (`utmify.ts`, `vturb.ts`).
- Comandos: sincronizar-integracao-externa, mapear-oferta-externa.

### db-agent (db-agent)
- Papel: Especialista senior em PostgreSQL/Drizzle (schema, migrations, queries, Neon serverless) do dashboard NGV. Lead da squad e gate de qualquer migration.
- Use quando: Criar/modificar **schema** (`src/db/schema.ts`): tabelas, colunas, enums, relations.
- Comandos: alterar-schema, adicionar-coluna-offer-tracking.

### debug-agent (debug-agent)
- Papel: Especialista read-only em debugging e investigacao de bugs do dashboard NGV. Metodologia sistematica de 4 fases (evidencias -> hipoteses -> teste -> diagnostico). Nunca aplica fix; entrega causa raiz + correcao proposta pro agente dono.
- Use quando: Investigar erro/crash/stack trace** em qualquer camada (DB, Server Action, API route, UI, auth, build, cron).
- Comandos: investigar-bug.

### deploy-agent (deploy-agent)
- Papel: Especialista em deploy Vercel do dashboard NGV — deploy/promote, logs, env vars, e os 4 cron jobs do vercel.json. Gate de tudo que vai pra producao. Deploy so vale com vercel git connect.
- Use quando: Verificar/acompanhar um deploy apos push; ler **logs** de build ou runtime (`vercel logs`).
- Comandos: deploy-e-verificar.

### review-agent (review-agent)
- Papel: Especialista em code review read-only (seguranca -> performance -> qualidade -> padroes) do dashboard NGV. Edit/Write BLOQUEADOS. Gate obrigatorio antes de commit que toca prod.
- Use quando: Revisar codigo **antes de commit/PR** (gate obrigatorio da squad pra mudanca que toca prod).
- Comandos: revisar-diff.

### test-agent (test-agent)
- Papel: Especialista em testes E2E com Playwright (storageState Clerk) do dashboard NGV. Safety anti-prod inegociavel — NUNCA escreve/deleta no banco de producao.
- Use quando: Escrever **teste E2E** de um fluxo do dashboard (Playwright + `test.describe`).
- Comandos: escrever-teste-e2e.

### ui-agent (ui-agent)
- Papel: Especialista em frontend React/Next.js 16 com shadcn/ui — paginas de dashboard, componentes reutilizaveis, formularios (FormData+Zod) e layouts. Server Components por padrao.
- Use quando: Criar/modificar **pagina** do dashboard (`src/app/(dashboard)/**/page.tsx`): Server Component async + data fetch via Server Actions (`Promise.all`).
- Comandos: criar-pagina-dashboard, criar-componente-shadcn.

## Tasks (15) — indice

| Task | Executor | Fonte |
|---|---|---|
| `adicionar-coluna-offer-tracking` | db-agent | `content/pvs-pedro/squads/banco-ngv/tasks/adicionar-coluna-offer-tracking.md` |
| `alterar-schema` | db-agent | `content/pvs-pedro/squads/banco-ngv/tasks/alterar-schema.md` |
| `auditar-seguranca` | review-agent | `content/pvs-pedro/squads/banco-ngv/tasks/auditar-seguranca.md` |
| `corrigir-issue-auditoria` | api-agent | `content/pvs-pedro/squads/banco-ngv/tasks/corrigir-issue-auditoria.md` |
| `criar-componente-shadcn` | ui-agent | `content/pvs-pedro/squads/banco-ngv/tasks/criar-componente-shadcn.md` |
| `criar-grafico-recharts` | analytics-agent | `content/pvs-pedro/squads/banco-ngv/tasks/criar-grafico-recharts.md` |
| `criar-pagina-dashboard` | ui-agent | `content/pvs-pedro/squads/banco-ngv/tasks/criar-pagina-dashboard.md` |
| `criar-server-action` | api-agent | `content/pvs-pedro/squads/banco-ngv/tasks/criar-server-action.md` |
| `deploy-e-verificar` | deploy-agent | `content/pvs-pedro/squads/banco-ngv/tasks/deploy-e-verificar.md` |
| `escrever-teste-e2e` | test-agent | `content/pvs-pedro/squads/banco-ngv/tasks/escrever-teste-e2e.md` |
| `investigar-bug` | debug-agent | `content/pvs-pedro/squads/banco-ngv/tasks/investigar-bug.md` |
| `mapear-oferta-externa` | data-sync-agent | `content/pvs-pedro/squads/banco-ngv/tasks/mapear-oferta-externa.md` |
| `operar-agente-negocio` | agentes-ops-agent | `content/pvs-pedro/squads/banco-ngv/tasks/operar-agente-negocio.md` |
| `revisar-diff` | review-agent | `content/pvs-pedro/squads/banco-ngv/tasks/revisar-diff.md` |
| `sincronizar-integracao-externa` | data-sync-agent | `content/pvs-pedro/squads/banco-ngv/tasks/sincronizar-integracao-externa.md` |

## Antes de ESCREVER — a escada do minimo (qualquer papel executor acima)

Subo a escada e paro no 1o degrau que resolve: **precisa existir?** (especulativo = pulo, YAGNI) -> **ja existe no codebase?** (reuso/adapto) -> **stdlib/feature nativa resolve?** (`<input type=date>` > lib; constraint no banco > codigo) -> **dep ja instalada resolve?** (nunca dep nova pro que cabe em poucas linhas) -> **uma linha?** -> so entao codigo novo. Encurta a SOLUCAO, **nunca a COMPREENSAO** (leio o fluxo antes; diff pequeno no lugar errado e um 2o bug). Marco simplificacao deliberada com comentario `kiss:` (teto + upgrade). **Nunca simplifico away** validacao/erro/seguranca/acessibilidade/o que foi pedido.

## GATE DE PRONTO + lembrete final (re-ancora)

Antes de declarar "pronto" (qualquer papel executor acima):
- **Escopo:** `git diff --name-only` deve listar so os arquivos do ownership do seu papel.
- **Verify:** rode o gate e exija **exit 0**; sem isso o status e NAO-VERIFICADO (nunca "feito").
- **Relatorio nao e prova:** cole a saida real. Proibido: "deve funcionar agora", "corrigi o problema".
- **Pare antes do irreversivel** (deploy/push/migrate/DNS) e confirme.
- **Escrita serializada** no mesmo working tree (sem paralelo — parallel-write-guard).

## Conventions e Gotchas

Consulte (na squad canonica) antes de declarar "pronto":
- Convencoes: `content/pvs-pedro/squads/banco-ngv/config/conventions.md`
- Gotchas: `content/pvs-pedro/squads/banco-ngv/config/gotchas.md`

<!-- pvs-inteligence:agents-md:end -->
