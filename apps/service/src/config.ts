import { z } from "zod";

// GEMINI_ENV, DEMO_MODE and ALLOW_PRODUCTION_TRADING are application settings, not provider
// conventions. Any value that could put real money at risk fails startup.
const Env = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  CONTEXT_DEV_API_KEY: z.string().default(""),
  CONTEXT_WEBHOOK_SECRET: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_API_SECRET: z.string().default(""),
  // Master keys only: the account in the group to trade from. Leave empty for account keys.
  GEMINI_ACCOUNT: z.string().default(""),
  GEMINI_NONCE_MODE: z.enum(["monotonic", "time-based"]).default("monotonic"),
  GEMINI_ENV: z.string(),
  ANTHROPIC_API_KEY: z.string().default(""),
  AGENT_MODEL: z.string().default(""),
  // Needed when the key is not bound to a workspace (user-scoped keys).
  ANTHROPIC_WORKSPACE_ID: z.string().default(""),
  SERVICE_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3100"),
  PUBLIC_SERVICE_URL: z.string().default(""),
  DEMO_MODE: z.enum(["true", "false"]).default("true"),
  ALLOW_PRODUCTION_TRADING: z.enum(["true", "false"]).default("false"),
  RESEARCH_CREDIT_CEILING: z.coerce.number().int().positive().default(40),
  QUOTE_MAX_AGE_MS: z.coerce.number().int().positive().default(5000),
  FEE_BOUND_FILL_UNIT: z.string().default("1"),
  WORKER_ID: z.string().default(`worker-${process.pid}`),
  // Public demo: any visitor gets an anonymous session and their own demo merchant, no
  // sign-in. Off by default; the hosted deployment turns it on.
  OPEN_ACCESS: z.enum(["true", "false"]).default("false"),
  OPEN_ACCESS_MERCHANT_NAME: z.string().default("Golden Bear Taproom"),
  // New research runs one visitor may start per hour. Each run spends model and Context credits.
  RUNS_PER_VISITOR_PER_HOUR: z.coerce.number().int().positive().default(6),
  // Serverless: how long one SSE response stays open before the client reconnects, and the
  // pool size per instance.
  STREAM_MAX_MS: z.coerce.number().int().positive().default(3_600_000),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  // Upper bound on one research run. Serverless sets it under the function limit so a stuck
  // provider call fails the run with a reason instead of the platform killing it mid-write.
  RUN_DEADLINE_MS: z.coerce.number().int().nonnegative().default(0),
});

export type Config = z.infer<typeof Env> & {
  webOrigins: string[];
  providers: { context: boolean; gemini: boolean; agent: boolean };
};

export class StartupRefused extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.parse(env);
  if (parsed.GEMINI_ENV !== "sandbox") {
    throw new StartupRefused(`GEMINI_ENV must be "sandbox" for this build (got "${parsed.GEMINI_ENV}")`);
  }
  if (parsed.ALLOW_PRODUCTION_TRADING !== "false") {
    throw new StartupRefused("ALLOW_PRODUCTION_TRADING must be false for this build");
  }
  return {
    ...parsed,
    webOrigins: parsed.WEB_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
    providers: {
      context: parsed.CONTEXT_DEV_API_KEY.length > 0,
      gemini: parsed.GEMINI_API_KEY.length > 0 && parsed.GEMINI_API_SECRET.length > 0,
      agent: parsed.ANTHROPIC_API_KEY.length > 0 && parsed.AGENT_MODEL.length > 0,
    },
  };
}

export function geminiCredentials(cfg: Config) {
  return {
    apiKey: cfg.GEMINI_API_KEY,
    apiSecret: cfg.GEMINI_API_SECRET,
    nonceMode: cfg.GEMINI_NONCE_MODE,
    ...(cfg.GEMINI_ACCOUNT ? { account: cfg.GEMINI_ACCOUNT } : {}),
  };
}
