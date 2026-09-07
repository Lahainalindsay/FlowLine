export type TimerState = "idle" | "running" | "paused" | "overtime" | "completed";
export type SessionAction =
  | "start"
  | "pause"
  | "resume"
  | "reset"
  | "complete"
  | "add_time"
  | "subtract_time"
  | "next"
  | "next_session"
  | "previous"
  | "restart"
  | "jump";

export interface TimerSession {
  state: string;
  activeItemId: string | null;
  remainingSeconds: number;
  elapsedSeconds: number;
  startedAt: Date | null;
  pausedAt: Date | null;
  timerAnchorAt: Date | null;
  lastCommandAt: Date;
  revision: number;
}

export interface TimerAgendaItem {
  id: string;
  plannedDurationMinutes: number;
}

export interface TimerCommand {
  action: SessionAction;
  amountSeconds?: number | null;
  itemId?: string | null;
}

export function projectSession(session: TimerSession, at = new Date()) {
  const anchorAt = session.timerAnchorAt ?? session.lastCommandAt;
  const tick = (session.state === "running" || session.state === "overtime") && anchorAt
    ? Math.max(0, Math.floor((at.getTime() - anchorAt.getTime()) / 1000))
    : 0;
  const remainingSeconds = session.remainingSeconds - tick;
  const elapsedSeconds = session.elapsedSeconds + tick;
  const state: TimerState = (session.state === "running" || session.state === "overtime") && remainingSeconds <= 0
    ? "overtime"
    : session.state as TimerState;
  return { remainingSeconds, elapsedSeconds, state };
}

export function createSessionTransition(
  session: TimerSession,
  agenda: readonly TimerAgendaItem[],
  command: TimerCommand,
  now: Date,
) {
  const projected = projectSession(session, now);
  const activeIndex = agenda.findIndex((item) => item.id === session.activeItemId);
  const active = agenda[activeIndex >= 0 ? activeIndex : 0];
  const nextValues: {
    remainingSeconds: number;
    elapsedSeconds: number;
    state: TimerState;
    timerAnchorAt: Date;
    lastCommandAt: Date;
    revision: number;
    activeItemId?: string | null;
    startedAt?: Date | null;
    pausedAt?: Date | null;
  } = {
    remainingSeconds: projected.remainingSeconds,
    elapsedSeconds: projected.elapsedSeconds,
    state: projected.state,
    timerAnchorAt: now,
    lastCommandAt: now,
    revision: session.revision + 1,
  };

  switch (command.action) {
    case "start":
      nextValues.state = "running"; nextValues.startedAt = session.startedAt ?? now; nextValues.pausedAt = null;
      if (active && (!session.activeItemId || (session.state === "idle" && session.elapsedSeconds === 0 && session.remainingSeconds === 0))) {
        nextValues.activeItemId = active.id; nextValues.remainingSeconds = active.plannedDurationMinutes * 60; nextValues.elapsedSeconds = 0;
      }
      break;
    case "resume":
      nextValues.state = "running"; nextValues.startedAt = session.startedAt ?? now; nextValues.pausedAt = null; break;
    case "pause":
      nextValues.state = "paused"; nextValues.pausedAt = now; break;
    case "reset":
      nextValues.state = "idle"; nextValues.activeItemId = active?.id ?? null; nextValues.remainingSeconds = active ? active.plannedDurationMinutes * 60 : 0;
      nextValues.elapsedSeconds = 0; nextValues.startedAt = null; nextValues.pausedAt = null; break;
    case "restart":
      nextValues.state = "running"; nextValues.remainingSeconds = active ? active.plannedDurationMinutes * 60 : 0; nextValues.elapsedSeconds = 0;
      nextValues.startedAt = now; nextValues.pausedAt = null; break;
    case "complete":
      nextValues.state = "completed"; nextValues.pausedAt = now; break;
    case "add_time":
      nextValues.remainingSeconds = projected.remainingSeconds + (command.amountSeconds ?? 60);
      if (projected.state === "running" || projected.state === "overtime") {
        nextValues.state = nextValues.remainingSeconds > 0 ? "running" : "overtime";
      }
      break;
    case "subtract_time":
      nextValues.remainingSeconds = projected.remainingSeconds - (command.amountSeconds ?? 60);
      if (projected.state === "running" || projected.state === "overtime") {
        nextValues.state = nextValues.remainingSeconds > 0 ? "running" : "overtime";
      }
      break;
    case "next":
    case "next_session":
    case "previous":
    case "jump": {
      const targetIndex = command.action === "jump" && command.itemId ? agenda.findIndex((item) => item.id === command.itemId)
        : activeIndex + ((command.action === "next" || command.action === "next_session") ? 1 : -1);
      const item = agenda[Math.min(Math.max(targetIndex, 0), Math.max(agenda.length - 1, 0))];
      nextValues.activeItemId = item?.id ?? null; nextValues.remainingSeconds = item ? item.plannedDurationMinutes * 60 : 0;
      nextValues.elapsedSeconds = 0; nextValues.state = "paused"; nextValues.pausedAt = now; nextValues.startedAt = null; break;
    }
  }

  return nextValues;
}