"use client";

import clsx from "clsx";
import { ArrowUp, Globe, Wallet } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell";
import { stateLabel } from "@/components/run/state-label";
import { Chip, ErrorNotice } from "@/components/ui/primitives";
import { CREW, CrewBadge, Mascot, Sparks, type CrewMember } from "@/components/crew";
import { api, newKey } from "@/lib/api";

const STARTERS = [
  {
    who: "sprout" as CrewMember,
    title: "Run an event promotion",
    body: "Offer customers money back if something happens, with the payout covered.",
    goal: "We're a bar near campus. Help us bring people in this week with a promotion: customers get $20 back on their tab if something exciting happens, like a big game or Bitcoin breaking a level. Research a relevant offer and prepare a hedge for my approval.",
    url: "",
    budget: "350",
  },
  {
    who: "penny" as CrewMember,
    title: "Insure an existing risk",
    body: "An outdoor job, a weather threshold, a cost you already carry.",
    goal: "I run an exterior painting crew in San Francisco. We have a $3,000 job booked for tomorrow; if the high goes above 71°F the paint won't cure and we reschedule. If cancelled we avoid about $1,200 in materials and labor. Is there a contract that protects the rest?",
    url: "",
    budget: "250",
  },
];

const CREW_JOBS: Record<CrewMember, string> = {
  scout: "Reads the web with Context.dev",
  nova: "Checks Gemini contracts field by field",
  penny: "Sizes the hedge and holds the budget",
  sprout: "Runs the campaign and its claims",
};

// Who is holding the work in this state.
function ownerOf(state: string): CrewMember {
  if (["MATCHING", "QUOTING", "NO_EXECUTABLE_MATCH"].includes(state)) return "nova";
  if (["AWAITING_APPROVAL", "APPROVED", "SUBMITTING", "RECONCILING", "EXECUTION_UNKNOWN", "NO_FILL"].includes(state)) return "penny";
  if (["ACTIVE", "MONITORING", "PAUSED"].includes(state)) return "sprout";
  return "scout";
}

interface RecentRun {
  id: string;
  goal: string;
  state: string;
  created_at: string;
  risk_title: string | null;
}

export default function Home() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [url, setUrl] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRun[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<RecentRun[]>("/api/runs").then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [goal]);

  const submit = async () => {
    if (goal.trim().length < 8 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ runId: string }>("/api/runs", {
        method: "POST",
        idempotencyKey: newKey(),
        body: JSON.stringify({ goal: goal.trim(), businessUrl: url.trim() || null, budgetUsd: budget.trim() || null }),
      });
      router.push(`/runs/${r.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <AppShell title="New task">
      <div className="mx-auto flex max-w-[760px] flex-col px-4 pb-20 pt-[5vh] sm:px-6">
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="relative mx-auto mb-2 h-[176px] w-[190px]">
          <Sparks />
          <Mascot who="scout" size={168} state={busy ? "working" : "idle"} className="absolute left-2 top-0 rotate-[3deg]" big />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="text-center text-[30px] font-semibold tracking-[-0.035em] sm:text-[36px]">
          What would you like to insure?
        </motion.h1>
        <p className="mx-auto mt-2 max-w-[520px] text-center text-[15px] text-muted">
          Describe the risk. Beagle researches it, finds a prediction market contract that pays out if it happens, and brings back one insurance plan for you to approve.
        </p>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }} className="mt-8 rounded-[32px] bg-surface p-2 shadow-[var(--shadow-float)] ring-1 ring-line">
          <textarea
            ref={area}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            rows={2}
            placeholder="Help our bar bring people in for an upcoming game. We can spend $350…"
            className="block w-full resize-none bg-transparent px-4 pt-3 text-[16px] leading-6 outline-none placeholder:text-faint"
          />
          <div className="flex flex-wrap items-center gap-2 px-2 pb-1 pt-2">
            <label className="flex h-9 items-center gap-1.5 rounded-[10px] bg-well-soft px-3 text-[13px] text-muted focus-within:ring-1 focus-within:ring-blue-ink/30">
              <Globe className="size-3.5" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Business URL" className="w-[180px] bg-transparent text-ink outline-none placeholder:text-faint" inputMode="url" />
            </label>
            <label className="flex h-9 items-center gap-1.5 rounded-[10px] bg-well-soft px-3 text-[13px] text-muted focus-within:ring-1 focus-within:ring-blue-ink/30">
              <Wallet className="size-3.5" />
              <span>$</span>
              <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Max spend" className="tabular w-[84px] bg-transparent text-ink outline-none placeholder:text-faint" inputMode="decimal" />
            </label>
            <span className="ml-auto hidden text-[11px] text-faint sm:inline">⌘ Enter</span>
            <button
              onClick={() => void submit()}
              disabled={goal.trim().length < 8 || busy}
              aria-label="Start research"
              className={clsx("flex size-10 items-center justify-center rounded-full transition-colors", goal.trim().length >= 8 ? "bg-blue text-ink hover:bg-[#b9dffd]" : "bg-well-soft text-faint")}
            >
              {busy ? <span className="size-2 animate-[var(--animate-breathe)] rounded-full bg-ink" /> : <ArrowUp className="size-[18px]" strokeWidth={2.2} />}
            </button>
          </div>
        </motion.div>
        <div className="mt-3"><ErrorNotice error={error} /></div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {STARTERS.map((s, i) => (
            <motion.button
              key={s.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              onClick={() => {
                setGoal(s.goal);
                if (s.url) setUrl(s.url);
                setBudget(s.budget);
                area.current?.focus();
              }}
              className="group flex items-center gap-3 rounded-[23px] bg-surface p-4 text-left ring-1 ring-line transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#fdfdfb]"
            >
              <span className="flex size-[58px] shrink-0 items-end justify-center overflow-hidden rounded-[18px]" style={{ background: CREW[s.who].tint }}>
                <Mascot who={s.who} size={64} className="-mb-2 transition-transform duration-200 group-hover:-translate-y-0.5" />
              </span>
              <div>
                <div className="text-[15px] font-semibold tracking-[-0.01em]">{s.title}</div>
                <div className="mt-0.5 text-[13px] leading-5 text-muted">{s.body}</div>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="mt-10">
          <div className="label mb-3 text-center">The crew</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(CREW) as CrewMember[]).map((k, i) => (
              <motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.04 }} className="flex flex-col items-center rounded-[20px] bg-well-soft px-3 pb-3 pt-2 text-center">
                <Mascot who={k} size={64} />
                <div className="mt-1 text-[13px] font-semibold">{CREW[k].name}</div>
                <div className="text-[11.5px] leading-4 text-muted">{CREW_JOBS[k]}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="mt-12">
            <div className="label mb-3">Recent</div>
            <div className="divide-y divide-line overflow-hidden rounded-[23px] bg-surface ring-1 ring-line">
              {recent.slice(0, 6).map((r) => (
                <Link key={r.id} href={`/runs/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-well-soft">
                  <CrewBadge who={ownerOf(r.state)} state={stateLabel(r.state).tone === "sky" ? "working" : "idle"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{r.risk_title ?? r.goal}</div>
                    <div className="text-[12px] text-faint">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  <Chip tone={stateLabel(r.state).tone}>{stateLabel(r.state).text}</Chip>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
