"use client";

import clsx from "clsx";
import { Briefcase, LayoutGrid, Megaphone, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SERVICE_URL, supabase } from "@/lib/api";

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

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted">
      <span className={clsx("size-1.5 rounded-full", ok ? "bg-ok" : "bg-faint")} />
      <span>{label}</span>
      <span className="ml-auto text-[11px] text-faint">{ok ? "connected" : "not set"}</span>
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
          <div className="flex size-7 items-center justify-center rounded-[9px] bg-ink text-white">
            <LayoutGrid className="size-4" strokeWidth={2.2} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Beagle</span>
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
        <div className="mt-auto space-y-2 rounded-[14px] bg-well-soft p-3">
          <div className="label mb-1">Connections</div>
          <Dot ok={!!health?.providers.context} label="Context.dev" />
          <Dot ok={!!health?.providers.gemini && !health?.accountStream?.stale} label="Gemini sandbox" />
          <Dot ok={!!health?.providers.agent} label="Agent model" />
          <Link href="/settings/connections" className="block pt-1 text-[11px] font-semibold text-blue-ink">
            Manage
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
