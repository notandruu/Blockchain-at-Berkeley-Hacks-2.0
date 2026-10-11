"use client";

import { Ticket } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useCallback, useEffect, useState } from "react";
import { api, ApiError, newKey } from "@/lib/api";

interface PublicCampaign {
  slug: string;
  venueName: string;
  headline: string;
  qualification: string;
  rewardUsd: string;
  capacity: number;
  remaining: number;
  status: string;
  closesAt: string;
  eventTitle: string | null;
  settlesAt: string | null;
}

function participantKey(): string {
  try {
    const k = localStorage.getItem("rp-participant");
    if (k) return k;
    const n = `device-${newKey()}`;
    localStorage.setItem("rp-participant", n);
    return n;
  } catch {
    return `device-${newKey()}`;
  }
}

function ClaimPage({ slug }: { slug: string }) {
  const token = useSearchParams().get("t") ?? "";
  const [c, setC] = useState<PublicCampaign | null>(null);
  const [tab, setTab] = useState("");
  const [busy, setBusy] = useState(false);
  const [voucher, setVoucher] = useState<{ code: string; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idem] = useState(() => newKey());

  const load = useCallback(() => api<PublicCampaign>(`/api/public/campaigns/${slug}`, { anonymous: true }).then(setC).catch((e) => setError(e.message)), [slug]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ voucherCode: string; remaining: number }>(`/api/public/campaigns/${slug}/claims`, {
        method: "POST",
        anonymous: true,
        idempotencyKey: idem,
        body: JSON.stringify({ token, participant: participantKey(), tabTotalUsd: tab || "0" }),
      });
      setVoucher({ code: r.voucherCode, remaining: r.remaining });
      void load();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      setError(code === "CAPACITY_EXHAUSTED" ? "All covered rewards have been claimed." : code === "DUPLICATE_CLAIM" ? "This phone already has a reward for this campaign." : code === "CAMPAIGN_CLOSED" ? "Enrollment is closed." : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!c) return <div className="min-h-dvh bg-[#0f1a2b]" />;
  const minimum = /\$(\d+(?:\.\d+)?)/.exec(c.qualification)?.[1];
  const open = c.status === "active" && c.remaining > 0 && new Date(c.closesAt) > new Date();

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_80%_at_50%_0%,#1f3b63_0%,#0f1a2b_60%)] px-4 pb-10 pt-8 text-white">
      <div className="mx-auto max-w-[420px]">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-[15px] font-semibold tracking-[-0.01em]">{c.venueName}</div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">Test reward only</span>
        </div>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[30px] font-semibold leading-[1.1] tracking-[-0.035em]">
          {c.headline}
        </motion.h1>
        {c.eventTitle && <p className="mt-3 text-[14px] text-white/65">Based on Gemini contract: {c.eventTitle}{c.settlesAt ? `, settles ${new Date(c.settlesAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" })}` : ""}.</p>}

        <div className="mt-6 rounded-[24px] bg-white/[0.07] p-4 ring-1 ring-white/10">
          <div className="tabular flex items-baseline justify-between">
            <span className="text-[13px] text-white/70">Rewards left</span>
            <span className="text-[22px] font-semibold">{c.remaining}<span className="text-[13px] text-white/50"> / {c.capacity}</span></span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-[#7dd3c0]" initial={false} animate={{ width: `${c.capacity ? (c.remaining / c.capacity) * 100 : 0}%` }} transition={{ duration: 0.25 }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {voucher ? (
            <motion.div key="v" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 rounded-[24px] bg-white p-6 text-ink">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ok"><Ticket className="size-4" /> You're in</div>
              <div className="mt-3 font-mono text-[28px] font-semibold tracking-[0.12em]">{voucher.code}</div>
              <p className="mt-2 text-[13px] text-muted">If the contract settles YES, this test voucher is worth ${Number(c.rewardUsd)} on your tab. Test reward only. No real payment or credit.</p>
            </motion.div>
          ) : (
            <motion.div key="f" className="mt-6 space-y-3">
              <label className="block">
                <span className="text-[13px] text-white/70">{c.qualification}</span>
                <div className="mt-1.5 flex h-12 items-center rounded-[16px] bg-white/10 px-4 ring-1 ring-white/10 focus-within:ring-white/30">
                  <span className="text-white/60">$</span>
                  <input value={tab} onChange={(e) => setTab(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder={minimum ?? "0"} className="tabular ml-1 w-full bg-transparent text-[16px] outline-none placeholder:text-white/30" aria-label="Test tab amount" />
                </div>
              </label>
              <button
                disabled={!open || busy || !tab || (minimum ? Number(tab) < Number(minimum) : false)}
                onClick={() => void claim()}
                className="h-13 w-full rounded-full bg-[#7dd3c0] py-3.5 text-[15px] font-semibold text-[#0f1a2b] transition-[opacity,transform] active:scale-[0.99] disabled:opacity-40"
              >
                {busy ? "Claiming…" : open ? "Claim test reward" : "Enrollment closed"}
              </button>
              {error && <div className="rounded-[14px] bg-white/10 px-4 py-3 text-[13px]">{error}</div>}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-8 text-[11px] leading-5 text-white/40">
          Demo campaign on Gemini's sandbox with test funds. {c.venueName} is a fictional venue. Rewards are simulated merchant obligations, not financial instruments, and no payment or credit is issued.
        </p>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense>
      <ClaimPage slug={slug} />
    </Suspense>
  );
}
