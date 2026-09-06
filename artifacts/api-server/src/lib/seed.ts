import { db } from "@workspace/db";
import {
  agendaItemsTable,
  displaysTable,
  eventsTable,
  liveSessionsTable,
} from "@workspace/db";
import { asc, count } from "drizzle-orm";

export async function ensureFlowlineSeedData() {
  const [{ value }] = await db.select({ value: count() }).from(eventsTable);
  if (Number(value) > 0) return;

  const eventId = "evt-horizon-summit";
  const agenda = [
    ["Welcome & opening", "opening", "Maya Chen", 10, "09:00"],
    ["The calm production advantage", "keynote", "Jordan Lee", 25, "09:10"],
    ["Building for the room", "panel", "Maya Chen · Alex Rivera", 35, "09:35"],
    ["Coffee break", "break", null, 15, "10:10"],
    ["Audience Q&A", "qa", "Jordan Lee", 20, "10:25"],
  ] as const;

  await db.insert(eventsTable).values({
    id: eventId,
    name: "Horizon Summit · Day one",
    date: new Date().toISOString().slice(0, 10),
    venue: "Pier 48, San Francisco",
    timezone: "America/Los_Angeles",
    status: "scheduled",
  });

  await db.insert(agendaItemsTable).values(
    agenda.map(([title, type, speaker, plannedDurationMinutes, plannedStart], position) => ({
      id: `item-${position + 1}`,
      eventId,
      position,
      title,
      type,
      speaker,
      plannedDurationMinutes,
      plannedStart,
      warningMinutes: type === "break" ? 2 : 3,
      status: "queued",
    })),
  );

  await db.insert(displaysTable).values([
    {
      id: "display-stage-main",
      eventId,
      name: "Main Stage",
      kind: "stage",
      connectionStatus: "online",
      assignedLayout: "focus",
      lastSeenAt: new Date(),
      currentContent: "Ready for doors",
    },
    {
      id: "display-speaker-confidence",
      eventId,
      name: "Speaker confidence",
      kind: "speaker",
      connectionStatus: "online",
      assignedLayout: "speaker",
      lastSeenAt: new Date(),
      currentContent: "Ready for doors",
    },
    {
      id: "display-stream-booth",
      eventId,
      name: "Stream booth",
      kind: "backstage",
      connectionStatus: "offline",
      assignedLayout: "compact",
      lastSeenAt: null,
      currentContent: "Offline",
    },
  ]);

  await db.insert(liveSessionsTable).values({
    eventId,
    state: "idle",
    activeItemId: "item-1",
    remainingSeconds: 10 * 60,
    elapsedSeconds: 0,
    lastCommandAt: new Date(),
  });
}