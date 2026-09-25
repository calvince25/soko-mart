export const APP_ERROR_CODES = [
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INVALID_STATE",
  "INTERNAL_ERROR",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export type AppErrorOptions = {
  code: AppErrorCode;
  message: string;
  metadata?: Record<string, unknown>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly metadata?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.metadata = options.metadata;
    this.cause = options.cause;
  }
}

export const authenticationRequired = (message = "Authentication is required.") => new AppError({ code: "AUTHENTICATION_REQUIRED", message });
export const forbidden = (message = "You do not have permission to perform this action.") => new AppError({ code: "FORBIDDEN", message });
export const validationError = (message: string, metadata?: Record<string, unknown>) => new AppError({ code: "VALIDATION_ERROR", message, metadata });
export const notFound = (message = "The requested resource was not found.") => new AppError({ code: "NOT_FOUND", message });
export const conflict = (message: string, metadata?: Record<string, unknown>) => new AppError({ code: "CONFLICT", message, metadata });
export const rateLimited = (message = "Too many requests. Please try again later.", metadata?: Record<string, unknown>) => new AppError({ code: "RATE_LIMITED", message, metadata });
export const invalidState = (message: string, metadata?: Record<string, unknown>) => new AppError({ code: "INVALID_STATE", message, metadata });
export const internalError = (message = "An unexpected error occurred.", cause?: unknown) => new AppError({ code: "INTERNAL_ERROR", message, cause });

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function safeErrorMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  return "An unexpected error occurred.";
}
