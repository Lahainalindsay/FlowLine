import { ReplitConnectors } from "@replit/connectors-sdk";

type StripeObject = Record<string, any>;

export function encodeStripeForm(values: Record<string, unknown>) {
  const form = new URLSearchParams();
  const append = (key: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) return value.forEach((entry, index) => append(`${key}[${index}]`, entry));
    if (typeof value === "object") return Object.entries(value as Record<string, unknown>).forEach(([child, entry]) => append(`${key}[${child}]`, entry));
    form.append(key, String(value));
  };
  Object.entries(values).forEach(([key, value]) => append(key, value));
  return form.toString();
}
export function stripeRequestHeaders(hasBody: boolean, extraHeaders: Record<string, string> = {}) {
  return { ...(hasBody ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...extraHeaders };
}

async function proxy(path: string, method = "GET", body?: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  // A fresh client per request lets the connector obtain/rotate authorization;
  // connection credentials intentionally never enter this process.
  const response = await new ReplitConnectors().proxy("stripe", path, {
    method,
    body: body ? encodeStripeForm(body) : undefined,
    headers: stripeRequestHeaders(Boolean(body), extraHeaders),
  });
  const data = await response.json().catch(() => ({})) as StripeObject;
  if (!response.ok) throw new Error(typeof data.error?.message === "string" ? data.error.message : `Stripe request failed (${response.status}).`);
  return data;
}

function query(path: string, params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  return search.size ? `${path}?${search}` : path;
}

export const stripeProxy = {
  listProducts: () => proxy(query("/v1/products", { active: true, limit: 100 })),
  listPrices: (product?: string) => proxy(query("/v1/prices", { active: true, type: "recurring", product, limit: 100 })),
  createProduct: (values: Record<string, unknown>) => proxy("/v1/products", "POST", values),
  createPrice: (values: Record<string, unknown>) => proxy("/v1/prices", "POST", values),
  createCustomer: (values: Record<string, unknown>) => proxy("/v1/customers", "POST", values),
  createCheckoutSession: (values: Record<string, unknown>, idempotencyKey: string) => proxy("/v1/checkout/sessions", "POST", values, { "Idempotency-Key": idempotencyKey }),
  getCheckoutSession: (id: string) => proxy(`/v1/checkout/sessions/${encodeURIComponent(id)}`),
  createPortalSession: (values: Record<string, unknown>) => proxy("/v1/billing_portal/sessions", "POST", values),
  getEvent: (id: string) => proxy(`/v1/events/${encodeURIComponent(id)}`),
  getSubscription: (id: string) => proxy(`/v1/subscriptions/${encodeURIComponent(id)}?expand[]=items.data.price.product`),
  listSubscriptions: (customer: string) => proxy(`/v1/subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100&expand[]=data.items.data.price.product`),
  listWebhookEndpoints: () => proxy(query("/v1/webhook_endpoints", { limit: 100 })),
  createWebhookEndpoint: (values: Record<string, unknown>) => proxy("/v1/webhook_endpoints", "POST", values),
  updateWebhookEndpoint: (id: string, values: Record<string, unknown>) => proxy(`/v1/webhook_endpoints/${encodeURIComponent(id)}`, "POST", values),
};