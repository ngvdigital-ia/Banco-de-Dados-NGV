CREATE TYPE "public"."ab_test_status" AS ENUM('running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."alert_operator" AS ENUM('gt', 'lt', 'eq');--> statement-breakpoint
CREATE TYPE "public"."change_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."creative_format" AS ENUM('especialista', 'ugc_masc', 'ugc_fem', 'famoso', 'youtuber', 'autoridade', 'podcast');--> statement-breakpoint
CREATE TYPE "public"."creative_status" AS ENUM('rascunho', 'validou', 'nao_validou', 'escalou', 'nao_escalou');--> statement-breakpoint
CREATE TYPE "public"."funnel_node_type" AS ENUM('checkout', 'upsell', 'downsell');--> statement-breakpoint
CREATE TYPE "public"."metric_source" AS ENUM('manual', 'utmify', 'meta_api', 'tiktok_api');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('meta', 'tiktok', 'google', 'kwai');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('escalou', 'nao_escalou', 'em_teste', 'rodando', 'pausado');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('vsl', 'tsl');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('admin', 'copywriter', 'editor', 'gestor_trafego');--> statement-breakpoint
CREATE TABLE "ab_test_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"ab_test_id" integer NOT NULL,
	"variant_name" text NOT NULL,
	"description" text,
	"metrics_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"status" "ab_test_status" DEFAULT 'running' NOT NULL,
	"winner_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_id" integer NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_value" numeric(12, 2),
	"message" text
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"metric" text NOT NULL,
	"operator" "alert_operator" NOT NULL,
	"threshold" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_creatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"creative_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"daily_budget" numeric(10, 2),
	"manager_id" integer,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" "change_action" NOT NULL,
	"changes_json" jsonb,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"format" "creative_format" NOT NULL,
	"copy_script" text,
	"copywriter_id" integer,
	"editor_id" integer,
	"video_link" text,
	"publish_date" timestamp with time zone,
	"status" "creative_status" DEFAULT 'rascunho' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnel_id" integer NOT NULL,
	"parent_node_id" integer,
	"node_type" "funnel_node_type" NOT NULL,
	"offer_name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"url" text,
	"accept_destination_id" integer,
	"decline_destination_id" integer,
	"content_type" text,
	"text_length" text,
	"position" integer DEFAULT 0 NOT NULL,
	"acceptance_rate" numeric(8, 4),
	"revenue_per_customer" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"sales_page_url" text,
	"checkout_url" text,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"source" "metric_source" DEFAULT 'manual' NOT NULL,
	"impressions" integer,
	"clicks" integer,
	"ctr" numeric(8, 4),
	"cpc" numeric(10, 2),
	"cpm" numeric(10, 2),
	"spend" numeric(12, 2),
	"page_visits" integer,
	"play_rate" numeric(8, 4),
	"button_click_rate" numeric(8, 4),
	"checkout_visits" integer,
	"conversion_rate" numeric(8, 4),
	"avg_ticket" numeric(10, 2),
	"bump_acceptance_rate" numeric(8, 4),
	"cpa" numeric(10, 2),
	"roas" numeric(10, 2),
	"revenue" numeric(12, 2),
	"ltv" numeric(10, 2),
	"margin" numeric(10, 2),
	"video_retention_json" jsonb,
	"extra_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_bumps" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnel_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "project_type" DEFAULT 'vsl' NOT NULL,
	"niche" text NOT NULL,
	"language" text NOT NULL,
	"status" "project_status" DEFAULT 'em_teste' NOT NULL,
	"scale_start_date" timestamp with time zone,
	"scale_end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "team_role" NOT NULL,
	"avatar_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vsls" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" text NOT NULL,
	"copywriter_id" integer,
	"btube_link" text,
	"duration" integer,
	"price_reveal_second" integer,
	"button_appear_second" integer,
	"back_redirect_active" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ab_test_variants" ADD CONSTRAINT "ab_test_variants_ab_test_id_ab_tests_id_fk" FOREIGN KEY ("ab_test_id") REFERENCES "public"."ab_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_manager_id_team_members_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_copywriter_id_team_members_id_fk" FOREIGN KEY ("copywriter_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_editor_id_team_members_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_nodes" ADD CONSTRAINT "funnel_nodes_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_nodes" ADD CONSTRAINT "funnel_nodes_parent_node_id_funnel_nodes_id_fk" FOREIGN KEY ("parent_node_id") REFERENCES "public"."funnel_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_nodes" ADD CONSTRAINT "funnel_nodes_accept_destination_id_funnel_nodes_id_fk" FOREIGN KEY ("accept_destination_id") REFERENCES "public"."funnel_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_nodes" ADD CONSTRAINT "funnel_nodes_decline_destination_id_funnel_nodes_id_fk" FOREIGN KEY ("decline_destination_id") REFERENCES "public"."funnel_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_bumps" ADD CONSTRAINT "order_bumps_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vsls" ADD CONSTRAINT "vsls_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vsls" ADD CONSTRAINT "vsls_copywriter_id_team_members_id_fk" FOREIGN KEY ("copywriter_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;