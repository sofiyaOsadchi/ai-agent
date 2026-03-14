// src/jobs/hotel-question-discovery.ts
import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

type Locale = "en" | "he" | "de";

type DiscoveryConfig = {
  locale: Locale;
  acceptLanguage: string;
  googleHl: string; // Google UI language
  googleGl: string; // Country
};

const LOCALE_CFG: Record<Locale, DiscoveryConfig> = {
  en: { locale: "en", acceptLanguage: "en-GB,en;q=0.9", googleHl: "en", googleGl: "gb" },
  he: { locale: "he", acceptLanguage: "he-IL,he;q=0.9,en;q=0.8", googleHl: "iw", googleGl: "il" }, // Google uses "iw" in some places
  de: { locale: "de", acceptLanguage: "de-DE,de;q=0.9,en;q=0.8", googleHl: "de", googleGl: "de" },
};

const ENV = {
  MODE: (process.env.MODE ?? "").toLowerCase(),
  DISCOVER_LOCALE: (process.env.DISCOVER_LOCALE ?? "en").toLowerCase() as Locale,
  DISCOVER_MAX_QUESTIONS: Number(process.env.DISCOVER_MAX_QUESTIONS ?? "400"),
  DISCOVER_MAX_DEPTH: Number(process.env.DISCOVER_MAX_DEPTH ?? "4"),
  DISCOVER_MAX_SERP_FETCHES: Number(process.env.DISCOVER_MAX_SERP_FETCHES ?? "90"),

  DISCOVER_SUGGEST_MAX_CALLS: Number(process.env.DISCOVER_SUGGEST_MAX_CALLS ?? "120"),
  DISCOVER_SUGGEST_DELAY_MIN_MS: Number(process.env.DISCOVER_SUGGEST_DELAY_MIN_MS ?? "300"),
  DISCOVER_SUGGEST_DELAY_MAX_MS: Number(process.env.DISCOVER_SUGGEST_DELAY_MAX_MS ?? "900"),

  DISCOVER_SERP_DELAY_MIN_MS: Number(process.env.DISCOVER_SERP_DELAY_MIN_MS ?? "2000"),
  DISCOVER_SERP_DELAY_MAX_MS: Number(process.env.DISCOVER_SERP_DELAY_MAX_MS ?? "7000"),

  DISCOVER_BLOCK_RETRIES: Number(process.env.DISCOVER_BLOCK_RETRIES ?? "3"),
  DISCOVER_BLOCK_COOLDOWN_MIN_MS: Number(process.env.DISCOVER_BLOCK_COOLDOWN_MIN_MS ?? "60000"),
  DISCOVER_BLOCK_COOLDOWN_MAX_MS: Number(process.env.DISCOVER_BLOCK_COOLDOWN_MAX_MS ?? "180000"),

  DISCOVER_PAA_EXPAND_CLICKS: Number(process.env.DISCOVER_PAA_EXPAND_CLICKS ?? "4"),
  DISCOVER_PLAYWRIGHT_CHANNEL: process.env.DISCOVER_PLAYWRIGHT_CHANNEL || process.env.FAQ_AUDIT_PLAYWRIGHT_CHANNEL,
};

const DEFAULT_TOPICS = [
  "parking",
  "breakfast",
  "check in",
  "check out",
  "pool",
  "spa",
  "gym",
  "location",
  "airport",
  "shuttle",
  "family",
  "kids",
  "pets",
  "deposit",
  "cancellation",
  "wifi",
  "rooms",
  "restaurants",
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function randInt(min: number, max: number) {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

async function jitterSleep(minMs: number, maxMs: number) {
  await sleep(randInt(minMs, maxMs));
}

function normText(s: string) {
  return (s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(s: string) {
  return normText(s).toLowerCase();
}

function looksLikeQuestion(s: string) {
  const t = normText(s);
  if (!t) return false;
  if (t.length < 8) return false;
  if (t.length > 180) return false;
  if (t.includes("\n")) return false;

  // Prefer actual questions
  if (t.endsWith("?")) return true;

  // Accept typical question starters (some PAA items in some locales omit '?')
  return /^(who|what|when|where|why|how|is|are|can|does|do|did|was|were|should|will|would)\b/i.test(t);
}

function isBlockedPageText(t: string) {
  const s = (t ?? "").toLowerCase();
  return (
    s.includes("unusual traffic") ||
    s.includes("our systems have detected") ||
(s.includes("sorry") && s.includes("automated")) ||
    s.includes("captcha") ||
    s.includes("verify you are a human") ||
    s.includes("/sorry/")
  );
}

async function fetchSuggest(query: string, cfg: DiscoveryConfig): Promise<string[]> {
  const q = encodeURIComponent(query);
  // client=firefox returns a simple JSON array
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${cfg.googleHl}&q=${q}`;

  const r = await fetch(url, {
    headers: {
      "accept-language": cfg.acceptLanguage,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
    },
  });

  if (!r.ok) {
    const msg = `Suggest HTTP ${r.status} for query="${query}"`;
    const e: any = new Error(msg);
    e.status = r.status;
    throw e;
  }

  const data = (await r.json()) as any;
  const arr: string[] = Array.isArray(data) ? (data[1] as any[]) : [];
  return (arr ?? []).map((x) => normText(String(x))).filter(Boolean);
}

async function fetchSuggestWithBackoff(query: string, cfg: DiscoveryConfig): Promise<string[]> {
  let attempt = 0;
  const max = 6;

  while (true) {
    try {
      return await fetchSuggest(query, cfg);
    } catch (e: any) {
      const status = e?.status;
      if ((status === 429 || status === 503) && attempt < max) {
        const base = 800 * Math.pow(2, attempt);
        await sleep(base + randInt(0, 300));
        attempt++;
        continue;
      }
      throw e;
    }
  }
}

type QuestionAgg = {
  text: string;
  count: number; // number of times found across queries/pages
  seeds: Set<string>; // which seed queries produced it
  minDepth: number;
};

export class HotelQuestionDiscoveryJob {
  constructor(private sheets: SheetsService) {}

  async run(opts: { hotelName: string; sheetTitle?: string; locale?: Locale }): Promise<{
    spreadsheetId: string;
    hotelName: string;
    locale: Locale;
    questionsFound: number;
    queriesFound: number;
    blockedCount: number;
  }> {
    const locale = (opts.locale ?? ENV.DISCOVER_LOCALE ?? "en") as Locale;
    const cfg = LOCALE_CFG[locale] ?? LOCALE_CFG.en;

    const hotelName = normText(opts.hotelName);
    if (!hotelName) throw new Error("hotelName is required");

    const sheetTitle = opts.sheetTitle ?? `${hotelName} - Question Discovery`;
    const spreadsheetId = await this.sheets.createSpreadsheet(sheetTitle);

    // First tab becomes Questions, plus Queries tab
    const firstTabTitle = await this.sheets.getFirstSheetTitle(spreadsheetId);
    await this.sheets.renameSheet(spreadsheetId, firstTabTitle, "Questions");
    await this.sheets.ensureTab(spreadsheetId, "Queries");

    console.log(chalk.cyan("📄 Google Sheet:"), `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

    console.log(chalk.yellow("🔎 Step 1: Collecting Google Autocomplete seeds..."));
    const { seedQueries, suggestCalls } = await this.collectSeedsFromSuggest(hotelName, cfg);

    console.log(
      chalk.green(`✅ Suggest seeds collected: ${seedQueries.length} (calls=${suggestCalls})`)
    );

    console.log(chalk.yellow("🧠 Step 2: Expanding People Also Ask (PAA) tree..."));
   const onCheckpoint = async (
  qs: Map<string, QuestionAgg>,
  blockedCount: number,
  serpFetches: number
) => {
  const rows = this.buildQuestionsRows(hotelName, locale, qs);
  await this.sheets.writeValues(spreadsheetId, "Questions!A1", rows);
  console.log(
    chalk.gray(`🧾 Checkpoint saved: questions=${qs.size}, serpFetches=${serpFetches}, blocked=${blockedCount}`)
  );
};

const {
  questions,
  blockedCount,
  serpFetches,
} = await this.collectQuestionsFromPaaTree(hotelName, seedQueries, cfg, onCheckpoint);

    console.log(
      chalk.green(`✅ PAA done: questions=${questions.size}, serpFetches=${serpFetches}, blocked=${blockedCount}`)
    );

    const queriesRows = this.buildQueriesRows(hotelName, locale, seedQueries);
    const questionsRows = this.buildQuestionsRows(hotelName, locale, questions);

    await this.sheets.writeValues(spreadsheetId, "Queries!A1", queriesRows);
    await this.sheets.writeValues(spreadsheetId, "Questions!A1", questionsRows);

    // Optional formatting using your existing FAQ-style formatter (works on A:G only).
    // We keep A:G structure for both tabs.
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Queries").catch(() => {});
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Questions").catch(() => {});

    return {
      spreadsheetId,
      hotelName,
      locale,
      questionsFound: questions.size,
      queriesFound: seedQueries.length,
      blockedCount,
    };
  }

  private buildQueriesRows(hotelName: string, locale: string, seedQueries: string[]): string[][] {
    const rows: string[][] = [
      ["Category", "Text", "Score", "Level", "Source", "Seeds", "Notes"],
    ];

    // Queries are not scored by volume; keep score empty for now.
    for (const q of seedQueries) {
      rows.push(["Query", q, "", "", "suggest", hotelName, `locale=${locale}`]);
    }
    return rows;
  }

  private buildQuestionsRows(hotelName: string, locale: string, questions: Map<string, QuestionAgg>): string[][] {
    const list = [...questions.values()];

    // Score: base 2 per appearance (PAA), plus +1 per distinct seed beyond first
    const scored = list.map((x) => {
      const seedBonus = Math.max(0, x.seeds.size - 1);
      const score = x.count * 2 + seedBonus;
      return { ...x, score };
    });

    // Level by percentiles (top 15% High, next 35% Medium, rest Low)
    scored.sort((a, b) => b.score - a.score || b.count - a.count);

    const n = scored.length || 1;
    const highCut = Math.floor(n * 0.15);
    const medCut = Math.floor(n * 0.50);

    const rows: string[][] = [
      ["Category", "Text", "Score", "Level", "Source", "Seeds", "Notes"],
    ];

    for (let i = 0; i < scored.length; i++) {
      const it = scored[i];
      const level = i < highCut ? "High" : i < medCut ? "Medium" : "Low";
      const seedsShort = [...it.seeds].slice(0, 6).join(" | ");
      const notes = `count=${it.count}, seedCount=${it.seeds.size}, minDepth=${it.minDepth}, locale=${locale}`;
      rows.push(["Question", it.text, String(it.score), level, "paa", seedsShort, notes]);
    }

    // Keep at most configured max
    const max = clamp(ENV.DISCOVER_MAX_QUESTIONS, 50, 2000);
    return rows.slice(0, max + 1);
  }

  private async collectSeedsFromSuggest(hotelName: string, cfg: DiscoveryConfig): Promise<{
    seedQueries: string[];
    suggestCalls: number;
  }> {
    const maxCalls = clamp(ENV.DISCOVER_SUGGEST_MAX_CALLS, 20, 500);
    const out = new Set<string>();

    const queue: string[] = [];
    const pushQ = (q: string) => {
      const t = normText(q);
      if (!t) return;
      const k = normKey(t);
      if (!out.has(k)) {
        out.add(k);
        queue.push(t);
      }
    };

    // Baseline + baseline+topics
    pushQ(hotelName);
    for (const topic of DEFAULT_TOPICS) pushQ(`${hotelName} ${topic}`);

    let calls = 0;
    const seenSuggest = new Set<string>();

    while (queue.length && calls < maxCalls) {
      const q = queue.shift()!;
      const qk = normKey(q);
      if (seenSuggest.has(qk)) continue;
      seenSuggest.add(qk);

      await jitterSleep(ENV.DISCOVER_SUGGEST_DELAY_MIN_MS, ENV.DISCOVER_SUGGEST_DELAY_MAX_MS);

      let suggs: string[] = [];
      try {
        suggs = await fetchSuggestWithBackoff(q, cfg);
        calls++;
      } catch (e: any) {
        // If blocked at suggest level, just stop expanding further.
        console.warn(chalk.red(`⚠️ Suggest failed: ${e?.message ?? String(e)}`));
        break;
      }

      // Add raw suggestions as queries
      for (const s of suggs.slice(0, 12)) pushQ(s);

      // Extract "topics" from suggestions to widen coverage
      for (const s of suggs.slice(0, 10)) {
        const topic = this.extractTopicFromSuggestion(hotelName, s);
        if (topic) pushQ(`${hotelName} ${topic}`);
      }
    }

    // Final list: keep unique, stable order, cap size
    const all = [...out.values()];
    // Prefer queries that contain hotel name
    const hotelK = normKey(hotelName);
    all.sort((a, b) => {
      const ah = normKey(a).includes(hotelK) ? 0 : 1;
      const bh = normKey(b).includes(hotelK) ? 0 : 1;
      return ah - bh || a.length - b.length;
    });

    return { seedQueries: all.slice(0, 300), suggestCalls: calls };
  }

  private extractTopicFromSuggestion(hotelName: string, suggestion: string): string | null {
    const h = normKey(hotelName);
    const s = normKey(suggestion);

    if (!s.includes(h)) return null;

    // Try to remove hotel name prefix
    const idx = s.indexOf(h);
    let tail = s.slice(idx + h.length).trim();
    if (!tail) return null;

    // Clean separators
    tail = tail.replace(/^[\-\|:]+/, "").trim();
    tail = tail.replace(/\b(review|reviews|tripadvisor|booking|expedia)\b/g, "").trim();

    // Too long or too short topic is not useful
    if (tail.length < 3) return null;
    if (tail.length > 30) return null;

    // Avoid dates / years
    if (/\b(19\d{2}|20\d{2})\b/.test(tail)) return null;

    return tail;
  }

  private async collectQuestionsFromPaaTree(
  hotelName: string,
  seedQueries: string[],
  cfg: DiscoveryConfig,
  onCheckpoint?: (questions: Map<string, QuestionAgg>, blockedCount: number, serpFetches: number) => Promise<void>
): Promise<{
  questions: Map<string, QuestionAgg>;
  blockedCount: number;
  serpFetches: number;
}> {
  const maxDepth = clamp(ENV.DISCOVER_MAX_DEPTH, 1, 6);
  const maxSerpFetches = clamp(ENV.DISCOVER_MAX_SERP_FETCHES, 10, 400);
  const maxQuestions = clamp(ENV.DISCOVER_MAX_QUESTIONS, 50, 2000);

  const questions = new Map<string, QuestionAgg>();

  const seenQueries = new Set<string>();
  const queue: Array<{ q: string; depth: number; seed: string }> = [];

  const pushQuery = (q: string, depth: number, seed: string) => {
    const t = normText(q);
    if (!t) return;
    const k = normKey(t);
    if (seenQueries.has(k)) return;
    seenQueries.add(k);
    queue.push({ q: t, depth, seed });
  };

  // Start with hotel name and some best seeds
  pushQuery(hotelName, 0, hotelName);

  const strongestSeeds = seedQueries
    .filter((x) => normKey(x).includes(normKey(hotelName)))
    .slice(0, 35);

  for (const s of strongestSeeds) pushQuery(s, 0, s);

  let blockedCount = 0;
  let serpFetches = 0;

  // Launch browser once per run (reused across queries)
  const mod: any = await (Function("return import('playwright')")() as Promise<any>);
  const channel = ENV.DISCOVER_PLAYWRIGHT_CHANNEL;
  const browser = await mod.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });

  try {
    while (queue.length && serpFetches < maxSerpFetches && questions.size < maxQuestions) {
      const node = queue.shift()!;
      if (node.depth > maxDepth) continue;

      await jitterSleep(ENV.DISCOVER_SERP_DELAY_MIN_MS, ENV.DISCOVER_SERP_DELAY_MAX_MS);

      const res = await this.fetchPaaForQueryWithRetries(browser, node.q, cfg);
      serpFetches += res.didFetch ? 1 : 0;

      if (res.blocked) {
        blockedCount++;
        // Save partial progress when blocked
        if (onCheckpoint) await onCheckpoint(questions, blockedCount, serpFetches);
        continue;
      }

      const newQs: string[] = res.questions;

      let newAdded = 0;
      for (const qText of newQs) {
        const qt = normText(qText);
        if (!looksLikeQuestion(qt)) continue;

        const key = normKey(qt);
        const agg = questions.get(key);

        if (!agg) {
          questions.set(key, {
            text: qt,
            count: 1,
            seeds: new Set([node.seed]),
            minDepth: node.depth,
          });
          newAdded++;
        } else {
          agg.count += 1;
          agg.seeds.add(node.seed);
          agg.minDepth = Math.min(agg.minDepth, node.depth);
        }
      }

      // Expand conservatively
      const expandBudget = 6;
      const candidates = newQs
        .map((x) => normText(x))
        .filter((x) => looksLikeQuestion(x))
        .slice(0, expandBudget);

      for (const qText of candidates) {
        pushQuery(qText, node.depth + 1, node.seed);

        const topic = this.extractTopicFromQuestion(qText);
        if (topic) pushQuery(`${hotelName} ${topic}`, node.depth + 1, node.seed);
      }

      // Checkpoint every 10 SERPs
      if (onCheckpoint && serpFetches > 0 && serpFetches % 10 === 0) {
        await onCheckpoint(questions, blockedCount, serpFetches);
      }

      // Weak branch: no special action needed, already conservative
      if (newAdded < 2) {
        // no-op
      }
    }

    // Final checkpoint at end
    if (onCheckpoint) await onCheckpoint(questions, blockedCount, serpFetches);

    return { questions, blockedCount, serpFetches };
  } finally {
    await browser.close().catch(() => {});
  }
}

  private extractTopicFromQuestion(q: string): string | null {
    const t = normKey(q).replace(/\?$/, "");
    // Very lightweight topic extraction: remove leading question words
    const cleaned = t.replace(/^(who|what|when|where|why|how|is|are|can|does|do|did|was|were|should|will|would)\s+/i, "");
    const words = cleaned.split(/\s+/).filter(Boolean);

    if (words.length === 0) return null;

    const stop = new Set(["the", "a", "an", "to", "of", "in", "on", "for", "at", "and", "or", "with", "from"]);
    const kept = words.filter((w) => !stop.has(w)).slice(0, 5);

    const topic = kept.join(" ").trim();
    if (topic.length < 3 || topic.length > 30) return null;
    return topic;
  }
private async fetchPaaForQueryWithRetries(
  browser: any,
  query: string,
  cfg: DiscoveryConfig
): Promise<{
  blocked: boolean;
  questions: string[];
  didFetch: boolean;
}> {
  const retries = clamp(ENV.DISCOVER_BLOCK_RETRIES, 0, 6);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await this.fetchPaaForQuery(browser, query, cfg);

    if (!res.blocked) return { ...res, didFetch: true };

    const cool = randInt(ENV.DISCOVER_BLOCK_COOLDOWN_MIN_MS, ENV.DISCOVER_BLOCK_COOLDOWN_MAX_MS);
    console.warn(
      chalk.red(
        `🚫 Blocked on SERP. Cooldown ${Math.round(cool / 1000)}s then retry (${attempt + 1}/${retries})...`
      )
    );
    await sleep(cool);
  }

  return { blocked: true, questions: [], didFetch: true };
}


  private async fetchPaaForQuery(
  browser: any,
  query: string,
  cfg: DiscoveryConfig
): Promise<{
  blocked: boolean;
  questions: string[];
}> {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    locale: cfg.locale,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
    extraHTTPHeaders: { "accept-language": cfg.acceptLanguage },
  });

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(60_000);

  try {
    const q = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${q}&hl=${cfg.googleHl}&gl=${cfg.googleGl}&pws=0`;

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await this.tryHandleGoogleConsent(page);

    const curUrl = page.url();
    if (curUrl.includes("/sorry/")) return { blocked: true, questions: [] };

    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (isBlockedPageText(bodyText)) return { blocked: true, questions: [] };

    await this.tryExpandPaa(page, ENV.DISCOVER_PAA_EXPAND_CLICKS);

    const questions = await this.extractPaaQuestions(page);
    return { blocked: false, questions };
  } catch {
    // Treat unexpected failures as blocked/failed for safety (keeps flow going)
    return { blocked: true, questions: [] };
  } finally {
    await context.close().catch(() => {});
  }
}

  private async tryHandleGoogleConsent(page: any): Promise<void> {
    // This is best-effort: Google consent varies by region/session.
    const candidates = [
      "button:has-text('I agree')",
      "button:has-text('Accept all')",
      "button:has-text('Accept')",
      "button:has-text('Agree')",
      "button:has-text('Accept alles')",
      "button:has-text('Ich stimme zu')",
      "button:has-text('אני מסכים')",
      "button:has-text('אישור')",
    ];

    for (const sel of candidates) {
      const btn = page.locator(sel).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(900).catch(() => {});
        break;
      }
    }
  }

  private async tryExpandPaa(page: any, clicks: number): Promise<void> {
    const n = clamp(clicks, 0, 12);
    if (n === 0) return;

    // We attempt a few selector strategies. If none work, we just skip.
    const selectors = [
      // Common patterns for PAA question rows/buttons
      "div[role='button'][aria-expanded]",
      "div[role='button'] span",
    ];

    for (const sel of selectors) {
      const loc = page.locator(sel);
      const count = await loc.count().catch(() => 0);
      if (count < 2) continue;

      const toClick = Math.min(n, count);
      for (let i = 0; i < toClick; i++) {
        try {
          await loc.nth(i).click({ force: true });
          await page.waitForTimeout(randInt(450, 900));
        } catch {
          // ignore
        }
      }
      break;
    }
  }

  private async extractPaaQuestions(page: any): Promise<string[]> {
    // Prefer extracting within the “People also ask” section, but fall back to heuristics.
    const qs: string[] = await page.evaluate(() => {
      const norm = (s: string) => (s || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

      const headers = Array.from(document.querySelectorAll("span, div, h2, h3"))
        .map((el) => ({ el, t: norm((el as HTMLElement).innerText || "") }))
        .filter((x) => x.t.length > 0);

      // Find "People also ask" header (English). If missing, we still try fallback.
const paaTitles = new Set([
  "people also ask",
  // German
  "nutzer fragen auch",
  // Hebrew (Google משתנה, אבל אלו נפוצים)
  "אנשים גם שואלים",
  "אנשים שואלים גם",
]);

const paaHeader = headers.find((x) => paaTitles.has(x.t.toLowerCase()))?.el as HTMLElement | undefined;
      const collectFromRoot = (root: HTMLElement | Document) => {
        const out: string[] = [];
        const seen = new Set<string>();

        // Buttons with aria-expanded are often PAA items
        const btns = Array.from((root as any).querySelectorAll?.("div[role='button'][aria-expanded], div[role='button']") ?? []) as HTMLElement[];
        for (const b of btns) {
          const t = norm(b.innerText || "");
          if (!t) continue;
          // Filter obvious non-questions by length and typical starts - keep it mild here
          if (t.length < 8 || t.length > 180) continue;
          const k = t.toLowerCase();
          if (seen.has(k)) continue;
          // Avoid huge multi-line blocks
          if (t.includes("\n")) continue;
          // Prefer things that look like questions
          const looks =
            t.endsWith("?") ||
            /^(who|what|when|where|why|how|is|are|can|does|do|did|was|were|should|will|would)\b/i.test(t);
          if (!looks) continue;

          seen.add(k);
          out.push(t);
        }
        return out;
      };

      // Try: collect from the nearest section around the PAA header
      if (paaHeader) {
        let root: HTMLElement | null = paaHeader;
        for (let i = 0; i < 6; i++) root = root?.parentElement ?? null;
        if (root) {
          const scoped = collectFromRoot(root);
          if (scoped.length) return scoped;
        }
      }

      // Fallback: global heuristic
      return collectFromRoot(document);
    });

    // Final clean + dedupe
    const out: string[] = [];
    const seen = new Set<string>();

    for (const q of qs) {
      const t = normText(q);
      if (!looksLikeQuestion(t)) continue;
      const k = normKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }

    return out;
  }
}