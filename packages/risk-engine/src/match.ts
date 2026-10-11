import { isTakeable } from "@beagle/domain";
import type {
  MarketCandidate,
  MatchType,
  Outcome,
  Trigger,
} from "@beagle/domain";
import { dec, type Dec } from "./decimal.js";

// Field-by-field compatibility between what the merchant needs and what a contract pays on.
// Hard eligibility runs first; a candidate that fails any hard check is rejected regardless
// of how relevant it looks (PRD section 3).

export type CheckStatus = "match" | "mismatch" | "partial" | "unknown";

export interface FieldCheck {
  field: string;
  merchant: string;
  contract: string;
  status: CheckStatus;
  note?: string;
}

export type RejectionCode =
  | "EXPIRED"
  | "MARKET_CLOSED"
  | "POST_ONLY"
  | "NOT_EXECUTABLE_IN_ENV"
  | "WRONG_EVENT"
  | "WRONG_DATE"
  | "WRONG_STATION"
  | "WRONG_METRIC"
  | "WRONG_THRESHOLD"
  | "WRONG_ASSET"
  | "WRONG_TEAM"
  | "PERIOD_MISMATCH"
  | "NO_SETTLEMENT_RULES"
  | "UNSUPPORTED_TRIGGER"
  | "TRIGGER_KIND_MISMATCH";

export interface MatchResult {
  instrumentSymbol: string;
  environment: MarketCandidate["environment"];
  matchType: MatchType;
  // Which side to buy so the payout happens exactly when the merchant's trigger happens.
  outcome: Outcome | null;
  executable: boolean;
  checks: FieldCheck[];
  rejections: RejectionCode[];
  caveats: string[];
}

// Normalized interval for a contract's YES proposition.
export interface Interval {
  lo: Dec | null;
  loInclusive: boolean;
  hi: Dec | null;
  hiInclusive: boolean;
}

const NUM = String.raw`\$?([\d,]+(?:\.\d+)?)`;

export function contractInterval(c: Pick<MarketCandidate, "strike" | "label">): Interval | null {
  const range = new RegExp(`${NUM}\\D*\\s+to\\s+${NUM}`, "i").exec(c.label);
  if (range) {
    return { lo: dec(range[1]!.replace(/,/g, "")), loInclusive: true, hi: dec(range[2]!.replace(/,/g, "")), hiInclusive: true };
  }
  const v = c.strike?.value ? dec(c.strike.value) : null;
  if (!v || !c.strike?.type) return null;
  switch (c.strike.type) {
    case "above":
      // Gemini labels these "X or above" and the rules say "X or above", so the bound is
      // inclusive. Strictly-greater thresholds use the separate "over" type.
      return { lo: v, loInclusive: true, hi: null, hiInclusive: false };
    case "over_or_equal":
      return { lo: v, loInclusive: true, hi: null, hiInclusive: false };
    case "over":
      return { lo: v, loInclusive: false, hi: null, hiInclusive: false };
    case "below":
    case "under_or_equal":
      return { lo: null, loInclusive: false, hi: v, hiInclusive: true };
    case "under":
      return { lo: null, loInclusive: false, hi: v, hiInclusive: false };
    default:
      return null;
  }
}

export function triggerInterval(op: string, threshold: string, upper: string | null): Interval {
  const t = dec(threshold);
  switch (op) {
    case "gt":
      return { lo: t, loInclusive: false, hi: null, hiInclusive: false };
    case "gte":
      return { lo: t, loInclusive: true, hi: null, hiInclusive: false };
    case "lt":
      return { lo: null, loInclusive: false, hi: t, hiInclusive: false };
    case "lte":
      return { lo: null, loInclusive: false, hi: t, hiInclusive: true };
    default:
      return { lo: t, loInclusive: true, hi: upper ? dec(upper) : null, hiInclusive: true };
  }
}

// On an integer-valued measure (NWS reports whole degrees) "> 95" and ">= 96" are the same
// set. Convert to closed integer bounds before comparing.
function toIntegerClosed(i: Interval): { lo: Dec | null; hi: Dec | null } {
  const lo = i.lo === null ? null : i.loInclusive ? i.lo.ceil() : i.lo.floor().plus(1);
  const hi = i.hi === null ? null : i.hiInclusive ? i.hi.floor() : i.hi.ceil().minus(1);
  return { lo, hi };
}

const eqBound = (a: Dec | null, b: Dec | null) => (a === null ? b === null : b !== null && a.eq(b));

export function sameSet(a: Interval, b: Interval, integerValued: boolean): boolean {
  if (integerValued) {
    const x = toIntegerClosed(a);
    const y = toIntegerClosed(b);
    return eqBound(x.lo, y.lo) && eqBound(x.hi, y.hi);
  }
  return eqBound(a.lo, b.lo) && eqBound(a.hi, b.hi) && (a.lo === null || a.loInclusive === b.loInclusive) && (a.hi === null || a.hiInclusive === b.hiInclusive);
}

// Complement of a one-sided interval, used to decide whether buying NO matches the trigger.
export function complement(i: Interval): Interval | null {
  if (i.lo !== null && i.hi === null) return { lo: null, loInclusive: false, hi: i.lo, hiInclusive: !i.loInclusive };
  if (i.hi !== null && i.lo === null) return { lo: i.hi, loInclusive: !i.hiInclusive, hi: null, hiInclusive: false };
  return null;
}

const fmt = (i: Interval | null, unit = "") => {
  if (!i) return "unparsed";
  if (i.lo && i.hi) return `${i.lo}${unit} to ${i.hi}${unit}`;
  if (i.lo) return `${i.loInclusive ? ">=" : ">"} ${i.lo}${unit}`;
  if (i.hi) return `${i.hiInclusive ? "<=" : "<"} ${i.hi}${unit}`;
  return "any";
};

const dateOf = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

// "October 11, 2026" -> "2026-10-11"
export function dateInText(text: string): string | null {
  const m = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/.exec(text);
  if (!m) return null;
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(m[1]!) + 1;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

function common(candidate: MarketCandidate, now: Date): { rejections: RejectionCode[]; checks: FieldCheck[]; caveats: string[] } {
  const rejections: RejectionCode[] = [];
  const checks: FieldCheck[] = [];
  const caveats: string[] = [];
  if (candidate.expiryDate && new Date(candidate.expiryDate) <= now) rejections.push("EXPIRED");
  if (candidate.marketState === "post_only" && candidate.contractStatus === "active") rejections.push("POST_ONLY");
  else if (!isTakeable(candidate)) rejections.push("MARKET_CLOSED");
  if (!candidate.rulesText.trim()) rejections.push("NO_SETTLEMENT_RULES");
  checks.push({
    field: "environment",
    merchant: "sandbox execution",
    contract: candidate.environment,
    status: candidate.environment === "sandbox" ? "match" : "mismatch",
    ...(candidate.environment === "sandbox" ? {} : { note: "Listed on production only. Can be analyzed but not bought in this build." }),
  });
  if (candidate.environment !== "sandbox") rejections.push("NOT_EXECUTABLE_IN_ENV");
  return { rejections, checks, caveats };
}

function finish(candidate: MarketCandidate, base: ReturnType<typeof common>, outcome: Outcome | null, partial: boolean): MatchResult {
  const hard = base.rejections.filter((r) => r !== "NOT_EXECUTABLE_IN_ENV");
  const anyMismatch = base.checks.some((c) => c.field !== "environment" && c.status === "mismatch");
  const anyUnknown = base.checks.some((c) => c.status === "unknown");
  let matchType: MatchType;
  if (hard.length || anyMismatch || outcome === null) matchType = "rejected";
  else if (partial) matchType = "proxy";
  else if (anyUnknown) matchType = "unknown";
  else matchType = "exact";
  return {
    instrumentSymbol: candidate.instrumentSymbol,
    environment: candidate.environment,
    matchType,
    outcome: matchType === "rejected" ? null : outcome,
    executable: (matchType === "exact" || matchType === "proxy") && base.rejections.length === 0,
    checks: base.checks,
    rejections: base.rejections,
    caveats: base.caveats,
  };
}

function matchThreshold(
  base: ReturnType<typeof common>,
  candidate: MarketCandidate,
  want: Interval,
  integerValued: boolean,
  unit: string,
): Outcome | null {
  const yes = contractInterval(candidate);
  if (!yes) {
    base.checks.push({ field: "threshold", merchant: fmt(want, unit), contract: candidate.label, status: "unknown", note: "Could not parse the contract's threshold" });
    return null;
  }
  if (sameSet(yes, want, integerValued)) {
    base.checks.push({ field: "threshold", merchant: fmt(want, unit), contract: `YES pays when ${fmt(yes, unit)}`, status: "match" });
    return "yes";
  }
  const no = complement(yes);
  if (no && sameSet(no, want, integerValued)) {
    base.checks.push({ field: "threshold", merchant: fmt(want, unit), contract: `NO pays when ${fmt(no, unit)}`, status: "match", note: "Buying NO on this contract pays exactly on the merchant's trigger" });
    return "no";
  }
  base.checks.push({ field: "threshold", merchant: fmt(want, unit), contract: `YES pays when ${fmt(yes, unit)}`, status: "mismatch" });
  base.rejections.push("WRONG_THRESHOLD");
  return null;
}

export function matchCandidate(trigger: Trigger, candidate: MarketCandidate, now: Date): MatchResult {
  const base = common(candidate, now);
  switch (trigger.kind) {
    case "price_threshold": {
      const assetOk = new RegExp(`\\b${trigger.asset}\\b`, "i").test(candidate.eventTitle) || candidate.eventTicker.toUpperCase().startsWith(trigger.asset.toUpperCase());
      base.checks.push({ field: "asset", merchant: trigger.asset, contract: candidate.eventTitle, status: assetOk ? "match" : "mismatch" });
      if (!assetOk) base.rejections.push("WRONG_ASSET");
      const timeOk = candidate.expiryDate !== null && new Date(candidate.expiryDate).getTime() === new Date(trigger.observationTime).getTime();
      base.checks.push({ field: "observation time", merchant: trigger.observationTime, contract: candidate.expiryDate ?? "missing", status: timeOk ? "match" : "mismatch" });
      if (!timeOk) base.rejections.push("WRONG_DATE");
      if (trigger.settlementIndex) {
        const idxOk = candidate.settlementSource === trigger.settlementIndex;
        base.checks.push({ field: "settlement index", merchant: trigger.settlementIndex, contract: candidate.settlementSource ?? "missing", status: idxOk ? "match" : "mismatch" });
      } else {
        base.checks.push({ field: "settlement index", merchant: "any", contract: candidate.settlementSource ?? "missing", status: candidate.settlementSource ? "match" : "unknown" });
      }
      const outcome = matchThreshold(base, candidate, triggerInterval(trigger.operator, trigger.threshold, trigger.thresholdUpper), false, "");
      return finish(candidate, base, outcome, false);
    }
    case "temperature": {
      const cityOk = candidate.eventTitle.toLowerCase().includes(trigger.city.toLowerCase());
      base.checks.push({ field: "city", merchant: trigger.city, contract: candidate.eventTitle, status: cityOk ? "match" : "mismatch" });
      if (!cityOk) base.rejections.push("WRONG_STATION");
      const stationText = /Climatological Report \(Daily\) for ([^.]+?)\./i.exec(candidate.rulesText)?.[1]?.trim() ?? null;
      const stationName = stationText?.split(",")[0]!.toLowerCase() ?? null;
      const stationOk = stationName !== null && trigger.station.toLowerCase().includes(stationName);
      // Same city, different observation point (e.g. downtown job site vs SFO airport) is a
      // proxy hedge, not an exact one. A different city was already rejected above.
      const stationStatus: CheckStatus = stationText === null ? "unknown" : stationOk ? "match" : cityOk ? "partial" : "mismatch";
      base.checks.push({
        field: "station",
        merchant: trigger.station,
        contract: stationText ? `NWS Climatological Report (Daily) for ${stationText}` : "not stated",
        status: stationStatus,
        note: stationOk ? "Settles on the official station report" : `Settles on ${stationText ?? "an unstated station"}, not the merchant's location`,
      });
      if (stationStatus === "mismatch") base.rejections.push("WRONG_STATION");
      if (stationStatus === "partial") base.caveats.push(`Settlement uses ${stationText}. Temperatures there can differ from the job site by several degrees.`);
      const metricOk = /highest temperature/i.test(candidate.eventTitle) === (trigger.metric === "daily_high");
      base.checks.push({ field: "metric", merchant: trigger.metric, contract: candidate.eventTitle, status: metricOk ? "match" : "mismatch" });
      if (!metricOk) base.rejections.push("WRONG_METRIC");
      const cDate = dateInText(candidate.eventTitle);
      const dateOk = cDate === trigger.observationDate;
      base.checks.push({ field: "observation date", merchant: trigger.observationDate, contract: cDate ?? "missing", status: dateOk ? "match" : "mismatch" });
      if (!dateOk) base.rejections.push("WRONG_DATE");
      const outcome = matchThreshold(base, candidate, triggerInterval(trigger.operator, trigger.threshold, trigger.thresholdUpper), true, "°F");
      base.caveats.push("Payout depends on the station reading, which can differ from the job site.");
      if (/cannot be determined.*resolve to No/i.test(candidate.rulesText)) {
        base.caveats.push("If NWS does not publish the value by expiry the contract resolves NO.");
      }
      return finish(candidate, base, outcome, stationStatus === "partial");
    }
    case "sports_result": {
      const names = [candidate.eventTitle, ...candidate.participants.map((p) => p.name)].join(" | ").toLowerCase();
      const teamsOk = names.includes(trigger.homeTeam.toLowerCase()) && names.includes(trigger.awayTeam.toLowerCase());
      base.checks.push({ field: "game", merchant: `${trigger.awayTeam} at ${trigger.homeTeam}`, contract: candidate.eventTitle, status: teamsOk ? "match" : "mismatch" });
      if (!teamsOk) base.rejections.push("WRONG_EVENT");
      const leagueOk = candidate.subcategoryPath.some((p) => p.toLowerCase().includes(trigger.league.toLowerCase())) || candidate.eventTicker.toUpperCase().startsWith(trigger.league.toUpperCase());
      base.checks.push({ field: "league", merchant: trigger.league, contract: candidate.subcategoryPath.join(" / "), status: leagueOk ? "match" : "mismatch" });
      const cDate = dateOf(candidate.startTime);
      // Kickoff in UTC can fall on the next calendar day for evening games in US time zones.
      const dateOk = cDate !== null && Math.abs(new Date(cDate).getTime() - new Date(trigger.gameDate).getTime()) <= 86_400_000;
      base.checks.push({ field: "game date", merchant: trigger.gameDate, contract: candidate.startTime ?? "missing", status: dateOk ? "match" : "mismatch" });
      if (!dateOk) base.rejections.push("WRONG_DATE");
      const teamIsYes = candidate.label.toLowerCase().includes(trigger.team.toLowerCase());
      base.checks.push({ field: "team", merchant: `${trigger.team} wins`, contract: `YES pays if ${candidate.label} wins`, status: teamIsYes ? "match" : "mismatch" });
      if (!teamIsYes) base.rejections.push("WRONG_TEAM");
      let partial = false;
      if (/50\/50 draw resolution/i.test(candidate.rulesText)) {
        const status: CheckStatus = trigger.tieTreatment === "no_reward" ? "partial" : trigger.tieTreatment === "unspecified" ? "unknown" : "mismatch";
        base.checks.push({ field: "tie", merchant: trigger.tieTreatment, contract: "tie settles 50/50", status, note: "On a tie the contract pays half while the promotion owes nothing" });
        partial = status === "partial";
      }
      if (/regulation time/i.test(candidate.rulesText) && trigger.period === "final") {
        base.checks.push({ field: "period", merchant: "final result incl. overtime", contract: "regulation only", status: "mismatch" });
        base.rejections.push("PERIOD_MISMATCH");
      } else {
        base.checks.push({ field: "period", merchant: trigger.period, contract: /regulation time/i.test(candidate.rulesText) ? "regulation" : "official final result", status: "match" });
      }
      if (/Market Outcome Review Process/i.test(candidate.rulesText)) {
        base.caveats.push("Cancelled or forfeited games go to Gemini's outcome review. The promotion must be voided in that case.");
      }
      return finish(candidate, base, teamIsYes ? "yes" : null, partial);
    }
    case "policy_event":
      base.rejections.push("UNSUPPORTED_TRIGGER");
      base.checks.push({ field: "verifier", merchant: trigger.action, contract: candidate.eventTitle, status: "unknown", note: "No trigger verifier implemented for policy events. Research only." });
      return finish(candidate, base, null, false);
  }
}

// Rank only after hard eligibility: exact before proxy before unknown, sandbox before
// production. Rejected candidates are returned too so the UI can show why.
export function rankMatches(results: MatchResult[]): MatchResult[] {
  const order: Record<MatchType, number> = { exact: 0, proxy: 1, unknown: 2, rejected: 3 };
  return [...results].sort(
    (a, b) => order[a.matchType] - order[b.matchType] || Number(b.executable) - Number(a.executable),
  );
}
