"use client";

import clsx from "clsx";
import { ChevronDown, ExternalLink, Lock, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, newKey } from "@/lib/api";
import type { PlanRow, QuoteCheck, RunView } from "@/lib/types";
import { Button, Chip, ErrorNotice, Label, Money } from "../ui/primitives";
import { ChecksTable } from "./evaluation";
import { Mascot } from "../crew";

function Stat({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={clsx("tabular mt-1 truncate", strong ? "text-[22px] font-semibold tracking-[-0.03em]" : "text-[15px] font-medium")}>{children}</div>
    </div>
  );
}

export function ScenarioTable({ rows }: { rows: PlanRow["body"]["presentation"]["scenarios"] }) {
  return (
    <div className="overflow-hidden rounded-[14px] ring-1 ring-line">
      <div className="grid grid-cols-[1.6fr_repeat(4,minmax(0,0.7fr))] gap-x-3 bg-well-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        <span>Scenario</span>
        <span className="text-right">Owed</span>
        <span className="text-right">Cost</span>
        <span className="text-right">Payout</span>
        <span className="text-right">Net cost</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="border-t border-line px-3 py-2">
          <div className="grid grid-cols-[1.6fr_repeat(4,minmax(0,0.7fr))] items-baseline gap-x-3 text-[12.5px]">
            <span className="font-medium">{r.label}</span>
            <Money className="text-right" value={r.obligationUsd} />
            <Money className="text-right" value={r.costUsd} />
            <Money className="text-right" value={r.payoutUsd} />
            <Money className="text-right font-semibold" value={r.netCostUsd} />
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted">{r.note}</div>
        </div>
      ))}
    </div>
  );
}

// The central artifact. Shows estimate and authorized maximum separately, rechecks the live
// book every few seconds, and disables buying when the check is stale or fails. The button
// never pulses and nothing celebrates before a fill exists.
export function PlanCard({ view, plan, onApproved }: { view: RunView; plan: PlanRow; onApproved: () => void }) {
  const p = plan.body.plan;
  const pres = plan.body.presentation;
  const [check, setCheck] = useState<QuoteCheck | null>(plan.last_quote_check);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<"none" | "checks" | "scenarios" | "fills">("none");
  const key = useRef(newKey());
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const c = await api<QuoteCheck>(`/api/plans/${plan.id}/check`, { method: "POST" });
        if (alive) setCheck(c);
      } catch {
        /* the age display turns amber on its own */
      }
    };
    void run();
    const t = setInterval(run, 2500);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(tick);
    };
  }, [plan.id]);

  const maxAge = check?.quoteMaxAgeMs ?? 5000;
  const age = check ? now - new Date(check.observedAt).getTime() : Infinity;
  const fresh = !!check && check.fillable && age <= maxAge;
  const expired = new Date(p.expiresAt).getTime() <= now;
  const canBuy = fresh && !expired && plan.status === "proposed";
  const blocked = !check ? "Checking the live book" : !check.fillable ? `Not fillable now: ${check.reason.replaceAll("_", " ").toLowerCase()}` : age > maxAge ? "Quote is stale" : expired ? "Plan expired" : null;

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/plans/${plan.id}/approve`, { method: "POST", idempotencyKey: key.current, body: JSON.stringify({ version: plan.version, planHash: plan.plan_hash }) });
      onApproved();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code.replaceAll("_", " ").toLowerCase()}: ${e.message}` : String(e));
      setBusy(false);
    }
  };

  const capacityShort = pres.requestedEntitlements != null && pres.entitlements < pres.requestedEntitlements;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="overflow-hidden rounded-[23px] bg-surface shadow-[var(--shadow-float)] ring-1 ring-line">
      <div className="relative space-y-4 p-6">
        <div className="flex items-center gap-3 rounded-[18px] bg-[#fdeee3]/70 px-3 py-2">
          <Mascot who="penny" size={44} state="waiting" />
          <div className="min-w-0 text-[12.5px] leading-[18px]">
            <span className="font-semibold">Penny sized this against the live sandbox book.</span>{" "}
            <span className="text-muted">Nothing is bought until you approve this exact version.</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="sky">Plan v{p.version}</Chip>
          <Chip tone={p.matchType === "exact" ? "ok" : "warn"}>{p.matchType === "exact" ? "Exact match" : "Proxy match"}</Chip>
          <Chip tone="dark">Gemini sandbox</Chip>
          <span className="ml-auto font-mono text-[11px] text-faint">{p.instrumentSymbol}</span>
        </div>
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-[24px] font-semibold leading-tight tracking-[-0.03em] outline-none">
            {p.campaign ? p.campaign.headline : `${pres.eventTitle}: ${pres.contractLabel}`}
          </h2>
          <p className="mt-1.5 text-[14px] text-muted">
            Buy <span className="font-semibold text-ink">{p.quantity} {p.outcome.toUpperCase()}</span> on “{pres.contractLabel}” ({pres.eventTitle}). Each contract pays $1 if it settles {p.outcome.toUpperCase()}, so the position pays up to <Money className="font-semibold text-ink" value={p.quantity} />.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-[18px] bg-well-soft p-4 sm:grid-cols-4">
          <Stat label="Estimated debit" strong><Money value={p.estimatedDebitUsd} /></Stat>
          <Stat label="Authorized max" strong><Money value={p.maxDebitUsd} /></Stat>
          <Stat label="Conditional payout"><Money value={p.quantity} /></Stat>
          <Stat label="Limit price">${p.limitPrice}</Stat>
          {p.campaign && <Stat label="Rewards covered">{p.campaign.maxEntitlements} × <Money value={p.campaign.rewardPerEntitlementUsd} /></Stat>}
          <Stat label="Order type">{p.timeInForce}</Stat>
          <Stat label="Settles">{pres.expiryDate ? new Date(pres.expiryDate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "n/a"}</Stat>
          <Stat label="Plan expires">{new Date(p.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</Stat>
        </div>

        {capacityShort && (
          <div className="flex gap-2.5 rounded-[14px] bg-warn-soft px-3.5 py-3 text-[13px]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <span>
              You asked for {pres.requestedEntitlements} rewards. The {pres.limitingFactor === "depth" ? "sandbox book only shows enough contracts under your price ceiling" : "budget only covers"} for <b>{pres.entitlements}</b>. The campaign will publish {pres.entitlements} slots and stop there.
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>What would not pay</Label>
          <ul className="space-y-1 text-[13px] text-muted">
            {pres.caveats.map((c) => (
              <li key={c} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-faint" />{c}</li>
            ))}
            <li className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-faint" />If the contract settles NO, rewards are not owed and the cost of the contracts is the promotion's expense.</li>
            <li className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-faint" />Fee ceiling assumes fills of at least {pres.feeAssumption.fillUnit} contract; actual fees are reconciled after the fill.</li>
          </ul>
        </div>

        <div className="divide-y divide-line rounded-[14px] ring-1 ring-line">
          {(
            [
              ["checks", "Why this contract matches", <ChecksTable key="c" checks={pres.checks} compact />],
              ["scenarios", "Outcomes", <ScenarioTable key="s" rows={pres.scenarios} />],
              [
                "fills",
                "How the quote was built",
                <div key="f" className="tabular space-y-1 text-[12.5px]">
                  {pres.quote.simulatedFills.map((f, i) => (
                    <div key={i} className="flex justify-between"><span>{f.quantity} @ ${f.price}</span><span className="text-muted">fee ${f.fee}</span></div>
                  ))}
                  <div className="flex justify-between border-t border-line pt-1"><span>Fee ceiling (max {pres.feeAssumption.maxFills} fills × ${pres.feeAssumption.perFillCeiling})</span><Money value={pres.quote.feeCeilingUsd} /></div>
                  {pres.termsUrl && <a href={pres.termsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 pt-1 font-semibold text-blue-ink">Contract terms <ExternalLink className="size-3" /></a>}
                </div>,
              ],
            ] as const
          ).map(([k, title, body]) => (
            <div key={k}>
              <button className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] font-semibold" onClick={() => setOpen(open === k ? "none" : k)} aria-expanded={open === k}>
                {title}
                <ChevronDown className={clsx("size-4 text-muted transition-transform", open === k && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {open === k && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="px-3.5 pb-3.5">{body}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-canvas px-6 py-4">
        <div className="min-w-0 flex-1 text-[12px]">
          <div className={clsx("tabular flex items-center gap-1.5 font-medium", fresh ? "text-muted" : "text-warn")} aria-live="polite">
            <span className={clsx("size-1.5 rounded-full", fresh ? "bg-ok" : "bg-warn")} />
            {check ? `Book checked ${Math.max(0, Math.round(age / 1000))}s ago` : "Checking the live book"}
            {check?.estimatedDebitUsd && fresh && <span className="text-faint">· now ${check.estimatedDebitUsd}</span>}
          </div>
          <div className="mt-0.5 text-faint">Authorizes this version only. Up to <Money value={p.maxDebitUsd} /> of sandbox funds, one fill-or-kill order.</div>
        </div>
        <Button variant="money" size="lg" icon={Lock} disabled={!canBuy} busy={busy} onClick={() => void approve()} title={blocked ?? undefined}>
          Approve and buy
        </Button>
      </div>
      {(error || (blocked && check)) && (
        <div className="px-6 pb-4">
          <ErrorNotice error={error} />
          {!error && blocked && <div className="text-[12px] text-warn">{blocked}</div>}
        </div>
      )}
      {view.run.mode === "recorded" && <div className="bg-chrome px-6 py-2 text-[11px] font-semibold text-white/80">Recorded run · original timestamps</div>}
    </motion.div>
  );
}
