"use client";

import { ArrowRight } from "lucide-react";
import { Mascot, Sparks } from "@/components/crew";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNotice } from "@/components/ui/primitives";
import { supabase } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <form onSubmit={submit} className="w-full max-w-[360px] space-y-5">
        <div className="relative mx-auto h-[150px] w-[160px]">
          <Sparks />
          <Mascot who="scout" size={140} state="idle" className="absolute left-2 top-1 rotate-[3deg]" big />
        </div>
        <div>
          <h1 className="text-[23px] font-semibold tracking-[-0.03em]">Sign in to Beagle</h1>
          <p className="mt-1 text-sm text-muted">Sign in to run Beagle.</p>
        </div>
        <div className="space-y-3">
          <input className="h-12 w-full rounded-[19px] border border-line bg-surface px-4 text-[15px] outline-none focus:border-blue-ink/40" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="h-12 w-full rounded-[19px] border border-line bg-surface px-4 text-[15px] outline-none focus:border-blue-ink/40" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <ErrorNotice error={error} />
        <Button type="submit" variant="money" size="lg" className="w-full" busy={busy} icon={ArrowRight}>
          Continue
        </Button>
      </form>
    </div>
  );
}
