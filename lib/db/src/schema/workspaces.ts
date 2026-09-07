import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * Clerk remains the identity provider. This table stores only application
 * metadata, and uses Clerk's stable user id as its primary key.
 */
export const appUsersTable = pgTable("flowline_app_users", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const workspacesTable = pgTable("flowline_workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => appUsersTable.clerkUserId),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("flowline_workspaces_owner_user_id_idx").on(table.ownerUserId),
]);

export const workspaceMembersTable = pgTable("flowline_workspace_members", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspacesTable.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsersTable.clerkUserId),
  role: text("role").$type<WorkspaceRole>().notNull().default("OWNER"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("flowline_workspace_members_workspace_user_unique").on(table.workspaceId, table.userId),
  index("flowline_workspace_members_user_id_idx").on(table.userId),
]);

export const subscriptionsTable = pgTable("flowline_subscriptions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspacesTable.id),
  plan: text("plan").$type<SubscriptionPlan>().notNull().default("STARTER"),
  status: text("status").notNull().default("active"),
  // These are relationship references only; Stripe remains the subscription
  // source of truth and is synchronized into its managed `stripe` schema.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  checkoutAttemptId: text("checkout_attempt_id"),
  checkoutRequestedPlan: text("checkout_requested_plan").$type<SubscriptionPlan>(),
  checkoutSessionId: text("checkout_session_id"),
  checkoutAttemptExpiresAt: timestamp("checkout_attempt_expires_at", { withTimezone: true }),
  currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("flowline_subscriptions_workspace_unique").on(table.workspaceId),
  uniqueIndex("flowline_subscriptions_stripe_customer_unique").on(table.stripeCustomerId),
  uniqueIndex("flowline_subscriptions_stripe_subscription_unique").on(table.stripeSubscriptionId),
]);

/** Durable replay ledger for canonical Stripe webhook events. */
export const stripeWebhookEventsTable = pgTable("flowline_stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  stripeCreatedAt: timestamp("stripe_created_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timerTemplatesTable = pgTable("flowline_timer_templates", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspacesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  // The agenda/timer definition is intentionally version-tolerant JSON.
  definition: jsonb("definition").notNull(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => appUsersTable.clerkUserId),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("flowline_timer_templates_workspace_id_idx").on(table.workspaceId),
]);

export const workspaceInvitationsTable = pgTable("flowline_workspace_invitations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspacesTable.id),
  email: text("email").notNull(),
  role: text("role").$type<WorkspaceRole>().notNull().default("VIEWER"),
  tokenHash: text("token_hash").notNull(),
  invitedByUserId: text("invited_by_user_id")
    .notNull()
    .references(() => appUsersTable.clerkUserId),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("flowline_workspace_invitations_token_hash_unique").on(table.tokenHash),
  index("flowline_workspace_invitations_workspace_id_idx").on(table.workspaceId),
]);

export const auditLogsTable = pgTable("flowline_audit_logs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspacesTable.id),
  actorUserId: text("actor_user_id").references(() => appUsersTable.clerkUserId),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("flowline_audit_logs_workspace_created_at_idx").on(table.workspaceId, table.createdAt),
  index("flowline_audit_logs_actor_user_id_idx").on(table.actorUserId),
]);

export const workspaceRoles = ["OWNER", "ADMIN", "OPERATOR", "VIEWER"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export const subscriptionPlans = ["STARTER", "PRO", "BUSINESS"] as const;
export type SubscriptionPlan = (typeof subscriptionPlans)[number];

export const insertAppUserSchema = createInsertSchema(appUsersTable).omit({ createdAt: true, updatedAt: true });
export const insertWorkspaceSchema = createInsertSchema(workspacesTable).omit({ createdAt: true, updatedAt: true });
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembersTable).omit({ createdAt: true, updatedAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ createdAt: true, updatedAt: true });
export const insertTimerTemplateSchema = createInsertSchema(timerTemplatesTable).omit({ createdAt: true, updatedAt: true });
export const insertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitationsTable).omit({ createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ createdAt: true });

export type AppUser = typeof appUsersTable.$inferSelect;
export type Workspace = typeof workspacesTable.$inferSelect;
export type WorkspaceMember = typeof workspaceMembersTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type StripeWebhookEvent = typeof stripeWebhookEventsTable.$inferSelect;
export type TimerTemplate = typeof timerTemplatesTable.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitationsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;

export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertTimerTemplate = z.infer<typeof insertTimerTemplateSchema>;
export type InsertWorkspaceInvitation = z.infer<typeof insertWorkspaceInvitationSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;