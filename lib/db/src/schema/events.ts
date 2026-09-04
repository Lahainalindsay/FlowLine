import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const eventsTable = pgTable("flowline_events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  venue: text("venue"),
  timezone: text("timezone").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
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
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertAgendaItemSchema = createInsertSchema(agendaItemsTable);
export const insertDisplaySchema = createInsertSchema(displaysTable);
export const insertLiveSessionSchema = createInsertSchema(liveSessionsTable);

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type AgendaItem = typeof agendaItemsTable.$inferSelect;
export type Display = typeof displaysTable.$inferSelect;
export type LiveSession = typeof liveSessionsTable.$inferSelect;