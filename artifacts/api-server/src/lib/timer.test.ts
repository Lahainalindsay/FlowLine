import assert from "node:assert/strict";
import test from "node:test";
import { createSessionTransition, projectSession, type TimerSession } from "./timer.js";

const anchor = new Date("2026-01-01T10:00:00.000Z");
const session: TimerSession = {
  state: "running", activeItemId: "opening", remainingSeconds: 10, elapsedSeconds: 50,
  startedAt: anchor, pausedAt: null, timerAnchorAt: anchor, lastCommandAt: anchor, revision: 4,
};

test("projects advancing timers and changes to overtime at zero", () => {
  assert.deepEqual(projectSession(session, new Date("2026-01-01T10:00:12.000Z")), {
    remainingSeconds: -2, elapsedSeconds: 62, state: "overtime",
  });
});

test("pausing persists the projected counters at the command anchor", () => {
  const now = new Date("2026-01-01T10:00:03.000Z");
  const next = createSessionTransition(session, [], { action: "pause" }, now);
  assert.equal(next.state, "paused");
  assert.equal(next.remainingSeconds, 7);
  assert.equal(next.elapsedSeconds, 53);
  assert.equal(next.pausedAt, now);
  assert.equal(next.revision, 5);
});

test("time additions recover an overtime timer and navigation selects an agenda item", () => {
  const overtime = { ...session, state: "overtime", remainingSeconds: -5 };
  assert.equal(createSessionTransition(overtime, [], { action: "add_time", amountSeconds: 10 }, anchor).state, "running");
  const next = createSessionTransition(session, [
    { id: "opening", plannedDurationMinutes: 5 },
    { id: "keynote", plannedDurationMinutes: 20 },
  ], { action: "next" }, anchor);
  assert.deepEqual(
    { state: next.state, activeItemId: next.activeItemId, remainingSeconds: next.remainingSeconds, elapsedSeconds: next.elapsedSeconds },
    { state: "paused", activeItemId: "keynote", remainingSeconds: 1200, elapsedSeconds: 0 },
  );
});