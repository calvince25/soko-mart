import { conflict } from "../../shared/errors/appError";

/**
 * Sprint 1 defines the contract. Domain-specific idempotency records will be
 * added with the first operation that needs durable replay protection.
 */
export function validateIdempotencyKey(key: string | undefined): string {
  const normalized = key?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(normalized)) {
    throw conflict("A valid idempotency key is required for this operation.");
  }
  return normalized;
}
