import { createInsertSchema } from "drizzle-zod";
import { date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { z } from "zod/v4";

export const eventsTable = pgTable("flowline_events", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id"),
  // Nullable by design: existing records can be claimed lazily into the
  // owner's personal workspace without a destructive migration.
  workspaceId: text("workspace_id").references(() => workspacesTable.id),
  name: text("name").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  venue: text("venue"),
  timezone: text("timezone").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("flowline_events_workspace_id_idx").on(table.workspaceId),
]);

export const displayAccessTable = pgTable("flowline_display_access", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  displayId: text("display_id").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const agendaItemsTable = pgTable("flowline_agenda_items", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("custom"),
  speaker: text("speaker"),
  plannedStart: text("planned_start"),
  plannedDurationMinutes: integer("planned_duration_minutes").notNull().default(10),
  warningMinutes: integer("warning_minutes").notNull().default(2),
  notes: text("notes"),
  status: text("status").notNull().default("queued"),
  actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
  actualEndedAt: timestamp("actual_ended_at", { withTimezone: true }),
});

export const displaysTable = pgTable("flowline_displays", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("speaker"),
  connectionStatus: text("connection_status").notNull().default("offline"),
  assignedLayout: text("assigned_layout").notNull().default("focus"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  currentContent: text("current_content").notNull().default("Waiting for event"),
});

export const liveSessionsTable = pgTable("flowline_live_sessions", {
  eventId: text("event_id").primaryKey(),
  state: text("state").notNull().default("idle"),
  activeItemId: text("active_item_id"),
  remainingSeconds: integer("remaining_seconds").notNull().default(0),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  operatorMessage: text("operator_message"),
  activeCue: text("active_cue"),
  lastCommandAt: timestamp("last_command_at", { withTimezone: true }).notNull().defaultNow(),
  // The counters are a snapshot at this anchor. They are never incremented by
  // polling reads; clients project them forward from this server timestamp.
  timerAnchorAt: timestamp("timer_anchor_at", { withTimezone: true }).notNull().defaultNow(),
  revision: integer("revision").notNull().default(0),
});

export const liveSessionCommandsTable = pgTable("flowline_live_session_commands", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  commandId: text("command_id").notNull(),
  expectedRevision: integer("expected_revision").notNull(),
  resultingRevision: integer("resulting_revision").notNull(),
  action: text("action").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("flowline_live_session_commands_event_command_unique").on(table.eventId, table.commandId),
]);

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertAgendaItemSchema = createInsertSchema(agendaItemsTable);
export const insertDisplaySchema = createInsertSchema(displaysTable);
export const insertLiveSessionSchema = createInsertSchema(liveSessionsTable);
export const insertLiveSessionCommandSchema = createInsertSchema(liveSessionCommandsTable);
export const insertDisplayAccessSchema = createInsertSchema(displayAccessTable);

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type AgendaItem = typeof agendaItemsTable.$inferSelect;
export type Display = typeof displaysTable.$inferSelect;
export type LiveSession = typeof liveSessionsTable.$inferSelect;
export type LiveSessionCommand = typeof liveSessionCommandsTable.$inferSelect;
export type DisplayAccess = typeof displayAccessTable.$inferSelect;