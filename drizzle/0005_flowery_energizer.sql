ALTER TABLE "ab_test_variants" DROP CONSTRAINT "ab_test_variants_ab_test_id_ab_tests_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_history" DROP CONSTRAINT "alert_history_alert_id_alerts_id_fk";
--> statement-breakpoint
ALTER TABLE "campaign_creatives" DROP CONSTRAINT "campaign_creatives_campaign_id_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "campaign_creatives" DROP CONSTRAINT "campaign_creatives_creative_id_creatives_id_fk";
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "creatives" DROP CONSTRAINT "creatives_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "entity_tags" DROP CONSTRAINT "entity_tags_tag_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "funnel_nodes" DROP CONSTRAINT "funnel_nodes_funnel_id_funnels_id_fk";
--> statement-breakpoint
ALTER TABLE "funnels" DROP CONSTRAINT "funnels_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "order_bumps" DROP CONSTRAINT "order_bumps_funnel_id_funnels_id_fk";
--> statement-breakpoint
ALTER TABLE "vsls" DROP CONSTRAINT "vsls_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "funnel_nodes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_bumps" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_ab_test_id_ab_tests_id_fk" FOREIGN KEY ("ab_test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_nodes" ADD CONSTRAINT "funnel_nodes_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_bumps" ADD CONSTRAINT "order_bumps_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vsls" ADD CONSTRAINT "vsls_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_creatives_campaign_id_creative_id_idx" ON "campaign_creatives" USING btree ("campaign_id","creative_id");--> statement-breakpoint
CREATE INDEX "campaigns_project_id_idx" ON "campaigns" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "change_log_entity_type_entity_id_idx" ON "change_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "creatives_project_id_idx" ON "creatives" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_tags_tag_id_entity_type_entity_id_idx" ON "entity_tags" USING btree ("tag_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_mappings_entity_type_entity_id_platform_idx" ON "external_mappings" USING btree ("entity_type","entity_id","platform");--> statement-breakpoint
CREATE INDEX "metrics_snapshots_entity_type_idx" ON "metrics_snapshots" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "metrics_snapshots_entity_type_entity_id_date_idx" ON "metrics_snapshots" USING btree ("entity_type","entity_id","date");--> statement-breakpoint
CREATE INDEX "vsls_project_id_idx" ON "vsls" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_email_unique" UNIQUE("email");