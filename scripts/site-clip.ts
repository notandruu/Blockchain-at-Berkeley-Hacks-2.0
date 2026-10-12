import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
const S = process.argv[2]!, OUT = process.argv[3]!;
const size = { width: 1280, height: 720 };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: S, size } });
const page = await ctx.newPage();
await page.goto("https://beagle.andrewliu.org/");
await page.waitForTimeout(2500);
await page.locator("textarea").pressSequentially("We're a bar in Manhattan. If the Knicks beat Minnesota Monday night, everyone here by tip-off gets $20 back on their tab. Up to 40 customers.", { delay: 18 });
await page.getByPlaceholder("Max spend").fill("400");
await page.waitForTimeout(500);
const t0 = Date.now();
await page.getByRole("button", { name: "Start research" }).click();
await page.waitForURL(/\/runs\//);
// The state chip in the top bar is the only reliable "done" signal. Feed cards have their own
// <header> and show "No executable match" a beat before the run itself gets there.
await page.waitForFunction(
  () => /No executable match|Awaiting approval|Failed/.test(document.querySelector("header")?.innerText ?? ""),
  undefined,
  { timeout: 280_000, polling: 250 },
);
await page.waitForTimeout(5000);
const v = page.video()!;
await ctx.close(); await b.close();
const src = await v.path();
console.log("recorded", Math.round((Date.now() - t0) / 1000), "s of research");
// Typing at 1x, research at ~6x, hold the final card: one ~25s loop, no audio, web-friendly.
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src,
  "-vf", "setpts='if(lt(T,9),PTS,9/TB+(PTS-9/TB)/6)',fps=30,scale=1280:720:flags=lanczos,format=yuv420p",
  "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-movflags", "+faststart", OUT]);
