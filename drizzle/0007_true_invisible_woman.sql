CREATE TABLE "agent_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"agente" text NOT NULL,
	"execution_id" text NOT NULL,
	"revisor_score" numeric(5, 2),
	"revisor_aprovado" boolean,
	"drive_file_id" text,
	"drive_url" text,
	"drive_filename" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_products_task_agente_exec_uniq" ON "agent_products" USING btree ("task_id","agente","execution_id");--> statement-breakpoint
CREATE INDEX "agent_products_task_id_idx" ON "agent_products" USING btree ("task_id");