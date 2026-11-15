import { randomBytes } from "node:crypto";

/** Generate a valid, process-safe Kenyan test number for unique DB fixtures. */
export function uniqueTestPhone(): string {
  const suffix = String(randomBytes(4).readUInt32BE(0) % 100_000_000).padStart(8, "0");
  return `+2547${suffix}`;
}
