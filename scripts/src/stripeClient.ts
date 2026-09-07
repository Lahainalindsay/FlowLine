import { ReplitConnectors } from "@replit/connectors-sdk";

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

async function proxy(path: string, method = "GET", body?: Record<string, unknown>) {
  const response = await new ReplitConnectors().proxy("stripe", path, { method, body: body ? encodeStripeForm(body) : undefined, headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(typeof data.error?.message === "string" ? data.error.message : `Stripe request failed (${response.status}).`);
  return data;
}

export const stripeProxy = {
  listProducts: () => proxy("/v1/products?active=true&limit=100"),
  listPrices: () => proxy("/v1/prices?active=true&type=recurring&limit=100"),
  createProduct: (values: Record<string, unknown>) => proxy("/v1/products", "POST", values),
  updateProduct: (id: string, values: Record<string, unknown>) => proxy(`/v1/products/${encodeURIComponent(id)}`, "POST", values),
  createPrice: (values: Record<string, unknown>) => proxy("/v1/prices", "POST", values),
  updatePrice: (id: string, values: Record<string, unknown>) => proxy(`/v1/prices/${encodeURIComponent(id)}`, "POST", values),
};