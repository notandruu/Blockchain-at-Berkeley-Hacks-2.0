import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
import { DomainError, type ErrorCode } from "@beagle/domain";

const STATUS: Partial<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNSAFE_URL: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  PLAN_SUPERSEDED: 409,
  RULES_CHANGED: 409,
  QUOTE_STALE: 409,
  PLAN_EXPIRED: 409,
  ACCOUNT_BUSY: 409,
  EXECUTION_UNKNOWN: 409,
  CAPACITY_EXHAUSTED: 409,
  CAMPAIGN_CLOSED: 409,
  DUPLICATE_CLAIM: 409,
  BUDGET_EXCEEDED: 422,
  NOT_EXECUTABLE_IN_ENV: 422,
  INSUFFICIENT_DEPTH: 422,
  TERMS_NOT_ACCEPTED: 422,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
};

export function sendError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof DomainError) {
    return reply.status(STATUS[err.code] ?? 400).send({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: { code: "VALIDATION_FAILED", message: "invalid request", details: { issues: err.issues } } });
  }
  reply.log.error(err);
  return reply.status(500).send({ error: { code: "INTERNAL", message: "unexpected error" } });
}
