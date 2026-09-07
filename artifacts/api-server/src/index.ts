import app from "./app";
import { logger } from "./lib/logger";
import { ensureFlowlineSeedData } from "./lib/seed";
import { runMigrations } from "stripe-replit-sync";
import { stripeProxy } from "./lib/stripeClient";
import { hasExactWebhookEvents, STAGETIME_WEBHOOK_EVENTS } from "./lib/billing";

async function initStripe() {
  // Importing app in tests must not contact the integration. Executable server
  // startup is strict whenever Replit has provided connection context.
  const connected = Boolean(process.env.REPLIT_CONNECTORS_HOSTNAME || process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);
  if (!connected && process.env.NODE_ENV === "test") return;
  if (!connected) return;
  const databaseUrl = process.env.DATABASE_URL;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!databaseUrl || !domain) throw new Error("Stripe is connected but DATABASE_URL or REPLIT_DOMAINS is missing.");
  await runMigrations({ databaseUrl });
  const url = `https://${domain}/api/stripe/webhook`;
  const endpoints = await stripeProxy.listWebhookEndpoints() as { data?: Array<{ id: string; url: string; enabled_events?: string[] }> };
  const endpoint = endpoints.data?.find((item) => item.url === url);
  const enabledEvents = [...STAGETIME_WEBHOOK_EVENTS];
  if (!endpoint) await stripeProxy.createWebhookEndpoint({ url, enabled_events: enabledEvents });
  else if (!hasExactWebhookEvents(endpoint.enabled_events)) await stripeProxy.updateWebhookEndpoint(endpoint.id, { enabled_events: enabledEvents });
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await ensureFlowlineSeedData();
await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
