# Auditoria de APIs e Integrações — NGV Digital

Data: 2026-04-08

## Integrações

### 1. VTurb Analytics API ✅
- **Status:** Funcionando
- **Base URL:** `https://analytics.vturb.net`
- **Auth:** `X-Api-Token` + `X-Api-Version: v1`
- **Endpoints usados:**
  - `GET /players/list` — lista todos os players (342)
  - `POST /events/total_by_company_players` — plays, views, finishes, clicks
  - `POST /sessions/stats` — session statistics
  - `POST /times/user_engagement` — retenção
- **Cron:** A cada 12h (`/api/cron/sync-vturb`)
- **Dados salvos em:** `metrics_snapshots` com `entity_type = 'vturb_player'`

### 2. ClickUp API v2 ✅
- **Status:** Funcionando
- **Base URL:** `https://api.clickup.com/api/v2`
- **Auth:** Header `Authorization: {API_KEY}`
- **Workspace:** NGV Digital (space_id: 90131585986)
- **Pastas monitoradas:**
  - Copy: Copy (100 tasks), Produto (4)
  - Edição de Video: Criativos (100), VSL (72), Produtos (34)
  - Tráfego Pago: Tarefas (73)
  - Dev: Outros (79), Sites (27)
  - Diogo: List (100)
- **Cron:** A cada 6h (`/api/cron/sync-clickup`)
- **Dados salvos em:** `metrics_snapshots` com `entity_type = 'clickup_member'`

### 3. UTMify ⚠️ (Parcial)
- **Status:** API REST não funciona para consultas (retorna 403)
- **Motivo:** API REST do UTMify é para enviar vendas, não consultar
- **Workaround:** Dados puxados via MCP do Claude manualmente
- **Dashboards descobertos:**
  - Principal-NGV DIGITAL (BRL, timezone -3)
  - Dash Conta em Dolar (USD, timezone -5)
- **Dados salvos:** 259 pedidos de março/abril (dashboard USD)

### 4. Webhook de Vendas ✅
- **Endpoint:** `POST /api/webhooks/sales`
- **Status:** Pronto, aceita qualquer formato
- **Plataformas suportadas:** Cartpanda, Hotmart, PerfectPay, Monetizze, NexFy, Yampi
- **⚠️ Issue:** Sem autenticação (qualquer um pode enviar)

### 5. Slack ✅
- **Endpoint cron:** `/api/cron/slack-reminder`
- **Schedule:** Seg-Sex às 9h e 18h (BRT)
- **Variável:** `SLACK_WEBHOOK_URL`

---

## Crons (vercel.json)

| Cron | Schedule | Status |
|------|----------|--------|
| `/api/cron/sync-utmify` | A cada 6h | ⚠️ API REST não funciona |
| `/api/cron/sync-clickup` | A cada 6h | ✅ |
| `/api/cron/sync-vturb` | A cada 12h | ✅ |
| `/api/cron/slack-reminder` | Seg-Sex 9h/18h | ✅ |

---

## Server Actions (11 arquivos)

| Arquivo | Actions | Validação |
|---------|---------|-----------|
| team/actions.ts | get, create, update, delete | Zod ✅ |
| projects/actions.ts | get, getById, create, update, delete | Zod ✅ |
| projects/[id]/vsls-actions.ts | get, create, update, delete | Zod ✅ |
| projects/[id]/creatives-actions.ts | get, create, update, delete | Zod ✅ |
| projects/[id]/campaigns-actions.ts | get, create, update, delete | Zod ✅ |
| projects/[id]/funnel-actions.ts | get, create, delete (nodes, bumps) | Zod ✅ |
| offers/actions.ts | get, updateField, create, delete, import | Parcial ⚠️ |
| tags/actions.ts | get, create, delete, getEntity, addTag, removeTag | Sem Zod ❌ |
| changelog/actions.ts | get | N/A |
| metrics/actions.ts | create, getForProject, getCreatives, getCampaigns | Zod ✅ |
| analytics/actions.ts | 7 funções de consulta + filtros | N/A |
| settings/actions.ts | triggerSync (UTMify, ClickUp, VTurb) | N/A |
| dashboard-actions.ts | getStats, getSummary, getTrend, getVturb | N/A |

---

## Problemas Encontrados

### ALTO
1. **UTMify cron falha silenciosamente** — a API REST retorna 403 mas o cron não reporta erro visível
2. **Webhook de vendas sem auth** — qualquer pessoa pode enviar dados falsos
3. **updateOfferField** — aceita campo como string sem validar contra allowlist rígida

### MÉDIO
4. **Tags actions sem Zod** — input não validado
5. **importOffers** — sem limite de linhas (DoS com CSV gigante)
6. **fetchMetaAdObjects** em utmify.ts — URL possivelmente incorreta, nunca testada com sucesso

### BAIXO
7. **Crons sem retry** — se falhar, espera até o próximo ciclo
8. **Sem logging estruturado** — só console.error espalhado
9. **VTurb events compartilhados** — todos os events de todos os players salvos no mesmo row
