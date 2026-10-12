// Screenshots and GIFs for the README, taken from the running app. Nothing here is mocked:
// pages render whatever the local service and database hold at capture time.
//
//   node --env-file=.env --import tsx scripts/capture.ts shots
//   node --env-file=.env --import tsx scripts/capture.ts claim <slug> <token>
//   node --env-file=.env --import tsx scripts/capture.ts live <runId>
//   WEB_ORIGIN=https://beagle.andrewliu.org node --import tsx scripts/capture.ts visitor "<goal>" 40
//   (the research GIF is re-encoded to about 5x for the README; see docs/media)
//
// Needs the web app on WEB_ORIGIN, the service on :4000, ffmpeg on PATH.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

const ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3100";
const OUT = new URL("../docs/media/", import.meta.url).pathname;
const TMP = join(OUT, ".video");
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
mkdirSync(OUT, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signIn(browser: Browser): Promise<string> {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/login`);
  await page.getByPlaceholder("Email").fill(process.env.DEMO_USER_EMAIL!);
  await page.getByPlaceholder("Password").fill(process.env.DEMO_USER_PASSWORD!);
  await page.getByPlaceholder("Password").press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  const state = join(TMP, "auth.json");
  await ctx.storageState({ path: state });
  await ctx.close();
  return state;
}

// Pages animate in with Motion; give springs and the live book poll time to settle.
async function settle(page: Page, ms = 1800) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(ms);
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: opts.fullPage ?? false });
  console.log("shot", name);
}

async function recording(browser: Browser, auth: string | undefined, size: { width: number; height: number }, mobile = false) {
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    storageState: auth,
    recordVideo: { dir: TMP, size },
  });
  return { ctx, page: await ctx.newPage() };
}

// webm -> gif with a per-clip palette; trims the blank first frames Playwright records.
async function toGif(ctx: BrowserContext, page: Page, name: string, width: number, trimStart = 0.6) {
  const video = page.video();
  await ctx.close();
  const src = await video!.path();
  const out = join(OUT, `${name}.gif`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", String(trimStart), "-i", src,
    "-vf", `fps=14,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    out,
  ]);
  renameSync(src, join(TMP, `${name}.webm`));
  console.log("gif", name);
}

async function shots(browser: Browser, auth: string) {
  const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2, storageState: auth });
  const page = await ctx.newPage();

  await page.goto(ORIGIN);
  await settle(page);
  await shot(page, "home");

  for (const [path, name] of [
    ["/portfolio", "portfolio"],
    ["/campaigns", "campaigns"],
    ["/risks", "risks"],
    ["/settings/connections", "connections"],
  ] as const) {
    await page.goto(ORIGIN + path);
    await settle(page);
    await shot(page, name);
  }

  // Run pages to capture are passed by id after the mode.
  const ids = process.argv.slice(3);
  for (const id of ids) {
    await page.goto(`${ORIGIN}/runs/${id}`);
    await settle(page, 2500);
    await shot(page, `run-${id.slice(0, 8)}`);
    // The conversation column scrolls on its own; capture its full height too.
    const feed = page.locator('section[aria-label="Conversation"]');
    if (await feed.count()) {
      await feed.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await sleep(600);
      await shot(page, `run-${id.slice(0, 8)}-feed-end`);
    }
  }

  await ctx.close();

  const phone = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, storageState: auth });
  const p = await phone.newPage();
  await p.goto(ORIGIN);
  await settle(p);
  await shot(p, "home-phone");
  for (const id of ids) {
    await p.goto(`${ORIGIN}/runs/${id}`);
    await settle(p, 2500);
    await p.getByRole("button", { name: "work" }).click().catch(() => {});
    await sleep(800);
    await shot(p, `run-${id.slice(0, 8)}-phone`);
  }
  await phone.close();
}

async function homeGif(browser: Browser, auth: string) {
  const { ctx, page } = await recording(browser, auth, { width: 1280, height: 800 });
  await page.goto(ORIGIN);
  await settle(page, 1500);
  const box = page.locator("textarea");
  await box.click();
  await box.pressSequentially("Help our bar bring people in on game night. If Bitcoin closes above $83k tonight, every customer gets $20 back. We can spend $350.", { delay: 22 });
  await sleep(1400);
  await page.locator("textarea").fill("");
  await page.getByText("Insure an existing risk").hover();
  await sleep(900);
  await page.getByText("Run an event promotion").hover();
  await sleep(1200);
  await toGif(ctx, page, "home", 960);
}

async function claimGif(browser: Browser, slug: string, token: string) {
  const { ctx, page } = await recording(browser, undefined, PHONE, true);
  await page.goto(`${ORIGIN}/c/${slug}?t=${token}`);
  await settle(page, 1800);
  await page.getByLabel("Test tab amount").pressSequentially("32", { delay: 160 });
  await sleep(500);
  await page.getByRole("button", { name: /claim/i }).click();
  await page.getByText("You're in").waitFor({ timeout: 10_000 });
  await sleep(2600);
  await toGif(ctx, page, "claim", 390);
  // A still of the voucher for the README grid.
  const still = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const s = await still.newPage();
  await s.goto(`${ORIGIN}/c/${slug}?t=${token}`);
  await settle(s, 1800);
  await shot(s, "claim-phone");
  await still.close();
}

// Live: approve a fresh plan on the real sandbox book and film it through fill and campaign.
async function liveGif(browser: Browser, auth: string, runId: string) {
  const { ctx, page } = await recording(browser, auth, { width: 1280, height: 800 });
  await page.goto(`${ORIGIN}/runs/${runId}`);
  await settle(page, 1500);
  const buy = page.getByRole("button", { name: "Approve and buy" });
  await buy.waitFor();
  const deadline = Date.now() + 60_000;
  while (!(await buy.isEnabled())) {
    if (Date.now() > deadline) throw new Error("book never became fillable for this plan");
    await sleep(300);
  }
  await sleep(700);
  await buy.click();
  await page.getByText(/Scan to claim|Nothing was bought|unknown/i).first().waitFor({ timeout: 90_000 });
  await sleep(3500);
  await toGif(ctx, page, "approve-to-campaign", 1100);
  const still = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2, storageState: auth });
  const s = await still.newPage();
  await s.goto(`${ORIGIN}/runs/${runId}`);
  await settle(s, 2500);
  await shot(s, "run-operating");
  await still.close();
}

// Visitor: the public site as a first-time visitor sees it. No sign-in, a fresh anonymous
// session, a real agent run. Films the research as it streams, stills the plan, then, if
// the live book fills inside the window, films approve through to the campaign.
async function visitorRun(browser: Browser, goal: string, budget: string) {
  const { ctx, page } = await recording(browser, undefined, { width: 1280, height: 800 });
  await page.goto(ORIGIN);
  await settle(page, 1500);
  await page.locator("textarea").pressSequentially(goal, { delay: 12 });
  await page.getByPlaceholder("Max spend").fill(budget);
  await sleep(600);
  await page.getByRole("button", { name: "Start research" }).click();
  await page.waitForURL(/\/runs\//);
  const runUrl = page.url();
  console.log("run", runUrl);
  const outcome = await Promise.race([
    page.getByRole("button", { name: "Approve and buy" }).waitFor({ timeout: 300_000 }).then(() => "plan"),
    page.getByText(/No executable match|Failed/).first().waitFor({ timeout: 300_000 }).then(() => "none"),
  ]);
  await sleep(2500);
  const researchVideo = page.video()!;

  // Stills from a crisp 2x context on the same session.
  const state = join(TMP, "visitor.json");
  await ctx.storageState({ path: state });
  const still = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2, storageState: state });
  const s = await still.newPage();
  await s.goto(runUrl);
  await settle(s, 3000);
  await shot(s, outcome === "plan" ? "live-plan" : "live-no-match");

  if (outcome === "plan") {
    const buy = page.getByRole("button", { name: "Approve and buy" });
    const deadline = Date.now() + 120_000;
    while (!(await buy.isEnabled()) && Date.now() < deadline) await sleep(300);
    if (await buy.isEnabled()) {
      await buy.click();
      await page.getByText(/Scan to claim|Nothing was bought|unknown/i).first().waitFor({ timeout: 120_000 });
      await sleep(3500);
      await s.goto(runUrl);
      await settle(s, 3000);
      await shot(s, "live-operating");
    } else console.log("book never filled inside the window; no buy");
  }
  await still.close();
  await ctx.close();
  // Research runs for minutes; play it back at 4x.
  const src = await researchVideo.path();
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", "0.6", "-i", src,
    "-vf", "setpts=0.25*PTS,fps=12,scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    join(OUT, "live-run.gif"),
  ]);
  console.log("gif live-run");
}

const [mode, ...args] = process.argv.slice(2);
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
try {
  const auth = mode === "claim" || mode === "visitor" ? undefined : await signIn(browser);
  if (mode === "shots") {
    await shots(browser, auth!);
    await homeGif(browser, auth!);
  } else if (mode === "claim") await claimGif(browser, args[0]!, args[1]!);
  else if (mode === "live") await liveGif(browser, auth!, args[0]!);
  else if (mode === "visitor") await visitorRun(browser, args[0]!, args[1] ?? "40");
  else throw new Error("mode: shots | claim | live | visitor");
} finally {
  await browser.close();
  for (const f of readdirSync(TMP)) if (f.endsWith(".json")) rmSync(join(TMP, f));
}
