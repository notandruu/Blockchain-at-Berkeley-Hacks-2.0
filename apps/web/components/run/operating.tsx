"use client";

import clsx from "clsx";
import { Check, ExternalLink, Pause, QrCode } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CampaignRow, OrderRow, PlanRow, RunEvent, RunView } from "@/lib/types";
import { Button, Chip, Label, Money, SkeletonLines } from "../ui/primitives";
import { ScenarioTable } from "./plan-card";

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: reduce ? 0 : 0.25, ease: "easeOut" });
    return () => c.stop();
  }, [value, mv, reduce]);
  return <motion.span className="tabular">{text}</motion.span>;
}

function DrawnCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-ok" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-label="Fill confirmed">
      <motion.path d="M5 12.5l4.2 4.2L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.14, ease: "easeOut" }} />
    </svg>
  );
}

export function Executing({ order, events }: { order: OrderRow | null; events: RunEvent[] }) {
  const unknown = events.some((e) => e.type === "order.unknown") && !events.some((e) => e.type === "order.reconciled");
  const submitted = events.some((e) => e.type === "order.submitted");
  return (
    <div className="rounded-[23px] bg-surface p-6 shadow-[var(--shadow-float)] ring-1 ring-line">
      <div className="flex items-center gap-2">
        <Chip tone={unknown ? "bad" : "neutral"}>{unknown ? "Execution status unknown" : submitted ? "Order submitted" : "Funds reserved"}</Chip>
        <Chip tone="dark">Gemini sandbox</Chip>
      </div>
      <div className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">
        {unknown ? "Waiting for the exchange to confirm what happened" : submitted ? "Waiting for confirmed fills" : "Revalidating the quote before sending"}
      </div>
      <p className="mt-1 text-[13.5px] text-muted">
        {unknown
          ? "The submit response was lost. Funds stay reserved, nothing is resent, and the order is reconciled from Gemini's order history."
          : "Coverage counts only after the exchange reports executed quantity. Nothing is marked protected yet."}
      </p>
      <div className="mt-5 rounded-[18px] bg-well-soft p-4">
        <div className="mb-3 h-1 overflow-hidden rounded bg-well">
          <div className="h-full w-1/3 bg-ink/30" style={{ animation: "var(--animate-indeterminate)" }} />
        </div>
        <SkeletonLines widths={["60%", "40%", "70%"]} />
      </div>
      {order && (
        <div className="tabular mt-4 grid grid-cols-3 gap-4 text-[13px]">
          <div><Label>Quantity</Label>{order.quantity} {order.outcome.toUpperCase()}</div>
          <div><Label>Limit</Label>${order.limit_price}</div>
          <div><Label>Reserved</Label><Money value={order.reserved_usd} /></div>
        </div>
      )}
    </div>
  );
}

export function Receipt({ order, plan }: { order: OrderRow; plan: PlanRow }) {
  const total = Number(order.principal_usd) + Number(order.fees_usd);
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[23px] bg-surface p-6 shadow-[var(--shadow-float)] ring-1 ring-line">
      <div className="flex items-center gap-2">
        <DrawnCheck />
        <span className="text-[15px] font-semibold">Hedge confirmed</span>
        <Chip tone="ok">reconciled</Chip>
        <span className="ml-auto font-mono text-[11px] text-faint">order {order.exchange_order_id}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div><Label>Held</Label><div className="tabular mt-1 text-[22px] font-semibold tracking-[-0.03em]">{Number(order.filled_quantity).toLocaleString()} {order.outcome.toUpperCase()}</div></div>
        <div><Label>Cash spent</Label><div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]"><CountUp value={total} /></div></div>
        <div><Label>Conditional payout</Label><div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]"><Money value={order.filled_quantity} /></div></div>
        <div><Label>Approved max</Label><div className="mt-1 text-[15px]"><Money value={plan.body.plan.maxDebitUsd} /></div></div>
      </div>
      <div className="tabular mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[12px] text-muted">
        <span>avg price ${Number(order.avg_price).toFixed(4)}</span>
        <span>principal <Money value={order.principal_usd} /></span>
        <span>fees <Money value={order.fees_usd} /> ({order.fees_source === "stream" ? "reported by exchange" : "fee formula"})</span>
        <span>exchange status {order.exchange_status}</span>
        <span>{order.symbol}</span>
      </div>
    </motion.div>
  );
}

export function CampaignPanel({ campaign, onChange }: { campaign: CampaignRow; onChange: () => void }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const capacity = campaign.max_entitlements;
  const claimed = campaign.claimed;
  const remaining = Math.max(0, capacity - claimed);
  const link = `${origin}/c/${campaign.slug}?t=${encodeURIComponent(campaign.public_token)}`;
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-4 rounded-[23px] bg-surface p-6 ring-1 ring-line sm:grid-cols-[1fr_auto]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <Label>Test campaign</Label>
          <Chip tone={campaign.status === "active" ? "ok" : "warn"}>{campaign.status}</Chip>
        </div>
        <div className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">{campaign.headline}</div>
        <div className="text-[12.5px] text-muted">{campaign.qualification}. Test reward only, no real payment.</div>
        <div>
          <div className="tabular mb-1.5 flex justify-between text-[12.5px]">
            <span className="font-semibold">{claimed} claimed</span>
            <span className="text-muted">{remaining} of {capacity} left</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-well">
            <motion.div className={clsx("h-full rounded-full", remaining === 0 ? "bg-warn" : "bg-ok")} initial={false} animate={{ width: `${capacity ? (remaining / capacity) * 100 : 0}%` }} transition={{ duration: 0.25, ease: "easeOut" }} />
          </div>
          {remaining === 0 && <div className="mt-1.5 text-[12px] text-warn">Capacity reached. New claims stop; existing rewards stay covered.</div>}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={link} target="_blank" rel="noreferrer"><Button size="sm" icon={ExternalLink}>Open customer page</Button></a>
          {campaign.status === "active" && (
            <Button size="sm" variant="ghost" icon={Pause} busy={busy} onClick={async () => { setBusy(true); await api(`/api/campaigns/${campaign.id}/pause`, { method: "POST", body: JSON.stringify({ reason: "Paused by merchant" }) }); setBusy(false); onChange(); }}>
              Pause enrollment
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-[18px] bg-well-soft p-4">
        {origin ? <QRCodeSVG value={link} size={132} bgColor="transparent" fgColor="#11191c" level="M" /> : <QrCode className="size-10 text-faint" />}
        <span className="text-[11px] text-muted">Scan to claim a test reward</span>
      </div>
    </div>
  );
}

export function SimulationPanel({ runId, events }: { runId: string; events: RunEvent[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const last = [...events].reverse().find((e) => e.type === "simulation.result");
  return (
    <div className="rounded-[23px] border border-dashed border-line p-5">
      <div className="flex items-center gap-2">
        <Chip tone="dark">Simulation</Chip>
        <span className="text-[12px] text-muted">Hypothetical outcomes from the saved plan. Never touches the exchange or the reward ledger.</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["win", "lose", "mismatch"] as const).map((s) => (
          <Button key={s} size="sm" busy={busy === s} onClick={async () => { setBusy(s); await api(`/api/demo/${runId}/scenario`, { method: "POST", body: JSON.stringify({ scenario: s }) }).catch(() => {}); setBusy(null); }}>
            {s === "win" ? "Event happens" : s === "lose" ? "Event does not happen" : "Settlement mismatch"}
          </Button>
        ))}
      </div>
      {last && <div className="mt-3"><ScenarioTable rows={[last.payload.row]} /></div>}
    </div>
  );
}

export function NoMatch({ events }: { events: RunEvent[] }) {
  const e = [...events].reverse().find((x) => x.type === "match.rejected" && x.payload.summary);
  const closest = e?.payload.closest;
  return (
    <div className="space-y-4 rounded-[23px] bg-surface p-6 ring-1 ring-line">
      <Chip>No executable match</Chip>
      <div className="text-[20px] font-semibold tracking-[-0.02em]">{e?.payload.summary ?? "No listed contract pays on this trigger."}</div>
      <p className="text-[13.5px] text-muted">RiskPilot does not substitute a different contract or a production quote to complete the plan. Here is the closest contract and exactly where it differs.</p>
      {closest && (
        <div className="space-y-2">
          <div className="font-mono text-[11px] text-faint">{closest.instrumentSymbol} · {closest.environment}</div>
          <div className="overflow-hidden rounded-[14px] ring-1 ring-line">
            {(closest.checks as { field: string; merchant: string; contract: string; status: string; note?: string }[]).map((c) => (
              <div key={c.field} className="grid grid-cols-[110px_1fr_1fr] gap-3 border-b border-line px-3 py-2 text-[12px] last:border-0">
                <span className="font-semibold capitalize">{c.field}</span>
                <span className="text-muted">{c.merchant}</span>
                <span className={clsx(c.status === "match" ? "text-muted" : "text-warn")}>{c.contract}{c.note && <span className="block text-[11px]">{c.note}</span>}</span>
              </div>
            ))}
          </div>
          {(closest.caveats as string[]).map((c: string) => <div key={c} className="text-[12.5px] text-muted">{c}</div>)}
        </div>
      )}
    </div>
  );
}

export function InputRequest({ runId, event, onDone }: { runId: string; event: RunEvent; onDone: () => void }) {
  const missing = event.payload.missing as { field: string; question: string; why: string }[];
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4 rounded-[23px] bg-sky p-6">
      <div className="text-[17px] font-semibold">{event.title}</div>
      {missing.map((m) => (
        <label key={m.field} className="block space-y-1">
          <span className="text-[13.5px] font-medium">{m.question}</span>
          <input className="h-11 w-full rounded-[14px] bg-surface px-3 text-[14px] outline-none ring-1 ring-line focus:ring-blue-ink/40" value={values[m.field] ?? ""} onChange={(e) => setValues({ ...values, [m.field]: e.target.value })} />
          <span className="text-[11.5px] text-muted">{m.why}</span>
        </label>
      ))}
      <Button variant="primary" busy={busy} disabled={missing.some((m) => !values[m.field]?.trim())} icon={Check} onClick={async () => { setBusy(true); await api(`/api/runs/${runId}/inputs`, { method: "POST", body: JSON.stringify({ answers: values }) }); setBusy(false); onDone(); }}>
        Continue research
      </Button>
    </div>
  );
}

export function OperatingView({ view, events, onChange }: { view: RunView; events: RunEvent[]; onChange: () => void }) {
  const order = view.orders.find((o) => o.state === "reconciled" && Number(o.filled_quantity) > 0) ?? null;
  const plan = view.plans.find((p) => p.status === "executed") ?? view.plans.at(-1)!;
  const campaign = view.campaigns[0];
  return (
    <div className="space-y-4">
      {order && plan && <Receipt order={order} plan={plan} />}
      {campaign && <CampaignPanel campaign={campaign} onChange={onChange} />}
      <SimulationPanel runId={view.run.id} events={events} />
    </div>
  );
}
