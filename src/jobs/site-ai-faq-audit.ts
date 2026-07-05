// src/jobs/site-ai-faq-audit.ts
// Focused FAQ audit for the new crawler V2 flow.

import * as cheerio from "cheerio";
import { SheetsService } from "../services/sheets.js";
import {
  discoverSiteUrls,
  type SiteDiscoveryResult,
  type SiteUrlGroup,
} from "./site-ai-audit-discovery.js";

export type FaqAuditRenderMode = "rendered" | "static";
export type FaqQA = { q: string; a: string };
export type FaqTextIssueSeverity = "warning" | "info";
export type FaqTextIssueScope = "source" | "site";
export type FaqLanguageConfidence = "high" | "medium" | "low";
export type FaqLanguageSignalSource = "html-lang" | "og-locale" | "hreflang" | "url" | "content" | "unknown";
export type FaqTextDirection = "ltr" | "rtl" | "unknown";

export type FaqPageLanguage = {
  code: string;
  name: string;
  confidence: FaqLanguageConfidence;
  source: FaqLanguageSignalSource;
  direction: FaqTextDirection;
  htmlLang: string;
  ogLocale: string;
  hreflangs: string[];
  urlHints: string[];
  contentHints: string[];
  warnings: string[];
};

export type FaqLanguageSummary = {
  code: string;
  name: string;
  count: number;
  sources: FaqLanguageSignalSource[];
  urls: string[];
  warnings: string[];
};

export type SourceFaqRow = FaqQA & {
  sourceFile: string;
  spreadsheetId: string;
  tabName: string;
  rowNumber: number;
  category: string;
};

export type FaqAnswerMismatch = {
  question: string;
  sourceQuestion: string;
  sourceAnswer: string;
  siteQuestion: string;
  siteAnswer: string;
  questionSimilarity: number;
  similarity: number;
  reasons: string[];
};

export type FaqQuestionMismatch = {
  sourceQuestion: string;
  sourceAnswer: string;
  siteQuestion: string;
  siteAnswer: string;
  questionSimilarity: number;
  similarity: number;
  reasons: string[];
};

export type FaqSourceSiteDelta = {
  sourceQuestion: string;
  sourceAnswer: string;
  siteQuestion: string;
  siteAnswer: string;
  questionSimilarity: number;
};

export type FaqTextIssue = {
  scope: FaqTextIssueScope;
  severity: FaqTextIssueSeverity;
  type: string;
  sourceFile?: string;
  url?: string;
  rowNumber?: number;
  question?: string;
  answerPreview?: string;
  detail: string;
  recommendedAction: string;
};

export type SourceFileComparison = {
  sourceFile: string;
  spreadsheetId: string;
  tabName: string;
  status: "ok" | "read-failed" | "no-questions" | "no-page-match";
  matchedPageUrl: string;
  matchedPageTitle: string;
  matchedBy: string;
  sourceQuestionCount: number;
  siteQuestionCount: number;
  matchedQuestionCount: number;
  sourceOnlyQuestions: string[];
  siteOnlyQuestions: string[];
  sourceOnlyItems: FaqSourceSiteDelta[];
  siteOnlyItems: FaqSourceSiteDelta[];
  questionMismatches: FaqQuestionMismatch[];
  answerMismatches: FaqAnswerMismatch[];
  duplicateQuestions: string[];
  qaIssues: FaqTextIssue[];
  notes: string[];
};

export type SourceComparisonResult = {
  enabled: boolean;
  sourceFilesFound: number;
  sourceFilesRead: number;
  sourceFilesFailed: number;
  totalSourceQuestions: number;
  matchedPages: number;
  missingOnSite: number;
  extraOnSite: number;
  questionMismatches: number;
  answerMismatches: number;
  qaIssueCount: number;
  files: SourceFileComparison[];
  issues: FaqTextIssue[];
  sourceRows: SourceFaqRow[];
};

export type SiteFaqAuditConfig = {
  startUrl: string;
  urls?: string[];
  groups?: SiteUrlGroup[];
  urlIncludes?: string[];
  maxPages?: number;
  maxDiscoveryUrls?: number;
  maxFaqCandidateChecks?: number;
  faqCandidateConcurrency?: number;
  fetchTimeoutMs?: number;
  maxDepth?: number;
  renderMode?: FaqAuditRenderMode;
  writeGoogleSheet?: boolean;
  reportTitle?: string;
  acceptLanguage?: string;
  userAgent?: string;
  sourceCompareEnabled?: boolean;
  sourceInput?: string;
  sourceFolderId?: string;
  sourceSpreadsheetIds?: string[];
  sourceTabName?: string;
  sourceHeaderRow?: number;
};

export type FaqAuditStatus =
  | "ok"
  | "missing-schema"
  | "missing-visible-faq"
  | "mismatch"
  | "no-faq"
  | "fetch-failed";

export type FaqAuditPageResult = {
  url: string;
  title: string;
  h1: string;
  language: FaqPageLanguage;
  statusCode: number;
  rendered: boolean;
  auditStatus: FaqAuditStatus;
  schemaTypes: string[];
  faqPageSchemaCount: number;
  visibleQaCount: number;
  schemaQaCount: number;
  visibleQuestions: string[];
  schemaQuestions: string[];
  visibleQAs: FaqQA[];
  schemaQAs: FaqQA[];
  visibleOnlyQuestions: string[];
  schemaOnlyQuestions: string[];
  emptyVisibleAnswers: string[];
  emptySchemaAnswers: string[];
  invalidJsonLdCount: number;
  notes: string[];
};

export type SiteFaqAuditResult = {
  startedAt: string;
  finishedAt: string;
  startUrl: string;
  normalizedStartUrl: string;
  discovery: Pick<SiteDiscoveryResult, "host" | "groups"> | null;
  selectedUrls: string[];
  pages: FaqAuditPageResult[];
  languageSummary: FaqLanguageSummary[];
  summary: {
    pagesChecked: number;
    pagesWithVisibleFaq: number;
    pagesWithFaqSchema: number;
    pagesOk: number;
    pagesMissingSchema: number;
    pagesMissingVisibleFaq: number;
    pagesWithMismatch: number;
    totalVisibleQuestions: number;
    totalSchemaQuestions: number;
  };
  sourceComparison?: SourceComparisonResult;
  googleSheet?: {
    id: string;
    url: string;
  };
};

type QA = FaqQA;
type PageFetchResult = { url: string; status: number; html: string; rendered: boolean };
type JsonLdExtraction = { objects: unknown[]; invalidCount: number; types: string[] };
type SourceFileRef = { id: string; name: string };
type NormalizedSiteFaqAuditConfig = {
  startUrl: string;
  urls: string[];
  groups: SiteUrlGroup[];
  urlIncludes: string[];
  maxPages: number;
  maxDiscoveryUrls: number;
  maxFaqCandidateChecks: number;
  faqCandidateConcurrency: number;
  fetchTimeoutMs: number;
  maxDepth: number;
  renderMode: FaqAuditRenderMode;
  writeGoogleSheet: boolean;
  reportTitle: string;
  acceptLanguage: string;
  userAgent: string;
  sourceCompareEnabled: boolean;
  sourceInput: string;
  sourceFolderId: string;
  sourceSpreadsheetIds: string[];
  sourceTabName: string;
  sourceHeaderRow: number;
};

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MAX_DISCOVERY_URLS = 1000;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_ACCEPT_LANGUAGE = "en-GB,en;q=0.9";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 SiteFaqAuditBot/0.2 (+https://carmelon.local)";

const FAQ_GROUPS: SiteUrlGroup[] = ["faq", "hotel", "location"];

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  he: "Hebrew",
  hu: "Hungarian",
  it: "Italian",
  ja: "Japanese",
  nl: "Dutch",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sv: "Swedish",
  tr: "Turkish",
  uk: "Ukrainian",
  zh: "Chinese",
};

const RTL_LANGUAGES = new Set(["ar", "he"]);

export class SiteFaqAuditJob {
  async run(input: SiteFaqAuditConfig): Promise<SiteFaqAuditResult> {
    const startedAt = new Date().toISOString();
    const config = this.normalizeConfig(input);
    const normalizedStartUrl = this.normalizeUrl(config.startUrl);
    const selected = await this.selectUrls(normalizedStartUrl, config);
    const pages: FaqAuditPageResult[] = [];

    for (const url of selected.urls.slice(0, config.maxPages)) {
      pages.push(await this.auditPage(url, config));
    }

    const result: SiteFaqAuditResult = {
      startedAt,
      finishedAt: new Date().toISOString(),
      startUrl: input.startUrl,
      normalizedStartUrl,
      discovery: selected.discovery
        ? { host: selected.discovery.host, groups: selected.discovery.groups }
        : null,
      selectedUrls: selected.urls,
      pages,
      languageSummary: this.summarizeLanguages(pages),
      summary: this.summarize(pages),
    };

    if (config.sourceCompareEnabled) {
      result.sourceComparison = await this.compareAgainstSources(result, config);
    }

    if (config.writeGoogleSheet) {
      result.googleSheet = await this.writeGoogleSheetReport(result, config);
    }

    return result;
  }

  private normalizeConfig(input: SiteFaqAuditConfig): NormalizedSiteFaqAuditConfig {
    if (!input.startUrl) {
      throw new Error("Missing startUrl");
    }

    return {
      startUrl: input.startUrl,
      urls: input.urls ?? [],
      groups: input.groups?.length ? input.groups : FAQ_GROUPS,
      urlIncludes: input.urlIncludes ?? [],
      maxPages: Math.max(1, Math.min(500, Number(input.maxPages ?? DEFAULT_MAX_PAGES))),
      maxDiscoveryUrls: Math.max(1, Math.min(5000, Number(input.maxDiscoveryUrls ?? DEFAULT_MAX_DISCOVERY_URLS))),
      maxFaqCandidateChecks: Math.max(0, Math.min(5000, Number(input.maxFaqCandidateChecks ?? 300))),
      faqCandidateConcurrency: Math.max(1, Math.min(20, Number(input.faqCandidateConcurrency ?? 12))),
      fetchTimeoutMs: Math.max(1000, Math.min(30000, Number(input.fetchTimeoutMs ?? 5000))),
      maxDepth: Math.max(0, Math.min(6, Number(input.maxDepth ?? DEFAULT_MAX_DEPTH))),
      renderMode: input.renderMode ?? "rendered",
      writeGoogleSheet: Boolean(input.writeGoogleSheet),
      reportTitle: input.reportTitle || "",
      acceptLanguage: input.acceptLanguage || DEFAULT_ACCEPT_LANGUAGE,
      userAgent: input.userAgent || DEFAULT_USER_AGENT,
      sourceCompareEnabled: Boolean(input.sourceCompareEnabled),
      sourceInput: input.sourceInput || "",
      sourceFolderId: input.sourceFolderId || "",
      sourceSpreadsheetIds: input.sourceSpreadsheetIds ?? [],
      sourceTabName: input.sourceTabName || "",
      sourceHeaderRow: Math.max(0, Math.min(50, Number(input.sourceHeaderRow ?? 0))),
    };
  }

  private async selectUrls(
    normalizedStartUrl: string,
    config: NormalizedSiteFaqAuditConfig
  ): Promise<{ urls: string[]; discovery: SiteDiscoveryResult | null }> {
    if (config.urls.length) {
      return {
        urls: this.uniqueUrls(config.urls.map((url) => this.normalizeUrl(url))),
        discovery: null,
      };
    }

    const discovery = await discoverSiteUrls({
      startUrl: normalizedStartUrl,
      maxUrls: config.maxDiscoveryUrls,
      maxDepth: config.maxDepth,
      maxFaqCandidateChecks: config.maxFaqCandidateChecks,
      faqCandidateConcurrency: config.faqCandidateConcurrency,
      fetchTimeoutMs: config.fetchTimeoutMs,
      acceptLanguage: config.acceptLanguage,
      userAgent: config.userAgent,
    });

    const includes = config.urlIncludes.map((item) => item.toLowerCase()).filter(Boolean);
    const urls = discovery.urls
      .filter((item) => {
        const groupMatch = item.groups.some((group) => config.groups.includes(group));
        const includeMatch = includes.length
          ? includes.some((needle) => item.url.toLowerCase().includes(needle))
          : true;
        return groupMatch && includeMatch;
      })
      .map((item) => item.url);

    return {
      urls: this.uniqueUrls(urls),
      discovery,
    };
  }

  private async auditPage(
    url: string,
    config: NormalizedSiteFaqAuditConfig
  ): Promise<FaqAuditPageResult> {
    let fetched: PageFetchResult;

    try {
      fetched = await this.fetchPage(url, config);
    } catch (error) {
      return {
        url,
        title: "",
        h1: "",
        language: this.detectPageLanguage(url, null, []),
        statusCode: 0,
        rendered: config.renderMode === "rendered",
        auditStatus: "fetch-failed",
        schemaTypes: [],
        faqPageSchemaCount: 0,
        visibleQaCount: 0,
        schemaQaCount: 0,
        visibleQuestions: [],
        schemaQuestions: [],
        visibleQAs: [],
        schemaQAs: [],
        visibleOnlyQuestions: [],
        schemaOnlyQuestions: [],
        emptyVisibleAnswers: [],
        emptySchemaAnswers: [],
        invalidJsonLdCount: 0,
        notes: [error instanceof Error ? error.message : String(error)],
      };
    }

    const $ = cheerio.load(fetched.html);
    const title = this.cleanText($("head > title").first().text());
    const h1 = this.cleanText($("h1").first().text());
    const jsonLd = this.extractJsonLd($);
    const schemaQAs = this.extractFaqSchemaQAs(jsonLd.objects);
    const visibleQAs = this.extractVisibleQAs($);
    const gap = this.compareQAs(visibleQAs, schemaQAs);
    const emptyVisibleAnswers = visibleQAs.filter((item) => item.a.length < 8).map((item) => item.q);
    const emptySchemaAnswers = schemaQAs.filter((item) => item.a.length < 8).map((item) => item.q);
    const faqPageSchemaCount = this.countFaqPageObjects(jsonLd.objects);
    const auditStatus = this.getAuditStatus(visibleQAs, schemaQAs, gap);
    const language = this.detectPageLanguage(url, $, [
      title,
      h1,
      ...visibleQAs.flatMap((item) => [item.q, item.a]),
      ...schemaQAs.flatMap((item) => [item.q, item.a]),
    ]);
    const notes = this.buildPageNotes({
      auditStatus,
      rendered: fetched.rendered,
      visibleCount: visibleQAs.length,
      schemaCount: schemaQAs.length,
      invalidJsonLdCount: jsonLd.invalidCount,
      faqPageSchemaCount,
      language,
      visibleOnlyQuestions: gap.visibleOnly,
      schemaOnlyQuestions: gap.schemaOnly,
      emptyVisibleAnswers,
      emptySchemaAnswers,
    });

    return {
      url,
      title,
      h1,
      language,
      statusCode: fetched.status,
      rendered: fetched.rendered,
      auditStatus,
      schemaTypes: jsonLd.types,
      faqPageSchemaCount,
      visibleQaCount: visibleQAs.length,
      schemaQaCount: schemaQAs.length,
      visibleQuestions: visibleQAs.map((item) => item.q),
      schemaQuestions: schemaQAs.map((item) => item.q),
      visibleQAs,
      schemaQAs,
      visibleOnlyQuestions: gap.visibleOnly,
      schemaOnlyQuestions: gap.schemaOnly,
      emptyVisibleAnswers,
      emptySchemaAnswers,
      invalidJsonLdCount: jsonLd.invalidCount,
      notes,
    };
  }

  private getAuditStatus(
    visibleQAs: QA[],
    schemaQAs: QA[],
    gap: { visibleOnly: string[]; schemaOnly: string[] }
  ): FaqAuditStatus {
    if (!visibleQAs.length && !schemaQAs.length) return "no-faq";
    if (visibleQAs.length && !schemaQAs.length) return "missing-schema";
    if (!visibleQAs.length && schemaQAs.length) return "missing-visible-faq";
    if (gap.visibleOnly.length || gap.schemaOnly.length) return "mismatch";
    return "ok";
  }

  private buildPageNotes(input: {
    auditStatus: FaqAuditStatus;
    rendered: boolean;
    visibleCount: number;
    schemaCount: number;
    invalidJsonLdCount: number;
    faqPageSchemaCount: number;
    language?: FaqPageLanguage;
    visibleOnlyQuestions?: string[];
    schemaOnlyQuestions?: string[];
    emptyVisibleAnswers?: string[];
    emptySchemaAnswers?: string[];
  }): string[] {
    const notes: string[] = [];

    if (input.rendered) {
      notes.push("Checked after browser rendering.");
    } else {
      notes.push("Checked static HTML only.");
    }

    if (input.invalidJsonLdCount) {
      notes.push(`${input.invalidJsonLdCount} invalid JSON-LD script(s) found.`);
    }

    if (input.language) {
      const languageLabel = input.language.code === "unknown"
        ? "Language could not be detected"
        : `Language detected: ${input.language.name} (${input.language.code}) via ${input.language.source}`;
      notes.push(`${languageLabel}; confidence: ${input.language.confidence}.`);

      for (const warning of input.language.warnings) {
        notes.push(`[language] ${warning}`);
      }
    }

    if (input.auditStatus === "missing-schema") {
      notes.push("Visible FAQ exists, but FAQPage schema was not found.");
    }

    if (input.auditStatus === "missing-visible-faq") {
      notes.push("FAQPage schema exists, but matching visible FAQ was not found.");
    }

    if (input.auditStatus === "mismatch") {
      notes.push("Visible FAQ and FAQPage schema are not in sync.");
    }

    if (input.visibleOnlyQuestions?.length) {
      notes.push(`${input.visibleOnlyQuestions.length} visible question(s) are missing from FAQPage schema.`);
    }

    if (input.schemaOnlyQuestions?.length) {
      notes.push(`${input.schemaOnlyQuestions.length} schema question(s) were not found as visible FAQ questions.`);
    }

    if (input.emptyVisibleAnswers?.length) {
      notes.push(`${input.emptyVisibleAnswers.length} visible question(s) have missing or very short answers.`);
    }

    if (input.emptySchemaAnswers?.length) {
      notes.push(`${input.emptySchemaAnswers.length} schema question(s) have missing or very short answers.`);
    }

    notes.push(`Visible Q/A: ${input.visibleCount}; Schema Q/A: ${input.schemaCount}; FAQPage objects: ${input.faqPageSchemaCount}.`);
    return notes;
  }

  private summarize(pages: FaqAuditPageResult[]): SiteFaqAuditResult["summary"] {
    return {
      pagesChecked: pages.length,
      pagesWithVisibleFaq: pages.filter((page) => page.visibleQaCount > 0).length,
      pagesWithFaqSchema: pages.filter((page) => page.schemaQaCount > 0).length,
      pagesOk: pages.filter((page) => page.auditStatus === "ok").length,
      pagesMissingSchema: pages.filter((page) => page.auditStatus === "missing-schema").length,
      pagesMissingVisibleFaq: pages.filter((page) => page.auditStatus === "missing-visible-faq").length,
      pagesWithMismatch: pages.filter((page) => page.auditStatus === "mismatch").length,
      totalVisibleQuestions: pages.reduce((sum, page) => sum + page.visibleQaCount, 0),
      totalSchemaQuestions: pages.reduce((sum, page) => sum + page.schemaQaCount, 0),
    };
  }

  private summarizeLanguages(pages: FaqAuditPageResult[]): FaqLanguageSummary[] {
    const map = new Map<string, FaqLanguageSummary>();

    for (const page of pages) {
      const code = page.language?.code || "unknown";
      const existing = map.get(code) || {
        code,
        name: this.languageName(code),
        count: 0,
        sources: [],
        urls: [],
        warnings: [],
      };

      existing.count += 1;
      existing.urls.push(page.url);

      if (page.language?.source && !existing.sources.includes(page.language.source)) {
        existing.sources.push(page.language.source);
      }

      for (const warning of page.language?.warnings || []) {
        existing.warnings.push(`${page.url}: ${warning}`);
      }

      map.set(code, existing);
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        urls: item.urls.slice(0, 12),
        warnings: item.warnings.slice(0, 20),
      }))
      .sort((a, b) => {
        if (a.code === "unknown") return 1;
        if (b.code === "unknown") return -1;
        return b.count - a.count || a.name.localeCompare(b.name);
      });
  }

  private detectPageLanguage(url: string, $: cheerio.Root | null, textParts: string[]): FaqPageLanguage {
    const htmlLang = this.normalizeLocaleCode($ ? String($("html").first().attr("lang") || "") : "");
    const ogLocale = this.normalizeLocaleCode($ ? String($('meta[property="og:locale"], meta[name="og:locale"]').first().attr("content") || "") : "");
    const htmlDir = $ ? String($("html").first().attr("dir") || "").trim().toLowerCase() : "";
    const hreflangs = $
      ? this.uniqueStrings(
        $('link[rel~="alternate"][hreflang]')
          .map((_, element) => this.normalizeLocaleCode(String($(element).attr("hreflang") || "")))
          .get()
          .filter(Boolean)
      )
      : [];
    const urlHints = this.detectUrlLanguageHints(url);
    const bodyText = $ ? this.cleanText($("body").text()).slice(0, 12000) : "";
    const contentHints = this.detectContentLanguageHints([...textParts, bodyText].join(" "));

    const candidates: Array<{ code: string; source: FaqLanguageSignalSource; score: number }> = [];
    const addCandidate = (code: string, source: FaqLanguageSignalSource, score: number) => {
      const normalized = this.primaryLanguageCode(code);
      if (!normalized) return;
      const existing = candidates.find((item) => item.code === normalized && item.source === source);
      if (existing) {
        existing.score = Math.max(existing.score, score);
        return;
      }
      candidates.push({ code: normalized, source, score });
    };

    addCandidate(htmlLang, "html-lang", 100);
    addCandidate(ogLocale, "og-locale", 90);
    if (urlHints[0]) addCandidate(urlHints[0], "url", 72);
    if (contentHints[0]) addCandidate(contentHints[0], "content", 66);

    const hreflangCodes = this.uniqueStrings(hreflangs.map((item) => this.primaryLanguageCode(item)).filter(Boolean));
    if (!candidates.length && hreflangCodes.length === 1) {
      addCandidate(hreflangCodes[0], "hreflang", 55);
    }

    candidates.sort((a, b) => b.score - a.score);
    const primary = candidates[0] || { code: "unknown", source: "unknown" as FaqLanguageSignalSource, score: 0 };
    const confidence: FaqLanguageConfidence = primary.score >= 85 ? "high" : primary.score >= 55 ? "medium" : "low";
    const warnings = this.buildLanguageWarnings({
      primaryCode: primary.code,
      htmlLang,
      ogLocale,
      hreflangs,
      urlHints,
      contentHints,
    });

    return {
      code: primary.code,
      name: this.languageName(primary.code),
      confidence,
      source: primary.source,
      direction: this.languageDirection(primary.code, htmlDir),
      htmlLang,
      ogLocale,
      hreflangs,
      urlHints,
      contentHints,
      warnings,
    };
  }

  private buildLanguageWarnings(input: {
    primaryCode: string;
    htmlLang: string;
    ogLocale: string;
    hreflangs: string[];
    urlHints: string[];
    contentHints: string[];
  }): string[] {
    const warnings: string[] = [];
    const htmlCode = this.primaryLanguageCode(input.htmlLang);
    const ogCode = this.primaryLanguageCode(input.ogLocale);
    const urlCode = input.urlHints[0] || "";
    const contentCode = input.contentHints[0] || "";
    const hreflangCodes = this.uniqueStrings(input.hreflangs.map((item) => this.primaryLanguageCode(item)).filter(Boolean));

    if (htmlCode && ogCode && htmlCode !== ogCode) {
      warnings.push(`html lang is ${input.htmlLang}, but og:locale points to ${input.ogLocale}.`);
    }

    if (urlCode && input.primaryCode !== "unknown" && urlCode !== input.primaryCode) {
      warnings.push(`URL/domain suggests ${this.languageName(urlCode)} (${urlCode}), but the strongest page signal is ${this.languageName(input.primaryCode)} (${input.primaryCode}).`);
    }

    if (contentCode && input.primaryCode !== "unknown" && contentCode !== input.primaryCode) {
      warnings.push(`Page text looks like ${this.languageName(contentCode)} (${contentCode}), but the strongest page signal is ${this.languageName(input.primaryCode)} (${input.primaryCode}).`);
    }

    if (htmlCode && hreflangCodes.length && !hreflangCodes.includes(htmlCode)) {
      warnings.push(`hreflang alternates do not include the current html language ${htmlCode}.`);
    }

    if (input.primaryCode === "unknown") {
      warnings.push("No reliable language signal was found in html lang, URL, structured metadata or FAQ text.");
    }

    return this.uniqueStrings(warnings);
  }

  private detectUrlLanguageHints(rawUrl: string): string[] {
    const hints: string[] = [];

    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const pathParts = parsed.pathname
        .split("/")
        .map((part) => decodeURIComponent(part).toLowerCase())
        .filter(Boolean);

      const tldHints: Array<[RegExp, string]> = [
        [/(\.|^)co\.il$/, "he"],
        [/\.de$/, "de"],
        [/\.fr$/, "fr"],
        [/\.it$/, "it"],
        [/\.es$/, "es"],
        [/\.nl$/, "nl"],
        [/\.pt$/, "pt"],
        [/\.pl$/, "pl"],
        [/\.cz$/, "cs"],
        [/\.ru$/, "ru"],
        [/\.gr$/, "el"],
        [/\.tr$/, "tr"],
        [/\.ae$/, "ar"],
      ];

      for (const [pattern, code] of tldHints) {
        if (pattern.test(host)) hints.push(code);
      }

      for (const part of pathParts.slice(0, 3)) {
        const normalized = this.primaryLanguageCode(part);
        if (normalized) hints.push(normalized);
      }
    } catch {
      // Invalid URLs are reported by fetch; language detection stays best effort.
    }

    return this.uniqueStrings(hints);
  }

  private detectContentLanguageHints(value: string): string[] {
    const text = this.cleanText(value).toLowerCase();
    if (!text) return [];

    const scores = new Map<string, number>();
    const add = (code: string, score: number) => {
      scores.set(code, (scores.get(code) || 0) + score);
    };

    const scriptChecks: Array<[RegExp, string]> = [
      [/[\u0590-\u05ff]/g, "he"],
      [/[\u0600-\u06ff]/g, "ar"],
      [/[\u0400-\u04ff]/g, "ru"],
      [/[\u0370-\u03ff]/g, "el"],
    ];

    for (const [pattern, code] of scriptChecks) {
      const count = (text.match(pattern) || []).length;
      if (count >= 12) add(code, Math.min(40, count));
    }

    const wordSignals: Record<string, RegExp> = {
      en: /\b(the|and|or|is|are|with|what|where|when|how|can|does|hotel|room|breakfast|check[- ]?in|parking)\b/g,
      de: /\b(und|oder|ist|sind|mit|was|wo|wann|wie|kann|hotel|zimmer|frühstück|parkplatz|ankunft)\b/g,
      fr: /\b(et|ou|est|sont|avec|quel|quelle|où|quand|comment|peut|hôtel|chambre|petit[- ]déjeuner|parking)\b/g,
      es: /\b(y|o|es|son|con|qué|dónde|cuándo|cómo|puede|hotel|habitación|desayuno|aparcamiento)\b/g,
      it: /\b(e|o|è|sono|con|che|dove|quando|come|può|hotel|camera|colazione|parcheggio)\b/g,
      nl: /\b(en|of|is|zijn|met|wat|waar|wanneer|hoe|kan|hotel|kamer|ontbijt|parkeren)\b/g,
      pt: /\b(e|ou|é|são|com|que|onde|quando|como|pode|hotel|quarto|pequeno[- ]almoço|estacionamento)\b/g,
      he: /\b(האם|מה|איפה|מתי|איך|מלון|חדר|ארוחת|בוקר|חניה|צ'ק)\b/g,
    };

    for (const [code, pattern] of Object.entries(wordSignals)) {
      const matches = text.match(pattern) || [];
      if (matches.length >= 3) add(code, matches.length * 2);
    }

    return Array.from(scores.entries())
      .filter(([, score]) => score >= 6)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code]) => code)
      .slice(0, 4);
  }

  private normalizeLocaleCode(value: string): string {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/^"+|"+$/g, "");
  }

  private primaryLanguageCode(value: string): string {
    const normalized = this.normalizeLocaleCode(value);
    if (!normalized || normalized === "x-default") return "";
    const first = normalized.split("-")[0] || "";
    return LANGUAGE_NAMES[first] ? first : "";
  }

  private languageName(code: string): string {
    return LANGUAGE_NAMES[code] || (code === "unknown" ? "Unknown" : code.toUpperCase());
  }

  private languageDirection(code: string, explicitDirection: string): FaqTextDirection {
    if (explicitDirection === "rtl" || explicitDirection === "ltr") return explicitDirection;
    if (RTL_LANGUAGES.has(code)) return "rtl";
    if (code && code !== "unknown") return "ltr";
    return "unknown";
  }

  private extractJsonLd($: cheerio.Root): JsonLdExtraction {
    const objects: unknown[] = [];
    const types = new Set<string>();
    let invalidCount = 0;

    $("script").each((_, element) => {
      const type = String($(element).attr("type") || "").toLowerCase();
      if (!type.includes("ld+json")) return;

      const raw = this.cleanJsonLdText($(element).contents().text());
      if (!raw.trim()) return;

      const parsed = this.parseJsonLd(raw);
      if (parsed.ok) {
        this.flattenJsonLd(parsed.value).forEach((item) => {
          objects.push(item);
          this.collectSchemaTypes(item, types);
        });
      } else {
        invalidCount += 1;
      }
    });

    return {
      objects,
      invalidCount,
      types: Array.from(types).sort(),
    };
  }

  private cleanJsonLdText(raw: string): string {
    return String(raw || "")
      .replace(/^\uFEFF/, "")
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\//, "")
      .replace(/\/\*\s*\]\]>\s*\*\/\s*$/, "")
      .replace(/^\s*<!\[CDATA\[/, "")
      .replace(/\]\]>\s*$/, "")
      .replace(/^\s*\/\/\s*<!\[CDATA\[/, "")
      .replace(/\/\/\s*\]\]>\s*$/, "")
      .replace(/\u2028|\u2029/g, " ")
      .trim()
      .replace(/;\s*$/, "");
  }

  private parseJsonLd(raw: string): { ok: true; value: unknown } | { ok: false } {
    const candidates = this.uniqueStrings([
      raw,
      this.decodePossiblyEscapedJsonLd(raw),
      this.extractJsonBlock(raw),
    ]).filter(Boolean);

    for (const candidate of candidates) {
      try {
        return { ok: true, value: JSON.parse(candidate) };
      } catch {
        // Try the next safe cleanup candidate.
      }
    }

    return { ok: false };
  }

  private decodePossiblyEscapedJsonLd(raw: string): string {
    if (!/&(?:quot|apos|amp|lt|gt|#[0-9]+|#x[0-9a-f]+);/i.test(raw)) return raw;
    return cheerio.load(`<textarea>${raw}</textarea>`)("textarea").text().trim();
  }

  private extractJsonBlock(raw: string): string {
    const firstObject = raw.indexOf("{");
    const firstArray = raw.indexOf("[");
    const starts: number[] = [firstObject, firstArray].filter((index) => index >= 0);
    if (!starts.length) return raw;

    const start = Math.min(...starts);
    const endObject = raw.lastIndexOf("}");
    const endArray = raw.lastIndexOf("]");
    const end = Math.max(endObject, endArray);
    if (end <= start) return raw;
    return raw.slice(start, end + 1).trim();
  }

  private flattenJsonLd(value: unknown): unknown[] {
    const out: unknown[] = [];
    const visit = (item: unknown) => {
      if (!item || typeof item !== "object") return;
      if (Array.isArray(item)) {
        item.forEach(visit);
        return;
      }

      out.push(item);
      const obj = item as Record<string, unknown>;
      if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
      if (Array.isArray(obj.mainEntity)) obj.mainEntity.forEach(visit);
      if (obj.mainEntity && !Array.isArray(obj.mainEntity)) visit(obj.mainEntity);
      if (Array.isArray(obj.itemListElement)) obj.itemListElement.forEach(visit);
      if (obj.itemListElement && !Array.isArray(obj.itemListElement)) visit(obj.itemListElement);
      if (obj.item) visit(obj.item);
    };

    visit(value);
    return out;
  }

  private collectSchemaTypes(value: unknown, out: Set<string>) {
    if (!value || typeof value !== "object") return;
    const obj = value as Record<string, unknown>;
    const rawType = obj["@type"];
    if (typeof rawType === "string") out.add(rawType);
    if (Array.isArray(rawType)) {
      rawType.forEach((item) => {
        if (typeof item === "string") out.add(item);
      });
    }
  }

  private extractFaqSchemaQAs(objects: unknown[]): QA[] {
    const qas: QA[] = [];

    for (const obj of objects) {
      if (!obj || typeof obj !== "object") continue;
      const record = obj as Record<string, unknown>;

      if (this.hasType(record, "FAQPage")) {
        const mainEntity = record.mainEntity || record.mainEntityOfPage || [];
        const items = Array.isArray(mainEntity) ? mainEntity : [mainEntity];
        items.forEach((item) => {
          const qa = this.schemaQuestionToQA(item);
          if (qa) qas.push(qa);
        });
        continue;
      }

      const qa = this.schemaQuestionToQA(record);
      if (qa) qas.push(qa);
    }

    return this.dedupeQAs(qas);
  }

  private countFaqPageObjects(objects: unknown[]): number {
    return objects.filter((obj) => {
      return Boolean(obj && typeof obj === "object" && this.hasType(obj as Record<string, unknown>, "FAQPage"));
    }).length;
  }

  private schemaQuestionToQA(value: unknown): QA | null {
    if (!value || typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    if (obj.item) {
      const nested = this.schemaQuestionToQA(obj.item);
      if (nested) return nested;
    }

    const hasQuestionShape = this.hasType(obj, "Question") || Boolean(obj.acceptedAnswer || obj.acceptedAnswers || obj.answer);
    if (!hasQuestionShape) return null;

    const q = this.cleanText(String(obj.name || obj.question || ""));
    const acceptedAnswer = obj.acceptedAnswer || obj.acceptedAnswers || obj.answer;
    const a = this.cleanText(this.answerToText(acceptedAnswer));

    if (!q) return null;
    return { q, a };
  }

  private answerToText(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((item) => this.answerToText(item)).join(" ");
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return String(obj.text || obj.articleBody || obj.name || "");
    }
    return "";
  }

  private hasType(obj: Record<string, unknown>, expected: string): boolean {
    const rawType = obj["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    return types.some((item) => typeof item === "string" && item.toLowerCase() === expected.toLowerCase());
  }

  private extractVisibleQAs($: cheerio.Root): QA[] {
    const items: QA[] = [];
    const push = (qRaw: string, aRaw: string) => {
      const q = this.cleanText(qRaw);
      const a = this.cleanText(aRaw);
      if (!q || q.length < 3) return;
      if (!this.isLikelyFaqQuestion(q)) return;
      items.push({ q, a });
    };

    $("details").each((_, element) => {
      const $details = $(element);
      const question = $details.find("summary").first().text();
      const answer = $details.clone().find("summary").remove().end().text();
      push(question, answer);
    });

    $('[itemscope][itemtype*="Question"]').each((_, element) => {
      const $item = $(element);
      const question = $item.find('[itemprop="name"]').first().text();
      const answer = $item.find('[itemprop="acceptedAnswer"] [itemprop="text"], [itemprop="answer"] [itemprop="text"], [itemprop="text"]').first().text();
      push(question, answer);
    });

    $("[aria-controls]").each((_, element) => {
      const $trigger = $(element);
      const id = $trigger.attr("aria-controls");
      if (!id) return;
      const $panel = $(`#${this.escapeSelector(id)}`);
      if (!$panel.length) return;
      if (!this.looksFaqRelated($trigger, $panel)) return;
      push($trigger.text(), $panel.text());
    });

    $(".faq, .faqs, [class*='faq'], [id*='faq'], [data-faq], [data-faq-item], .accordion, [class*='accordion']").each((_, scope) => {
      const $scope = $(scope);
      $scope.find("details, [itemscope][itemtype*='Question']").remove();
      $scope.find(".faq-item, .faq__item, [data-faq-item], .accordion-item, .accordion__item, li, article").each((__, element) => {
        const $item = $(element);
        const question = $item.find("summary, button, h2, h3, h4, [data-question], .question, .faq-question, .accordion-title").first().text();
        const answer =
          $item.find("[data-answer], .answer, .faq-answer, .accordion-body, .accordion__panel, [class*='panel'], [class*='content']").first().text()
          || $item.clone()
            .find("summary, button, h1, h2, h3, h4, h5, h6, [data-question], .question, .faq-question, .accordion-title")
            .remove()
            .end()
            .text();
        push(question, answer);
      });
    });

    return this.dedupeQAs(items);
  }

  private isLikelyFaqQuestion(value: string): boolean {
    const text = this.cleanText(value);
    if (!text) return false;
    if (text.length > 240) return false;
    if (/[?？؟]\s*$/.test(text)) return true;

    return /^(what|when|where|who|why|how|which|does|do|is|are|can|could|should|will|would|may|am|has|have|had|did|כמה|איך|מתי|איפה|האם|מה|מי|למה|איזה|אילו)\b/i.test(text);
  }

  private looksFaqRelated($trigger: cheerio.Cheerio, $panel: cheerio.Cheerio): boolean {
    const text = `${$trigger.attr("class") || ""} ${$trigger.attr("id") || ""} ${$panel.attr("class") || ""} ${$panel.attr("id") || ""}`.toLowerCase();
    return /faq|question|answer|accordion|collapse/.test(text);
  }

  private compareQAs(visibleQAs: QA[], schemaQAs: QA[]): { visibleOnly: string[]; schemaOnly: string[] } {
    const comparison = this.compareQaCollections(visibleQAs, schemaQAs);

    return {
      visibleOnly: comparison.sourceOnly.map((item) => item.source.q),
      schemaOnly: comparison.targetOnly.map((item) => item.target.q),
    };
  }

  private compareQaCollections<TSource extends QA, TTarget extends QA>(
    sourceQAs: TSource[],
    targetQAs: TTarget[]
  ): {
    matched: Array<{ source: TSource; target: TTarget; questionSimilarity: number }>;
    sourceOnly: Array<{ source: TSource; questionSimilarity: number }>;
    targetOnly: Array<{ target: TTarget; questionSimilarity: number }>;
  } {
    const matched: Array<{ source: TSource; target: TTarget; questionSimilarity: number }> = [];
    const sourceOnly: Array<{ source: TSource; questionSimilarity: number }> = [];
    const targetUsed = new Set<number>();

    for (const source of sourceQAs) {
      let bestIndex = -1;
      let bestScore = 0;

      for (let index = 0; index < targetQAs.length; index++) {
        if (targetUsed.has(index)) continue;
        const score = this.questionSimilarity(source.q, targetQAs[index]?.q || "");
        if (score > bestScore) {
          bestIndex = index;
          bestScore = score;
        }
      }

      if (bestIndex >= 0 && bestScore >= 0.92) {
        targetUsed.add(bestIndex);
        matched.push({
          source,
          target: targetQAs[bestIndex],
          questionSimilarity: bestScore,
        });
      } else {
        sourceOnly.push({ source, questionSimilarity: bestScore });
      }
    }

    const targetOnly = targetQAs
      .map((target, index) => ({ target, index }))
      .filter((item) => !targetUsed.has(item.index))
      .map((item) => ({ target: item.target, questionSimilarity: 0 }));

    return { matched, sourceOnly, targetOnly };
  }

  private async fetchPage(
    url: string,
    config: NormalizedSiteFaqAuditConfig
  ): Promise<PageFetchResult> {
    if (config.renderMode === "rendered") {
      try {
        return await this.fetchRenderedPage(url, config);
      } catch {
        return await this.fetchStaticPage(url, config, false);
      }
    }

    return await this.fetchStaticPage(url, config, false);
  }

  private async fetchStaticPage(
    url: string,
    config: NormalizedSiteFaqAuditConfig,
    rendered: boolean
  ): Promise<PageFetchResult> {
    const response = await fetch(url, {
      headers: {
        "user-agent": config.userAgent,
        "accept-language": config.acceptLanguage,
      },
    });

    if (!response.ok) {
      throw new Error(`GET ${url} -> ${response.status}`);
    }

    return {
      url,
      status: response.status,
      html: await response.text(),
      rendered,
    };
  }

  private async fetchRenderedPage(
    url: string,
    config: NormalizedSiteFaqAuditConfig
  ): Promise<PageFetchResult> {
    const mod: any = await (Function("return import('playwright')")() as Promise<any>);
    const browser = await mod.chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "accept-language": config.acceptLanguage,
      "user-agent": config.userAgent,
    });
    await page.setViewportSize({ width: 1365, height: 900 });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("body", { timeout: 20_000 }).catch(() => {});
    await this.openFaqControls(page);
    const html = await page.content();
    await browser.close();

    return {
      url,
      status: response?.status?.() ?? 200,
      html,
      rendered: true,
    };
  }

  private async openFaqControls(page: any): Promise<void> {
    const selectors = [
      "summary",
      "[aria-controls]",
      "[data-faq-item] button",
      "[data-accordion-trigger]",
      ".accordion-button",
      ".accordion__button",
      ".accordion-header button",
    ];

    for (const selector of selectors) {
      const loc = page.locator(selector);
      const count = await loc.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 80); index++) {
        try {
          await loc.nth(index).click({ force: true, timeout: 1000 });
          await page.waitForTimeout(40);
        } catch {
          // Best effort only.
        }
      }
    }

    await page.locator("details").evaluateAll((nodes: any[]) => {
      nodes.forEach((node: any) => {
        node.open = true;
      });
    }).catch(() => {});
  }

  private async compareAgainstSources(
    result: SiteFaqAuditResult,
    config: NormalizedSiteFaqAuditConfig
  ): Promise<SourceComparisonResult> {
    const sheets = new SheetsService("info@carmelon.co.il");
    const sourceFiles = await this.resolveSourceFiles(config, sheets);
    const files: SourceFileComparison[] = [];
    const sourceRows: SourceFaqRow[] = [];

    for (const sourceFile of sourceFiles) {
      try {
        const rows = await this.readSourceRows(sheets, sourceFile, config);
        sourceRows.push(...rows);

        if (!rows.length) {
          files.push({
            sourceFile: sourceFile.name,
            spreadsheetId: sourceFile.id,
            tabName: config.sourceTabName || "",
            status: "no-questions",
            matchedPageUrl: "",
            matchedPageTitle: "",
            matchedBy: "",
            sourceQuestionCount: 0,
            siteQuestionCount: 0,
            matchedQuestionCount: 0,
            sourceOnlyQuestions: [],
            siteOnlyQuestions: [],
            sourceOnlyItems: [],
            siteOnlyItems: [],
            questionMismatches: [],
            answerMismatches: [],
            duplicateQuestions: [],
            qaIssues: [],
            notes: ["No source FAQ questions were detected in the configured tab."],
          });
          continue;
        }

        files.push(this.compareSourceFileToSite(sourceFile, rows, result.pages));
      } catch (error) {
        files.push({
          sourceFile: sourceFile.name,
          spreadsheetId: sourceFile.id,
          tabName: config.sourceTabName || "",
          status: "read-failed",
          matchedPageUrl: "",
          matchedPageTitle: "",
          matchedBy: "",
          sourceQuestionCount: 0,
          siteQuestionCount: 0,
          matchedQuestionCount: 0,
          sourceOnlyQuestions: [],
          siteOnlyQuestions: [],
          sourceOnlyItems: [],
          siteOnlyItems: [],
          questionMismatches: [],
          answerMismatches: [],
          duplicateQuestions: [],
          qaIssues: [],
          notes: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    const siteIssues = this.buildSiteQualityIssues(result.pages);
    const issues = [...siteIssues, ...files.flatMap((file) => file.qaIssues)];

    return {
      enabled: true,
      sourceFilesFound: sourceFiles.length,
      sourceFilesRead: files.filter((file) => file.status !== "read-failed").length,
      sourceFilesFailed: files.filter((file) => file.status === "read-failed").length,
      totalSourceQuestions: sourceRows.length,
      matchedPages: files.filter((file) => Boolean(file.matchedPageUrl)).length,
      missingOnSite: files.reduce((sum, file) => sum + file.sourceOnlyQuestions.length, 0),
      extraOnSite: files.reduce((sum, file) => sum + file.siteOnlyQuestions.length, 0),
      questionMismatches: files.reduce((sum, file) => sum + file.questionMismatches.length, 0),
      answerMismatches: files.reduce((sum, file) => sum + file.answerMismatches.length, 0),
      qaIssueCount: issues.length,
      files,
      issues,
      sourceRows,
    };
  }

  private async resolveSourceFiles(
    config: NormalizedSiteFaqAuditConfig,
    sheets: SheetsService
  ): Promise<SourceFileRef[]> {
    const parsed = this.parseSourceInput(config);
    const out: SourceFileRef[] = [];

    for (const folderId of parsed.folderIds) {
      const files = await sheets.listSpreadsheetsInFolderWithNamesRecursive(folderId);
      out.push(...files.map((file) => ({ id: file.id, name: file.name })));
    }

    for (const id of parsed.spreadsheetIds) {
      const name = await sheets.getSpreadsheetTitle(id).catch(() => id);
      out.push({ id, name });
    }

    const seen = new Set<string>();
    return out.filter((file) => {
      if (!file.id || seen.has(file.id)) return false;
      seen.add(file.id);
      return true;
    });
  }

  private parseSourceInput(config: NormalizedSiteFaqAuditConfig): { folderIds: string[]; spreadsheetIds: string[] } {
    const folderIds: string[] = [];
    const spreadsheetIds: string[] = [];
    const inputs = [
      config.sourceFolderId,
      ...config.sourceSpreadsheetIds,
      ...config.sourceInput.split(/\r?\n|,/),
    ].map((item) => item.trim()).filter(Boolean);

    for (const value of inputs) {
      const spreadsheetId = this.extractSpreadsheetId(value);
      if (spreadsheetId) {
        spreadsheetIds.push(spreadsheetId);
        continue;
      }

      const folderId = this.extractFolderId(value);
      if (folderId) {
        folderIds.push(folderId);
      }
    }

    return {
      folderIds: Array.from(new Set(folderIds)),
      spreadsheetIds: Array.from(new Set(spreadsheetIds)),
    };
  }

  private extractSpreadsheetId(value: string): string {
    const clean = value.trim();
    const urlMatch = clean.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
    if (urlMatch?.[1]) return urlMatch[1];
    if (/^[A-Za-z0-9-_]{30,}$/.test(clean) && !/folders/i.test(clean)) return clean;
    return "";
  }

  private extractFolderId(value: string): string {
    const clean = value.trim();
    const urlMatch = clean.match(/\/folders\/([A-Za-z0-9-_]+)/);
    if (urlMatch?.[1]) return urlMatch[1];
    const idParam = clean.match(/[?&]id=([A-Za-z0-9-_]+)/);
    if (idParam?.[1]) return idParam[1];
    return "";
  }

  private async readSourceRows(
    sheets: SheetsService,
    sourceFile: SourceFileRef,
    config: NormalizedSiteFaqAuditConfig
  ): Promise<SourceFaqRow[]> {
    const tabName = config.sourceTabName.trim() || await sheets.getFirstSheetTitle(sourceFile.id);
    const rows = await sheets.readValues(sourceFile.id, `${this.quoteA1Sheet(tabName)}!A:Z`);
    const headerIndex = config.sourceHeaderRow > 0
      ? config.sourceHeaderRow - 1
      : this.detectSourceHeaderRow(rows);
    const header = rows[headerIndex] || [];
    const columns = this.detectSourceColumns(header);
    const out: SourceFaqRow[] = [];

    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] || [];
      const q = this.cleanText(row[columns.question] || "");
      if (!q || !this.isLikelyFaqQuestion(q)) continue;

      const answerSource = columns.finalAnswer >= 0 && this.cleanText(row[columns.finalAnswer] || "")
        ? row[columns.finalAnswer]
        : row[columns.answer] || "";
      const a = this.cleanText(answerSource || "");

      out.push({
        sourceFile: sourceFile.name,
        spreadsheetId: sourceFile.id,
        tabName,
        rowNumber: rowIndex + 1,
        category: columns.category >= 0 ? this.cleanText(row[columns.category] || "") : "",
        q,
        a,
      });
    }

    return out;
  }

  private detectSourceHeaderRow(rows: string[][]): number {
    for (let index = 0; index < Math.min(rows.length, 10); index++) {
      const headers = (rows[index] || []).map((cell) => this.normalizeHeader(cell));
      const hasQuestion = headers.some((cell) => cell === "question" || cell === "שאלה");
      const hasAnswer = headers.some((cell) => cell === "answer" || cell === "finalanswer" || cell === "תשובה");
      if (hasQuestion && hasAnswer) return index;
    }

    return 0;
  }

  private detectSourceColumns(header: string[]): { category: number; question: number; answer: number; finalAnswer: number } {
    const headers = header.map((cell) => this.normalizeHeader(cell));
    const find = (candidates: string[]) => headers.findIndex((cell) => candidates.includes(cell));
    const question = find(["question", "questions", "שאלה", "שאלות"]);
    const answer = find(["answer", "answers", "תשובה", "תשובות"]);
    const finalAnswer = find(["finalanswer", "finalanswers", "final", "תשובהסופית"]);
    const category = find(["category", "section", "topic", "קטגוריה", "נושא"]);

    return {
      category: category >= 0 ? category : 0,
      question: question >= 0 ? question : 1,
      answer: answer >= 0 ? answer : 2,
      finalAnswer,
    };
  }

  private compareSourceFileToSite(
    sourceFile: SourceFileRef,
    sourceRows: SourceFaqRow[],
    pages: FaqAuditPageResult[]
  ): SourceFileComparison {
    const match = this.findBestPageMatch(sourceFile.name, pages);
    const duplicateQuestions = this.findDuplicateQuestions(sourceRows);
    const qaIssues = this.buildQualityIssues(
      sourceRows,
      { scope: "source", sourceFile: sourceFile.name }
    );

    if (!match.page) {
      return {
        sourceFile: sourceFile.name,
        spreadsheetId: sourceFile.id,
        tabName: sourceRows[0]?.tabName || "",
        status: "no-page-match",
        matchedPageUrl: "",
        matchedPageTitle: "",
        matchedBy: "",
        sourceQuestionCount: sourceRows.length,
        siteQuestionCount: 0,
        matchedQuestionCount: 0,
        sourceOnlyQuestions: sourceRows.map((row) => row.q),
        siteOnlyQuestions: [],
        sourceOnlyItems: sourceRows.map((row) => ({
          sourceQuestion: row.q,
          sourceAnswer: row.a,
          siteQuestion: "",
          siteAnswer: "",
          questionSimilarity: 0,
        })),
        siteOnlyItems: [],
        questionMismatches: [],
        answerMismatches: [],
        duplicateQuestions,
        qaIssues,
        notes: ["No matching FAQ page was found for this source file name."],
      };
    }

    const siteQAs = this.getSiteQAsForComparison(match.page);
    const qaComparison = this.compareQaCollections(sourceRows, siteQAs);
    const sourceOnlyItems = qaComparison.sourceOnly.map((item) => ({
      sourceQuestion: item.source.q,
      sourceAnswer: item.source.a,
      siteQuestion: "",
      siteAnswer: "",
      questionSimilarity: item.questionSimilarity,
    }));
    const siteOnlyItems = qaComparison.targetOnly.map((item) => ({
      sourceQuestion: "",
      sourceAnswer: "",
      siteQuestion: item.target.q,
      siteAnswer: item.target.a,
      questionSimilarity: item.questionSimilarity,
    }));
    const sourceOnlyQuestions = sourceOnlyItems.map((item) => item.sourceQuestion);
    const siteOnlyQuestions = siteOnlyItems.map((item) => item.siteQuestion);
    const questionMismatches: FaqQuestionMismatch[] = [];
    const answerMismatches: FaqAnswerMismatch[] = [];

    for (const item of qaComparison.matched) {
      const questionComparison = this.compareMeaningfulText(item.source.q, item.target.q);
      if (
        questionComparison.reasons.length > 0 ||
        item.questionSimilarity < 0.98
      ) {
        questionMismatches.push({
          sourceQuestion: item.source.q,
          sourceAnswer: item.source.a,
          siteQuestion: item.target.q,
          siteAnswer: item.target.a,
          questionSimilarity: item.questionSimilarity,
          similarity: questionComparison.similarity,
          reasons: questionComparison.reasons,
        });
      }

      if (!item.source.a || !item.target.a) continue;
      const answerComparison = this.compareMeaningfulText(item.source.a, item.target.a);
      if (answerComparison.similarity < 0.9 || answerComparison.reasons.length > 0) {
        answerMismatches.push({
          question: item.source.q,
          sourceQuestion: item.source.q,
          sourceAnswer: item.source.a,
          siteQuestion: item.target.q,
          siteAnswer: item.target.a,
          questionSimilarity: item.questionSimilarity,
          similarity: answerComparison.similarity,
          reasons: answerComparison.reasons,
        });
      }
    }

    return {
      sourceFile: sourceFile.name,
      spreadsheetId: sourceFile.id,
      tabName: sourceRows[0]?.tabName || "",
      status: "ok",
      matchedPageUrl: match.page.url,
      matchedPageTitle: match.page.title || match.page.h1 || "",
      matchedBy: match.matchedBy,
      sourceQuestionCount: sourceRows.length,
      siteQuestionCount: siteQAs.length,
      matchedQuestionCount: qaComparison.matched.length,
      sourceOnlyQuestions,
      siteOnlyQuestions,
      sourceOnlyItems,
      siteOnlyItems,
      questionMismatches,
      answerMismatches,
      duplicateQuestions,
      qaIssues,
      notes: [
        `Matched by ${match.matchedBy}.`,
        `Compared source questions to ${match.page.visibleQAs.length ? "visible FAQ" : "schema FAQ"}.`,
      ],
    };
  }

  private findBestPageMatch(
    sourceFileName: string,
    pages: FaqAuditPageResult[]
  ): { page: FaqAuditPageResult | null; matchedBy: string } {
    let best: { page: FaqAuditPageResult | null; score: number } = { page: null, score: 0 };

    for (const page of pages) {
      const score = this.sourcePageMatchScore(sourceFileName, page);
      if (score > best.score) best = { page, score };
    }

    if (!best.page || best.score < 60) return { page: null, matchedBy: "" };
    return {
      page: best.page,
      matchedBy: best.score >= 95 ? "file-name-url" : "file-name-tokens",
    };
  }

  private sourcePageMatchScore(sourceFileName: string, page: FaqAuditPageResult): number {
    const sourceSlug = this.slugify(sourceFileName);
    const pageText = this.slugify(`${page.url} ${page.title} ${page.h1}`);
    if (sourceSlug && pageText.includes(sourceSlug)) return 100;

    const tokens = sourceSlug
      .split("-")
      .filter((token) => token.length > 1 && !["faq", "sheet", "questions", "question", "source"].includes(token));
    const significant = tokens.filter((token) => !["master", "hotel", "apartments", "apartment"].includes(token));
    if (!tokens.length) return 0;
    if (significant.length && !significant.some((token) => pageText.includes(token))) return 0;

    const matched = tokens.filter((token) => pageText.includes(token)).length;
    return Math.round((matched / tokens.length) * 100);
  }

  private getSiteQAsForComparison(page: FaqAuditPageResult): QA[] {
    return page.visibleQAs.length ? page.visibleQAs : page.schemaQAs;
  }

  private buildSiteQualityIssues(pages: FaqAuditPageResult[]): FaqTextIssue[] {
    const issues: FaqTextIssue[] = [];

    for (const page of pages) {
      issues.push(...this.buildQualityIssues(page.visibleQAs, { scope: "site", url: page.url }));
      if (page.invalidJsonLdCount) {
        issues.push({
          scope: "site",
          severity: "warning",
          type: "invalid-json-ld",
          url: page.url,
          detail: `${page.invalidJsonLdCount} invalid JSON-LD script(s) were detected.`,
          recommendedAction: "Validate the JSON-LD syntax and fix malformed structured data blocks.",
        });
      }
    }

    return issues;
  }

  private buildQualityIssues(
    qas: Array<QA & Partial<SourceFaqRow>>,
    meta: { scope: FaqTextIssueScope; sourceFile?: string; url?: string }
  ): FaqTextIssue[] {
    const issues: FaqTextIssue[] = [];
    const duplicateMap = new Map<string, Array<QA & Partial<SourceFaqRow>>>();

    for (const item of qas) {
      const key = this.norm(item.q);
      if (!key) continue;
      duplicateMap.set(key, [...(duplicateMap.get(key) || []), item]);
    }

    for (const group of duplicateMap.values()) {
      if (group.length < 2) continue;
      issues.push(this.textIssue(meta, group[0], "duplicate-question", `Question appears ${group.length} times in the same ${meta.scope === "source" ? "source file" : "page"}.`, "Keep one canonical Q/A or intentionally split the wording so duplicates are clear."));
    }

    for (const item of qas) {
      const question = this.cleanText(item.q);
      const answer = this.cleanText(item.a);

      if (!answer || answer.length < 8) {
        issues.push(this.textIssue(meta, item, "short-answer", "Answer is empty or very short.", "Add a complete answer before publishing or adding it to schema."));
      }

      if (this.hasHtmlEntityResidue(question) || this.hasHtmlEntityResidue(answer)) {
        issues.push(this.textIssue(meta, item, "html-entity", "HTML entity residue is visible in the text.", "Decode entities such as &#8217; before publishing."));
      }

      if (this.hasUnbalancedDoubleQuotes(question) || this.hasUnbalancedDoubleQuotes(answer)) {
        issues.push(this.textIssue(meta, item, "unbalanced-quotes", "Double quotation marks look unbalanced.", "Review the sentence and close or remove the stray quote."));
      }

      if (/[?!]{2,}|\.{3,}|,,|;;/.test(question) || /[?!]{2,}|,,|;;/.test(answer)) {
        issues.push(this.textIssue(meta, item, "repeated-punctuation", "Repeated punctuation was detected.", "Clean obvious punctuation typos."));
      }

      if (/^[?!.,:;]/.test(question)) {
        issues.push(this.textIssue(meta, item, "leading-punctuation", "Question starts with punctuation.", "Move punctuation to the end of the question."));
      }

      if (this.startsLikeQuestion(question) && !/[?؟？]\s*$/.test(question)) {
        issues.push(this.textIssue(meta, item, "missing-question-mark", "Question looks like a question but does not end with a question mark.", "Add a question mark or rewrite the sentence as a statement."));
      }

      if (/[�]/.test(question) || /[�]/.test(answer)) {
        issues.push(this.textIssue(meta, item, "replacement-character", "Replacement character was detected.", "Check encoding before publishing."));
      }

      if (this.hasPlaceholderText(question) || this.hasPlaceholderText(answer)) {
        issues.push(this.textIssue(meta, item, "placeholder-text", "Placeholder text was detected.", "Replace placeholder text with final customer-facing content."));
      }
    }

    return issues;
  }

  private textIssue(
    meta: { scope: FaqTextIssueScope; sourceFile?: string; url?: string },
    item: QA & Partial<SourceFaqRow>,
    type: string,
    detail: string,
    recommendedAction: string
  ): FaqTextIssue {
    return {
      scope: meta.scope,
      severity: "warning",
      type,
      sourceFile: meta.sourceFile,
      url: meta.url,
      rowNumber: item.rowNumber,
      question: item.q,
      answerPreview: this.cleanText(item.a || "").slice(0, 300),
      detail,
      recommendedAction,
    };
  }

  private findDuplicateQuestions(qas: Array<QA>): string[] {
    const byQuestion = new Map<string, QA[]>();
    for (const item of qas) {
      const key = this.norm(item.q);
      byQuestion.set(key, [...(byQuestion.get(key) || []), item]);
    }

    return Array.from(byQuestion.values())
      .filter((items) => items.length > 1)
      .map((items) => items[0]?.q || "")
      .filter(Boolean);
  }

  private textSimilarity(a: string, b: string): number {
    const aTokens = new Set(this.norm(a).split(" ").filter((token) => token.length > 2));
    const bTokens = new Set(this.norm(b).split(" ").filter((token) => token.length > 2));
    if (!aTokens.size && !bTokens.size) return 1;
    if (!aTokens.size || !bTokens.size) return 0;
    const intersection = Array.from(aTokens).filter((token) => bTokens.has(token)).length;
    const union = new Set([...aTokens, ...bTokens]).size;
    return union ? intersection / union : 0;
  }

  private compareMeaningfulText(a: string, b: string): { similarity: number; reasons: string[] } {
    const similarity = this.textSimilarity(a, b);
    const reasons = [
      ...this.findExactTextDifferences(a, b),
      ...this.findFactualSignalDifferences(a, b),
    ];
    return { similarity, reasons };
  }

  private findExactTextDifferences(source: string, site: string): string[] {
    const sourceText = this.normalizeComparableText(source);
    const siteText = this.normalizeComparableText(site);

    if (sourceText === siteText) {
      return [];
    }

    const reasons: string[] = [];
    const sourceTokens = this.tokenizeComparableText(sourceText);
    const siteTokens = this.tokenizeComparableText(siteText);
    const caseDifferences = this.findCaseOnlyTokenDifferences(sourceTokens, siteTokens);

    if (sourceText.toLowerCase() === siteText.toLowerCase()) {
      reasons.push("הטקסט זהה מבחינת מילים, אבל שונה באותיות גדולות/קטנות.");
      if (caseDifferences.length) {
        reasons.push(`הבדלי אותיות לדוגמה: ${caseDifferences.join(", ")}.`);
      }
      return reasons;
    }

    const missingTokens = this.diffTokenMultiset(sourceTokens, siteTokens);
    const extraTokens = this.diffTokenMultiset(siteTokens, sourceTokens);

    if (missingTokens.length) {
      reasons.push(`מילים/ערכים חסרים באתר: ${this.formatTokenExamples(missingTokens)}.`);
    }

    if (extraTokens.length) {
      reasons.push(`מילים/ערכים שמופיעים באתר ולא במקור: ${this.formatTokenExamples(extraTokens)}.`);
    }

    if (caseDifferences.length) {
      reasons.push(`הבדלי אותיות לדוגמה: ${caseDifferences.join(", ")}.`);
    }

    if (!reasons.length) {
      reasons.push("הנוסח באתר אינו זהה לנוסח המקור לאחר ניקוי HTML ורווחים.");
    }

    return reasons;
  }

  private normalizeComparableText(value: string): string {
    return this.cleanText(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  private tokenizeComparableText(value: string): string[] {
    return this.normalizeComparableText(value).match(/[\p{L}\p{N}]+(?:[:.'’-][\p{L}\p{N}]+)*/gu) || [];
  }

  private diffTokenMultiset(sourceTokens: string[], siteTokens: string[]): string[] {
    const available = new Map<string, number>();
    for (const token of siteTokens) {
      const key = this.tokenCompareKey(token);
      available.set(key, (available.get(key) || 0) + 1);
    }

    const out: string[] = [];
    for (const token of sourceTokens) {
      const key = this.tokenCompareKey(token);
      const count = available.get(key) || 0;

      if (count) {
        available.set(key, count - 1);
        continue;
      }

      out.push(token);
    }

    return out;
  }

  private findCaseOnlyTokenDifferences(sourceTokens: string[], siteTokens: string[]): string[] {
    const siteVariantsByKey = new Map<string, string[]>();
    for (const token of siteTokens) {
      const key = this.tokenCompareKey(token);
      siteVariantsByKey.set(key, [...(siteVariantsByKey.get(key) || []), token]);
    }

    const differences: string[] = [];
    for (const token of sourceTokens) {
      const variants = siteVariantsByKey.get(this.tokenCompareKey(token)) || [];
      const differentCase = variants.find((variant) => variant !== token && variant.toLowerCase() === token.toLowerCase());

      if (differentCase) {
        differences.push(`מקור "${token}" מול אתר "${differentCase}"`);
      }
    }

    return this.uniqueStrings(differences).slice(0, 8);
  }

  private tokenCompareKey(value: string): string {
    return value.toLowerCase();
  }

  private formatTokenExamples(tokens: string[]): string {
    const unique = this.uniqueStrings(tokens);
    const shown = unique.slice(0, 12).map((token) => `"${token}"`).join(", ");
    return unique.length > 12 ? `${shown} ועוד ${unique.length - 12}` : shown;
  }

  private findFactualSignalDifferences(a: string, b: string): string[] {
    const reasons: string[] = [];
    const sourceTimes = this.extractTimeSignals(a);
    const siteTimes = this.extractTimeSignals(b);

    if (!this.sameStringSet(sourceTimes, siteTimes)) {
      reasons.push(`שעות/פורמט זמן לא תואמים: מקור ${this.formatSignalList(sourceTimes)} | אתר ${this.formatSignalList(siteTimes)}`);
    }

    const sourceNumbers = this.extractNumberSignals(a);
    const siteNumbers = this.extractNumberSignals(b);

    if (!this.sameStringSet(sourceNumbers, siteNumbers)) {
      reasons.push(`מספרים לא תואמים: מקור ${this.formatSignalList(sourceNumbers)} | אתר ${this.formatSignalList(siteNumbers)}`);
    }

    return reasons;
  }

  private extractTimeSignals(value: string): string[] {
    const cleaned = this.cleanText(value).toLowerCase();
    const matches = cleaned.match(
      /\b(?:[01]?\d|2[0-3])(?:\s*:\s*[0-5]\d|\s*:)?\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/g
    ) || [];

    return this.uniqueStrings(matches.map((match) => match.replace(/\s+/g, " ").replace(/\s*:\s*/g, ":").trim()));
  }

  private extractNumberSignals(value: string): string[] {
    const withoutTimes = this.cleanText(value)
      .toLowerCase()
      .replace(
        /\b(?:[01]?\d|2[0-3])(?:\s*:\s*[0-5]\d|\s*:)?\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:[01]?\d|2[0-3])[:.][0-5]\d\b/g,
        " "
      );
    const matches = withoutTimes.match(/\b\d+(?:[.,]\d+)?(?:\s?%|st|nd|rd|th)?\b/g) || [];

    return this.uniqueStrings(matches.map((match) => match.replace(",", ".").replace(/\s+/g, "").trim()));
  }

  private uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }

  private sameStringSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  private formatSignalList(values: string[]): string {
    return values.length ? values.join(", ") : "אין";
  }

  private questionSimilarity(a: string, b: string): number {
    const aNorm = this.norm(a);
    const bNorm = this.norm(b);
    if (!aNorm && !bNorm) return 1;
    if (!aNorm || !bNorm) return 0;
    if (aNorm === bNorm) return 1;

    const aCompact = aNorm.replace(/\s+/g, "");
    const bCompact = bNorm.replace(/\s+/g, "");
    if (aCompact === bCompact) return 1;

    const lengthRatio = Math.min(aCompact.length, bCompact.length) / Math.max(aCompact.length, bCompact.length);
    const containmentScore = (aCompact.includes(bCompact) || bCompact.includes(aCompact)) && lengthRatio > 0.8
      ? lengthRatio
      : 0;

    return Math.max(this.textSimilarity(a, b), containmentScore);
  }

  private normalizeHeader(value: string): string {
    return this.cleanText(value).toLowerCase().replace(/[^a-zא-ת0-9]+/g, "");
  }

  private quoteA1Sheet(tabName: string): string {
    return `'${tabName.replace(/'/g, "''")}'`;
  }

  private slugify(value: string): string {
    return this.cleanText(value)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9א-ת]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private hasHtmlEntityResidue(value: string): boolean {
    return /&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);/i.test(value);
  }

  private hasPlaceholderText(value: string): boolean {
    const text = this.cleanText(value);
    return /\bTODO\b/.test(text)
      || /\bTBD\b/i.test(text)
      || /\blorem ipsum\b/i.test(text)
      || /\bplaceholder\b/i.test(text)
      || /\bto be (?:added|confirmed|determined)\b/i.test(text);
  }

  private hasUnbalancedDoubleQuotes(value: string): boolean {
    const normalized = value
      .replace(/[“”„‟]/g, "\"")
      .replace(/(?<=[\u0590-\u05ff])["״](?=[\u0590-\u05ff])/g, "");
    const count = (normalized.match(/"/g) || []).length;
    return count % 2 === 1;
  }

  private startsLikeQuestion(value: string): boolean {
    return /^(what|when|where|who|why|how|which|does|do|is|are|can|could|should|will|would|may|am|has|have|had|did|כמה|איך|מתי|איפה|האם|מה|מי|למה|איזה|אילו)\b/i.test(this.cleanText(value));
  }

  private async writeGoogleSheetReport(
    result: SiteFaqAuditResult,
    config: NormalizedSiteFaqAuditConfig
  ): Promise<{ id: string; url: string }> {
    const sheets = new SheetsService("info@carmelon.co.il");
    const title = config.reportTitle
      || `FAQ Audit - ${new URL(result.normalizedStartUrl).host} - ${new Date().toISOString().slice(0, 10)}`;
    const spreadsheetId = await sheets.createSpreadsheet(title);
    const firstTab = await sheets.getFirstSheetTitle(spreadsheetId);

    await sheets.renameSheet(spreadsheetId, firstTab, "Summary");
    await sheets.ensureTab(spreadsheetId, "לטיפול");
    await sheets.ensureTab(spreadsheetId, "Pages");
    await sheets.ensureTab(spreadsheetId, "Gaps");
    await sheets.ensureTab(spreadsheetId, "Questions");
    if (result.sourceComparison?.enabled) {
      await sheets.ensureTab(spreadsheetId, "Source Compare");
      await sheets.ensureTab(spreadsheetId, "QA Checks");
      await sheets.ensureTab(spreadsheetId, "Source Questions");
    }

    await sheets.writeValues(spreadsheetId, this.a1("Summary", "A1"), this.buildSummaryRows(result));
    await sheets.writeValues(spreadsheetId, this.a1("לטיפול", "A1"), this.buildActionItemRows(result));
    await sheets.writeValues(spreadsheetId, this.a1("Pages", "A1"), this.buildPageRows(result));
    await sheets.writeValues(spreadsheetId, this.a1("Gaps", "A1"), this.buildGapRows(result));
    await sheets.writeValues(spreadsheetId, this.a1("Questions", "A1"), this.buildQuestionRows(result));
    if (result.sourceComparison?.enabled) {
      await sheets.writeValues(spreadsheetId, this.a1("Source Compare", "A1"), this.buildSourceCompareRows(result));
      await sheets.writeValues(spreadsheetId, this.a1("QA Checks", "A1"), this.buildQualityIssueRows(result));
      await sheets.writeValues(spreadsheetId, this.a1("Source Questions", "A1"), this.buildSourceQuestionRows(result));
    }

    const formatTasks = [
      sheets.formatSheetLikeFAQ(spreadsheetId, "Summary").catch(() => {}),
      sheets.formatSheetLikeFAQ(spreadsheetId, "לטיפול").catch(() => {}),
      sheets.formatSheetLikeFAQ(spreadsheetId, "Pages").catch(() => {}),
      sheets.formatSheetLikeFAQ(spreadsheetId, "Gaps").catch(() => {}),
      sheets.formatSheetLikeFAQ(spreadsheetId, "Questions").catch(() => {}),
    ];

    if (result.sourceComparison?.enabled) {
      formatTasks.push(
        sheets.formatSheetLikeFAQ(spreadsheetId, "Source Compare").catch(() => {}),
        sheets.formatSheetLikeFAQ(spreadsheetId, "QA Checks").catch(() => {}),
        sheets.formatSheetLikeFAQ(spreadsheetId, "Source Questions").catch(() => {}),
      );
    }

    await Promise.all(formatTasks);

    return {
      id: spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  }

  private buildSummaryRows(result: SiteFaqAuditResult): string[][] {
    const rows = [
      ["FAQ Audit Summary", ""],
      ["Site", result.normalizedStartUrl || result.startUrl],
      ["Checked at", result.finishedAt],
      ["Pages checked", String(result.summary.pagesChecked)],
      ["Pages OK", String(result.summary.pagesOk)],
      ["Pages with mismatch", String(result.summary.pagesWithMismatch)],
      ["Pages missing schema", String(result.summary.pagesMissingSchema)],
      ["Pages missing visible FAQ", String(result.summary.pagesMissingVisibleFaq)],
      ["Visible Q/A total", String(result.summary.totalVisibleQuestions)],
      ["Schema Q/A total", String(result.summary.totalSchemaQuestions)],
      ["Languages detected", this.formatLanguageSummary(result.languageSummary)],
      ["Language warnings", String(result.languageSummary.reduce((sum, item) => sum + item.warnings.length, 0))],
      ["", ""],
      ["How to read this report", "Start with the לטיפול tab. It combines all actionable issues from DOM/schema gaps, source-file comparison, and light QA checks."],
    ];

    if (result.sourceComparison?.enabled) {
      rows.push(
        ["", ""],
        ["Source comparison", "Enabled"],
        ["Source files found", String(result.sourceComparison.sourceFilesFound)],
        ["Source files read", String(result.sourceComparison.sourceFilesRead)],
        ["Source questions", String(result.sourceComparison.totalSourceQuestions)],
        ["Matched source files to FAQ pages", String(result.sourceComparison.matchedPages)],
        ["Questions missing on site", String(result.sourceComparison.missingOnSite)],
        ["Extra questions on site", String(result.sourceComparison.extraOnSite)],
        ["Question wording mismatches", String(result.sourceComparison.questionMismatches)],
        ["Answer mismatches", String(result.sourceComparison.answerMismatches)],
        ["QA light-check issues", String(result.sourceComparison.qaIssueCount)],
        ["Source tabs", "Use Source Compare for file-level matching, QA Checks for obvious text problems, and Source Questions for the raw source rows."]
      );
    }

    return rows;
  }

  private formatLanguageSummary(summary: FaqLanguageSummary[]): string {
    if (!summary.length) return "No pages checked";
    return summary
      .map((item) => `${item.name} (${item.code}): ${item.count}`)
      .join(" | ");
  }

  private buildPageRows(result: SiteFaqAuditResult): string[][] {
    return [
      [
        "Status",
        "URL",
        "Title",
        "Detected language",
        "Language source",
        "HTML lang",
        "hreflang alternates",
        "Language warnings",
        "Rendered",
        "Visible Q/A",
        "Schema Q/A",
        "FAQPage objects",
        "Visible-only count",
        "Schema-only count",
        "Main issue",
        "Recommended action",
        "Schema types",
        "Notes",
      ],
      ...result.pages.map((page) => [
        page.auditStatus,
        page.url,
        page.title || page.h1 || "",
        `${page.language.name} (${page.language.code})`,
        `${page.language.source}; ${page.language.confidence}`,
        page.language.htmlLang,
        page.language.hreflangs.join(", "),
        page.language.warnings.join(" | "),
        page.rendered ? "Rendered" : "Static",
        String(page.visibleQaCount),
        String(page.schemaQaCount),
        String(page.faqPageSchemaCount),
        String(page.visibleOnlyQuestions.length),
        String(page.schemaOnlyQuestions.length),
        this.pageIssueSummary(page),
        this.pageRecommendedAction(page),
        page.schemaTypes.join(", "),
        page.notes.join(" | "),
      ]),
    ];
  }

  private buildGapRows(result: SiteFaqAuditResult): string[][] {
    const rows: string[][] = [[
      "Gap type",
      "URL",
      "Title",
      "Question",
      "Why it matters",
      "Recommended action",
    ]];

    for (const page of result.pages) {
      for (const question of page.visibleOnlyQuestions) {
        rows.push([
          "Visible question missing from schema",
          page.url,
          page.title || page.h1 || "",
          question,
          "Users can see this FAQ, but AI/search tools may not receive it as structured FAQPage data.",
          "Add the question and its answer to FAQPage JSON-LD, or remove it from the visible FAQ if it should not be indexed.",
        ]);
      }

      for (const question of page.schemaOnlyQuestions) {
        rows.push([
          "Schema question missing from visible FAQ",
          page.url,
          page.title || page.h1 || "",
          question,
          "Structured data includes a Q/A that the user may not be able to see on the page.",
          "Show the same Q/A visibly on the page, or remove it from FAQPage schema.",
        ]);
      }
    }

    if (rows.length === 1) {
      rows.push(["No gaps", "", "", "", "Visible FAQ and schema are aligned.", "No action needed."]);
    }

    return rows;
  }

  private buildQuestionRows(result: SiteFaqAuditResult): string[][] {
    const rows: string[][] = [[
      "Source",
      "URL",
      "Title",
      "Question",
      "Answer preview",
    ]];

    for (const page of result.pages) {
      for (const item of page.visibleQAs) {
        rows.push(["Visible", page.url, page.title || page.h1 || "", item.q, item.a.slice(0, 500)]);
      }

      for (const item of page.schemaQAs) {
        rows.push(["Schema", page.url, page.title || page.h1 || "", item.q, item.a.slice(0, 500)]);
      }
    }

    return rows;
  }

  private buildActionItemRows(result: SiteFaqAuditResult): string[][] {
    const rows: string[][] = [[
      "תחום",
      "סוג בעיה",
      "עדיפות",
      "סטטוס",
      "קובץ מקור",
      "URL",
      "כותרת",
      "שאלת מקור",
      "תשובת מקור",
      "שאלה באתר / סכמה",
      "תשובת אתר / סכמה",
      "מה הבעיה",
      "מה לעשות",
      "הערות",
    ]];

    const pushRow = (item: {
      area: string;
      issueType: string;
      priority: string;
      status: string;
      sourceFile?: string;
      url?: string;
      title?: string;
      sourceQuestion?: string;
      sourceAnswer?: string;
      siteQuestion?: string;
      siteAnswer?: string;
      problem: string;
      action: string;
      notes?: string;
    }) => {
      rows.push([
        item.area,
        item.issueType,
        item.priority,
        item.status,
        item.sourceFile || "",
        item.url || "",
        item.title || "",
        item.sourceQuestion || "",
        item.sourceAnswer || "",
        item.siteQuestion || "",
        item.siteAnswer || "",
        item.problem,
        item.action,
        item.notes || "",
      ]);
    };

    for (const page of result.pages) {
      if (page.auditStatus === "fetch-failed") {
        pushRow({
          area: "פער עמוד/סכמה",
          issueType: "כשל טעינת עמוד",
          priority: "גבוהה",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          problem: "העמוד לא נטען ולכן לא ניתן לבדוק את ה-FAQ או את הסכמה.",
          action: "לבדוק שהעמוד זמין, שאין חסימה, ולהריץ בדיקה חוזרת.",
          notes: page.notes.join(" | "),
        });
        continue;
      }

      for (const warning of page.language.warnings) {
        pushRow({
          area: "שפה/לוקאל",
          issueType: "חשד לערבוב שפה",
          priority: "בינונית",
          status: "לבדיקה",
          url: page.url,
          title: page.title || page.h1 || "",
          problem: warning,
          action: "לבדוק שהעמוד, ה-URL, html lang, og:locale, hreflang ותוכן ה-FAQ מצביעים לאותה שפה.",
          notes: `Detected: ${page.language.name} (${page.language.code}); source: ${page.language.source}; confidence: ${page.language.confidence}`,
        });
      }

      if (page.auditStatus === "missing-schema") {
        pushRow({
          area: "פער עמוד/סכמה",
          issueType: "FAQ גלוי ללא FAQPage schema",
          priority: "גבוהה",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          problem: `נמצאו ${page.visibleQaCount} שאלות גלויות, אבל לא נמצאה FAQPage schema.`,
          action: "להוסיף FAQPage JSON-LD שמכיל את אותן שאלות ותשובות שמופיעות בעמוד.",
          notes: page.notes.join(" | "),
        });
      }

      if (page.auditStatus === "missing-visible-faq") {
        pushRow({
          area: "פער עמוד/סכמה",
          issueType: "FAQPage schema ללא FAQ גלוי",
          priority: "גבוהה",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          problem: `נמצאו ${page.schemaQaCount} שאלות בסכמה, אבל לא נמצאה תצוגת FAQ גלויה בעמוד.`,
          action: "להציג את אותן שאלות בעמוד או להסיר אותן מהסכמה אם הן לא אמורות להיות גלויות.",
          notes: page.notes.join(" | "),
        });
      }

      if (page.auditStatus === "no-faq") {
        pushRow({
          area: "פער עמוד/סכמה",
          issueType: "לא נמצא FAQ",
          priority: "בינונית",
          status: "לבדיקה",
          url: page.url,
          title: page.title || page.h1 || "",
          problem: "לא זוהו שאלות FAQ גלויות ולא זוהתה FAQPage schema.",
          action: "לוודא אם העמוד אכן אמור לכלול FAQ. אם כן, להוסיף FAQ גלוי וסכמה.",
          notes: page.notes.join(" | "),
        });
      }

      for (const question of page.visibleOnlyQuestions) {
        const visible = page.visibleQAs.find((item) => this.questionSimilarity(item.q, question) >= 0.99);
        pushRow({
          area: "פער עמוד/סכמה",
          issueType: "שאלה גלויה חסרה בסכמה",
          priority: "גבוהה",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          siteQuestion: question,
          siteAnswer: visible?.a || "",
          problem: "השאלה מופיעה בעמוד, אבל לא קיימת ב-FAQPage schema.",
          action: "להוסיף את השאלה והתשובה ל-FAQPage JSON-LD או להסיר אותה מהעמוד אם אינה אמורה להתפרסם.",
        });
      }

      for (const question of page.schemaOnlyQuestions) {
        const schema = page.schemaQAs.find((item) => this.questionSimilarity(item.q, question) >= 0.99);
        pushRow({
          area: "פער עמוד/סכמה",
          issueType: "שאלה בסכמה חסרה בעמוד",
          priority: "גבוהה",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          siteQuestion: question,
          siteAnswer: schema?.a || "",
          problem: "השאלה קיימת ב-FAQPage schema, אבל לא נמצאה כ-FAQ גלוי בעמוד.",
          action: "להציג את אותה שאלה ותשובה בעמוד או להסיר אותה מהסכמה.",
        });
      }

      for (const question of page.emptyVisibleAnswers) {
        pushRow({
          area: "בדיקת QA קלה",
          issueType: "תשובה גלויה קצרה או חסרה",
          priority: "בינונית",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          siteQuestion: question,
          problem: "השאלה הגלויה כוללת תשובה חסרה או קצרה מדי.",
          action: "להשלים תשובה מלאה לפני פרסום או הטמעה בסכמה.",
        });
      }

      for (const question of page.emptySchemaAnswers) {
        pushRow({
          area: "בדיקת QA קלה",
          issueType: "תשובת סכמה קצרה או חסרה",
          priority: "בינונית",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          siteQuestion: question,
          problem: "השאלה בסכמה כוללת תשובה חסרה או קצרה מדי.",
          action: "להשלים את acceptedAnswer.text או להסיר את השאלה מהסכמה.",
        });
      }

      if (page.invalidJsonLdCount) {
        pushRow({
          area: "בדיקת QA קלה",
          issueType: "JSON-LD לא תקין",
          priority: "גבוהה",
          status: "לטיפול",
          url: page.url,
          title: page.title || page.h1 || "",
          problem: `${page.invalidJsonLdCount} בלוקים של JSON-LD לא נקראו בגלל שגיאת סינטקס.`,
          action: "להריץ ולידציה ל-JSON-LD ולתקן פסיקים, סוגריים, גרשיים או escaping.",
        });
      }
    }

    const comparison = result.sourceComparison;
    if (comparison?.enabled) {
      for (const file of comparison.files) {
        if (file.status === "read-failed") {
          pushRow({
            area: "פער מקור/הטמעה",
            issueType: "כשל קריאת קובץ מקור",
            priority: "גבוהה",
            status: "לטיפול",
            sourceFile: file.sourceFile,
            problem: "לא ניתן היה לקרוא את קובץ המקור ולכן לא בוצעה השוואה.",
            action: "לבדוק הרשאות, טאב מקור, ושקובץ Google Sheet תקין.",
            notes: file.notes.join(" | "),
          });
        }

        if (file.status === "no-page-match") {
          pushRow({
            area: "פער מקור/הטמעה",
            issueType: "לא נמצא עמוד FAQ מתאים לקובץ מקור",
            priority: "גבוהה",
            status: "לטיפול",
            sourceFile: file.sourceFile,
            problem: "קובץ המקור נקרא, אבל לא נמצא לו עמוד FAQ מתאים באתר.",
            action: "לבדוק שהעמוד קיים, שה-URL נסרק, וששם הקובץ תואם לשם הנכס.",
            notes: file.notes.join(" | "),
          });
        }

        if (file.status === "no-questions") {
          pushRow({
            area: "פער מקור/הטמעה",
            issueType: "לא נמצאו שאלות בקובץ מקור",
            priority: "בינונית",
            status: "לבדיקה",
            sourceFile: file.sourceFile,
            problem: "קובץ המקור נקרא אבל לא זוהו בו שאלות FAQ.",
            action: "לבדוק את שורת הכותרות, שם הטאב, ועמודות Question/Answer.",
            notes: file.notes.join(" | "),
          });
        }

        for (const item of file.sourceOnlyItems) {
          pushRow({
            area: "פער מקור/הטמעה",
            issueType: "לא תואם: שאלה מהמקור חסרה באתר",
            priority: "גבוהה",
            status: "לטיפול",
            sourceFile: file.sourceFile,
            url: file.matchedPageUrl,
            title: file.matchedPageTitle,
            sourceQuestion: item.sourceQuestion,
            sourceAnswer: item.sourceAnswer,
            problem: "השאלה קיימת בקובץ המקור אבל לא נמצאה בעמוד ה-FAQ שהוטמע באתר.",
            action: "להוסיף באתר את שאלת המקור והתשובה המקורית, או לאשר שהשאלה הוסרה בכוונה.",
            notes: `Tab: ${file.tabName}`,
          });
        }

        for (const item of file.siteOnlyItems) {
          pushRow({
            area: "פער מקור/הטמעה",
            issueType: "לא תואם: שאלה באתר לא קיימת במקור",
            priority: "בינונית",
            status: "לבדיקה",
            sourceFile: file.sourceFile,
            url: file.matchedPageUrl,
            title: file.matchedPageTitle,
            siteQuestion: item.siteQuestion,
            siteAnswer: item.siteAnswer,
            problem: "השאלה נמצאה באתר אבל לא נמצאה בקובץ המקור.",
            action: "לבדוק אם זו תוספת מאושרת. אם לא, להסיר או להחליף לפי קובץ המקור.",
            notes: `Tab: ${file.tabName}`,
          });
        }

        for (const mismatch of file.questionMismatches) {
          const reasonNote = mismatch.reasons.length
            ? ` סימנים שנבדקו: ${mismatch.reasons.join(" | ")}.`
            : "";

          pushRow({
            area: "פער מקור/הטמעה",
            issueType: "לא תואם: נוסח שאלה שונה מהמקור",
            priority: "גבוהה",
            status: "לטיפול",
            sourceFile: file.sourceFile,
            url: file.matchedPageUrl,
            title: file.matchedPageTitle,
            sourceQuestion: mismatch.sourceQuestion,
            sourceAnswer: mismatch.sourceAnswer,
            siteQuestion: mismatch.siteQuestion,
            siteAnswer: mismatch.siteAnswer,
            problem: `השאלה זוהתה כמקבילה, אבל הנוסח באתר לא תואם לקובץ המקור.${reasonNote} דמיון שאלה משוער: ${Math.round(mismatch.similarity * 100)}%.`,
            action: "לעדכן באתר את נוסח השאלה לפי קובץ המקור, כולל מספרים, שעות וסימני פיסוק משמעותיים.",
            notes: `Tab: ${file.tabName}`,
          });
        }

        for (const mismatch of file.answerMismatches) {
          const questionNote = mismatch.questionSimilarity < 1
            ? ` נוסח השאלה זוהה כמקביל אך לא זהה (${Math.round(mismatch.questionSimilarity * 100)}%).`
            : "";
          const reasonNote = mismatch.reasons.length
            ? ` סימנים שנבדקו: ${mismatch.reasons.join(" | ")}.`
            : "";

          pushRow({
            area: "פער מקור/הטמעה",
            issueType: "לא תואם: תשובה שונה מהמקור",
            priority: "גבוהה",
            status: "לטיפול",
            sourceFile: file.sourceFile,
            url: file.matchedPageUrl,
            title: file.matchedPageTitle,
            sourceQuestion: mismatch.sourceQuestion,
            sourceAnswer: mismatch.sourceAnswer,
            siteQuestion: mismatch.siteQuestion,
            siteAnswer: mismatch.siteAnswer,
            problem: `השאלה קיימת גם במקור וגם באתר, אבל התשובה שונה.${questionNote}${reasonNote} דמיון תשובה משוער: ${Math.round(mismatch.similarity * 100)}%.`,
            action: "להשוות לפי ארבעת השדות: שאלת מקור, תשובת מקור, שאלת אתר ותשובת אתר. אם האתר לא תואם לקובץ המקור, לעדכן באתר לפי המקור.",
            notes: `Tab: ${file.tabName}`,
          });
        }

        for (const question of file.duplicateQuestions) {
          pushRow({
            area: "בדיקת QA קלה",
            issueType: "שאלה כפולה בקובץ מקור",
            priority: "בינונית",
            status: "לטיפול",
            sourceFile: file.sourceFile,
            url: file.matchedPageUrl,
            title: file.matchedPageTitle,
            sourceQuestion: question,
            problem: "אותה שאלה מופיעה יותר מפעם אחת בקובץ המקור.",
            action: "להשאיר נוסח אחד או לוודא שהכפילות מכוונת ומנוסחת אחרת.",
            notes: `Tab: ${file.tabName}`,
          });
        }
      }

      for (const issue of comparison.issues) {
        if (issue.scope === "source" && issue.type === "duplicate-question") continue;

        pushRow({
          area: "בדיקת QA קלה",
          issueType: this.issueTypeLabel(issue.type),
          priority: issue.type === "invalid-json-ld" ? "גבוהה" : "נמוכה",
          status: "לבדיקה",
          sourceFile: issue.sourceFile || "",
          url: issue.url || "",
          sourceQuestion: issue.scope === "source" ? issue.question || "" : "",
          sourceAnswer: issue.scope === "source" ? issue.answerPreview || "" : "",
          siteQuestion: issue.scope === "site" ? issue.question || "" : "",
          siteAnswer: issue.scope === "site" ? issue.answerPreview || "" : "",
          problem: issue.detail,
          action: issue.recommendedAction,
          notes: issue.rowNumber ? `Row ${issue.rowNumber}` : "",
        });
      }
    }

    if (rows.length === 1) {
      pushRow({
        area: "אין בעיות",
        issueType: "",
        priority: "",
        status: "",
        problem: "לא נמצאו בעיות שמיועדות לטיפול.",
        action: "אין פעולה נדרשת.",
      });
    }

    return rows;
  }

  private issueTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      "duplicate-question": "שאלה כפולה",
      "short-answer": "תשובה קצרה או חסרה",
      "html-entity": "HTML entity בטקסט",
      "unbalanced-quotes": "מרכאות לא מאוזנות",
      "repeated-punctuation": "פיסוק כפול או חשוד",
      "leading-punctuation": "פיסוק בתחילת שאלה",
      "missing-question-mark": "חסר סימן שאלה",
      "replacement-character": "בעיית קידוד",
      "placeholder-text": "טקסט placeholder",
      "invalid-json-ld": "JSON-LD לא תקין",
    };

    return labels[type] || type;
  }

  private buildSourceCompareRows(result: SiteFaqAuditResult): string[][] {
    const comparison = result.sourceComparison;
    const rows: string[][] = [[
      "Status",
      "Source file",
      "Source spreadsheet ID",
      "Source tab",
      "Matched page URL",
      "Matched page title",
      "Matched by",
      "Source Q/A",
      "Site Q/A",
      "Matched questions",
      "Missing on site",
      "Extra on site",
      "Question mismatches",
      "Answer mismatches",
      "Duplicate source questions",
      "Light QA issues",
      "Missing on site - examples",
      "Extra on site - examples",
      "Question mismatch - examples",
      "Answer mismatch - examples",
      "Notes",
    ]];

    if (!comparison?.files.length) {
      rows.push(["No source files", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "No source files were provided or found."]);
      return rows;
    }

    for (const file of comparison.files) {
      rows.push([
        file.status,
        file.sourceFile,
        file.spreadsheetId,
        file.tabName,
        file.matchedPageUrl,
        file.matchedPageTitle,
        file.matchedBy,
        String(file.sourceQuestionCount),
        String(file.siteQuestionCount),
        String(file.matchedQuestionCount),
        String(file.sourceOnlyQuestions.length),
        String(file.siteOnlyQuestions.length),
        String(file.questionMismatches.length),
        String(file.answerMismatches.length),
        String(file.duplicateQuestions.length),
        String(file.qaIssues.length),
        file.sourceOnlyQuestions.slice(0, 12).join(" | "),
        file.siteOnlyQuestions.slice(0, 12).join(" | "),
        file.questionMismatches.slice(0, 8).map((item) => {
          return `${item.sourceQuestion} -> ${item.siteQuestion} (question similarity ${Math.round(item.similarity * 100)}%)`;
        }).join(" | "),
        file.answerMismatches.slice(0, 8).map((item) => {
          const questionPart = item.sourceQuestion === item.siteQuestion
            ? item.sourceQuestion
            : `${item.sourceQuestion} -> ${item.siteQuestion}`;
          return `${questionPart} (answer similarity ${Math.round(item.similarity * 100)}%)`;
        }).join(" | "),
        file.notes.join(" | "),
      ]);
    }

    return rows;
  }

  private buildQualityIssueRows(result: SiteFaqAuditResult): string[][] {
    const rows: string[][] = [[
      "Scope",
      "Severity",
      "Type",
      "Source file",
      "URL",
      "Row",
      "Question",
      "Answer preview",
      "Issue",
      "Recommended action",
    ]];

    const issues = result.sourceComparison?.issues || [];
    if (!issues.length) {
      rows.push(["No issues", "", "", "", "", "", "", "", "No obvious text QA issues were found.", "No action needed."]);
      return rows;
    }

    for (const issue of issues) {
      rows.push([
        issue.scope,
        issue.severity,
        issue.type,
        issue.sourceFile || "",
        issue.url || "",
        issue.rowNumber ? String(issue.rowNumber) : "",
        issue.question || "",
        issue.answerPreview || "",
        issue.detail,
        issue.recommendedAction,
      ]);
    }

    return rows;
  }

  private buildSourceQuestionRows(result: SiteFaqAuditResult): string[][] {
    const rows: string[][] = [[
      "Source file",
      "Spreadsheet ID",
      "Tab",
      "Row",
      "Category",
      "Question",
      "Answer",
    ]];

    for (const row of result.sourceComparison?.sourceRows || []) {
      rows.push([
        row.sourceFile,
        row.spreadsheetId,
        row.tabName,
        String(row.rowNumber),
        row.category,
        row.q,
        row.a,
      ]);
    }

    return rows;
  }

  private pageIssueSummary(page: FaqAuditPageResult): string {
    if (page.auditStatus === "ok") return "Visible FAQ and FAQPage schema are aligned.";
    if (page.auditStatus === "no-faq") return "No visible FAQ or FAQPage schema was detected.";
    if (page.auditStatus === "missing-schema") return "Visible FAQ exists, but FAQPage schema is missing.";
    if (page.auditStatus === "missing-visible-faq") return "FAQPage schema exists, but visible FAQ was not detected.";

    const parts: string[] = [];
    if (page.visibleOnlyQuestions.length) parts.push(`${page.visibleOnlyQuestions.length} visible question(s) missing from schema`);
    if (page.schemaOnlyQuestions.length) parts.push(`${page.schemaOnlyQuestions.length} schema question(s) missing from visible FAQ`);
    return parts.join("; ") || "Visible FAQ and FAQPage schema differ.";
  }

  private pageRecommendedAction(page: FaqAuditPageResult): string {
    if (page.auditStatus === "ok") return "No action needed.";
    if (page.auditStatus === "missing-schema") return "Add FAQPage JSON-LD that mirrors the visible questions and answers.";
    if (page.auditStatus === "missing-visible-faq") return "Make schema Q/A visible on the page or remove hidden Q/A from schema.";
    if (page.auditStatus === "no-faq") return "Confirm whether this page should contain FAQ content.";
    return "Use the Gaps tab to align visible FAQ questions with FAQPage schema questions one by one.";
  }

  private a1(tabTitle: string, range: string): string {
    return `'${tabTitle.replace(/'/g, "''")}'!${range}`;
  }

  private uniqueUrls(urls: string[]): string[] {
    return Array.from(new Set(urls.map((url) => this.normalizeUrl(url))));
  }

  private dedupeQAs(items: QA[]): QA[] {
    const seen = new Set<string>();
    const out: QA[] = [];

    for (const item of items) {
      const key = `${this.norm(item.q)}||${this.norm(item.a)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }

    return out;
  }

  private escapeSelector(value: string): string {
    return String(value).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  }

  private normalizeUrl(rawUrl: string): string {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const url = new URL(withProtocol);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  }

  private cleanText(value: string): string {
    let decoded = String(value || "")
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "")
      .replace(/\u00A0/g, " ");

    for (let pass = 0; pass < 3; pass++) {
      const next = cheerio.load(`<span>${decoded}</span>`)("span").text();
      if (next === decoded) break;
      decoded = next;
    }

    return decoded
      .replace(/[“”„‟]/g, "\"")
      .replace(/[‘’‚‛`´]/g, "'")
      .replace(/[‐‑‒–—―]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  private norm(value: string): string {
    return this.cleanText(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\bwi[\s-]?fi\b/g, "wifi")
      .replace(/\btravellers\b/g, "travelers")
      .replace(/\btraveller\b/g, "traveler")
      .replace(/\btravelling\b/g, "traveling")
      .replace(/\btravelled\b/g, "traveled")
      .replace(/\bcentres\b/g, "centers")
      .replace(/\bcentre\b/g, "center")
      .replace(/\bmetres\b/g, "meters")
      .replace(/\bmetre\b/g, "meter")
      .replace(/[\p{P}\p{S}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export async function runSiteFaqAudit(input: SiteFaqAuditConfig): Promise<SiteFaqAuditResult> {
  const job = new SiteFaqAuditJob();
  return await job.run(input);
}

function readCliConfig(argv: string[]): SiteFaqAuditConfig | null {
  const get = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const has = (name: string) => argv.includes(name);
  const url = get("--url");
  if (!url) return null;

  const urls = get("--urls")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const groups = get("--groups")
    ?.split(",")
    .map((item) => item.trim() as SiteUrlGroup)
    .filter(Boolean);
  const urlIncludes = get("--include")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    startUrl: url,
    urls,
    groups,
    urlIncludes,
    maxPages: Number(get("--max-pages") || DEFAULT_MAX_PAGES),
    maxDiscoveryUrls: Number(get("--max-discovery-urls") || DEFAULT_MAX_DISCOVERY_URLS),
    maxFaqCandidateChecks: Number(get("--max-faq-candidate-checks") || 300),
    faqCandidateConcurrency: Number(get("--faq-candidate-concurrency") || 12),
    fetchTimeoutMs: Number(get("--fetch-timeout-ms") || 5000),
    maxDepth: Number(get("--max-depth") || DEFAULT_MAX_DEPTH),
    renderMode: has("--static") ? "static" : "rendered",
    sourceCompareEnabled: has("--source-compare"),
    sourceInput: get("--source-input") || "",
    sourceFolderId: get("--source-folder") || "",
    sourceSpreadsheetIds: get("--source-sheets")
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    sourceTabName: get("--source-tab") || "",
    sourceHeaderRow: Number(get("--source-header-row") || 0),
  };
}

async function runCli() {
  const config = readCliConfig(process.argv.slice(2));
  if (!config) return;

  const result = await runSiteFaqAudit(config);
  console.log(JSON.stringify(result, null, 2));
}

const directRunPath = process.argv[1] || "";
if (/site-ai-faq-audit\.(ts|js)$/.test(directRunPath)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
