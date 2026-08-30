CREATE TYPE "public"."operation_offer_build_failure_code" AS ENUM('INVALID_LEASE', 'INVALID_PAYLOAD', 'HEARTBEAT_STALE', 'EXECUTION_REJECTED', 'RESULT_TOO_LARGE', 'TRANSPORT_ERROR', 'INTERNAL_ERROR');--> statement-breakpoint
CREATE TYPE "public"."operation_offer_build_outbox_state" AS ENUM('queued', 'leased', 'running', 'ready_for_review', 'waiting_human', 'failed', 'completed');--> statement-breakpoint
CREATE TABLE "operation_offer_build_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id_hash" text NOT NULL,
	"offer_id" text NOT NULL,
	"offer_tracking_id" integer,
	"kind" text NOT NULL,
	"target_key" text NOT NULL,
	"outbox_state" "operation_offer_build_outbox_state" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"lease_generation" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"result" jsonb,
	"failure_code" "operation_offer_build_failure_code",
	"remote_updated_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_offer_build_jobs_job_id_hash_unique" UNIQUE("job_id_hash"),
	CONSTRAINT "operation_offer_build_jobs_job_id_hash_sha256" CHECK ("operation_offer_build_jobs"."job_id_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "operation_offer_build_jobs_offer_id_ngv_slug" CHECK ("operation_offer_build_jobs"."offer_id" ~ '^ngv:[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "operation_offer_build_jobs_kind" CHECK ("operation_offer_build_jobs"."kind" IN ('tracking', 'embed')),
	CONSTRAINT "operation_offer_build_jobs_target_key" CHECK (length("operation_offer_build_jobs"."target_key") between 1 and 80 AND "operation_offer_build_jobs"."target_key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "operation_offer_build_jobs_attempts" CHECK ("operation_offer_build_jobs"."attempts" >= 0 AND "operation_offer_build_jobs"."attempts" <= "operation_offer_build_jobs"."max_attempts" AND "operation_offer_build_jobs"."max_attempts" >= 1),
	CONSTRAINT "operation_offer_build_jobs_lease_generation" CHECK ("operation_offer_build_jobs"."lease_generation" >= 0),
	CONSTRAINT "operation_offer_build_jobs_initial_remote_state" CHECK ("operation_offer_build_jobs"."remote_updated_at" IS NOT NULL OR "operation_offer_build_jobs"."outbox_state" = 'queued'),
	CONSTRAINT "operation_offer_build_jobs_result_object" CHECK ("operation_offer_build_jobs"."result" IS NULL OR jsonb_typeof("operation_offer_build_jobs"."result") = 'object'),
	CONSTRAINT "operation_offer_build_jobs_result_contract" CHECK ("operation_offer_build_jobs"."result" IS NULL OR (
      "operation_offer_build_jobs"."result" ?& ARRAY['schema_version', 'job_id_sha256', 'offer_id', 'state', 'files_changed_count', 'commit', 'gates', 'completed_at']::text[]
      AND "operation_offer_build_jobs"."result" - ARRAY['schema_version', 'job_id_sha256', 'offer_id', 'state', 'files_changed_count', 'commit', 'gates', 'completed_at']::text[] = '{}'::jsonb
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'schema_version') = 'number'
      AND "operation_offer_build_jobs"."result"->>'schema_version' = '1'
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'job_id_sha256') = 'string'
      AND "operation_offer_build_jobs"."result"->>'job_id_sha256' = "operation_offer_build_jobs"."job_id_hash"
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'offer_id') = 'string'
      AND "operation_offer_build_jobs"."result"->>'offer_id' = "operation_offer_build_jobs"."offer_id"
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'state') = 'string'
      AND "operation_offer_build_jobs"."result"->>'state' IN ('structure-ready', 'waiting-video', 'waiting-tracking', 'ready-for-deploy')
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'files_changed_count') = 'number'
      AND "operation_offer_build_jobs"."result"->>'files_changed_count' IN ('0', '1')
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'commit') = 'string'
      AND "operation_offer_build_jobs"."result"->>'commit' = 'PENDING'
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'gates') = 'object'
      AND ("operation_offer_build_jobs"."result"->'gates') ?& ARRAY['scope', 'local', 'tracking', 'visual', 'production']::text[]
      AND ("operation_offer_build_jobs"."result"->'gates') - ARRAY['scope', 'local', 'tracking', 'visual', 'production']::text[] = '{}'::jsonb
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'gates'->'scope') = 'string'
      AND "operation_offer_build_jobs"."result"->'gates'->>'scope' = 'PASS'
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'gates'->'local') = 'string'
      AND "operation_offer_build_jobs"."result"->'gates'->>'local' = 'PASS'
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'gates'->'tracking') = 'string'
      AND "operation_offer_build_jobs"."result"->'gates'->>'tracking' IN ('PASS', 'NOT_APPLICABLE')
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'gates'->'visual') = 'string'
      AND "operation_offer_build_jobs"."result"->'gates'->>'visual' = 'PENDING'
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'gates'->'production') = 'string'
      AND "operation_offer_build_jobs"."result"->'gates'->>'production' = 'PENDING'
      AND jsonb_typeof("operation_offer_build_jobs"."result"->'completed_at') = 'string'
      AND "operation_offer_build_jobs"."result"->>'completed_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
    )),
	CONSTRAINT "operation_offer_build_jobs_failure_state" CHECK (("operation_offer_build_jobs"."outbox_state" = 'failed' AND "operation_offer_build_jobs"."failure_code" IS NOT NULL) OR ("operation_offer_build_jobs"."outbox_state" <> 'failed' AND "operation_offer_build_jobs"."failure_code" IS NULL)),
	CONSTRAINT "operation_offer_build_jobs_result_state" CHECK (("operation_offer_build_jobs"."outbox_state" IN ('ready_for_review', 'completed') AND "operation_offer_build_jobs"."result" IS NOT NULL) OR ("operation_offer_build_jobs"."outbox_state" NOT IN ('ready_for_review', 'completed') AND "operation_offer_build_jobs"."result" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "operation_offer_build_jobs" ADD CONSTRAINT "operation_offer_build_jobs_offer_tracking_id_offer_tracking_id_fk" FOREIGN KEY ("offer_tracking_id") REFERENCES "public"."offer_tracking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operation_offer_build_jobs_offer_id_idx" ON "operation_offer_build_jobs" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "operation_offer_build_jobs_offer_tracking_id_idx" ON "operation_offer_build_jobs" USING btree ("offer_tracking_id");--> statement-breakpoint
CREATE INDEX "operation_offer_build_jobs_outbox_state_idx" ON "operation_offer_build_jobs" USING btree ("outbox_state");--> statement-breakpoint
CREATE INDEX "operation_offer_build_jobs_remote_updated_at_idx" ON "operation_offer_build_jobs" USING btree ("remote_updated_at");