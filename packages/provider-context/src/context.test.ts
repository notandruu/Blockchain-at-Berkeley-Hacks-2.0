import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateAddress } from "./url-safety.js";
import { decodeScreenshot, ScreenshotRejected } from "./screenshot.js";
import { signContextWebhook, verifyContextWebhook } from "./webhook.js";

const publicDns = async () => [{ address: "93.184.216.34" }];

describe("assertPublicUrl", () => {
  it("accepts a public https page", async () => {
    expect((await assertPublicUrl("https://example.com/events#top", { resolve: publicDns })).toString()).toBe("https://example.com/events");
  });

  it.each([
    "http://localhost:3000/admin",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://10.0.0.5/",
    "https://user:pass@example.com/",
    "file:///etc/passwd",
    "https://example.com:8443/",
  ])("refuses %s", async (u) => {
    await expect(assertPublicUrl(u, { resolve: publicDns })).rejects.toMatchObject({ code: "UNSAFE_URL" });
  });

  it("refuses a public hostname that resolves to a private address", async () => {
    await expect(assertPublicUrl("https://rebind.example/", { resolve: async () => [{ address: "192.168.1.10" }] })).rejects.toMatchObject({ code: "UNSAFE_URL" });
  });

  it("knows mapped IPv6 private ranges", () => {
    expect(isPrivateAddress("::ffff:10.1.2.3")).toBe(true);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });
});

describe("decodeScreenshot", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

  it("decodes a real PNG header", () => {
    const s = decodeScreenshot(`data:image/png;base64,${png.toString("base64")}`);
    expect(s.mime).toBe("image/png");
    expect(s.extension).toBe("png");
  });

  it("rejects bytes that do not match the declared type", () => {
    expect(() => decodeScreenshot(`data:image/jpeg;base64,${png.toString("base64")}`)).toThrow(ScreenshotRejected);
  });

  it("rejects svg, which can carry script", () => {
    expect(() => decodeScreenshot("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toThrow(ScreenshotRejected);
  });

  it("enforces the size cap", () => {
    expect(() => decodeScreenshot(`data:image/png;base64,${png.toString("base64")}`, 4)).toThrow(/size/);
  });
});

describe("verifyContextWebhook", () => {
  const secret = "whsec_test";
  const body = Buffer.from('{"type":"change.detected"}');
  const now = 1_791_000_000_000;

  it("accepts a fresh correct signature", () => {
    expect(verifyContextWebhook(body, signContextWebhook(body, secret, now / 1000), secret, now).ok).toBe(true);
  });

  it("rejects a modified body", () => {
    const header = signContextWebhook(body, secret, now / 1000);
    expect(verifyContextWebhook(Buffer.from('{"type":"x"}'), header, secret, now)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a replayed old delivery", () => {
    const header = signContextWebhook(body, secret, now / 1000 - 600);
    expect(verifyContextWebhook(body, header, secret, now).reason).toBe("stale");
  });
});
