-- M2 identity: additive only; NULL means the offer still needs human reconciliation.
-- Manual rollback (only after readback proves no consumers/values): remove the
-- unique index, then the check constraint, then this nullable column in reverse order.
ALTER TABLE "offer_tracking" ADD COLUMN "canonical_offer_id" text NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_tracking_canonical_offer_id_uniq" ON "offer_tracking" USING btree ("canonical_offer_id") WHERE "offer_tracking"."canonical_offer_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_tracking" ADD CONSTRAINT "offer_tracking_canonical_offer_id_ngv_slug" CHECK ("offer_tracking"."canonical_offer_id" ~ '^ngv:[a-z0-9]+(-[a-z0-9]+)*$');
