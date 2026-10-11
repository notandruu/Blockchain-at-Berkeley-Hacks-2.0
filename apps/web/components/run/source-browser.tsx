"use client";

import clsx from "clsx";
import { FileText, Lock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RunEvent, RunView, SourceRow } from "@/lib/types";
import { Chip, SkeletonLines } from "../ui/primitives";
import { Mascot } from "../crew";

// A captured page, not a live iframe. Shows the real Context.dev screenshot when one exists,
// a text reader when only text succeeded, and an explicit error when neither did.

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

export function SourceBrowser({
  view,
  events,
  selectedId,
  onSelect,
}: {
  view: RunView;
  events: RunEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  // What is loading right now: the latest scrape tool.started with no capture event yet.
  const startedSeq = new Set(events.filter((e) => e.type === "tool.started" && e.payload.tool === "scrape").map((e) => e.sequence));
  for (const e of events) if (e.type === "source.captured" || e.type === "source.capture_failed" || e.type === "tool.failed") startedSeq.delete(Number(e.payload.startedSequence));
  const loading = [...startedSeq].map((s) => events.find((e) => e.sequence === s)!).at(-1) ?? null;

  const sources = view.sources;
  const current: SourceRow | null = loading ? null : (sources.find((s) => s.id === selectedId) ?? sources.at(-1) ?? null);
  const evidence = current ? view.evidence.filter((e) => e.source_id === current.id) : [];
  const highlights = current
    ? ((events.find((e) => e.type === "source.captured" && e.payload.sourceId === current.id)?.payload.highlights as string[] | undefined) ?? [])
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="overflow-hidden rounded-[var(--radius-browser)] bg-chrome shadow-[var(--shadow-browser)]">
        <div className="flex h-11 items-center gap-3 px-4">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-chrome-2 px-3 text-[12px] text-white/70">
            <Lock className="size-3 shrink-0 text-white/40" />
            <span className="truncate">{loading ? loading.payload.domain : current ? current.domain : "No page yet"}</span>
            <span className="ml-auto shrink-0 text-white/35">{current ? `fetched ${ago(current.retrieved_at)}` : loading ? "fetching" : ""}</span>
          </div>
          <span className="hidden shrink-0 text-[12px] font-medium text-white/50 sm:inline">Context.dev capture</span>
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f3f4f6]">
          <AnimatePresence mode="sync" initial={false}>
            {loading ? (
              <motion.div key={`loading-${loading.sequence}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="absolute inset-0 flex flex-col justify-center gap-5 bg-white p-10">
                <div className="flex items-center gap-3">
                  <Mascot who="scout" size={52} state="working" />
                  <div>
                    <div className="text-[15px] font-semibold text-ink">{loading.title}</div>
                    <div className="text-[12px] text-muted">Scout is reading {loading.payload.domain} through Context.dev</div>
                  </div>
                </div>
                <SkeletonLines widths={["92%", "70%", "84%", "60%"]} />
                <div className="h-1 overflow-hidden rounded bg-well">
                  <div className="h-full w-1/3 bg-blue-ink/40" style={{ animation: "var(--animate-indeterminate)" }} />
                </div>
              </motion.div>
            ) : current?.screenshotUrl ? (
              <motion.img
                key={current.id}
                src={current.screenshotUrl}
                alt={`Screenshot of ${current.title ?? current.domain}, captured by Context.dev`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.16 }}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            ) : current?.capture_status === "text_only" ? (
              <motion.div key={`text-${current.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="scroll-quiet absolute inset-0 overflow-y-auto bg-white p-8">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="size-4 text-muted" />
                  <span className="text-[12px] font-semibold text-muted">Reader view. No screenshot was returned for this page.</span>
                </div>
                <div className="text-[18px] font-semibold">{current.title}</div>
                <p className="mt-3 whitespace-pre-line text-[13px] leading-6 text-muted">{(current.excerpt ?? "").slice(0, 1800)}</p>
              </motion.div>
            ) : current?.capture_status === "failed" ? (
              <motion.div key={`fail-${current.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-muted">
                <Mascot who="scout" size={72} state="paused" />
                <div className="text-[13px]">Capture failed for {current.domain}. Nothing from this page is used as evidence.</div>
              </motion.div>
            ) : (
              <motion.div key="empty" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-[13px] text-faint">
                <Mascot who="scout" size={88} state="idle" />
                Pages Scout reads appear here.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="scroll-quiet -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={clsx(
                "group relative h-[58px] w-[92px] shrink-0 overflow-hidden rounded-[10px] bg-well ring-2 transition-all",
                current?.id === s.id ? "ring-ink" : "ring-transparent hover:ring-line",
              )}
              title={s.title ?? s.domain}
            >
              {s.screenshotUrl ? (
                <img src={s.screenshotUrl} alt={`Thumbnail of ${s.domain}`} className="h-full w-full object-cover object-top" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">{s.capture_status === "failed" ? "failed" : "text"}</div>
              )}
              <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-3 text-left text-[9.5px] font-medium text-white">{s.domain}</div>
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label">Evidence from this page</span>
            {current.cache_status && <Chip>{current.cache_status === "miss" ? "fresh fetch" : `cache ${Math.round((current.cache_age_ms ?? 0) / 60000)}m old`}</Chip>}
            {current.context_request_id && <Chip className="font-mono">req {current.context_request_id.slice(0, 10)}</Chip>}
          </div>
          <AnimatePresence initial={false}>
            {[...evidence.map((e) => ({ key: e.id, text: e.passage ?? e.claim, claim: e.claim })), ...highlights.slice(0, evidence.length ? 0 : 3).map((h, i) => ({ key: `h${i}`, text: h, claim: null as string | null }))].map((x) => (
              <motion.div key={x.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="rounded-[14px] bg-surface p-3 ring-1 ring-line">
                {x.claim && <div className="mb-1 text-[13px] font-semibold">{x.claim}</div>}
                <div className="line-clamp-4 border-l-2 border-blue pl-2.5 text-[12.5px] leading-5 text-muted">{x.text}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
