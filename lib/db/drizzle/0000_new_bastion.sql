CREATE TABLE "flowline_agenda_items" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"speaker" text,
	"planned_start" text,
	"planned_duration_minutes" integer DEFAULT 10 NOT NULL,
	"warning_minutes" integer DEFAULT 2 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"actual_started_at" timestamp with time zone,
	"actual_ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flowline_display_access" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"display_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "flowline_displays" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'speaker' NOT NULL,
	"connection_status" text DEFAULT 'offline' NOT NULL,
	"assigned_layout" text DEFAULT 'focus' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"current_content" text DEFAULT 'Waiting for event' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text,
	"workspace_id" text,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"venue" text,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_live_session_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"command_id" text NOT NULL,
	"expected_revision" integer NOT NULL,
	"resulting_revision" integer NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_live_sessions" (
	"event_id" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'idle' NOT NULL,
	"active_item_id" text,
	"remaining_seconds" integer DEFAULT 0 NOT NULL,
	"elapsed_seconds" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"operator_message" text,
	"operator_message_target" text,
	"operator_message_priority" text,
	"operator_message_expires_at" timestamp with time zone,
	"active_cue" text,
	"last_command_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timer_anchor_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_app_users" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_stripe_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"stripe_created_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"plan" text DEFAULT 'STARTER' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"checkout_attempt_id" text,
	"checkout_requested_plan" text,
	"checkout_session_id" text,
	"checkout_attempt_expires_at" timestamp with time zone,
	"current_period_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_timer_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_workspace_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_workspace_members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'OWNER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flowline_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flowline_events" ADD CONSTRAINT "flowline_events_workspace_id_flowline_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."flowline_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_audit_logs" ADD CONSTRAINT "flowline_audit_logs_workspace_id_flowline_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."flowline_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_audit_logs" ADD CONSTRAINT "flowline_audit_logs_actor_user_id_flowline_app_users_clerk_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."flowline_app_users"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_subscriptions" ADD CONSTRAINT "flowline_subscriptions_workspace_id_flowline_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."flowline_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_timer_templates" ADD CONSTRAINT "flowline_timer_templates_workspace_id_flowline_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."flowline_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_timer_templates" ADD CONSTRAINT "flowline_timer_templates_created_by_user_id_flowline_app_users_clerk_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."flowline_app_users"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_workspace_invitations" ADD CONSTRAINT "flowline_workspace_invitations_workspace_id_flowline_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."flowline_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_workspace_invitations" ADD CONSTRAINT "flowline_workspace_invitations_invited_by_user_id_flowline_app_users_clerk_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."flowline_app_users"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_workspace_members" ADD CONSTRAINT "flowline_workspace_members_workspace_id_flowline_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."flowline_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_workspace_members" ADD CONSTRAINT "flowline_workspace_members_user_id_flowline_app_users_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."flowline_app_users"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flowline_workspaces" ADD CONSTRAINT "flowline_workspaces_owner_user_id_flowline_app_users_clerk_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."flowline_app_users"("clerk_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flowline_events_workspace_id_idx" ON "flowline_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flowline_live_session_commands_event_command_unique" ON "flowline_live_session_commands" USING btree ("event_id","command_id");--> statement-breakpoint
CREATE INDEX "flowline_audit_logs_workspace_created_at_idx" ON "flowline_audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "flowline_audit_logs_actor_user_id_idx" ON "flowline_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flowline_subscriptions_workspace_unique" ON "flowline_subscriptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flowline_subscriptions_stripe_customer_unique" ON "flowline_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flowline_subscriptions_stripe_subscription_unique" ON "flowline_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "flowline_timer_templates_workspace_id_idx" ON "flowline_timer_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flowline_workspace_invitations_token_hash_unique" ON "flowline_workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "flowline_workspace_invitations_workspace_id_idx" ON "flowline_workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flowline_workspace_members_workspace_user_unique" ON "flowline_workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "flowline_workspace_members_user_id_idx" ON "flowline_workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "flowline_workspaces_owner_user_id_idx" ON "flowline_workspaces" USING btree ("owner_user_id");