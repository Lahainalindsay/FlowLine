import assert from "node:assert/strict";
import test from "node:test";
import { calculateBehindScheduleMinutes, calculateProjectedFinish } from "./event-schedule.js";

const session = {
  state: "running", activeItemId: "one", remainingSeconds: 300, elapsedSeconds: 0,
  startedAt: new Date("2026-01-10T15:10:00.000Z"), pausedAt: null,
  timerAnchorAt: new Date("2026-01-10T15:10:00.000Z"), lastCommandAt: new Date("2026-01-10T15:10:00.000Z"), revision: 1,
};
const agenda = [
  { id: "one", position: 1, plannedDurationMinutes: 10, plannedStart: "10:00", status: "active", actualStartedAt: new Date("2026-01-10T15:10:00.000Z") },
  { id: "two", position: 2, plannedDurationMinutes: 15, plannedStart: "10:10", status: "queued", actualStartedAt: null },
];

test("projected finish uses projected active time plus remaining agenda", () => {
  assert.equal(calculateProjectedFinish(session, agenda, new Date("2026-01-10T15:11:00.000Z")), "2026-01-10T15:30:00.000Z");
});

test("behind schedule reports local active-start lateness or null without schedule data", () => {
  assert.equal(calculateBehindScheduleMinutes("2026-01-10", "America/New_York", session, agenda), 10);
  assert.equal(calculateBehindScheduleMinutes("2026-01-10", "America/New_York", session, [{ ...agenda[0], plannedStart: null }]), null);
});