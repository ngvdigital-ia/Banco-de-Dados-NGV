CREATE TABLE "module_action_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_clerk_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"target_ref" text,
	"result" text NOT NULL,
	"result_detail" text,
	"payload_hash" text
);
--> statement-breakpoint
CREATE INDEX "module_action_log_module_idx" ON "module_action_log" USING btree ("module","occurred_at");