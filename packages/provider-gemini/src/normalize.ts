import { canonicalJson, MarketCandidate, sha256, type ExchangeEnvironment, type StrikeType } from "@beagle/domain";

// Subset of the Gemini Event/Contract payload we read. Typed loosely on purpose: the public
// endpoint returns fields (participants, startTime, sourceDetails) that the generated SDK
// model does not list yet, and every field is validated by MarketCandidate.parse below.
export interface RawContract {
  id?: string;
  label?: string;
  abbreviatedName?: string | null;
  description?: unknown;
  prices?: { buy?: { yes?: string; no?: string } } | null;
  status?: string;
  marketState?: "open" | "closed" | null;
  termsAndConditionsUrl?: string;
  ticker?: string;
  instrumentSymbol?: string;
  expiryDate?: string | null;
  effectiveDate?: string | null;
  strike?: { type?: string; value?: string | null } | null;
  source?: string | null;
  quantityIncrement?: string | null;
  quantityMinimum?: string | null;
  priceIncrement?: string | null;
  priceMinimum?: string | null;
  isCombo?: boolean;
}

export interface RawEvent {
  ticker?: string;
  title?: string;
  status?: string;
  category?: string;
  subcategory?: { path?: string[] } | null;
  contracts?: RawContract[];
  startTime?: string | null;
  expiryDate?: string | null;
  termsLink?: string | null;
  participants?: { name?: string; abbreviation?: string; side?: string }[];
  source?: string | null;
  sourceDetails?: { agency?: string | null; index?: string | null } | null;
  childEvents?: RawEvent[];
  events?: RawEvent[];
}

// Contract descriptions arrive as a rich-text document tree. Flatten it to the plain
// settlement text we hash and match against.
export function richTextToPlain(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(richTextToPlain).join("");
  if (typeof node === "object") {
    const n = node as { value?: unknown; content?: unknown };
    return (typeof n.value === "string" ? n.value : "") + richTextToPlain(n.content);
  }
  return "";
}

// Hash of everything that defines what the contract pays on. If Gemini edits any of it the
// hash changes and an approved plan bound to the old hash is invalidated (RULES_CHANGED).
export function rulesHash(c: Pick<MarketCandidate, "instrumentSymbol" | "rulesText" | "termsUrl" | "strike" | "expiryDate" | "settlementSource" | "label">): string {
  return sha256(
    canonicalJson({
      instrumentSymbol: c.instrumentSymbol,
      label: c.label,
      rulesText: c.rulesText,
      termsUrl: c.termsUrl,
      strike: c.strike,
      expiryDate: c.expiryDate,
      settlementSource: c.settlementSource,
    }),
  );
}

const STRIKE_TYPES = new Set(["reference", "above", "below", "spread", "over", "over_or_equal", "under", "under_or_equal"]);

export function normalizeEvent(event: RawEvent, environment: ExchangeEnvironment): MarketCandidate[] {
  // Follow nested child events: a game headline alone is not the instrument definition.
  const children = [...(event.childEvents ?? []), ...(event.events ?? [])];
  const own = (event.contracts ?? [])
    .filter((c) => c.instrumentSymbol && !c.isCombo)
    .map((c) => {
      const rulesText = richTextToPlain(c.description).trim();
      const termsUrl = c.termsAndConditionsUrl || event.termsLink || null;
      const strikeType = c.strike?.type && STRIKE_TYPES.has(c.strike.type) ? c.strike.type : null;
      const partial = {
        environment,
        category: event.category ?? "",
        subcategoryPath: event.subcategory?.path ?? [],
        eventTicker: event.ticker ?? "",
        eventTitle: event.title ?? "",
        eventStatus: event.status ?? "unknown",
        instrumentSymbol: c.instrumentSymbol!,
        contractTicker: c.ticker ?? "",
        label: c.label ?? c.abbreviatedName ?? "",
        contractStatus: c.status ?? "unknown",
        marketState: c.marketState ?? null,
        strike: c.strike ? { type: strikeType as StrikeType | null, value: c.strike.value ?? null } : null,
        effectiveDate: c.effectiveDate ?? null,
        expiryDate: c.expiryDate ?? event.expiryDate ?? null,
        startTime: event.startTime ?? null,
        participants: (event.participants ?? []).map((p) => ({ name: p.name ?? "", abbreviation: p.abbreviation ?? null, side: p.side ?? null })),
        settlementSource: event.sourceDetails?.index ?? c.source ?? event.source ?? null,
        rulesText,
        termsUrl,
        quantityIncrement: c.quantityIncrement ?? "1",
        quantityMinimum: c.quantityMinimum ?? c.quantityIncrement ?? "1",
        priceIncrement: c.priceIncrement ?? "0.01",
        priceMinimum: c.priceMinimum ?? c.priceIncrement ?? "0.01",
        indicativeBuyYes: c.prices?.buy?.yes ?? null,
        indicativeBuyNo: c.prices?.buy?.no ?? null,
      };
      return MarketCandidate.parse({ ...partial, rulesHash: rulesHash(partial) });
    });
  return [...own, ...children.flatMap((ch) => normalizeEvent(ch, environment))];
}
