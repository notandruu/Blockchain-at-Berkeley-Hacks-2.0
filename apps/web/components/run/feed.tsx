"use client";

import clsx from "clsx";
import { Check, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { RunEvent } from "@/lib/types";
import { Chip } from "../ui/primitives";
import { CrewBadge, crewFor, Mascot, type CrewMember } from "../crew";

// The conversation column renders persisted events only. A tool card spins while its
// tool.started has no matching completion, and stops the moment one arrives.

export interface FeedItem {
  key: string;
  kind: "tool" | "note" | "evidence" | "rejected" | "accepted" | "quote" | "approval" | "order" | "capacity" | "simulation" | "failed" | "input" | "state";
  start: RunEvent;
  end?: RunEvent;
}

export function buildFeed(events: RunEvent[]): FeedItem[] {
  const items: FeedItem[] = [];
  const open = new Map<number, FeedItem>();
  for (const e of events) {
    switch (e.type) {
      case "tool.started": {
        const it: FeedItem = { key: `t${e.sequence}`, kind: "tool", start: e };
        open.set(e.sequence, it);
        items.push(it);
        break;
      }
      case "tool.completed":
      case "tool.failed":
      case "source.captured":
      case "source.capture_failed":
      case "market.candidates": {
        const it = open.get(Number(e.payload.startedSequence));
        if (it) it.end = e;
        break;
      }
      case "agent.note":
        items.push({ key: `n${e.sequence}`, kind: "note", start: e });
        break;
      case "evidence.added":
        if (e.payload.provenance !== "merchant") items.push({ key: `e${e.sequence}`, kind: "evidence", start: e });
        break;
      case "match.rejected":
        items.push({ key: `r${e.sequence}`, kind: "rejected", start: e });
        break;
      case "match.accepted":
        items.push({ key: `a${e.sequence}`, kind: "accepted", start: e });
        break;
      case "quote.ready":
      case "quote.stale":
        items.push({ key: `q${e.sequence}`, kind: "quote", start: e });
        break;
      case "approval.required":
      case "approval.recorded":
        items.push({ key: `p${e.sequence}`, kind: "approval", start: e });
        break;
      case "order.submitted":
      case "order.reconciled":
      case "order.no_fill":
      case "order.unknown":
        items.push({ key: `o${e.sequence}`, kind: "order", start: e });
        break;
      case "capacity.changed":
      case "campaign.paused":
        items.push({ key: `c${e.sequence}`, kind: "capacity", start: e });
        break;
      case "simulation.result":
        items.push({ key: `s${e.sequence}`, kind: "simulation", start: e });
        break;
      case "run.failed":
        items.push({ key: `f${e.sequence}`, kind: "failed", start: e });
        break;
      case "input.required":
        items.push({ key: `i${e.sequence}`, kind: "input", start: e });
        break;
    }
  }
  return items;
}

function Row({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div layout="position" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

function ToolCard({ item, onSelectSource }: { item: FeedItem; onSelectSource?: (sourceId: string) => void }) {
  const p = item.start.payload;
  const done = !!item.end;
  const failed = item.end?.type === "tool.failed" || item.end?.type === "source.capture_failed";
  const subtitle = !done
    ? p.tool === "search"
      ? `Searching: ${p.query}`
      : p.tool === "scrape"
        ? `${p.domain} · capturing`
        : p.tool === "depth"
          ? "Reading live order books"
          : "Reading Gemini inventory"
    : failed
      ? item.end!.title
      : item.end!.type === "source.captured"
        ? `${item.end!.payload.domain} · ${item.end!.payload.captureStatus === "screenshot" ? "captured" : "text only"}`
        : item.end!.title;
  const sourceId = item.end?.payload?.sourceId as string | undefined;
  return (
    <button
      type="button"
      disabled={!sourceId}
      onClick={() => sourceId && onSelectSource?.(sourceId)}
      className={clsx("relative w-full overflow-hidden rounded-[18px] bg-well p-3 text-left transition-colors", sourceId && "hover:bg-[#e7e7ea]")}
    >
      <div className="flex items-center gap-2.5">
        <CrewBadge who={crewFor(item.start.provider)} state={!done ? "working" : failed ? "paused" : "done"} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold">{item.start.title}</div>
          <div className={clsx("truncate text-[12px]", failed ? "text-bad" : "text-muted")}>{subtitle}</div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {!done ? (
            <motion.span key="spin" exit={{ opacity: 0 }} className="size-2 shrink-0 rounded-full bg-blue-ink" style={{ animation: "var(--animate-breathe)" }} aria-label="In progress" />
          ) : failed ? (
            <motion.span key="x" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <X className="size-4 text-bad" aria-label="Failed" />
            </motion.span>
          ) : (
            <motion.span key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.14 }}>
              <Check className="size-4 text-ok" aria-label="Done" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {!done && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-transparent">
          <div className="h-full w-1/3 bg-blue-ink/50" style={{ animation: "var(--animate-indeterminate)" }} />
        </div>
      )}
      {done && !failed && typeof item.end?.payload.latencyMs === "number" && (
        <div className="mt-2 flex gap-1.5 pl-[42px]">
          <Chip>{(item.end.payload.latencyMs / 1000).toFixed(1)}s</Chip>
          {item.end.payload.credits != null && <Chip>{item.end.payload.credits} credits</Chip>}
          {item.end.providerRequestId && <Chip className="font-mono">{String(item.end.providerRequestId).slice(0, 8)}</Chip>}
        </div>
      )}
    </button>
  );
}

const REASON: Record<string, string> = {
  NOT_EXECUTABLE_IN_ENV: "Production only",
  WRONG_THRESHOLD: "Different threshold",
  WRONG_DATE: "Different date",
  WRONG_STATION: "Different station",
  WRONG_TEAM: "Other team",
  WRONG_EVENT: "Different event",
  PERIOD_MISMATCH: "Different period",
  EXPIRED: "Expired",
  MARKET_CLOSED: "Market closed",
  INSUFFICIENT_DEPTH: "No depth under ceiling",
  UNSUPPORTED_TRIGGER: "No verifier",
  NO_SETTLEMENT_RULES: "No settlement rules",
  BUDGET: "Over budget",
  BELOW_MINIMUM: "Too thin for one reward",
  NO_DEPTH: "No offers under ceiling",
};

export function reasonText(code: string): string {
  return REASON[code] ?? code.replaceAll("_", " ").toLowerCase();
}

// A crew member speaking: small avatar, then a soft bubble.
function Said({ who, tone = "plain", children }: { who: CrewMember; tone?: "plain" | "warn" | "ok" | "lavender" | "bad" | "sky"; children: ReactNode }) {
  const bg = { plain: "bg-surface ring-1 ring-line", warn: "bg-warn-soft/70", ok: "bg-ok-soft", lavender: "bg-lavender", bad: "bg-bad-soft text-bad", sky: "bg-sky" }[tone];
  return (
    <div className="flex items-end gap-2">
      <Mascot who={who} size={30} className="mb-0.5" />
      <div className={clsx("min-w-0 flex-1 rounded-[18px] rounded-bl-[6px] px-3.5 py-2.5", bg)}>{children}</div>
    </div>
  );
}

export function Feed({ items, onSelectSource }: { items: FeedItem[]; onSelectSource?: (id: string) => void }) {
  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <Row key={it.key}>
            {it.kind === "tool" && <ToolCard item={it} onSelectSource={onSelectSource} />}
            {it.kind === "note" && (
              <Said who="scout">
                <div className="text-[14px] leading-[22px]">{it.start.title}</div>
              </Said>
            )}
            {it.kind === "evidence" && (
              <div className="ml-1 border-l-2 border-blue pl-3">
                <div className="flex items-center gap-1.5">
                  <Chip tone={it.start.payload.provenance === "source" ? "sky" : "neutral"}>{it.start.payload.provenance === "source" ? "Observed" : "Inference"}</Chip>
                  {it.start.payload.domain && <span className="text-[11px] text-faint">{it.start.payload.domain}</span>}
                </div>
                <div className="mt-1 text-[13px] leading-5">{it.start.title}</div>
              </div>
            )}
            {it.kind === "rejected" && (
              <Said who="nova" tone="warn">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium leading-5">{it.start.title}</div>
                  {it.start.payload.summary && <div className="text-[12px] leading-5 text-muted">{it.start.payload.summary}</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {((it.start.payload.reasons ?? it.start.payload.closest?.reasons ?? []) as string[]).map((r) => (
                      <Chip key={r} tone="warn">{reasonText(r)}</Chip>
                    ))}
                  </div>
                </div>
              </Said>
            )}
            {it.kind === "accepted" && (
              <Said who="nova" tone="ok">
                <div className="text-[13px] font-medium leading-5">{it.start.title}</div>
              </Said>
            )}
            {it.kind === "quote" && (
              <Said who="penny" tone={it.start.type === "quote.stale" ? "warn" : "plain"}>
                <div className="tabular text-[13px] leading-5">{it.start.title}</div>
              </Said>
            )}
            {it.kind === "approval" && (
              <Said who="penny" tone={it.start.type === "approval.recorded" ? "plain" : "lavender"}>
                <div className="text-[13.5px] font-semibold">{it.start.type === "approval.recorded" ? "Approved. Funds reserved." : "Ready for your review"}</div>
                <div className="tabular text-[12.5px] text-muted">{it.start.title}</div>
              </Said>
            )}
            {it.kind === "order" && (
              <Said who="penny" tone={it.start.type === "order.reconciled" ? "ok" : it.start.type === "order.unknown" ? "bad" : "plain"}>
                <div className="tabular text-[13px] leading-5">{it.start.title}</div>
              </Said>
            )}
            {it.kind === "capacity" && (
              <Said who="sprout">
                <div className="text-[13px] leading-5">{it.start.title}</div>
              </Said>
            )}
            {it.kind === "simulation" && (
              <div className="rounded-[16px] border border-dashed border-line px-3 py-2.5 text-[12.5px]">
                <Chip tone="dark">Simulation</Chip> <span className="ml-1">{it.start.title}</span>
              </div>
            )}
            {it.kind === "failed" && (
              <Said who="scout" tone="bad">
                <div className="text-[13px]">{it.start.title}</div>
              </Said>
            )}
            {it.kind === "input" && (
              <Said who="scout" tone="sky">
                <div className="text-[13px] font-semibold">{it.start.title}</div>
              </Said>
            )}
          </Row>
        ))}
      </AnimatePresence>
    </div>
  );
}
