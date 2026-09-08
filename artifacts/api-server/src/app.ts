import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/webhookHandlers";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// StageTime is reached through exactly one Replit reverse-proxy hop. Trusting
// only that hop allows req.protocol to honor X-Forwarded-Proto without
// accepting arbitrary multi-proxy forwarding headers.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0].replace(/(\/display-access\/)[^/]+/, "$1[redacted]"),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) { res.status(400).json({ error: "Missing webhook signature" }); return; }
  try {
    await WebhookHandlers.processWebhook(req.body as Buffer, Array.isArray(signature) ? signature[0] : signature, req.log);
    res.status(200).json({ received: true });
  } catch (error) {
    req.log.warn({ error }, "Rejected Stripe webhook");
    res.status(400).json({ error: "Invalid webhook" });
  }
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api", healthRouter);

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

const frontendDistPath = process.env.FRONTEND_DIST_DIR
  ? path.resolve(process.env.FRONTEND_DIST_DIR)
  : path.resolve(process.cwd(), "artifacts/flowline/dist/public");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

if (existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath, { index: false }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(frontendIndexPath);
  });
}

export default app;
