import { createHmac } from "node:crypto";

// Gemini master API keys act on a group of accounts, and every private request must name
// one with an `account` field in the signed payload (otherwise: 400 MissingAccounts). The
// SDK's prediction methods have no account parameter, and an AuthStrategy can only add
// headers, so this fetch adapter adds `account` to X-GEMINI-PAYLOAD and re-signs it with the
// same HMAC-SHA384 the SDK uses. Account-scoped keys never go through it.

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function withAccount(payloadBase64: string, account: string, secret: string): { payload: string; signature: string } | null {
  const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf8")) as Record<string, unknown>;
  if (payload.account !== undefined) return null;
  payload.account = account;
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return { payload: b64, signature: createHmac("sha384", secret).update(b64).digest("hex") };
}

export function masterAccountFetch(account: string, secret: string, base: FetchLike = fetch): FetchLike {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers);
    const signed = headers.get("X-GEMINI-PAYLOAD");
    if (signed) {
      const r = withAccount(signed, account, secret);
      if (r) {
        headers.set("X-GEMINI-PAYLOAD", r.payload);
        headers.set("X-GEMINI-SIGNATURE", r.signature);
      }
    }
    return base(input, { ...init, headers });
  };
}
