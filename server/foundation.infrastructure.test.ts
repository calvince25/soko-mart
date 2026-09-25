import { describe, expect, it, beforeEach } from "vitest";
import { isSessionActive } from "./auth/sessionService";
import { clearRateLimitBucketsForTests, consumeRateLimit } from "./rateLimit/limiter";
import { sanitizeAuditValue } from "./audit/audit";
import { getRequestId, runWithRequestId } from "./logging/requestContext";

describe("Sprint 1 infrastructure foundations", () => {
  beforeEach(() => clearRateLimitBucketsForTests());

  it("rejects revoked and expired sessions", () => {
    const now = new Date("2026-09-25T08:00:00.000Z");
    expect(isSessionActive({ revokedAt: null, expiresAt: new Date("2026-09-25T09:00:00.000Z") }, now)).toBe(true);
    expect(isSessionActive({ revokedAt: new Date("2026-09-25T07:59:00.000Z"), expiresAt: new Date("2026-09-25T09:00:00.000Z") }, now)).toBe(false);
    expect(isSessionActive({ revokedAt: null, expiresAt: new Date("2026-09-25T07:00:00.000Z") }, now)).toBe(false);
  });

  it("keeps rate limits operation-specific and deterministic", () => {
    const policy = { name: "foundation-test", windowMs: 60_000, max: 2 };
    expect(consumeRateLimit(policy, "same-key", 1000).allowed).toBe(true);
    expect(consumeRateLimit(policy, "same-key", 1001).allowed).toBe(true);
    expect(consumeRateLimit(policy, "same-key", 1002).allowed).toBe(false);
    expect(consumeRateLimit(policy, "other-key", 1002).allowed).toBe(true);
  });

  it("sanitizes audit values into JSON-safe data", () => {
    expect(sanitizeAuditValue({ amount: 100, nested: ["safe"] })).toEqual({ amount: 100, nested: ["safe"] });
    expect(sanitizeAuditValue(undefined)).toBeNull();
  });

  it("propagates request correlation IDs through async context", () => {
    expect(getRequestId()).toBeUndefined();
    runWithRequestId("request-foundation-123", () => {
      expect(getRequestId()).toBe("request-foundation-123");
    });
    expect(getRequestId()).toBeUndefined();
  });
});
