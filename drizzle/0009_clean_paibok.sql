CREATE TYPE "public"."operation_command_action" AS ENUM('consult', 'create', 'edit', 'comment', 'attach', 'complete', 'reopen', 'approve');--> statement-breakpoint
CREATE TYPE "public"."operation_command_status" AS ENUM('accepted', 'queued', 'running', 'succeeded', 'divergent', 'waiting_human', 'failed');--> statement-breakpoint
CREATE TABLE "operation_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"command_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"offer_tracking_id" integer,
	"action" "operation_command_action" NOT NULL,
	"actor_name" text NOT NULL,
	"actor_clickup_user_id" text NOT NULL,
	"operator_user_id" text NOT NULL,
	"operator_email" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"status" "operation_command_status" DEFAULT 'accepted' NOT NULL,
	"result" jsonb,
	"requested_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_commands_command_id_unique" UNIQUE("command_id"),
	CONSTRAINT "operation_commands_command_id_length" CHECK (length("operation_commands"."command_id") between 1 and 128),
	CONSTRAINT "operation_commands_actor_clickup_user_id" CHECK ("operation_commands"."actor_clickup_user_id" ~ '^(PENDING|[0-9]+)$'),
	CONSTRAINT "operation_commands_offer_id_ngv_slug" CHECK ("operation_commands"."offer_id" ~ '^ngv:[a-z0-9]+(-[a-z0-9]+)*$' OR ("operation_commands"."action" = 'consult' AND "operation_commands"."offer_id" = 'PENDING')),
	CONSTRAINT "operation_commands_payload_hash_sha256" CHECK ("operation_commands"."payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "operation_commands" ADD CONSTRAINT "operation_commands_offer_tracking_id_offer_tracking_id_fk" FOREIGN KEY ("offer_tracking_id") REFERENCES "public"."offer_tracking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operation_commands_offer_id_idx" ON "operation_commands" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "operation_commands_offer_tracking_id_idx" ON "operation_commands" USING btree ("offer_tracking_id");--> statement-breakpoint
CREATE INDEX "operation_commands_status_idx" ON "operation_commands" USING btree ("status");--> statement-breakpoint
CREATE INDEX "operation_commands_offer_id_status_idx" ON "operation_commands" USING btree ("offer_id","status");
