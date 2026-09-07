import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingMonthlyPrice, needsOfficialMetadata, needsStageTimeTaxCode, planNeedsTaxCodeCorrection, STAGETIME_CATALOG_MARKER, STAGETIME_TAX_CODE } from "./seed-stagetime-plans.js";

test("seed matching reuses an active matching StageTime price", () => {
  const price = findMatchingMonthlyPrice(
    [{ id: "prod_pro", active: true, metadata: { stagetime_plan: "PRO" } }],
    [{ id: "price_pro", product: "prod_pro", active: true, currency: "usd", unit_amount: 1900, recurring: { interval: "month" } }],
    "PRO",
    1900,
  );
  assert.equal(price?.id, "price_pro");
});

test("seed updates only products without the StageTime SaaS tax code", () => {
  assert.equal(needsStageTimeTaxCode({ tax_code: STAGETIME_TAX_CODE }), false);
  assert.equal(needsStageTimeTaxCode({ tax_code: null }), true);
});

test("an existing matching price does not bypass tax correction", () => {
  assert.equal(planNeedsTaxCodeCorrection({ tax_code: null }, true), true);
  assert.equal(needsOfficialMetadata({ stagetime_plan: "PRO" }, "PRO"), true);
  assert.equal(needsOfficialMetadata({ stagetime_plan: "PRO", stagetime_catalog: STAGETIME_CATALOG_MARKER }, "PRO"), false);
});