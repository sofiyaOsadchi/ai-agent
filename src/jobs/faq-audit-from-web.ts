// src/jobs/faq-audit-from-web.ts
// -------------------------------------------------------------
// DOM-only (מתעלם מ-JSON-LD). אוסף מלונות מתוך עמוד המדינה (main בלבד),
// תומך במלונות שאין להם "leonardo" ב-slug (למשל the-g-hotel),
// טוען דפים דינמיים עם Playwright (אופציונלי) ופותח אקורדיונים/Load more,
// מחלץ הרבה יותר Q/A (כולל dl/dt/dd ו-aria-controls), ועושה ולידציות.
// דוח: Hotel | FAQ | Result / Issue (עם N items checked).
// -------------------------------------------------------------

import * as cheerio from "cheerio";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";
import { validateMetaAndFaqSchema } from "../jobs/subjobs/faq-seo-checks.js";

type QA = { q: string; a: string };
type HotelItem = { name: string; faqUrl: string | null };

type RuleIssue = { kind: "rule"; q: string; a: string; reason: string; index: number };
type GptIssue = { kind: "gpt"; q: string; a: string; reason: string; index: number };
type Issue = RuleIssue | GptIssue;

const MAX_CALLS_PER_HOTEL = Math.max(
  1,
  Math.min(6, Number(process.env.FAQ_AUDIT_MAX_CALLS_PER_HOTEL ?? "1") || 1)
);

// טיימאאוטים ושאר פרמטרים שניתנים לכיוון דרך ENV
const CLICK_PAUSE_MS = Number(process.env.FAQ_AUDIT_CLICK_PAUSE_MS ?? "120");
const LOADMORE_CYCLES = Number(process.env.FAQ_AUDIT_LOADMORE_CYCLES ?? "8");
const SCROLL_STEPS = Number(process.env.FAQ_AUDIT_SCROLL_STEPS ?? "12");
const SCROLL_DELTA = Number(process.env.FAQ_AUDIT_SCROLL_DELTA ?? "1400");

export class FaqAuditFromWebJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  // -----------------------------------------------------------
  // ENTRY
  // -----------------------------------------------------------
  async run(opts: {
    countryUrl: string;
    sheetTitle: string;
    shareResults?: boolean;
  }): Promise<{
    spreadsheetId: string;
    hotelsProcessed: number;
    hotelsWithFaq: number;
    hotelsWithProblems: number;
  }> {
    const hotels = await this.collectHotels(opts.countryUrl);

    const spreadsheetId = await this.sheets.createSpreadsheet(opts.sheetTitle);
    const firstTabTitle = await this.sheets.getFirstSheetTitle(spreadsheetId);
    const firstSheetId = await this.sheets.getSheetIdByTitle(spreadsheetId, firstTabTitle);
    await this.sheets.duplicateSheet(spreadsheetId, firstSheetId, "Audit");

    console.log("📄 Google Sheet:", `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

    const auditRows: string[][] = [
      ["Hotel", "FAQ", "Status", "Kind", "#", "Question", "Answer", "Reason", "Meta title", "Meta description", "Schema"]
    ];
    let hotelsWithFaq = 0;
    let hotelsWithProblems = 0;

    for (const h of hotels) {
      if (!h.faqUrl) {
        auditRows.push([h.name, "", "✗ FAQ page not found", "", "", "", "", "", "", "", ""]);
        continue;
      }
      hotelsWithFaq++;

      let html = "";
      let collected: QA[] = [];
      try {
        const res = await this.fetchFaqDomAndQAs(h.faqUrl);
        html = res.html;
        collected = res.qas;
      } catch (e) {
        auditRows.push([h.name, h.faqUrl, `✗ FAQ fetch failed (${(e as Error).message})`, "", "", "", "", "", "", "", ""]);
        continue;
      }

      // אם אספנו מתוך הדפדפן — עדיף. אחרת ניפול ל־Cheerio.
      const groups = collected.length
        ? [{ label: "FAQ (DOM-accessible)", items: collected }]
        : this.extractFAQFromDOM(html);

      const allQAs = groups.flatMap(g => g.items);
      const totalChecked = allQAs.length;

      if (!totalChecked) {
        auditRows.push([h.name, h.faqUrl, "✗ No Q/A items found in page", "", "", "", "", "", "", "", ""]);
        continue;
      }

      // SEO / Schema checks (Meta + FAQPage JSON-LD)
      const {
        issues: seoIssues,
        schemaQAs,
        metaTitle,
        metaDescription,
      } = validateMetaAndFaqSchema(html);
      // כרגע אנחנו רק מוסיפים את ה-seoIssues; schemaQAs שמורים אם נרצה בעתיד להשוות ל-DOM עם GPT

      // כמה Q/A נמצאו בסכמה
      const schemaQCount = schemaQAs.length;

      // Issues שקשורים לסכמה בלבד (ולא למטה טייטל/דסקריפשן)
      const schemaIssuesOnly = seoIssues.filter(it => it.reason.startsWith("[schema]"));

      // טקסט מסוכם לעמודת "Schema" בדוח
      const schemaSummary =
        schemaQCount === 0
          ? "✗ No schema Q/A"
          : schemaIssuesOnly.length > 0
            ? `✗ ${schemaIssuesOnly.length} schema issues — ${schemaQCount} Qs`
            : `V — ${schemaQCount} schema Qs`;

      const ruleIssues = this.ruleChecks(allQAs);
      const gptIssues = await this.semanticChecksBatched(groups, allQAs);
      const issues: Issue[] = [...ruleIssues, ...gptIssues, ...seoIssues];

      if (issues.length === 0) {
        auditRows.push([
          h.name,
          h.faqUrl,
          `V — ${totalChecked} items checked`,
          "",
          "",
          "",
          "",
          "",
          metaTitle || "",
          metaDescription || "",
          schemaSummary,
        ]);

      } else {
        hotelsWithProblems++;
        // שורת סיכום למלון – עם meta + schema
        auditRows.push([
          h.name,
          h.faqUrl,
          `✗ Found ${issues.length} issues — ${totalChecked} items checked`,
          "",
          "",
          "",
          "",
          "",
          metaTitle || "",
          metaDescription || "",
          schemaSummary,
        ]);

        // שורות ה-issue עצמן – בלי שכפול של הטייטל/דסקריפשן
        for (const it of issues) {
          const qShort = it.q.replace(/\s+/g, " ").slice(0, 500);
          const aShort = it.a.replace(/\s+/g, " ").slice(0, 500);
          const idxStr = Number.isFinite(it.index) ? String((it.index as number) + 1) : "";
          const kind = it.kind;
          const reasonStr = (it.reason ?? "").toString().replace(/^ —\s*/, "");

          auditRows.push([
            h.name,             // Hotel
            h.faqUrl,           // FAQ
            "✗ Issue",          // Status
            kind,               // Kind (rule/gpt)
            idxStr,             // #
            qShort,             // Question
            aShort,             // Answer
            reasonStr,          // Reason
            "",                 // Meta title (ריק בשורות ה-issue)
            "",                 // Meta description
            "",                 // Schema flag
          ]);
        }
      }
    }

    await this.sheets.writeValues(spreadsheetId, "Audit!A1", auditRows);
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Audit");

    return {
      spreadsheetId,
      hotelsProcessed: hotels.length,
      hotelsWithFaq,
      hotelsWithProblems,
    };
  }

  // -----------------------------------------------------------
  // איסוף מלונות מעמוד מדינה + וידוא שיוך לעיר
  // -----------------------------------------------------------
  private async collectHotels(countryUrl: string): Promise<HotelItem[]> {
    const html = await this.fetchText(countryUrl);
    const $ = cheerio.load(html);

    // עובדים על <main> אם יש, אחרת body בלי ניווטים/פוטר
    let $scope = $("main");
    if ($scope.length === 0) {
      $scope = $("body").clone();
      $scope.find("header, nav, footer, .site-header, .site-footer, [role='navigation']").remove();
    }

    const hotelLinks = new Set<string>();
const cityLinks = new Set<string>();

// 1) איסוף לינקים מעמוד המדינה: גם ערים וגם מלונות
$scope.find("a[href]").each((_, el) => {
  const hrefRaw = ($(el).attr("href") || "").trim();
  if (!hrefRaw) return;

  const href = this.makeAbsolute(countryUrl, hrefRaw);
  if (!/^https?:\/\/www\.leonardo-hotels\.com\//i.test(href)) return;

  // מסננים דפי מותג/מועדון/מדינה/קופונים וכו׳
  if (/\/(brand|advantage|club|loyalty|offers?)\/?$/i.test(href)) return;

  try {
    const u = new URL(href);
    const segs = u.pathname.split("/").filter(Boolean);
    const clean = href.replace(/#.*$/, "").replace(/\/$/, "");

    // מלון: /<city>/<hotel> (מנרמלים לבייס של 2 סגמנטים כדי להימנע מ-/reviews/ וכד')
if (segs.length >= 2) {
  const baseHotel = this.normalizeHotelBaseUrl(clean);
  if (baseHotel) hotelLinks.add(baseHotel);
  return;
}

    // עיר: /<city> (אבל לא העמוד של המדינה עצמו)
    if (segs.length === 1) {
      const countrySeg = new URL(countryUrl).pathname.split("/").filter(Boolean)[0]?.toLowerCase();
      if (countrySeg && segs[0].toLowerCase() === countrySeg) return;

      cityLinks.add(clean);
    }
  } catch {
    /* ignore */
  }
});

// 2) כניסה לכל עמוד עיר ואיסוף לינקי מלונות מתוכו (מכסה את ה-See all)
for (const cityUrl of cityLinks) {
  try {
    const cityHtml = await this.fetchText(cityUrl);
    const $$ = cheerio.load(cityHtml);

    let $cityScope = $$("main");
    if ($cityScope.length === 0) $cityScope = $$("body");

    $cityScope.find("a[href]").each((_, a) => {
      const hrefRaw = ($$(a).attr("href") || "").trim();
      if (!hrefRaw) return;

      const href = this.makeAbsolute(cityUrl, hrefRaw);
      if (!/^https?:\/\/www\.leonardo-hotels\.com\//i.test(href)) return;
      if (/\/(brand|advantage|club|loyalty|offers?)\/?$/i.test(href)) return;

      try {
        const u = new URL(href);
        const segs = u.pathname.split("/").filter(Boolean);
       if (segs.length >= 2) {
  const cleanHotel = href.replace(/#.*$/, "").replace(/\/$/, "");
  const baseHotel = this.normalizeHotelBaseUrl(cleanHotel);
  if (baseHotel) hotelLinks.add(baseHotel);
}

      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

// 3) ערים שזוהו מתוך כל המלונות שמצאנו (בשביל validateHotelByCities כמו קודם)
const countryCities = new Set<string>();
for (const url of hotelLinks) {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
    if (seg) countryCities.add(seg.toLowerCase());
  } catch {
    /* ignore */
  }
}

console.log("🏙️ City pages found:", cityLinks.size);
console.log("🔎 Hotel links found (country + cities):", hotelLinks.size);

    const hotels: HotelItem[] = [];
    for (const url of hotelLinks) {
      const belongs = await this.validateHotelByCities(url, countryCities);
      if (!belongs) continue;

      const faqUrlCandidate = `${url}/faq`;
      const ok = await this.headOk(faqUrlCandidate);
      console.log(`    • ${faqUrlCandidate} ${ok ? "✅" : "❌"}`);
      hotels.push({
        name: this.prettyNameFromUrl(url),
        faqUrl: ok ? faqUrlCandidate : null,
      });
    }

    return hotels.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async validateHotelByCities(hotelUrl: string, cities: Set<string>): Promise<boolean> {
    try {
      const segs = new URL(hotelUrl).pathname.split("/").filter(Boolean);
      if (segs.length > 0 && cities.has(segs[0].toLowerCase())) return true;

      const html = await this.fetchText(hotelUrl);
      const $ = cheerio.load(html);

      const crumb = $("[aria-label='breadcrumb'], nav.breadcrumb, .breadcrumb").text().toLowerCase();
      if (crumb) for (const c of cities) if (crumb.includes(c)) return true;

      const body = $("body").text().toLowerCase();
      for (const c of cities) if (new RegExp(`\\b${c}\\b`, "i").test(body)) return true;

      return false;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------
  // חילוץ Q/A מה-DOM (סטטי – Cheerio)
  // -----------------------------------------------------------
  private extractFAQFromDOM(html: string): Array<{ label: string; items: QA[] }> {
    const $ = cheerio.load(html);

    // 1) נסיון לזהות קבוצות לפי כותרות
    const sections: Array<{ label: string; el: cheerio.Cheerio }> = [];
    $("h2, h3").each((_, h) => {
      const t = $(h).text().trim();
      if (!t) return;
      if (/faq|question|policy|stay|room|facility|service|booking|payment|amenit/i.test(t)) {
        sections.push({ label: t, el: $(h) });
      }
    });

    const groups: Array<{ label: string; items: QA[] }> = [];

    if (sections.length) {
      for (let i = 0; i < sections.length; i++) {
        const { label, el } = sections[i];
        const until = sections[i + 1]?.el ?? null;
        const $scope = until ? (el as any).nextUntil(until) : (el as any).nextAll();
        const items = this.collectQAItemsFromScope($, $scope);
        if (items.length) groups.push({ label, items });
      }
    }

    // 2) fallback: הדף כולו
    if (!groups.length) {
      const items = this.collectQAItemsFromScope($, $("body"));
      if (items.length) groups.push({ label: "FAQ", items });
    }

    return groups;
  }

  private collectQAItemsFromScope($: cheerio.Root, $scope: cheerio.Cheerio): QA[] {
    const out: QA[] = [];

    const items = $scope
      .find([
        ".accordion-item",
        ".accordion__item",
        ".faq-item",
        ".faq__item",
        "[data-faq-item]",
        "[data-accordion-item]",
        "details",
        "dl",
      ].join(", "))
      .addBack(".accordion-item, .accordion__item, .faq-item, .faq__item, [data-faq-item], [data-accordion-item], details, dl");

    if (items.length) {
      items.each((_, el) => {
        let q = "";
        let a = "";

        // 1) dl/dt/dd
        if ((el as any).name?.toLowerCase() === "dl") {
          const $dl = $(el);
          const dts = $dl.find("dt");
          const dds = $dl.find("dd");
          const n = Math.min(dts.length, dds.length);
          for (let i = 0; i < n; i++) {
            const qq = $(dts[i]).text().trim();
            const aa = $(dds[i]).text().trim();
            if (qq && aa) out.push({ q: qq, a: aa });
          }
          return;
        }

        // 2) details/summary
        if ((el as any).name?.toLowerCase() === "details") {
          const $det = $(el);
          q = $det.find("summary").first().text().trim();
          a = $det.clone().find("summary").remove().end().text().trim();
          if (q && a) { out.push({ q, a }); return; }
        }

        const $el = $(el);

        // 3) aria-controls mapping (button/summary -> panel#id)
        const trigger =
          $el.find("[aria-controls]").first().length
            ? $el.find("[aria-controls]").first()
            : $el.closest("[aria-controls]").first();

        if (trigger.length) {
          const ctrl = trigger.attr("aria-controls");
          const panel = ctrl ? $(`#${ctrl}`) : $("<div/>");
          q = trigger.text().trim() ||
            $el.find("summary, h2, h3, h4, .question, [data-question], [role=button]").first().text().trim();
          a = panel.text().trim() ||
            $el.find(".answer, .accordion-panel, .accordion-body, [data-answer]").first().text().trim();
          if (!a) {
            a = $el
              .clone()
              .find("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]")
              .remove()
              .end()
              .text()
              .trim();
          }
          if (q && a) { out.push({ q, a }); return; }
        }

        // 4) גנרי: כותרת/כפתור כשאלה, תוכן לא-כותרתי כתשובה
        q =
          $el.find("summary, h2, h3, h4, button, .question, [data-question]").first().text().trim() ||
          $el.find("[role=button]").first().text().trim();

        a =
          $el.find(".answer, .accordion-body, .accordion__panel, [data-answer]").first().text().trim();

        if (!a) {
          a = $el
            .clone()
            .find("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]")
            .remove()
            .end()
            .text()
            .trim();
        }

        if (q && a) out.push({ q, a });
      });

      if (out.length) return out;
    }

    // fallback: H3/H4 + הבלוקים שאחריהם
    $scope.find("h3, h4").each((_, h) => {
      const q = $(h).text().trim();
      if (!q) return;
      let a = "";
      const blocks: any = (($(h) as any).nextUntil ? ($(h) as any).nextUntil("h3, h4") : $(h).nextAll());
      (blocks as any).each((__: number, b: any) => {
        const tag = (b?.name ?? "").toLowerCase();
        if (tag && ["p", "div", "ul", "ol", "li"].includes(tag)) {
          a += " " + $(b).text().trim();
        }
      });
      a = a.trim();
      if (q && a) out.push({ q, a });
    });

    return out;
  }

  // -----------------------------------------------------------
  // כללים דטרמיניסטיים
  // -----------------------------------------------------------
  private ruleChecks(qas: QA[]): RuleIssue[] {
    const issues: RuleIssue[] = [];
    const answerCounts = new Map<string, number>();

    qas.forEach(({ q, a }, idx) => {
      const aNorm = (a || "").trim();
      const aLower = aNorm.toLowerCase();

      if (!aNorm) issues.push({ kind: "rule", q, a, reason: "Empty answer", index: idx });
      if (aNorm.length < 5) issues.push({ kind: "rule", q, a, reason: "Answer too short", index: idx });
      if (/lorem|tbd|coming soon|placeholder|to be determined/i.test(aNorm)) {
        issues.push({ kind: "rule", q, a, reason: "Placeholder answer", index: idx });
      }

      const qMinibar = /mini\s*bar|mini-?fridge|fridge|minibar/i.test(q);
      const qCheckin = /check\s*in|check\s*out|arrival|departure/i.test(q);
      const aCheckin = /check\s*in|check\s*out|arrival|after\s*\d{1,2}[:.]\d{2}/i.test(aNorm);
      const aMinibar = /minibar|mini\s*bar|fridge|drinks|beverage/i.test(aLower);

      if (qMinibar && aCheckin) issues.push({ kind: "rule", q, a, reason: "Answer seems about check-in, not minibar", index: idx });
      if (qCheckin && aMinibar) issues.push({ kind: "rule", q, a, reason: "Answer seems about minibar, not check-in", index: idx });

      const key = aLower.slice(0, 200);
      answerCounts.set(key, (answerCounts.get(key) ?? 0) + 1);
    });

    for (const [key, cnt] of answerCounts.entries()) {
      if (cnt >= 3) {
        qas.forEach(({ q, a }, idx) => {
          if (a.toLowerCase().slice(0, 200) === key) {
            issues.push({ kind: "rule", q, a, reason: "Same answer repeated for many questions", index: idx });
          }
        });
      }
    }

    return issues;
  }

  // -----------------------------------------------------------
  // בדיקה סמנטית באצ'ים (GPT)
  // -----------------------------------------------------------
  private async semanticChecksBatched(
    groups: Array<{ label: string; items: QA[] }>,
    allQAs: QA[]
  ): Promise<GptIssue[]> {
    if (MAX_CALLS_PER_HOTEL <= 1) return await this.semanticCheckBatch(allQAs, 0);

    const batches: { items: QA[]; baseIndex: number }[] = [];
    if (groups.length) {
      let used = 0;
      let base = 0;
      for (const g of groups) {
        if (!g.items.length) continue;
        if (used >= MAX_CALLS_PER_HOTEL) break;
        batches.push({ items: g.items, baseIndex: base });
        base += g.items.length;
        used++;
      }
      const covered = batches.reduce((s, b) => s + b.items.length, 0);
      const remaining = allQAs.slice(covered);
      if (remaining.length) {
        if (batches.length < MAX_CALLS_PER_HOTEL) batches.push({ items: remaining, baseIndex: covered });
        else batches[batches.length - 1].items.push(...remaining);
      }
    } else {
      const parts = MAX_CALLS_PER_HOTEL;
      const size = Math.ceil(allQAs.length / parts);
      for (let i = 0; i < parts; i++) {
        const start = i * size;
        const chunk = allQAs.slice(start, start + size);
        if (!chunk.length) break;
        batches.push({ items: chunk, baseIndex: start });
      }
    }

    const out: GptIssue[] = [];
    for (const b of batches) out.push(...(await this.semanticCheckBatch(b.items, b.baseIndex)));
    return out;
  }

  private async semanticCheckBatch(qas: QA[], baseIndex: number): Promise<GptIssue[]> {
    const list = qas.map((x, i) => `${i + 1}. Q: ${x.q}\nA: ${x.a}`).join("\n\n");

    const system = [
      "You are a strict FAQ validator.",
      "Given a list of Q&A items scraped from a hotel's FAQ page (raw DOM content),",
      "Identify material issues that a typical end-user would notice in the Q&A pairs ONLY (ignore the rest of the page).",
      "",
      "Flag BOTH:",
      "- semantic mismatch (answer doesn't address the question), and",
      "- obvious spelling/grammar issues (clear, non-stylistic errors).",
      "",
      "For each issue, return ONLY valid JSON with entries shaped as:",
      '{"issues":[{"index":number,"reason":string}]}',
      "The 'index' is 0-based within this batch.",
      "",
      "Prefix 'reason' with a category tag so parsing stays simple, e.g.:",
      "- [mismatch] answer talks about parking but the question is about check-in",
      "- [spelling] accomodation -> accommodation",
      "- [grammar] missing verb in the sentence",
    ].join(" ");

    const user = `List:\n${list}\n\nReturn ONLY JSON as specified.`;

    let raw = "";
    try {
      raw = await this.agent.runWithSystem(user, system, "o3");
    } catch {
      // אם יש כשל — אל נפיל את הריצה; נחזיר הודעת שגיאה לכל הפריטים בקבוצת הבדיקה הזו
      return qas.map((x, i) => ({
        kind: "gpt",
        q: x.q,
        a: x.a,
        reason: "inference_error",
        index: baseIndex + i,
      }));
    }

    const parsed = this.extractJsonObject(raw);
    if (!parsed || !Array.isArray(parsed.issues)) return [];

    const issues: GptIssue[] = [];
    for (const it of parsed.issues) {
      const localIdx = Number(it?.index);
      if (!Number.isFinite(localIdx) || localIdx < 0 || localIdx >= qas.length) continue;
      issues.push({
        kind: "gpt",
        q: qas[localIdx].q,
        a: qas[localIdx].a,
        reason: (it?.reason ?? "mismatch").toString(),
        index: baseIndex + localIdx,
      });
    }
    return issues;
  }

  // -----------------------------------------------------------
  // DOM-render: פתיחה/איסוף חכם (Playwright) + סטטי (fetch)
  // -----------------------------------------------------------
  /** דף FAQ: מחזיר גם HTML וגם Q/A שנאספו מתוך הדפדפן (אם רינדור דולק). */
  private async fetchFaqDomAndQAs(url: string): Promise<{ html: string; qas: QA[] }> {
    if (process.env.FAQ_AUDIT_RENDER === "1") {
      const mod: any = await (Function("return import('playwright')")() as Promise<any>);
      const channel = process.env.FAQ_AUDIT_PLAYWRIGHT_CHANNEL;
      const browser = await mod.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      const page = await browser.newPage();

      // ⬇️ הוספה קריטית
      await page.addInitScript({
        content: "window.__name = (o, n) => o;"
      });

      await page.goto(url, { waitUntil: "networkidle" });
      // 1) לפתוח טאבס
      const tabSelectors = [
        "[role=tab]",
        "[data-bs-toggle='tab']",
        "[data-toggle='tab']",
        ".nav-tabs a[href^='#']",
        ".tabs a[href^='#']",
        ".c-tabs a[href^='#']",
        ".faq__tabs a[href^='#']",
      ];
      for (const sel of tabSelectors) {
        const loc = page.locator(sel);
        const count = await loc.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          try { await loc.nth(i).click({ force: true }); await page.waitForTimeout(CLICK_PAUSE_MS); } catch { }
        }
      }

      // 2) לפתוח אקורדיונים/summary
      const accSelectors = [
        "summary",
        ".accordion-button",
        ".accordion__button",
        ".accordion__header button",
        ".accordion-header button",
        "[data-accordion-trigger]",
        "[data-faq-item] button",
        "[aria-controls]",
      ];
      for (const sel of accSelectors) {
        const loc = page.locator(sel);
        const count = await loc.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          try { await loc.nth(i).click({ force: true }); await page.waitForTimeout(Math.max(60, CLICK_PAUSE_MS / 2)); } catch { }
        }
      }

      // 3) להכריח פתיחה של פאנלים שמקושרים נגישותית (גם אם CSS עדיין מסתיר)
      await page.locator("[aria-controls]").evaluateAll((nodes: any[]) => {
        nodes.forEach((n: any) => {
          const ctrl = n.getAttribute("aria-controls");
          if (!ctrl) return;
          const p = document.getElementById(ctrl);
          (n as any).setAttribute("aria-expanded", "true");
          if (p) {
            (p as any).hidden = false;
            (p as any).style.display = "block";
            (p as any).classList.add("open", "show", "is-open");
          }
        });
      });

      // 4) לפתוח את כל ה-<details>
      await page.locator("details").evaluateAll((nodes: any[]) => {
        nodes.forEach((d: any) => { (d as any).open = true; });
      });

      // 5) לנסות "Load more" + lazy load באמצעות גלילות
      const moreSelectors = [
        "button:has-text('Load more')",
        "button:has-text('Show more')",
        "button:has-text('View all')",
        "button:has-text('See more')",
        "a:has-text('Load more')",
        "a:has-text('Show more')",
        "[data-load-more]",
        ".load-more, .js-load-more",
      ];
      for (const sel of moreSelectors) {
        for (let i = 0; i < LOADMORE_CYCLES; i++) {
          const el = page.locator(sel).first();
          if (!(await el.isVisible().catch(() => false))) break;
          try {
            await el.click({ force: true });
            await page.waitForLoadState("networkidle", { timeout: 5000 });
            await page.waitForTimeout(250);
          } catch { }
        }
      }
      for (let y = 0; y < SCROLL_STEPS; y++) { await page.mouse.wheel(0, SCROLL_DELTA); await page.waitForTimeout(100); }
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // 6) איסוף “נראה לעין”
      const visibleQAs: QA[] = await page.evaluate(() => {
        const isVisible = (el: any): boolean => {
          if (!el) return false;
          const style = window.getComputedStyle(el as any);
          const rect = (el as any).getBoundingClientRect();
          const hidden = style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
          const zero = rect.width === 0 || rect.height === 0;
          return !hidden && !zero && (el as any).offsetParent !== null;
        };
        const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
        const text = (el: any) => el ? norm((el as any).innerText) : "";

        const out: { q: string; a: string }[] = [];
        const seen = new Set<string>();

        // details/summary
        (document.querySelectorAll("details") as any).forEach((det: any) => {
          const q = text(det.querySelector("summary"));
          const clone = det.cloneNode(true) as any;
          const sum = clone.querySelector("summary");
          if (sum) sum.remove();
          const a = norm(clone.innerText);
          if (q && a && isVisible(det)) {
            const k = (q + "||" + a).toLowerCase();
            if (!seen.has(k)) { seen.add(k); out.push({ q, a }); }
          }
        });

        // aria-controls → panel (שניהם נראים)
        (document.querySelectorAll("[aria-controls]") as any).forEach((trig: any) => {
          const id = trig.getAttribute("aria-controls") || "";
          if (!id) return;
          const panel = document.getElementById(id);
          const q = text(trig);
          const a = text(panel || undefined);
          if (q && a && isVisible(trig) && isVisible(panel || undefined)) {
            const k = (q + "||" + a).toLowerCase();
            if (!seen.has(k)) { seen.add(k); out.push({ q, a }); }
          }
        });

        // בלוקים שכיחים
        const itemSel = [
          ".accordion-item", ".accordion__item", ".faq-item", ".faq__item",
          "[data-faq-item]", "[data-accordion-item]"
        ].join(", ");
        (document.querySelectorAll(itemSel) as any).forEach((it: any) => {
          if (!isVisible(it)) return;
          const qEl =
            it.querySelector("summary, h1, h2, h3, h4, button, .question, [data-question], [role=button]") ||
            it.querySelector("[class*='title']");
          let aEl =
            it.querySelector(".answer, .accordion-body, .accordion__panel, [data-answer]") ||
            it.querySelector("[class*='content'], [class*='panel']");
          if (!aEl) {
            const clone = it.cloneNode(true) as any;
            clone.querySelectorAll("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]").forEach((n: any) => n.remove());
            aEl = clone;
          }
          const q = text(qEl as any);
          const a = text(aEl as any);
          if (q && a) {
            const k = (q + "||" + a).toLowerCase();
            if (!seen.has(k)) { seen.add(k); out.push({ q, a }); }
          }
        });

        // H3/H4 + רצף הבלוקים שאחריהם
        (document.querySelectorAll("h3, h4") as any).forEach((h: any) => {
          if (!isVisible(h)) return;
          const q = text(h);
          let a = "";
          let n: any = h.nextElementSibling;
          let steps = 0;
          while (n && steps < 12) {
            if (/^h[1-6]$/i.test(n.tagName)) break;
            if (!/^(script|style)$/i.test(n.tagName) && isVisible(n)) a += " " + text(n);
            n = n.nextElementSibling;
            steps++;
          }
          a = a.trim();
          if (q && a) {
            const k = (q + "||" + a).toLowerCase();
            if (!seen.has(k)) { seen.add(k); out.push({ q, a }); }
          }
        });

        return out
          .map(({ q, a }) => ({ q: q.trim(), a: a.trim() }))
          .filter(({ q, a }) => a && a.length >= 5 && a.toLowerCase() !== q.toLowerCase());
      });

      // 7) איסוף “נגיש” — גם אם הפאנל עדיין מוסתר CSS-ית
      const accessibleQAs: QA[] = await page.evaluate(() => {
        const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
        const text = (el: any) => el ? norm((el as any).innerText) : "";
        const out: { q: string; a: string }[] = [];
        const seen = new Set<string>();

        (document.querySelectorAll("details") as any).forEach((det: any) => {
          const q = text(det.querySelector("summary"));
          const clone = det.cloneNode(true) as any;
          const sum = clone.querySelector("summary"); if (sum) sum.remove();
          const a = norm(clone.innerText);
          if (q && a) { const k = (q + "||" + a).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push({ q, a }); } }
        });

        (document.querySelectorAll("[aria-controls]") as any).forEach((trig: any) => {
          const id = trig.getAttribute("aria-controls") || "";
          if (!id) return;
          const panel = document.getElementById(id);
          const q = text(trig);
          const a = text(panel || undefined);
          if (q && a) { const k = (q + "||" + a).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push({ q, a }); } }
        });

        const sel = "[data-bs-target],[data-target],a[href^='#']";
        (document.querySelectorAll(sel) as any).forEach((trig: any) => {
          const t = trig.getAttribute("data-bs-target") || trig.getAttribute("data-target") || trig.getAttribute("href") || "";
          const id = t.startsWith("#") ? t.slice(1) : "";
          if (!id) return;
          const panel = document.getElementById(id);
          const q = text(trig);
          const a = text(panel || undefined);
          if (q && a) { const k = (q + "||" + a).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push({ q, a }); } }
        });

        const itemSel = [
          ".accordion-item", ".accordion__item", ".faq-item", ".faq__item",
          "[data-faq-item]", "[data-accordion-item]"
        ].join(", ");
        (document.querySelectorAll(itemSel) as any).forEach((it: any) => {
          const qEl =
            it.querySelector("summary, h1, h2, h3, h4, button, .question, [data-question], [role=button]") ||
            it.querySelector("[class*='title']");
          let aEl =
            it.querySelector(".answer, .accordion-body, .accordion__panel, [data-answer]") ||
            it.querySelector("[class*='content'], [class*='panel']");
          if (!aEl) {
            const clone = it.cloneNode(true) as any;
            clone.querySelectorAll("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]").forEach((n: any) => n.remove());
            aEl = clone;
          }
          const q = text(qEl as any);
          const a = text(aEl as any);
          if (q && a) { const k = (q + "||" + a).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push({ q, a }); } }
        });

        return out
          .map(({ q, a }) => ({ q: q.trim(), a: a.trim() }))
          .filter(({ q, a }) => a && a.length >= 5 && a.toLowerCase() !== q.toLowerCase());
      });

      const html = await page.content();
      await browser.close();

      const merged = this.dedupeQAs([...visibleQAs, ...accessibleQAs]);
      return { html, qas: merged };
    }

    // בלי רינדור — נחזיר רק HTML ונחלץ עם Cheerio
    const html = await this.fetchText(url, true);
    return { html, qas: [] };
  }

  /** בקשה פשוטה לטקסט (עם אופציית רינדור מלא עבור דפי FAQ במקרה הצורך). */
  private async fetchText(url: string, isFaq = false): Promise<string> {
    if (process.env.FAQ_AUDIT_RENDER === "1") {
      const mod: any = await (Function("return import('playwright')")() as Promise<any>);
      const channel = process.env.FAQ_AUDIT_PLAYWRIGHT_CHANNEL;
      const browser = await mod.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      const page = await browser.newPage();

      // ⬇️ הוספה קריטית
      await page.addInitScript({
        content: "window.__name = (o, n) => o;"
      });

      console.log("🧭 Render mode: Playwright", channel ? `(channel: ${channel})` : "");
      await page.goto(url, { waitUntil: "networkidle" });


      if (isFaq) {
        // פתיחה מינימלית (כמו למעלה אבל קצר יותר – כאן אוספים רק HTML, לא Q/A)
        const tabSelectors = [
          "[role=tab]",
          "[data-bs-toggle='tab']",
          ".nav-tabs a[href^='#']",
        ];
        for (const sel of tabSelectors) {
          const loc = page.locator(sel);
          const count = await loc.count().catch(() => 0);
          for (let i = 0; i < count; i++) {
            try { await loc.nth(i).click({ force: true }); await page.waitForTimeout(CLICK_PAUSE_MS); } catch { }
          }
        }

        await page.locator("[aria-controls]").evaluateAll((nodes: any[]) => {
          nodes.forEach((n: any) => {
            const ctrl = n.getAttribute("aria-controls");
            if (!ctrl) return;
            const p = document.getElementById(ctrl);
            if (!p) return;
            (n as any).setAttribute("aria-expanded", "true");
            (p as any).hidden = false;
            (p as any).style.display = "block";
            (p as any).classList.add("open", "show", "is-open");
          });
        });

        await page.locator("details").evaluateAll((nodes: any[]) => {
          nodes.forEach((d: any) => { (d as any).open = true; });
        });

        for (let y = 0; y < 6; y++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(80); }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
      }

      const html = await page.content();
      await browser.close();
      return html;
    }

    // --- מצב בלי רינדור (מהיר) ---
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 FaqAuditBot", "accept-language": "en-GB,en;q=0.9" },
    });
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return await r.text();
  }

  // -----------------------------------------------------------
  // עזרים
  // -----------------------------------------------------------
  private dedupeQAs(items: QA[]): QA[] {
    const seen = new Set<string>();
    const out: QA[] = [];
    for (const { q, a } of items) {
      const key = (q + "||" + a).replace(/\s+/g, " ").trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ q: q.trim(), a: a.trim() });
      }
    }
    return out;
  }

  private async headOk(url: string): Promise<boolean> {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return true;
    } catch { /* ignore */ }
    try {
      const r2 = await fetch(url, { method: "GET" });
      return r2.ok;
    } catch {
      return false;
    }
  }

  private prettyNameFromUrl(url: string) {
    const last = url.split("/").filter(Boolean).slice(-1)[0];
    return decodeURIComponent((last || url)).replace(/-/g, " ").trim();
  }

  private makeAbsolute(base: string, href: string) {
    try { return new URL(href, base).toString(); } catch { return href; }
  }

  private extractJsonObject(s: string): any | null {
    const matches = s.match(/\{[\s\S]*\}/g);
    if (!matches) return null;
    for (const m of matches) {
      try { const obj = JSON.parse(m); if (obj && typeof obj === "object") return obj; }
      catch { /* continue */ }
    }
    return null;
  }

  private normalizeHotelBaseUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!/^www\.leonardo-hotels\.com$/i.test(u.host)) return null;

    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length < 2) return null;

    const city = segs[0];
    const hotel = segs[1];

    // Guard בסיסי נגד דפים לא רלוונטיים שמופיעים לפעמים בתור "סגמנט שני"
    if (/^(reviews|offers?|brand|advantage|club|loyalty)$/i.test(hotel)) return null;

    return `${u.origin}/${city}/${hotel}`;
  } catch {
    return null;
  }
}

}