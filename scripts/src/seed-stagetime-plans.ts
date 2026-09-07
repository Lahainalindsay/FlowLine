import { stripeProxy } from "./stripeClient.js";

export type CatalogProduct = { id: string; active: boolean; metadata: Record<string, string> };
export type CatalogPrice = { id: string; active: boolean; currency: string; unit_amount: number | null; recurring: { interval: string } | null; product: string | { id: string }; metadata?: Record<string, string> };

export function findMatchingMonthlyPrice(products: CatalogProduct[], prices: CatalogPrice[], plan: "PRO" | "BUSINESS", amount: number) {
  const productIds = new Set(products.filter((product) => product.active && product.metadata.stagetime_plan === plan).map((product) => product.id));
  return prices.filter((price) => productIds.has(typeof price.product === "string" ? price.product : price.product.id) && price.active && price.currency === "usd" && price.unit_amount === amount && price.recurring?.interval === "month").sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

export const STAGETIME_TAX_CODE = "txcd_10103001";
export const STAGETIME_CATALOG_MARKER = "official_v1";

export function needsStageTimeTaxCode(product: { tax_code?: string | null }) {
  return product.tax_code !== STAGETIME_TAX_CODE;
}

export function planNeedsTaxCodeCorrection(product: { tax_code?: string | null }, _matchingPriceExists: boolean) {
  return needsStageTimeTaxCode(product);
}

export function needsOfficialMetadata(metadata: Record<string, string> | undefined, plan: "PRO" | "BUSINESS") {
  return metadata?.stagetime_plan !== plan || metadata?.stagetime_catalog !== STAGETIME_CATALOG_MARKER;
}

async function ensurePlan(plan: "PRO" | "BUSINESS", name: string, amount: number) {
  const products = (await stripeProxy.listProducts()).data as (CatalogProduct & { tax_code?: string | null })[];
  const prices = (await stripeProxy.listPrices()).data as CatalogPrice[];
  let product = products.find((item) => item.metadata.stagetime_plan === plan);
  if (!product) product = await stripeProxy.createProduct({ name, metadata: { stagetime_plan: plan, stagetime_catalog: STAGETIME_CATALOG_MARKER }, tax_code: STAGETIME_TAX_CODE }) as CatalogProduct;
  else if (planNeedsTaxCodeCorrection(product, Boolean(findMatchingMonthlyPrice(products, prices, plan, amount))) || needsOfficialMetadata(product.metadata, plan)) await stripeProxy.updateProduct(product.id, { tax_code: STAGETIME_TAX_CODE, metadata: { stagetime_plan: plan, stagetime_catalog: STAGETIME_CATALOG_MARKER } });
  const matching = findMatchingMonthlyPrice(products, prices, plan, amount);
  if (matching) {
    if (needsOfficialMetadata(matching.metadata, plan)) await stripeProxy.updatePrice(matching.id, { metadata: { stagetime_plan: plan, stagetime_catalog: STAGETIME_CATALOG_MARKER } });
    return { productId: product.id, priceId: matching.id };
  }
  const created = await stripeProxy.createPrice({ product: product.id, currency: "usd", unit_amount: amount, recurring: { interval: "month" }, metadata: { stagetime_plan: plan, stagetime_catalog: STAGETIME_CATALOG_MARKER } });
  return { productId: product.id, priceId: created.id as string };
}

async function main() {
  const [pro, business] = await Promise.all([
    ensurePlan("PRO", "StageTime Pro", 1900),
    ensurePlan("BUSINESS", "StageTime Business", 5900),
  ]);
  console.log(JSON.stringify({ pro, business }));
}
if (process.argv[1]?.endsWith("seed-stagetime-plans.ts")) {
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Plan seeding failed"); process.exitCode = 1; });
}