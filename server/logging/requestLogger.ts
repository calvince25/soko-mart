import { randomUUID } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { logger } from "./logger";
import { runWithRequestId } from "./requestContext";

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,96}$/;

function getRequestId(req: Request): string {
  const incoming = req.header("x-request-id");
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

export const requestCorrelationMiddleware: RequestHandler = (req, res, next) => {
  const requestId = getRequestId(req);
  res.setHeader("x-request-id", requestId);
  runWithRequestId(requestId, () => {
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.info("http.request.completed", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });
};
