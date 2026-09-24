-- SOMENTE LEITURA: conta as linhas de venda duplicadas pela chave de idempotência
-- (sale_platform, sale_transaction_id, sale_status).
--
-- Rode com psql (read-only):
--   psql "$DATABASE_URL" -f scripts/count-sale-duplicates.sql
--
-- A chave é derivada do extra_data (que já existe em prod) e espelha exatamente o que
-- as colunas sale_* vão guardar depois da migration:
--   platform          = extra_data->>'platform'
--   transaction_id    = COALESCE(extra_data->>'transactionCode', extra_data->>'transactionId')
--   status            = extra_data->>'status'
--
-- Cada linha = 1 grupo duplicado + contagem. Informativo: a 0013 não faz backfill, então
-- duplicatas históricas não impedem o CREATE UNIQUE INDEX — só mostram o tamanho do furo.
-- Evento sem id ("" ou ausente) fica de fora, igual ao webhook (vira NULL, nunca deduplica).
SELECT
  extra_data->>'platform' AS sale_platform,
  NULLIF(btrim(COALESCE(extra_data->>'transactionCode', extra_data->>'transactionId', '')), '') AS sale_transaction_id,
  extra_data->>'status' AS sale_status,
  count(*) AS duplicated_rows
FROM metrics_snapshots
WHERE entity_type = 'sale'
  AND NULLIF(btrim(COALESCE(extra_data->>'transactionCode', extra_data->>'transactionId', '')), '') IS NOT NULL
GROUP BY 1, 2, 3
HAVING count(*) > 1
ORDER BY duplicated_rows DESC;
