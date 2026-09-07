import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, stripeWebhookEventsTable, subscriptionsTable } from "@workspace/db";
import { canonicalEventId, planForSubscription, selectCurrentSubscription, shouldClearPendingCheckout, shouldProcessWebhookLedgerEntry, type PaidPlan, type StripeSubscriptionSnapshot } from "./billing";
import { stripeProxy } from "./stripeClient";

function customerId(value: any) {
  return typeof value === "string" ? value : typeof value?.id === "string" ? value.id : null;
}
function subscriptionPlan(subscription: any): PaidPlan | null {
  const value = subscription.metadata?.stagetime_plan ?? subscription.items?.data?.[0]?.price?.product?.metadata?.stagetime_plan;
  return value === "PRO" || value === "BUSINESS" ? value : null;
}
function workspaceFrom(subscription: any) {
  return typeof subscription?.metadata?.workspaceId === "string" ? subscription.metadata.workspaceId : null;
}

export async function syncStageTimeSubscription(subscription: any, workspaceId: string) {
  const status = String(subscription.status ?? "inactive");
  const values = {
    plan: planForSubscription(status, subscriptionPlan(subscription)),
    status,
    stripeCustomerId: customerId(subscription.customer),
    stripeSubscriptionId: subscription.id ?? null,
    currentPeriodEndsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    ...(shouldClearPendingCheckout(status) ? { checkoutAttemptId: null, checkoutRequestedPlan: null, checkoutSessionId: null, checkoutAttemptExpiresAt: null } : {}),
  };
  await db.insert(subscriptionsTable).values({ id: randomUUID(), workspaceId, ...values })
    .onConflictDoUpdate({ target: subscriptionsTable.workspaceId, set: values });
}

export async function reconcileCustomerSubscriptions(customer: string, canonicalObject: any, log?: { warn: (value: unknown, message: string) => void }) {
  const response = await stripeProxy.listSubscriptions(customer) as { data?: StripeSubscriptionSnapshot[] };
  const { subscription, multipleActive } = selectCurrentSubscription(response.data ?? []);
  if (multipleActive) log?.warn({ customer }, "Multiple active Stripe subscriptions found; using newest");
  const workspaceId = workspaceFrom(subscription) ?? workspaceFrom(canonicalObject)
    ?? (await db.select({ workspaceId: subscriptionsTable.workspaceId }).from(subscriptionsTable).where(eq(subscriptionsTable.stripeCustomerId, customer)).limit(1))[0]?.workspaceId;
  if (!workspaceId) return;
  if (subscription) {
    await syncStageTimeSubscription({ ...subscription, customer }, workspaceId);
  } else {
    await db.update(subscriptionsTable).set({ plan: "STARTER", status: "inactive", stripeSubscriptionId: null, checkoutAttemptId: null, checkoutRequestedPlan: null, checkoutSessionId: null, checkoutAttemptExpiresAt: null }).where(eq(subscriptionsTable.workspaceId, workspaceId));
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, log?: { warn: (value: unknown, message: string) => void }) {
    if (!Buffer.isBuffer(payload)) throw new Error("Stripe webhook payload must be raw bytes.");
    if (!signature.trim()) throw new Error("Stripe webhook signature is required.");
    // Connector-native verification: incoming bytes only supply an evt_ id.
    // Canonical Stripe data is retrieved via the authenticated connector.
    const eventId = canonicalEventId(payload);
    if (!eventId) throw new Error("Invalid Stripe event identifier.");
    const event = await stripeProxy.getEvent(eventId) as { id?: string; type?: string; created?: number; data?: { object?: any } };
    if (event.id !== eventId || !event.type || !event.created) throw new Error("Canonical Stripe event was invalid.");
    const [ledger] = await db.select().from(stripeWebhookEventsTable).where(eq(stripeWebhookEventsTable.eventId, event.id)).limit(1);
    if (!shouldProcessWebhookLedgerEntry(ledger)) return;
    await db.insert(stripeWebhookEventsTable).values({ eventId: event.id, eventType: event.type, stripeCreatedAt: new Date(event.created * 1000) }).onConflictDoNothing();
    const object = event.data?.object;
    const needsReconciliation = event.type === "checkout.session.completed" || event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted";
    if (needsReconciliation && object) {
      const customer = customerId(object.customer);
      if (customer) {
        await reconcileCustomerSubscriptions(customer, object, log);
      }
    }
    await db.update(stripeWebhookEventsTable).set({ processedAt: new Date() }).where(eq(stripeWebhookEventsTable.eventId, event.id));
  }
}