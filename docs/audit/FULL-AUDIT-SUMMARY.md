# Auditoria Completa — NGV Digital

Data: 2026-04-08 | 4 agentes especializados

## Resultado Geral

| Severidade | Issues |
|-----------|--------|
| CRÍTICO | 3 |
| ALTO | 10 |
| MÉDIO | 15 |
| BAIXO | 8 |
| **Total** | **36** |

### Pontos Positivos ✅
- Secrets nunca expostos no client (nenhum NEXT_PUBLIC_ indevido)
- Zero XSS (sem dangerouslySetInnerHTML)
- Zero `any` no TypeScript
- Todos os 16 actions.ts têm "use server"
- Tipos monetários corretos (numeric, não float)
- Enums via pgEnum
- Timestamps com timezone
- CRON_SECRET verificado em todos os 4 crons
- Middleware Clerk protege todas as rotas do dashboard
- revalidatePath chamado após todas as mutações
- Import alias @/ consistente

---

## CRÍTICOS (corrigir imediato)

### 1. SQL Injection via sql.raw()
**Arquivo:** `analytics/actions.ts` (linhas 92, 114, 119)
```ts
const vals = filters.statuses.map((s) => `'${s}'`).join(",");
conditions.push(sql`${projects.status} IN (${sql.raw(vals)})`);
```
**Fix:** Substituir por `inArray(projects.status, filters.statuses)`

### 2. Webhook vendas sem autenticação
**Arquivo:** `api/webhooks/sales/route.ts`
Qualquer pessoa pode enviar dados falsos. Nenhuma verificação de secret, HMAC ou IP.
**Fix:** Adicionar `x-webhook-secret` header check

### 3. Índices ausentes no banco
Nenhum índice além de PKs. `metrics_snapshots` cresce a cada sync e faz full table scan.
**Fix:** Adicionar índices em project_id, funnel_id, entity_type+entity_id

---

## ALTOS (próximo sprint)

### 4. N+1 em getTeamPerformance — 30-40 queries por chamada
### 5. N+1 em getAbTests — N+1 queries para variants
### 6. VTurb cron salva dados incompatíveis com getVturbStats()
Cron salva `{ events: [...] }` mas a action lê `data.started` na raiz.
### 7. ClickUp cron hardcoded 2 listas (desatualizado vs settings)
E campo `tasksCompleted` não bate com `taskCount` lido pela analytics.
### 8. FKs sem ON DELETE CASCADE
Deletes manuais em cascata com race condition.
### 9. clickupRows query sem .limit()
Pode retornar milhares de linhas e crashar.
### 10. Subqueries correlacionadas em getOffersRanking
6 subqueries por projeto = 300 subqueries com 50 projetos.
### 11. rawPayload salvo com PII no webhook vendas
Email, país, pagamento do comprador persistidos sem sanitização.
### 12. StatusBadge UTMify hardcoded como "Conectado"
Variável `utmifyConnected` declarada mas nunca usada.
### 13. updateOfferField tipo dinâmico sem Zod

---

## MÉDIOS (backlog)

### 14-28 (resumido)
- Unique constraints ausentes (email, junction tables)
- Tags/alerts/ab-tests sem Zod validation
- Import sem limite de linhas
- offer_tracking status sem enum
- getProjects/getOffers sem .limit()
- Duplicatas no UTMify cron (4 inserts/dia sem dedup)
- UTMify entityId hardcoded 0
- Queries sequenciais em getComparisonData
- getOffers chamado 2x na page
- CTE copywriter declarado mas nunca usado (código morto)
- getCreativesDetailed nunca consumida (código morto)
- importOfferTracking insere em projects ao invés de offerTracking
- Nomes hardcoded no offer-table (deveria vir do DB)
- triggerSync sem verificação de role admin

---

## BAIXOS (boas práticas)

### 29-36 (resumido)
- updatedAt faltando em funnel_nodes, order_bumps
- DATABASE_URL! sem validação runtime
- fetchLiveUsers sem log de erro
- Slack cron retorna 200 em vez de 500 quando webhook ausente
- Timezone padding frágil em utmify.ts
- Crons sem retry
- Sem logging estruturado
- Filtro de comparação por referência de objeto (nunca funciona)
