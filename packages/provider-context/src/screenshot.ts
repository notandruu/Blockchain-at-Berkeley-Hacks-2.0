import { createHash } from "node:crypto";

// Context returns screenshots as inline base64 data URLs. We decode on the server, check the
// declared type against the actual magic bytes, enforce a size cap, and hand back bytes for
// private storage. The base64 never travels through run events.

const ALLOWED = {
  "image/png": (b: Buffer) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b: Buffer) => b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
} as const;

export type ScreenshotMime = keyof typeof ALLOWED;

export interface DecodedScreenshot {
  mime: ScreenshotMime;
  bytes: Buffer;
  sha256: string;
  extension: "png" | "jpg" | "webp";
}

export class ScreenshotRejected extends Error {}

export function decodeScreenshot(dataUrl: string, maxBytes = 8 * 1024 * 1024): DecodedScreenshot {
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!m) throw new ScreenshotRejected("not a base64 image data URL");
  const mime = m[1] as string;
  if (!(mime in ALLOWED)) throw new ScreenshotRejected(`image type ${mime} is not allowed`);
  // base64 expands 4:3, so reject oversized payloads before allocating the buffer.
  if ((m[2]!.length * 3) / 4 > maxBytes + 4) throw new ScreenshotRejected("screenshot exceeds size limit");
  const bytes = Buffer.from(m[2]!, "base64");
  if (bytes.length > maxBytes) throw new ScreenshotRejected("screenshot exceeds size limit");
  if (!ALLOWED[mime as ScreenshotMime](bytes)) throw new ScreenshotRejected(`bytes do not match declared ${mime}`);
  return {
    mime: mime as ScreenshotMime,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    extension: mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp",
  };
}
