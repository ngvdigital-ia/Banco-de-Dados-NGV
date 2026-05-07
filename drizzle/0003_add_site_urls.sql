ALTER TABLE "offer_tracking" ADD COLUMN IF NOT EXISTS "site_urls" jsonb;

-- Backfill: migra site_url existente para o jsonb estruturado como VSL.
-- Não perde dados pré-existentes; ofertas sem site_url ficam com site_urls = NULL.
UPDATE "offer_tracking"
SET "site_urls" = jsonb_build_object('vsl', "site_url")
WHERE "site_url" IS NOT NULL
  AND "site_url" <> ''
  AND "site_urls" IS NULL;
