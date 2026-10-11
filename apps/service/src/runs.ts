import { assertTransition, DomainError, type NewRunEvent, type RunState } from "@beagle/domain";
import type { Sql } from "./db.js";
import { appendEventTx, publish } from "./events.js";

// State changes and their event commit together; the UI never sees a state the database
// does not have.
export async function transition(db: Sql, runId: string, to: RunState, title: string, payload: Record<string, unknown> = {}): Promise<void> {
  const ev = await db.begin(async (tx) => {
    const [run] = await tx<{ state: RunState }[]>`select state from runs where id = ${runId} for update`;
    if (!run) throw new DomainError("NOT_FOUND", "run not found");
    if (run.state === to) return null;
    assertTransition(run.state, to);
    await tx`update runs set state = ${to}, updated_at = now() where id = ${runId}`;
    return appendEventTx(tx, runId, {
      type: to === "FAILED" ? "run.failed" : "run.state_changed",
      provider: "app",
      mode: "live_research",
      title,
      payload: { from: run.state, to, ...payload },
    } satisfies NewRunEvent);
  });
  if (ev) publish(ev);
}

export async function runState(db: Sql, runId: string): Promise<RunState> {
  const [r] = await db<{ state: RunState }[]>`select state from runs where id = ${runId}`;
  if (!r) throw new DomainError("NOT_FOUND", "run not found");
  return r.state;
}

export async function failRun(db: Sql, runId: string, code: string, message: string): Promise<void> {
  await db`update runs set error_code = ${code}, error_message = ${message} where id = ${runId}`;
  const state = await runState(db, runId);
  if (state !== "FAILED" && state !== "RECONCILED") {
    try {
      await transition(db, runId, "FAILED", message, { code });
    } catch {
      // A state that cannot move to FAILED (e.g. ACTIVE) keeps its state; the error is recorded.
    }
  }
}
