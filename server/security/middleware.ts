import type { Express, RequestHandler } from "express";
import { ENV } from "../config/env";

export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (ENV.isProduction) res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
    next();
  };
}

export function configureCors(app: Express) {
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && (ENV.allowedOrigins.length === 0 || ENV.allowedOrigins.includes(origin))) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "Origin");
      res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("access-control-allow-headers", "Content-Type, Authorization, X-Request-ID");
      res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
}
