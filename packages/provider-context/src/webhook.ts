import { createHmac, timingSafeEqual } from "node:crypto";

// docs.context.dev/webhooks: X-Context-Signature is "t=<unix>,v1=<hex>", HMAC-SHA256 over
// `${t}.` + raw body with the webhook secret. Verify before parsing JSON, reject stale
// timestamps, dedupe on X-Context-Id.

export interface WebhookVerdict {
  ok: boolean;
  reason?: "malformed" | "stale" | "bad_signature";
}

export function verifyContextWebhook(rawBody: Buffer, header: string | undefined, secret: string, nowMs = Date.now(), toleranceSec = 300): WebhookVerdict {
  if (!header) return { ok: false, reason: "malformed" };
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  if (!/^\d+$/.test(parts.t ?? "") || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "")) return { ok: false, reason: "malformed" };
  if (Math.abs(nowMs / 1000 - Number(parts.t)) > toleranceSec) return { ok: false, reason: "stale" };
  const expected = createHmac("sha256", secret).update(`${parts.t}.`).update(rawBody).digest();
  const actual = Buffer.from(parts.v1!, "hex");
  const ok = actual.length === expected.length && timingSafeEqual(actual, expected);
  return ok ? { ok } : { ok, reason: "bad_signature" };
}

export function signContextWebhook(rawBody: Buffer, secret: string, unixSeconds: number): string {
  const sig = createHmac("sha256", secret).update(`${unixSeconds}.`).update(rawBody).digest("hex");
  return `t=${unixSeconds},v1=${sig}`;
}
