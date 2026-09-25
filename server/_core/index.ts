import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV, validateRuntimeConfig } from "../config/env";
import { requestCorrelationMiddleware } from "../logging/requestLogger";
import { configureCors, securityHeaders } from "../security/middleware";
import { createRateLimitMiddleware } from "../rateLimit/limiter";
import { RATE_LIMIT_POLICIES } from "../rateLimit/policies";
import { expressErrorHandler } from "../errors/expressErrorHandler";
import { processMpesaCallback } from "../domains/payment/service";

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
  app.post("/api/payments/mpesa/callback", createRateLimitMiddleware(RATE_LIMIT_POLICIES.webhook), async (req, res) => {
    try {
      const result = await processMpesaCallback(req.body);
      res.status(200).json({ ResultCode: 0, ResultDesc: result.ignored ? "Callback already processed" : "Callback accepted" });
    } catch {
      res.status(400).json({ ResultCode: 1, ResultDesc: "Callback rejected" });
    }
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
