# Auditoria de Banco de Dados — NGV Digital

Data: 2026-04-08

## Resumo
- 18 tabelas
- 0 índices (além de PKs)
- 1 migration (desatualizada)
- Drizzle ORM + Neon Postgres serverless

---

## Issues CRÍTICOS

### 1. Índices ausentes
Nenhum índice definido além das PKs. Tabelas que precisam urgente:
- `creatives.project_id`
- `vsls.project_id`
- `campaigns.project_id`
- `funnels.project_id`
- `funnel_nodes.funnel_id`
- `metrics_snapshots(entity_type, entity_id)`
- `entity_tags(entity_type, entity_id)`
- `change_log.created_at`

**Impact:** `metrics_snapshots` cresce com syncs diários (UTMify, VTurb, ClickUp). Full table scan degrada performance.

### 2. SQL injection potencial em analytics
`buildProjectConditions` e `buildCreativeConditions` em `analytics/actions.ts` usam `sql.raw()` com valores de input:
```ts
const vals = filters.statuses.map((s) => `'${s}'`).join(",");
conditions.push(sql`${projects.status} IN (${sql.raw(vals)})`);
```
**Fix:** Substituir por `inArray(projects.status, filters.statuses)`.

### 3. Migration desatualizada
`drizzle/0000_absent_preak.sql` não reflete o schema atual (enum `team_role` sem `suporte`, tabela `offer_tracking` ausente).
**Fix:** Rodar `npx drizzle-kit generate` para sincronizar.

---

## Issues ALTOS

### 4. N+1 em getTeamPerformance
30-40 queries por chamada (1 query por membro × 4 subqueries).
**Fix:** Reescrever com GROUP BY e aggregates.

### 5. N+1 em getAbTests
21 queries para 20 testes (1 + N variants).
**Fix:** Usar join ou `inArray`.

### 6. Foreign Keys sem CASCADE
Deletes manuais em cascata (deleteFunnel, deleteAbTest, deleteAlert, deleteTag). Race condition se falhar entre deletes.
**Fix:** Adicionar `ON DELETE CASCADE`.

### 7. getMetricsForProject sem filtro entityType
Pode retornar métricas de outras entidades com mesmo ID numérico.
**Fix:** Adicionar `eq(metricsSnapshots.entityType, 'project')`.

---

## Issues MÉDIOS

### 8. Unique constraints ausentes
- `teamMembers.email` — permite duplicatas
- `campaignCreatives(campaign_id, creative_id)` — permite vincular 2x
- `entityTags(tag_id, entity_type, entity_id)` — mesma tag 2x
- `externalMappings(entity_type, entity_id, platform)` — duplo mapeamento

### 9. offer_tracking status como texto livre
Campos de status (SIM/NAO/EM ANDAMENTO) sem enum ou check constraint. Typos passam sem erro.

### 10. vsls.status sem enum
Usa `text` com default "ativo" enquanto outras tabelas usam pgEnum.

### 11. Inserts em loop sem batching
`importMetrics` e `importOfferTracking` — 1 insert por linha. Deveria ser batch.

---

## Issues BAIXOS

- `funnelNodes` e `orderBumps` sem `updatedAt`
- `DATABASE_URL!` sem validação de runtime
- `getProjects` sem `.limit()` de segurança
- Relações Drizzle incompletas para tabelas polimórficas
