"use client";

import clsx from "clsx";

// Beagle's crew. Character art from OpenDots (MIT, public/crew/LICENSE-OpenDots.txt).
// Each character owns one kind of work, so a glance at a card tells you who did it:
//   Scout  reads the web through Context.dev and talks to you
//   Nova   reads Gemini's markets and checks contracts field by field
//   Penny  holds the money: quotes, approval, the order and its receipt
//   Sprout runs the campaign: customer claims and capacity

export type CrewMember = "scout" | "nova" | "penny" | "sprout";
export type MascotState = "idle" | "working" | "done" | "waiting" | "paused";

export const CREW: Record<CrewMember, { name: string; role: string; tint: string; ink: string }> = {
  scout: { name: "Scout", role: "Research", tint: "#e7eefc", ink: "#2f5fd0" },
  nova: { name: "Nova", role: "Markets", tint: "#efeafb", ink: "#6b4fc8" },
  penny: { name: "Penny", role: "Money", tint: "#fdeee3", ink: "#b8571c" },
  sprout: { name: "Sprout", role: "Campaign", tint: "#e3f4ee", ink: "#2f8a6c" },
};

export function crewFor(provider: string, type?: string): CrewMember {
  if (type?.startsWith("capacity") || type?.startsWith("campaign")) return "sprout";
  if (type?.startsWith("approval") || type?.startsWith("order") || type?.startsWith("quote")) return "penny";
  switch (provider) {
    case "gemini_markets":
      return "nova";
    case "risk_engine":
      return "penny";
    case "app":
      return "sprout";
    default:
      return "scout";
  }
}

export function Mascot({
  who,
  size = 40,
  state = "idle",
  className,
  decorative = true,
  big = false,
}: {
  who: CrewMember;
  size?: number;
  state?: MascotState;
  className?: string;
  decorative?: boolean;
  big?: boolean;
}) {
  const c = CREW[who];
  return (
    <span className={clsx("mascot inline-block shrink-0", `mascot-${state}`, className)} style={{ width: size, height: size }}>
      <img
        src={big || size > 96 ? `/crew/${who}.png` : `/crew/${who}-192.png`}
        alt={decorative ? "" : `${c.name}, ${c.role.toLowerCase()}, is ${state}`}
        width={size}
        height={size}
        draggable={false}
        className="mascot-body h-full w-full select-none object-contain"
      />
    </span>
  );
}

// A mascot in a soft tinted puck, for list rows and tool cards.
export function CrewBadge({ who, state = "idle", size = 34 }: { who: CrewMember; state?: MascotState; size?: number }) {
  return (
    <span className="relative flex shrink-0 items-end justify-center overflow-hidden rounded-[12px]" style={{ width: size, height: size, background: CREW[who].tint }}>
      <Mascot who={who} state={state} size={Math.round(size * 1.18)} className="-mb-[18%]" />
    </span>
  );
}

export function Sparks({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx("pointer-events-none absolute inset-0", className)}>
      <span className="spark absolute right-[2%] top-[18%] rotate-[15deg] text-[19px]">✦</span>
      <span className="spark absolute bottom-[30%] left-[0%] text-[24px]">✦</span>
      <span className="spark absolute left-[16%] top-[4%] text-[12px]">✦</span>
    </span>
  );
}
