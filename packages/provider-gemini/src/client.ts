import { createClient, HmacAuth } from "@gemini-markets/sdk/server";
import type { ExchangeEnvironment } from "@riskpilot/domain";

export type GeminiClient = Awaited<ReturnType<typeof createClient>>;

export const ORIGINS: Record<ExchangeEnvironment, { rest: string; ws: string }> = {
  sandbox: { rest: "https://api.sandbox.gemini.com", ws: "wss://ws.sandbox.gemini.com" },
  production: { rest: "https://api.gemini.com", ws: "wss://ws.gemini.com" },
};

export interface GeminiCredentials {
  apiKey: string;
  apiSecret: string;
}

export class UnsafeEnvironmentError extends Error {}

// The only client that ever carries credentials. It is pinned to sandbox; asking for
// anything else throws before a socket or request exists.
export async function createTradingClient(env: string, creds: GeminiCredentials): Promise<GeminiClient> {
  if (env !== "sandbox") {
    throw new UnsafeEnvironmentError(`trading client refused for env=${env}; this build trades sandbox only`);
  }
  if (!creds.apiKey || !creds.apiSecret) throw new UnsafeEnvironmentError("missing Gemini sandbox credentials");
  return createClient({
    env: "sandbox",
    auth: new HmacAuth({ apiKey: creds.apiKey, apiSecret: creds.apiSecret }),
  });
}

// Unauthenticated client for public inventory and depth. Production is allowed here because
// it can only read; it has no auth object to sign an order with.
export async function createPublicClient(env: ExchangeEnvironment): Promise<GeminiClient> {
  return createClient({ env, skipWsInit: true });
}
