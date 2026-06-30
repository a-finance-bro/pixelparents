CREATE TABLE "ask_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_id" uuid NOT NULL,
	"responder_evaluation_id" uuid NOT NULL,
	"responder_clerk_user_id" text NOT NULL,
	"offer" text NOT NULL,
	"proposes" text DEFAULT 'async_advice' NOT NULL,
	"status" text DEFAULT 'offered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "asks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_evaluation_id" uuid NOT NULL,
	"author_clerk_user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"expertise_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "member_type" text DEFAULT 'community' NOT NULL;--> statement-breakpoint
ALTER TABLE "ask_responses" ADD CONSTRAINT "ask_responses_ask_id_asks_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."asks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_responses" ADD CONSTRAINT "ask_responses_responder_evaluation_id_evaluations_id_fk" FOREIGN KEY ("responder_evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_author_evaluation_id_evaluations_id_fk" FOREIGN KEY ("author_evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ask_responses_ask_responder_unique" ON "ask_responses" USING btree ("ask_id","responder_evaluation_id");--> statement-breakpoint
CREATE INDEX "ask_responses_ask_id_idx" ON "ask_responses" USING btree ("ask_id","status");--> statement-breakpoint
CREATE INDEX "asks_author_evaluation_id_idx" ON "asks" USING btree ("author_evaluation_id");--> statement-breakpoint
CREATE INDEX "asks_status_created_idx" ON "asks" USING btree ("status","created_at");