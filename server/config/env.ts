export type AppEnvironment = "development" | "preview" | "production" | "test";

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = value ? Number(value) : fallback;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const rawAppEnvironment = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();
const appEnvironment = (rawAppEnvironment === "prod" ? "production" : rawAppEnvironment) as AppEnvironment;

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  environment: appEnvironment,
  isProduction: appEnvironment === "production",
  isPreview: appEnvironment === "preview",
  allowPreviewAuthFallback: appEnvironment !== "production",
  sessionTtlMs: positiveInteger(process.env.SESSION_TTL_MS, 1000 * 60 * 60 * 8),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? "1mb",
  urlEncodedBodyLimit: process.env.URLENCODED_BODY_LIMIT ?? "100kb",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitStore: process.env.RATE_LIMIT_STORE ?? "memory",
  mpesa: {
    environment: (process.env.MPESA_ENVIRONMENT ?? "sandbox") as "sandbox" | "production",
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "",
    shortcode: process.env.MPESA_SHORTCODE ?? "",
    passkey: process.env.MPESA_PASSKEY ?? "",
    callbackUrl: process.env.MPESA_CALLBACK_URL ?? "",
    mock: process.env.MPESA_MOCK === "true",
  },
} as const;

export function validateRuntimeConfig(options: { strict?: boolean } = {}): void {
  const strict = options.strict ?? ENV.isProduction;
  const required = [
    ["VITE_APP_ID", ENV.appId],
    ["JWT_SECRET", ENV.cookieSecret],
    ["DATABASE_URL", ENV.databaseUrl],
    ["OAUTH_SERVER_URL", ENV.oAuthServerUrl],
  ] as const;
  const missing = required.filter(([, value]) => !value).map(([name]) => name);

  if (missing.length === 0) return;
  const message = `Missing required runtime configuration: ${missing.join(", ")}`;
  if (strict) throw new Error(message);
  console.warn(`[Config] ${message}`);
}
