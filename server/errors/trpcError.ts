import { TRPCError } from "@trpc/server";
import { AppError, isAppError } from "../../shared/errors/appError";

export function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (isAppError(error)) {
    const code = error.code === "AUTHENTICATION_REQUIRED" ? "UNAUTHORIZED"
      : error.code === "FORBIDDEN" ? "FORBIDDEN"
      : error.code === "VALIDATION_ERROR" ? "BAD_REQUEST"
      : error.code === "NOT_FOUND" ? "NOT_FOUND"
      : error.code === "CONFLICT" ? "CONFLICT"
      : error.code === "RATE_LIMITED" ? "TOO_MANY_REQUESTS"
      : error.code === "INVALID_STATE" ? "BAD_REQUEST"
      : "INTERNAL_SERVER_ERROR";
    return new TRPCError({ code, message: error.message, cause: error });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred.", cause: error });
}
