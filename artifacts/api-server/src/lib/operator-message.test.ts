import assert from "node:assert/strict";
import test from "node:test";
import { visibleOperatorMessage } from "./operator-message.js";

const speaker = { id: "speaker-display", kind: "speaker" };
const stage = { id: "stage-display", kind: "stage" };
const now = new Date("2026-01-01T12:00:00.000Z");

test("operator messages retain all-target delivery and isolate display targets", () => {
  assert.equal(visibleOperatorMessage("Stand by", "all", null, stage, now), "Stand by");
  assert.equal(visibleOperatorMessage("Speaker only", "speaker", null, speaker, now), "Speaker only");
  assert.equal(visibleOperatorMessage("Speaker only", "speaker", null, stage, now), null);
  assert.equal(visibleOperatorMessage("Specific display", "display:stage-display", null, stage, now), "Specific display");
});

test("expired operator messages are omitted for every recipient", () => {
  assert.equal(
    visibleOperatorMessage("Expired", "all", new Date("2026-01-01T11:59:59.000Z"), speaker, now),
    null,
  );
});