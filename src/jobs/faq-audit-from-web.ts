// src/jobs/faq-audit-from-web.ts
// -------------------------------------------------------------
// גרסה סופית בהחלט:
// 1. Scraping מלא (Playwright/Cheerio) מהקוד המקורי.
// 2. דוח מפוצל: Critical Issues (רק שגיאות חמורות) + Full Report (הכל).
// 3. מניעת הצפה: שגיאות סכמה מאוחדות לשורה אחת.
// 4. עמודת H1 ועמודות מספרים (DOM/Schema/Gap).
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

// טיימאאוטים ושאר פרמטרים
const CLICK_PAUSE_MS = Number(process.env.FAQ_AUDIT_CLICK_PAUSE_MS ?? "120");
const LOADMORE_CYCLES = Number(process.env.FAQ_AUDIT_LOADMORE_CYCLES ?? "8");
const SCROLL_STEPS = Number(process.env.FAQ_AUDIT_SCROLL_STEPS ?? "12");
const SCROLL_DELTA = Number(process.env.FAQ_AUDIT_SCROLL_DELTA ?? "1400");

type SiteLocale = "en" | "he" | "de"; // תרחיבי ל-10 שפות אצלך

type SiteConfig = {
  locale: SiteLocale;
  allowedHosts: string[];
  acceptLanguage: string;
};

const SITE_CONFIG: Record<SiteLocale, SiteConfig> = {
  en: {
    locale: "en",
    allowedHosts: ["www.leonardo-hotels.com"],
    acceptLanguage: "en-GB,en;q=0.9",
  },
  he: {
    locale: "he",
    allowedHosts: ["www.leonardo-hotels.co.il"],
    acceptLanguage: "he-IL,he;q=0.9,en;q=0.8",
  },
  de: {
    locale: "de",
    allowedHosts: ["www.leonardo-hotels.de"],
    acceptLanguage: "de-DE,de;q=0.9,en;q=0.8",
  },
};

// --- פונקציית חומרה (מחוץ למחלקה) - סיווג קפדני ---
function getSeverity(issue: Issue): "Critical" | "Warning" {
  const r = (issue.reason || "").toLowerCase();
  const k = issue.kind;
    // 2.5 Critical: indexing blocked
  if (r.includes("[indexing]") || r.includes("blocks indexing")) return "Critical";

  // 1. Critical: page not found / fetch / inference
  if (r.includes("page not found") || r.includes("fetch failed") || r.includes("inference_error")) return "Critical";

  // 2. Critical: missing meta title (SEO)
  if (r.includes("missing <title>")) return "Critical";

  if (r.startsWith("[schema-gap]")) return "Critical";
    if (r.startsWith("[meta-mismatch]")) return "Critical";


  // 3. GPT-based severity
  if (k === "gpt") {
    if (r.includes("missing in schema") || r.includes("not found in dom")) return "Critical";
  }

  // Everything else -> Warning
  return "Warning";
}

export class FaqAuditFromWebJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  // -----------------------------------------------------------
  // ENTRY
  // -----------------------------------------------------------
  async run(opts: {
  countryUrl: string;
  sheetTitle: string;
  locale: SiteLocale;
  shareResults?: boolean;
}): Promise<{
    spreadsheetId: string;
    hotelsProcessed: number;
    hotelsWithFaq: number;
    hotelsWithProblems: number;
  }> {
const cfg = SITE_CONFIG[opts.locale];
const hotels = await this.collectHotels(opts.countryUrl, cfg);
console.log("DEBUG hotels:", hotels.map(h => ({ name: h.name, faqUrl: h.faqUrl })));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

    const spreadsheetId = await this.sheets.createSpreadsheet(opts.sheetTitle);
    
    // הגדרת שני הגליונות: Critical ו-Full Report
    const firstTabTitle = await this.sheets.getFirstSheetTitle(spreadsheetId);
    await this.sheets.renameSheet(spreadsheetId, firstTabTitle, "Critical Issues");
    await this.sheets.duplicateSheet(spreadsheetId, 0, "Hotels Summary");

    console.log("📄 Google Sheet:", `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

    // כותרות מעודכנות (כולל H1 ועמודות מספרים)
 const headers = [
  "Hotel", "FAQ Link", "Status", "Severity", "Kind",
  "DOM Items", "Schema Items", "Gap Diff",
  "Schema-only Questions (not in DOM)",
  "Schema-only Answers (not in DOM)",
  "DOM-only Questions (not in Schema)",
  "DOM-only Answers (not in Schema)",
  "Question", "Answer", "Reason",
  "H1 Tag", "Meta title", "Meta description"
];
    
    const criticalRows: string[][] = [headers];
    const fullReportRows: string[][] = [headers];
    const summaryHeaders = [
  "Hotel",
  "FAQ Link",
  "Status",
  "DOM Items",
  "Schema Items",
  "Gap Diff",
  "H1 Tag",
  "Meta title",
  "Meta description",
  "Notes",
];

const summaryRows: string[][] = [summaryHeaders]; 

    let hotelsWithFaq = 0;
    let hotelsWithProblems = 0;

    for (const h of hotels) {
      // 1. בדיקת לינק
  if (!h.faqUrl) {
  const row = [
    h.name, "", "✗ FAQ page not found", "Critical", "link",
    "0", "0", "0",
    "", "", // Schema-only Q/A
    "", "", // DOM-only Q/A
    "", "", // Question/Answer
    "Page not found",
    "", "", ""
  ];

  criticalRows.push(row);
  fullReportRows.push(row);

  summaryRows.push([
    h.name, "",
    "✗ FAQ page not found",
    "0", "0", "0",
    "", "", "",
    "Page not found",
  ]);

  continue;
}
      hotelsWithFaq++;

      // 2. שליפת תוכן (משתמש בלוגיקה המקורית)
      let html = "";
      let collected: QA[] = [];
      try {
        console.log(`➡️ START fetch FAQ: ${h.name}`);
const res = await this.fetchFaqDomAndQAs(h.faqUrl, cfg);
console.log(`✅ DONE fetch FAQ: ${h.name} | QAs: ${res.qas.length}`);
        html = res.html;
        collected = res.qas;
      } catch (e) {
         console.error("❌ Fetch failed for:", h.name);
  console.error("   URL:", h.faqUrl);
  console.error("   ERROR:", e);
  console.error("   MSG:", errMsg(e));
  if (e instanceof Error && e.stack) {
    console.error("   STACK:", e.stack);
  }
const row = [
    h.name, h.faqUrl ?? "", "✗ Fetch failed", "Critical", "network",
    "0", "0", "0",
    "", "", // Schema-only Q/A
    "", "", // DOM-only Q/A
    "", "", // Question/Answer
    errMsg(e),
    "", "", ""
  ];
      criticalRows.push(row);
  fullReportRows.push(row);

  summaryRows.push([
    h.name, h.faqUrl ?? "",
    "✗ Fetch failed",
    "0", "0", "0",
    "", "", "",
    errMsg(e),
  ]);

  continue;
}
     
      // 3. חילוץ H1
      const $ = cheerio.load(html);
      const h1Text = $("h1").first().text().trim() || "(Missing H1)";

      // 4. חילוץ שאלות מה-DOM
      const groups = collected.length
        ? [{ label: "FAQ (DOM)", items: collected }]
        : this.extractFAQFromDOM(html);
      const allQAs = groups.flatMap(g => g.items);
      const domCount = allQAs.length;

      // אם הדף ריק משאלות
      if (domCount === 0) {
const row = [
    h.name, h.faqUrl ?? "", "✗ No Q/A found", "Critical", "content",
    "0", "0", "0",
    "", "", // Schema-only Q/A
    "", "", // DOM-only Q/A
    "", "", // Question/Answer
    "Parse error / Empty",
    h1Text, "", ""
  ];
        criticalRows.push(row);
  fullReportRows.push(row);

  summaryRows.push([
    h.name, h.faqUrl ?? "",
    "✗ No Q/A found",
    "0", "0", "0",
    h1Text, "", "",
    "Parse error / Empty",
  ]);

  continue;
}

      // 5. בדיקות סכמה ו-SEO
      const { issues: seoIssues, schemaQAs, metaTitle, metaDescription } = validateMetaAndFaqSchema(html);
      const normQ = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

const domQSet = new Set(allQAs.map(x => normQ(x.q)));
const schemaOnly = schemaQAs.filter(x => !domQSet.has(normQ(x.q)));
const schemaQSet = new Set(schemaQAs.map(x => normQ(x.q)));
const domOnly = allQAs.filter(x => !schemaQSet.has(normQ(x.q)));


const schemaOnlyQuestions = schemaOnly.map((x, i) => `${i + 1}. ${x.q}`).join("\n");
const schemaOnlyAnswers = schemaOnly.map((x, i) => `${i + 1}. ${x.a}`).join("\n");

const domOnlyQuestions = domOnly.map((x, i) => `${i + 1}. ${x.q}`).join("\n");
const domOnlyAnswers = domOnly.map((x, i) => `${i + 1}. ${x.a}`).join("\n");
      const schemaCount = schemaQAs.length;
      
      // חישוב הפער (מספרים)
      const gapDiff = schemaCount - domCount; 

      const schemaOnlyCount = schemaOnly.length;
const domOnlyCount = domOnly.length;

if (schemaOnlyCount > 0 || domOnlyCount > 0) {
  const examplesSchemaOnly = schemaOnly.slice(0, 3).map(x => `"${x.q}"`).join(", ");
  const examplesDomOnly = domOnly.slice(0, 3).map(x => `"${x.q}"`).join(", ");

const row = [
  h.name,
  h.faqUrl,
  "✗ Issue",
  "Critical",
  "rule",
  String(domCount),
  String(schemaCount),
  String(schemaCount - domCount),

  schemaOnlyQuestions || "",
  schemaOnlyAnswers || "",

  domOnlyQuestions || "",
  domOnlyAnswers || "",

  "",  // Question
  "",  // Answer
  `[schema-gap] schemaOnly=${schemaOnlyCount} (examples: ${examplesSchemaOnly || "n/a"}), domOnly=${domOnlyCount} (examples: ${examplesDomOnly || "n/a"})`,
  h1Text,
  metaTitle || "",
  metaDescription || ""
];

criticalRows.push(row);
fullReportRows.push(row);

}

  
      
      // ניתוח הפערים
      const gapIssues = this.analyzeSchemaGap(allQAs, schemaQAs);

      // איחוד פערים לשורת סיכום אחת (Anti-Spam)
      const aggregatedIssues: Issue[] = [];

      // סיכום חסרים בסכמה
      const missingInSchema = gapIssues.filter(i => i.reason.includes("MISSING in Schema"));
      if (missingInSchema.length > 0) {
        // מציג עד 3 דוגמאות בתוך ה-Reason
        const examples = missingInSchema.slice(0, 3).map(i => `"${i.q}"`).join(", ");
        aggregatedIssues.push({
          kind: "rule",
          q: "--- Gap Summary ---",
          a: "",
          reason: `[schema-gap] ${missingInSchema.length} questions visible on page but MISSING in Schema. Examples: ${examples}...`,
          index: -1
        });
      }

      // סיכום חסרים בדף (Ghost)
      const missingInDom = gapIssues.filter(i => i.reason.includes("NOT found in DOM"));
      if (missingInDom.length > 0) {
        aggregatedIssues.push({
          kind: "rule",
          q: "--- Gap Summary ---",
          a: "",
          reason: `[schema-gap] ${missingInDom.length} questions in Schema but NOT on page (Hidden?).`,
          index: -1
        });
      }

      // אם חסר H1 - נוסיף ISSUE כדי שיופיע ברשימה (בנוסף לעמודה)
      if (h1Text === "(Missing H1)") {
        aggregatedIssues.push({ kind: "rule", q: "", a: "", reason: "[meta] Missing <h1> tag", index: -1 });
      }

      

     const hasCriticalGap = (schemaOnly.length > 0 || domOnly.length > 0);
// אם יש לך meta mismatch - תשלבי גם אותו כאן
const hasIssues = hasCriticalGap;

      summaryRows.push([
  h.name,
  h.faqUrl,
  hasIssues ? "✗ Issues found" : "V Clean",
  String(domCount),
  String(schemaCount),
  String(gapDiff),
  h1Text,
  metaTitle || "",
  metaDescription || "",
  hasIssues ? "See Full Audit Report for details" : "No issues found",
]);

      // שורה למלון תקין (Clean Row) - נכנסת תמיד לדוח המלא!
      if (!hasIssues) {
        fullReportRows.push([
  h.name, h.faqUrl, "V Clean", "Info", "",
  String(domCount), String(schemaCount), String(gapDiff),
  schemaOnlyQuestions || "",
  schemaOnlyAnswers || "",
  "", "", "No issues found",
  h1Text, metaTitle || "", metaDescription || ""
]);
      } else {
        const allIssues: Issue[] = [];
        // אם יש בעיות, עוברים עליהן
        for (const it of allIssues) {
          const severity = getSeverity(it);
          
          let qShort = it.q.replace(/\s+/g, " ").slice(0, 500);
          let aShort = it.a.replace(/\s+/g, " ").slice(0, 500);
          const reasonStr = (it.reason ?? "").replace(/^ —\s*/, "");

          const row = [
            h.name,
            h.faqUrl,
            "✗ Issue",
            severity,
            it.kind,
            String(domCount),    // עמודה חדשה: כמה בדף
            String(schemaCount), // עמודה חדשה: כמה בסכמה
            String(gapDiff),     // עמודה חדשה: הפער
schemaOnlyQuestions || "",
  schemaOnlyAnswers || "",
  // Question
  domOnlyQuestions ? `--- DOM-only (Missing in Schema) ---\n${domOnlyQuestions}` : "--- DOM-only (Missing in Schema) ---",

  // Answer
  domOnlyAnswers ? `--- DOM-only Answers ---\n${domOnlyAnswers}` : "",
            qShort,
            aShort,
            reasonStr,
            h1Text,              // עמודה חדשה: H1
            (it.kind === "rule" && it.reason.startsWith("[meta]")) ? "" : (metaTitle || ""),
            (it.kind === "rule" && it.reason.startsWith("[meta]")) ? "" : (metaDescription || "")
          ];

          // הכל הולך לדוח המלא
          fullReportRows.push(row);

          // רק קריטי הולך לדוח הקריטי
          if (severity === "Critical") {
            criticalRows.push(row);
          }
        }
      }
    } // סיום לולאת המלונות

    // כתיבה לשיטס
    await this.sheets.writeValues(spreadsheetId, "Critical Issues!A1", criticalRows);
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Critical Issues");
    
   
    await this.sheets.writeValues(spreadsheetId, "Hotels Summary!A1", summaryRows);
await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Hotels Summary");

    return {
      spreadsheetId,
      hotelsProcessed: hotels.length,
      hotelsWithFaq,
      hotelsWithProblems,
    };
  }

  // בדיקה משווה בין מה שנמצא בדף (DOM) לבין מה שבסכמה
  private analyzeSchemaGap(domQAs: QA[], schemaQAs: QA[]): Issue[] {
    const issues: Issue[] = [];
    
    // מנרמלים להשוואה קלה
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    
    const domSet = new Set(domQAs.map(i => norm(i.q)));
    const schemaSet = new Set(schemaQAs.map(i => norm(i.q)));

    // 1. מה יש בדף אבל חסר בסכמה?
    for (const d of domQAs) {
      if (!schemaSet.has(norm(d.q))) {
        issues.push({
          kind: "rule",
          q: d.q,
          a: "(Exists in DOM)",
          reason: "[schema-gap] Question visible on page but MISSING in Schema",
          index: -1
        });
      }
    }

    // 2. מה יש בסכמה אבל לא נמצא בדף (Ghost)?
    for (const s of schemaQAs) {
      if (!domSet.has(norm(s.q))) {
        issues.push({
          kind: "rule",
          q: s.q,
          a: "(Exists in Schema)",
          reason: "[schema-gap] Question in Schema but NOT found in DOM content",
          index: -1
        });
      }
    }

    return issues;
  }
  
  // -----------------------------------------------------------
  // איסוף מלונות מעמוד מדינה + וידוא שיוך לעיר (לוגיקה מקורית)
  // -----------------------------------------------------------
private async collectHotels(countryUrl: string, cfg: SiteConfig): Promise<HotelItem[]> {  
    const html = await this.fetchText(countryUrl, false, cfg);
    const $ = cheerio.load(html);

    let $scope = $("main");
    if ($scope.length === 0) {
      $scope = $("body").clone();
      $scope.find("header, nav, footer, .site-header, .site-footer, [role='navigation']").remove();
    }

    const hotelLinks = new Set<string>();
    const cityLinks = new Set<string>();

    // 1) איסוף לינקים מעמוד המדינה
    $scope.find("a[href]").each((_, el) => {
      const hrefRaw = ($(el).attr("href") || "").trim();
      if (!hrefRaw) return;

      const href = this.makeAbsolute(countryUrl, hrefRaw);
try {
  const host = new URL(href).host;
  if (!cfg.allowedHosts.includes(host)) return;
} catch {
  return;
}
      if (/\/(brand|advantage|club|loyalty|offers?)\/?$/i.test(href)) return;

      try {
        const u = new URL(href);
        const segs = u.pathname.split("/").filter(Boolean);
        const clean = href.replace(/#.*$/, "").replace(/\/$/, "");

        if (segs.length >= 2) {
const baseHotel = this.normalizeHotelBaseUrl(clean, cfg);
          if (baseHotel) hotelLinks.add(baseHotel);
          return;
        }

        if (segs.length === 1) {
          const countrySeg = new URL(countryUrl).pathname.split("/").filter(Boolean)[0]?.toLowerCase();
          if (countrySeg && segs[0].toLowerCase() === countrySeg) return;
          cityLinks.add(clean);
        }
      } catch { /* ignore */ }
    });

    // 2) כניסה לכל עמוד עיר
    for (const cityUrl of cityLinks) {
      try {
        const cityHtml = await this.fetchText(cityUrl, false, cfg);
        const $$ = cheerio.load(cityHtml);

        let $cityScope = $$("main");
        if ($cityScope.length === 0) $cityScope = $$("body");

        $cityScope.find("a[href]").each((_, a) => {
          const hrefRaw = ($$(a).attr("href") || "").trim();
          if (!hrefRaw) return;

          const href = this.makeAbsolute(cityUrl, hrefRaw);
try {
  const host = new URL(href).host;
  if (!cfg.allowedHosts.includes(host)) return;
} catch {
  return;
}
          if (/\/(brand|advantage|club|loyalty|offers?)\/?$/i.test(href)) return;

          try {
            const u = new URL(href);
            const segs = u.pathname.split("/").filter(Boolean);
            if (segs.length >= 2) {
                const cleanHotel = href.replace(/#.*$/, "").replace(/\/$/, "");
const baseHotel = this.normalizeHotelBaseUrl(cleanHotel, cfg);
                if (baseHotel) hotelLinks.add(baseHotel);
            }
          } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    }

    // 3) וידוא ערים
    const countryCities = new Set<string>();
    for (const url of hotelLinks) {
      try {
        const seg = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
        if (seg) countryCities.add(seg.toLowerCase());
      } catch { /* ignore */ }
    }

    console.log("🏙️ City pages found:", cityLinks.size);
    console.log("🔎 Hotel links found (country + cities):", hotelLinks.size);

    const hotels: HotelItem[] = [];
    for (const url of hotelLinks) {
      const belongs = await this.validateHotelByCities(url, countryCities, cfg);
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

private async validateHotelByCities(hotelUrl: string, cities: Set<string>, cfg: SiteConfig): Promise<boolean> {
      try {
      const segs = new URL(hotelUrl).pathname.split("/").filter(Boolean);
      if (segs.length > 0 && cities.has(segs[0].toLowerCase())) return true;

     const html = await this.fetchText(hotelUrl, false, cfg);
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
        ".accordion-item", ".accordion__item", ".faq-item", ".faq__item",
        "[data-faq-item]", "[data-accordion-item]", "details", "dl",
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

        // 3) aria-controls mapping
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
            a = $el.clone()
              .find("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]")
              .remove().end().text().trim();
          }
          if (q && a) { out.push({ q, a }); return; }
        }

        // 4) גנרי
        q = $el.find("summary, h2, h3, h4, button, .question, [data-question]").first().text().trim() ||
            $el.find("[role=button]").first().text().trim();

        a = $el.find(".answer, .accordion-body, .accordion__panel, [data-answer]").first().text().trim();

        if (!a) {
          a = $el.clone()
            .find("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]")
            .remove().end().text().trim();
        }

        if (q && a) out.push({ q, a });
      });

      if (out.length) return out;
    }

    // fallback: H3/H4
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
  "Flag issues with clear CATEGORY TAGS so we can classify severity:",
  "",
  "1) [unrelated] - the answer does not address the question at all (different topic).",
  "2) [partial] - the answer is relevant but misses a key required detail explicitly asked in the question (e.g., asks price but answer doesn't include price).",
  "3) [contradiction] - the answer contradicts the question's premise or contains a direct contradiction.",
  "4) [grammar-hard] - severe grammar issues that make the answer hard to understand.",
  "5) [spelling] - obvious spelling mistakes.",
  "6) [grammar] - minor grammar mistakes (not severe).",
  "",
  "Return ONLY valid JSON with entries shaped as:",
  '{"issues":[{"index":number,"reason":string}]}',
  "The 'index' is 0-based within this batch.",
  "",
  "Examples of reason:",
  "- [unrelated] answer talks about check-in but the question is about parking cost",
  "- [partial] mentions parking exists but does not mention the cost",
  "- [contradiction] says pets are allowed but also says pets are not allowed",
  "- [grammar-hard] sentence is broken and hard to understand",
  "- [spelling] accomodation -> accommodation",
  "- [grammar] minor verb agreement issue",
].join(" ");

    const user = `List:\n${list}\n\nReturn ONLY JSON as specified.`;

    let raw = "";
    try {
      raw = await this.agent.runWithSystem(user, system, "o3");
    } catch {
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
private async fetchFaqDomAndQAs(url: string, cfg: SiteConfig): Promise<{ html: string; qas: QA[] }> {
      if (process.env.FAQ_AUDIT_RENDER === "1") {
      console.log(`   🌐 Opening page: ${url}`);
        const mod: any = await (Function("return import('playwright')")() as Promise<any>);
      const channel = process.env.FAQ_AUDIT_PLAYWRIGHT_CHANNEL;
      const browser = await mod.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      const page = await browser.newPage();

      // ⬇️ הוספה קריטית
      await page.addInitScript({
        content: "window.__name = (o, n) => o;"
      });

page.setDefaultNavigationTimeout(60_000);
page.setDefaultTimeout(60_000);

await page.setExtraHTTPHeaders({ "accept-language": cfg.acceptLanguage });
await page.setViewportSize({ width: 1365, height: 900 });

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
console.log(`   📄 Page loaded: ${url}`);
// Anchor on stable DOM, not on "networkidle"
await page.waitForSelector("main, body", { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(250);

      // 1) לפתוח טאבס
      const tabSelectors = [
        "[role=tab]", "[data-bs-toggle='tab']", "[data-toggle='tab']",
        ".nav-tabs a[href^='#']", ".tabs a[href^='#']", ".c-tabs a[href^='#']", ".faq__tabs a[href^='#']",
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
        "summary", ".accordion-button", ".accordion__button",
        ".accordion__header button", ".accordion-header button",
        "[data-accordion-trigger]", "[data-faq-item] button", "[aria-controls]",
      ];
      for (const sel of accSelectors) {
        const loc = page.locator(sel);
        const count = await loc.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          try { await loc.nth(i).click({ force: true }); await page.waitForTimeout(Math.max(60, CLICK_PAUSE_MS / 2)); } catch { }
        }
      }

      // 3) להכריח פתיחה של פאנלים
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

      // 5) לנסות "Load more"
      const moreSelectors = [
        "button:has-text('Load more')", "button:has-text('Show more')", "button:has-text('View all')",
        "button:has-text('See more')", "a:has-text('Load more')", "a:has-text('Show more')",
        "[data-load-more]", ".load-more, .js-load-more",
      ];
      for (const sel of moreSelectors) {
        for (let i = 0; i < LOADMORE_CYCLES; i++) {
          const el = page.locator(sel).first();
          if (!(await el.isVisible().catch(() => false))) break;
          try {
            await el.click({ force: true });
            await page.waitForTimeout(500);
            await page.waitForTimeout(250);
          } catch { }
        }
      }
      for (let y = 0; y < SCROLL_STEPS; y++) { await page.mouse.wheel(0, SCROLL_DELTA); await page.waitForTimeout(100); }
      await page.waitForTimeout(500);

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

      // 7) איסוף “נגיש”
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
    const html = await this.fetchText(url, true, cfg);
    return { html, qas: [] };
  }

 private async fetchText(url: string, isFaq = false, cfg?: SiteConfig): Promise<string> {
    if (process.env.FAQ_AUDIT_RENDER === "1") {
      const mod: any = await (Function("return import('playwright')")() as Promise<any>);
      const channel = process.env.FAQ_AUDIT_PLAYWRIGHT_CHANNEL;
      const browser = await mod.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      const page = await browser.newPage();

      await page.addInitScript({
        content: "window.__name = (o, n) => o;"
      });

      console.log("🧭 Render mode: Playwright", channel ? `(channel: ${channel})` : "");
page.setDefaultNavigationTimeout(60_000);
page.setDefaultTimeout(60_000);

// Make the browser look more like a real user session
await page.setExtraHTTPHeaders({ "accept-language": (cfg?.acceptLanguage ?? "en-GB,en;q=0.9") });
await page.setViewportSize({ width: 1365, height: 900 });

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

// Anchor on a stable element instead of networkidle
await page.waitForSelector("main, body", { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(250);
      if (isFaq) {
        const tabSelectors = [
          "[role=tab]", "[data-bs-toggle='tab']", ".nav-tabs a[href^='#']",
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
      headers: { "user-agent": "Mozilla/5.0 FaqAuditBot", "accept-language": (cfg?.acceptLanguage ?? "en-GB,en;q=0.9") },
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

private normalizeHotelBaseUrl(rawUrl: string, cfg: SiteConfig): string | null {
      try {
      const u = new URL(rawUrl);
if (!cfg.allowedHosts.includes(u.host)) return null;
      const segs = u.pathname.split("/").filter(Boolean);
      if (segs.length < 2) return null;

      const city = segs[0];
      const hotel = segs[1];

      // Guard בסיסי
      if (/^(reviews|offers?|brand|advantage|club|loyalty)$/i.test(hotel)) return null;

      return `${u.origin}/${city}/${hotel}`;
    } catch {
      return null;
    }
  }
}