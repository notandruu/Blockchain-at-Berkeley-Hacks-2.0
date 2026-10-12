// Stable error codes returned by the service API (PRD section 16). The web app switches on
// these; the message is for humans.
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "QUOTE_STALE",
  "RULES_CHANGED",
  "PLAN_SUPERSEDED",
  "PLAN_EXPIRED",
  "APPROVAL_REQUIRED",
  "BUDGET_EXCEEDED",
  "INSUFFICIENT_BALANCE",
  "TERMS_NOT_ACCEPTED",
  "MARKET_CLOSED",
  "NOT_EXECUTABLE_IN_ENV",
  "INSUFFICIENT_DEPTH",
  "EXECUTION_UNKNOWN",
  "ACCOUNT_BUSY",
  "CAPACITY_EXHAUSTED",
  "CAMPAIGN_CLOSED",
  "DUPLICATE_CLAIM",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "UNSAFE_URL",
  "RUN_TIMEOUT",
  "RUN_INTERRUPTED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
}
