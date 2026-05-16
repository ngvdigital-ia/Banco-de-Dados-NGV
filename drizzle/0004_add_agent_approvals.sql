CREATE TABLE "agent_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"agente" text NOT NULL,
	"acao" text NOT NULL,
	"feedback" text,
	"feedback_audio_url" text,
	"execution_id" text,
	"session_id" text,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
