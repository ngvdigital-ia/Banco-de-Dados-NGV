ALTER TABLE "metrics_snapshots" ADD COLUMN "utmify_campaign_id" text;--> statement-breakpoint
ALTER TABLE "metrics_snapshots" ADD COLUMN "utmify_dashboard_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_snapshots_utmify_campaign_daily_uniq" ON "metrics_snapshots" USING btree ("date","utmify_campaign_id") WHERE entity_type = 'utmify_campaign_daily';--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_snapshots_utmify_dashboard_uniq" ON "metrics_snapshots" USING btree ("date","utmify_dashboard_id") WHERE entity_type = 'dashboard';