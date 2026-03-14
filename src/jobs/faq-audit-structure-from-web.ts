// src/jobs/faq-audit-structure-from-web.ts
// -------------------------------------------------------------
// Audit "Structure Only":
// 1) Same crawler/scraper logic as faq-audit-from-web (Playwright/Cheerio).
// 2) No GPT checks. Only deterministic checks:
//    - DOM vs Schema gaps
//    - Schema issues (invalid/missing FAQPage etc.)
//    - Tags vs URL mismatch (best-effort tag extraction + URL parsing)
// 3) Output: Critical Issues + Full Audit Report + Hotels Summary
// -------------------------------------------------------------

import * as cheerio from "cheerio";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";
import { validateMetaAndFaqSchema } from "../jobs/subjobs/faq-seo-checks.js";

type QA = { q: string; a: string };
type HotelItem = { name: string; faqUrl: string | null };

type RuleIssue = { kind: "rule"; q: string; a: string; reason: string; index: number };
type Issue = RuleIssue;

const CLICK_PAUSE_MS = Number(process.env.FAQ_AUDIT_CLICK_PAUSE_MS ?? "120");
const LOADMORE_CYCLES = Number(process.env.FAQ_AUDIT_LOADMORE_CYCLES ?? "8");
const SCROLL_STEPS = Number(process.env.FAQ_AUDIT_SCROLL_STEPS ?? "12");
const SCROLL_DELTA = Number(process.env.FAQ_AUDIT_SCROLL_DELTA ?? "1400");

type SiteLocale = "en" | "he" | "de";

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

function getSeverity(issue: Issue): "Critical" | "Warning" {
  const r = (issue.reason || "").toLowerCase();

  if (r.includes("[indexing]") || r.includes("blocks indexing")) return "Critical";

  // Schema errors are critical
  if (r.startsWith("[schema]")) return "Critical";

  // DOM vs Schema gaps are critical (you can downgrade to Warning if needed)
  if (r.startsWith("[schema-gap]")) return "Critical";

  // Tag mismatch - treat as critical (or Warning, depends on your preference)
  if (r.startsWith("[tag-url]")) return "Critical";

  if (r.startsWith("[hotel-url]")) return "Critical";

  if (r.startsWith("[schema-gap]")) {
  if (r.includes("near-match")) return "Warning";
  return "Critical";
}

  return "Warning";
}

export class FaqAuditStructureFromWebJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

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

    const spreadsheetId = await this.sheets.createSpreadsheet(opts.sheetTitle);

    const firstTabTitle = await this.sheets.getFirstSheetTitle(spreadsheetId);
    await this.sheets.renameSheet(spreadsheetId, firstTabTitle, "Critical Issues");
    await this.sheets.duplicateSheet(spreadsheetId, 0, "Full Audit Report");
    await this.sheets.duplicateSheet(spreadsheetId, 0, "Hotels Summary");

   const headers = [
  "Hotel",
  "FAQ Link",
  "Status",
  "Severity",
  "Kind",
  "DOM Items",
  "Schema Items",
  "Gap Diff",
  "Schema-only Questions (not in DOM)",
  "Schema-only Answers (not in DOM)",
  "Detected Tags",
  "URL Tag Hint",
  "Tag-URL Match",
  "Reason",
  "H1 Tag",
  "Meta title",
  "Meta description",
  "Hotel Slug (from URL)",
  "Hotel-URL Match",
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
  "Detected Tags",
  "URL Tag Hint",
  "Tag-URL Match",
  "H1 Tag",
  "Meta title",
  "Meta description",
  "Notes",
  "Hotel Slug (from URL)",
  "Hotel-URL Match",
];
    const summaryRows: string[][] = [summaryHeaders];

    let hotelsWithFaq = 0;
    let hotelsWithProblems = 0;

    for (const h of hotels) {
      if (!h.faqUrl) {
        const row = [
          h.name,
          "",
          "✗ FAQ page not found",
          "Critical",
          "link",
          "0",
          "0",
          "0",
          "",
          "",
          "",
          "",
          "",
          "Page not found",
          "",
          "",
          "",
          "",
"",
        ];
        criticalRows.push(row);
        fullReportRows.push(row);
        summaryRows.push([
          h.name,
          "",
          "✗ FAQ page not found",
          "0",
          "0",
          "0",
          "",
          "",
          "",
          "",
          "",
          "",
          "Page not found",
          "",
  "",
        ]);
        continue;
      }

      hotelsWithFaq++;

      let html = "";
      let collected: QA[] = [];
      try {
        const res = await this.fetchFaqDomAndQAs(h.faqUrl, cfg);
        html = res.html;
        collected = res.qas;
      } catch (e) {
        const msg = (e as Error).message;
        const row = [
          h.name,
          h.faqUrl,
          "✗ Fetch failed",
          "Critical",
          "network",
          "0",
          "0",
          "0",
          "",
          "",
          "",
          "",
          "",
          msg,
          "",
          "",
          "",
        ];
        criticalRows.push(row);
        fullReportRows.push(row);
        summaryRows.push([
          h.name,
          h.faqUrl,
          "✗ Fetch failed",
          "0",
          "0",
          "0",
          "",
          "",
          "",
          "",
          "",
          "",
          msg,
        ]);
        continue;
      }

      const $ = cheerio.load(html);

      const h1Text = $("h1").first().text().trim() || "(Missing H1)";

      // DOM QAs
     // Always parse DOM from rendered HTML, and also take evaluate-collected QAs if present.
// Then merge + dedupe.
const domFromHtmlGroups = this.extractFAQFromDOM(html);
const domFromHtml = domFromHtmlGroups.flatMap((g) => g.items);

const allQAs = this.dedupeQAs([...(collected || []), ...domFromHtml]);
const domCount = allQAs.length;

      if (domCount === 0) {
        const row = [
          h.name,
          h.faqUrl,
          "✗ No Q/A found",
          "Critical",
          "content",
          "0",
          "0",
          "0",
          "",
          "",
          "",
          "",
          "",
          "Parse error / Empty",
          h1Text,
          "",
          "",
        ];
        criticalRows.push(row);
        fullReportRows.push(row);
        summaryRows.push([
          h.name,
          h.faqUrl,
          "✗ No Q/A found",
          "0",
          "0",
          "0",
          "",
          "",
          "",
          h1Text,
          "",
          "",
          "Parse error / Empty",
        ]);
        continue;
      }

      // Schema + meta checks (existing function)
const { issues: seoIssues, schemaQAs, metaTitle, metaDescription } = validateMetaAndFaqSchema(html);
const issues: Issue[] = [];
const schemaIdentity = this.extractHotelNameFromSchema(html);

const hotelIdentity = this.evaluateHotelIdentityMatch({
  faqUrl: h.faqUrl,
  h1: h1Text,
  metaTitle,
  schemaName: schemaIdentity.name,
  schemaUrl: schemaIdentity.url,
  schemaId: schemaIdentity.id,
});

if (hotelIdentity.status === "mismatch") {
  issues.push({
    kind: "rule",
    q: "--- Hotel Identity ---",
    a: "",
    reason: `[hotel-url] ${hotelIdentity.reason}`,
    index: -1,
    
  });
}
      const schemaCount = schemaQAs.length;
      const gapDiff = schemaCount - domCount;

     const MIN_NEAR_MATCH = Number(process.env.FAQ_AUDIT_MIN_NEAR_MATCH ?? "0.82");

// Build fuzzy matches Schema -> DOM
const schemaToDomMatches = schemaQAs.map((s) => {
  const { hit, score } = this.findBestMatch(s.q, allQAs, MIN_NEAR_MATCH);
  return { schema: s, dom: hit, score };
});

const schemaOnly = schemaToDomMatches
  .filter((m) => !m.dom) // truly missing in DOM (no near-match)
  .map((m) => m.schema);

const nearMatches = schemaToDomMatches
  .filter((m) => m.dom) // matched
  .filter((m) => this.normalizeQuestion(m.schema.q) !== this.normalizeQuestion(m.dom!.q)) // not exact after normalize
  .sort((a, b) => a.score - b.score); // weakest matches first


      const schemaOnlyQuestions = schemaOnly.map((x, i) => `${i + 1}. ${x.q}`).join("\n");
      const schemaOnlyAnswers = schemaOnly.map((x, i) => `${i + 1}. ${x.a}`).join("\n");

      // Tag vs URL checks (best-effort)
      const detectedTags = this.extractFaqTags(html);
      const urlTagHint = this.extractTagHintFromUrl(h.faqUrl);
      const tagMatch = this.evaluateTagUrlMatch(detectedTags, urlTagHint);

      const tagMatchStr =
        tagMatch.status === "unknown"
          ? "Unknown"
          : tagMatch.status === "ok"
            ? "OK"
            : "Mismatch";

      // Build issues list: ONLY structure checks
      

      // 1) include schema-related issues as-is (filter to schema/indexing/meta if you want)
      // If you truly want ONLY schema problems + gaps + tag-url, you can filter meta issues out here.
      const structuralSeoIssues = seoIssues.filter((i) => {
        const r = i.reason || "";
        return r.startsWith("[schema]") || r.startsWith("[indexing]") || r.startsWith("[meta]");
      });

      issues.push(...structuralSeoIssues);

      // 2) DOM vs Schema gap issues (aggregated)
      const gapIssues = this.analyzeSchemaGap(allQAs, schemaQAs);
      const missingInSchema = gapIssues.filter((i) => i.reason.includes("MISSING in Schema"));
      if (missingInSchema.length > 0) {
        const examples = missingInSchema.slice(0, 3).map((i) => `"${i.q}"`).join(", ");
        issues.push({
          kind: "rule",
          q: "--- Gap Summary ---",
          a: "",
          reason: `[schema-gap] ${missingInSchema.length} questions visible on page but MISSING in Schema. Examples: ${examples}...`,
          index: -1,
        });
      }

      const missingInDom = gapIssues.filter((i) => i.reason.includes("NOT found in DOM"));
      if (missingInDom.length > 0) {
        issues.push({
          kind: "rule",
          q: "--- Gap Summary ---",
          a: "",
          reason: `[schema-gap] ${missingInDom.length} questions in Schema but NOT on page (Hidden?).`,
          index: -1,
        });
      }

    

      // 3) Tag-url mismatch
      if (tagMatch.status === "mismatch") {
        issues.push({
          kind: "rule",
          q: "",
          a: "",
          reason: `[tag-url] ${tagMatch.reason}`,
          index: -1,
        });
      }

      const hasIssues = issues.length > 0;
      if (hasIssues) hotelsWithProblems++;

      summaryRows.push([
        h.name,
        h.faqUrl,
        hasIssues ? "✗ Issues found" : "V Clean",
        String(domCount),
        String(schemaCount),
        String(gapDiff),
        detectedTags.join(", "),
        urlTagHint ?? "",
        tagMatchStr,
        h1Text,
        metaTitle || "",
        metaDescription || "",
        hasIssues ? "See Full Audit Report for details" : "No issues found",
        hotelIdentity.expectedSlug ?? "",
hotelIdentity.status === "ok" ? "OK" : hotelIdentity.status === "mismatch" ? "Mismatch" : "Unknown",
      ]);

      if (!hasIssues) {
        fullReportRows.push([
          h.name,
          h.faqUrl,
          "V Clean",
          "Info",
          "",
          String(domCount),
          String(schemaCount),
          String(gapDiff),
          schemaOnlyQuestions || "",
          schemaOnlyAnswers || "",
          detectedTags.join(", "),
          urlTagHint ?? "",
          tagMatchStr,
          "No issues found",
          h1Text,
          metaTitle || "",
          metaDescription || "",
          hotelIdentity.expectedSlug ?? "",
  hotelIdentity.status === "ok" ? "OK" : hotelIdentity.status === "mismatch" ? "Mismatch" : "Unknown",

        ]);
      } else {
        for (const it of issues) {
          const severity = getSeverity(it);
          const row = [
            h.name,
            h.faqUrl,
            "✗ Issue",
            severity,
            it.kind,
            String(domCount),
            String(schemaCount),
            String(gapDiff),
            schemaOnlyQuestions || "",
            schemaOnlyAnswers || "",
            detectedTags.join(", "),
            urlTagHint ?? "",
            tagMatchStr,
            (it.reason ?? "").toString(),
            h1Text,
            metaTitle || "",
            metaDescription || "",
            hotelIdentity.expectedSlug ?? "",
  hotelIdentity.status === "ok" ? "OK" : hotelIdentity.status === "mismatch" ? "Mismatch" : "Unknown",

          ];

          fullReportRows.push(row);
          if (severity === "Critical") criticalRows.push(row);
        }
      }
    }

    await this.sheets.writeValues(spreadsheetId, "Critical Issues!A1", criticalRows);
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Critical Issues");

    await this.sheets.writeValues(spreadsheetId, "Full Audit Report!A1", fullReportRows);
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Full Audit Report");

    await this.sheets.writeValues(spreadsheetId, "Hotels Summary!A1", summaryRows);
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Hotels Summary");

    return {
      spreadsheetId,
      hotelsProcessed: hotels.length,
      hotelsWithFaq,
      hotelsWithProblems,
    };
  }

  // -----------------------------------------------------------
  // DOM vs Schema diff
  // -----------------------------------------------------------
 private analyzeSchemaGap(domQAs: QA[], schemaQAs: QA[]): Issue[] {
  const issues: Issue[] = [];

  const MIN_NEAR_MATCH = Number(process.env.FAQ_AUDIT_MIN_NEAR_MATCH ?? "0.82");

  // DOM -> Schema: what is missing in schema?
  const domToSchema = domQAs.map((d) => {
    const { hit, score } = this.findBestMatch(d.q, schemaQAs, MIN_NEAR_MATCH);
    return { dom: d, schema: hit, score };
  });

  const missingInSchema = domToSchema.filter((m) => !m.schema);

  for (const m of missingInSchema) {
    issues.push({
      kind: "rule",
      q: m.dom.q,
      a: "(Exists in DOM)",
      reason: "[schema-gap] Question visible on page but MISSING in Schema",
      index: -1,
    });
  }

  // Schema -> DOM: what is missing in DOM?
  const schemaToDom = schemaQAs.map((s) => {
    const { hit, score } = this.findBestMatch(s.q, domQAs, MIN_NEAR_MATCH);
    return { schema: s, dom: hit, score };
  });

  const missingInDom = schemaToDom.filter((m) => !m.dom);

  for (const m of missingInDom) {
    issues.push({
      kind: "rule",
      q: m.schema.q,
      a: "(Exists in Schema)",
      reason: "[schema-gap] Question in Schema but NOT found in DOM content",
      index: -1,
    });
  }

  // Optional: report weak near-matches as Warning, not Critical
  // This helps you see "almost matches" without flagging as broken.
  const weakNear = schemaToDom
    .filter((m) => m.dom)
    .filter((m) => this.normalizeQuestion(m.schema.q) !== this.normalizeQuestion(m.dom!.q))
    .filter((m) => m.score < 0.9); // tweak

  for (const m of weakNear.slice(0, 10)) {
    issues.push({
      kind: "rule",
      q: m.schema.q,
      a: `(Near-match DOM: "${m.dom!.q}" | score=${m.score.toFixed(2)})`,
      reason: "[schema-gap] Near-match (wording differs) - consider aligning wording",
      index: -1,
    });
  }

  return issues;
}

  // -----------------------------------------------------------
  // Tags vs URL (best-effort)
  // Notes:
  // - If your FAQ tags are stored in specific selectors, add them here to be 100% accurate.
  // -----------------------------------------------------------
  private extractFaqTags(html: string): string[] {
    const $ = cheerio.load(html);

    const tags: string[] = [];

    // Heuristics - extend with your real DOM structure
    const selectors = [
      "[data-faq-tag]",
      "[data-tag]",
      ".faq-tag",
      ".faq-tags .tag",
      ".tags .tag",
      ".chip",
      ".chips .chip",
      "a[href*='tag=']",
      "a[href*='/tag/']",
    ];

    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const t1 = ($(el).attr("data-faq-tag") || "").trim();
        const t2 = ($(el).attr("data-tag") || "").trim();
        const txt = ($(el).text() || "").trim();

        const raw = t1 || t2 || txt;
        const clean = this.cleanTag(raw);
        if (clean) tags.push(clean);

        // If link contains tag=xxx
        const href = ($(el).attr("href") || "").trim();
        const tagFromHref = this.extractTagFromHref(href);
        if (tagFromHref) tags.push(tagFromHref);
      });
    }

    const uniq = Array.from(new Set(tags.map((t) => this.cleanTag(t)).filter(Boolean)));
    return uniq;
  }

  private extractTagFromHref(href: string): string | null {
    if (!href) return null;
    try {
      const u = href.startsWith("http") ? new URL(href) : new URL(href, "https://example.com");
      const qp = (u.searchParams.get("tag") || u.searchParams.get("tags") || "").trim();
      if (qp) return this.cleanTag(qp);
      const m = u.pathname.match(/\/tag\/([^/]+)/i);
      if (m?.[1]) return this.cleanTag(decodeURIComponent(m[1]));
      return null;
    } catch {
      // plain string fallback
      const m1 = href.match(/[?&](tag|tags)=([^&]+)/i);
      if (m1?.[2]) return this.cleanTag(decodeURIComponent(m1[2]));
      const m2 = href.match(/\/tag\/([^/]+)/i);
      if (m2?.[1]) return this.cleanTag(decodeURIComponent(m2[1]));
      return null;
    }
  }

  private extractTagHintFromUrl(pageUrl: string): string | null {
    try {
      const u = new URL(pageUrl);
      const qp = (u.searchParams.get("tag") || u.searchParams.get("tags") || "").trim();
      if (qp) return this.cleanTag(qp);

      // /faq/<tag> or /faq?tag=
      const segs = u.pathname.split("/").filter(Boolean);
      const faqIdx = segs.findIndex((s) => s.toLowerCase() === "faq");
      if (faqIdx >= 0 && segs.length > faqIdx + 1) {
        return this.cleanTag(decodeURIComponent(segs[faqIdx + 1]));
      }

      return null;
    } catch {
      return null;
    }
  }

  private evaluateTagUrlMatch(tags: string[], urlTagHint: string | null): { status: "ok" | "mismatch" | "unknown"; reason: string } {
    // If URL doesn't imply a tag and we can't find tags, we can't validate
    if (!urlTagHint) {
      if (!tags.length) return { status: "unknown", reason: "No URL tag hint and no tags detected" };
      return { status: "unknown", reason: "No URL tag hint (page may not be tag-filtered)" };
    }

    // URL implies a tag, but no tags detected
    if (!tags.length) {
      return { status: "mismatch", reason: `URL implies tag "${urlTagHint}" but no tags detected in DOM` };
    }

    const slug = this.slugify(urlTagHint);
    const tagSlugs = tags.map((t) => this.slugify(t));

    if (tagSlugs.includes(slug)) return { status: "ok", reason: "Tag matches URL hint" };

    return {
      status: "mismatch",
      reason: `URL implies tag "${urlTagHint}" but detected tags are: ${tags.join(", ")}`,
    };
  }

  private cleanTag(s: string): string {
    const t = (s || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    // remove very short garbage
    if (t.length < 2) return "";
    return t;
  }

  private slugify(s: string): string {
    return (s || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\u0590-\u05FF]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private extractHotelSlugFromFaqUrl(faqUrl: string): string | null {
  try {
    const u = new URL(faqUrl);
    const segs = u.pathname.split("/").filter(Boolean);

    // expected: /<city>/<hotel-slug>/faq
    const faqIdx = segs.findIndex((s) => s.toLowerCase() === "faq");
    if (faqIdx >= 2) return segs[faqIdx - 1]; // hotel slug
    if (segs.length >= 2) return segs[segs.length - 2]; // fallback
    return null;
  } catch {
    return null;
  }
}

private extractHotelNameFromSchema(html: string): { name?: string; url?: string; id?: string } {
  const $ = cheerio.load(html);
  const scripts = $("script[type='application/ld+json']");
  for (const el of scripts.toArray()) {
    const raw = $(el).text().trim();
    if (!raw) continue;

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }

    const nodes: any[] = Array.isArray(json) ? json : [json];

    for (const n of nodes) {
      const type = n?.["@type"];
      const isFaq =
        type === "FAQPage" ||
        (Array.isArray(type) && type.map((x: any) => String(x)).includes("FAQPage"));

      if (!isFaq) continue;

      const name = typeof n?.name === "string" ? n.name : undefined;
      const url =
        typeof n?.url === "string"
          ? n.url
          : typeof n?.mainEntityOfPage === "string"
            ? n.mainEntityOfPage
            : typeof n?.mainEntityOfPage?.["@id"] === "string"
              ? n.mainEntityOfPage["@id"]
              : undefined;

      const id = typeof n?.["@id"] === "string" ? n["@id"] : undefined;

      return { name, url, id };
    }
  }
  return {};
}

private evaluateHotelIdentityMatch(opts: {
  faqUrl: string;
  h1: string;
  metaTitle?: string;
  schemaName?: string;
  schemaUrl?: string;
  schemaId?: string;
}): { status: "ok" | "mismatch" | "unknown"; reason: string; expectedSlug?: string } {
  const expectedSlug = this.extractHotelSlugFromFaqUrl(opts.faqUrl);
  if (!expectedSlug) return { status: "unknown", reason: "Could not derive hotel slug from URL" };

  const expected = this.slugify(expectedSlug);

  // Candidate strings from page
  const candidates = [
    opts.h1,
    opts.metaTitle || "",
    opts.schemaName || "",
  ].map((s) => (s || "").trim()).filter(Boolean);

  if (!candidates.length) {
    return { status: "unknown", reason: `No identity candidates found (H1/meta/schema name empty)`, expectedSlug };
  }

  const hit = candidates.some((c) => this.slugify(c).includes(expected) || expected.includes(this.slugify(c)));
  if (!hit) {
    return {
      status: "mismatch",
      expectedSlug,
      reason: `Hotel slug "${expectedSlug}" does not match H1/meta/schema name candidates: ${candidates.join(" | ")}`,
    };
  }

  // Optional: schema url/id consistency with current page url
  const pageUrl = opts.faqUrl.replace(/\/$/, "");
  const schemaUrl = (opts.schemaUrl || "").replace(/\/$/, "");
  const schemaId = (opts.schemaId || "").replace(/\/$/, "");

  if (schemaUrl && schemaUrl !== pageUrl) {
    return {
      status: "mismatch",
      expectedSlug,
      reason: `Schema url/mainEntityOfPage differs from page URL. schema="${schemaUrl}" page="${pageUrl}"`,
    };
  }
  if (schemaId && schemaId !== pageUrl && !schemaId.startsWith(pageUrl + "#")) {
    return {
      status: "mismatch",
      expectedSlug,
      reason: `Schema @id differs from page URL. @id="${schemaId}" page="${pageUrl}"`,
    };
  }

  return { status: "ok", expectedSlug, reason: "Hotel identity matches URL slug" };
}


  // -----------------------------------------------------------
  // Collect hotels (same as original)
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
      } catch {
        /* ignore */
      }
    });

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
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* ignore */
      }
    }

    const countryCities = new Set<string>();
    for (const url of hotelLinks) {
      try {
        const seg = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
        if (seg) countryCities.add(seg.toLowerCase());
      } catch {
        /* ignore */
      }
    }

    const hotels: HotelItem[] = [];
    for (const url of hotelLinks) {
      const belongs = await this.validateHotelByCities(url, countryCities, cfg);
      if (!belongs) continue;

      const faqUrlCandidate = `${url}/faq`;
      const ok = await this.headOk(faqUrlCandidate);

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
  // Extract QAs from DOM (same as original)
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
      .find(
        [
          ".accordion-item",
          ".accordion__item",
          ".faq-item",
          ".faq__item",
          "[data-faq-item]",
          "[data-accordion-item]",
          "details",
          "dl",
        ].join(", ")
      )
      .addBack(".accordion-item, .accordion__item, .faq-item, .faq__item, [data-faq-item], [data-accordion-item], details, dl");

    if (items.length) {
      items.each((_, el) => {
        let q = "";
        let a = "";

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

        if ((el as any).name?.toLowerCase() === "details") {
          const $det = $(el);
          q = $det.find("summary").first().text().trim();
          a = $det.clone().find("summary").remove().end().text().trim();
          if (q && a) {
            out.push({ q, a });
            return;
          }
        }

        const $el = $(el);

        const trigger = $el.find("[aria-controls]").first().length ? $el.find("[aria-controls]").first() : $el.closest("[aria-controls]").first();

        if (trigger.length) {
          const ctrl = trigger.attr("aria-controls");
          const panel = ctrl ? $(`#${ctrl}`) : $("<div/>");
          q =
            trigger.text().trim() ||
            $el.find("summary, h2, h3, h4, .question, [data-question], [role=button]").first().text().trim();
          a =
            panel.text().trim() ||
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
          if (q && a) {
            out.push({ q, a });
            return;
          }
        }

        q =
          $el.find("summary, h2, h3, h4, button, .question, [data-question]").first().text().trim() ||
          $el.find("[role=button]").first().text().trim();

        a = $el.find(".answer, .accordion-body, .accordion__panel, [data-answer]").first().text().trim();

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
private async fetchFaqDomAndQAs(url: string, cfg: SiteConfig): Promise<{ html: string; qas: QA[] }> {
  const renderEnabled = process.env.FAQ_AUDIT_RENDER === "1";
  const renderFallback = (process.env.FAQ_AUDIT_RENDER_FALLBACK ?? "1") === "1";

  // אם רנדר דלוק, רוץ רנדר מלא
  if (renderEnabled) {
    return await this.fetchFaqDomAndQAsRendered(url, cfg);
  }

  // נסה סטטי
  const html = await this.fetchText(url, true, cfg);

  // בדיקה מהירה
  const staticCount = this.quickCountDomFaqItems(html);
  const hasFaqSchema = this.quickHasFaqSchema(html);

  // פולבאק לרנדר
  if (renderFallback && staticCount === 0 && (hasFaqSchema || /\/faq\/?$/i.test(url))) {
    return await this.fetchFaqDomAndQAsRendered(url, cfg);
  }

  return { html, qas: [] };
}

 private async fetchFaqDomAndQAsRendered(url: string, cfg: SiteConfig): Promise<{ html: string; qas: QA[] }> {
  const mod: any = await (Function("return import('playwright')")() as Promise<any>);
  const channel = process.env.FAQ_AUDIT_PLAYWRIGHT_CHANNEL;
  const browser = await mod.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const page = await browser.newPage();

  await page.addInitScript({ content: "window.__name = (o, n) => o;" });

  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(60_000);

  await page.setExtraHTTPHeaders({ "accept-language": cfg.acceptLanguage });
  await page.setViewportSize({ width: 1365, height: 900 });

  // כאן השינוי הקריטי: domcontentloaded במקום networkidle
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  await page.waitForSelector("main, body", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(250);

  // מכאן - זה פשוט אותו קוד שכבר יש לך:
  // tabs click, accordions open, load more, scroll, evaluate visibleQAs, accessibleQAs וכו'

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
      try {
        await loc.nth(i).click({ force: true });
        await page.waitForTimeout(CLICK_PAUSE_MS);
      } catch {}
    }
  }

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
      try {
        await loc.nth(i).click({ force: true });
        await page.waitForTimeout(Math.max(60, CLICK_PAUSE_MS / 2));
      } catch {}
    }
  }

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

  await page.locator("details").evaluateAll((nodes: any[]) => {
    nodes.forEach((d: any) => {
      (d as any).open = true;
    });
  });

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
        await page.waitForTimeout(500);
        await page.waitForTimeout(250);
      } catch {}
    }
  }

  for (let y = 0; y < SCROLL_STEPS; y++) {
    await page.mouse.wheel(0, SCROLL_DELTA);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);

  const collectedQAs: QA[] = await page.evaluate(() => {
  const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
  const text = (el: any) => (el ? norm((el as any).innerText) : "");
  const out: { q: string; a: string }[] = [];
  const seen = new Set<string>();

  (document.querySelectorAll("details") as any).forEach((det: any) => {
    const q = text(det.querySelector("summary"));
    const clone = det.cloneNode(true) as any;
    const sum = clone.querySelector("summary");
    if (sum) sum.remove();
    const a = norm(clone.innerText);
    if (q && a) {
      const k = (q + "||" + a).toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ q, a });
      }
    }
  });

  (document.querySelectorAll("[aria-controls]") as any).forEach((trig: any) => {
    const id = trig.getAttribute("aria-controls") || "";
    if (!id) return;
    const panel = document.getElementById(id);
    const q = text(trig);
    const a = text(panel || undefined);
    if (q && a) {
      const k = (q + "||" + a).toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ q, a });
      }
    }
  });

  const itemSel = [".accordion-item", ".accordion__item", ".faq-item", ".faq__item", "[data-faq-item]", "[data-accordion-item]"].join(", ");
  (document.querySelectorAll(itemSel) as any).forEach((it: any) => {
    const qEl =
      it.querySelector("summary, h1, h2, h3, h4, button, .question, [data-question], [role=button]") ||
      it.querySelector("[class*='title']");
    let aEl =
      it.querySelector(".answer, .accordion-body, .accordion__panel, [data-answer]") ||
      it.querySelector("[class*='content'], [class*='panel']");
    if (!aEl) {
      const clone = it.cloneNode(true) as any;
      clone
        .querySelectorAll("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]")
        .forEach((n: any) => n.remove());
      aEl = clone;
    }
    const q = text(qEl as any);
    const a = text(aEl as any);
    if (q && a) {
      const k = (q + "||" + a).toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ q, a });
      }
    }
  });

  return out
    .map(({ q, a }) => ({ q: q.trim(), a: a.trim() }))
    .filter(({ q, a }) => a && a.length >= 5 && a.toLowerCase() !== q.toLowerCase());
});

  const html = await page.content();
  await browser.close();
  const merged = collectedQAs || [];
  const deduped = merged
    .map(({ q, a }) => ({ q: (q || "").trim(), a: (a || "").trim() }))
    .filter(({ q, a }) => q && a && a.length >= 5 && a.toLowerCase() !== q.toLowerCase());

  return { html, qas: this.dedupeQAs(deduped) };
}

  private async fetchText(url: string, isFaq = false, cfg?: SiteConfig): Promise<string> {
    if (process.env.FAQ_AUDIT_RENDER === "1") {
      const mod: any = await (Function("return import('playwright')")() as Promise<any>);
      const channel = process.env.FAQ_AUDIT_PLAYWRIGHT_CHANNEL;
      const browser = await mod.chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
      const page = await browser.newPage();

      await page.addInitScript({ content: "window.__name = (o, n) => o;" });

      page.setDefaultNavigationTimeout(60_000);
      page.setDefaultTimeout(60_000);

      await page.setExtraHTTPHeaders({ "accept-language": cfg?.acceptLanguage ?? "en-GB,en;q=0.9" });
      await page.setViewportSize({ width: 1365, height: 900 });

      console.log(`[pw] goto start: ${url} (isFaq=${isFaq})`);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      console.log(`[pw] goto done: ${url}`);

      await page.waitForSelector("main, body", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(250);

      if (isFaq) {
        const tabSelectors = ["[role=tab]", "[data-bs-toggle='tab']", ".nav-tabs a[href^='#']"];
        for (const sel of tabSelectors) {
          const loc = page.locator(sel);
          const count = await loc.count().catch(() => 0);
          for (let i = 0; i < count; i++) {
            try {
              await loc.nth(i).click({ force: true });
              await page.waitForTimeout(CLICK_PAUSE_MS);
            } catch {}
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
          nodes.forEach((d: any) => {
            (d as any).open = true;
          });
        });

        for (let y = 0; y < 6; y++) {
          await page.mouse.wheel(0, 1000);
          await page.waitForTimeout(80);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
      }

      const html = await page.content();
      await browser.close();
      return html;
    }

    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 FaqAuditBot", "accept-language": cfg?.acceptLanguage ?? "en-GB,en;q=0.9" },
    });
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return await r.text();
  }

  // -----------------------------------------------------------
  // Utilities (same as original)
  // -----------------------------------------------------------
  
  private quickCountDomFaqItems(html: string): number {
  const $ = cheerio.load(html);
  return $(".accordion-item, .accordion__item, .faq-item, .faq__item, [data-faq-item], details, dl").length;
}

private quickHasFaqSchema(html: string): boolean {
  const $ = cheerio.load(html);
  const scripts = $("script[type='application/ld+json']");
  for (const el of scripts.toArray()) {
    const raw = $(el).text().trim();
    if (!raw) continue;
    try {
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : [json];
      for (const n of nodes) {
        const t = n?.["@type"];
        if (t === "FAQPage" || (Array.isArray(t) && t.map(String).includes("FAQPage"))) return true;
      }
    } catch {}
  }
  return false;
}
  
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

  // Normalize question text for fuzzy matching
private normalizeQuestion(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    // remove punctuation (keep letters/numbers/spaces)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    // collapse spaces
    .replace(/\s+/g, " ")
    .trim();
}

private tokenize(s: string): string[] {
  const norm = this.normalizeQuestion(s);
  if (!norm) return [];
  return norm.split(" ").filter(Boolean);
}

// Jaccard similarity over token sets
private jaccardSimilarity(a: string, b: string): number {
  const A = new Set(this.tokenize(a));
  const B = new Set(this.tokenize(b));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;

  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Find best match in schema for a DOM question (and vice versa)
private findBestMatch(
  sourceQ: string,
  targets: QA[],
  minScore: number
): { hit: QA | null; score: number } {
  let best: QA | null = null;
  let bestScore = 0;

  for (const t of targets) {
    const score = this.jaccardSimilarity(sourceQ, t.q);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  if (best && bestScore >= minScore) return { hit: best, score: bestScore };
  return { hit: null, score: bestScore };
}

  private async headOk(url: string): Promise<boolean> {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return true;
    } catch {}
    try {
      const r2 = await fetch(url, { method: "GET" });
      return r2.ok;
    } catch {
      return false;
    }
  }

  private prettyNameFromUrl(url: string) {
    const last = url.split("/").filter(Boolean).slice(-1)[0];
    return decodeURIComponent(last || url).replace(/-/g, " ").trim();
  }

  private makeAbsolute(base: string, href: string) {
    try {
      return new URL(href, base).toString();
    } catch {
      return href;
    }
  }

  private normalizeHotelBaseUrl(rawUrl: string, cfg: SiteConfig): string | null {
    try {
      const u = new URL(rawUrl);
      if (!cfg.allowedHosts.includes(u.host)) return null;
      const segs = u.pathname.split("/").filter(Boolean);
      if (segs.length < 2) return null;

      const city = segs[0];
      const hotel = segs[1];

      if (/^(reviews|offers?|brand|advantage|club|loyalty)$/i.test(hotel)) return null;

      return `${u.origin}/${city}/${hotel}`;
    } catch {
      return null;
    }
  }
}