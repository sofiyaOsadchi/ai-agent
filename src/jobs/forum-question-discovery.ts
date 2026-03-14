// src/jobs/forum-question-discovery.ts
// Forum Question Discovery (v3): Reddit API (expanded) + FlyerTalk best-effort
// No Google CSE, no DuckDuckGo — both proved unreliable.

import * as cheerio from "cheerio";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

export type ForumDiscoverSource = "reddit" | "flyertalk" | "tripadvisor_forum";

export type ForumQuestionDiscoveryConfig = {
  hotelName: string;
  locale: "en" | "he" | "de";
  sheetTitle: string;
  sources: ForumDiscoverSource[];
  maxItems?: number;
  maxCalls?: number;
  delayMinMs?: number;
  delayMaxMs?: number;
  blockRetries?: number;
  cooldownMinMs?: number;
  cooldownMaxMs?: number;
  usePlaywright?: boolean;
  playwrightChannel?: string;
};

export type RawItem = {
  source: ForumDiscoverSource;
  title: string;
  url?: string;
  author?: string;
  createdAt?: string;
  matchedQuery: string;
};

type ScoredQuestion = {
  question: string;
  score: number;
  level: "High" | "Medium" | "Low";
  primarySource: ForumDiscoverSource;
  seeds: string;
  notes: string;
};

const DEFAULT_TOPICS_EN = [
  "parking", "breakfast", "pool", "spa", "gym", "check-in", "check out",
  "late checkout", "early check-in", "deposit", "credit card", "pets",
  "family room", "connecting rooms", "airport", "shuttle", "transport",
  "wifi", "air conditioning", "noise", "renovation", "luggage storage",
  "accessibility",
];

// For broad city-level searches when hotel-specific results are thin
const BROAD_TOPICS = [
  "hotel parking", "hotel breakfast included", "hotel pool", "hotel check-in time",
  "hotel late checkout", "hotel pets allowed", "hotel airport shuttle",
  "hotel wifi free", "hotel deposit", "hotel early check-in",
];

const COMMON_PREFIXES = [
  "faq:", "faqs:", "review:", "reviews:", "question:", "q:", "help:",
  "info:", "psa:", "update:",
];

const SOURCE_WEIGHT: Record<ForumDiscoverSource, number> = {
  reddit: 1.0,
  flyertalk: 1.2,
  tripadvisor_forum: 1.3,
};

// Travel subreddits — ordered by relevance
const TRAVEL_SUBREDDITS = [
  "hotels", "travel", "solotravel", "TravelHacks", "shoestring",
  "germany", "hamburg", "europe", "AskTravel",
];

const QUERY_STOPWORDS = new Set([
  "hotel", "hotels", "hostel", "hostels",
  "the", "and", "or", "of", "in", "at",
  "master", "leonardo", "nyx", "radisson", "hilton", "marriott", // מותגים נפוצים - אפשר להוסיף
]);

function tokenizeHotelName(hotelName: string): string[] {
  return collapseSpaces(hotelName)
    .split(" ")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/[^a-z0-9\u00c0-\u024f\u0590-\u05ff]/gi, ""))
    .filter(s => s.length >= 3);
}

function getDistinctiveHotelTokens(hotelName: string): string[] {
  return tokenizeHotelName(hotelName)
    .filter(t => !QUERY_STOPWORDS.has(t.toLowerCase()));
}

function containsAnyToken(text: string, tokens: string[]): boolean {
  const low = (text || "").toLowerCase();
  return tokens.some(t => low.includes(t.toLowerCase()));
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function randInt(min: number, max: number): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function collapseSpaces(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function stripCommonPrefixes(s: string): string {
  let out = (s || "").trim();
  for (const p of COMMON_PREFIXES) {
    if (out.toLowerCase().startsWith(p)) out = out.slice(p.length).trim();
  }
  return out;
}

function normalizeQuestionTitle(title: string): string {
  let t = collapseSpaces(title);
  t = stripCommonPrefixes(t);
  t = t.replace(/\?{2,}$/g, "?");
  t = t.replace(/\s+\?/g, "?");
  return t.trim();
}

function normKey(title: string): string {
  return normalizeQuestionTitle(title)
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\u00c0-\u024f\u0590-\u05ff\s\?]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\?+$/g, "")
    .trim();
}

function tokenizeForSimilarity(s: string): Set<string> {
  return new Set(
    normKey(s).split(" ").map(x => x.trim()).filter(Boolean).filter(w => w.length >= 3)
  );
}

function extractGeoHint(hotelName: string): string | null {
  const parts = collapseSpaces(hotelName).split(" ").filter(Boolean);
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1];

  if (last.length < 4) return null;

  return last;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function looksLikeAUserQuestion(title: string): boolean {
  const t = normalizeQuestionTitle(title);
  if (!t || t.length < 6) return false;
  if (t.includes("?")) return true;
  const low = t.toLowerCase();
  const starters = ["how", "is", "can", "where", "what", "when", "why", "do",
    "does", "did", "are", "will", "would", "should", "anyone", "has anyone",
    "does anyone", "any"];
  return starters.some(w => low.startsWith(w + " ") || low.includes(" " + w + " "));
}

type FetchCtx = {
  calls: number;
  maxCalls: number;
  delayMinMs: number;
  delayMaxMs: number;
  blockRetries: number;
  cooldownMinMs: number;
  cooldownMaxMs: number;
};

async function throttledFetchText(
  url: string,
  init: RequestInit,
  ctx: FetchCtx
): Promise<{ status: number; text: string; finalUrl: string }> {
  if (ctx.calls >= ctx.maxCalls) throw new Error(`Max calls reached (${ctx.maxCalls}).`);
  await sleep(randInt(ctx.delayMinMs, ctx.delayMaxMs));
  ctx.calls++;
  const res = await fetch(url, init);
  return { status: res.status, text: await res.text(), finalUrl: res.url };
}

async function fetchWithRetryText(
  url: string,
  init: RequestInit,
  ctx: FetchCtx
): Promise<{ status: number; text: string; finalUrl: string }> {
  let attempt = 0;
  const maxAttempts = Math.max(1, ctx.blockRetries + 1);
  while (true) {
    attempt++;
    const out = await throttledFetchText(url, init, ctx);
    if (out.status === 200) return out;
    if ((out.status === 429 || out.status === 503) && attempt < maxAttempts) {
      await sleep(Math.min(60_000, Math.pow(2, attempt) * 1000 + randInt(200, 1200)));
      continue;
    }
    if (out.status === 403 && attempt < maxAttempts) {
      await sleep(randInt(ctx.cooldownMinMs, ctx.cooldownMaxMs));
      continue;
    }
    return out;
  }
}

function buildQueries(hotelName: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (q: string) => {
    const k = collapseSpaces(q).toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(q);
    }
  };

  const hotelQuoted = `"${hotelName}"`;

  add(hotelQuoted);

  for (const t of DEFAULT_TOPICS_EN) {
    add(`${hotelQuoted} ${t}`);
  }

  const geo = extractGeoHint(hotelName);

  if (geo) {
    add(`${hotelQuoted} ${geo}`);

    for (const t of DEFAULT_TOPICS_EN.slice(0, 8)) {
      add(`${hotelQuoted} ${geo} ${t}`);
    }
  }

  return out;
}

interface Collector {
  source: ForumDiscoverSource;
  collect(hotelName: string, queries: string[], ctx: FetchCtx, maxItems: number, pw?: { page?: Page }): Promise<RawItem[]>;
}

// ── Reddit ────────────────────────────────────────────────────────────────────

class RedditCollector implements Collector {
  source: ForumDiscoverSource = "reddit";

  async collect(hotelName: string, queries: string[], ctx: FetchCtx, maxItems: number): Promise<RawItem[]> {
    const items: RawItem[] = [];
    const headers = {
      "User-Agent": "web:carmelon-agent:v3.0 (forum-question-discovery)",
      "Accept": "application/json,text/plain,*/*",
    };
    const perQueryLimit = 25;

    // 1) Global search for each query
    for (const q of queries) {
      if (items.length >= maxItems) break;
      const url = new URL("https://old.reddit.com/search.json");
      url.searchParams.set("q", q);
      url.searchParams.set("sort", "relevance");
      url.searchParams.set("t", "all");
      url.searchParams.set("limit", String(perQueryLimit));
      url.searchParams.set("raw_json", "1");

      const res = await fetchWithRetryText(url.toString(), { method: "GET", headers }, ctx);
      console.log(`[reddit] status=${res.status} q="${q}" results=${this.countChildren(res.text)}`);
      if (res.status !== 200) continue;
items.push(...this.parseResults(res.text, q, maxItems - items.length, hotelName));
    }

    // 2) Subreddit-specific searches
    for (const sub of TRAVEL_SUBREDDITS) {
      if (items.length >= maxItems) break;
      const url = new URL(`https://old.reddit.com/r/${sub}/search.json`);
      url.searchParams.set("q", hotelName);
      url.searchParams.set("restrict_sr", "1");
      url.searchParams.set("sort", "relevance");
      url.searchParams.set("t", "all");
      url.searchParams.set("limit", String(perQueryLimit));
      url.searchParams.set("raw_json", "1");

      const res = await fetchWithRetryText(url.toString(), { method: "GET", headers }, ctx);
      console.log(`[reddit/r/${sub}] status=${res.status}`);
      if (res.status !== 200) continue;
items.push(...this.parseResults(res.text, `r/${sub}: ${hotelName}`, maxItems - items.length, hotelName));
    }

    // 3) Broad hotel topic searches in travel subreddits (if still need more)
    if (items.length < maxItems) {
      for (const topic of BROAD_TOPICS) {
        if (items.length >= maxItems) break;
        const url = new URL("https://old.reddit.com/r/hotels+travel/search.json");
        url.searchParams.set("q", topic);
        url.searchParams.set("sort", "top");
        url.searchParams.set("t", "year");
        url.searchParams.set("limit", "25");
        url.searchParams.set("raw_json", "1");

        const res = await fetchWithRetryText(url.toString(), { method: "GET", headers }, ctx);
        if (res.status !== 200) continue;
items.push(...this.parseResults(res.text, `broad: ${topic}`, maxItems - items.length, hotelName));
      }
    }

// 4) Comments extraction (best-effort) - מושכים תגובות עבור הפוסטים שנמצאו
// מגבילים כדי לא לשרוף maxCalls
const maxPostsForComments = Math.min(10, Math.max(3, Math.floor(maxItems / 5)));
const perPostCommentsLimit = 60;

const postsWithPermalinks = items
  .filter(it => it.url && it.url.includes("reddit.com/") && it.matchedQuery)
  .slice(0, maxPostsForComments);

const hotelTokens = getDistinctiveHotelTokens(hotelName);

for (const post of postsWithPermalinks) {
  if (items.length >= maxItems) break;
  if (!post.url) continue;

  // convert full URL back to permalink
  const m = post.url.match(/https:\/\/www\.reddit\.com(\/r\/[^\/]+\/comments\/[^\/]+\/[^\/]+\/?)/);
  if (!m) continue;
  const permalink = m[1];

  const jsonArr = await this.fetchPostJson(permalink, ctx);
  if (!jsonArr || jsonArr.length < 2) continue;

  const postData = jsonArr[0]?.data?.children?.[0]?.data;
  const selftext = String(postData?.selftext ?? "").trim();

  const commentListing = jsonArr[1];
  const bodies: string[] = [];

  if (selftext) bodies.push(selftext);

  this.collectCommentBodies(commentListing, bodies, perPostCommentsLimit);

  // הפיכת טקסטים לשאלות
  for (const body of bodies) {
    if (items.length >= maxItems) break;

    // סינון בסיסי לרלוונטיות: חייב להכיל לפחות טוקן ייחודי כלשהו של המלון או את שם המלון המלא
    const relevant =
      (hotelTokens.length === 0) ||
      containsAnyToken(body, hotelTokens) ||
      body.toLowerCase().includes(hotelName.toLowerCase());

    if (!relevant) continue;

    const qs = this.extractQuestionsFromText(body);
    for (const q of qs) {
      if (items.length >= maxItems) break;
      items.push({
        source: "reddit",
        title: q,
        url: post.url, // נשארים עם לינק לפוסט
        matchedQuery: `comments: ${post.matchedQuery}`,
      });
    }
  }
}

    return items;
  }

  private countChildren(text: string): number {
    try { return (JSON.parse(text)?.data?.children ?? []).length; } catch { return 0; }
  }

  private parseResults(text: string, matchedQuery: string, limit: number, hotelName: string): RawItem[] {
  const out: RawItem[] = [];
  let json: any;
  try { json = JSON.parse(text); } catch { return out; }


  for (const c of (json?.data?.children ?? [])) {
    if (out.length >= limit) break;
    const d = c?.data;

    const title = String(d?.title ?? "").trim();
    if (!title) continue;

    // חשוב: לא רק "נראה כמו שאלה", אלא גם קשור למלון
    if (!looksLikeAUserQuestion(title)) continue;

    const hotelLow = hotelName.toLowerCase();
    // אם אין אף טוקן ייחודי של המלון בכותרת, זה לרוב רעש
  const selftext = String(d?.selftext ?? "").toLowerCase();
const combined = (title + " " + selftext).toLowerCase();

if (!combined.includes(hotelLow)) {
  continue;
}

    out.push({
      source: "reddit",
      title: normalizeQuestionTitle(title),
      url: d?.permalink ? `https://www.reddit.com${d.permalink}` : undefined,
      author: d?.author ? String(d.author) : undefined,
      createdAt: d?.created_utc ? new Date(Number(d.created_utc) * 1000).toISOString() : undefined,
      matchedQuery,
    });
  }

  return out;
}


private extractQuestionsFromText(text: string): string[] {
  const cleaned = collapseSpaces(String(text || ""));
  if (!cleaned) return [];

  // מפצלים לפי סימני שאלה או שורות
  const parts = cleaned
    .replace(/\n+/g, "\n")
    .split(/\?|\n/)
    .map(s => collapseSpaces(s))
    .filter(Boolean);

  const questions: string[] = [];
  for (const p of parts) {
    const candidate = p.endsWith("?") ? p : `${p}?`;
    if (looksLikeAUserQuestion(candidate)) {
      questions.push(normalizeQuestionTitle(candidate));
    }
  }

  // dedupe קטן
  const seen = new Set<string>();
  return questions.filter(q => {
    const k = normKey(q);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

private async fetchPostJson(permalink: string, ctx: FetchCtx): Promise<any[] | null> {
  const headers = {
    "User-Agent": "web:carmelon-agent:v3.0 (forum-question-discovery)",
    "Accept": "application/json,text/plain,*/*",
  };
  const url = `https://www.reddit.com${permalink}.json?raw_json=1`;
  const res = await fetchWithRetryText(url, { method: "GET", headers }, ctx);
  if (res.status !== 200) return null;
  try { return JSON.parse(res.text); } catch { return null; }
}

private collectCommentBodies(tree: any, out: string[], max: number): void {
  if (!tree || out.length >= max) return;

  const kind = tree?.kind;
  const data = tree?.data;

  if (kind === "t1") {
    const body = String(data?.body ?? "").trim();
    if (body) out.push(body);
    const replies = data?.replies;
    if (replies?.data?.children) {
      for (const ch of replies.data.children) {
        if (out.length >= max) break;
        this.collectCommentBodies(ch, out, max);
      }
    }
    return;
  }

  if (kind === "Listing") {
    const children = data?.children ?? [];
    for (const ch of children) {
      if (out.length >= max) break;
      this.collectCommentBodies(ch, out, max);
    }
  }
}
}



// ── FlyerTalk (best-effort direct scrape) ────────────────────────────────────

class FlyerTalkCollector implements Collector {
  source: ForumDiscoverSource = "flyertalk";

  private absUrl(href: string): string {
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    if (href.startsWith("/")) return `https://www.flyertalk.com${href}`;
    return `https://www.flyertalk.com/forum/${href}`.replace("/forum/forum/", "/forum/");
  }

  private extractThreadLinks(html: string): Array<{ title: string; url: string }> {
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const out: Array<{ title: string; url: string }> = [];

    $("a[href*='showthread.php'], a[href*='/forum/']").each((_, el) => {
      const title = collapseSpaces($(el).text());
      const href = String($(el).attr("href") || "").trim();
      if (!title || !href || title.length < 6) return;
      const key = href + "|" + title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ title, url: this.absUrl(href) });
    });
    return out;
  }

  async collect(hotelName: string, queries: string[], ctx: FetchCtx, maxItems: number): Promise<RawItem[]> {
    const items: RawItem[] = [];
    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    for (const q of queries.slice(0, 10)) { // limit FT calls — it often blocks
      if (items.length >= maxItems) break;

      const url = new URL("https://www.flyertalk.com/forum/search.php");
      url.searchParams.set("do", "process");
      url.searchParams.set("query", q);
      url.searchParams.set("titleonly", "1");
      url.searchParams.set("showposts", "0");

      const res = await fetchWithRetryText(url.toString(), { method: "GET", headers, redirect: "follow" }, ctx);
      console.log(`[flyertalk] status=${res.status} q="${q}"`);
      if (res.status !== 200) continue;

      const links = this.extractThreadLinks(res.text);
      for (const l of links) {
        if (items.length >= maxItems) break;
        if (!looksLikeAUserQuestion(l.title)) continue;
        items.push({
          source: "flyertalk",
          title: normalizeQuestionTitle(l.title),
          url: l.url,
          matchedQuery: q,
        });
      }
    }

    
    return items;
  }
}

// ── TripAdvisor (Playwright — optional) ──────────────────────────────────────

class TripAdvisorForumCollector implements Collector {
  source: ForumDiscoverSource = "tripadvisor_forum";

  async collect(
    hotelName: string,
    queries: string[],
    ctx: FetchCtx,
    maxItems: number,
    pw?: { page?: Page }
  ): Promise<RawItem[]> {
    const items: RawItem[] = [];

    if (!pw?.page) {
      console.log("[tripadvisor] No Playwright page — skipping (set usePlaywright: true to enable)");
      return items;
    }

    const page = pw.page;
    const hotelUrl = process.env.TRIPADVISOR_HOTEL_URL;

    if (!hotelUrl) {
      console.log("[tripadvisor] No TRIPADVISOR_HOTEL_URL in .env — skipping");
      return items;
    }

    try {
      // עמוד ביקורות
      console.log(`[tripadvisor/pw] Loading hotel page: ${hotelUrl}`);
      await page.goto(hotelUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await sleep(randInt(2000, 3500));

      const pageContent = await page.content();
console.log("[tripadvisor/pw] page length:", pageContent.length);
console.log("[tripadvisor/pw] sample:", pageContent.slice(0, 500).replace(/\s+/g, " "));

      // גרד כותרות ביקורות
      const reviews = await page.$$eval(
        "[data-test-target='reviews-tab'] [data-test-target='review-title'], .review-container .title, .UIReviewBubble .title, span.noQuotes",
        (els) => els.map(el => (el.textContent || "").trim()).filter(Boolean)
      );

      console.log(`[tripadvisor/pw] Found ${reviews.length} review titles`);

      for (const title of reviews) {
        if (items.length >= maxItems) break;
        const normalized = normalizeQuestionTitle(title);
        if (!normalized || normalized.length < 6) continue;
        items.push({
          source: "tripadvisor_forum",
          title: normalized,
          url: hotelUrl,
          matchedQuery: hotelName,
        });
      }

      // גם Q&A אם קיים
      const qaUrl = hotelUrl.replace("/Hotel_Review-", "/Hotel_Review-") + "#REVIEWS";
      const qaSectionUrl = hotelUrl.replace("Reviews-", "QandA-");
      
      try {
        await page.goto(qaSectionUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await sleep(randInt(1500, 2500));

        const questions = await page.$$eval(
          "div[data-test-target='QA-questions'] span, .QandA_question, .question-text",
          (els) => els.map(el => (el.textContent || "").trim()).filter(Boolean)
        );

        console.log(`[tripadvisor/pw] Found ${questions.length} Q&A questions`);

        for (const q of questions) {
          if (items.length >= maxItems) break;
          const normalized = normalizeQuestionTitle(q);
          if (!normalized || normalized.length < 6) continue;
          items.push({
            source: "tripadvisor_forum",
            title: normalized,
            url: qaSectionUrl,
            matchedQuery: hotelName,
          });
        }
      } catch {
        console.log("[tripadvisor/pw] Q&A page not found — skipping");
      }

    } catch (e) {
      console.log(`[tripadvisor/pw] Error: ${e}`);
    }

    return items;
  }
}


// ── Dedup + Scoring ───────────────────────────────────────────────────────────

function dedupeRawItems(raw: RawItem[]): { deduped: RawItem[]; groups: Map<string, RawItem[]> } {
  const byKey = new Map<string, RawItem[]>();
  for (const it of raw) {
    const key = normKey(it.title);
    if (!key) continue;
    const arr = byKey.get(key) ?? [];
    arr.push(it);
    byKey.set(key, arr);
  }

  const keys = Array.from(byKey.keys());
  const used = new Set<string>();
  const mergedGroups = new Map<string, RawItem[]>();

  for (let i = 0; i < keys.length; i++) {
    const k1 = keys[i];
    if (used.has(k1)) continue;
    const group = [...(byKey.get(k1) ?? [])];
    used.add(k1);
    const t1 = tokenizeForSimilarity(k1);

    for (let j = i + 1; j < keys.length; j++) {
      const k2 = keys[j];
      if (used.has(k2)) continue;
      if (jaccard(t1, tokenizeForSimilarity(k2)) >= 0.9) {
        group.push(...(byKey.get(k2) ?? []));
        used.add(k2);
      }
    }

    const canonical = group
      .map(x => normalizeQuestionTitle(x.title))
      .sort((a, b) => b.length - a.length)[0];

    mergedGroups.set(normKey(canonical), group);
  }

  const deduped: RawItem[] = [];
  for (const [, group] of mergedGroups) {
    const rep = group.slice().sort((a, b) => {
      const au = a.url ? 1 : 0;
      const bu = b.url ? 1 : 0;
      if (bu !== au) return bu - au;
      return b.title.length - a.title.length;
    })[0];
    deduped.push(rep);
  }

  return { deduped, groups: mergedGroups };
}

function scoreQuestions(groups: Map<string, RawItem[]>): ScoredQuestion[] {
  const out: ScoredQuestion[] = [];

  for (const [, items] of groups) {
    if (!items.length) continue;
    const question = normalizeQuestionTitle(items[0].title);
    const distinctSources = new Set(items.map(x => x.source));
    const distinctQueries = new Set(items.map(x => x.matchedQuery));
    const primarySource = Array.from(distinctSources)
      .sort((a, b) => (SOURCE_WEIGHT[b] ?? 1) - (SOURCE_WEIGHT[a] ?? 1))[0];

    const score = items.length * (SOURCE_WEIGHT[primarySource] ?? 1.0)
      + Math.max(0, distinctQueries.size - 1) * 0.25;

    out.push({
      question,
      score: Math.round(score * 100) / 100,
      level: "Low",
      primarySource,
      seeds: Array.from(distinctQueries).slice(0, 2).join(" | "),
      notes: `count=${items.length}; distinctSources=${distinctSources.size}; distinctQueries=${distinctQueries.size}`,
    });
  }

  out.sort((a, b) => b.score - a.score);
  const n = out.length;
  if (n === 0) return out;
  const highCut = Math.max(1, Math.floor(n * 0.2));
  const medCut = Math.max(highCut + 1, Math.floor(n * 0.5));
  for (let i = 0; i < n; i++) {
    out[i].level = i < highCut ? "High" : i < medCut ? "Medium" : "Low";
  }
  return out;
}

// ── Main Job ──────────────────────────────────────────────────────────────────

export class ForumQuestionDiscoveryJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  async run(cfg: ForumQuestionDiscoveryConfig): Promise<{
    spreadsheetId: string;
    rawCount: number;
    dedupedCount: number;
    questionsCount: number;
    sourcesRun: ForumDiscoverSource[];
  }> {
    const hotelName = collapseSpaces(cfg.hotelName);
    if (!hotelName) throw new Error("hotelName is required");

    const maxItems = clampInt(cfg.maxItems ?? process.env.FORUM_DISCOVER_MAX_ITEMS, 50, 5000, 600);
    const maxCalls = clampInt(cfg.maxCalls ?? process.env.FORUM_DISCOVER_MAX_CALLS, 10, 5000, 200);
    const delayMinMs = clampInt(cfg.delayMinMs ?? process.env.FORUM_DISCOVER_DELAY_MIN_MS, 100, 30_000, 500);
    const delayMaxMs = clampInt(cfg.delayMaxMs ?? process.env.FORUM_DISCOVER_DELAY_MAX_MS, delayMinMs, 60_000, 1500);
    const blockRetries = clampInt(cfg.blockRetries ?? process.env.FORUM_DISCOVER_BLOCK_RETRIES, 0, 10, 2);
    const cooldownMinMs = clampInt(cfg.cooldownMinMs ?? process.env.FORUM_DISCOVER_COOLDOWN_MIN_MS, 1000, 15 * 60_000, 30_000);
    const cooldownMaxMs = clampInt(cfg.cooldownMaxMs ?? process.env.FORUM_DISCOVER_COOLDOWN_MAX_MS, cooldownMinMs, 30 * 60_000, 120_000);

    const ctx: FetchCtx = { calls: 0, maxCalls, delayMinMs, delayMaxMs, blockRetries, cooldownMinMs, cooldownMaxMs };
    const queries = buildQueries(hotelName);
    const sourcesRun = (cfg.sources ?? []).slice();

    const shouldUsePlaywright =
      Boolean(cfg.usePlaywright) ||
      process.env.FORUM_DISCOVER_PLAYWRIGHT === "1" ||
      process.env.FORUM_DISCOVER_PLAYWRIGHT === "true";
      console.log(`[pw] shouldUsePlaywright=${shouldUsePlaywright} hasTripAdvisor=${sourcesRun.includes("tripadvisor_forum")}`);

    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;

    if (shouldUsePlaywright && sourcesRun.includes("tripadvisor_forum")) {
      const channel = cfg.playwrightChannel || process.env.FORUM_DISCOVER_PLAYWRIGHT_CHANNEL || undefined;
      browser = await chromium.launch({ channel, headless: true });
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      page = await context.newPage();
    }

    const collectors: Collector[] = [];
    for (const s of sourcesRun) {
      if (s === "reddit") collectors.push(new RedditCollector());
      if (s === "flyertalk") collectors.push(new FlyerTalkCollector());
      if (s === "tripadvisor_forum") collectors.push(new TripAdvisorForumCollector());
    }

    const raw: RawItem[] = [];

    try {
      for (const col of collectors) {
        if (raw.length >= maxItems) break;
        const remaining = maxItems - raw.length;
        const cap = Math.min(remaining, Math.max(20, Math.floor(maxItems / Math.max(1, collectors.length))));
        console.log(`[collector] start source=${col.source} cap=${cap}`);
        try {
          const got = await col.collect(hotelName, queries, ctx, cap, { page });
          console.log(`[collector] done source=${col.source} got=${got.length}`);
          raw.push(...got);
        } catch (e) {
          console.error(`[collector] ${col.source} error:`, e);
        }
      }
    } finally {
      try { await page?.close(); } catch {}
      try { await context?.close(); } catch {}
      try { await browser?.close(); } catch {}
    }

    const rawCapped = raw.slice(0, maxItems);
    const { groups } = dedupeRawItems(rawCapped);
    const scored = scoreQuestions(groups);

    const spreadsheetId = await this.sheets.createSpreadsheet(cfg.sheetTitle);
    const firstTabTitle = await this.sheets.getFirstSheetTitle(spreadsheetId);
    await this.sheets.renameSheet(spreadsheetId, firstTabTitle, "Questions");
    await this.sheets.duplicateSheet(spreadsheetId, 0, "Raw");

    const questionsRows: string[][] = [["Category", "Text", "Score", "Level", "Source", "Seeds", "Notes"]];
    for (const q of scored) {
      questionsRows.push(["Question", q.question, String(q.score), q.level, q.primarySource, q.seeds, q.notes]);
    }
    await this.sheets.writeValues(spreadsheetId, `Questions!A1`, questionsRows);

    const rawRows: string[][] = [["Source", "Title", "Query", "Notes"]];
    for (const it of rawCapped) {
      const notes: string[] = [];
      if (it.author) notes.push(`author=${it.author}`);
      if (it.createdAt) notes.push(`createdAt=${it.createdAt}`);
      if (it.url) notes.push(`url=${it.url}`);
      rawRows.push([it.source, it.title, it.matchedQuery, notes.join("; ")]);
    }
    await this.sheets.writeValues(spreadsheetId, `Raw!A1`, rawRows);

    return {
      spreadsheetId,
      rawCount: rawCapped.length,
      dedupedCount: groups.size,
      questionsCount: scored.length,
      sourcesRun,
    };
  }
}