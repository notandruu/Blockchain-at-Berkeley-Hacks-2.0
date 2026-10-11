import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { DomainError } from "@riskpilot/domain";

// Merchant-supplied URLs go to Context.dev, not to our own fetcher, but we still refuse
// anything that is not a public web page: the same URL is shown in the source browser and
// stored as evidence, and nothing on a private network belongs in either.

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Private(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  return mapped ? ipv4Private(mapped[1]!) : false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4Private(ip);
  if (kind === 6) return ipv6Private(ip);
  return true;
}

export interface UrlCheckOptions {
  resolve?: (host: string) => Promise<{ address: string }[]>;
}

export async function assertPublicUrl(raw: string, opts: UrlCheckOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DomainError("UNSAFE_URL", "not a valid URL", { url: raw });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new DomainError("UNSAFE_URL", "only http and https URLs are allowed", { url: raw });
  if (url.username || url.password) throw new DomainError("UNSAFE_URL", "URLs with embedded credentials are refused", { url: raw });
  if (url.port && url.port !== "80" && url.port !== "443") throw new DomainError("UNSAFE_URL", "non-standard ports are refused", { url: raw });
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new DomainError("UNSAFE_URL", "local hostnames are refused", { url: raw });
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new DomainError("UNSAFE_URL", "private network address", { url: raw });
    return url;
  }
  const resolver = opts.resolve ?? ((h: string) => lookup(h, { all: true }));
  const addrs = await resolver(host).catch(() => []);
  if (!addrs.length) throw new DomainError("UNSAFE_URL", "hostname does not resolve", { url: raw });
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new DomainError("UNSAFE_URL", "hostname resolves to a private address", { url: raw });
  url.hash = "";
  return url;
}
