import assert from "node:assert/strict";
import test from "node:test";
import { DisplayCodeRateLimiter } from "./display-code-rate-limit.js";

test("display code resolution is rate limited per IP and resets after its window", () => {
  const limiter = new DisplayCodeRateLimiter(2, 10_000);
  assert.deepEqual(limiter.consume("203.0.113.1", 0), { allowed: true });
  assert.deepEqual(limiter.consume("203.0.113.1", 1), { allowed: true });
  assert.deepEqual(limiter.consume("203.0.113.1", 2), { allowed: false, retryAfterSeconds: 10 });
  assert.deepEqual(limiter.consume("203.0.113.1", 10_000), { allowed: true });
});

test("display code rate limiter bounds retained IP entries", () => {
  const limiter = new DisplayCodeRateLimiter(1, 60_000, 2);
  limiter.consume("203.0.113.1", 0);
  limiter.consume("203.0.113.2", 0);
  limiter.consume("203.0.113.3", 0);
  // The oldest entry was evicted to retain a bounded number of keys.
  assert.deepEqual(limiter.consume("203.0.113.1", 1), { allowed: true });
});