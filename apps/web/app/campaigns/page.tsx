"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import { Chip, Money } from "@/components/ui/primitives";
import { api } from "@/lib/api";

interface Campaign { id: string; slug: string; venue_name: string; headline: string; reward_usd: string; max_entitlements: number; status: string; closes_at: string; run_id: string; claimed: number }

export default function CampaignsPage() {
  const [rows, setRows] = useState<Campaign[] | null>(null);
  useEffect(() => void api<Campaign[]>("/api/campaigns").then(setRows).catch(() => setRows([])), []);
  return (
    <AppShell title="Campaigns">
      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Campaigns</h1>
        <p className="mt-1 text-[14px] text-muted">A campaign exists only after its hedge filled. Capacity is the confirmed payout divided by the reward.</p>
        <div className="mt-6 grid gap-3">
          {rows?.length === 0 && <div className="rounded-[23px] bg-well-soft p-6 text-[14px] text-muted">No campaigns yet.</div>}
          {rows?.map((c) => {
            const left = Math.max(0, c.max_entitlements - c.claimed);
            return (
              <Link key={c.id} href={`/runs/${c.run_id}`} className="rounded-[23px] bg-surface p-5 ring-1 ring-line transition-colors hover:bg-well-soft">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-muted">{c.venue_name}</span>
                  <Chip tone={c.status === "active" ? "ok" : "warn"}>{c.status}</Chip>
                  <span className="ml-auto text-[12px] text-faint">closes {new Date(c.closes_at).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em]">{c.headline}</div>
                <div className="tabular mt-3 flex items-center gap-3 text-[13px]">
                  <span>{c.claimed} claimed</span>
                  <span className="text-muted">{left} of {c.max_entitlements} left</span>
                  <span className="ml-auto text-muted"><Money value={c.reward_usd} /> each</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-well">
                  <div className="h-full rounded-full bg-ok transition-[width] duration-300" style={{ width: `${c.max_entitlements ? (left / c.max_entitlements) * 100 : 0}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
