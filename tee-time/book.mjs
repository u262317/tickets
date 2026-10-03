// Ad hoc tee-time booker for an Intelligent Golf (IG) members' site.
// Usage: node book.mjs --date YYYY-MM-DD --after HH:MM --before HH:MM [--players N] [--headed] [--dry-run]
// Selectors are best guesses: run with --headed --dry-run first and adjust the SELECTORS block.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

// Minimal .env loader (no extra dependency).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const { values: a } = parseArgs({
  options: {
    date: { type: "string" },
    after: { type: "string", default: "07:00" },
    before: { type: "string", default: "17:00" },
    players: { type: "string", default: "1" },
    headed: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});
const { CLUB_URL, MEMBER_ID, MEMBER_PIN } = process.env;
if (!a.date || !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !CLUB_URL || !MEMBER_ID || !MEMBER_PIN) {
  console.error("Usage: node book.mjs --date YYYY-MM-DD [--after HH:MM] [--before HH:MM] [--players N] [--headed] [--dry-run]\nNeeds CLUB_URL, MEMBER_ID, MEMBER_PIN in .env");
  process.exit(1);
}

// Everything site-specific lives here so it is easy to tune after the first headed run.
const SELECTORS = {
  userId: 'input[name*="userid" i], input[name*="user" i], input[id*="user" i]',
  pin: 'input[type="password"]',
  loginButton: 'button[type="submit"], input[type="submit"]',
  bookingLink: 'a:has-text("Book a Tee Time"), a:has-text("Tee Sheet"), a:has-text("Book")',
  slotLink: 'a, button', // filtered by time text below
  confirm: 'button:has-text("Confirm"), input[value*="Confirm" i], button:has-text("Book")',
};

const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const [lo, hi] = [toMin(a.after), toMin(a.before)];

mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: !a.headed });
const page = await (await browser.newContext()).newPage();
const shot = n => page.screenshot({ path: `artifacts/${n}.png`, fullPage: true }).catch(() => {});

try {
  console.log("Logging in...");
  await page.goto(CLUB_URL, { waitUntil: "domcontentloaded" });
  await page.locator(SELECTORS.userId).first().fill(MEMBER_ID);
  await page.locator(SELECTORS.pin).first().fill(MEMBER_PIN);
  await page.locator(SELECTORS.loginButton).first().click();
  await page.waitForLoadState("networkidle");
  await shot("1-after-login");

  console.log("Opening booking page...");
  await page.locator(SELECTORS.bookingLink).first().click();
  await page.waitForLoadState("networkidle");

  // Date selection varies by site: try a date in the URL/input first, else leave for manual tuning.
  const dateInput = page.locator('input[type="date"]').first();
  if (await dateInput.count()) {
    await dateInput.fill(a.date);
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
  } else {
    console.warn(`No date input found; make sure the page shows ${a.date} (tune SELECTORS/date step).`);
  }
  await shot("2-tee-sheet");

  // Find the earliest slot whose time falls in the window.
  const candidates = await page.locator(SELECTORS.slotLink).all();
  let best = null;
  for (const el of candidates) {
    const text = (await el.innerText().catch(() => "")).trim();
    const m = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (!m) continue;
    const mins = +m[1] * 60 + +m[2];
    if (mins >= lo && mins <= hi && (!best || mins < best.mins)) best = { el, mins, text };
  }
  if (!best) throw new Error(`No slot found between ${a.after} and ${a.before} on ${a.date}. See artifacts/2-tee-sheet.png`);
  console.log(`Chosen slot: ${best.text.replace(/\s+/g, " ")}`);
  await best.el.click();
  await page.waitForLoadState("networkidle");
  await shot("3-slot-selected");

  if (a["dry-run"]) {
    console.log("Dry run: stopping before confirm. Nothing booked.");
  } else {
    console.log(`Confirming for ${a.players} player(s)...`);
    await page.locator(SELECTORS.confirm).first().click();
    await page.waitForLoadState("networkidle");
    await shot("4-confirmed");
    console.log("Done. Check artifacts/4-confirmed.png and your email to verify the booking.");
  }
} catch (err) {
  await shot("error");
  console.error("Failed:", err.message, "\nScreenshot: artifacts/error.png");
  process.exitCode = 1;
} finally {
  if (a.headed) await page.waitForTimeout(3000);
  await browser.close();
}
