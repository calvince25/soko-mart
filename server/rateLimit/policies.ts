import type { RateLimitPolicy } from "./limiter";

export const RATE_LIMIT_POLICIES = {
  oauthCallback: { name: "oauth-callback", windowMs: 60_000, max: 30 } satisfies RateLimitPolicy,
  apiGateway: { name: "api-gateway", windowMs: 60_000, max: 300 } satisfies RateLimitPolicy,
  account: { name: "account-operation", windowMs: 60_000, max: 30 } satisfies RateLimitPolicy,
  search: { name: "search", windowMs: 60_000, max: 120 } satisfies RateLimitPolicy,
  checkout: { name: "checkout", windowMs: 60_000, max: 20 } satisfies RateLimitPolicy,
  support: { name: "support-submission", windowMs: 60_000, max: 20 } satisfies RateLimitPolicy,
  webhook: { name: "webhook", windowMs: 60_000, max: 120 } satisfies RateLimitPolicy,
} as const;
