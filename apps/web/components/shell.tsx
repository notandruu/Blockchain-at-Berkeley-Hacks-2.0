"use client";

import clsx from "clsx";
import { Briefcase, Megaphone, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SERVICE_URL, supabase } from "@/lib/api";
import { CREW, Mascot, type CrewMember } from "./crew";

interface Health {
  providers: { context: boolean; gemini: boolean; agent: boolean };
  accountStream: { connected: boolean; stale: boolean } | null;
}

const NAV = [
  { href: "/", label: "New task", icon: Plus },
  { href: "/risks", label: "Risks", icon: ShieldCheck },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
];

export function useSession() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session) router.replace("/login");
        else {
          setEmail(data.session.user.email ?? null);
          setReady(true);
        }
      });
  }, [router]);
  return { ready, email };
}

function CrewSlot({ who, ok, detail }: { who: CrewMember; ok: boolean; detail: string }) {
  return (
    <div className="group relative flex flex-col items-center" title={`${CREW[who].name}: ${detail}`}>
      <Mascot who={who} size={34} state={ok ? "idle" : "paused"} />
      <span className={clsx("mt-0.5 text-[9.5px] font-semibold", ok ? "text-muted" : "text-faint")}>{CREW[who].name}</span>
      <span className={clsx("absolute right-0.5 top-0 size-2 rounded-full ring-2 ring-well-soft", ok ? "bg-ok" : "bg-faint")} />
    </div>
  );
}

export function AppShell({ children, title, actions }: { children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  const path = usePathname();
  const { ready, email } = useSession();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    const load = () => fetch(`${SERVICE_URL}/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  if (!ready) return <div className="min-h-dvh bg-canvas" />;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="sticky top-0 hidden h-dvh w-[208px] shrink-0 flex-col border-r border-line bg-canvas px-3 py-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-8 items-end justify-center overflow-hidden rounded-[10px] bg-[#e7eefc]">
            <Mascot who="scout" size={36} className="-mb-1.5" />
          </span>
          <span className="text-[16px] font-semibold tracking-[-0.025em]">Beagle</span>
        </Link>
        <nav className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] font-medium transition-colors",
                  active ? "bg-well text-ink" : "text-muted hover:bg-well-soft hover:text-ink",
                )}
              >
                <Icon className="size-4" strokeWidth={1.9} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-[16px] bg-well-soft p-3">
          <div className="label mb-2">Crew</div>
          <div className="grid grid-cols-4 gap-1">
            <CrewSlot who="scout" ok={!!health?.providers.context && !!health?.providers.agent} detail={health?.providers.context ? "Context.dev connected" : "needs CONTEXT_DEV_API_KEY"} />
            <CrewSlot who="nova" ok={!!health} detail="Gemini market data" />
            <CrewSlot who="penny" ok={!!health?.providers.gemini && !health?.accountStream?.stale} detail={health?.providers.gemini ? "sandbox account connected" : "needs Gemini sandbox keys"} />
            <CrewSlot who="sprout" ok={!!health} detail="campaigns" />
          </div>
          <Link href="/settings/connections" className="mt-2 block text-[11px] font-semibold text-blue-ink">
            Connections
          </Link>
        </div>
        {email && <div className="mt-3 truncate px-2 text-[11px] text-faint">{email}</div>}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas/85 px-6 backdrop-blur">
          <div className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title}</div>
          {actions}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-chrome px-2.5 py-1 text-[11px] font-semibold text-white/90">
            <span className="size-1.5 rounded-full bg-[#7dd3c0]" />
            Gemini sandbox
          </span>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
