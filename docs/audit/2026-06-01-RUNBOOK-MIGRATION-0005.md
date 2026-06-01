# Runbook — Migration 0005 (banco) · 2026-06-01

> Gerada na Onda 2 da correção de auditoria. **NÃO aplicada em produção ainda.**
> Arquivo: `drizzle/0005_flowery_energizer.sql`

## O que a migration faz
- **11 FK `ON DELETE CASCADE`** — resolve `deleteProject` (hoje dá FK violation). Inclui a cadeia projects→vsls/funnels/creatives/campaigns→funnel_nodes/order_bumps/campaign_creatives, + ab_test_variants, entity_tags, alert_history.
- **9 índices** — o crítico é `metrics_snapshots(entity_type, entity_id, date)` (mata o full-scan). + creatives/vsls/campaigns(project_id), change_log(entity_type, entity_id).
- **4 UNIQUE** — team_members(email), campaign_creatives, entity_tags, external_mappings.
- **2 `updated_at`** — funnel_nodes, order_bumps.
- Sem DROP de coluna/tabela. Nenhuma perda de dado.

## ⚠️ PRÉ-REQUISITOS — rodar ANTES de aplicar (read-only)

### 1. Checar duplicatas (as UNIQUE abortam a migration inteira se houver)
As 4 queries abaixo devem retornar **0 linhas**. Se alguma retornar, limpar os duplicados antes:
```sql
SELECT email, COUNT(*) FROM team_members GROUP BY email HAVING COUNT(*) > 1;
SELECT campaign_id, creative_id, COUNT(*) FROM campaign_creatives GROUP BY 1,2 HAVING COUNT(*) > 1;
SELECT tag_id, entity_type, entity_id, COUNT(*) FROM entity_tags GROUP BY 1,2,3 HAVING COUNT(*) > 1;
SELECT entity_type, entity_id, platform, COUNT(*) FROM external_mappings GROUP BY 1,2,3 HAVING COUNT(*) > 1;
```
(As tabelas relacionais estão praticamente vazias hoje, então o risco real é baixo — mas confirmar.)

### 2. Checar o enum `team_role` (drift possível)
```sql
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'team_role';
```
Se **não** listar `suporte`, rodar antes: `ALTER TYPE team_role ADD VALUE 'suporte';` (fora de transação).

## Riscos de aplicação
- **Lock**: os `CREATE INDEX` não usam `CONCURRENTLY` (drizzle não emite por padrão). Em `metrics_snapshots` (única tabela com volume) isso trava escrita durante a criação — segundos. **Aplicar em janela de baixo uso**, fora dos crons (4h / 6h / 12h UTC + Slack 12h/21h seg-sex). Alternativa: criar o índice de `metrics_snapshots` manualmente com `CREATE INDEX CONCURRENTLY` (fora de transação) e deixar o resto na migration.
- **Cascade**: depois de aplicada, deletar um projeto **deleta em cascata** todos os filhos. É o comportamento desejado (resolve o bug), mas saiba disso antes de deletar projeto em prod.

## Como aplicar (recomendado: testar numa Neon branch primeiro)
1. Pré-requisitos acima ✅
2. `npx drizzle-kit migrate` (transacional) **ou** aplicar o `.sql` manual via psql numa janela de baixo uso.
3. Conferir: `\d metrics_snapshots` mostra os índices; `deleteProject` de teste numa branch funciona.

> O código das outras ondas (1, 3, 4, 5) **não depende** desta migration pra rodar — pode ir pro deploy antes/depois. A migration é integridade + performance do banco.
