"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The browser only ever holds the Supabase publishable key and the user's own session.
// Exchange, Context and model credentials live in the service.
let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export const SERVICE_URL = process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function token(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string; anonymous?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!init.anonymous) {
    const t = await token();
    if (t) headers.set("authorization", `Bearer ${t}`);
  }
  if (init.body) headers.set("content-type", "application/json");
  if (init.idempotencyKey) headers.set("idempotency-key", init.idempotencyKey);
  const res = await fetch(`${SERVICE_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: Record<string, unknown> } }).error ?? {};
    throw new ApiError(res.status, e.code ?? "HTTP_" + res.status, e.message ?? res.statusText, e.details);
  }
  return body as T;
}

// SSE over fetch so the Authorization header can be sent (EventSource cannot set headers).
// Resumes from the last sequence after a drop; the server replays from the event log.
export function streamRunEvents<E extends { sequence: number }>(
  runId: string,
  onEvent: (e: E) => void,
  onStatus: (s: "live" | "reconnecting") => void,
): () => void {
  let after = -1;
  let stopped = false;
  let controller: AbortController | null = null;

  const loop = async () => {
    let backoff = 500;
    while (!stopped) {
      controller = new AbortController();
      try {
        const t = await token();
        const res = await fetch(`${SERVICE_URL}/api/runs/${runId}/events?after=${after}`, {
          headers: t ? { authorization: `Bearer ${t}` } : {},
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        onStatus("live");
        backoff = 500;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const data = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!data) continue;
            const ev = JSON.parse(data.slice(6)) as E;
            if (ev.sequence > after) {
              after = ev.sequence;
              onEvent(ev);
            }
          }
        }
      } catch {
        if (stopped) return;
      }
      if (stopped) return;
      onStatus("reconnecting");
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 8000);
    }
  };
  void loop();
  return () => {
    stopped = true;
    controller?.abort();
  };
}

export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
