import type { IncomingMessage, ServerResponse } from "node:http";
import { waitUntil } from "@vercel/functions";
import { boot } from "./boot.js";

// Serverless entry. Fastify handles the request as usual; once the response is out, the
// same invocation drains whatever jobs are due (research, order submits, reconcile
// retries) inside the function's remaining time. Every page poll is also a drain, so a
// retry left by one request is picked up by the next.

const DRAIN_BUDGET_MS = Number(process.env.DRAIN_BUDGET_MS ?? 270_000);
const ready = boot().then(async (b) => {
  await b.app.ready();
  // Master keys skip the stream by design; account keys open it once per instance.
  if (b.accountStream) void b.accountStream.start();
  await b.recover().catch(() => {});
  return b;
});

let draining: Promise<void> | null = null;
function kick(worker: Awaited<typeof ready>["worker"]): Promise<void> {
  draining ??= worker.drain(DRAIN_BUDGET_MS).finally(() => {
    draining = null;
  });
  return draining;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const b = await ready;
  const done = new Promise<void>((resolve) => res.on("close", () => resolve()));
  b.app.server.emit("request", req, res);
  // SSE responses stay open for minutes; do not hold a drain hostage to them.
  if (!req.url?.includes("/events")) waitUntil(done.then(() => kick(b.worker)));
  else waitUntil(kick(b.worker));
  await done;
}
