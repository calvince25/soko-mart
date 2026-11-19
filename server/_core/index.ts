import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { timingSafeEqual } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV, validateRuntimeConfig } from "../config/env";
import { requestCorrelationMiddleware } from "../logging/requestLogger";
import { configureCors, securityHeaders } from "../security/middleware";
import { configureRateLimitStore, createRateLimitMiddleware } from "../rateLimit/limiter";
import { createMysqlRateLimitStore } from "../rateLimit/mysqlStore";
import { RATE_LIMIT_POLICIES } from "../rateLimit/policies";
import { expressErrorHandler } from "../errors/expressErrorHandler";
import { processMpesaCallback } from "../domains/payment/service";
import { processPayoutCallback } from "../domains/finance/payoutService";
import { runFinanceWorkerOnce } from "../domains/finance/worker";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateRuntimeConfig();
  if (ENV.rateLimitStore === "mysql") {
    configureRateLimitStore(createMysqlRateLimitStore(ENV.databaseUrl));
  }
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.use(requestCorrelationMiddleware);
  app.use(securityHeaders());
  configureCors(app);
  app.use(express.json({ limit: ENV.requestBodyLimit }));
  app.use(express.urlencoded({ limit: ENV.urlEncodedBodyLimit, extended: true }));
  app.use("/api/oauth", createRateLimitMiddleware(RATE_LIMIT_POLICIES.oauthCallback));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  const validWebhookSecret = (provided: unknown, expected: string) => {
    if (!expected || typeof provided !== "string") return false;
    const actual = Buffer.from(provided);
    const configured = Buffer.from(expected);
    return actual.length === configured.length && timingSafeEqual(actual, configured);
  };
  app.post("/api/payments/mpesa/callback", createRateLimitMiddleware(RATE_LIMIT_POLICIES.webhook), async (req, res) => {
    if (!validWebhookSecret(req.header("x-soko-mpesa-callback-secret"), ENV.mpesa.callbackSecret)) {
      return res.status(401).json({ ResultCode: 1, ResultDesc: "Callback authentication failed" });
    }
    try {
      const result = await processMpesaCallback(req.body);
      res.status(200).json({ ResultCode: 0, ResultDesc: result.ignored ? "Callback already processed" : "Callback accepted" });
    } catch {
      res.status(400).json({ ResultCode: 1, ResultDesc: "Callback rejected" });
    }
  });
  app.post("/api/payouts/mpesa/callback", createRateLimitMiddleware(RATE_LIMIT_POLICIES.webhook), async (req, res) => {
    if (!validWebhookSecret(req.header("x-soko-mpesa-payout-secret"), ENV.mpesa.payout.callbackSecret)) {
      return res.status(401).json({ ResultCode: 1, ResultDesc: "Callback authentication failed" });
    }
    try { const result = await processPayoutCallback(req.body); res.status(200).json({ ResultCode: 0, ResultDesc: result.ignored ? "Callback already processed" : "Callback accepted" }); }
    catch { res.status(400).json({ ResultCode: 1, ResultDesc: "Callback rejected" }); }
  });
  app.post("/api/scheduled/finance-worker", async (req, res) => {
    try { const user = await sdk.authenticateRequest(req); if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" }); return res.json({ ok: true, result: await runFinanceWorkerOnce(`cron:${user.taskUid}`) }); }
    catch { return res.status(500).json({ error: "Finance worker failed" }); }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createRateLimitMiddleware(RATE_LIMIT_POLICIES.apiGateway),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // API failures must remain JSON-parsable; never serve the Vite HTML shell
  // for an unmatched or interrupted tRPC request.
  app.use("/api/trpc", (_req, res) => {
    res.status(404).json({ error: { message: "tRPC procedure not found", code: "NOT_FOUND" } });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  app.use(expressErrorHandler);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((error) => {
  console.error("[Server] Failed to start", error);
  process.exitCode = 1;
});
