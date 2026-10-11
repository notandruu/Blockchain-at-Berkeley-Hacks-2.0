"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import { stateLabel } from "@/components/run/state-label";
import { Chip } from "@/components/ui/primitives";
import { api } from "@/lib/api";

interface Risk { id: string; title: string; mode: string; status: string; created_at: string; run_id: string; run_state: string; best_match: string | null }

export default function RisksPage() {
  const [rows, setRows] = useState<Risk[] | null>(null);
  useEffect(() => void api<Risk[]>("/api/risks").then(setRows).catch(() => setRows([])), []);
  return (
    <AppShell title="Risks">
      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Risks</h1>
        <p className="mt-1 text-[14px] text-muted">Proposed and active exposures. Proposals are not positions until a fill is reconciled.</p>
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-[23px] bg-surface ring-1 ring-line">
          {rows === null && <div className="skeleton h-16" />}
          {rows?.length === 0 && <div className="p-6 text-[14px] text-muted">No risks yet. Start from New task.</div>}
          {rows?.map((r) => {
            const s = stateLabel(r.run_state);
            return (
              <Link key={r.id} href={`/runs/${r.run_id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-well-soft">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold">{r.title}</div>
                  <div className="text-[12px] text-faint">{r.mode} · {new Date(r.created_at).toLocaleString()}</div>
                </div>
                {r.best_match && <Chip tone={r.best_match === "exact" ? "ok" : r.best_match === "proxy" ? "warn" : "neutral"}>{r.best_match}</Chip>}
                <Chip tone={r.status === "research_only" ? "neutral" : "sky"}>{r.status.replace("_", " ")}</Chip>
                <Chip tone={s.tone}>{s.text}</Chip>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
