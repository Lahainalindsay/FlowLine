import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEntitlement, roleCan } from "./workspace-policy.js";

test("role permissions distinguish viewers, operators, and owners", () => {
  assert.equal(roleCan("VIEWER", "event:read"), true);
  assert.equal(roleCan("VIEWER", "event:write"), false);
  assert.equal(roleCan("OPERATOR", "live:control"), true);
  assert.equal(roleCan("ADMIN", "billing:read"), true);
  assert.equal(roleCan("OWNER", "billing:read"), true);
});

test("entitlements allow capacity below a plan limit only", () => {
  assert.deepEqual(evaluateEntitlement("STARTER", "activeEvents", 2), {
    allowed: true, plan: "STARTER", limit: 3,
  });
  assert.deepEqual(evaluateEntitlement("PRO", "members", 15), {
    allowed: false, plan: "PRO", limit: 15,
  });
});