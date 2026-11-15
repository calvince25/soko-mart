import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ENV } from "../../config/env";

function key() { return createHash("sha256").update(ENV.mpesa.payout.encryptionKey || ENV.cookieSecret).digest(); }
export function encryptPayoutDestination(value: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`; }
export function decryptPayoutDestination(payload: string) { const [version, iv, tag, ciphertext] = payload.split(":"); if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Unsupported payout destination encryption"); const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url")); return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8"); }
export function hasPayoutDestinationKey() { return Boolean(ENV.mpesa.payout.encryptionKey || ENV.cookieSecret); }
