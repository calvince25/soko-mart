import type { ErrorRequestHandler } from "express";
import { toTRPCError } from "./trpcError";
import { logger } from "../logging/logger";

export const expressErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const safeError = toTRPCError(error);
  logger.error("http.request.failed", { publicCode: safeError.code }, error);
  res.status(safeError.code === "UNAUTHORIZED" ? 401 : safeError.code === "FORBIDDEN" ? 403 : 500).json({
    error: {
      code: safeError.code,
      message: safeError.message,
    },
  });
};
