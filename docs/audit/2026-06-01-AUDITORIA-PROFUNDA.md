# Auditoria Profunda — banco-ngv

- **Data:** 2026-06-01
- **Método:** 8 auditores especializados (re-verificação do baseline 04/08 + varredura nova) → dedup → verificação adversarial → consolidação priorizada, executado via squad `banco-ngv`.
- **Totais:** 104 achados confirmados de 108 brutos (107 após dedup, 3 descartados na verificação adversarial).
- **Contagem por severidade:** 3 CRÍTICO · 26 ALTO · 45 MÉDIO · 30 BAIXO.

> **Nota de segurança deste documento:** o relatório-fonte continha valores reais de tokens e secrets (Vercel, ClickUp, Slack webhook, CRON_SECRET, GitHub PAT, Clerk). **Todos foram redigidos** — neste documento aparece apenas o **nome** da credencial, com o valor substituído por `[REDIGIDO]`. Nenhum valor real de token/secret/URL-de-webhook foi reproduzido aqui.

---

## Nota de consolidação

Há **duplicatas semânticas** no conjunto de 104 achados: vários auditores reportaram o mesmo problema com títulos/linhas ligeiramente diferentes. Na prática, os ~104 achados representam **~23 problemas únicos**. Os principais clusters de duplicação:

- **Índices ausentes em `metrics_snapshots`** — aparece como 1 CRÍTICO + 3 ALTO (`schema.ts`, `analytics/actions.ts` x2). Um único trabalho de migration cobre todos.
- **N+1 em `getAbTests`** — repetido em 1 ALTO + 2 MÉDIO + 1 BAIXO (mesma função, `ab-tests/actions.ts:8-18`).
- **`getTeamPerformance` full scan em `offerTracking`** — 1 ALTO + 2 MÉDIO + 1 BAIXO.
- **Queries sem `.limit()` (`getOffers`, `getProjects`, offers/page duplo)** — espalhado em ALTO/MÉDIO/BAIXO; mesmo padrão de risco "response too large".
- **Subqueries correlacionadas em `getOffersRanking`** — 1 ALTO + 1 MÉDIO (mesma função, contagem 7 vs 8).
- **Webhook de vendas fail-open (`SALES_WEBHOOK_SECRET`)** — 2 CRÍTICO idênticos.
- **PII no `rawPayload` do webhook de vendas** — 2 ALTO (sanitização + retenção/LGPD).
- **`importOfferTracking` insere em `projects` em vez de `offerTracking`** — 2 ALTO.
- **`triggerSync` / Server Actions de mutação sem auth** — 1 ALTO (agregado) + 1 MÉDIO (`triggerSync` específico).
- **`StatusBadge` UTMify hardcoded `connected={true}`** — 2 MÉDIO + parte de 1 BAIXO.
- **`DATABASE_URL!` sem validação runtime** — 1 MÉDIO + 1 BAIXO.
- **`buildCreativeConditions` definida mas nunca chamada** — 1 MÉDIO + 2 BAIXO (dead code).
- **`funnelNodes`/`orderBumps` sem `updatedAt`** — 1 MÉDIO + 1 BAIXO.
- **`team_role` enum sem `'suporte'` / migration 0000 desatualizada** — 2 MÉDIO.
- **`team_members.email` sem UNIQUE** — 1 MÉDIO (constraints agrupadas) + 1 MÉDIO específico.
- **Clientes HTTP de `/agentes` sem timeout** — 1 ALTO (clickup/n8n/anthropic) + itens individuais (re-execute, transcribe).
- **Dead code / unused vars do ESLint** — `EditorStatusDisplay`, `MultiPersonCell`, `SIGLA_TO_NAME`, `offerClicks`, imports de tabelas legacy, `hasAnyFilter`, `buildBaseFilters` etc. consolidam-se num único item de limpeza (`no-unused-vars`, ~45 warnings em 10 arquivos).
- **`useEffect` sem dep `load`** — reportado 2x como o mesmo conjunto de 5-6 arquivos.

Recomendação: tratar por **cluster** (não por linha), começando pelos índices de `metrics_snapshots` e pela auth do webhook/admin, que destravam vários achados de uma vez.

---

## CRÍTICO (3)

1. **Webhook de vendas aceita qualquer POST quando `SALES_WEBHOOK_SECRET` não está configurada** — `src/app/api/webhooks/sales/route.ts:44-48`
   - Fix: remover o `|| !expectedSecret`; sem a env var, retornar 500 (como o `google-sheets/route.ts` já faz) e configurar `SALES_WEBHOOK_SECRET` no Vercel.
   - Dono: `api-agent` · Baseline: **já-listado** (item-2)

2. **Webhook de vendas com fail-open: aceita qualquer POST e grava PII/vendas falsas em `metrics_snapshots`** — `src/app/api/webhooks/sales/route.ts:44-48`
   - Fix: configurar `SALES_WEBHOOK_SECRET` no Vercel, remover a cláusula `!expectedSecret` (retornar 500 se ausente) e adicionar ao `.env.example`.
   - Dono: `api-agent` · Baseline: **novo**

3. **`metrics_snapshots` sem nenhum índice — full scan garantido** — `src/db/schema.ts:362-394`
   - Fix: adicionar `index('ms_entity_date_idx').on(entityType, entityId, date)` e `index('ms_entity_type_idx').on(entityType)`; rodar `drizzle-kit generate` + push.
   - Dono: `db-agent` · Baseline: **novo**

---

## ALTO (26)

1. **Índices ausentes em todas as FKs e em `metrics_snapshots`** — `src/db/schema.ts:1-537`
   - Fix: índices em `metrics_snapshots(entity_type, entity_id)` e `(date)`, mais `creatives.project_id`, `vsls.project_id`, `campaigns.project_id`, `change_log(entity_type, entity_id)`.
   - Dono: `db-agent` · Baseline: **já-listado** (item-3)

2. **N+1 em `getAbTests` — query por variante para cada teste** — `src/app/(dashboard)/ab-tests/actions.ts:8-18`
   - Fix: buscar variants de uma vez com `inArray(...)` e agrupar em memória, ou usar JOIN.
   - Dono: `api-agent` · Baseline: **já-listado** (item-5)

3. **FKs sem `ON DELETE CASCADE` — race condition em deletes manuais** — `src/db/schema.ts:137,165,186,243,277,304,433`
   - Fix: `.references(() => ..., { onDelete: 'cascade' })` nas FKs de `abTestVariants`, `entityTags`, `alertHistory`; gerar migration.
   - Dono: `api-agent` · Baseline: **já-listado** (item-8)

4. **Subqueries correlacionadas em `getOffersRanking` — 7 por projeto** — `src/app/(dashboard)/analytics/actions.ts:500-508`
   - Fix: reescrever com LEFT JOINs + `GROUP BY` e `COUNT(*) FILTER (...)`.
   - Dono: `analytics-agent` · Baseline: **já-listado** (item-10)

5. **`rawPayload` com PII persistido integralmente no banco** — `src/app/api/webhooks/sales/route.ts:73-78`
   - Fix: remover `rawPayload` do `extraData`; persistir só campos não-PII se debug for necessário.
   - Dono: `api-agent` · Baseline: **já-listado** (item-11)

6. **`importOfferTracking` insere em `projects` em vez de `offerTracking`** — `src/app/(dashboard)/import/actions.ts:63-69`
   - Fix: reescrever para inserir em `offerTracking` com os campos mapeados corretos.
   - Dono: `api-agent` · Baseline: **já-listado** (item-27)

7. **Cinco rotas `/api/admin/*` sem auth de usuário (só CRON_SECRET)** — `src/middleware.ts:8`
   - Fix: remover `/api/admin(.*)` das rotas públicas e adicionar `requireAdmin()` em cada handler; **rotacionar `CRON_SECRET`** e tirá-lo do `settings.local.json`.
   - Dono: `api-agent` · Baseline: **novo**

8. **Server Actions de mutação sem verificação de auth** (`updateOfferField`, `deleteOffer`, `createOffer`, `importOffers`, `triggerSync`, `importMetrics`) — `offers/actions.ts:64`, `settings/actions.ts:7`, `import/actions.ts:7`
   - Fix: `const { userId } = await auth(); if (!userId) throw ...` no topo de cada action; `requireAdmin()` nas admin-only.
   - Dono: `api-agent` · Baseline: **novo**

9. **PII de compradores em `rawPayload` sem política de retenção/expurgo (LGPD)** — `src/app/api/webhooks/sales/route.ts:67-78`
   - Fix: remover `rawPayload`; cron de expurgo/anonimização após 90 dias; documentar finalidade e prazo.
   - Dono: `api-agent` · Baseline: **novo**

10. **Múltiplos secrets em `.claude/settings.local.json` sem proteção de gitignore** — `.claude/settings.local.json:36,51,59,62,70,85-86`
    - Tokens em texto plano no allowlist: **Vercel API token** `[REDIGIDO]`, **CRON_SECRET** `[REDIGIDO]`, **UTMIFY_API_KEY** `[REDIGIDO]`, **Slack webhook URL** `[REDIGIDO]`, **ClickUp personal token** `[REDIGIDO]`.
    - Fix: adicionar `.claude/settings.local.json` ao `.gitignore`; trocar tokens inline por refs a env vars; **rotacionar todos** os tokens expostos.
    - Dono: `deploy-agent` · Baseline: **novo**

11. **Sessão Clerk de produção (`.auth/user.json`) não está no `.gitignore`** — `.auth/user.json`
    - Fix: adicionar `.auth/` ao `.gitignore` (storageState de admin de produção do Playwright).
    - Dono: `test-agent` · Baseline: **novo**

12. **`deleteProject` sem cascade — FK violation em produção** — `src/app/(dashboard)/projects/actions.ts:88-92`
    - Fix: FKs `ON DELETE CASCADE` no schema + migration, ou delete manual dos filhos antes do pai.
    - Dono: `api-agent` · Baseline: **novo**

13. **`getOffers` sem `.limit()` — retorna a tabela inteira** — `src/app/(dashboard)/offers/actions.ts:44-50`
    - Fix: `.limit(200)` como default seguro; paginação por cursor se necessário.
    - Dono: `api-agent` · Baseline: **novo**

14. **`getTeamPerformance` carrega `offer_tracking` inteiro na memória** — `src/app/(dashboard)/analytics/actions.ts:283-286`
    - Fix: agregar em SQL com `GROUP BY`; no mínimo `.limit(500)` imediato.
    - Dono: `analytics-agent` · Baseline: **novo**

15. **Query de `clickup_task` em `metricsSnapshots` sem `.limit()`** — `src/app/(dashboard)/analytics/actions.ts:381-387`
    - Fix: `.limit(2000)` + usar índice `(entityType, date)` do finding CRÍTICO #3.
    - Dono: `analytics-agent` · Baseline: **novo**

16. **`getComparisonData`: até 8 queries sequenciais, sem `Promise.all`** — `src/app/(dashboard)/analytics/actions.ts:773-867`
    - Fix: agrupar queries independentes em `Promise.all`; member lookup antes do loop.
    - Dono: `analytics-agent` · Baseline: **novo**

17. **`getOfferCampaignSummary`/`getComparisonData`: `.limit(5000)` sem índice — full scan** — `src/app/(dashboard)/analytics/actions.ts:955-965 e 732-741`
    - Fix: índice composto `metrics_snapshots(entity_type, date DESC)` (handoff db-agent).
    - Dono: `db-agent` · Baseline: **novo**

18. **`entityType 'utmify_offer'` nunca é escrito — duas funções de leitura sempre vazias** — `src/app/(dashboard)/dashboard-actions.ts:165`
    - Fix: remover as funções/card e migrar para `getOfferCampaignSummary` (`utmify_campaign_daily`), ou adicionar path de escrita.
    - Dono: `data-sync-agent` · Baseline: **novo**

19. **`CAMPAIGN_OFFER_KEYWORDS` retorna 'Salomão' mas `PRODUCT_TO_OFFER` grava 'Salomao' — join falha** — `src/lib/utmify.ts:105-107 e 246-248`
    - Fix: unificar para a string canônica real em `offer_tracking.name` (provável 'Salomao').
    - Dono: `data-sync-agent` · Baseline: **novo**

20. **`Skyvault` (v minúsculo) vs `SkyVault` (V maiúsculo) — join falha por case** — `src/lib/utmify.ts:96-100 e 241-243`
    - Fix: alinhar `CAMPAIGN_OFFER_KEYWORDS` para 'SkyVault'.
    - Dono: `data-sync-agent` · Baseline: **novo**

21. **'Le Code de la Femme Irrésistible' (completo) vs 'Le Code de la Femme' — join falha** — `src/lib/utmify.ts:94-95 e 244-245`
    - Fix: corrigir `CAMPAIGN_OFFER_KEYWORDS` para 'Le Code de la Femme'.
    - Dono: `data-sync-agent` · Baseline: **novo**

22. **n8n sem timeout: até 400 chamadas simultâneas a `getExecution` podem travar `aggregateOfertas`** — `src/lib/agentes/n8n/executions.ts:93-120`
    - Fix: reduzir `limit` 200→50; `AbortSignal.timeout(8s)`; `Promise.all` nas 2 chamadas; `p-limit` concurrency=10.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

23. **`clickupFetch`/`n8nFetch`/`anthropicFetch` sem timeout — hang indefinido em toda a aba /agentes** — `src/lib/agentes/clickup/client.ts:30-47`
    - Fix: `signal: AbortSignal.timeout(...)` (10s clickup/n8n, 15s anthropic), como já feito no client de Triagem.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

24. **`getAbTests` com N+1 sem try/catch e sem `.limit()`** — `src/app/(dashboard)/ab-tests/actions.ts:8`
    - Fix: LEFT JOIN num roundtrip + `.limit(100)` + try/catch.
    - Dono: `api-agent` · Baseline: **já-listado** (item-N8 / gotcha 8)

25. **`importOfferTracking` insere em `projects` (relacional) e não em `offerTracking`** — `src/app/(dashboard)/import/actions.ts:40`
    - Fix: renomear para `importLegacyProjects` ou reescrever para `offerTracking`.
    - Dono: `api-agent` · Baseline: **novo**

26. **`getTeamPerformance`: full scan em `offerTracking` sem `.limit()` — loop O(members×offers)** — `src/app/(dashboard)/analytics/actions.ts:285`
    - Fix: contagem em SQL com subqueries/CTEs; paliativo `.limit(500)`.
    - Dono: `analytics-agent` · Baseline: **já-listado** (item-N8 / gotcha 8)

---

## MÉDIO (45)

1. **`sql.join()` com template literals — padrão não-idiomático (risco residual)** — `src/app/(dashboard)/analytics/actions.ts:100,121,125`
   - Fix: substituir as 3 ocorrências por `inArray()` para enums tipados.
   - Dono: `analytics-agent` · Baseline: **já-listado** (item-1)

2. **`StatusBadge` UTMify hardcoded `Conectado` — `utmifyConnected` nunca usado** — `src/app/(dashboard)/settings/page.tsx:42,67`
   - Fix: `connected={utmifyConnected}` na linha 67.
   - Dono: `ui-agent` · Baseline: **já-listado** (item-12)

3. **Unique constraints ausentes em junction tables e `teamMembers.email`** — `src/db/schema.ts:89-98,303-307,333-338,400-407`
   - Fix: `.unique()` em email; `uniqueIndex()` em `campaignCreatives`, `entityTags`, `externalMappings`; migration.
   - Dono: `db-agent` · Baseline: **já-listado** (item-8-db)

4. **Migration inicial (0000) desatualizada — enum `team_role` sem 'suporte'** — `drizzle/0000_absent_preak.sql:11`
   - Fix: `drizzle-kit generate` com `ALTER TYPE team_role ADD VALUE 'suporte'`; aplicar em prod.
   - Dono: `db-agent` · Baseline: **já-listado** (item-3)

5. **`triggerSync` sem verificação de role admin** — `src/app/(dashboard)/settings/actions.ts:7-21`
   - Fix: `auth()` + checagem de role admin antes de executar.
   - Dono: `api-agent` · Baseline: **já-listado** (item-28)

6. **`getMetricsForProject` sem filtro de `entityType` — retorna métricas de entidades com mesmo ID** — `src/app/(dashboard)/metrics/actions.ts:65-72`
   - Fix: adicionar `eq(metricsSnapshots.entityType, 'project')` ao WHERE.
   - Dono: `api-agent` · Baseline: **já-listado** (item-7)

7. **`importMetrics`/`importOfferTracking` sem limite de linhas — vetor de DoS** — `src/app/(dashboard)/import/actions.ts:7-38,40-102`
   - Fix: `MAX_ROWS = 500` + batch insert (`db.insert(table).values(rows)`).
   - Dono: `api-agent` · Baseline: **já-listado** (item-12)

8. **`getComparisonData` faz 2 queries sequenciais por valor — não paralelas** — `src/app/(dashboard)/analytics/actions.ts:773-866`
   - Fix: `Promise.all(values.map(...))` + paralelizar queries internas.
   - Dono: `analytics-agent` · Baseline: **já-listado** (item-27)

9. **Clerk dev instance (`pk_test_` / domínio `.clerk.accounts.dev`) em uso em produção** — `.env.local:3-4`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `[REDIGIDO]` (instância dev); `.auth/user.json` confirma cookies de domínio dev contra a URL de produção.
   - Fix: criar instância de produção no Clerk, gerar `pk_live_*`/`sk_live_*` e configurar no Vercel.
   - Dono: `deploy-agent` · Baseline: **novo**

10. **GitHub PAT embutido na URL remota do git** — `.git/config:8`
    - URL de `origin` contém **GitHub PAT** `[REDIGIDO]` em texto plano no disco.
    - Fix: `git remote set-url origin https://github.com/...` (sem token); usar SSH ou credential manager; **rotacionar o PAT**.
    - Dono: `deploy-agent` · Baseline: **novo**

11. **Quatro cron jobs dependem só de `CRON_SECRET` previsível** — `src/app/api/cron/{sync-utmify,sync-clickup,sync-vturb,slack-reminder}/route.ts:6-9`
    - **CRON_SECRET** em uso = `[REDIGIDO]` (baixa entropia, legível no settings.local.json).
    - Fix: rotacionar para valor de alta entropia; exigir header `x-vercel-cron: 1`; IP allowlist no Vercel Firewall.
    - Dono: `data-sync-agent` · Baseline: **novo**

12. **`getProjects` sem `.limit()` — query irrestrita** — `src/app/(dashboard)/projects/actions.ts:39-45`
    - Fix: `.limit(500)` nos dois caminhos ou paginação.
    - Dono: `api-agent` · Baseline: **novo**

13. **`team_members.email` sem UNIQUE constraint — duplicatas possíveis** — `src/db/schema.ts:92`
    - Fix: `text('email').notNull().unique()`; migration (checar duplicatas antes).
    - Dono: `db-agent` · Baseline: **novo**

14. **`funnel_nodes` sem `updatedAt`** — `src/db/schema.ts:184-200`
    - Fix: adicionar `updatedAt timestamp ... .defaultNow()`; migration.
    - Dono: `db-agent` · Baseline: **novo**

15. **`offer_tracking` status como text livre — sem validação no banco** — `src/db/schema.ts:493-516`
    - Fix: `pgEnum('offer_status', [...])` e migrar os 10 campos; ou check constraints.
    - Dono: `db-agent` · Baseline: **novo**

16. **`team_role` enum no banco diverge do schema TS — 'suporte' ausente** — `drizzle/0000_absent_preak.sql:11`
    - Fix: migration manual `ALTER TYPE team_role ADD VALUE 'suporte'` registrada em `drizzle/`.
    - Dono: `db-agent` · Baseline: **novo**

17. **`getOffersRanking`: 8 subqueries correlacionadas por projeto** — `src/app/(dashboard)/analytics/actions.ts:494-512`
    - Fix: LEFT JOIN único com `GROUP BY` + `COUNT(*) FILTER`; índices em `creatives.project_id`/`vsls.project_id`.
    - Dono: `analytics-agent` · Baseline: **novo**

18. **`getAbTests`: N+1 clássico — 1 query por teste para variants** — `src/app/(dashboard)/ab-tests/actions.ts:8-18`
    - Fix: LEFT JOIN + `GROUP BY`, `inArray()`, ou `db.query.abTests.findMany({ with: { variants: true } })`.
    - Dono: `api-agent` · Baseline: **novo**

19. **`getDashboardStats`: 6 queries sequenciais que poderiam ser 1 agregada** — `src/app/(dashboard)/dashboard-actions.ts:8-46`
    - Fix: consolidar em `COUNT(*) FILTER (WHERE ...)`; reduzir a 2 queries em `Promise.all`.
    - Dono: `api-agent` · Baseline: **novo**

20. **`getTeamPerformance`: full table scan + filtro de data não aplicado a `offerTracking`** — `src/app/(dashboard)/analytics/actions.ts:285-286`
    - Fix: agregação em SQL com `GROUP BY`; `.limit(500)` mínimo; aplicar filtro de data em `offerTracking.createdAt`.
    - Dono: `analytics-agent` · Baseline: **novo**

21. **`saveUtmifyCampaignData`: N inserts sequenciais em loop (sem batch)** — `src/app/(dashboard)/analytics/actions.ts:901-923`
    - Fix: `db.insert(metricsSnapshots).values(allValues)` (batch nativo Drizzle).
    - Dono: `api-agent` · Baseline: **novo**

22. **`offers/page.tsx`: `getOffers` chamado 2x (filtrado + full) para derivar filtros** — `src/app/(dashboard)/offers/page.tsx:45-48`
    - Fix: substituir a 2ª chamada por `selectDistinct` específicos ou `getFilterOptions()`.
    - Dono: `api-agent` · Baseline: **novo**

23. **`compare/page.tsx` é Client Component puro — `getFilterOptions` chamado na UI sem cache** — `src/app/(dashboard)/analytics/compare/page.tsx:1 e 70-98`
    - Fix: converter em Server Component wrapper que prefetcha os filterOptions e passa por props.
    - Dono: `analytics-agent` · Baseline: **novo**

24. **`getMetricsTrend`: sem filtro de `entityType` soma spend/revenue de todos os tipos (duplica gráficos)** — `src/app/(dashboard)/dashboard-actions.ts:190-212`
    - Fix: filtrar por `entityType`/`source` que representa o ground truth financeiro.
    - Dono: `analytics-agent` · Baseline: **novo**

25. **Slack cron retorna HTTP 200 quando `SLACK_WEBHOOK_URL` está ausente** — `src/app/api/cron/slack-reminder/route.ts:11`
    - Fix: `{ status: 500 }` no return (como a linha 55 já faz).
    - Dono: `data-sync-agent` · Baseline: **novo**

26. **Cron `sync-utmify` insere duplicatas — sem idempotência para snapshots 'dashboard'** — `src/app/api/cron/sync-utmify/route.ts:28-46 e 56-75`
    - Fix: delete por `entityType + date` antes dos inserts (padrão do `sync-clickup`/`sync-utmify-daily`).
    - Dono: `data-sync-agent` · Baseline: **novo**

27. **`buildDateRange` usa data UTC para timezone do dashboard — dia errado em horários limítrofes** — `src/lib/utmify.ts:56-69`
    - Fix: calcular 'ontem' no fuso do dashboard (aplicar offset) antes de formatar.
    - Dono: `data-sync-agent` · Baseline: **novo**

28. **IDs PROD hardcoded duplicados em dois arquivos sem fonte única** — `src/lib/agentes/ofertas/estado-agente.ts:27-34`
    - Fix: centralizar os 4 IDs em `src/lib/agentes/constants.ts` e importar em `aggregate.ts` e `estado-agente.ts`.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

29. **`GET /api/agentes/approvals` sem filtro retorna todos os approvals sem paginação** — `src/app/api/agentes/approvals/route.ts:155-165`
    - Fix: `.limit(200)` + exigir `task_id` (400 se ausente) ou restringir a admin.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

30. **`feedback` enviado ao webhook Black sem limite de tamanho (prompt injection)** — `src/app/api/agentes/black/re-execute/route.ts:59-67`
    - Fix: `maxLength` (ex: 4000 chars) no handler + textarea.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

31. **`re-execute/route.ts`: fetch ao webhook Black sem timeout** — `src/app/api/agentes/black/re-execute/route.ts:59-68`
    - Fix: `AbortSignal.timeout(8s)`; retornar 504 em timeout.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

32. **`getCustomFieldValue`: comparação `===` incorreta para dropdown (number vs unknown)** — `src/lib/agentes/clickup/tasks.ts:86-98`
    - Fix: `String(o.orderindex) === String(field.value)` (resiliente a coerção da API ClickUp).
    - Dono: `agentes-ops-agent` · Baseline: **novo**

33. **`aggregateOfertas`: paginação ClickUp sequencial sem graceful degradation por página** — `src/lib/agentes/ofertas/aggregate.ts:34-44`
    - Fix: try/catch no `await` do loop com `break` + log da página que falhou (retorna parcial).
    - Dono: `agentes-ops-agent` · Baseline: **novo**

34. **Código morto: `EditorStatusDisplay` definida mas nunca renderizada** — `src/components/offers/offer-table.tsx:805`
    - Fix: remover (linhas 805-862) ou reintegrar à coluna de editor.
    - Dono: `ui-agent` · Baseline: **novo**

35. **Duplicação de `formatLabels`: mapa de formato definido em 3 arquivos** — `src/components/analytics/creatives-table.tsx:13`
    - Fix: importar `FORMAT_LABELS` de `@/lib/team-utils` e remover as definições locais.
    - Dono: `ui-agent` · Baseline: **novo**

36. **Error handling ausente: `createAlert`/`toggleAlert`/`deleteAlert` sem try/catch** — `src/app/(dashboard)/alerts/actions.ts:12`
    - Fix: try/catch + `console.error` + re-throw (padrão `settings/actions.ts:17`).
    - Dono: `api-agent` · Baseline: **novo**

37. **Error handling ausente: `createAbTest`/`completeAbTest`/`deleteAbTest`/`updateVariantMetrics` sem try/catch** — `src/app/(dashboard)/ab-tests/actions.ts:21`
    - Fix: try/catch + re-throw; idealmente transação nos 2 inserts de `createAbTest`.
    - Dono: `api-agent` · Baseline: **novo**

38. **Error handling ausente: `importMetrics` sem try/catch por linha** — `src/app/(dashboard)/import/actions.ts:7`
    - Fix: try/catch por linha (padrão de `importOfferTracking`) com contador de erros.
    - Dono: `api-agent` · Baseline: **novo**

39. **Zod ausente: `createAlert` aceita input bruto sem validação** — `src/app/(dashboard)/alerts/actions.ts:12`
    - Fix: `alertSchema.parse(data)` antes do insert (operator como enum, threshold validado).
    - Dono: `api-agent` · Baseline: **novo**

40. **Zod ausente: `createAbTest` e `updateVariantMetrics` sem schema** — `src/app/(dashboard)/ab-tests/actions.ts:21`
    - Fix: `abTestSchema`/`variantMetricsSchema` com `parse()` antes de insert/update.
    - Dono: `api-agent` · Baseline: **novo**

41. **`DATABASE_URL!` sem validação runtime — crash silencioso em deploy** — `src/db/index.ts:5`
    - Fix: guard `if (!process.env.DATABASE_URL) throw ...` antes de `neon()`.
    - Dono: `db-agent` · Baseline: **novo**

42. **`StatusBadge` hardcoded `connected={true}` para UTMify** — `src/app/(dashboard)/settings/page.tsx:67`
    - Fix: `connected={utmifyConnected}`.
    - Dono: `ui-agent` · Baseline: **novo**

43. **`getOffers()` duplo sem `.limit()` — full scan 2x na mesma requisição** — `src/app/(dashboard)/offers/page.tsx:45`
    - Fix: `getOfferFilterOptions()` com `selectDistinct`, ou `.limit(500)` imediato.
    - Dono: `api-agent` · Baseline: **novo**

44. **N+1 em `getAbTests`: variantes carregadas em loop sequencial** — `src/app/(dashboard)/ab-tests/actions.ts:10-18`
    - Fix: JOIN único, `inArray()`, ou relational query do Drizzle.
    - Dono: `api-agent` · Baseline: **já-listado** (item-6)

45. **`buildCreativeConditions` definida mas nunca aplicada — filtros de criativos ignorados** — `src/app/(dashboard)/analytics/actions.ts:109`
    - Fix: integrar nas queries de criativos (`.where(buildCreativeConditions(filters))`) ou remover se superseded.
    - Dono: `analytics-agent` · Baseline: **novo**

---

## BAIXO (30)

1. **`getProjects` sem `.limit()` de segurança — risco response too large** — `src/app/(dashboard)/projects/actions.ts:39-45`
   - Fix: `.limit(500)`; offset opcional para paginação.
   - Dono: `api-agent` · Baseline: **já-listado** (item-18)

2. **`funnelNodes`/`orderBumps` sem `updatedAt`** — `src/db/schema.ts:185-200,226-232`
   - Fix: `updatedAt ... .defaultNow()` em ambas; migration.
   - Dono: `db-agent` · Baseline: **já-listado** (item-29)

3. **`DATABASE_URL` sem validação de runtime — falha silenciosa em cold start** — `src/db/index.ts:5`
   - Fix: guard `if (!process.env.DATABASE_URL) throw ...` antes de `neon()`.
   - Dono: `db-agent` · Baseline: **já-listado** (item-19)

4. **`vsls.status` como text sem enum** — `src/db/schema.ts:145`
   - Fix: `vslStatusEnum(['ativo','pausado','arquivado'])`; migration.
   - Dono: `db-agent` · Baseline: **já-listado** (item-10-db)

5. **`analytics/actions.ts`: sql template com valores de filtro do usuário (sem validação de enum)** — `src/app/(dashboard)/analytics/actions.ts:100,121-125`
   - Fix: validar valores contra enum conhecido antes da query; preferir `inArray()`. (Não há `sql.raw()` — risco residual.)
   - Dono: `analytics-agent` · Baseline: **novo**

6. **`campaign_creatives` sem unique `(campaignId, creativeId)`** — `src/db/schema.ts:303-307`
   - Fix: `uniqueIndex('uq_campaign_creative').on(campaignId, creativeId)`; migration.
   - Dono: `db-agent` · Baseline: **novo**

7. **`order_bumps` sem `updatedAt`** — `src/db/schema.ts:225-232`
   - Fix: `updatedAt ... .defaultNow()`; migration.
   - Dono: `db-agent` · Baseline: **novo**

8. **N+1 em `getAbTests` — SELECT por teste dentro de loop** — `src/app/(dashboard)/ab-tests/actions.ts:8-18`
   - Fix: LEFT JOIN + reagrupar no JS, ou relational query.
   - Dono: `api-agent` · Baseline: **novo**

9. **`getCreativesDetailed`: função exportada sem chamador (código morto)** — `src/app/(dashboard)/analytics/actions.ts:258-275`
   - Fix: remover ou marcar com TODO explícito (join em tabelas legacy vazias).
   - Dono: `analytics-agent` · Baseline: **novo**

10. **`entityId` hardcoded em 0 em todos os inserts de métricas — impede join com entidade real** — `src/app/api/cron/sync-vturb/route.ts:68`
    - Fix: resolver `entityId` real onde aplicável; documentar `entityId=0` como convencional onde não há entidade fixa.
    - Dono: `data-sync-agent` · Baseline: **novo**

11. **Snapshots `vturb_player` gravados pelo cron mas nenhuma action os consome** — `src/app/api/cron/sync-vturb/route.ts:65-84`
    - Fix: ler dos snapshots em `getVturbStats` (economiza quota) ou remover o cron.
    - Dono: `data-sync-agent` · Baseline: **novo**

12. **`getTeamPerformance` carrega todos os offers em memória sem limit (N+1 implícito)** — `src/app/(dashboard)/analytics/actions.ts:283-285`
    - Fix: `GROUP BY`/agregação em SQL; eliminar os 2 `await db.select` dentro do loop de `getComparisonData`.
    - Dono: `analytics-agent` · Baseline: **já-listado** (item-5)

13. **Groq transcribe sem timeout: upload de áudio grande pode travar a Function** — `src/app/api/agentes/transcribe/route.ts:41-55`
    - Fix: `AbortSignal.timeout(30s)`; mapear erros Groq (429→429, resto→502) em vez de repassar status interno.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

14. **`findSubtaskByName` usa substring match case-insensitive — pode casar subtarefa errada** — `src/lib/agentes/clickup/tasks.ts:104-111`
    - Fix: exact match no caller crítico (`re-execute`): `s.name.toLowerCase().trim() === 'tradução da vsl'`.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

15. **`audio_url` nunca enviado no POST de approvals: `feedbackAudioUrl` sempre null** — `src/app/(dashboard)/agentes/components/ApprovalSheet.tsx:88-99`
    - Fix: implementar upload do blob (S3/Vercel Blob) e enviar a URL, ou remover o campo do schema/interface/rota.
    - Dono: `agentes-ops-agent` · Baseline: **novo**

16. **`revalidate=60` em route handlers com `auth()` é ignorado pelo Next.js 16** — `src/app/api/agentes/ofertas/route.ts:6`
    - Fix: remover `export const revalidate = 60` (rotas são dinâmicas por usarem cookies); idem `candidatos/route.ts`.
    - Dono: `api-agent` · Baseline: **novo**

17. **Código morto: `MultiPersonCell` definida mas nunca usada** — `src/components/offers/offer-table.tsx:109`
    - Fix: remover a função (~109-160).
    - Dono: `ui-agent` · Baseline: **novo**

18. **Código morto: `SIGLA_TO_NAME` importado mas nunca usado** — `src/components/offers/offer-table.tsx:92`
    - Fix: remover do import destrutivo.
    - Dono: `ui-agent` · Baseline: **novo**

19. **Código morto: `buildCreativeConditions` definida mas nunca chamada** — `src/app/(dashboard)/analytics/actions.ts:109`
    - Fix: remover (linhas 109-129) ou integrar nas queries de `getOffersRanking`/`getVslsForComparison`.
    - Dono: `analytics-agent` · Baseline: **novo**

20. **Código morto: `buildBaseFilters` definida mas nunca chamada** — `src/app/(dashboard)/analytics/compare/page.tsx:101`
    - Fix: passar como argumento a `getComparisonData` ou remover.
    - Dono: `ui-agent` · Baseline: **novo**

21. **Código morto: `hasAnyFilter` calculado mas nunca consumido** — `src/app/(dashboard)/analytics/team/page.tsx:32`
    - Fix: remover ou usar para botão 'Limpar filtros'.
    - Dono: `ui-agent` · Baseline: **novo**

22. **Código morto: `offerClicks` calculado mas nunca exibido** — `src/app/(dashboard)/analytics/vsls/page.tsx:210`
    - Fix: remover ou exibir clicks no card de oferta.
    - Dono: `ui-agent` · Baseline: **novo**

23. **Código morto: imports `vsls`/`creatives`/`campaigns` nunca usados** — `src/app/(dashboard)/dashboard-actions.ts:4`
    - Fix: remover do import destrutivo.
    - Dono: `api-agent` · Baseline: **novo**

24. **Variáveis `utmifyConnected`/`sheetsSecretConfigured`/`webhookUrl` calculadas mas nunca usadas** — `src/app/(dashboard)/settings/page.tsx:42`
    - Fix: passar `utmifyConnected` ao StatusBadge; remover `sheetsSecretConfigured`/`webhookUrl` enquanto o card Sheets estiver comentado.
    - Dono: `ui-agent` · Baseline: **novo**

25. **`useEffect` com setState síncrono em 5 células inline-edit (ESLint)** — `src/components/offers/offer-table.tsx:123`
    - Fix: derivar valor via `useMemo`/prop como initialState, ou `key={value}` para remount.
    - Dono: `ui-agent` · Baseline: **novo**

26. **`useEffect` sem dependência `load` em 6 componentes (exhaustive-deps)** — `src/app/(dashboard)/projects/[id]/campaigns-tab.tsx:137`
    - Fix: `useCallback` em `load` + adicionar ao deps array, ou inline.
    - Dono: `ui-agent` · Baseline: **novo**

27. **Inconsistência: imports de `zod` vs `zod/v4` no mesmo projeto** — `src/app/api/admin-ui/team/route.ts:2`
    - Fix: padronizar para `zod/v4`.
    - Dono: `api-agent` · Baseline: **novo**

28. **Middleware deprecado: Next.js 16 usa `proxy`, arquivo ainda é `middleware.ts`** — `src/middleware.ts:1`
    - Fix: renomear `src/middleware.ts` → `src/proxy.ts` (API do Clerk inalterada; confirmar na doc de migração).
    - Dono: `deploy-agent` · Baseline: **novo**

29. **Missing dependency `load` no `useEffect` (múltiplos arquivos)** — `campaigns-tab.tsx:137`, `creatives-tab.tsx:181`, `funnel-tab.tsx:101,251`, `vsls-tab.tsx:147`, `entity-tags.tsx:48`
    - Fix: mover `load` para dentro do effect ou `useCallback` + deps array.
    - Dono: `ui-agent` · Baseline: **novo**

30. **Múltiplos imports/variáveis não utilizados (dead code) — 45 warnings em 10 arquivos** — `analytics/actions.ts`, `dashboard-actions.ts`, `compare/page.tsx`, `team/page.tsx`, `vsls/page.tsx`, `settings/page.tsx`, `funnel-tab.tsx`, `creatives-table.tsx`, `entity-tags.tsx`, `offer-table.tsx`
    - Fix: remover imports/declarações não utilizados; decidir destino de `buildCreativeConditions`.
    - Dono: `api-agent` · Baseline: **novo**

---

## Ações do Pedro (infra/credenciais — fora do código)

Estes itens **não são fix de código** — exigem ação manual nos painéis de infra/credenciais. São **bloqueantes de segurança**.

### Rotação obrigatória de tokens expostos

> **Contexto crítico:** o arquivo `.claude/settings.local.json` **esteve no histórico do git** — foi incluído no commit inicial `8d651ab feat: initial commit`. Isso significa que os valores que estiveram nesse arquivo podem ter sido versionados/clonados. A rotação de TODOS os tokens abaixo é **obrigatória**, não opcional, mesmo que o arquivo hoje esteja fora do working tree commitado.

- [ ] **Vercel API token** — rotacionar (estava no allowlist do settings.local.json). Gerar novo, atualizar onde for usado, revogar o antigo.
- [ ] **ClickUp personal token** — rotacionar (token pessoal, não API key de projeto).
- [ ] **Slack webhook URL** — revogar/recriar o webhook no app Slack (URL = secret).
- [ ] **CRON_SECRET** — rotacionar para valor de alta entropia (`openssl rand -hex 32`); atualizar no Vercel env vars e em todos os crons/endpoints admin.
- [ ] **GitHub PAT** — rotacionar (estava embutido na URL de `origin` em `.git/config`). Após rotacionar, refazer `git remote set-url` sem token (SSH ou credential manager).
- [ ] **UTMIFY_API_KEY** — rotacionar (estava em texto plano no settings.local.json).
- [ ] Adicionar `.claude/settings.local.json` e `.auth/` ao `.gitignore` para impedir reexposição.

### Configuração de produção

- [ ] **Configurar `SALES_WEBHOOK_SECRET` no Vercel** (env var). Sem isso, o webhook de vendas fica fail-open (ver CRÍTICO #1/#2). Adicionar também ao `.env.example`.
- [ ] **Criar instância de PRODUÇÃO no Clerk** (Production instance): gerar `pk_live_*` e `sk_live_*` e configurar no Vercel. Hoje a app roda em produção com instância **dev** (`pk_test_`), que tem proteções relaxadas (ver MÉDIO #9). O `.env.local` pode manter as chaves dev para desenvolvimento local.

---

## Achados descartados na verificação adversarial (3)

1. **`drizzle/meta/` ausente** — falso: `_journal.json` + 5 snapshots existem e correspondem às migrations.
2. **ESLint `set-state-in-effect` em `offer-table.tsx` (5 ocorrências)** — falso: a regra `react-hooks/set-state-in-effect` não existe na config do projeto; o padrão `if (!editing) setLocalValue(...)` é idiomático (batching no React 18) e os nomes de componentes alegados não existem.
3. **ESLint `set-state-in-effect` em `site-urls-dialog.tsx`** — falso pela mesma razão (regra inexistente; padrão correto com batching automático).
