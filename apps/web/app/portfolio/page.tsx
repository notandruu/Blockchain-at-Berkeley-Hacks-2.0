"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import { Chip, Label, Money } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { Mascot } from "@/components/crew";

interface Portfolio {
  holdings: { id: string; symbol: string; outcome: string; confirmed_units: string; allocated_units: string; held_units: string; principal_usd: string; fees_usd: string; fees_source: string; avg_price: string; exchange_order_id: string; reconciled_at: string; risk_title: string; run_id: string; lifecycle: string }[];
  pending: { id: string; state: string; symbol: string; quantity: string; limit_price: string; reserved_usd: string; run_id: string }[];
  proposals: { id: string; version: number; max_debit_usd: string; status: string; run_id: string; symbol: string }[];
  exchange: { positions: { symbol: string; outcome: string; totalQuantity: string; avgPrice: string | null; marketValue: string | null }[]; balance: { available: string; total: string } | null; reconciledAt: string } | null;
}

export default function PortfolioPage() {
  const [p, setP] = useState<Portfolio | null>(null);
  useEffect(() => void api<Portfolio>("/api/portfolio").then(setP).catch(() => {}), []);
  const spent = p?.holdings.reduce((s, h) => s + Number(h.principal_usd) + Number(h.fees_usd), 0) ?? 0;
  const payout = p?.holdings.reduce((s, h) => s + Number(h.confirmed_units), 0) ?? 0;
  const allocated = p?.holdings.reduce((s, h) => s + Number(h.allocated_units), 0) ?? 0;
  return (
    <AppShell title="Portfolio">
      <div className="mx-auto max-w-[980px] space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Portfolio</h1>
          <p className="mt-1 text-[14px] text-muted">Only reconciled fills and app records. Proposals are listed separately and are not positions.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Cash spent", <Money key="a" value={spent} />],
            ["Conditional payout", <Money key="b" value={payout} />],
            ["Allocated to rewards", <Money key="c" value={allocated} />],
            ["USD available", p?.exchange?.balance ? <Money key="d" value={p.exchange.balance.available} /> : <span key="d" className="text-faint">n/a</span>],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-[20px] bg-surface p-4 ring-1 ring-line">
              <Label>{l}</Label>
              <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em]">{v}</div>
            </div>
          ))}
        </div>
        <section className="space-y-2">
          <Label>Holdings (reconciled)</Label>
          <div className="divide-y divide-line overflow-hidden rounded-[23px] bg-surface ring-1 ring-line">
            {p?.holdings.length === 0 && <div className="flex items-center gap-3 p-5 text-[14px] text-muted"><Mascot who="penny" size={56} />No confirmed holdings. Penny only lists fills the exchange has reconciled.</div>}
            {p?.holdings.map((h) => (
              <Link key={h.id} href={`/runs/${h.run_id}`} className="grid grid-cols-[1fr_auto] gap-2 px-5 py-4 hover:bg-well-soft sm:grid-cols-[1.4fr_repeat(4,auto)] sm:items-center sm:gap-6">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{h.risk_title}</div>
                  <div className="truncate font-mono text-[11px] text-faint">{h.symbol} · order {h.exchange_order_id}</div>
                </div>
                <span className="tabular text-[13px]">{Number(h.confirmed_units)} {h.outcome.toUpperCase()}</span>
                <span className="tabular text-[13px] text-muted">avg ${Number(h.avg_price).toFixed(4)}</span>
                <span className="tabular text-[13px]"><Money value={Number(h.principal_usd) + Number(h.fees_usd)} /></span>
                <Chip tone="ok">{h.lifecycle}</Chip>
              </Link>
            ))}
          </div>
        </section>
        {p?.exchange && (
          <section className="space-y-2">
            <Label>Exchange positions · reconciled {new Date(p.exchange.reconciledAt).toLocaleTimeString()}</Label>
            <div className="divide-y divide-line overflow-hidden rounded-[23px] bg-surface ring-1 ring-line">
              {p.exchange.positions.length === 0 && <div className="p-5 text-[14px] text-muted">The exchange reports no open positions.</div>}
              {p.exchange.positions.map((x) => (
                <div key={`${x.symbol}${x.outcome}`} className="tabular flex items-center gap-4 px-5 py-3 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{x.symbol}</span>
                  <span>{x.totalQuantity} {String(x.outcome).toUpperCase()}</span>
                  <span className="text-muted">{x.marketValue ? `mark $${x.marketValue}` : "no live bid"}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {(p?.pending.length ?? 0) > 0 && (
          <section className="space-y-2">
            <Label>Pending orders</Label>
            {p!.pending.map((o) => (
              <div key={o.id} className="tabular flex items-center gap-3 rounded-[16px] bg-warn-soft px-4 py-3 text-[13px]">
                <Chip tone="warn">{o.state}</Chip>
                <span className="font-mono text-[12px]">{o.symbol}</span>
                <span className="ml-auto">reserved <Money value={o.reserved_usd} /></span>
              </div>
            ))}
          </section>
        )}
        {(p?.proposals.length ?? 0) > 0 && (
          <section className="space-y-2">
            <Label>Proposals awaiting approval (not positions)</Label>
            {p!.proposals.map((x) => (
              <Link key={x.id} href={`/runs/${x.run_id}`} className="tabular flex items-center gap-3 rounded-[16px] border border-dashed border-line px-4 py-3 text-[13px] hover:bg-well-soft">
                <Chip>v{x.version}</Chip>
                <span className="font-mono text-[12px]">{x.symbol}</span>
                <span className="ml-auto text-muted">up to <Money value={x.max_debit_usd} /></span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
