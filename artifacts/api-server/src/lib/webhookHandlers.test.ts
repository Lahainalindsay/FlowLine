import assert from "node:assert/strict";
import test from "node:test";
import { canonicalEventId } from "./billing.js";
import { encodeStripeForm, stripeRequestHeaders } from "./stripeClient.js";

test("only accepts a minimally parsed Stripe event id", () => {
  assert.equal(canonicalEventId(Buffer.from('{"id":"evt_123ABC"}')), "evt_123ABC");
  assert.equal(canonicalEventId(Buffer.from('{"id":"cs_test_123"}')), null);
  assert.equal(canonicalEventId(Buffer.from('{"id":"evt_123","type":"forged"}')), "evt_123");
  assert.equal(canonicalEventId(Buffer.from("not json")), null);
});

test("Stripe request headers retain stable idempotency keys", () => {
  assert.deepEqual(stripeRequestHeaders(true, { "Idempotency-Key": "stagetime:ws_1:attempt_1" }), {
    "Content-Type": "application/x-www-form-urlencoded",
    "Idempotency-Key": "stagetime:ws_1:attempt_1",
  });
});

test("encodes Stripe nested form request bodies", () => {
  assert.equal(
    encodeStripeForm({ automatic_tax: { enabled: true }, metadata: { workspaceId: "ws_1" }, line_items: [{ price: "price_1", quantity: 1 }] }),
    "automatic_tax%5Benabled%5D=true&metadata%5BworkspaceId%5D=ws_1&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1",
  );
});