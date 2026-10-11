"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import { Button, Chip, ErrorNotice, Label, Money } from "@/components/ui/primitives";
import { api } from "@/lib/api";

interface Connections {
  environment: string;
  context: { configured: boolean };
  agent: { configured: boolean; model: string };
  gemini: { configured: boolean; reachable?: boolean; error?: string; terms?: { hasAcceptedLatest: boolean; acceptedVersion: number | null; latestVersion: number | null }; balance?: { available: string; total: string } | null };
  account: { blocked_by_order_id: string | null; blocked_reason: string | null };
  accountStream: { connected: boolean; stale: boolean; lastMessageAt: string | null; lastError: string | null } | null;
}

function Row({ name, ok, children }: { name: string; ok: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <span className={`mt-1.5 size-2 rounded-full ${ok ? "bg-ok" : "bg-faint"}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold">{name}</div>
        <div className="mt-0.5 space-y-1 text-[13px] text-muted">{children}</div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  const [c, setC] = useState<Connections | null>(null);
  const [terms, setTerms] = useState<{ version: number; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api<Connections>("/api/settings/connections").then(setC).catch((e) => setError(e.message));
  useEffect(() => void load(), []);
  return (
    <AppShell title="Connections">
      <div className="mx-auto max-w-[760px] space-y-5 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Connections</h1>
          <p className="mt-1 text-[14px] text-muted">Credentials live in the service environment. The browser never sees them.</p>
        </div>
        <ErrorNotice error={error} />
        {c && (
          <div className="divide-y divide-line overflow-hidden rounded-[23px] bg-surface ring-1 ring-line">
            <Row name="Gemini Predictions (sandbox)" ok={!!c.gemini.reachable}>
              {!c.gemini.configured && <div>Not configured. Set GEMINI_API_KEY and GEMINI_API_SECRET for a sandbox key.</div>}
              {c.gemini.error && <div className="text-bad">{c.gemini.error}</div>}
              {c.gemini.terms && (
                <div className="flex items-center gap-2">
                  Exchange terms <Chip tone={c.gemini.terms.hasAcceptedLatest ? "ok" : "warn"}>{c.gemini.terms.hasAcceptedLatest ? `accepted v${c.gemini.terms.acceptedVersion}` : `v${c.gemini.terms.latestVersion} not accepted`}</Chip>
                </div>
              )}
              {c.gemini.balance && <div>Available <Money value={c.gemini.balance.available} /> test USD</div>}
              {c.accountStream && <div>Order stream {c.accountStream.connected && !c.accountStream.stale ? "connected" : "disconnected; buying is disabled until it reconciles"}</div>}
              {c.account.blocked_by_order_id && <div className="text-warn">Account lane held by an order in state {c.account.blocked_reason}</div>}
              {c.gemini.terms && !c.gemini.terms.hasAcceptedLatest && (
                <div className="space-y-2 pt-2">
                  {!terms ? (
                    <Button size="sm" onClick={() => api<{ version: number; content: string }>("/api/settings/terms").then(setTerms).catch((e) => setError(e.message))}>Read exchange terms</Button>
                  ) : (
                    <>
                      <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-[12px] bg-well-soft p-3 text-[12px]">{terms.content}</div>
                      <Button size="sm" variant="money" busy={busy} onClick={async () => { setBusy(true); try { await api("/api/settings/terms/accept", { method: "POST", body: JSON.stringify({ confirm: true }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } setBusy(false); }}>
                        I am the account owner and accept these terms
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Row>
            <Row name="Context.dev" ok={c.context.configured}>{c.context.configured ? "API key set. Search, scrape with screenshots and highlights, monitors." : "Not configured. Set CONTEXT_DEV_API_KEY."}</Row>
            <Row name="Agent model" ok={c.agent.configured}>{c.agent.configured ? <>Anthropic via AI SDK · <span className="font-mono text-[12px]">{c.agent.model}</span></> : "Not configured. Set ANTHROPIC_API_KEY and AGENT_MODEL."}</Row>
          </div>
        )}
        <div className="rounded-[18px] bg-well-soft p-4 text-[12.5px] text-muted">
          <Label className="mb-1">Environment</Label>
          This build refuses to start unless GEMINI_ENV is sandbox and production trading is disabled. Exchange terms are accepted only by an account owner on this page, never by the agent.
        </div>
      </div>
    </AppShell>
  );
}
