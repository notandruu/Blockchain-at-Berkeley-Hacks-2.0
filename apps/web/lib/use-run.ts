"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, streamRunEvents } from "./api";
import type { RunEvent, RunStateName, RunView } from "./types";

// Events that change persisted rows the workspace renders. On these we re-read the view so
// screenshots get fresh signed URLs and totals come from the database, not from the event.
const REFRESH_ON = new Set([
  "source.captured",
  "source.capture_failed",
  "evidence.added",
  "approval.required",
  "approval.recorded",
  "order.submitted",
  "order.reconciled",
  "order.no_fill",
  "order.unknown",
  "capacity.changed",
  "campaign.paused",
  "run.state_changed",
  "run.failed",
  "quote.stale",
]);

export function useRun(runId: string) {
  const [view, setView] = useState<RunView | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [stream, setStream] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setView(await api<RunView>(`/api/runs/${runId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [runId]);

  useEffect(() => {
    void refresh();
    const stop = streamRunEvents<RunEvent>(
      runId,
      (ev) => {
        setEvents((prev) => (prev.some((p) => p.sequence === ev.sequence) ? prev : [...prev, ev].sort((a, b) => a.sequence - b.sequence)));
        if (REFRESH_ON.has(ev.type)) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void refresh(), 120);
        }
      },
      (s) => setStream(s),
    );
    return () => {
      stop();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runId, refresh]);

  const state: RunStateName | null = useMemo(() => {
    const last = [...events].reverse().find((e) => e.type === "run.state_changed" || e.type === "run.failed");
    return (last?.payload?.to as RunStateName) ?? view?.run.state ?? null;
  }, [events, view]);

  return { view, events, state, stream, error, refresh };
}

export type Phase = "starting" | "input" | "researching" | "evaluating" | "approval" | "executing" | "operating" | "no_match" | "failed";

export function phaseOf(state: RunStateName | null): Phase {
  switch (state) {
    case null:
    case "DRAFT":
      return "starting";
    case "NEEDS_INPUT":
      return "input";
    case "RESEARCHING":
      return "researching";
    case "MATCHING":
    case "QUOTING":
      return "evaluating";
    case "AWAITING_APPROVAL":
      return "approval";
    case "APPROVED":
    case "SUBMITTING":
    case "RECONCILING":
    case "EXECUTION_UNKNOWN":
      return "executing";
    case "NO_EXECUTABLE_MATCH":
    case "NO_FILL":
      return "no_match";
    case "FAILED":
      return "failed";
    default:
      return "operating";
  }
}
