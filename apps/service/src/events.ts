import { EventEmitter } from "node:events";
import type { NewRunEvent, RunEvent } from "@beagle/domain";
import type { Sql, Tx } from "./db.js";

// Persist, then broadcast. The SSE route replays from the table by sequence, so a
// subscriber that reconnects rebuilds the same view without re-running any tool.

export const hub = new EventEmitter();
hub.setMaxListeners(500);

type Row = {
  id: string;
  run_id: string;
  sequence: number;
  ts: Date;
  type: RunEvent["type"];
  provider: RunEvent["provider"];
  mode: RunEvent["mode"];
  title: string;
  artifact_id: string | null;
  source_url: string | null;
  provider_request_id: string | null;
  payload: Record<string, unknown>;
};

export function rowToEvent(r: Row): RunEvent {
  return {
    id: r.id,
    runId: r.run_id,
    sequence: r.sequence,
    timestamp: r.ts.toISOString(),
    type: r.type,
    provider: r.provider,
    mode: r.mode,
    title: r.title,
    artifactId: r.artifact_id,
    sourceUrl: r.source_url,
    providerRequestId: r.provider_request_id,
    payload: r.payload,
  };
}

// Insert inside the caller's transaction. Does not broadcast: call publish() after commit,
// so no subscriber ever sees an event that was rolled back.
export async function appendEventTx(tx: Tx, runId: string, e: NewRunEvent): Promise<RunEvent> {
  // The run row lock serializes sequence assignment per run.
  await tx`select id from runs where id = ${runId} for update`;
  const [row] = await tx<Row[]>`
    insert into run_events (run_id, sequence, type, provider, mode, title, artifact_id, source_url, provider_request_id, payload)
    values (
      ${runId},
      (select coalesce(max(sequence), -1) + 1 from run_events where run_id = ${runId}),
      ${e.type}, ${e.provider}, ${e.mode}, ${e.title},
      ${e.artifactId ?? null}, ${e.sourceUrl ?? null}, ${e.providerRequestId ?? null},
      ${tx.json(e.payload as never)}
    )
    returning *`;
  return rowToEvent(row!);
}

export function publish(...events: RunEvent[]): void {
  for (const ev of events) hub.emit(`run:${ev.runId}`, ev);
}

export async function appendEvent(db: Sql, runId: string, e: NewRunEvent): Promise<RunEvent> {
  const event = await db.begin((tx) => appendEventTx(tx, runId, e));
  publish(event);
  return event;
}

export async function eventsAfter(db: Sql, runId: string, after: number): Promise<RunEvent[]> {
  const rows = await db<Row[]>`select * from run_events where run_id = ${runId} and sequence > ${after} order by sequence`;
  return rows.map(rowToEvent);
}
