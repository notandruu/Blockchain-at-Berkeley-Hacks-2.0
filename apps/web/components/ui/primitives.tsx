"use client";

import clsx from "clsx";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Primitives in OpenMuse's language: soft wells, 23px cards, pill buttons, tiny caps labels.

export function Card({ children, className, tone = "surface" }: { children: ReactNode; className?: string; tone?: "surface" | "well" | "sky" | "lavender" | "warn" }) {
  const bg = { surface: "bg-surface", well: "bg-well", sky: "bg-sky", lavender: "bg-lavender", warn: "bg-warn-soft" }[tone];
  return <div className={clsx("rounded-[var(--radius-card)]", bg, className)}>{children}</div>;
}

export function Button({
  children,
  icon: Icon,
  variant = "secondary",
  busy,
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon; variant?: "primary" | "secondary" | "money" | "ghost" | "danger"; busy?: boolean; size?: "sm" | "md" | "lg" }) {
  const styles = {
    primary: "bg-blue text-ink hover:bg-[#b9dffd]",
    secondary: "bg-well-soft text-ink hover:bg-well",
    money: "bg-ink text-white hover:bg-[#24303a]",
    ghost: "bg-transparent text-muted hover:bg-well-soft hover:text-ink",
    danger: "bg-bad-soft text-bad hover:bg-[#f6e1de]",
  }[variant];
  const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2" }[size];
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={clsx(
        "inline-flex select-none items-center justify-center rounded-full font-semibold transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-ink",
        styles,
        sizes,
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "sky" | "dark"; className?: string }) {
  const t = {
    neutral: "bg-well-soft text-muted",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    sky: "bg-sky text-blue-ink",
    dark: "bg-chrome text-white/85",
  }[tone];
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", t, className)}>{children}</span>;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("label", className)}>{children}</div>;
}

export function IconBox({ icon: Icon, tone = "sky", size = 34 }: { icon: LucideIcon; tone?: "sky" | "lavender" | "warn" | "ok" | "well" | "dark"; size?: number }) {
  const t = { sky: "bg-sky text-blue-ink", lavender: "bg-lavender text-[#5b4bb7]", warn: "bg-warn-soft text-warn", ok: "bg-ok-soft text-ok", well: "bg-surface text-muted", dark: "bg-chrome text-white" }[tone];
  return (
    <div className={clsx("flex shrink-0 items-center justify-center rounded-[10px]", t)} style={{ width: size, height: size }}>
      <Icon className="size-[18px]" strokeWidth={1.9} />
    </div>
  );
}

export function SkeletonLines({ widths = ["90%", "74%", "84%"] }: { widths?: string[] }) {
  return (
    <div className="space-y-2">
      {widths.map((w) => (
        <div key={w} className="skeleton h-[7px] rounded" style={{ width: w }} />
      ))}
    </div>
  );
}

export function Money({ value, className }: { value: string | number | null | undefined; className?: string }) {
  if (value == null) return <span className={className}>n/a</span>;
  const n = Number(value);
  return <span className={clsx("tabular", className)}>{n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

export function ErrorNotice({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div role="alert" className="rounded-[14px] bg-bad-soft px-4 py-3 text-[13px] text-bad">{error}</div>;
}
