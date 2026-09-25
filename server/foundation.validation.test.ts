import { describe, expect, it } from "vitest";
import { toTRPCError } from "./errors/trpcError";
import { validateIdempotencyKey } from "./transactions/idempotency";
import { paginationSchema, ownerNotificationSchema } from "../shared/validation/schemas";

describe("Sprint 1 validation and error conventions", () => {
  it("applies bounded pagination defaults", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    expect(() => paginationSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("rejects invalid mutation input", () => {
    expect(() => ownerNotificationSchema.parse({ title: "", content: "x" })).toThrow();
  });

  it("requires a sufficiently strong idempotency key", () => {
    expect(() => validateIdempotencyKey("short")).toThrow("idempotency key");
    expect(validateIdempotencyKey("checkout:2026-09-25:abcdef123456")).toContain("checkout:");
  });

  it("maps unexpected errors to a safe public response", () => {
    const error = toTRPCError(new Error("database password should not leak"));
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("An unexpected error occurred.");
    expect(error.message).not.toContain("password");
  });
});
