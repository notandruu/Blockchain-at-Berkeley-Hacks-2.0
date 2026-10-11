"use client";

import clsx from "clsx";
import { Check, CircleHelp, Minus, X } from "lucide-react";
import { motion } from "motion/react";
import type { FieldCheck, RunEvent, RunView } from "@/lib/types";
import { Chip, Label } from "../ui/primitives";
import { reasonText } from "./feed";

export function CheckIcon({ status }: { status: FieldCheck["status"] }) {
  if (status === "match") return <Check className="size-3.5 text-ok" aria-label="match" />;
  if (status === "partial") return <Minus className="size-3.5 text-warn" aria-label="partial" />;
  if (status === "mismatch") return <X className="size-3.5 text-bad" aria-label="mismatch" />;
  return <CircleHelp className="size-3.5 text-faint" aria-label="unknown" />;
}

export function ChecksTable({ checks, compact }: { checks: FieldCheck[]; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[14px] ring-1 ring-line">
      <div className="grid grid-cols-[110px_1fr_1fr_22px] gap-x-3 bg-well-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        <span>Field</span>
        <span>Your trigger</span>
        <span>Contract</span>
        <span />
      </div>
      {checks.map((c) => (
        <div key={c.field} className={clsx("grid grid-cols-[110px_1fr_1fr_22px] items-start gap-x-3 border-t border-line px-3", compact ? "py-1.5" : "py-2")}>
          <span className="text-[12px] font-semibold capitalize">{c.field}</span>
          <span className="break-words text-[12px] text-muted">{c.merchant}</span>
          <span className="break-words text-[12px] text-muted">
            {c.contract}
            {c.note && <span className={clsx("mt-0.5 block text-[11px]", c.status === "partial" ? "text-warn" : "text-faint")}>{c.note}</span>}
          </span>
          <span className="pt-0.5"><CheckIcon status={c.status} /></span>
        </div>
      ))}
    </div>
  );
}

export function Evaluation({ view, events }: { view: RunView; events: RunEvent[] }) {
  const accepted = [...events].reverse().find((e) => e.type === "match.accepted");
  const rejected = events.filter((e) => e.type === "match.rejected" && e.payload.instrumentSymbol);
  const quote = [...events].reverse().find((e) => e.type === "quote.ready");
  const candidates = events.filter((e) => e.type === "market.candidates").at(-1);
  return (
    <div className="space-y-5">
      {candidates && (
        <div className="grid grid-cols-2 gap-3">
          {(candidates.payload.summary as { environment: string; contracts: number; eventsScanned: number; categoriesMissing: string[] }[]).map((s) => (
            <div key={s.environment} className="rounded-[18px] bg-surface p-4 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <Label>{s.environment === "sandbox" ? "Gemini sandbox" : "Gemini production"}</Label>
                <Chip tone={s.environment === "sandbox" ? "ok" : "neutral"}>{s.environment === "sandbox" ? "executable" : "reference only"}</Chip>
              </div>
              <div className="tabular mt-2 text-[24px] font-semibold tracking-[-0.03em]">{s.contracts}</div>
              <div className="text-[12px] text-muted">contracts across {s.eventsScanned} active events</div>
              {s.categoriesMissing.length > 0 && <div className="mt-1 text-[11.5px] text-warn">No active {s.categoriesMissing.join(", ")} events</div>}
            </div>
          ))}
        </div>
      )}

      {accepted ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-[23px] bg-surface p-5 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <Chip tone="ok">{accepted.payload.matchType === "exact" ? "Exact match" : "Proxy match"}</Chip>
            <span className="font-mono text-[11px] text-faint">{accepted.payload.instrumentSymbol}</span>
          </div>
          <div className="text-[17px] font-semibold tracking-[-0.02em]">{accepted.title}</div>
          <ChecksTable checks={accepted.payload.checks} />
          {quote && (
            <div className="tabular flex flex-wrap gap-x-6 gap-y-1 pt-1 text-[13px]">
              <span><span className="text-muted">Quantity </span>{quote.payload.quote.quantity}</span>
              <span><span className="text-muted">Limit </span>${quote.payload.quote.limitPrice}</span>
              <span><span className="text-muted">Est. debit </span>${quote.payload.quote.estimatedDebitUsd}</span>
              <span><span className="text-muted">Max debit </span>${quote.payload.quote.maxDebitUsd}</span>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="rounded-[23px] bg-well-soft p-5">
          <div className="skeleton mb-3 h-4 w-1/3 rounded" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-8 rounded-[10px]" />
            ))}
          </div>
        </div>
      )}

      {rejected.length > 0 && (
        <div className="space-y-2">
          <Label>Considered and not chosen</Label>
          {rejected.map((r) => (
            <motion.div key={r.sequence} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start justify-between gap-3 rounded-[16px] bg-surface px-4 py-3 ring-1 ring-line">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">{r.title}</div>
                <div className="font-mono text-[11px] text-faint">{r.payload.instrumentSymbol} · {r.payload.environment}</div>
                {r.payload.referencePrice && <div className="mt-0.5 text-[11.5px] text-muted">Production reference price ${r.payload.referencePrice}. Not a sandbox quote.</div>}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {(r.payload.reasons as string[]).map((x) => (
                  <Chip key={x} tone="warn">{reasonText(x)}</Chip>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {view.matches.length > 0 && <div className="text-[11.5px] text-faint">{view.matches.length} contracts checked field by field.</div>}
    </div>
  );
}
