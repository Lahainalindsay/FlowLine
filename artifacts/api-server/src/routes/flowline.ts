import { Router, type IRouter, type RequestHandler } from "express";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getAuth } from "@clerk/express";
import {
  ApplyAgendaImportBody,
  ApplyAgendaImportParams,
  AgendaImportInput,
  CreateAgendaItemBody,
  CreateAgendaItemParams,
  CreateDisplayBody,
  CreateDisplayParams,
  CreateDisplayAccessBody,
  CreateDisplayAccessParams,
  CreateEventBody,
  ControlLiveSessionBody,
  ControlLiveSessionParams,
  DeleteAgendaItemParams,
  DeleteDisplayParams,
  DeleteEventParams,
  GetEventParams,
  GetLiveSessionParams,
  GetPublicDisplayStateParams,
  ListAgendaItemsParams,
  ListDisplaysParams,
  PreviewAgendaImportBody,
  PreviewAgendaImportParams,
  ReorderAgendaItemsBody,
  ReorderAgendaItemsParams,
  ResolveDisplayCodeBody,
  RevokeDisplayAccessParams,
  SendOperatorMessageBody,
  SendOperatorMessageParams,
  TriggerCueBody,
  TriggerCueParams,
  UpdateAgendaItemBody,
  UpdateAgendaItemParams,
  UpdateEventBody,
  CreateInvitationBody,
  CreateInvitationResponse,
  CreateTemplateBody,
  CreateTemplateResponse,
  DeleteTemplateParams,
  GetBillingEntitlementResponse,
  GetWorkspaceSummaryResponse,
  ListAuditLogsResponse,
  ListInvitationsResponse,
  ListTeamMembersResponse,
  ListTemplatesResponse,
  RevokeInvitationParams,
  UpdateTeamMemberRoleBody,
  UpdateTeamMemberRoleParams,
  UpdateTeamMemberRoleResponse,
  UpdateTemplateBody,
  UpdateTemplateParams,
  UpdateTemplateResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  agendaItemsTable,
  displayAccessTable,
  displaysTable,
  eventsTable,
  liveSessionCommandsTable,
  liveSessionsTable,
  workspaceMembersTable,
  appUsersTable,
  auditLogsTable,
  subscriptionsTable,
  timerTemplatesTable,
  workspaceInvitationsTable,
  workspacesTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { ensurePersonalWorkspace, getWorkspaceMembership, getWorkspacePlan, mayCreate, PLAN_ENTITLEMENTS, roleCan, type Permission } from "../lib/workspace";
import { beginSse, publishSnapshots, sendSnapshot, subscribeOperator, subscribePublic } from "../lib/realtime";
import { createSessionTransition, projectSession } from "../lib/timer";

const router: IRouter = Router();

const nowIso = () => new Date().toISOString();
const id = () => randomUUID();
const accessSecret = process.env.SESSION_SECRET ?? (() => {
  throw new Error("SESSION_SECRET is required for guest display access");
})();

const codeHash = (code: string) =>
  createHash("sha256").update(code.toUpperCase().replace(/\s/g, "")).digest("hex");

function createAccessToken(accessId: string, expiresAt: Date) {
  const payload = `${accessId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  const signature = createHmac("sha256", accessSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function parseAccessToken(token: string) {
  const [accessId, expiresRaw, signature] = token.split(".");
  if (!accessId || !expiresRaw || !signature) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return null;
  const payload = `${accessId}.${expiresRaw}`;
  const expected = createHmac("sha256", accessSecret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return { accessId, expiresAt: new Date(expiresAt * 1000) };
}

const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId as string | undefined || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.userId = userId;
  next();
};

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
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [concurrent] = await db.select().from(liveSessionsTable)
    .where(eq(liveSessionsTable.eventId, eventId)).limit(1);
  if (!concurrent) throw new Error("Unable to initialize live session");
  return concurrent;
}

function sessionPayload(session: typeof liveSessionsTable.$inferSelect, at = new Date()) {
  const projection = projectSession(session, at);
  return {
    eventId: session.eventId,
    state: projection.state,
    activeItemId: session.activeItemId,
    // Counters intentionally remain at the persisted anchor. A reader must
    // project from timerAnchorAt rather than treating a polling response as a
    // new mutable timer value.
    remainingSeconds: session.remainingSeconds,
    elapsedSeconds: session.elapsedSeconds,
    timerAnchorAt: (session.timerAnchorAt ?? session.lastCommandAt).toISOString(),
    serverTime: at.toISOString(),
    revision: session.revision,
    startedAt: iso(session.startedAt),
    pausedAt: iso(session.pausedAt),
    operatorMessage: session.operatorMessage,
    activeCue: session.activeCue,
  };
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

async function publicDisplaySnapshot(accessId: string, eventType: string) {
  const [access] = await db.select().from(displayAccessTable)
    .where(eq(displayAccessTable.id, accessId)).limit(1);
  if (!access || access.revokedAt || access.expiresAt <= new Date()) return null;
  const [[event], [display], agenda, session] = await Promise.all([
    db.select().from(eventsTable).where(eq(eventsTable.id, access.eventId)).limit(1),
    db.select().from(displaysTable).where(and(eq(displaysTable.id, access.displayId), eq(displaysTable.eventId, access.eventId))).limit(1),
    getAgenda(access.eventId),
    ensureSession(access.eventId),
  ]);
  if (!event || !display) return null;
  const rawSession = sessionPayload(session);
  // Do not expose internal cue state or agenda notes to an untrusted surface.
  const { activeCue: _activeCue, ...sessionPayloadPublic } = rawSession;
  return {
    eventType,
    revision: session.revision,
    serverTime: new Date().toISOString(),
    state: {
      event: { name: event.name, timezone: event.timezone },
      display: displayPayload(display),
      agenda: agenda.map(({ notes: _notes, ...item }) => agendaPayload({ ...item, notes: null })).map(({ notes: _notes, ...item }) => item),
      session: sessionPayloadPublic,
    },
  };
}

async function operatorSnapshot(eventId: string, eventType: string) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!event) return null;
  const detail = await eventPayload(event);
  const [agenda, displays] = await Promise.all([
    getAgenda(eventId),
    db.select().from(displaysTable).where(eq(displaysTable.eventId, eventId)),
  ]);
  return {
    eventType,
    revision: detail.session.revision,
    serverTime: new Date().toISOString(),
    state: { ...detail, agenda: agenda.map(agendaPayload), displays: displays.map(displayPayload) },
  };
}

async function publishRealtime(eventId: string, eventType: string, bumpRevision = true) {
  if (bumpRevision) {
    await db.update(liveSessionsTable)
      .set({ revision: sql`${liveSessionsTable.revision} + 1`, lastCommandAt: new Date() })
      .where(eq(liveSessionsTable.eventId, eventId));
  }
  await publishSnapshots(
    eventId,
    eventType,
    () => operatorSnapshot(eventId, eventType),
    (accessId) => publicDisplaySnapshot(accessId, eventType),
  );
}

router.post("/display-access/resolve", async (req, res) => {
  const body = ResolveDisplayCodeBody.parse(req.body);
  const [access] = await db
    .select()
    .from(displayAccessTable)
    .where(eq(displayAccessTable.codeHash, codeHash(body.code)))
    .orderBy(desc(displayAccessTable.createdAt))
    .limit(1);
  if (!access || access.revokedAt || access.expiresAt <= new Date()) {
    res.status(404).json({ error: "This display code is invalid or expired" });
    return;
  }
  res.json({ token: createAccessToken(access.id, access.expiresAt) });
});

router.get("/display-access/:token", async (req, res) => {
  const params = GetPublicDisplayStateParams.parse(req.params);
  const parsed = parseAccessToken(params.token);
  if (!parsed) {
    res.status(401).json({ error: "Display access expired" });
    return;
  }
  const [access] = await db
    .select()
    .from(displayAccessTable)
    .where(eq(displayAccessTable.id, parsed.accessId))
    .limit(1);
  if (!access || access.revokedAt || access.expiresAt <= new Date()) {
    res.status(401).json({ error: "Display access expired" });
    return;
  }
  const [[event], [display], agenda, session] = await Promise.all([
    db.select().from(eventsTable).where(eq(eventsTable.id, access.eventId)).limit(1),
    db.select().from(displaysTable).where(and(eq(displaysTable.id, access.displayId), eq(displaysTable.eventId, access.eventId))).limit(1),
    getAgenda(access.eventId),
    ensureSession(access.eventId),
  ]);
  if (!event || !display) {
    res.status(404).json({ error: "Display not found" });
    return;
  }
  await Promise.all([
    db.update(displayAccessTable).set({ lastSeenAt: new Date() }).where(eq(displayAccessTable.id, access.id)),
    db.update(displaysTable).set({ lastSeenAt: new Date(), connectionStatus: "online" }).where(eq(displaysTable.id, display.id)),
  ]);
  res.json({
    event: { name: event.name, timezone: event.timezone },
    display: displayPayload({ ...display, lastSeenAt: new Date(), connectionStatus: "online" }),
    agenda: agenda.map(agendaPayload),
    session: sessionPayload(session),
  });
});

router.get("/display-access/:token/stream", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const parsed = parseAccessToken(token);
  if (!parsed) { res.status(401).json({ error: "Display access expired" }); return; }
  const snapshot = await publicDisplaySnapshot(parsed.accessId, "snapshot");
  if (!snapshot) { res.status(401).json({ error: "Display access expired" }); return; }
  beginSse(res);
  sendSnapshot(res, "snapshot", snapshot);
  const [access] = await db.select({ eventId: displayAccessTable.eventId }).from(displayAccessTable)
    .where(eq(displayAccessTable.id, parsed.accessId)).limit(1);
  if (!access) { res.end(); return; }
  subscribePublic(access.eventId, parsed.accessId, res);
  // A token may be revoked after connecting. Periodic validation closes it
  // rather than relying on the next application update.
  const validator = setInterval(async () => {
    const valid = await publicDisplaySnapshot(parsed.accessId, "heartbeat");
    if (!valid) { clearInterval(validator); res.end(); }
  }, 30_000);
  res.on("close", () => clearInterval(validator));
});

router.use(requireAuth);

router.use(async (req, res, next) => {
  try {
    res.locals.personalWorkspaceId = await ensurePersonalWorkspace(res.locals.userId);
    next();
  } catch (error) {
    req.log.error({ error, userId: res.locals.userId }, "Failed to provision personal workspace");
    res.status(500).json({ error: "Unable to initialize workspace" });
  }
});

function requiredEventPermission(req: { method: string; path: string }): Permission {
  if (req.method === "GET") return "event:read";
  if (req.path.includes("/session") || req.path.includes("/messages") || req.path.includes("/cues")) return "live:control";
  if (req.path.includes("/displays") || req.path.includes("/display-access")) return "display:manage";
  return "event:write";
}

router.use("/events/:eventId", async (req, res, next) => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const [event] = await db
    .select({ id: eventsTable.id, role: workspaceMembersTable.role })
    .from(eventsTable)
    .innerJoin(workspaceMembersTable, eq(workspaceMembersTable.workspaceId, eventsTable.workspaceId))
    .where(and(eq(eventsTable.id, eventId), eq(workspaceMembersTable.userId, res.locals.userId)))
    .limit(1);
  const permission = requiredEventPermission(req);
  if (!event || !roleCan(event.role, permission)) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  next();
});

router.use("/agenda/:itemId", async (req, res, next) => {
  const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
  const [owned] = await db
    .select({ id: agendaItemsTable.id, role: workspaceMembersTable.role })
    .from(agendaItemsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, agendaItemsTable.eventId))
    .innerJoin(workspaceMembersTable, eq(workspaceMembersTable.workspaceId, eventsTable.workspaceId))
    .where(and(eq(agendaItemsTable.id, itemId), eq(workspaceMembersTable.userId, res.locals.userId)))
    .limit(1);
  if (!owned || !roleCan(owned.role, req.method === "GET" ? "event:read" : "event:write")) {
    res.status(404).json({ error: "Agenda item not found" });
    return;
  }
  next();
});

router.use("/displays/:displayId", async (req, res, next) => {
  const displayId = Array.isArray(req.params.displayId) ? req.params.displayId[0] : req.params.displayId;
  const [owned] = await db
    .select({ id: displaysTable.id, role: workspaceMembersTable.role })
    .from(displaysTable)
    .innerJoin(eventsTable, eq(eventsTable.id, displaysTable.eventId))
    .innerJoin(workspaceMembersTable, eq(workspaceMembersTable.workspaceId, eventsTable.workspaceId))
    .where(and(eq(displaysTable.id, displayId), eq(workspaceMembersTable.userId, res.locals.userId)))
    .limit(1);
  if (!owned || !roleCan(owned.role, "display:manage")) {
    res.status(404).json({ error: "Display not found" });
    return;
  }
  next();
});

router.get("/dashboard/summary", async (req, res) => {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .innerJoin(workspaceMembersTable, eq(workspaceMembersTable.workspaceId, eventsTable.workspaceId))
      .where(eq(workspaceMembersTable.userId, res.locals.userId))
      .orderBy(asc(eventsTable.date), desc(eventsTable.updatedAt));
    const summaries = await Promise.all(events.map((row) => eventPayload(row.flowline_events)));
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
      .innerJoin(workspaceMembersTable, eq(workspaceMembersTable.workspaceId, eventsTable.workspaceId))
      .where(eq(workspaceMembersTable.userId, res.locals.userId))
      .orderBy(asc(eventsTable.date), desc(eventsTable.updatedAt));
    res.json(await Promise.all(events.map((row) => eventPayload(row.flowline_events))));
  } catch (error) {
    req.log.error({ error }, "Failed to list events");
    res.status(500).json({ error: "Unable to list events" });
  }
});

router.post("/events", async (req, res) => {
  const body = CreateEventBody.parse(req.body);
  const eventId = id();
  try {
    const workspaceId = res.locals.personalWorkspaceId as string;
    const existing = await db.select({ id: eventsTable.id }).from(eventsTable)
      .where(and(eq(eventsTable.workspaceId, workspaceId), sql`${eventsTable.status} <> 'completed'`));
    const entitlement = await mayCreate(workspaceId, "activeEvents", existing.length);
    if (!entitlement.allowed) {
      res.status(403).json({ error: `${entitlement.plan} allows up to ${entitlement.limit} active events. Complete or delete an event to create another.` });
      return;
    }
    const [event] = await db
      .insert(eventsTable)
      .values({
        id: eventId,
        ownerUserId: res.locals.userId,
        workspaceId,
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
  void publishRealtime(params.eventId, "event");
  return res.json(await eventPayload(event));
});

router.delete("/events/:eventId", async (req, res) => {
  const params = DeleteEventParams.parse(req.params);
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.eventId)).limit(1);
  if (!event) return res.status(404).json({ error: "Event not found" });
  await db.delete(agendaItemsTable).where(eq(agendaItemsTable.eventId, params.eventId));
  await db.delete(displaysTable).where(eq(displaysTable.eventId, params.eventId));
  await db.delete(liveSessionCommandsTable).where(eq(liveSessionCommandsTable.eventId, params.eventId));
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
  void publishRealtime(params.eventId, "agenda");
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
  void publishRealtime(params.eventId, "agenda");
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
  void publishRealtime(params.eventId, "agenda");
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
  void publishRealtime(item.eventId, "agenda");
  return res.json(agendaPayload(item));
});

router.delete("/agenda/:itemId", async (req, res) => {
  const params = DeleteAgendaItemParams.parse(req.params);
  const [item] = await db.select().from(agendaItemsTable).where(eq(agendaItemsTable.id, params.itemId)).limit(1);
  if (!item) return res.status(404).json({ error: "Agenda item not found" });
  await db.delete(agendaItemsTable).where(eq(agendaItemsTable.id, params.itemId));
  void publishRealtime(item.eventId, "agenda");
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
  void publishRealtime(params.eventId, "display");
  res.status(201).json(displayPayload(display));
});

router.delete("/displays/:displayId", async (req, res) => {
  const params = DeleteDisplayParams.parse(req.params);
  const [display] = await db.select({ eventId: displaysTable.eventId }).from(displaysTable).where(eq(displaysTable.id, params.displayId)).limit(1);
  await db.delete(displaysTable).where(eq(displaysTable.id, params.displayId));
  if (display) void publishRealtime(display.eventId, "display");
  res.status(204).send();
});

router.get("/events/:eventId/session", async (req, res) => {
  const params = GetLiveSessionParams.parse(req.params);
  const session = await ensureSession(params.eventId, (await getAgenda(params.eventId))[0]?.id);
  res.json(sessionPayload(session));
});

router.get("/events/:eventId/stream", async (req, res): Promise<void> => {
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const snapshot = await operatorSnapshot(eventId, "snapshot");
  if (!snapshot) { res.status(404).json({ error: "Event not found" }); return; }
  beginSse(res);
  sendSnapshot(res, "snapshot", snapshot);
  subscribeOperator(eventId, res);
});

router.post("/events/:eventId/session", async (req, res) => {
  const params = ControlLiveSessionParams.parse(req.params);
  const body = ControlLiveSessionBody.parse(req.body);
  await ensureSession(params.eventId, (await getAgenda(params.eventId))[0]?.id);
  const result = await db.transaction(async (tx) => {
    // Lock the single event session so a command is projected and sequenced
    // against one authoritative state, not against a stale polling read.
    const [session] = await tx.select().from(liveSessionsTable)
      .where(eq(liveSessionsTable.eventId, params.eventId)).for("update").limit(1);
    if (!session) throw new Error("Live session was not created");

    const [duplicate] = await tx.select().from(liveSessionCommandsTable)
      .where(and(eq(liveSessionCommandsTable.eventId, params.eventId), eq(liveSessionCommandsTable.commandId, body.commandId))).limit(1);
    if (duplicate) return { kind: "success" as const, session, idempotent: true };
    if (session.revision !== body.expectedRevision) return { kind: "conflict" as const, session };

    const now = new Date();
    const agenda = await tx.select().from(agendaItemsTable)
      .where(eq(agendaItemsTable.eventId, params.eventId)).orderBy(asc(agendaItemsTable.position));
    const activeIndex = agenda.findIndex((item) => item.id === session.activeItemId);
    const navigation = body.action === "next" || body.action === "next_session" || body.action === "previous" || body.action === "jump";
    const starting = body.action === "start" || body.action === "resume" || body.action === "restart";
    const nextValues = createSessionTransition(session, agenda, body, now);

    const [nextSession] = await tx.update(liveSessionsTable).set(nextValues)
      .where(and(eq(liveSessionsTable.eventId, params.eventId), eq(liveSessionsTable.revision, body.expectedRevision))).returning();
    if (!nextSession) return { kind: "conflict" as const, session: (await tx.select().from(liveSessionsTable).where(eq(liveSessionsTable.eventId, params.eventId)).limit(1))[0] };

    if (navigation || starting || body.action === "complete") {
      await tx.update(agendaItemsTable).set({ status: "queued" }).where(and(eq(agendaItemsTable.eventId, params.eventId), eq(agendaItemsTable.status, "active")));
    }
    if ((body.action === "next" || body.action === "next_session" || body.action === "complete") && session.activeItemId) {
      await tx.update(agendaItemsTable).set({ status: "complete", actualEndedAt: now }).where(eq(agendaItemsTable.id, session.activeItemId));
    }
    if (nextSession.activeItemId && (navigation || starting)) {
      await tx.update(agendaItemsTable).set({ status: "active", ...(starting ? { actualStartedAt: now, actualEndedAt: null } : {}) }).where(eq(agendaItemsTable.id, nextSession.activeItemId));
    }
    if (starting) await tx.update(eventsTable).set({ status: "live", updatedAt: now }).where(eq(eventsTable.id, params.eventId));
    if (body.action === "complete") await tx.update(eventsTable).set({ status: "completed", updatedAt: now }).where(eq(eventsTable.id, params.eventId));
    await tx.insert(liveSessionCommandsTable).values({
      id: id(), eventId: params.eventId, commandId: body.commandId, expectedRevision: body.expectedRevision,
      resultingRevision: nextSession.revision, action: body.action, actorUserId: res.locals.userId,
      payload: { amountSeconds: body.amountSeconds ?? null, itemId: body.itemId ?? null },
    });
    return { kind: "success" as const, session: nextSession, idempotent: false };
  });
  if (result.kind === "conflict") {
    req.log.warn({ eventId: params.eventId, expectedRevision: body.expectedRevision, actualRevision: result.session?.revision, commandId: body.commandId }, "Rejected stale live-session command");
    res.status(409).json({ error: "Live session changed; reconcile and retry", session: sessionPayload(result.session) });
    return;
  }
  req.log.info({ eventId: params.eventId, action: body.action, revision: result.session.revision, commandId: body.commandId, idempotent: result.idempotent }, "Applied live-session command");
  if (!result.idempotent) void publishRealtime(params.eventId, "session", false);
  res.json(sessionPayload(result.session));
});

router.post("/events/:eventId/messages", async (req, res) => {
  const params = SendOperatorMessageParams.parse(req.params);
  const body = SendOperatorMessageBody.parse(req.body);
  const [session] = await db
    .update(liveSessionsTable)
    .set({ operatorMessage: body.message, lastCommandAt: new Date(), revision: sql`${liveSessionsTable.revision} + 1` })
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
  if (session) void publishRealtime(params.eventId, "message", false);
});

router.post("/events/:eventId/cues", async (req, res) => {
  const params = TriggerCueParams.parse(req.params);
  const body = TriggerCueBody.parse(req.body);
  await db
    .update(liveSessionsTable)
    .set({ activeCue: body.label, lastCommandAt: new Date(), revision: sql`${liveSessionsTable.revision} + 1` })
    .where(eq(liveSessionsTable.eventId, params.eventId));
  res.json({
    id: id(),
    eventId: params.eventId,
    label: body.label,
    triggeredAt: nowIso(),
  });
  void publishRealtime(params.eventId, "cue", false);
});

router.post("/events/:eventId/display-access", async (req, res) => {
  const params = CreateDisplayAccessParams.parse(req.params);
  const body = CreateDisplayAccessBody.parse(req.body);
  const [display] = await db
    .select()
    .from(displaysTable)
    .where(and(eq(displaysTable.id, body.displayId), eq(displaysTable.eventId, params.eventId)))
    .limit(1);
  if (!display) {
    res.status(404).json({ error: "Display not found" });
    return;
  }
  const expiresAt = new Date(Date.now() + (body.expiresInMinutes ?? 480) * 60_000);
  const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  const accessId = id();
  await db.transaction(async (tx) => {
    await tx
      .update(displayAccessTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(displayAccessTable.eventId, params.eventId), eq(displayAccessTable.displayId, body.displayId)));
    await tx.insert(displayAccessTable).values({
      id: accessId,
      eventId: params.eventId,
      displayId: body.displayId,
      codeHash: codeHash(code),
      expiresAt,
    });
  });
  res.status(201).json({
    id: accessId,
    eventId: params.eventId,
    displayId: body.displayId,
    code,
    token: createAccessToken(accessId, expiresAt),
    expiresAt: expiresAt.toISOString(),
  });
});

router.post("/display-access/:accessId/revoke", async (req, res) => {
  const params = RevokeDisplayAccessParams.parse(req.params);
  const [owned] = await db
    .select({ id: displayAccessTable.id, eventId: displayAccessTable.eventId, role: workspaceMembersTable.role })
    .from(displayAccessTable)
    .innerJoin(eventsTable, eq(eventsTable.id, displayAccessTable.eventId))
    .innerJoin(workspaceMembersTable, eq(workspaceMembersTable.workspaceId, eventsTable.workspaceId))
    .where(and(eq(displayAccessTable.id, params.accessId), eq(workspaceMembersTable.userId, res.locals.userId)))
    .limit(1);
  if (!owned || !roleCan(owned.role, "display:manage")) {
    res.status(404).json({ error: "Display access not found" });
    return;
  }
  await db.update(displayAccessTable).set({ revokedAt: new Date() }).where(eq(displayAccessTable.id, params.accessId));
  void publishRealtime(owned.eventId, "display");
  res.status(204).send();
});

async function personalMembership(userId: string, workspaceId: string, permission: Permission) {
  const membership = await getWorkspaceMembership(workspaceId, userId);
  return membership && roleCan(membership.role, permission) ? membership : null;
}

async function audit(workspaceId: string, actorUserId: string, action: string, entityType: string, entityId?: string) {
  await db.insert(auditLogsTable).values({ id: id(), workspaceId, actorUserId, action, entityType, entityId: entityId ?? null, metadata: {} });
}

router.get("/workspace/summary", async (req, res) => {
  const workspaceId = res.locals.personalWorkspaceId as string;
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const membership = await personalMembership(res.locals.userId, workspaceId, "workspace:read");
  if (!workspace || !membership) { res.status(403).json({ error: "Workspace access denied" }); return; }
  const plan = await getWorkspacePlan(workspaceId);
  res.json(GetWorkspaceSummaryResponse.parse({ id: workspace.id, name: workspace.name, role: membership.role, plan, entitlements: PLAN_ENTITLEMENTS[plan] }));
});

router.get("/templates", async (req, res) => {
  const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "template:read")) { res.status(403).json({ error: "Template access denied" }); return; }
  const templates = await db.select().from(timerTemplatesTable).where(eq(timerTemplatesTable.workspaceId, workspaceId)).orderBy(desc(timerTemplatesTable.updatedAt));
  res.json(ListTemplatesResponse.parse(templates.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))));
});

router.post("/templates", async (req, res) => {
  const body = CreateTemplateBody.parse(req.body); const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "template:write")) { res.status(403).json({ error: "Template access denied" }); return; }
  const templates = await db.select({ id: timerTemplatesTable.id }).from(timerTemplatesTable).where(eq(timerTemplatesTable.workspaceId, workspaceId));
  const entitlement = await mayCreate(workspaceId, "templates", templates.length);
  if (!entitlement.allowed) { res.status(403).json({ error: `${entitlement.plan} allows up to ${entitlement.limit} templates.` }); return; }
  const [template] = await db.insert(timerTemplatesTable).values({ id: id(), workspaceId, name: body.name, description: body.description ?? null, definition: body.definition, createdByUserId: res.locals.userId }).returning();
  await audit(workspaceId, res.locals.userId, "template.created", "template", template.id);
  req.log.info({ workspaceId, templateId: template.id }, "Created timer template");
  res.status(201).json(CreateTemplateResponse.parse({ ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() }));
});

router.patch("/templates/:templateId", async (req, res) => {
  const params = UpdateTemplateParams.parse(req.params); const body = UpdateTemplateBody.parse(req.body); const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "template:write")) { res.status(403).json({ error: "Template access denied" }); return; }
  const [template] = await db.update(timerTemplatesTable).set(body).where(and(eq(timerTemplatesTable.id, params.templateId), eq(timerTemplatesTable.workspaceId, workspaceId))).returning();
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  await audit(workspaceId, res.locals.userId, "template.updated", "template", template.id);
  res.json(UpdateTemplateResponse.parse({ ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() }));
});

router.delete("/templates/:templateId", async (req, res) => {
  const params = DeleteTemplateParams.parse(req.params); const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "template:write")) { res.status(403).json({ error: "Template access denied" }); return; }
  const [template] = await db.delete(timerTemplatesTable).where(and(eq(timerTemplatesTable.id, params.templateId), eq(timerTemplatesTable.workspaceId, workspaceId))).returning();
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  await audit(workspaceId, res.locals.userId, "template.deleted", "template", template.id); res.status(204).send();
});

router.get("/team/members", async (req, res) => {
  const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "team:read")) { res.status(403).json({ error: "Team access denied" }); return; }
  const rows = await db.select({ id: workspaceMembersTable.id, userId: workspaceMembersTable.userId, role: workspaceMembersTable.role, createdAt: workspaceMembersTable.createdAt, displayName: appUsersTable.displayName, email: appUsersTable.email }).from(workspaceMembersTable).innerJoin(appUsersTable, eq(appUsersTable.clerkUserId, workspaceMembersTable.userId)).where(eq(workspaceMembersTable.workspaceId, workspaceId));
  res.json(ListTeamMembersResponse.parse(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))));
});

router.patch("/team/members/:memberId/role", async (req, res) => {
  const params = UpdateTeamMemberRoleParams.parse(req.params); const body = UpdateTeamMemberRoleBody.parse(req.body); const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "team:manage")) { res.status(403).json({ error: "Team access denied" }); return; }
  const [member] = await db.update(workspaceMembersTable).set({ role: body.role }).where(and(eq(workspaceMembersTable.id, params.memberId), eq(workspaceMembersTable.workspaceId, workspaceId), sql`${workspaceMembersTable.role} <> 'OWNER'`)).returning();
  if (!member) { res.status(404).json({ error: "Member not found or is workspace owner" }); return; }
  await audit(workspaceId, res.locals.userId, "member.role_changed", "member", member.id);
  res.json(UpdateTeamMemberRoleResponse.parse({ ...member, createdAt: member.createdAt.toISOString() }));
});

router.get("/team/invitations", async (req, res) => {
  const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "team:read")) { res.status(403).json({ error: "Team access denied" }); return; }
  const rows = await db.select().from(workspaceInvitationsTable).where(eq(workspaceInvitationsTable.workspaceId, workspaceId)).orderBy(desc(workspaceInvitationsTable.createdAt));
  res.json(ListInvitationsResponse.parse(rows.map((row) => ({ ...row, expiresAt: row.expiresAt.toISOString(), acceptedAt: iso(row.acceptedAt), revokedAt: iso(row.revokedAt), createdAt: row.createdAt.toISOString() }))));
});

router.post("/team/invitations", async (req, res) => {
  const body = CreateInvitationBody.parse(req.body); const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "team:manage")) { res.status(403).json({ error: "Team access denied" }); return; }
  const members = await db.select({ id: workspaceMembersTable.id }).from(workspaceMembersTable).where(eq(workspaceMembersTable.workspaceId, workspaceId));
  const entitlement = await mayCreate(workspaceId, "members", members.length);
  if (!entitlement.allowed) { res.status(403).json({ error: `${entitlement.plan} allows up to ${entitlement.limit} members.` }); return; }
  const expiresAt = new Date(Date.now() + (body.expiresInDays ?? 7) * 86_400_000);
  const [invitation] = await db.insert(workspaceInvitationsTable).values({ id: id(), workspaceId, email: body.email.toLowerCase(), role: body.role, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"), invitedByUserId: res.locals.userId, expiresAt }).returning();
  await audit(workspaceId, res.locals.userId, "invitation.created", "invitation", invitation.id);
  req.log.info({ workspaceId, invitationId: invitation.id }, "Created workspace invitation");
  res.status(201).json(CreateInvitationResponse.parse({ ...invitation, expiresAt: invitation.expiresAt.toISOString(), acceptedAt: null, revokedAt: null, createdAt: invitation.createdAt.toISOString() }));
});

router.post("/team/invitations/:invitationId/revoke", async (req, res) => {
  const params = RevokeInvitationParams.parse(req.params); const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "team:manage")) { res.status(403).json({ error: "Team access denied" }); return; }
  const [invitation] = await db.update(workspaceInvitationsTable).set({ revokedAt: new Date() }).where(and(eq(workspaceInvitationsTable.id, params.invitationId), eq(workspaceInvitationsTable.workspaceId, workspaceId))).returning();
  if (!invitation) { res.status(404).json({ error: "Invitation not found" }); return; }
  await audit(workspaceId, res.locals.userId, "invitation.revoked", "invitation", invitation.id); res.status(204).send();
});

router.get("/audit", async (req, res) => {
  const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "audit:read")) { res.status(403).json({ error: "Audit access denied" }); return; }
  const rows = await db.select().from(auditLogsTable).where(eq(auditLogsTable.workspaceId, workspaceId)).orderBy(desc(auditLogsTable.createdAt)).limit(100);
  res.json(ListAuditLogsResponse.parse(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))));
});

router.get("/billing", async (req, res) => {
  const workspaceId = res.locals.personalWorkspaceId as string;
  if (!await personalMembership(res.locals.userId, workspaceId, "billing:read")) { res.status(403).json({ error: "Billing access denied" }); return; }
  const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.workspaceId, workspaceId)).limit(1);
  const plan = subscription?.plan ?? "STARTER";
  res.json(GetBillingEntitlementResponse.parse({ plan, status: subscription?.status ?? "active", entitlements: PLAN_ENTITLEMENTS[plan], upgradesAvailable: false }));
});

export default router;