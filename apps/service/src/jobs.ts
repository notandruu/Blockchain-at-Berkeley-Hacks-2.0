import type { Sql } from "./db.js";

// Durable job runner on a Postgres table. Claims use FOR UPDATE SKIP LOCKED with a lease;
// a crashed worker's lease expires and the job becomes claimable again. Financial lanes are
// never retried automatically: their handlers reconcile instead.

export type JobKind = "research" | "execute_order" | "reconcile_order" | "reconcile_account" | "monitor_change";

export interface Job {
  id: string;
  kind: JobKind;
  run_id: string | null;
  payload: Record<string, unknown>;
  lane: string;
  attempts: number;
  max_attempts: number;
}

export type Handler = (job: Job) => Promise<void>;

export async function enqueue(
  db: Sql,
  kind: JobKind,
  runId: string | null,
  payload: Record<string, unknown>,
  opts: { lane?: string; maxAttempts?: number; runAfter?: Date } = {},
): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    insert into jobs (kind, run_id, payload, lane, max_attempts, run_after)
    values (${kind}, ${runId}, ${db.json(payload as never)}, ${opts.lane ?? "research"}, ${opts.maxAttempts ?? 3}, ${opts.runAfter ?? new Date()})
    returning id`;
  return row!.id;
}

export async function claim(db: Sql, lane: string, workerId: string, leaseMs: number): Promise<Job | null> {
  const rows = await db<Job[]>`
    update jobs set status = 'leased', lease_owner = ${workerId},
      lease_expires_at = now() + ${`${leaseMs} milliseconds`}::interval,
      attempts = attempts + 1, updated_at = now()
    where id = (
      select id from jobs
      where lane = ${lane}
        and run_after <= now()
        and (status = 'queued' or (status = 'leased' and lease_expires_at < now()))
      order by run_after, created_at
      for update skip locked
      limit 1
    )
    returning id, kind, run_id, payload, lane, attempts, max_attempts`;
  return rows[0] ?? null;
}

export async function complete(db: Sql, id: string): Promise<void> {
  await db`update jobs set status = 'done', lease_owner = null, updated_at = now() where id = ${id}`;
}

export async function fail(db: Sql, job: Job, err: unknown, retryable: boolean): Promise<void> {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const terminal = !retryable || job.attempts >= job.max_attempts;
  const backoffMs = Math.min(30_000, 1000 * 2 ** job.attempts);
  await db`
    update jobs set
      status = ${terminal ? "failed" : "queued"},
      lease_owner = null,
      last_error = ${message},
      run_after = now() + ${`${backoffMs} milliseconds`}::interval,
      updated_at = now()
    where id = ${job.id}`;
}

export class Worker {
  private stopped = false;
  private readonly handlers = new Map<JobKind, Handler>();

  constructor(
    private readonly db: Sql,
    private readonly workerId: string,
    private readonly lanes: { name: string; concurrency: number; retryable: boolean; leaseMs: number }[],
  ) {}

  on(kind: JobKind, handler: Handler): this {
    this.handlers.set(kind, handler);
    return this;
  }

  start(): void {
    for (const lane of this.lanes) {
      for (let i = 0; i < lane.concurrency; i++) void this.loop(lane);
    }
  }

  stop(): void {
    this.stopped = true;
  }

  private async loop(lane: { name: string; retryable: boolean; leaseMs: number }): Promise<void> {
    while (!this.stopped) {
      let job: Job | null = null;
      try {
        job = await claim(this.db, lane.name, this.workerId, lane.leaseMs);
      } catch {
        await sleep(1000);
        continue;
      }
      if (!job) {
        await sleep(400);
        continue;
      }
      const handler = this.handlers.get(job.kind);
      if (!handler) {
        await fail(this.db, job, new Error(`no handler for ${job.kind}`), false);
        continue;
      }
      try {
        await handler(job);
        await complete(this.db, job.id);
      } catch (err) {
        await fail(this.db, job, err, lane.retryable);
      }
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
