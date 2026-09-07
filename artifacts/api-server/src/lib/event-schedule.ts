import { projectSession, type TimerSession } from "./timer.js";

export type ScheduledAgendaItem = {
  id: string;
  position: number;
  plannedDurationMinutes: number;
  plannedStart: string | null;
  status: string;
  actualStartedAt: Date | null;
};

function localClockParts(at: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(at);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    const year = part("year"); const month = part("month"); const day = part("day");
    const hour = part("hour"); const minute = part("minute");
    if (!year || !month || !day || !hour || !minute) return null;
    return { date: `${year}-${month}-${day}`, minutes: Number(hour) * 60 + Number(minute) };
  } catch {
    return null;
  }
}

function plannedMinutes(value: string | null) {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function calculateProjectedFinish(session: TimerSession, agenda: readonly ScheduledAgendaItem[], at = new Date()) {
  if (session.state === "completed") return null;
  const active = agenda.find((item) => item.id === session.activeItemId);
  const remainingItems = agenda.filter((item) =>
    item.status !== "complete" && item.status !== "skipped" && (!active || item.position > active.position),
  );
  const remainingSeconds = active ? projectSession(session, at).remainingSeconds : 0;
  const futureSeconds = remainingItems.reduce((sum, item) => sum + item.plannedDurationMinutes * 60, 0);
  if (!active && futureSeconds === 0) return null;
  return new Date(at.getTime() + (remainingSeconds + futureSeconds) * 1000).toISOString();
}

/**
 * Returns local wall-clock lateness for the active segment only. It avoids
 * converting an ambiguous local planned time to an instant, so it intentionally
 * does not claim DST-transition precision.
 */
export function calculateBehindScheduleMinutes(
  eventDate: string,
  timeZone: string,
  session: TimerSession,
  agenda: readonly ScheduledAgendaItem[],
) {
  const active = agenda.find((item) => item.id === session.activeItemId);
  const actualStart = active?.actualStartedAt ?? (active ? session.startedAt : null);
  const planned = plannedMinutes(active?.plannedStart ?? null);
  if (!active || !actualStart || planned === null) return null;
  const actual = localClockParts(actualStart, timeZone);
  if (!actual || actual.date !== eventDate) return null;
  return Math.max(0, actual.minutes - planned);
}