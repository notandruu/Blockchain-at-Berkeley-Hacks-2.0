"use client";

import clsx from "clsx";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { use, useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import { Evaluation } from "@/components/run/evaluation";
import { buildFeed, Feed } from "@/components/run/feed";
import { Executing, InputRequest, NoMatch, OperatingView } from "@/components/run/operating";
import { PlanCard } from "@/components/run/plan-card";
import { SourceBrowser } from "@/components/run/source-browser";
import { stateLabel } from "@/components/run/state-label";
import { Chip, ErrorNotice } from "@/components/ui/primitives";
import { Mascot, type CrewMember } from "@/components/crew";
import { phaseOf, useRun, type Phase } from "@/lib/use-run";

const STEPS: { key: Phase[]; label: string; who: CrewMember }[] = [
  { key: ["starting", "input", "researching"], label: "Research", who: "scout" },
  { key: ["evaluating", "no_match"], label: "Match", who: "nova" },
  { key: ["approval"], label: "Approve", who: "penny" },
  { key: ["executing"], label: "Execute", who: "penny" },
  { key: ["operating"], label: "Operate", who: "sprout" },
];

function Stepper({ phase }: { phase: Phase }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.key.includes(phase)));
  return (
    <LayoutGroup>
      <div className="flex items-center gap-1 rounded-full bg-well-soft p-1">
        {STEPS.map((s, i) => (
          <div key={s.label} className={clsx("relative flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-[12px] font-semibold transition-colors", i === idx ? "text-ink" : i < idx ? "text-muted" : "text-faint")}>
            {i === idx && <motion.span layoutId="step" className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.06)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <Mascot who={s.who} size={20} state={i === idx && phase !== "approval" && phase !== "operating" ? "working" : i < idx ? "done" : i === idx ? "idle" : "paused"} className="relative" />
            <span className="relative">{s.label}</span>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { view, events, state, stream, error, refresh } = useRun(id);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [tab, setTab] = useState<"conversation" | "work">("work");
  const reduce = useReducedMotion();
  const phase = phaseOf(state);
  const feed = useMemo(() => buildFeed(events), [events]);
  const plan = view?.plans.filter((p) => p.status === "proposed").at(-1) ?? null;
  const order = view?.orders.at(-1) ?? null;
  const inputEvent = [...events].reverse().find((e) => e.type === "input.required");
  const label = state ? stateLabel(state) : null;

  const workspace = !view ? null : phase === "input" && inputEvent ? (
    <InputRequest runId={id} event={inputEvent} onDone={refresh} />
  ) : phase === "researching" || phase === "starting" ? (
    <SourceBrowser view={view} events={events} selectedId={selectedSource} onSelect={setSelectedSource} />
  ) : phase === "evaluating" ? (
    <Evaluation view={view} events={events} />
  ) : phase === "approval" && plan ? (
    <PlanCard key={plan.id} view={view} plan={plan} onApproved={refresh} />
  ) : phase === "executing" ? (
    <Executing order={order} events={events} />
  ) : phase === "no_match" ? (
    <NoMatch events={events} />
  ) : phase === "operating" ? (
    <OperatingView view={view} events={events} onChange={refresh} />
  ) : phase === "failed" ? (
    <ErrorNotice error={view.run.error_message ?? "The run failed."} />
  ) : (
    <SourceBrowser view={view} events={events} selectedId={selectedSource} onSelect={setSelectedSource} />
  );

  return (
    <AppShell
      title={<span className="flex items-center gap-2">{view?.run.goal.slice(0, 70) ?? "Run"}{view && view.run.goal.length > 70 ? "…" : ""}</span>}
      actions={
        <div className="hidden items-center gap-2 md:flex">
          {stream === "reconnecting" && <Chip tone="warn">Reconnecting</Chip>}
          {label && <Chip tone={label.tone}>{label.text}</Chip>}
        </div>
      }
    >
      <div className="flex gap-1 border-b border-line px-4 py-2 lg:hidden">
        {(["conversation", "work"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx("rounded-full px-3 py-1 text-[13px] font-semibold capitalize", tab === t ? "bg-well text-ink" : "text-muted")}>
            {t}
          </button>
        ))}
      </div>
      <div className="grid min-h-[calc(100dvh-56px)] grid-cols-1 lg:grid-cols-[360px_minmax(560px,1fr)]">
        <section className={clsx("scroll-quiet border-line px-4 py-5 lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-56px)] lg:overflow-y-auto lg:border-r lg:px-5", tab === "conversation" ? "block" : "hidden")} aria-label="Conversation">
          {view && (
            <div className="mb-4 flex justify-end">
              <div className="max-w-[300px] rounded-[22px] rounded-br-[8px] bg-blue px-4 py-2.5 text-[14px] leading-[21px]">{view.run.goal}</div>
            </div>
          )}
          {view?.run.business_url && <div className="mb-3 flex justify-end gap-1.5"><Chip>{view.run.business_url.replace(/^https?:\/\//, "")}</Chip>{view.run.inputs.budgetUsd && <Chip>max ${view.run.inputs.budgetUsd}</Chip>}</div>}
          {state && !["FAILED", "ACTIVE", "MONITORING", "NO_EXECUTABLE_MATCH", "NO_FILL", "AWAITING_APPROVAL", "PAUSED"].includes(state) && (
            <div className="mb-3 flex items-center gap-2 px-1 text-[12px] text-muted" aria-live="polite">
              <span className="size-1.5 rounded-full bg-blue-ink" style={{ animation: reduce ? undefined : "var(--animate-breathe)" }} />
              {label?.text}
            </div>
          )}
          <Feed items={feed} onSelectSource={(sid) => { setSelectedSource(sid); setTab("work"); }} />
          <ErrorNotice error={error} />
          {view && view.providerCalls.length > 0 && (
            <div className="mt-6 space-y-1 rounded-[16px] bg-well-soft p-3 text-[11.5px] text-muted">
              <div className="label mb-1">Provider usage</div>
              {view.providerCalls.map((c) => (
                <div key={`${c.provider}${c.operation}`} className="tabular flex justify-between">
                  <span>{c.provider} {c.operation} ×{c.n}</span>
                  <span>{Number(c.credits)} credits · {c.avg_ms}ms</span>
                </div>
              ))}
              <div className="tabular flex justify-between border-t border-line pt-1">
                <span>Research credits</span>
                <span>{view.run.research_credits_used} / {view.run.research_credit_ceiling}</span>
              </div>
            </div>
          )}
        </section>
        <section className={clsx("min-w-0 px-4 py-5 lg:block lg:px-8", tab === "work" ? "block" : "hidden")} aria-label="Workspace">
          <div className="mx-auto max-w-[880px]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Stepper phase={phase} />
              {view?.run.mode === "recorded" && <Chip tone="dark">Recorded run</Chip>}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={phase === "approval" ? `approval-${plan?.id}` : phase} initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -4 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                {workspace ?? (
                  <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-browser)] bg-well-soft">
                    <Mascot who="scout" size={96} state="working" />
                    <span className="text-[13px] text-muted">Opening the run</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
