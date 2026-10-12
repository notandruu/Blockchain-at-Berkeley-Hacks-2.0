import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@beagle/domain";
import { ContextResearch } from "@beagle/provider-context";
import type { Config } from "../config.js";
import type { Sql } from "../db.js";
import { appendEvent } from "../events.js";
import type { Job } from "../jobs.js";
import { failRun, runState, transition } from "../runs.js";
import { anthropicModel, runIntake, runResearch, type RunInputs } from "./agent.js";
import { ResearchToolkit } from "./toolkit.js";

export function researchHandler(db: Sql, admin: SupabaseClient, cfg: Config) {
  return async (job: Job): Promise<void> => {
    const runId = job.run_id!;
    const [run] = await db<{ merchant_id: string; goal: string; business_url: string | null; inputs: Record<string, unknown>; research_credit_ceiling: number; research_credits_used: number }[]>`
      select merchant_id, goal, business_url, inputs, research_credit_ceiling, research_credits_used from runs where id = ${runId}`;
    if (!run) return;
    const state = await runState(db, runId);
    // A second attempt means the first worker died mid-run (serverless timeout, crash). The
    // half-written plan cannot be trusted, so say so instead of leaving the run spinning.
    if (job.attempts > 1 && ["RESEARCHING", "MATCHING", "QUOTING"].includes(state)) {
      await failRun(db, runId, "RUN_INTERRUPTED", "Research stopped before it finished. Start the run again.");
      return;
    }
    if (!["DRAFT", "NEEDS_INPUT", "RESEARCHING", "NO_EXECUTABLE_MATCH"].includes(state)) return;

    try {
      if (!cfg.providers.agent) throw new DomainError("PROVIDER_UNAVAILABLE", "agent model not configured (ANTHROPIC_API_KEY / AGENT_MODEL)");
      const model = anthropicModel(cfg.ANTHROPIC_API_KEY, cfg.AGENT_MODEL, cfg.ANTHROPIC_WORKSPACE_ID);
      const inputs: RunInputs = {
        goal: run.goal,
        businessUrl: run.business_url,
        budgetUsd: (run.inputs.budgetUsd as string) ?? null,
        location: (run.inputs.location as string) ?? null,
        answers: (run.inputs.answers as Record<string, string>) ?? {},
      };

      await transition(db, runId, "RESEARCHING", "Reading the request");
      const { intake, usage: u1 } = await runIntake(model, inputs);
      await db`update runs set model_input_tokens = model_input_tokens + ${u1.input}, model_output_tokens = model_output_tokens + ${u1.output} where id = ${runId}`;
      const stillMissing = intake.missing.filter((m) => !(m.field in inputs.answers));
      if (stillMissing.length) {
        await appendEvent(db, runId, {
          type: "input.required",
          provider: "agent",
          mode: "live_research",
          title: "A few details before research",
          payload: { missing: stillMissing, intake },
        });
        await transition(db, runId, "NEEDS_INPUT", "Waiting for merchant input");
        return;
      }
      await appendEvent(db, runId, {
        type: "agent.note",
        provider: "agent",
        mode: "live_research",
        title: intake.mode === "promotion" ? "Planning a promotion with bounded payout" : "Assessing an operational exposure",
        payload: { intake },
      });

      const meter = { ceiling: run.research_credit_ceiling, used: run.research_credits_used };
      const context = cfg.providers.context ? new ContextResearch(cfg.CONTEXT_DEV_API_KEY, meter) : null;
      const kit = new ResearchToolkit(db, admin, runId, context);
      const research = runResearch(
        { db, kit, model, merchantId: run.merchant_id, planner: { quoteMaxAgeMs: cfg.QUOTE_MAX_AGE_MS, feeBoundFillUnit: cfg.FEE_BOUND_FILL_UNIT, planTtlMs: 30 * 60 * 1000 } },
        inputs,
        intake,
      ).finally(() => kit.close());
      const { usage: u2 } = cfg.RUN_DEADLINE_MS > 0 ? await withDeadline(research, cfg.RUN_DEADLINE_MS) : await research;
      await db`update runs set model_input_tokens = model_input_tokens + ${u2.input}, model_output_tokens = model_output_tokens + ${u2.output} where id = ${runId}`;
    } catch (err) {
      const code = err instanceof DomainError ? err.code : "PROVIDER_UNAVAILABLE";
      await failRun(db, runId, code, err instanceof Error ? err.message : String(err));
    }
  };
}

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DomainError("RUN_TIMEOUT", `Research took longer than ${Math.round(ms / 1000)}s and was stopped. Start the run again.`)), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}
