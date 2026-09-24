-- 0013: idempotência do webhook de vendas (entity_type='sale').
-- Chave do evento (plataforma + id da transação + status) em colunas dedicadas e um
-- índice único PARCIAL: reenvio do mesmo evento cai no ON CONFLICT DO NOTHING.
--
-- ORDEM DE DEPLOY: aplicar ANTES do código do webhook que grava sale_* — sem as colunas
-- o insert falha, e sem o índice o ON CONFLICT falha.
-- Linhas antigas ficam com sale_* NULL (sem backfill): o índice não as compara, então
-- duplicatas históricas não impedem a criação. scripts/count-sale-duplicates.sql mede
-- quantas existem — é informativo, não pré-requisito.
-- Gerada pelo drizzle-kit; o gerador também incluiu ADD COLUMN de actor_name/operator_email
-- em operation_commands (drift de snapshot: as colunas já nascem no CREATE TABLE da 0009)
-- — removidas à mão. O 0013_snapshot.json já as contém e fecha o drift.
ALTER TABLE "metrics_snapshots" ADD COLUMN "sale_platform" text;--> statement-breakpoint
ALTER TABLE "metrics_snapshots" ADD COLUMN "sale_transaction_id" text;--> statement-breakpoint
ALTER TABLE "metrics_snapshots" ADD COLUMN "sale_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_snapshots_sale_event_uniq" ON "metrics_snapshots" USING btree ("sale_platform","sale_transaction_id","sale_status") WHERE entity_type = 'sale';