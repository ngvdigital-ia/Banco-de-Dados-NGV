# Correções Priorizadas — NGV Digital

Data: 2026-04-08

## CRÍTICO (corrigir imediato)

| # | Issue | Arquivo | Fix |
|---|-------|---------|-----|
| 1 | SQL injection via sql.raw() | analytics/actions.ts | Substituir por inArray() |
| 2 | Índices ausentes no DB | schema.ts | Adicionar índices em FKs e entity_type |
| 3 | Migration desatualizada | drizzle/ | Rodar drizzle-kit generate |

## ALTO (próximo sprint)

| # | Issue | Arquivo | Fix |
|---|-------|---------|-----|
| 4 | Webhook vendas sem auth | api/webhooks/sales | Adicionar verificação de secret |
| 5 | N+1 getTeamPerformance | analytics/actions.ts | Reescrever com GROUP BY |
| 6 | N+1 getAbTests | ab-tests/actions.ts | Usar join |
| 7 | FKs sem CASCADE | schema.ts | Adicionar ON DELETE CASCADE |
| 8 | getMetricsForProject sem entityType | metrics/actions.ts | Adicionar filtro |
| 9 | UTMify cron falha silencioso | sync-utmify/route.ts | Melhorar error handling |

## MÉDIO (backlog)

| # | Issue | Arquivo | Fix |
|---|-------|---------|-----|
| 10 | Unique constraints | schema.ts | email, junction tables |
| 11 | Tags sem Zod validation | tags/actions.ts | Adicionar schema |
| 12 | Import sem limite | import/actions.ts | Limitar a 500 linhas |
| 13 | offer_tracking status sem enum | schema.ts | Considerar pgEnum |
| 14 | Clerk em modo development | Vercel env | Migrar para production keys |
| 15 | VTurb events compartilhados | settings/actions.ts | Salvar por player individual |

## BAIXO (boas práticas)

| # | Issue | Arquivo | Fix |
|---|-------|---------|-----|
| 16 | Sem rate limiting | webhooks | Adicionar |
| 17 | Sem logging estruturado | Projeto | Considerar Vercel Analytics |
| 18 | getProjects sem limit | projects/actions.ts | Adicionar paginação |
| 19 | DATABASE_URL sem validação | db/index.ts | Throw se undefined |
| 20 | updatedAt em funnel_nodes | schema.ts | Adicionar campo |
