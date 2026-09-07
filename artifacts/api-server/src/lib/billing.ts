export const PAID_PLANS = ["PRO", "BUSINESS"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export const STAGETIME_CATALOG_MARKER = "official_v1";
export const PAID_PLAN_DEFINITIONS = Object.freeze({
  PRO: Object.freeze({ unitAmount: 1900, currency: "usd", interval: "month", catalogMarker: STAGETIME_CATALOG_MARKER }),
  BUSINESS: Object.freeze({ unitAmount: 5900, currency: "usd", interval: "month", catalogMarker: STAGETIME_CATALOG_MARKER }),
}) satisfies Record<PaidPlan, { unitAmount: number; currency: "usd"; interval: "month"; catalogMarker: string }>;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === "string" && (PAID_PLANS as readonly string[]).includes(value);
}

export function planForSubscription(status: string, plan: PaidPlan | null): "STARTER" | PaidPlan {
  return plan && (status === "active" || status === "trialing") ? plan : "STARTER";
}

export const TERMINAL_STRIPE_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);
export function hasManagedStripeSubscription(subscription: { stripeSubscriptionId: string | null; status: string } | null | undefined) {
  return Boolean(subscription?.stripeSubscriptionId && !TERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status));
}

export type StripeSubscriptionSnapshot = { id: string; status: string; created?: number; metadata?: Record<string, string>; items?: { data?: Array<{ price?: { product?: { metadata?: Record<string, string> } } }> } };
export function selectCurrentSubscription(subscriptions: StripeSubscriptionSnapshot[]) {
  const newest = (items: StripeSubscriptionSnapshot[]) => [...items].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null;
  const entitled = subscriptions.filter((item) => item.status === "active" || item.status === "trialing");
  const recoverable = subscriptions.filter((item) => !TERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(item.status) && item.status !== "active" && item.status !== "trialing");
  const terminal = subscriptions.filter((item) => TERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(item.status));
  return { subscription: newest(entitled) ?? newest(recoverable) ?? newest(terminal), multipleActive: entitled.length > 1 };
}

export function shouldClearPendingCheckout(status: string | null) {
  return status === null || status === "active" || status === "trialing" || TERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(status);
}

export function billingEntitlementFlags(subscription: { stripeSubscriptionId: string | null; status: string } | null | undefined, catalogHealthy: boolean) {
  const managed = hasManagedStripeSubscription(subscription);
  const entitled = subscription?.status === "active" || subscription?.status === "trialing";
  return { billingManagementRequired: managed && !entitled, upgradesAvailable: !managed && catalogHealthy };
}

export const STAGETIME_WEBHOOK_EVENTS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"] as const;
export function hasExactWebhookEvents(events: readonly string[] | undefined) {
  return JSON.stringify([...(events ?? [])].sort()) === JSON.stringify([...STAGETIME_WEBHOOK_EVENTS].sort());
}
export function shouldProcessWebhookLedgerEntry(entry: { processedAt: Date | null } | null | undefined) {
  return !entry?.processedAt;
}

type CatalogProduct = { id: string; active?: boolean; metadata?: Record<string, string> };
type CatalogPrice = { id: string; active?: boolean; currency?: string; unit_amount?: number | null; recurring?: { interval?: string } | null; metadata?: Record<string, string>; product?: string | CatalogProduct };
export function selectOfficialPlanPrice(plan: PaidPlan, products: CatalogProduct[], prices: CatalogPrice[]) {
  const definition = PAID_PLAN_DEFINITIONS[plan];
  const productIds = new Set(products.filter((product) => product.active && product.metadata?.stagetime_plan === plan && product.metadata?.stagetime_catalog === definition.catalogMarker).map((product) => product.id));
  const matches = prices.filter((price) => {
    const productId = typeof price.product === "string" ? price.product : price.product?.id;
    return Boolean(productId && productIds.has(productId) && price.active && price.currency === definition.currency && price.unit_amount === definition.unitAmount && price.recurring?.interval === definition.interval && price.metadata?.stagetime_plan === plan && price.metadata?.stagetime_catalog === definition.catalogMarker);
  });
  return matches.length === 1 ? matches[0] : null;
}

export type PendingCheckoutState = { attemptId: string | null; requestedPlan: string | null; sessionId: string | null; expiresAt: Date | null };
export function decideCheckoutAttempt(state: PendingCheckoutState, plan: PaidPlan, now: Date) {
  const open = Boolean(state.attemptId && state.expiresAt && state.expiresAt > now);
  if (!open) return { action: "allocate" as const };
  if (state.requestedPlan !== plan) return { action: "conflict" as const };
  return state.sessionId ? { action: "retrieve" as const, attemptId: state.attemptId!, sessionId: state.sessionId } : { action: "create" as const, attemptId: state.attemptId! };
}

export function safeReturnUrl(value: unknown, requestOrigin: string) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, requestOrigin);
    const origin = new URL(requestOrigin).origin;
    return url.origin === origin && url.pathname.startsWith("/") ? url.toString() : null;
  } catch { return null; }
}

/** Extracts only an event identifier; webhook fields are never trusted. */
export function canonicalEventId(payload: Buffer) {
  try {
    const candidate = JSON.parse(payload.toString("utf8")) as { id?: unknown };
    return typeof candidate.id === "string" && /^evt_[A-Za-z0-9]+$/.test(candidate.id) ? candidate.id : null;
  } catch { return null; }
}