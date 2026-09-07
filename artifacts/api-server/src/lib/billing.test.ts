import assert from "node:assert/strict";
import test from "node:test";
import { billingEntitlementFlags, decideCheckoutAttempt, hasExactWebhookEvents, hasManagedStripeSubscription, isPaidPlan, planForSubscription, safeReturnUrl, selectCurrentSubscription, selectOfficialPlanPrice, shouldClearPendingCheckout, shouldProcessWebhookLedgerEntry, STAGETIME_CATALOG_MARKER } from "./billing.js";

test("checkout plans are allowlisted", () => {
  assert.equal(isPaidPlan("PRO"), true);
  assert.equal(isPaidPlan("BUSINESS"), true);
  assert.equal(isPaidPlan("STARTER"), false);
  assert.equal(isPaidPlan("price_untrusted"), false);
});

test("subscription status only entitles active paid plans", () => {
  assert.equal(planForSubscription("active", "PRO"), "PRO");
  assert.equal(planForSubscription("trialing", "BUSINESS"), "BUSINESS");
  assert.equal(planForSubscription("canceled", "PRO"), "STARTER");
  assert.equal(planForSubscription("past_due", "PRO"), "STARTER");
});

test("return URLs remain on the requesting origin", () => {
  assert.equal(safeReturnUrl("/billing?complete=1", "https://app.example"), "https://app.example/billing?complete=1");
  assert.equal(safeReturnUrl("https://evil.example/return", "https://app.example"), null);
});

test("all nonterminal managed subscriptions must use billing resolution", () => {
  for (const status of ["active", "trialing", "incomplete", "past_due", "unpaid", "paused", "unknown_future_status"]) {
    assert.equal(hasManagedStripeSubscription({ stripeSubscriptionId: "sub_1", status }), true);
  }
  assert.equal(hasManagedStripeSubscription({ stripeSubscriptionId: "sub_1", status: "canceled" }), false);
  assert.equal(hasManagedStripeSubscription({ stripeSubscriptionId: "sub_1", status: "incomplete_expired" }), false);
});

test("selection prefers entitled, then recoverable, then terminal subscriptions", () => {
  assert.equal(selectCurrentSubscription([{ id: "terminal_new", status: "canceled", created: 30 }, { id: "recoverable_old", status: "past_due", created: 10 }]).subscription?.id, "recoverable_old");
  assert.equal(selectCurrentSubscription([{ id: "recoverable_new", status: "unpaid", created: 30 }, { id: "active_old", status: "active", created: 10 }]).subscription?.id, "active_old");
  assert.equal(selectCurrentSubscription([{ id: "terminal_old", status: "canceled", created: 10 }, { id: "terminal_new", status: "incomplete_expired", created: 30 }]).subscription?.id, "terminal_new");
});

test("pending checkout clears only for entitled, terminal, or absent subscriptions", () => {
  for (const status of ["incomplete", "past_due", "unpaid", "paused", "unknown"]) assert.equal(shouldClearPendingCheckout(status), false);
  for (const status of ["active", "trialing", "canceled", "incomplete_expired"]) assert.equal(shouldClearPendingCheckout(status), true);
  assert.equal(shouldClearPendingCheckout(null), true);
});

test("billing entitlement flags distinguish recovery from upgrades", () => {
  assert.deepEqual(billingEntitlementFlags({ stripeSubscriptionId: "sub_1", status: "past_due" }, true), { billingManagementRequired: true, upgradesAvailable: false });
  assert.deepEqual(billingEntitlementFlags({ stripeSubscriptionId: "sub_1", status: "active" }, true), { billingManagementRequired: false, upgradesAvailable: false });
  assert.deepEqual(billingEntitlementFlags({ stripeSubscriptionId: null, status: "active" }, true), { billingManagementRequired: false, upgradesAvailable: true });
  assert.deepEqual(billingEntitlementFlags({ stripeSubscriptionId: null, status: "active" }, false), { billingManagementRequired: false, upgradesAvailable: false });
});

test("reconciliation selects the newest currently entitled subscription", () => {
  const result = selectCurrentSubscription([{ id: "sub_old", status: "canceled", created: 20 }, { id: "sub_active", status: "active", created: 10 }, { id: "sub_trial", status: "trialing", created: 30 }]);
  assert.equal(result.subscription?.id, "sub_trial");
  assert.equal(result.multipleActive, true);
});

test("managed endpoint event set is exact", () => {
  assert.equal(hasExactWebhookEvents(["customer.subscription.deleted", "checkout.session.completed", "customer.subscription.updated", "customer.subscription.created"]), true);
  assert.equal(hasExactWebhookEvents(["invoice.paid"]), false);
});

test("processed webhook ledger entries are replay-safe", () => {
  assert.equal(shouldProcessWebhookLedgerEntry({ processedAt: new Date() }), false);
  assert.equal(shouldProcessWebhookLedgerEntry({ processedAt: null }), true);
});

test("official price selection rejects legacy, wrong amount, and ambiguous catalogs", () => {
  const products = [{ id: "prod_1", active: true, metadata: { stagetime_plan: "PRO", stagetime_catalog: STAGETIME_CATALOG_MARKER } }];
  const exact = { id: "price_exact", product: "prod_1", active: true, currency: "usd", unit_amount: 1900, recurring: { interval: "month" }, metadata: { stagetime_plan: "PRO", stagetime_catalog: STAGETIME_CATALOG_MARKER } };
  assert.equal(selectOfficialPlanPrice("PRO", products, [exact])?.id, "price_exact");
  assert.equal(selectOfficialPlanPrice("PRO", products, [{ ...exact, metadata: { stagetime_plan: "PRO" } }]), null);
  assert.equal(selectOfficialPlanPrice("PRO", products, [{ ...exact, unit_amount: 5900 }]), null);
  assert.equal(selectOfficialPlanPrice("PRO", products, [exact, { ...exact, id: "price_duplicate" }]), null);
});

test("pending Checkout attempts reuse, conflict, or replace based on durable state", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(decideCheckoutAttempt({ attemptId: "a", requestedPlan: "PRO", sessionId: "cs_1", expiresAt: new Date("2026-01-01T00:10:00Z") }, "PRO", now).action, "retrieve");
  assert.equal(decideCheckoutAttempt({ attemptId: "a", requestedPlan: "PRO", sessionId: null, expiresAt: new Date("2026-01-01T00:10:00Z") }, "PRO", now).action, "create");
  assert.equal(decideCheckoutAttempt({ attemptId: "a", requestedPlan: "BUSINESS", sessionId: null, expiresAt: new Date("2026-01-01T00:10:00Z") }, "PRO", now).action, "conflict");
  assert.equal(decideCheckoutAttempt({ attemptId: "a", requestedPlan: "BUSINESS", sessionId: null, expiresAt: new Date("2025-12-31T23:00:00Z") }, "PRO", now).action, "allocate");
});