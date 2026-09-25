import type { Request, RequestHandler } from "express";
import { rateLimited } from "../../shared/errors/appError";

export type RateLimitPolicy = {
  name: string;
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function defaultKey(req: Request): string {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.ip || "unknown";
}

export function consumeRateLimit(policy: RateLimitPolicy, key: string, now = Date.now()) {
  const bucketKey = `${policy.name}:${key}`;
  const existing = buckets.get(bucketKey);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + policy.windowMs };
  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  const allowed = bucket.count <= policy.max;
  return {
    allowed,
    remaining: Math.max(0, policy.max - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function createRateLimitMiddleware(policy: RateLimitPolicy): RequestHandler {
  const keyForRequest = policy.key ?? defaultKey;
  return (req, res, next) => {
    const result = consumeRateLimit(policy, keyForRequest(req));
    res.setHeader("x-rate-limit-limit", policy.max);
    res.setHeader("x-rate-limit-remaining", result.remaining);
    if (!result.allowed) {
      res.setHeader("retry-after", result.retryAfterSeconds);
      const error = rateLimited(undefined, { policy: policy.name, retryAfterSeconds: result.retryAfterSeconds });
      res.status(429).json({ error: { code: error.code, message: error.message } });
      return;
    }
    next();
  };
}

export function clearRateLimitBucketsForTests() {
  buckets.clear();
}
