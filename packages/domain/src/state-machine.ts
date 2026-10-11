// PRD section 17. Every state change goes through assertTransition so an illegal jump
// (for example AWAITING_APPROVAL straight to ACTIVE) fails loudly instead of corrupting a run.

export const RUN_STATES = [
  "DRAFT",
  "NEEDS_INPUT",
  "RESEARCHING",
  "MATCHING",
  "QUOTING",
  "AWAITING_APPROVAL",
  "NO_EXECUTABLE_MATCH",
  "APPROVED",
  "SUBMITTING",
  "RECONCILING",
  "ACTIVE",
  "NO_FILL",
  "EXECUTION_UNKNOWN",
  "MONITORING",
  "PAUSED",
  "SETTLEMENT_PENDING",
  "SETTLEMENT_EXCEPTION",
  "RECONCILED",
  "FAILED",
] as const;

export type RunState = (typeof RUN_STATES)[number];

const TRANSITIONS: Record<RunState, readonly RunState[]> = {
  DRAFT: ["RESEARCHING", "NEEDS_INPUT", "FAILED"],
  NEEDS_INPUT: ["RESEARCHING", "FAILED"],
  RESEARCHING: ["MATCHING", "NEEDS_INPUT", "FAILED"],
  MATCHING: ["QUOTING", "NO_EXECUTABLE_MATCH", "FAILED"],
  QUOTING: ["AWAITING_APPROVAL", "NO_EXECUTABLE_MATCH", "FAILED"],
  // A revision or a stale quote sends the run back to QUOTING with a new plan version.
  AWAITING_APPROVAL: ["APPROVED", "QUOTING", "NO_EXECUTABLE_MATCH", "FAILED"],
  NO_EXECUTABLE_MATCH: ["RESEARCHING"],
  APPROVED: ["SUBMITTING", "QUOTING"],
  SUBMITTING: ["RECONCILING", "EXECUTION_UNKNOWN", "QUOTING"],
  RECONCILING: ["ACTIVE", "NO_FILL", "EXECUTION_UNKNOWN"],
  ACTIVE: ["MONITORING", "PAUSED", "SETTLEMENT_PENDING"],
  NO_FILL: ["QUOTING"],
  // Unknown state only resolves through reconciliation, never through a resend.
  EXECUTION_UNKNOWN: ["RECONCILING"],
  MONITORING: ["PAUSED", "SETTLEMENT_PENDING"],
  PAUSED: ["MONITORING", "SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["RECONCILED", "SETTLEMENT_EXCEPTION"],
  SETTLEMENT_EXCEPTION: ["RECONCILED"],
  RECONCILED: [],
  FAILED: [],
};

export function canTransition(from: RunState, to: RunState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: RunState,
    readonly to: RunState,
  ) {
    super(`illegal run transition ${from} -> ${to}`);
  }
}

export function assertTransition(from: RunState, to: RunState): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

// States in which the account may not take on new financial commitments (invariant 5).
export const BLOCKS_NEW_COMMITMENTS: readonly RunState[] = ["SUBMITTING", "EXECUTION_UNKNOWN", "RECONCILING"];
