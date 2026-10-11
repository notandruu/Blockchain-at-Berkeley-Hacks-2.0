import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { masterAccountFetch, withAccount } from "./master-account.js";

const secret = "test-secret";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

describe("withAccount", () => {
  it("adds the account and signs the new payload with HMAC-SHA384", () => {
    const r = withAccount(b64({ request: "/v1/prediction-markets/positions", nonce: 1791761400 }), "primary", secret)!;
    expect(JSON.parse(Buffer.from(r.payload, "base64").toString())).toEqual({ request: "/v1/prediction-markets/positions", nonce: 1791761400, account: "primary" });
    expect(r.signature).toBe(createHmac("sha384", secret).update(r.payload).digest("hex"));
  });

  it("leaves a payload that already names an account alone", () => {
    expect(withAccount(b64({ request: "/x", nonce: 1, account: "other" }), "primary", secret)).toBeNull();
  });
});

describe("masterAccountFetch", () => {
  it("rewrites signed requests and passes public ones through", async () => {
    const seen: Headers[] = [];
    const base = async (_: string | URL | Request, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return new Response("{}");
    };
    const f = masterAccountFetch("primary", secret, base);
    await f("https://api.sandbox.gemini.com/v1/prediction-markets/order", { headers: { "X-GEMINI-PAYLOAD": b64({ request: "/v1/prediction-markets/order", nonce: 2 }), "X-GEMINI-SIGNATURE": "old" } });
    await f("https://api.sandbox.gemini.com/v1/prediction-markets/events", {});
    expect(JSON.parse(Buffer.from(seen[0]!.get("X-GEMINI-PAYLOAD")!, "base64").toString()).account).toBe("primary");
    expect(seen[0]!.get("X-GEMINI-SIGNATURE")).not.toBe("old");
    expect(seen[1]!.get("X-GEMINI-PAYLOAD")).toBeNull();
  });
});
