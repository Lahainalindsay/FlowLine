import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  ApplyAgendaImportBody,
  ApplyAgendaImportParams,
  AgendaImportInput,
  CreateAgendaItemBody,
  CreateAgendaItemParams,
  CreateDisplayBody,
  CreateDisplayParams,
  CreateEventBody,
  ControlLiveSessionBody,
  ControlLiveSessionParams,
  DeleteAgendaItemParams,
  DeleteDisplayParams,
  DeleteEventParams,
  GetEventParams,
  GetLiveSessionParams,
  ListAgendaItemsParams,
  ListDisplaysParams,
  PreviewAgendaImportBody,
  PreviewAgendaImportParams,
  ReorderAgendaItemsBody,
  ReorderAgendaItemsParams,
  SendOperatorMessageBody,
  SendOperatorMessageParams,
  TriggerCueBody,
  TriggerCueParams,
  UpdateAgendaItemBody,
  UpdateAgendaItemParams,
  UpdateEventBody,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  agendaItemsTable,
  displaysTable,
  eventsTable,
  liveSessionsTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

const nowIso = () => new Date().toISOString();
const id = () => randomUUID();

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

async function getAgenda(eventId: string) {
  return db
    .select()
    .from(agendaItemsTable)
    .where(eq(agendaItemsTable.eventId, eventId))
    .orderBy(asc(agendaItemsTable.position));
}

async function ensureSession(eventId: string, firstItemId?: string) {
  const [existing] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.eventId, eventId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(liveSessionsTable)
    .values({
      eventId,
      activeItemId: firstItemId ?? null,
      remainingSeconds: 0,
      elapsedSeconds: 0,
      lastCommandAt: new Date(),
    })
    .returning();
  return created;
}

function sessionPayload(session: typeof liveSessionsTable.$inferSelect) {
  let remainingSeconds = session.remainingSeconds;
  let elapsedSeconds = session.elapsedSeconds;
  let state = session.state;

  if ((session.state === "running" || session.state === "overtime") && session.lastCommandAt) {
    const tick = Math.max(
      0,
      Math.floor((Date.now() - session.lastCommandAt.getTime()) / 1000),
    );
    remainingSeconds -= tick;
    elapsedSeconds += tick;
    state = remainingSeconds <= 0 ? "overtime" : "running";
  }

  return {
    eventId: session.eventId,
    state,
    activeItemId: session.activeItemId,
    remainingSeconds,
    elapsedSeconds,
    serverTime: nowIso(),
    startedAt: iso(session.startedAt),
    pausedAt: iso(session.pausedAt),
    operatorMessage: session.operatorMessage,
    activeCue: session.activeCue,
  };
}

async function persistTick(session: typeof liveSessionsTable.$inferSelect) {
  if ((session.state !== "running" && session.state !== "overtime") || !session.lastCommandAt) return session;
  const tick = Math.max(
    0,
    Math.floor((Date.now() - session.lastCommandAt.getTime()) / 1000),
  );
  if (tick === 0) return session;
  const next = {
    remainingSeconds: session.remainingSeconds - tick,
    elapsedSeconds: session.elapsedSeconds + tick,
    state: session.remainingSeconds - tick <= 0 ? "overtime" : "running",
    lastCommandAt: new Date(),
  };
  const [updated] = await db
    .update(liveSessionsTable)
    .set(next)
    .where(eq(liveSessionsTable.eventId, session.eventId))
    .returning();
  return updated;
}

async function eventPayload(event: typeof eventsTable.$inferSelect) {
  const agenda = await getAgenda(event.id);
  const totalPlannedMinutes = agenda.reduce(
    (sum, item) => sum + item.plannedDurationMinutes,
    0,
  );
  const [active] = await db
    .select()
    .from(agendaItemsTable)
    .where(
      and(
        eq(agendaItemsTable.eventId, event.id),
        eq(agendaItemsTable.status, "active"),
      ),
    )
    .limit(1);
  const [session] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.eventId, event.id))
    .limit(1);

  return {
    id: event.id,
    name: event.name,
    date: event.date,
    venue: event.venue,
    timezone: event.timezone,
    status: event.status,
    segmentCount: agenda.length,
    totalPlannedMinutes,
    behindScheduleMinutes: active ? Math.max(0, active.position - 1) : 0,
    projectedFinish: null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    session: session ? sessionPayload(session) : sessionPayload(await ensureSession(event.id, agenda[0]?.id)),
  };
}

function agendaPayload(item: typeof agendaItemsTable.$inferSelect) {
  return {
    ...item,
    actualStartedAt: iso(item.actualStartedAt),
    actualEndedAt: iso(item.actualEndedAt),
  };
}

function displayPayload(display: typeof displaysTable.$inferSelect) {
  return {
    ...display,
    lastSeenAt: iso(display.lastSeenAt),
  };
}

router.get("/dashboard/summary", async (req, res) => {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .orderBy(asc(eventsTable.date), desc(eventsTable.updatedAt));
    const summaries = await Promise.all(events.map(eventPayload));
    const activeEvent =
      summaries.find((event) => event.status === "live") ?? null;
    res.json({
      upcomingEvents: summaries.filter((event) => event.status !== "completed").slice(0, 6),
      activeEvent,
      totalEvents: summaries.length,
      minutesOnAir: summaries.reduce((sum, event) => sum + event.totalPlannedMinutes, 0),
      recentActivity: summaries.slice(0, 5).map((event, index) => ({
        id: `${event.id}-${index}`,
        label:
          event.status === "live"
            ? `${event.name} is live`
            : `${event.name} is ready`,
        timestamp: event.updatedAt,
        tone: event.status === "live" ? "positive" : "neutral",
      })),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to load dashboard summary");
    res.status(500).json({ error: "Unable to load dashboard summary" });
  }
});

router.get("/events", async (req, res) => {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .orderBy(asc(eventsTable.date), desc(eventsTable.updatedAt));
    res.json(await Promise.all(events.map(eventPayload)));
  } catch (error) {
    req.log.error({ error }, "Failed to list events");
    res.status(500).json({ error: "Unable to list events" });
  }
});

router.post("/events", async (req, res) => {
  const body = CreateEventBody.parse(req.body);
  const eventId = id();
  try {
    const [event] = await db
      .insert(eventsTable)
      .values({
        id: eventId,
        name: body.name,
        date: body.date,
        venue: body.venue ?? null,
        timezone: body.timezone,
        status: "draft",
      })
      .returning();
    await ensureSession(event.id);
    await db.insert(displaysTable).values({
      id: id(),
      eventId: event.id,
      name: "Speaker confidence monitor",
      kind: "speaker",
      connectionStatus: "online",
      assignedLayout: "focus",
      lastSeenAt: new Date(),
      currentContent: "Ready to receive live timing",
    });
    res.status(201).json(await eventPayload(event));
  } catch (error) {
    req.log.error({ error }, "Failed to create event");
    res.status(500).json({ error: "Unable to create event" });
  }
});

router.get("/events/:eventId", async (req, res) => {
  const params = GetEventParams.parse(req.params);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.eventId)).limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });
  const [agenda, displays, session] = await Promise.all([
    getAgenda(event.id),
    db.select().from(displaysTable).where(eq(displaysTable.eventId, event.id)),
    ensureSession(event.id),
  ]);
  return res.json({
    ...(await eventPayload(event)),
    agenda: agenda.map(agendaPayload),
    displays: displays.map(displayPayload),
    session: sessionPayload(session),
  });
});

router.patch("/events/:eventId", async (req, res) => {
  const params = GetEventParams.parse(req.params);
  const body = UpdateEventBody.parse(req.body);
  const [event] = await db
    .update(eventsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(eventsTable.id, params.eventId))
    .returning();
  if (!event) return res.status(404).json({ error: "Event not found" });
  return res.json(await eventPayload(event));
});

router.delete("/events/:eventId", async (req, res) => {
  const params = DeleteEventParams.parse(req.params);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.eventId)).limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });
  await db.delete(agendaItemsTable).where(eq(agendaItemsTable.eventId, params.eventId));
  await db.delete(displaysTable).where(eq(displaysTable.eventId, params.eventId));
  await db.delete(liveSessionsTable).where(eq(liveSessionsTable.eventId, params.eventId));
  await db.delete(eventsTable).where(eq(eventsTable.id, params.eventId));
  return res.status(204).send();
});

router.get("/events/:eventId/agenda", async (req, res) => {
  const params = ListAgendaItemsParams.parse(req.params);
  const items = await getAgenda(params.eventId);
  res.json(items.map(agendaPayload));
});

router.post("/events/:eventId/agenda", async (req, res) => {
  const params = CreateAgendaItemParams.parse(req.params);
  const body = CreateAgendaItemBody.parse(req.body);
  const [last] = await db
    .select({ position: agendaItemsTable.position })
    .from(agendaItemsTable)
    .where(eq(agendaItemsTable.eventId, params.eventId))
    .orderBy(desc(agendaItemsTable.position))
    .limit(1);
  const [item] = await db
    .insert(agendaItemsTable)
    .values({
      id: id(),
      eventId: params.eventId,
      position: (last?.position ?? 0) + 1,
      title: body.title,
      type: body.type,
      speaker: body.speaker ?? null,
      plannedStart: body.plannedStart ?? null,
      plannedDurationMinutes: body.plannedDurationMinutes,
      warningMinutes: body.warningMinutes ?? 2,
      notes: body.notes ?? null,
    })
    .returning();
  res.status(201).json(agendaPayload(item));
});

router.post("/events/:eventId/agenda/reorder", async (req, res) => {
  const params = ReorderAgendaItemsParams.parse(req.params);
  const body = ReorderAgendaItemsBody.parse(req.body);
  const updates = await Promise.all(
    body.itemIds.map((itemId, position) =>
      db
        .update(agendaItemsTable)
        .set({ position })
        .where(and(eq(agendaItemsTable.id, itemId), eq(agendaItemsTable.eventId, params.eventId)))
        .returning(),
    ),
  );
  res.json(updates.flat().map(agendaPayload));
});

router.post("/events/:eventId/agenda/import-preview", async (req, res) => {
  const params = PreviewAgendaImportParams.parse(req.params);
  const body = PreviewAgendaImportBody.parse(req.body);
  const source = body.source.trim();
  const rows = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const items = rows.map((row) => {
    const startMatch = row.match(/^(\d{1,2}):(\d{2})\b/);
    const durationMatch = row.match(/(\d+)\s*(?:m|min|minutes?)\b/i);
    const rangeMatch = row.match(/\b(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\b/);
    const plannedDurationMinutes = durationMatch
      ? Number(durationMatch[1])
      : rangeMatch
        ? (Number(rangeMatch[3]) * 60 + Number(rangeMatch[4]) - (Number(rangeMatch[1]) * 60 + Number(rangeMatch[2])) + 1440) % 1440
        : 10;
    const withoutStart = row.replace(/^\d{1,2}:\d{2}\s*(?:[-–]\s*\d{1,2}:\d{2})?\s*/, "");
    const withoutDuration = withoutStart.replace(/\s*\d+\s*(?:m|min|minutes?)\s*$/i, "").trim();
    const parts = withoutDuration.includes(",")
      ? withoutDuration.split(",").map((part) => part.trim()).filter(Boolean)
      : withoutDuration.split(/\t+|\s{2,}/).map((part) => part.trim()).filter(Boolean);
    return {
      title: parts[0] || "Untitled segment",
      type: "custom" as const,
      speaker: parts[1] || null,
      plannedStart: startMatch ? `${startMatch[1].padStart(2, "0")}:${startMatch[2]}` : null,
      plannedDurationMinutes: Math.max(1, plannedDurationMinutes),
      warningMinutes: 2,
      notes: null,
    };
  });
  res.json({
    items,
    warnings: rows.length === 0 ? ["Paste at least one schedule line to preview an agenda."] : [
      "Preview only: nothing has been added to the event yet.",
      `Parsed ${items.length} ${items.length === 1 ? "segment" : "segments"} from the provided ${body.format ?? "text"}.`,
    ],
    confidence: rows.every((row) => /^\d{1,2}:\d{2}\b/.test(row) && /(\d+)\s*(?:m|min|minutes?)\b/i.test(row)) ? "high" : rows.some((row) => /\d{1,2}:\d{2}/.test(row)) ? "medium" : "low",
  });
  req.log.info({ eventId: params.eventId, itemCount: items.length }, "Previewed agenda import");
});

router.post("/events/:eventId/agenda/import", async (req, res) => {
  const params = ApplyAgendaImportParams.parse(req.params);
  const body = ApplyAgendaImportBody.parse(req.body);
  const [event] = await db.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, params.eventId)).limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const imported = await db.transaction(async (tx) => {
    const [last] = await tx
      .select({ position: agendaItemsTable.position })
      .from(agendaItemsTable)
      .where(eq(agendaItemsTable.eventId, params.eventId))
      .orderBy(desc(agendaItemsTable.position))
      .limit(1);
    const firstPosition = (last?.position ?? 0) + 1;
    const values = body.items.map((item, index) => ({
      id: id(),
      eventId: params.eventId,
      position: firstPosition + index,
      title: item.title,
      type: item.type,
      speaker: item.speaker ?? null,
      plannedStart: item.plannedStart ?? null,
      plannedDurationMinutes: item.plannedDurationMinutes,
      warningMinutes: item.warningMinutes ?? 2,
      notes: item.notes ?? null,
    }));
    return tx.insert(agendaItemsTable).values(values).returning();
  });
  return res.status(201).json(imported.map(agendaPayload));
});

router.patch("/agenda/:itemId", async (req, res) => {
  const params = UpdateAgendaItemParams.parse(req.params);
  const body = UpdateAgendaItemBody.parse(req.body);
  if (body.status === "active") {
    return res.status(409).json({ error: "Use a live-session jump command to activate a segment" });
  }
  const [item] = await db
    .update(agendaItemsTable)
    .set(body)
    .where(eq(agendaItemsTable.id, params.itemId))
    .returning();
  if (!item) return res.status(404).json({ error: "Agenda item not found" });
  return res.json(agendaPayload(item));
});

router.delete("/agenda/:itemId", async (req, res) => {
  const params = DeleteAgendaItemParams.parse(req.params);
  const [item] = await db.select().from(agendaItemsTable).where(eq(agendaItemsTable.id, params.itemId)).limit(1);
  if (!item) return res.status(404).json({ error: "Agenda item not found" });
  await db.delete(agendaItemsTable).where(eq(agendaItemsTable.id, params.itemId));
  return res.status(204).send();
});

router.get("/events/:eventId/displays", async (req, res) => {
  const params = ListDisplaysParams.parse(req.params);
  const displays = await db.select().from(displaysTable).where(eq(displaysTable.eventId, params.eventId));
  res.json(displays.map(displayPayload));
});

router.post("/events/:eventId/displays", async (req, res) => {
  const params = CreateDisplayParams.parse(req.params);
  const body = CreateDisplayBody.parse(req.body);
  const [display] = await db
    .insert(displaysTable)
    .values({
      id: id(),
      eventId: params.eventId,
      name: body.name,
      kind: body.kind,
      assignedLayout: body.assignedLayout ?? "focus",
      connectionStatus: "online",
      lastSeenAt: new Date(),
      currentContent: "Ready to receive live timing",
    })
    .returning();
  res.status(201).json(displayPayload(display));
});

router.delete("/displays/:displayId", async (req, res) => {
  const params = DeleteDisplayParams.parse(req.params);
  await db.delete(displaysTable).where(eq(displaysTable.id, params.displayId));
  res.status(204).send();
});

router.get("/events/:eventId/session", async (req, res) => {
  const params = GetLiveSessionParams.parse(req.params);
  const session = await ensureSession(params.eventId, (await getAgenda(params.eventId))[0]?.id);
  const current = await persistTick(session);
  res.json(sessionPayload(current));
});

router.post("/events/:eventId/session", async (req, res) => {
  const params = ControlLiveSessionParams.parse(req.params);
  const body = ControlLiveSessionBody.parse(req.body);
  let session = await ensureSession(params.eventId, (await getAgenda(params.eventId))[0]?.id);
  session = await persistTick(session);
  const agenda = await getAgenda(params.eventId);
  const activeIndex = agenda.findIndex((item) => item.id === session.activeItemId);
  let nextValues: Partial<typeof liveSessionsTable.$inferInsert> = {
    lastCommandAt: new Date(),
  };

  switch (body.action) {
    case "start":
    case "resume":
      nextValues.state = "running";
      nextValues.startedAt = session.startedAt ?? new Date();
      nextValues.pausedAt = null;
      if (!session.activeItemId && agenda[0]) {
        nextValues.activeItemId = agenda[0].id;
        nextValues.remainingSeconds = agenda[0].plannedDurationMinutes * 60;
      }
      break;
    case "pause":
      nextValues.state = "paused";
      nextValues.pausedAt = new Date();
      break;
    case "reset": {
      const item = agenda[activeIndex >= 0 ? activeIndex : 0];
      nextValues.state = "idle";
      nextValues.elapsedSeconds = 0;
      nextValues.activeItemId = item?.id ?? null;
      nextValues.remainingSeconds = item ? item.plannedDurationMinutes * 60 : 0;
      nextValues.startedAt = null;
      nextValues.pausedAt = null;
      break;
    }
    case "restart": {
      const item = agenda[activeIndex >= 0 ? activeIndex : 0];
      nextValues.state = "running";
      nextValues.elapsedSeconds = 0;
      nextValues.remainingSeconds = item ? item.plannedDurationMinutes * 60 : 0;
      nextValues.startedAt = new Date();
      nextValues.pausedAt = null;
      break;
    }
    case "add_time":
      nextValues.remainingSeconds = session.remainingSeconds + (body.amountSeconds ?? 60);
      break;
    case "subtract_time":
      nextValues.remainingSeconds = session.remainingSeconds - (body.amountSeconds ?? 60);
      break;
    case "next":
    case "previous":
    case "jump": {
      const targetIndex =
        body.action === "jump" && body.itemId
          ? agenda.findIndex((item) => item.id === body.itemId)
          : activeIndex + (body.action === "next" ? 1 : -1);
      const item = agenda[Math.min(Math.max(targetIndex, 0), Math.max(agenda.length - 1, 0))];
      nextValues.activeItemId = item?.id ?? null;
      nextValues.remainingSeconds = item ? item.plannedDurationMinutes * 60 : 0;
      nextValues.elapsedSeconds = 0;
      nextValues.state = "paused";
      break;
    }
  }

  const updated = await db.transaction(async (tx) => {
    const [nextSession] = await tx
      .update(liveSessionsTable)
      .set(nextValues)
      .where(eq(liveSessionsTable.eventId, params.eventId))
      .returning();

    const isNavigation = body.action === "next" || body.action === "previous" || body.action === "jump";
    const isStarting = body.action === "start" || body.action === "resume" || body.action === "restart";
    if (isNavigation || isStarting) {
      await tx
        .update(agendaItemsTable)
        .set({ status: "queued" })
        .where(and(eq(agendaItemsTable.eventId, params.eventId), eq(agendaItemsTable.status, "active")));
    }
    if (isNavigation && body.action === "next" && session.activeItemId && session.activeItemId !== nextSession.activeItemId) {
      await tx
        .update(agendaItemsTable)
        .set({ status: "complete", actualEndedAt: new Date() })
        .where(eq(agendaItemsTable.id, session.activeItemId));
    }
    if (nextSession.activeItemId && (isNavigation || isStarting)) {
      await tx
        .update(agendaItemsTable)
        .set({
          status: "active",
          ...(isStarting ? { actualStartedAt: new Date(), actualEndedAt: null } : {}),
        })
        .where(eq(agendaItemsTable.id, nextSession.activeItemId));
    }
    if (isStarting) {
      await tx.update(eventsTable).set({ status: "live", updatedAt: new Date() }).where(eq(eventsTable.id, params.eventId));
    }
    return nextSession;
  });
  res.json(sessionPayload(updated));
});

router.post("/events/:eventId/messages", async (req, res) => {
  const params = SendOperatorMessageParams.parse(req.params);
  const body = SendOperatorMessageBody.parse(req.body);
  const [session] = await db
    .update(liveSessionsTable)
    .set({ operatorMessage: body.message, lastCommandAt: new Date() })
    .where(eq(liveSessionsTable.eventId, params.eventId))
    .returning();
  res.json({
    id: id(),
    eventId: params.eventId,
    message: body.message,
    priority: body.priority ?? "normal",
    target: body.target,
    expiresAt: body.expiresInSeconds ? new Date(Date.now() + body.expiresInSeconds * 1000).toISOString() : null,
  });
  req.log.info({ eventId: params.eventId, target: body.target }, "Sent operator message");
  void session;
});

router.post("/events/:eventId/cues", async (req, res) => {
  const params = TriggerCueParams.parse(req.params);
  const body = TriggerCueBody.parse(req.body);
  await db
    .update(liveSessionsTable)
    .set({ activeCue: body.label, lastCommandAt: new Date() })
    .where(eq(liveSessionsTable.eventId, params.eventId));
  res.json({
    id: id(),
    eventId: params.eventId,
    label: body.label,
    triggeredAt: nowIso(),
  });
});

export default router;