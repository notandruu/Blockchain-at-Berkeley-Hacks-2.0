import { z } from "zod";

// Closed vocabulary from PRD section 16. The UI renders only these; an unknown type is a
// bug, not something to display generically.
export const RUN_EVENT_TYPES = [
  "run.accepted",
  "run.state_changed",
  "run.failed",
  "run.completed",
  "input.required",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "source.captured",
  "source.capture_failed",
  "evidence.added",
  "market.candidates",
  "match.accepted",
  "match.rejected",
  "quote.ready",
  "quote.stale",
  "plan.ready",
  "approval.required",
  "approval.recorded",
  "order.submitted",
  "order.reconciled",
  "order.unknown",
  "order.no_fill",
  "capacity.changed",
  "campaign.paused",
  "monitor.change",
  "agent.note",
  "simulation.result",
] as const;

export const RunEventType = z.enum(RUN_EVENT_TYPES);
export type RunEventType = z.infer<typeof RunEventType>;

export const RunEventProvider = z.enum(["context", "gemini_markets", "risk_engine", "app", "agent"]);
export const RunEventMode = z.enum(["live_research", "sandbox_exchange", "simulation", "recorded"]);

export const RunEvent = z.object({
  id: z.string(),
  runId: z.string(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  type: RunEventType,
  provider: RunEventProvider,
  mode: RunEventMode,
  title: z.string(),
  artifactId: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  providerRequestId: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type RunEvent = z.infer<typeof RunEvent>;
export type NewRunEvent = Omit<RunEvent, "id" | "sequence" | "timestamp" | "runId">;
