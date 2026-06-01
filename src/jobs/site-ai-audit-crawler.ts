// src/jobs/site-ai-audit-crawler.ts
// New experimental crawler. Do not replace faq-audit-from-web.ts with this file.

import * as cheerio from "cheerio";
import { validateMetaAndFaqSchema, type QA } from "./subjobs/faq-seo-checks.js";

export type SiteAuditDepth = "homepage" | "site";
export type SiteAuditRenderMode = "static" | "rendered";
export type SiteAuditCrawlScope = "site" | "faq-only";
export type SiteAuditPageType =
  | "homepage"
  | "hotel"
  | "destination"
  | "service"
  | "faq"
  | "offer"
  | "meeting"
  | "brand"
  | "blog"
  | "legal"
  | "contact"
  | "technical"
  | "other";

export type SiteAiAuditConfig = {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
  renderMode?: SiteAuditRenderMode;
  crawlScope?: SiteAuditCrawlScope;
  includeSitemap?: boolean;
  includeLlmsTxt?: boolean;
  includeFaqAudit?: boolean;
  includeStructuredData?: boolean;
  includeAnswerability?: boolean;
  includeMetaAudit?: boolean;
  includeLinkAudit?: boolean;
  includeAiAnalysis?: boolean;
  aiModel?: string;
  sameHostOnly?: boolean;
  respectRobots?: boolean;
  acceptLanguage?: string;
  userAgent?: string;
};

export type SiteAuditIssue = {
  severity: "critical" | "warning" | "info";
  category:
    | "crawlability"
    | "discoverability"
    | "structured-data"
    | "faq"
    | "answerability"
    | "content"
    | "metadata"
    | "ai-readiness";
  pageUrl?: string;
  title: string;
  detail: string;
  recommendation: string;
};

export type SiteAuditActionItem = {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  workstream:
    | "crawlability"
    | "discoverability"
    | "metadata"
    | "structured-data"
    | "faq"
    | "answerability"
    | "content"
    | "links"
    | "technical";
  owner: "SEO" | "Content" | "Developer" | "Project manager" | "Strategy";
  effort: "quick" | "medium" | "large";
  impact: "high" | "medium" | "low";
  status: "open";
  clientVisible: boolean;
  affectedCount: number;
  affectedUrls: string[];
  pageType?: SiteAuditPageType | "site-wide";
  pageUrl?: string;
  pageTitle?: string;
  finding: string;
  whyItMatters: string;
  recommendedFix: string;
  evidence: string;
  sourceIssues: string[];
};

export type SiteAuditPage = {
  url: string;
  status: number;
  title: string;
  metaDescription: string;
  h1: string;
  canonical: string;
  robotsMeta: string;
  wordCount: number;
  pageType: SiteAuditPageType;
  internalLinks: string[];
  isFaqCandidate: boolean;
  domQuestions: string[];
  schemaQuestions: string[];
  jsonLdTypes: string[];
  schemaFaqCount: number;
  domFaqCount: number;
  schemaOnlyQuestions: string[];
  domOnlyQuestions: string[];
  questionSignals: string[];
  jsonLdProperties: string[];
  metaDiagnostics: {
    titleLength: number;
    descriptionLength: number;
    h1Count: number;
    h2Count: number;
    headingCount: number;
    hasCanonical: boolean;
    canonicalMatchesUrl: boolean;
    hasOpenGraphTitle: boolean;
    hasOpenGraphDescription: boolean;
    hasTwitterCard: boolean;
  };
  contentDiagnostics: {
    paragraphCount: number;
    quotableParagraphCount: number;
    averageParagraphWords: number;
    hasBrandEntitySignal: boolean;
    hasDateSignal: boolean;
    hasExpertiseSignal: boolean;
    hasCaseStudySignal: boolean;
    hasNumericSignal: boolean;
    hasSourceLinks: boolean;
  };
  technicalDiagnostics: {
    responseMs: number;
    htmlBytes: number;
    finalUrl: string;
    redirected: boolean;
    imageCount: number;
    imagesMissingAlt: number;
    lazyImageCount: number;
    scriptCount: number;
    stylesheetCount: number;
    viewportMeta: boolean;
  };
  linkDiagnostics: {
    internalCount: number;
    externalCount: number;
    externalLinks: string[];
    externalDomains: string[];
    mailtoCount: number;
    telCount: number;
    nofollowExternalCount: number;
  };
  extractionReliability: {
    reliable: boolean;
    confidence: "high" | "medium" | "low";
    reasons: string[];
  };
  issues: SiteAuditIssue[];
};

export type SiteScoreEvidenceLevel = "verified" | "heuristic" | "missing";

export type SiteScoreComponent = {
  key: string;
  label: string;
  score: number;
  max: number;
  evidenceLevel: SiteScoreEvidenceLevel;
  evidence: string[];
};

export type SiteScoreSection = {
  key: string;
  label: string;
  score: number;
  max: number;
  summary: string;
  components: SiteScoreComponent[];
};

export type SiteAiReadinessScore = {
  total: number;
  geoAiReadiness: number;
  technicalSeo: number;
  contentEeAt: number;
  structuredData: number;
  crawlerRendering: number;
  performance: number;
  confidence: number;
  sections: SiteScoreSection[];
  discoverability: number;
  crawlability: number;
  answerability: number;
  contentQuality: number;
};

export type SiteAiAuditResult = {
  startedAt: string;
  startUrl: string;
  normalizedStartUrl: string;
  host: string;
  config: Required<Omit<SiteAiAuditConfig, "startUrl">>;
  robots: {
    url: string;
    found: boolean;
    status: number | null;
    blocksAll: boolean;
    sitemapHints: string[];
    aiCrawlerAccess: Array<{
      bot: string;
      allowed: boolean;
      evidence: string;
    }>;
  };
  sitemap: {
    checked: boolean;
    url: string;
    found: boolean;
    status: number | null;
    urls: string[];
  };
  llmsTxt: {
    checked: boolean;
    url: string;
    found: boolean;
    status: number | null;
    lineCount: number;
    links: string[];
  };
  discoveryStrategy: {
    mode: "homepage-only" | "balanced-sitemap-sample" | "balanced-link-discovery" | "faq-focused";
    description: string;
    maxPagesBudget: number;
    maxDepth: number;
    source: "start-url" | "sitemap" | "links" | "sitemap-and-links";
    sitemapUrlsAvailable: number;
    sitemapUrlsConsidered: number;
    linkUrlsConsidered: number;
    selectedSeedUrls: number;
    priorityOrder: SiteAuditPageType[];
    notes: string[];
  };
  pageSelectionSummary: {
    budget: number;
    crawled: number;
    candidateUrls: number;
    sitemapCandidateUrls: number;
    linkCandidateUrls: number;
    selectedSeedUrls: number;
    selectedSeedUrlsByType: Record<SiteAuditPageType, number>;
    crawledUrlsByType: Record<SiteAuditPageType, number>;
    priorityOrder: SiteAuditPageType[];
    seedExamples: Partial<Record<SiteAuditPageType, string[]>>;
    notes: string[];
  };
  pages: SiteAuditPage[];
  issues: SiteAuditIssue[];
  actionItems: SiteAuditActionItem[];
  score: SiteAiReadinessScore;
  aiAnalysis?: {
    model: string;
    generatedAt: string;
    confidence: "high" | "medium" | "low";
    executiveSummary: string;
    clientNarrative: string;
    internalRisks: string[];
    topOpportunities: string[];
    recommendedNextSteps: string[];
    uncertainties: string[];
    suggestedClientSections: string[];
    error?: string;
  } | null;
  recommendations: string[];
  finishedAt: string;
};

type QueueItem = { url: string; depth: number };
type PageFetchResult = {
  url: string;
  status: number;
  html: string;
  responseMs: number;
  htmlBytes: number;
  finalUrl: string;
};
type SitemapSeedSelection = {
  urls: string[];
  candidateCount: number;
  candidateByType: Record<SiteAuditPageType, number>;
  selectedByType: Record<SiteAuditPageType, number>;
  seedExamples: Partial<Record<SiteAuditPageType, string[]>>;
  notes: string[];
};
type CrawlResult = {
  pages: SiteAuditPage[];
  discoveryStrategy: SiteAiAuditResult["discoveryStrategy"];
  pageSelectionSummary: SiteAiAuditResult["pageSelectionSummary"];
};
type ActionIssueGroup = {
  issue: SiteAuditIssue;
  issues: SiteAuditIssue[];
  pages: SiteAuditPage[];
  pageType: SiteAuditPageType | "site-wide";
  affectedUrls: string[];
};

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_ACCEPT_LANGUAGE = "en-GB,en;q=0.9";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 SiteAiAuditBot/0.1 (+https://carmelon.local)";
const AUX_FETCH_TIMEOUT_MS = 12_000;
const PAGE_FETCH_TIMEOUT_MS = 24_000;
const RENDER_GOTO_TIMEOUT_MS = 35_000;
const RENDER_IDLE_TIMEOUT_MS = 4_000;
const RENDER_SELECTOR_TIMEOUT_MS = 6_000;
const MAX_FAQ_ELEMENT_CLICKS = 36;

const ASSET_RE = /\.(?:jpg|jpeg|png|gif|webp|avif|svg|pdf|zip|rar|mp4|webm|mov|css|js|ico|woff2?|ttf|eot)$/i;
const EXCLUDED_PATH_RE =
  /\/(?:login|logout|signup|account|cart|checkout|careers?|jobs?|press|blog\/tag|wp-admin)(?:\/|$)/i;
const FAQ_HINT_RE = /\b(faq|faqs|frequently asked questions|questions?|answers?|q&a|policies|policy)\b/i;
const FAQ_PAGE_HINT_RE = /\b(faq|faqs|frequently[-\s]?asked[-\s]?questions|questions?[-\s]*(?:and|&)?[-\s]*answers?|q&a|q-and-a)\b/i;
const QUESTION_RE =
  /\?|^(what|when|where|who|how|why|which|can|does|do|is|are|will|should|may)\b|^(מה|מתי|איפה|היכן|מי|איך|כיצד|למה|מדוע|האם|איזה|כמה)\b/i;
const FAQ_BOILERPLATE_RE =
  /\b(newsletter|subscribe|subscription|sign up|cookie|cookies|privacy policy|terms of use|login|log in|register|search|menu|language|currency|would you like to try out the newsletter)\b/i;
const PAGE_SELECTION_PRIORITY: SiteAuditPageType[] = [
  "homepage",
  "destination",
  "hotel",
  "service",
  "faq",
  "offer",
  "meeting",
  "brand",
  "contact",
  "blog",
  "legal",
  "other",
  "technical",
];

export class SiteAiAuditCrawlerJob {
  private renderBrowser: any = null;
  private renderContext: any = null;

  async run(input: SiteAiAuditConfig): Promise<SiteAiAuditResult> {
    const startedAt = new Date().toISOString();
    const config = this.normalizeConfig(input);
    const start = this.normalizeUrl(config.startUrl);
    const startUrl = new URL(start);
    this.logProgress(`start ${start} | mode=${config.renderMode} | budget=${config.maxPages} pages | depth=${config.maxDepth}`);

    try {
      this.logProgress("preflight: checking robots.txt and llms.txt");
      const robotsPromise = this.inspectRobots(startUrl, config);
      const llmsPromise = config.includeLlmsTxt
        ? this.inspectLlmsTxt(startUrl, config)
        : Promise.resolve(this.emptyLlmsTxt(startUrl));
      const robots = await robotsPromise;
      this.logProgress(`robots.txt: ${robots.found ? `found (${robots.status})` : "not found"}`);

      this.logProgress("sitemap: collecting candidate URLs");
      const sitemapPromise = config.includeSitemap
        ? this.inspectSitemap(startUrl, robots.sitemapHints, config)
        : Promise.resolve(this.emptySitemap(startUrl));
      const [sitemap, llmsTxt] = await Promise.all([sitemapPromise, llmsPromise]);
      this.logProgress(`sitemap: ${sitemap.found ? `${sitemap.urls.length} URLs loaded` : "not found"}`);
      this.logProgress(`llms.txt: ${llmsTxt.found ? `${llmsTxt.lineCount} non-empty lines` : "not found"}`);

      const crawl = await this.crawlPages(start, config, robots, sitemap.urls);
      const pages = crawl.pages;
      const pageIssues = pages.flatMap((page) => page.issues);
      const globalIssues = this.buildGlobalIssues(robots, sitemap, llmsTxt, pages, config);
      const issues = [...globalIssues, ...pageIssues];
      const score = this.scoreAudit(robots, sitemap, llmsTxt, pages, issues, config);
      const actionItems = this.buildActionItems(issues, pages);
      this.logProgress(`scoring: score=${score.total}/100 | issues=${issues.length} | actions=${actionItems.length}`);

      return {
        startedAt,
        startUrl: input.startUrl,
        normalizedStartUrl: start,
        host: startUrl.host,
        config: {
          maxPages: config.maxPages,
          maxDepth: config.maxDepth,
          renderMode: config.renderMode,
          crawlScope: config.crawlScope,
          includeSitemap: config.includeSitemap,
          includeLlmsTxt: config.includeLlmsTxt,
          includeFaqAudit: config.includeFaqAudit,
          includeStructuredData: config.includeStructuredData,
          includeAnswerability: config.includeAnswerability,
          includeMetaAudit: config.includeMetaAudit,
          includeLinkAudit: config.includeLinkAudit,
          includeAiAnalysis: config.includeAiAnalysis,
          aiModel: config.aiModel,
          sameHostOnly: config.sameHostOnly,
          respectRobots: config.respectRobots,
          acceptLanguage: config.acceptLanguage,
          userAgent: config.userAgent,
        },
        robots,
        sitemap,
        llmsTxt,
        discoveryStrategy: crawl.discoveryStrategy,
        pageSelectionSummary: crawl.pageSelectionSummary,
        pages,
        issues,
        actionItems,
        score,
        recommendations: this.buildRecommendations(score, issues, pages),
        finishedAt: new Date().toISOString(),
      };
    } finally {
      await this.closeRenderContext();
    }
  }

  private normalizeConfig(input: SiteAiAuditConfig): Required<SiteAiAuditConfig> {
    if (!input.startUrl) {
      throw new Error("Missing startUrl");
    }

    return {
      startUrl: input.startUrl,
      maxPages: Math.max(1, Math.min(250, Number(input.maxPages ?? DEFAULT_MAX_PAGES))),
      maxDepth: Math.max(0, Math.min(8, Number(input.maxDepth ?? DEFAULT_MAX_DEPTH))),
      renderMode: input.renderMode ?? "static",
      crawlScope: input.crawlScope ?? "site",
      includeSitemap: input.includeSitemap ?? true,
      includeLlmsTxt: input.includeLlmsTxt ?? true,
      includeFaqAudit: input.includeFaqAudit ?? true,
      includeStructuredData: input.includeStructuredData ?? true,
      includeAnswerability: input.includeAnswerability ?? true,
      includeMetaAudit: input.includeMetaAudit ?? true,
      includeLinkAudit: input.includeLinkAudit ?? true,
      includeAiAnalysis: input.includeAiAnalysis ?? false,
      aiModel: input.aiModel || "gpt-5.5",
      sameHostOnly: input.sameHostOnly ?? true,
      respectRobots: input.respectRobots ?? false,
      acceptLanguage: input.acceptLanguage || DEFAULT_ACCEPT_LANGUAGE,
      userAgent: input.userAgent || DEFAULT_USER_AGENT,
    };
  }

  private async crawlPages(
    startUrl: string,
    config: Required<SiteAiAuditConfig>,
    robots: SiteAiAuditResult["robots"],
    sitemapUrls: string[] = []
  ): Promise<CrawlResult> {
    const out: SiteAuditPage[] = [];
    const visited = new Set<string>();
    const sitemapSelection = this.pickSitemapSeedUrls(startUrl, sitemapUrls, config);
    const queue: QueueItem[] = [
      { url: startUrl, depth: 0 },
      ...sitemapSelection.urls.map((url) => ({ url, depth: 0 })),
    ];
    const startHost = new URL(startUrl).host;
    const visitLimit =
      config.crawlScope === "faq-only"
        ? Math.min(250, Math.max(config.maxPages * 5, config.maxPages))
        : config.maxPages;
    let linkCandidateUrls = 0;
    let linkSeedUrls = 0;
    const selectedSeedUrlsByType = { ...sitemapSelection.selectedByType };
    const seedExamples: Partial<Record<SiteAuditPageType, string[]>> = { ...sitemapSelection.seedExamples };
    this.logProgress(`crawl: selected ${sitemapSelection.urls.length} sitemap seeds; target ${config.maxPages} pages`);

    while (queue.length && visited.size < visitLimit && out.length < config.maxPages) {
      const item = queue.shift();
      if (!item) break;

      const normalized = this.normalizeUrl(item.url);
      if (visited.has(normalized)) continue;
      if (config.respectRobots && robots.blocksAll) continue;

      visited.add(normalized);
      const pageNumber = out.length + 1;
      this.logProgress(`crawl: fetching ${pageNumber}/${config.maxPages} ${normalized}`);

      let fetched: PageFetchResult | null = null;
      try {
        fetched = await this.fetchPage(normalized, config);
      } catch (error) {
        this.logProgress(`crawl: failed ${normalized} (${error instanceof Error ? error.message : String(error)})`);
        if (config.crawlScope === "site" || normalized === startUrl) {
          out.push(this.failedPage(normalized, error));
        }
        continue;
      }

      const page = this.analyzePage(fetched, config);
      if (config.crawlScope === "site" || page.isFaqCandidate) {
        out.push(page);
        this.logProgress(`crawl: done ${out.length}/${config.maxPages} ${page.pageType} ${page.status} ${fetched.responseMs}ms`);
      } else {
        this.logProgress(`crawl: skipped non-FAQ candidate ${normalized}`);
      }

      if (item.depth >= config.maxDepth) continue;

      const nextLinks = this.prioritizeDiscoveredLinks(page.internalLinks, startUrl, visited, queue, config);
      linkCandidateUrls += nextLinks.length;

      for (const link of nextLinks) {
        if (visited.size + queue.length >= visitLimit) break;
        if (config.sameHostOnly && new URL(link).host !== startHost) continue;
        queue.push({ url: link, depth: item.depth + 1 });
        linkSeedUrls += 1;
        const pageType = this.classifyPage(link, "", "");
        selectedSeedUrlsByType[pageType] += 1;
        if (!seedExamples[pageType]) seedExamples[pageType] = [];
        if ((seedExamples[pageType] || []).length < 3) seedExamples[pageType]?.push(link);
      }
    }

    const crawledUrlsByType = this.emptyPageTypeCounts();
    for (const page of out) {
      crawledUrlsByType[page.pageType] += 1;
    }

    const source =
      sitemapSelection.urls.length && linkSeedUrls
        ? "sitemap-and-links"
        : sitemapSelection.urls.length
          ? "sitemap"
          : linkSeedUrls
            ? "links"
            : "start-url";
    const mode =
      config.crawlScope === "faq-only"
        ? "faq-focused"
        : sitemapSelection.urls.length
          ? "balanced-sitemap-sample"
          : linkSeedUrls
            ? "balanced-link-discovery"
            : "homepage-only";
    const notes = [
      ...sitemapSelection.notes,
      `maxPages is used as a safety budget for the audit sample (${config.maxPages} pages), not as a recommendation to crawl the whole site.`,
      sitemapSelection.urls.length
        ? "Sitemap candidates were grouped by page type and selected round-robin by strategic priority."
        : "No usable sitemap sample was available, so discovered internal links were prioritized by page type and URL importance.",
    ];
    this.logProgress(`crawl: completed ${out.length} pages; visited ${visited.size}; discovered ${linkCandidateUrls} link candidates`);

    return {
      pages: out,
      discoveryStrategy: {
        mode,
        description:
          config.crawlScope === "faq-only"
            ? "FAQ-focused discovery: prioritize FAQ/help/support URLs and retain only pages with FAQ or question signals."
            : "Balanced audit sample: map available URLs into page types, then spend the page budget across high-value templates before crawling.",
        maxPagesBudget: config.maxPages,
        maxDepth: config.maxDepth,
        source,
        sitemapUrlsAvailable: sitemapUrls.length,
        sitemapUrlsConsidered: sitemapSelection.candidateCount,
        linkUrlsConsidered: linkCandidateUrls,
        selectedSeedUrls: sitemapSelection.urls.length + linkSeedUrls,
        priorityOrder: PAGE_SELECTION_PRIORITY,
        notes,
      },
      pageSelectionSummary: {
        budget: config.maxPages,
        crawled: out.length,
        candidateUrls: sitemapSelection.candidateCount + linkCandidateUrls,
        sitemapCandidateUrls: sitemapSelection.candidateCount,
        linkCandidateUrls,
        selectedSeedUrls: sitemapSelection.urls.length + linkSeedUrls,
        selectedSeedUrlsByType,
        crawledUrlsByType,
        priorityOrder: PAGE_SELECTION_PRIORITY,
        seedExamples,
        notes,
      },
    };
  }

  private pickSitemapSeedUrls(
    startUrl: string,
    sitemapUrls: string[],
    config: Required<SiteAiAuditConfig>
  ): SitemapSeedSelection {
    const candidateByType = this.emptyPageTypeCounts();
    const selectedByType = this.emptyPageTypeCounts();
    const seedExamples: Partial<Record<SiteAuditPageType, string[]>> = {};

    if (!sitemapUrls.length || config.crawlScope === "faq-only") {
      const faqUrls = sitemapUrls
        .filter((url) => FAQ_PAGE_HINT_RE.test(url))
        .map((url) => this.safeNormalizeUrl(url))
        .filter((url): url is string => Boolean(url))
        .filter((url, index, all) => all.indexOf(url) === index);
      const selected = this.sortCandidateUrls("faq", faqUrls).slice(0, config.maxPages * 2);
      candidateByType.faq = faqUrls.length;
      selectedByType.faq = selected.length;
      if (selected.length) seedExamples.faq = selected.slice(0, 3);

      return {
        urls: selected,
        candidateCount: faqUrls.length,
        candidateByType,
        selectedByType,
        seedExamples,
        notes: sitemapUrls.length
          ? [`FAQ-only mode selected ${selected.length} FAQ/help/support candidates from ${faqUrls.length} matching sitemap URLs.`]
          : ["No sitemap URLs were available for seed selection."],
      };
    }

    const startHost = new URL(startUrl).host;
    const startNormalized = this.normalizeUrl(startUrl);
    const groups = new Map<SiteAuditPageType, string[]>();

    for (const rawUrl of sitemapUrls) {
      const normalized = this.safeNormalizeUrl(rawUrl);
      if (!normalized || normalized === startNormalized) continue;

      const parsed = new URL(normalized);
      if (config.sameHostOnly && parsed.host !== startHost) continue;
      if (ASSET_RE.test(parsed.pathname) || EXCLUDED_PATH_RE.test(parsed.pathname)) continue;

      const pageType = this.classifyPage(normalized, "", "");
      if (!groups.has(pageType)) groups.set(pageType, []);
      const group = groups.get(pageType);
      if (group && !group.includes(normalized)) group.push(normalized);
    }

    for (const pageType of PAGE_SELECTION_PRIORITY) {
      const sorted = this.sortCandidateUrls(pageType, groups.get(pageType) || []);
      groups.set(pageType, sorted);
      candidateByType[pageType] = sorted.length;
    }

    const seeds: string[] = [];
    const maxSeeds = Math.max(0, config.maxPages - 1);

    while (seeds.length < maxSeeds && PAGE_SELECTION_PRIORITY.some((type) => (groups.get(type) || []).length)) {
      for (const type of PAGE_SELECTION_PRIORITY) {
        const group = groups.get(type) || [];
        const next = group.shift();
        if (next && !seeds.includes(next)) {
          seeds.push(next);
          selectedByType[type] += 1;
          if (!seedExamples[type]) seedExamples[type] = [];
          if ((seedExamples[type] || []).length < 3) seedExamples[type]?.push(next);
        }
        if (seeds.length >= maxSeeds) break;
      }
    }

    return {
      urls: seeds,
      candidateCount: Object.values(candidateByType).reduce((sum, count) => sum + count, 0),
      candidateByType,
      selectedByType,
      seedExamples,
      notes: [`Selected ${seeds.length} sitemap seed URLs across ${PAGE_SELECTION_PRIORITY.filter((type) => selectedByType[type] > 0).length} page types.`],
    };
  }

  private prioritizeDiscoveredLinks(
    links: string[],
    startUrl: string,
    visited: Set<string>,
    queue: QueueItem[],
    config: Required<SiteAiAuditConfig>
  ): string[] {
    const queued = new Set(queue.map((item) => this.safeNormalizeUrl(item.url)).filter(Boolean) as string[]);
    const startHost = new URL(startUrl).host;
    const grouped = new Map<SiteAuditPageType, string[]>();

    for (const link of links) {
      const normalized = this.safeNormalizeUrl(link);
      if (!normalized || visited.has(normalized) || queued.has(normalized)) continue;

      const parsed = new URL(normalized);
      if (config.sameHostOnly && parsed.host !== startHost) continue;
      if (ASSET_RE.test(parsed.pathname) || EXCLUDED_PATH_RE.test(parsed.pathname)) continue;

      const pageType = this.classifyPage(normalized, "", "");
      if (!grouped.has(pageType)) grouped.set(pageType, []);
      const group = grouped.get(pageType);
      if (group && !group.includes(normalized)) group.push(normalized);
    }

    for (const pageType of PAGE_SELECTION_PRIORITY) {
      grouped.set(pageType, this.sortCandidateUrls(pageType, grouped.get(pageType) || []));
    }

    const out: string[] = [];
    while (PAGE_SELECTION_PRIORITY.some((type) => (grouped.get(type) || []).length)) {
      for (const type of PAGE_SELECTION_PRIORITY) {
        const next = (grouped.get(type) || []).shift();
        if (next) out.push(next);
      }
    }

    return out;
  }

  private sortCandidateUrls(pageType: SiteAuditPageType, urls: string[]): string[] {
    return Array.from(new Set(urls)).sort((a, b) => {
      const aScore = this.urlSelectionScore(a, pageType);
      const bScore = this.urlSelectionScore(b, pageType);
      if (aScore !== bScore) return bScore - aScore;
      return a.localeCompare(b);
    });
  }

  private urlSelectionScore(url: string, pageType: SiteAuditPageType): number {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const segments = path.split("/").filter(Boolean);
    const text = `${path} ${parsed.search}`.toLowerCase();
    let score = 100 - Math.min(60, segments.length * 8) - Math.min(25, path.length / 8);

    if (!parsed.search) score += 8;
    if (path === "/") score += 100;
    if (/(^|\/)(en|he|de|fr|es|it|nl|pt|ru|ar)(\/|$)/.test(path)) score -= 3;

    if (pageType === "destination" && /\b(destinations?|locations?|countries|cities|city|hotels-in|hotel-in)\b/.test(text)) score += 24;
    if (pageType === "hotel" && /\b(hotel|hotels|resort|hostel|aparthotel|suites?)\b/.test(text)) score += 24;
    if (pageType === "service" && /\b(services?|amenities|facilities|spa|wellness|restaurant|dining|parking|rooms?)\b/.test(text)) score += 22;
    if (pageType === "faq" && FAQ_PAGE_HINT_RE.test(text)) score += 22;
    if (pageType === "offer" && /\b(offers?|deals?|packages?|special-offers?)\b/.test(text)) score += 22;
    if (pageType === "meeting" && /\b(meetings?|events?|conference|weddings?)\b/.test(text)) score += 22;
    if (pageType === "contact" && /\b(contact|about|company|corporation)\b/.test(text)) score += 18;
    if (pageType === "blog" && /\b(blog|news|magazine|article|stories)\b/.test(text)) score += 14;
    if (pageType === "legal") score -= 18;
    if (pageType === "technical") score -= 40;

    return score;
  }

  private emptyPageTypeCounts(): Record<SiteAuditPageType, number> {
    return {
      homepage: 0,
      hotel: 0,
      destination: 0,
      service: 0,
      faq: 0,
      offer: 0,
      meeting: 0,
      brand: 0,
      blog: 0,
      legal: 0,
      contact: 0,
      technical: 0,
      other: 0,
    };
  }

  private analyzePage(
    fetched: PageFetchResult,
    config: Required<SiteAiAuditConfig>
  ): SiteAuditPage {
    const $ = cheerio.load(fetched.html);
    const title = this.cleanText($("head > title").first().text());
    const metaDescription = this.cleanText($('head meta[name="description"]').attr("content") || "");
    const h1 = this.cleanText($("h1").first().text());
    const canonical = this.normalizeOptionalUrl(
      fetched.url,
      $('head link[rel="canonical"]').attr("href") || ""
    );
    const robotsMeta = this.cleanText($('head meta[name="robots"]').attr("content") || "");
    const text = this.mainText($);
    const internalLinks = this.extractInternalLinks(fetched.url, $);
    const linkDiagnostics = this.extractLinkDiagnostics(fetched.url, $, internalLinks);
    const jsonLdTypes = this.extractJsonLdTypes($);
    const jsonLdProperties = this.extractJsonLdProperties($);
    const domQAs = config.includeFaqAudit ? this.extractDomQAs($) : [];
    const seo = config.includeStructuredData
      ? validateMetaAndFaqSchema(fetched.html)
      : { schemaQAs: [], issues: [], metaTitle: title, metaDescription, schemaOk: false };
    const schemaQAs = this.filterUsefulQAs(seo.schemaQAs || []);
    const questionSignals = config.includeAnswerability ? this.extractQuestionSignals($, domQAs) : [];
    const gap = this.compareFaqSets(domQAs, schemaQAs);
    const metaDiagnostics = this.inspectMetaDiagnostics(fetched.url, $, title, metaDescription, canonical);
    const contentDiagnostics = this.inspectContentDiagnostics($, text, title, h1, metaDescription, linkDiagnostics);
    const technicalDiagnostics = this.inspectTechnicalDiagnostics(fetched, $);
    const extractionReliability = this.inspectExtractionReliability(
      fetched,
      $,
      text,
      metaDescription,
      canonical,
      internalLinks,
      jsonLdTypes
    );
    const pageType = this.classifyPage(fetched.url, title, h1);
    const isFaqCandidate = this.isFaqCandidatePage(
      fetched.url,
      title,
      h1,
      domQAs,
      schemaQAs,
      questionSignals
    );

    const page: SiteAuditPage = {
      url: fetched.url,
      status: fetched.status,
      title,
      metaDescription,
      h1,
      canonical,
      robotsMeta,
      wordCount: this.countWords(text),
      pageType,
      internalLinks,
      isFaqCandidate,
      domQuestions: domQAs.map((item) => item.q),
      schemaQuestions: schemaQAs.map((item) => item.q),
      jsonLdTypes,
      schemaFaqCount: schemaQAs.length,
      domFaqCount: domQAs.length,
      schemaOnlyQuestions: gap.schemaOnly,
      domOnlyQuestions: gap.domOnly,
      questionSignals,
      jsonLdProperties,
      metaDiagnostics,
      contentDiagnostics,
      technicalDiagnostics,
      linkDiagnostics,
      extractionReliability,
      issues: [],
    };

    page.issues = this.buildPageIssues(page, seo.issues || [], config);
    return page;
  }

  private buildPageIssues(
    page: SiteAuditPage,
    seoIssues: Array<{ reason: string }>,
    config: Required<SiteAiAuditConfig>
  ): SiteAuditIssue[] {
    const issues: SiteAuditIssue[] = [];

    if (page.status >= 400) {
      issues.push(this.issue("critical", "crawlability", page.url, "Page returned an error status", `HTTP ${page.status}`, "Fix the page status or remove it from crawl paths."));
    }

    const extractionUnreliable = this.isExtractionUnreliable(page);

    if (extractionUnreliable) {
      issues.push(
        this.issue(
          "warning",
          "crawlability",
          page.url,
          "Page content could not be verified",
          page.extractionReliability.reasons.join(" ") || "The crawler received a valid response but could not verify readable page content.",
          "Re-run with rendered browser, check the page with a normal browser user agent, and only then open metadata/content tasks for this URL."
        )
      );
    }

    if (/noindex|none/i.test(page.robotsMeta)) {
      issues.push(this.issue("critical", "crawlability", page.url, "Page blocks indexing", `robots meta: ${page.robotsMeta}`, "Remove noindex if this page should be discoverable by search and AI tools."));
    }

    if (extractionUnreliable) {
      return this.dedupeIssues(issues);
    }

    if (config.includeMetaAudit) {
      if (!page.title) {
        issues.push(this.issue("critical", "metadata", page.url, "Missing title", "The page has no <title> tag.", "Add a concise, descriptive page title."));
      } else if (page.title.length < 10) {
        issues.push(this.issue("warning", "metadata", page.url, "Title is too short", `Title: ${page.title}`, "Use a clearer page title with the main entity and page purpose."));
      } else if (page.title.length > 65) {
        issues.push(this.issue("warning", "metadata", page.url, "Title is too long", `Detected ${page.title.length} characters.`, "Shorten the title so the main entity and page purpose are visible early."));
      }

      if (!page.metaDescription) {
        issues.push(this.issue("warning", "metadata", page.url, "Missing meta description", "The page has no meta description.", "Add a summary that answers what the page is about."));
      } else if (page.metaDescription.length < 50) {
        issues.push(this.issue("info", "metadata", page.url, "Meta description is short", `Detected ${page.metaDescription.length} characters.`, "Expand the description with a concise page promise and the main customer intent."));
      } else if (page.metaDescription.length > 170) {
        issues.push(this.issue("info", "metadata", page.url, "Meta description is long", `Detected ${page.metaDescription.length} characters.`, "Trim the description so the most important answer appears first."));
      }

      if (!page.h1) {
        issues.push(this.issue("warning", "metadata", page.url, "Missing H1", "The page has no visible H1.", "Add one clear H1 that names the page topic."));
      }

      if (page.metaDiagnostics.h1Count > 1) {
        issues.push(this.issue("info", "metadata", page.url, "Multiple H1 tags", `Detected ${page.metaDiagnostics.h1Count} H1 elements.`, "Keep one primary H1 and use H2/H3 for supporting sections."));
      }

      if (!page.metaDiagnostics.hasCanonical) {
        issues.push(this.issue("info", "metadata", page.url, "Missing canonical", "The page has no canonical URL.", "Add a canonical URL to make the preferred page version explicit."));
      }

      if (!page.metaDiagnostics.hasOpenGraphTitle || !page.metaDiagnostics.hasOpenGraphDescription) {
        issues.push(this.issue("info", "metadata", page.url, "Open Graph metadata incomplete", "og:title or og:description is missing.", "Add Open Graph metadata so shared links and AI summaries receive cleaner context."));
      }
    }

    if (page.status < 400 && page.wordCount < 120) {
      issues.push(this.issue("warning", "content", page.url, "Thin readable content", `Detected about ${page.wordCount} words.`, "Add clear, crawlable body copy that explains the page topic."));
    }

    if (page.domFaqCount > 0 && page.schemaFaqCount === 0) {
      issues.push(this.issue("critical", "structured-data", page.url, "Visible FAQ missing FAQPage schema", `${page.domFaqCount} DOM Q/A items found, no schema Q/A items.`, "Add FAQPage JSON-LD that mirrors the visible questions and answers."));
    }

    if (page.schemaFaqCount > 0 && (page.schemaOnlyQuestions.length || page.domOnlyQuestions.length)) {
      issues.push(this.issue("critical", "faq", page.url, "FAQ DOM and schema mismatch", `Schema-only: ${page.schemaOnlyQuestions.length}; DOM-only: ${page.domOnlyQuestions.length}.`, "Keep visible FAQ and FAQPage JSON-LD in sync."));
    }

    if (this.shouldFlagLowAnswerability(page, config)) {
      issues.push(this.issue("info", "answerability", page.url, "Low answerability signals", `Few direct-answer or question-like sections were found on a ${page.pageType} page.`, "Add concise direct-answer blocks for the main user questions on this page, or link clearly to the existing FAQ where relevant."));
    }

    if (config.includeFaqAudit && page.isFaqCandidate && page.domFaqCount === 0 && page.schemaFaqCount > 0) {
      issues.push(this.issue("warning", "faq", page.url, "FAQ schema exists without visible FAQ", `${page.schemaFaqCount} schema Q/A items found, no visible DOM Q/A items.`, "Make sure schema questions are also visible to users on the page."));
    }

    if (config.includeLinkAudit && page.linkDiagnostics.externalDomains.length > 15) {
      issues.push(this.issue("info", "ai-readiness", page.url, "Many external domains linked", `${page.linkDiagnostics.externalDomains.length} external domains were detected.`, "Review outbound links and keep only useful, trustworthy references or booking/support destinations."));
    }

    const hasFaqPageHint = FAQ_PAGE_HINT_RE.test(`${page.url} ${page.title} ${page.h1}`);
    const hasFaqEvidence =
      page.domFaqCount > 0 ||
      page.schemaFaqCount > 0 ||
      hasFaqPageHint;

    for (const seoIssue of seoIssues) {
      if (!seoIssue.reason.startsWith("[schema]") && !seoIssue.reason.startsWith("[indexing]")) {
        continue;
      }

      const isGenericNoSchema =
        seoIssue.reason.includes("No JSON-LD") ||
        seoIssue.reason.includes("No @type: FAQPage");

      if (isGenericNoSchema && page.domFaqCount > 0 && page.schemaFaqCount === 0) {
        continue;
      }

      if (isGenericNoSchema && hasFaqPageHint && page.domFaqCount === 0 && page.schemaFaqCount === 0) {
        issues.push(
          this.issue(
            "warning",
            "structured-data",
            page.url,
            "FAQ page needs schema verification",
            "The page looks like an FAQ page by URL or title, but the crawler did not detect visible Q/A pairs or FAQPage JSON-LD.",
            "Confirm that the page contains visible FAQ content. If it does, add FAQPage JSON-LD; if it does not, do not treat it as an FAQ schema task."
          )
        );
        continue;
      }

      if (isGenericNoSchema && !hasFaqEvidence) {
        if (!page.jsonLdTypes.length && this.shouldFlagMissingStructuredData(page)) {
          issues.push(
            this.issue(
              "info",
              "structured-data",
              page.url,
              "No structured data detected",
              "This important page has no JSON-LD. This is an opportunity, not necessarily an error.",
              "Consider adding schema only when it clarifies a real entity, service, location, article, offer or FAQ."
            )
          );
        }
        continue;
      }

      issues.push(
        this.issue(
          seoIssue.reason.startsWith("[schema]") ? "critical" : "critical",
          seoIssue.reason.startsWith("[schema]") ? "structured-data" : "crawlability",
          page.url,
          seoIssue.reason.startsWith("[schema]") ? "Structured data issue" : "Indexing issue",
          seoIssue.reason,
          seoIssue.reason.startsWith("[schema]")
            ? "Validate JSON-LD and make required FAQPage properties complete."
            : "Review robots meta directives for this page."
        )
      );
    }

    return this.dedupeIssues(issues);
  }

  private inspectExtractionReliability(
    fetched: PageFetchResult,
    $: ReturnType<typeof cheerio.load>,
    readableText: string,
    metaDescription: string,
    canonical: string,
    internalLinks: string[],
    jsonLdTypes: string[]
  ): SiteAuditPage["extractionReliability"] {
    const reasons: string[] = [];
    const statusOk = fetched.status > 0 && fetched.status < 400;

    if (!statusOk) {
      return {
        reliable: false,
        confidence: "low",
        reasons: [`HTTP status ${fetched.status || 0} did not return a crawlable page.`],
      };
    }

    const bodyTextLength = this.cleanText($("body").text()).length;
    const headingCount = $("h1,h2,h3,h4,h5,h6").length;
    const scriptCount = $("script").length;
    const hasUsefulHtml =
      Boolean(this.cleanText(readableText)) ||
      Boolean(metaDescription) ||
      Boolean(canonical) ||
      internalLinks.length > 0 ||
      jsonLdTypes.length > 0 ||
      headingCount > 0;

    if (!hasUsefulHtml) {
      reasons.push("No readable text, metadata, headings, links or JSON-LD were found despite a successful response.");
    }

    if (!this.cleanText(readableText) && internalLinks.length === 0 && headingCount === 0) {
      reasons.push("The page looked like an empty shell: 0 readable words, 0 internal links and 0 headings.");
    }

    if (bodyTextLength < 120 && scriptCount >= 8 && !jsonLdTypes.length) {
      reasons.push("The DOM had very little text compared with many scripts, so rendering may not have completed.");
    }

    return {
      reliable: reasons.length === 0,
      confidence: reasons.length ? "low" : "high",
      reasons,
    };
  }

  private isExtractionUnreliable(page: SiteAuditPage): boolean {
    if (page.extractionReliability?.reliable === false) {
      return true;
    }

    return page.status > 0
      && page.status < 400
      && page.wordCount === 0
      && page.linkDiagnostics.internalCount === 0
      && !page.metaDescription
      && !page.canonical
      && page.metaDiagnostics.headingCount === 0
      && page.jsonLdTypes.length === 0;
  }

  private buildGlobalIssues(
    robots: SiteAiAuditResult["robots"],
    sitemap: SiteAiAuditResult["sitemap"],
    llmsTxt: SiteAiAuditResult["llmsTxt"],
    pages: SiteAuditPage[],
    config: Required<SiteAiAuditConfig>
  ): SiteAuditIssue[] {
    const issues: SiteAuditIssue[] = [];

    if (!robots.found) {
      issues.push(this.issue("warning", "crawlability", undefined, "robots.txt not found", `Checked ${robots.url}.`, "Add robots.txt with clear crawler rules and sitemap hints."));
    } else if (robots.blocksAll) {
      issues.push(this.issue("critical", "crawlability", undefined, "robots.txt blocks all crawlers", "A Disallow: / rule was found for User-agent: *.", "Allow important public pages to be crawled."));
    }

    if (config.includeSitemap && !sitemap.found) {
      issues.push(this.issue("warning", "discoverability", undefined, "sitemap.xml not found", `Checked ${sitemap.url}.`, "Add sitemap.xml and reference it from robots.txt."));
    }

    if (config.includeLlmsTxt && !llmsTxt.found) {
      issues.push(this.issue("info", "ai-readiness", undefined, "llms.txt not found", `Checked ${llmsTxt.url}.`, "Consider adding /llms.txt as a curated AI-readable map of important content."));
    }

    if (!pages.length) {
      if (config.crawlScope === "faq-only") {
        issues.push(this.issue("critical", "faq", undefined, "No FAQ pages found", "The crawler did not find pages with visible FAQ, FAQ schema or clear FAQ URL/title signals.", "Start from a known FAQ URL, increase crawl depth, or add clear links to FAQ pages."));
      } else {
        issues.push(this.issue("critical", "crawlability", undefined, "No pages crawled", "The crawler did not collect any pages.", "Check URL, robots rules, server status and rendering requirements."));
      }
    }

    return issues;
  }

  private scoreAudit(
    robots: SiteAiAuditResult["robots"],
    sitemap: SiteAiAuditResult["sitemap"],
    llmsTxt: SiteAiAuditResult["llmsTxt"],
    pages: SiteAuditPage[],
    issues: SiteAuditIssue[],
    config: Required<SiteAiAuditConfig>
  ): SiteAiReadinessScore {
    const pageCount = Math.max(1, pages.length);
    const validPages = pages.filter((page) => page.status > 0 && page.status < 400);
    const validCount = Math.max(1, validPages.length);
    const reliableValidPages = validPages.filter((page) => !this.isExtractionUnreliable(page));
    const scoringPages = reliableValidPages.length ? reliableValidPages : validPages;
    const scoringCount = Math.max(1, scoringPages.length);
    const faqLikePages = pages.filter((page) => page.domFaqCount > 0 || page.schemaFaqCount > 0 || page.pageType === "faq");
    const pagesWithJsonLd = pages.filter((page) => page.jsonLdTypes.length > 0 && !page.jsonLdTypes.includes("Invalid JSON-LD"));
    const importantPages = pages.filter((page) => {
      return ["homepage", "hotel", "destination", "service", "offer", "meeting", "brand", "contact", "blog", "faq"].includes(page.pageType);
    });
    const scoringImportantPages = importantPages.filter((page) => !this.isExtractionUnreliable(page));
    const scoringTargetPages = scoringImportantPages.length ? scoringImportantPages : scoringPages;
    const scoringFaqLikePages = faqLikePages.filter((page) => !this.isExtractionUnreliable(page));
    const scoringPagesWithJsonLd = scoringPages.filter((page) => page.jsonLdTypes.length > 0 && !page.jsonLdTypes.includes("Invalid JSON-LD"));

    const ratio = (items: SiteAuditPage[], predicate: (page: SiteAuditPage) => boolean): number => {
      if (!items.length) return 0;
      return items.filter(predicate).length / items.length;
    };
    const points = (max: number, value: number): number => this.clampScore(value, max);
    const ratioPoints = (max: number, items: SiteAuditPage[], predicate: (page: SiteAuditPage) => boolean): number => {
      return points(max, Math.round(ratio(items, predicate) * max));
    };
    const component = (
      key: string,
      label: string,
      max: number,
      score: number,
      evidence: string[],
      evidenceLevel: SiteScoreEvidenceLevel = "verified"
    ): SiteScoreComponent => ({
      key,
      label,
      max,
      score: points(max, score),
      evidence: evidence.filter(Boolean).slice(0, 4),
      evidenceLevel,
    });
    const section = (
      key: string,
      label: string,
      components: SiteScoreComponent[],
      summary: string
    ): SiteScoreSection => ({
      key,
      label,
      max: components.reduce((sum, item) => sum + item.max, 0),
      score: components.reduce((sum, item) => sum + item.score, 0),
      components,
      summary,
    });

    const aiCrawlerAllowed = robots.aiCrawlerAccess.filter((item) => item.allowed).length;
    const geoSection = section("geoAiReadiness", "GEO / AI Readiness", [
      component(
        "aiCrawlerAccess",
        "גישה לקרולרי AI",
        5,
        Math.round((aiCrawlerAllowed / Math.max(1, robots.aiCrawlerAccess.length || 4)) * 5),
        [
          `${aiCrawlerAllowed}/${robots.aiCrawlerAccess.length || 4} בוטים מרכזיים לא נחסמו`,
          robots.blocksAll ? "robots.txt חוסם User-agent:*" : "",
        ],
        robots.found ? "verified" : "heuristic"
      ),
      component(
        "quotableParagraphs",
        "פסקאות שקל לצטט",
        7,
        ratioPoints(7, scoringPages, (page) => page.contentDiagnostics.quotableParagraphCount >= 2),
        [
          `${scoringPages.filter((page) => page.contentDiagnostics.quotableParagraphCount >= 2).length}/${scoringCount} עמודים עם לפחות שתי פסקאות ציטוטיות`,
          `ממוצע מילים בעמוד שנקרא אמין: ${Math.round(scoringPages.reduce((sum, page) => sum + page.wordCount, 0) / scoringCount)}`,
        ],
        "verified"
      ),
      component(
        "answerBlocks",
        "Answer blocks ברורים",
        4,
        ratioPoints(4, scoringTargetPages, (page) => {
          return page.domFaqCount > 0 || page.schemaFaqCount > 0 || page.questionSignals.length >= 3;
        }),
        [
          `${pages.filter((page) => page.domFaqCount > 0 || page.schemaFaqCount > 0 || page.questionSignals.length >= 3).length}/${pageCount} עמודים עם FAQ או סימני שאלות`,
        ],
        "verified"
      ),
      component(
        "entityClarity",
        "בהירות מותג / ישות",
        4,
        ratioPoints(4, scoringTargetPages, (page) => {
          return Boolean(page.title && page.h1 && page.metaDescription && page.contentDiagnostics.hasBrandEntitySignal);
        }),
        [
          `${pages.filter((page) => page.contentDiagnostics.hasBrandEntitySignal).length}/${pageCount} עמודים עם חזרת ישות בכותרות/תיאור`,
        ],
        "heuristic"
      ),
      component(
        "originalEvidence",
        "נתונים, מקורות ודוגמאות",
        3,
        ratioPoints(3, scoringTargetPages, (page) => {
          return page.contentDiagnostics.hasNumericSignal
            || page.contentDiagnostics.hasSourceLinks
            || page.contentDiagnostics.hasCaseStudySignal;
        }),
        [
          `${pages.filter((page) => page.contentDiagnostics.hasNumericSignal).length} עמודים עם מספרים/נתונים`,
          `${pages.filter((page) => page.contentDiagnostics.hasSourceLinks).length} עמודים עם קישורי מקור חיצוניים`,
        ],
        "heuristic"
      ),
      component(
        "llmsTxt",
        "llms.txt",
        2,
        llmsTxt.found ? (llmsTxt.links.length ? 2 : 1) : 0,
        [
          llmsTxt.found ? `נמצא llms.txt עם ${llmsTxt.lineCount} שורות ו-${llmsTxt.links.length} קישורים` : "לא נמצא /llms.txt",
        ],
        llmsTxt.checked ? "verified" : "missing"
      ),
    ], "מודד כמה קל לכלי AI למצוא, להבין ולצטט את האתר.");

    const technicalSeoSection = section("technicalSeo", "Technical SEO", [
      component(
        "indexability",
        "Indexability",
        5,
        points(5, Math.round(ratio(validPages, (page) => !/noindex|none/i.test(page.robotsMeta)) * 4) + (robots.blocksAll ? 0 : 1)),
        [
          `${validPages.filter((page) => !/noindex|none/i.test(page.robotsMeta)).length}/${validCount} עמודים ללא noindex`,
          robots.blocksAll ? "robots.txt חוסם את האתר" : "לא נמצאה חסימת robots רוחבית",
        ],
        "verified"
      ),
      component(
        "canonicalsRedirects",
        "Canonical ו־redirects",
        3,
        points(3, Math.round(ratio(scoringPages, (page) => page.metaDiagnostics.hasCanonical && page.metaDiagnostics.canonicalMatchesUrl) * 2) + (validPages.some((page) => page.technicalDiagnostics.redirected) ? 0 : 1)),
        [
          `${scoringPages.filter((page) => page.metaDiagnostics.hasCanonical && page.metaDiagnostics.canonicalMatchesUrl).length}/${scoringCount} canonical תואם בעמודים שנקראו אמין`,
          `${validPages.filter((page) => page.technicalDiagnostics.redirected).length} עמודים עם redirect במדגם`,
        ],
        "verified"
      ),
      component(
        "titleMeta",
        "Title ו־meta description",
        3,
        points(3, Math.round(ratio(scoringPages, (page) => page.title.length >= 10 && page.title.length <= 70) * 1.5 + ratio(scoringPages, (page) => page.metaDescription.length >= 50 && page.metaDescription.length <= 170) * 1.5)),
        [
          `${scoringPages.filter((page) => page.title).length}/${scoringCount} עמודים עם Title בעמודים שנקראו אמין`,
          `${scoringPages.filter((page) => page.metaDescription).length}/${scoringCount} עמודים עם meta description בעמודים שנקראו אמין`,
        ],
        "verified"
      ),
      component(
        "headings",
        "H1 והיררכיית כותרות",
        2,
        points(2, Math.round(ratio(scoringPages, (page) => page.metaDiagnostics.h1Count === 1) * 1.2 + ratio(scoringPages, (page) => page.metaDiagnostics.h2Count > 0 || page.metaDiagnostics.headingCount >= 2) * 0.8)),
        [
          `${scoringPages.filter((page) => page.metaDiagnostics.h1Count === 1).length}/${scoringCount} עמודים עם H1 יחיד בעמודים שנקראו אמין`,
        ],
        "verified"
      ),
      component(
        "internalLinks",
        "קישורים פנימיים ומבנה אתר",
        2,
        points(2, Math.round(ratio(scoringPages, (page) => page.linkDiagnostics.internalCount >= 5) * 1.5 + (sitemap.found ? 0.5 : 0))),
        [
          `${scoringPages.reduce((sum, page) => sum + page.linkDiagnostics.internalCount, 0)} קישורים פנימיים בעמודים שנקראו אמין`,
        ],
        "verified"
      ),
      component(
        "sitemapRobots",
        "sitemap ו־robots.txt",
        2,
        (sitemap.found ? 1 : 0) + (robots.found ? 1 : 0),
        [
          sitemap.found ? `נמצא sitemap עם ${sitemap.urls.length} כתובות שנקראו` : "לא נמצא sitemap",
          robots.found ? "נמצא robots.txt" : "לא נמצא robots.txt",
        ],
        "verified"
      ),
      component(
        "brokenLinks",
        "Broken links משמעותיים",
        2,
        pages.some((page) => page.status >= 400 || page.status === 0) ? 1 : 2,
        [
          `${pages.filter((page) => page.status >= 400 || page.status === 0).length} עמודים במדגם החזירו שגיאת טעינה`,
          "בדיקת כל הקישורים היוצאים אינה מחוברת עדיין",
        ],
        pages.some((page) => page.status >= 400 || page.status === 0) ? "verified" : "heuristic"
      ),
      component(
        "imageAlt",
        "Alt לתמונות חשובות",
        1,
        pages.reduce((sum, page) => sum + page.technicalDiagnostics.imageCount, 0) === 0
          ? 1
          : (pages.reduce((sum, page) => sum + page.technicalDiagnostics.imagesMissingAlt, 0) / Math.max(1, pages.reduce((sum, page) => sum + page.technicalDiagnostics.imageCount, 0)) <= 0.25 ? 1 : 0),
        [
          `${pages.reduce((sum, page) => sum + page.technicalDiagnostics.imagesMissingAlt, 0)} תמונות בלי alt מתוך ${pages.reduce((sum, page) => sum + page.technicalDiagnostics.imageCount, 0)}`,
        ],
        "verified"
      ),
    ], "מודד חסימות טכניות, מטא בסיסי, קישורים ומפת אתר.");

    const contentSection = section("contentEeAt", "איכות תוכן ו־E-E-A-T", [
      component(
        "intentFit",
        "התאמה לכוונת העמוד",
        4,
        ratioPoints(4, scoringTargetPages, (page) => {
          return Boolean(page.title && page.h1 && page.metaDescription && page.wordCount >= 120);
        }),
        [
          `${pages.filter((page) => page.title && page.h1 && page.metaDescription && page.wordCount >= 120).length}/${pageCount} עמודים עם כותרת, H1, תיאור ותוכן בסיסי`,
        ],
        "heuristic"
      ),
      component(
        "depthSpecificity",
        "עומק וספציפיות",
        4,
        ratioPoints(4, scoringTargetPages, (page) => page.wordCount >= 250 || page.contentDiagnostics.quotableParagraphCount >= 3),
        [
          `${pages.filter((page) => page.wordCount >= 250).length}/${pageCount} עמודים עם 250+ מילים`,
          `${pages.filter((page) => page.contentDiagnostics.quotableParagraphCount >= 3).length} עמודים עם 3+ פסקאות ציטוטיות`,
        ],
        "verified"
      ),
      component(
        "expertise",
        "סימני מומחיות",
        3,
        ratioPoints(3, scoringTargetPages, (page) => page.contentDiagnostics.hasExpertiseSignal),
        [
          `${pages.filter((page) => page.contentDiagnostics.hasExpertiseSignal).length} עמודים עם סימני צוות/מומחיות/תהליך`,
        ],
        "heuristic"
      ),
      component(
        "credibility",
        "אמינות ומקורות",
        3,
        ratioPoints(3, scoringTargetPages, (page) => page.contentDiagnostics.hasSourceLinks),
        [
          `${pages.filter((page) => page.contentDiagnostics.hasSourceLinks).length} עמודים עם קישורי מקור/אמון חיצוניים`,
        ],
        "heuristic"
      ),
      component(
        "freshness",
        "עדכניות",
        2,
        ratioPoints(2, scoringTargetPages, (page) => page.contentDiagnostics.hasDateSignal),
        [
          `${pages.filter((page) => page.contentDiagnostics.hasDateSignal).length} עמודים עם תאריך או סימן עדכון`,
        ],
        "heuristic"
      ),
      component(
        "examplesData",
        "דוגמאות, נתונים או case studies",
        2,
        ratioPoints(2, scoringTargetPages, (page) => page.contentDiagnostics.hasNumericSignal || page.contentDiagnostics.hasCaseStudySignal),
        [
          `${pages.filter((page) => page.contentDiagnostics.hasNumericSignal || page.contentDiagnostics.hasCaseStudySignal).length} עמודים עם נתונים/דוגמאות`,
        ],
        "heuristic"
      ),
      component(
        "originality",
        "תוכן מקורי ולא גנרי",
        2,
        ratioPoints(2, scoringTargetPages, (page) => {
          return page.wordCount >= 180 && page.contentDiagnostics.hasBrandEntitySignal && (page.contentDiagnostics.hasNumericSignal || page.linkDiagnostics.internalCount >= 5);
        }),
        [
          `${pages.filter((page) => page.wordCount >= 180 && page.contentDiagnostics.hasBrandEntitySignal).length} עמודים עם תוכן מותאם לישות`,
        ],
        "heuristic"
      ),
    ], "מודד אם התוכן עצמו מספיק עשיר, אמין וספציפי כדי להוות מקור טוב.");

    const structuredSection = section("structuredData", "Structured Data", [
      component(
        "validJsonLd",
        "JSON-LD תקין טכנית",
        3,
        scoringPagesWithJsonLd.length
          ? points(3, Math.round(ratio(scoringPages.filter((page) => page.jsonLdTypes.length > 0), (page) => !page.jsonLdTypes.includes("Invalid JSON-LD")) * 3))
          : 0,
        [
          `${scoringPagesWithJsonLd.length}/${scoringCount} עמודים עם JSON-LD תקין בעמודים שנקראו אמין`,
          `${scoringPages.filter((page) => page.jsonLdTypes.includes("Invalid JSON-LD")).length} עמודים עם JSON-LD לא תקין`,
        ],
        "verified"
      ),
      component(
        "schemaTypeMatch",
        "סכמה מתאימה לסוג העמוד",
        3,
        ratioPoints(3, scoringPagesWithJsonLd, (page) => this.pageHasLikelyMatchingSchema(page)),
        [
          `${scoringPagesWithJsonLd.filter((page) => this.pageHasLikelyMatchingSchema(page)).length}/${Math.max(1, scoringPagesWithJsonLd.length)} עמודים עם סוג סכמה שנראה מתאים`,
        ],
        "heuristic"
      ),
      component(
        "requiredFields",
        "שדות חובה קיימים",
        3,
        ratioPoints(3, scoringPagesWithJsonLd, (page) => this.pageHasCoreSchemaFields(page)),
        [
          `${scoringPagesWithJsonLd.filter((page) => this.pageHasCoreSchemaFields(page)).length}/${Math.max(1, scoringPagesWithJsonLd.length)} עמודים עם שדות בסיס כמו name/url/mainEntity`,
        ],
        "heuristic"
      ),
      component(
        "recommendedFields",
        "שדות מומלצים",
        2,
        ratioPoints(2, scoringPagesWithJsonLd, (page) => {
          return ["sameAs", "image", "author", "offers", "review", "aggregateRating"].some((field) => page.jsonLdProperties.includes(field));
        }),
        [
          `${scoringPagesWithJsonLd.filter((page) => ["sameAs", "image", "author", "offers", "review", "aggregateRating"].some((field) => page.jsonLdProperties.includes(field))).length}/${Math.max(1, scoringPagesWithJsonLd.length)} עמודים עם שדות מומלצים`,
        ],
        "heuristic"
      ),
      component(
        "visibleMatch",
        "תאימות לתוכן גלוי",
        2,
        scoringFaqLikePages.length
          ? ratioPoints(2, scoringFaqLikePages, (page) => page.domOnlyQuestions.length === 0 && page.schemaOnlyQuestions.length === 0)
          : 1,
        [
          scoringFaqLikePages.length
            ? `${scoringFaqLikePages.filter((page) => page.domOnlyQuestions.length === 0 && page.schemaOnlyQuestions.length === 0).length}/${scoringFaqLikePages.length} עמודי FAQ/שאלות בלי פער גלוי מול סכמה`
            : "לא נמצאו עמודי FAQ במדגם הכללי; נדרש אימות נקודתי במסך ה-FAQ",
        ],
        scoringFaqLikePages.length ? "verified" : "missing"
      ),
      component(
        "duplicatesContradictions",
        "אין כפילויות או סכמה שבורה",
        2,
        points(2, 2 - Math.min(2, scoringPages.filter((page) => page.jsonLdTypes.includes("Invalid JSON-LD") || page.domOnlyQuestions.length || page.schemaOnlyQuestions.length).length)),
        [
          `${scoringPages.filter((page) => page.jsonLdTypes.includes("Invalid JSON-LD") || page.domOnlyQuestions.length || page.schemaOnlyQuestions.length).length} עמודים עם סכמה שבורה או פער FAQ בעמודים שנקראו אמין`,
        ],
        "verified"
      ),
    ], "מודד קיום, התאמה ואיכות של JSON-LD בלי להפוך כל עמוד רגיל בלי סכמה לתקלה.");

    const crawlerSection = section("crawlerRendering", "נגישות לקרולרים ורינדור JS", [
      component(
        "rawMainContent",
        "תוכן מרכזי זמין לקריאה",
        4,
        ratioPoints(4, validPages, (page) => page.wordCount >= 120),
        [
          `${validPages.filter((page) => page.wordCount >= 120).length}/${validCount} עמודים עם תוכן קריא שנאסף`,
        ],
        "verified"
      ),
      component(
        "rawRenderedGap",
        "פער raw מול rendered",
        2,
        config.renderMode === "rendered" ? 1 : 1,
        [
          config.renderMode === "rendered"
            ? "הבדיקה רצה במצב rendered, אך לא בוצעה השוואת raw מול rendered כפולה"
            : "הבדיקה רצה במצב static, לכן אין השוואת JavaScript מלאה",
        ],
        "missing"
      ),
      component(
        "userAgents",
        "טעינה עם user agents שונים",
        2,
        1,
        [
          `נבדק בפועל User-Agent אחד: ${config.userAgent}`,
          "בדיקת GPTBot/ClaudeBot בפועל לא הורצה עדיין",
        ],
        "missing"
      ),
      component(
        "resources",
        "משאבים חשובים לא חסומים",
        1,
        validPages.length ? 1 : 0,
        [
          `${pages.reduce((sum, page) => sum + page.technicalDiagnostics.scriptCount, 0)} scripts ו-${pages.reduce((sum, page) => sum + page.technicalDiagnostics.stylesheetCount, 0)} stylesheets זוהו`,
        ],
        "heuristic"
      ),
      component(
        "mobileCrawlerBasics",
        "מובייל וזחילה מודרנית",
        1,
        ratioPoints(1, validPages, (page) => page.technicalDiagnostics.viewportMeta),
        [
          `${validPages.filter((page) => page.technicalDiagnostics.viewportMeta).length}/${validCount} עמודים עם viewport meta`,
        ],
        "verified"
      ),
    ], "מודד אם הקרולר באמת הצליח לקרוא את התוכן ומה עדיין לא אומת ברמת JS/UA.");

    const averageResponseMs = Math.round(validPages.reduce((sum, page) => sum + page.technicalDiagnostics.responseMs, 0) / validCount);
    const averageHtmlKb = Math.round(validPages.reduce((sum, page) => sum + page.technicalDiagnostics.htmlBytes, 0) / validCount / 1024);
    const imageCount = pages.reduce((sum, page) => sum + page.technicalDiagnostics.imageCount, 0);
    const lazyImages = pages.reduce((sum, page) => sum + page.technicalDiagnostics.lazyImageCount, 0);
    const averageScripts = Math.round(validPages.reduce((sum, page) => sum + page.technicalDiagnostics.scriptCount, 0) / validCount);
    const performanceSection = section("performance", "Performance בסיסי", [
      component("responseTime", "Response time", 1, averageResponseMs && averageResponseMs < 2500 ? 1 : 0, [`זמן תגובה ממוצע במדגם: ${averageResponseMs || 0}ms`], "verified"),
      component("pageWeight", "משקל HTML", 1, averageHtmlKb < 350 ? 1 : 0, [`משקל HTML ממוצע: ${averageHtmlKb}KB`], "verified"),
      component("imageLoading", "תמונות ו-lazy loading", 1, imageCount === 0 || lazyImages / Math.max(1, imageCount) >= 0.25 ? 1 : 0, [`${lazyImages}/${imageCount} תמונות עם loading=lazy`], "verified"),
      component("scripts", "Scripts / render blocking", 1, averageScripts <= 35 ? 1 : 0, [`ממוצע scripts בעמוד: ${averageScripts}`], "heuristic"),
      component("lighthouse", "Lighthouse / CWV", 1, 0, ["לא מחובר עדיין ל-Lighthouse / PageSpeed / Core Web Vitals"], "missing"),
    ], "מודד אינדיקציות ביצועים בסיסיות שנאספו בלי להריץ Lighthouse מלא.");

    const verifiedComponents = [
      ...geoSection.components,
      ...technicalSeoSection.components,
      ...contentSection.components,
      ...structuredSection.components,
      ...crawlerSection.components,
      ...performanceSection.components,
    ].filter((item) => item.evidenceLevel === "verified").length;
    const totalComponents = [
      ...geoSection.components,
      ...technicalSeoSection.components,
      ...contentSection.components,
      ...structuredSection.components,
      ...crawlerSection.components,
      ...performanceSection.components,
    ].length;
    const confidenceSection = section("confidence", "רמת ביטחון בציון", [
      component(
        "evidenceCoverage",
        "איכות מקורות וראיות",
        5,
        points(5, Math.round((verifiedComponents / Math.max(1, totalComponents)) * 3) + (config.renderMode === "rendered" ? 1 : 0) + (sitemap.found ? 1 : 0) - (config.includeAiAnalysis ? 0 : 0)),
        [
          `${verifiedComponents}/${totalComponents} תתי־בדיקות אומתו ישירות`,
          config.renderMode === "rendered" ? "הופעל מצב rendered" : "לא בוצע rendered check מלא",
          reliableValidPages.length < validPages.length ? `${validPages.length - reliableValidPages.length} עמודים הוחרגו מציוני מטא/תוכן כי הקריאה לא הייתה אמינה` : "",
          sitemap.found ? "sitemap אומת" : "sitemap חסר או לא אומת",
          "Lighthouse/GSC/API חיצוני לא מחוברים עדיין",
        ],
        "verified"
      ),
    ], "מסמן עד כמה הציון נשען על בדיקות בפועל לעומת היוריסטיקות.");

    const sections = [
      geoSection,
      technicalSeoSection,
      contentSection,
      structuredSection,
      crawlerSection,
      performanceSection,
      confidenceSection,
    ];
    const total = this.clampScore(sections.reduce((sum, item) => sum + item.score, 0), 100);

    return {
      total,
      geoAiReadiness: geoSection.score,
      technicalSeo: technicalSeoSection.score,
      contentEeAt: contentSection.score,
      structuredData: structuredSection.score,
      crawlerRendering: crawlerSection.score,
      performance: performanceSection.score,
      confidence: confidenceSection.score,
      sections,
      discoverability: this.clampScore(Math.round((geoSection.score / geoSection.max) * 20)),
      crawlability: this.clampScore(Math.round((technicalSeoSection.score / technicalSeoSection.max) * 20)),
      answerability: this.clampScore(Math.round((geoSection.score / geoSection.max) * 20)),
      contentQuality: this.clampScore(Math.round((contentSection.score / contentSection.max) * 20)),
    };
  }

  private buildRecommendations(
    score: SiteAiReadinessScore,
    issues: SiteAuditIssue[],
    pages: SiteAuditPage[]
  ): string[] {
    const primaryRecommendations = new Map<string, string>();
    const secondaryRecommendations: string[] = [];
    const pagesWithVisibleFaq = pages.filter((page) => page.domFaqCount > 0);
    const pagesWithFaqSchemaGap = pages.filter((page) => page.domFaqCount > 0 && page.schemaFaqCount === 0);
    const importantPagesWithoutAnswerBlocks = pages.filter((page) => {
      return page.status < 400
        && page.wordCount >= 180
        && page.domFaqCount === 0
        && page.schemaFaqCount === 0
        && page.questionSignals.length < 3
        && ["homepage", "hotel", "destination", "service", "offer", "meeting", "brand", "contact"].includes(page.pageType);
    });

    const addRecommendation = (text: string) => {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      if (!clean) return;

      const area = this.getRecommendationArea(clean);
      if (!primaryRecommendations.has(area)) {
        primaryRecommendations.set(area, clean);
        return;
      }

      if (!secondaryRecommendations.includes(clean)) {
        secondaryRecommendations.push(clean);
      }
    };

    issues
      .filter((issue) => issue.severity === "critical")
      .forEach((issue) => addRecommendation(issue.recommendation));

    if (pagesWithFaqSchemaGap.length) {
      addRecommendation("For pages that already show FAQ content, add matching FAQPage JSON-LD so the visible questions and the schema tell the same story.");
    } else if (score.structuredData < 9) {
      addRecommendation("Add or repair JSON-LD schema for the most important commercial, destination, hotel and content pages.");
    }

    if (score.geoAiReadiness < 15 && importantPagesWithoutAnswerBlocks.length && !pagesWithVisibleFaq.length) {
      addRecommendation("Add concise answer blocks for common customer questions on key pages, using headings that match natural search and AI prompts.");
    } else if (importantPagesWithoutAnswerBlocks.length) {
      addRecommendation("On important non-FAQ pages, surface a small number of direct answers or link clearly to the relevant FAQ instead of creating duplicate FAQ sections.");
    }

    if (score.technicalSeo < 13 || score.geoAiReadiness < 16) {
      addRecommendation("Improve machine discovery with sitemap.xml, robots.txt sitemap hints, and a curated /llms.txt file.");
    }

    if (pages.some((page) => page.wordCount < 120)) {
      addRecommendation("Expand thin pages with useful, crawlable text that explains services, policies, pricing, locations and contact options.");
    }

    if (pages.some((page) => page.schemaOnlyQuestions.length || page.domOnlyQuestions.length)) {
      addRecommendation("Use the existing FAQ content as the source of truth and keep visible FAQ blocks synchronized with FAQPage JSON-LD.");
    }

    if (pages.some((page) => page.metaDiagnostics && (!page.metaDiagnostics.hasOpenGraphTitle || !page.metaDiagnostics.hasOpenGraphDescription))) {
      addRecommendation("Complete key metadata on important pages: title, meta description, canonical, Open Graph title and Open Graph description.");
    }

    if (pages.some((page) => page.linkDiagnostics?.externalCount > 0)) {
      addRecommendation("Review outbound links by domain and keep only useful, trustworthy references that support the customer journey.");
    }

    return Array.from(primaryRecommendations.values())
      .concat(secondaryRecommendations)
      .slice(0, 12);
  }

  private getRecommendationArea(text: string): string {
    const value = text.toLowerCase();
    if (/llms|sitemap|robots|discovery|crawl/.test(value)) return "discovery";
    if (/title|meta|canonical|open graph|og /.test(value)) return "metadata";
    if (/json-ld|schema|faqpage|faq/.test(value)) return "structured-data";
    if (/answer block|question|copy|content|thin|crawlable text/.test(value)) return "content";
    if (/link|domain|trust|reference|outbound/.test(value)) return "links";
    if (/image|alt|media/.test(value)) return "media";
    return value.slice(0, 48);
  }

  private buildActionItems(
    issues: SiteAuditIssue[],
    pages: SiteAuditPage[]
  ): SiteAuditActionItem[] {
    const pageByUrl = new Map(pages.map((page) => [page.url, page]));
    const groups = this.groupIssuesForActions(issues, pageByUrl);
    const items = groups.map((group, index) => this.issueGroupToActionItem(group, index));

    items.push(...this.buildDuplicateMetadataActionItems(pages, items.length));

    return this.dedupeActionItems(items).map((item, index) => ({
      ...item,
      id: `A-${String(index + 1).padStart(3, "0")}`,
    }));
  }

  private groupIssuesForActions(
    issues: SiteAuditIssue[],
    pageByUrl: Map<string, SiteAuditPage>
  ): ActionIssueGroup[] {
    const map = new Map<string, ActionIssueGroup>();

    for (const issue of issues) {
      const page = issue.pageUrl ? pageByUrl.get(issue.pageUrl) : undefined;
      const pageType = page?.pageType || "site-wide";
      const key = `${issue.category}|${issue.title}|${issue.recommendation}|${pageType}`;

      if (!map.has(key)) {
        map.set(key, {
          issue,
          issues: [],
          pages: [],
          pageType,
          affectedUrls: [],
        });
      }

      const group = map.get(key);
      if (!group) continue;

      group.issues.push(issue);
      if (page && !group.pages.some((item) => item.url === page.url)) {
        group.pages.push(page);
      }
      if (issue.pageUrl && !group.affectedUrls.includes(issue.pageUrl)) {
        group.affectedUrls.push(issue.pageUrl);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      return actionGroupPriorityWeight(b) - actionGroupPriorityWeight(a)
        || b.issues.length - a.issues.length
        || a.issue.title.localeCompare(b.issue.title);
    });
  }

  private issueGroupToActionItem(
    group: ActionIssueGroup,
    index: number
  ): SiteAuditActionItem {
    const issue = group.issue;
    const firstPage = group.pages[0];
    const priority = this.actionPriority(issue);
    const workstream = this.actionWorkstream(issue);
    const copy = this.actionCopy(issue);
    const affectedUrls = group.affectedUrls.slice(0, 25);
    const affectedCount = Math.max(group.affectedUrls.length, group.issues.length);

    return {
      id: `A-${String(index + 1).padStart(3, "0")}`,
      priority,
      workstream,
      owner: this.actionOwner(issue, workstream),
      effort: this.actionEffort(issue, workstream),
      impact: priority === "critical" || priority === "high" ? "high" : priority === "medium" ? "medium" : "low",
      status: "open",
      clientVisible: this.isClientVisibleAction(issue),
      affectedCount,
      affectedUrls,
      pageType: group.pageType,
      pageUrl: affectedCount === 1 ? issue.pageUrl : undefined,
      pageTitle: affectedCount === 1 ? firstPage?.title || firstPage?.h1 || undefined : this.pageTypeLabel(group.pageType),
      finding: copy.finding,
      whyItMatters: copy.whyItMatters,
      recommendedFix: copy.recommendedFix,
      evidence: this.groupEvidence(copy.evidence, group),
      sourceIssues: Array.from(new Set(group.issues.map((item) => item.title))),
    };
  }

  private groupEvidence(baseEvidence: string, group: ActionIssueGroup): string {
    const countText = group.affectedUrls.length
      ? `${group.affectedUrls.length} affected URL${group.affectedUrls.length === 1 ? "" : "s"}`
      : `${group.issues.length} site-wide occurrence${group.issues.length === 1 ? "" : "s"}`;
    const typeText = this.pageTypeLabel(group.pageType);
    const examples = group.affectedUrls.slice(0, 6).join(", ");

    return [countText, typeText, baseEvidence, examples ? `Examples: ${examples}` : ""]
      .filter(Boolean)
      .join(" | ");
  }

  private actionPriority(issue: SiteAuditIssue): SiteAuditActionItem["priority"] {
    const text = `${issue.title} ${issue.detail}`;

    if (
      issue.severity === "critical" &&
      /blocks all|No pages crawled|Page blocks indexing|Page returned an error status|Page fetch failed/i.test(text)
    ) {
      return "critical";
    }

    if (issue.severity === "critical") return "high";
    if (issue.severity === "warning") return "medium";
    return "low";
  }

  private actionWorkstream(issue: SiteAuditIssue): SiteAuditActionItem["workstream"] {
    const text = `${issue.title} ${issue.detail}`;

    if (issue.category === "ai-readiness" && /external domains|outbound links/i.test(text)) {
      return "links";
    }

    if (issue.category === "ai-readiness" && /llms\.txt/i.test(text)) {
      return "discoverability";
    }

    if (issue.category === "structured-data") return "structured-data";
    if (issue.category === "discoverability") return "discoverability";
    if (issue.category === "crawlability") return "crawlability";
    if (issue.category === "metadata") return "metadata";
    if (issue.category === "answerability") return "answerability";
    if (issue.category === "content") return "content";
    if (issue.category === "faq") return "faq";
    return "technical";
  }

  private actionOwner(
    issue: SiteAuditIssue,
    workstream: SiteAuditActionItem["workstream"]
  ): SiteAuditActionItem["owner"] {
    if (workstream === "crawlability" || workstream === "structured-data" || workstream === "technical") {
      return "Developer";
    }

    if (workstream === "content" || workstream === "answerability") {
      return "Content";
    }

    if (workstream === "discoverability" || workstream === "metadata" || workstream === "links" || workstream === "faq") {
      return "SEO";
    }

    if (issue.category === "ai-readiness") return "Strategy";
    return "Project manager";
  }

  private actionEffort(
    issue: SiteAuditIssue,
    workstream: SiteAuditActionItem["workstream"]
  ): SiteAuditActionItem["effort"] {
    const text = `${issue.title} ${issue.detail}`;

    if (/No pages crawled|blocks all|Page returned an error status|Page fetch failed/i.test(text)) {
      return "large";
    }

    if (workstream === "structured-data" || workstream === "faq" || workstream === "content" || workstream === "answerability") {
      return "medium";
    }

    return "quick";
  }

  private actionCopy(issue: SiteAuditIssue): Pick<SiteAuditActionItem, "finding" | "whyItMatters" | "recommendedFix" | "evidence"> {
    const title = issue.title || "ממצא";
    const detail = issue.detail || "";
    const fallback = {
      finding: title,
      whyItMatters: "הממצא הזה יכול להקשות על מנועי חיפוש וכלי AI להבין, לשלוף או להציג את התוכן בצורה מדויקת.",
      recommendedFix: issue.recommendation || "לבדוק ידנית ולהגדיר תיקון מתאים.",
      evidence: detail,
    };

    if (/robots\.txt not found/i.test(title)) {
      return {
        finding: "חסר robots.txt",
        whyItMatters: "קובץ robots.txt עוזר למנועי חיפוש וכלי AI להבין אילו אזורים באתר פתוחים לסריקה ואיפה נמצא ה-sitemap.",
        recommendedFix: "להוסיף robots.txt עם כללי סריקה ברורים והפניה ל-sitemap.xml.",
        evidence: detail,
      };
    }

    if (/robots\.txt blocks all/i.test(title)) {
      return {
        finding: "robots.txt חוסם את כל האתר",
        whyItMatters: "אם האתר חסום לזחילה, מנועי חיפוש וכלי AI עלולים לא לראות את העמודים החשובים בכלל.",
        recommendedFix: "לפתוח את העמודים הציבוריים החשובים לסריקה, ולשמור חסימה רק לאזורים פרטיים או טכניים.",
        evidence: detail,
      };
    }

    if (/sitemap\.xml not found/i.test(title)) {
      return {
        finding: "חסר sitemap.xml",
        whyItMatters: "sitemap מסודר מקצר לכלים את הדרך לעמודים החשובים ומקטין סיכוי שעמודים אסטרטגיים יפספסו.",
        recommendedFix: "להוסיף sitemap.xml עדכני ולהפנות אליו מתוך robots.txt.",
        evidence: detail,
      };
    }

    if (/llms\.txt not found/i.test(title)) {
      return {
        finding: "חסר llms.txt",
        whyItMatters: "llms.txt יכול לשמש כמפת תוכן קריאה לכלי AI ולהדגיש שירותים, עמודים ותשובות שחשוב שיילקחו בחשבון.",
        recommendedFix: "ליצור /llms.txt קצר ומנוהל שמרכז את העמודים, השירותים והתכנים החשובים ביותר.",
        evidence: detail,
      };
    }

    if (/Missing title|Title is too short|Title is too long/i.test(title)) {
      return {
        finding: "בעיה בכותרת הדפדפן",
        whyItMatters: "Title ברור עוזר להבין במה עוסק העמוד ומופיע גם בתוצאות חיפוש, שיתופים וסיכומים אוטומטיים.",
        recommendedFix: "לנסח Title ייחודי וברור לכל עמוד, עם הישות המרכזית וכוונת העמוד בתחילת הכותרת.",
        evidence: detail,
      };
    }

    if (/Missing meta description|Meta description is short|Meta description is long/i.test(title)) {
      return {
        finding: "בעיה ב-meta description",
        whyItMatters: "תיאור מטא טוב נותן תקציר ברור לעמוד ועוזר לכלים להבין את ההבטחה, ההקשר והכוונה של התוכן.",
        recommendedFix: "לכתוב תיאור קצר, טבעי ומדויק שמסביר מה יש בעמוד ולמי הוא רלוונטי.",
        evidence: detail,
      };
    }

    if (/Missing H1|Multiple H1/i.test(title)) {
      return {
        finding: "בעיה בכותרת H1",
        whyItMatters: "כותרת H1 היא סימן מרכזי להבנת נושא העמוד. חוסר או ריבוי H1 מבלבלים את היררכיית התוכן.",
        recommendedFix: "להשאיר H1 אחד וברור שמגדיר את נושא העמוד, ולהשתמש ב-H2/H3 לתתי נושאים.",
        evidence: detail,
      };
    }

    if (/Missing canonical/i.test(title)) {
      return {
        finding: "חסר canonical",
        whyItMatters: "Canonical מגדיר מהי הגרסה המועדפת של העמוד ומקטין סיכון לכפילויות או בלבול בין כתובות דומות.",
        recommendedFix: "להוסיף canonical URL תקין לגרסת העמוד המועדפת.",
        evidence: detail,
      };
    }

    if (/Open Graph metadata incomplete/i.test(title)) {
      return {
        finding: "Open Graph לא מלא",
        whyItMatters: "נתוני Open Graph משפיעים על תצוגת שיתופים ועל האופן שבו מערכות מסכמות את העמוד.",
        recommendedFix: "להוסיף og:title ו-og:description ייחודיים לעמודים חשובים.",
        evidence: detail,
      };
    }

    if (/Visible FAQ missing FAQPage schema|FAQ DOM and schema mismatch|Structured data issue/i.test(title)) {
      return {
        finding: "פער בסכמה או ב-FAQPage",
        whyItMatters: "כאשר התוכן הגלוי וה-JSON-LD לא מסונכרנים, כלי AI ומנועי חיפוש עלולים לקבל תשובות שונות מהמשתמש.",
        recommendedFix: issue.recommendation || "לסנכרן בין התוכן הגלוי לבין הסכמה ולהריץ בדיקת ולידציה חוזרת.",
        evidence: detail,
      };
    }

    if (/No structured data detected/i.test(title)) {
      return {
        finding: "הזדמנות להוסיף סכמה בעמוד חשוב",
        whyItMatters: "סכמה אינה חובה בכל עמוד. בעמודים מרכזיים היא יכולה לעזור למכונות להבין ישויות, שירותים ותוכן חשוב.",
        recommendedFix: "להוסיף סכמה רק אם היא מייצגת מידע אמיתי בעמוד: עסק, מלון, יעד, שירות, הצעה, מאמר או FAQ.",
        evidence: detail,
      };
    }

    if (/Page blocks indexing|Indexing issue/i.test(title)) {
      return {
        finding: "העמוד חוסם אינדוקס",
        whyItMatters: "עמוד שחוסם אינדוקס לא אמור להופיע בתוצאות חיפוש, ולעיתים גם לא יילקח כמקור אמין לכלי AI.",
        recommendedFix: "לוודא האם החסימה מכוונת. אם העמוד ציבורי וחשוב, להסיר noindex/nofollow.",
        evidence: detail,
      };
    }

    if (/Thin readable content/i.test(title)) {
      return {
        finding: "תוכן קריא דל מדי",
        whyItMatters: "כלי AI צריכים מספיק טקסט ברור כדי להבין מה העמוד מציע, למי הוא מתאים ומה התשובות המרכזיות.",
        recommendedFix: "להוסיף תוכן שימושי וזחיל: שירותים, יתרונות, תנאים, אזורי שירות, תשובות קצרות לשאלות מרכזיות וקריאות לפעולה.",
        evidence: detail,
      };
    }

    if (/Low answerability signals/i.test(title)) {
      return {
        finding: "מעט סימני מענה לשאלות משתמש",
        whyItMatters: "עמודים שמנוסחים רק כשיווק כללי פחות עוזרים לכלי AI לענות על שאלות ספציפיות של לקוחות.",
        recommendedFix: "להוסיף בלוקים קצרים של מענה ישיר לשאלות לקוח מרכזיות, או להפנות בצורה ברורה ל־FAQ קיים ורלוונטי בלי לשכפל אותו.",
        evidence: detail,
      };
    }

    if (/Many external domains linked/i.test(title)) {
      return {
        finding: "הרבה דומיינים חיצוניים מקושרים",
        whyItMatters: "כמות גדולה של קישורים חיצוניים יכולה לדלל אמון, להכביד על חוויית המשתמש ולהקשות על הבנת מסלול ההמרה.",
        recommendedFix: "לבדוק את איכות הקישורים החיצוניים ולהשאיר רק יעדים נחוצים, אמינים ותומכי המרה.",
        evidence: detail,
      };
    }

    return fallback;
  }

  private isClientVisibleAction(issue: SiteAuditIssue): boolean {
    if (/Page fetch failed|Page returned an error status/i.test(issue.title)) {
      return false;
    }

    if (/Low answerability signals/i.test(issue.title)) {
      return false;
    }

    return issue.severity !== "info" || ["metadata", "content", "ai-readiness"].includes(issue.category);
  }

  private pageTypeLabel(pageType: SiteAuditPageType | "site-wide" | undefined): string {
    const labels: Record<SiteAuditPageType | "site-wide", string> = {
      "site-wide": "רוחבי באתר",
      homepage: "עמוד בית",
      hotel: "עמודי מלון",
      destination: "עמודי יעד / עיר",
      service: "עמודי שירותים / Facilities",
      faq: "עמודי FAQ",
      offer: "עמודי מבצעים",
      meeting: "עמודי אירועים / Meetings",
      brand: "עמודי מותג",
      blog: "בלוג / תוכן",
      legal: "עמודים משפטיים",
      contact: "יצירת קשר / אודות",
      technical: "עמודים טכניים",
      other: "עמודים אחרים",
    };

    return labels[pageType || "other"] || labels.other;
  }

  private buildDuplicateMetadataActionItems(
    pages: SiteAuditPage[],
    startIndex: number
  ): SiteAuditActionItem[] {
    const items: SiteAuditActionItem[] = [];
    const duplicateTitleGroups = this.findDuplicateGroups(pages, (page) => page.title);
    const duplicateDescriptionGroups = this.findDuplicateGroups(pages, (page) => page.metaDescription);

    if (duplicateTitleGroups.length) {
      items.push({
        id: `A-${String(startIndex + items.length + 1).padStart(3, "0")}`,
        priority: "medium",
        workstream: "metadata",
        owner: "SEO",
        effort: "medium",
        impact: "medium",
        status: "open",
        clientVisible: true,
        affectedCount: duplicateTitleGroups.reduce((sum, group) => sum + group.urls.length, 0),
        affectedUrls: duplicateTitleGroups.flatMap((group) => group.urls).slice(0, 25),
        pageType: "site-wide",
        finding: "כותרות Title כפולות",
        whyItMatters: "כותרות כפולות מקשות להבין מה ייחודי בכל עמוד ועלולות לגרום לתחרות פנימית בין עמודים דומים.",
        recommendedFix: "לנסח Title ייחודי לכל עמוד לפי מיקום, שירות, קהל יעד או כוונת חיפוש ברורה.",
        evidence: duplicateTitleGroups.slice(0, 5).map((group) => `${group.value}: ${group.urls.slice(0, 4).join(", ")}`).join(" | "),
        sourceIssues: ["Duplicate title"],
      });
    }

    if (duplicateDescriptionGroups.length) {
      items.push({
        id: `A-${String(startIndex + items.length + 1).padStart(3, "0")}`,
        priority: "medium",
        workstream: "metadata",
        owner: "SEO",
        effort: "medium",
        impact: "medium",
        status: "open",
        clientVisible: true,
        affectedCount: duplicateDescriptionGroups.reduce((sum, group) => sum + group.urls.length, 0),
        affectedUrls: duplicateDescriptionGroups.flatMap((group) => group.urls).slice(0, 25),
        pageType: "site-wide",
        finding: "Meta descriptions כפולים",
        whyItMatters: "תיאורי מטא כפולים מפספסים הזדמנות להסביר את הערך הייחודי של כל עמוד.",
        recommendedFix: "לכתוב meta description ייחודי לכל עמוד חשוב, עם תשובה קצרה וברורה לכוונת המשתמש.",
        evidence: duplicateDescriptionGroups.slice(0, 5).map((group) => `${group.value.slice(0, 90)}: ${group.urls.slice(0, 4).join(", ")}`).join(" | "),
        sourceIssues: ["Duplicate meta description"],
      });
    }

    return items;
  }

  private findDuplicateGroups(
    pages: SiteAuditPage[],
    getter: (page: SiteAuditPage) => string
  ): Array<{ value: string; urls: string[] }> {
    const groups = new Map<string, { value: string; urls: string[] }>();

    for (const page of pages) {
      const value = this.cleanText(getter(page));
      if (!value) continue;

      const key = this.norm(value);
      if (!groups.has(key)) {
        groups.set(key, { value, urls: [] });
      }

      groups.get(key)?.urls.push(page.url);
    }

    return Array.from(groups.values())
      .filter((group) => group.urls.length > 1)
      .sort((a, b) => b.urls.length - a.urls.length || a.value.localeCompare(b.value));
  }

  private dedupeActionItems(items: SiteAuditActionItem[]): SiteAuditActionItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.priority}|${item.workstream}|${item.pageType || "unknown"}|${item.pageUrl || "grouped"}|${item.finding}|${item.recommendedFix}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async inspectRobots(
    startUrl: URL,
    config: Required<SiteAiAuditConfig>
  ): Promise<SiteAiAuditResult["robots"]> {
    const url = `${startUrl.origin}/robots.txt`;
    const result = await this.fetchText(url, config, false);

    if (!result.ok) {
      return {
        url,
        found: false,
        status: result.status,
        blocksAll: false,
        sitemapHints: [],
        aiCrawlerAccess: this.defaultAiCrawlerAccess("robots.txt not found; no explicit AI crawler block was found"),
      };
    }

    const body = result.text;
    const sitemapHints = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^sitemap:/i.test(line))
      .map((line) => line.replace(/^sitemap:\s*/i, "").trim())
      .filter(Boolean);

    return {
      url,
      found: true,
      status: result.status,
      blocksAll: this.robotsBlocksAll(body),
      sitemapHints,
      aiCrawlerAccess: this.inspectAiCrawlerAccess(body),
    };
  }

  private async inspectSitemap(
    startUrl: URL,
    hints: string[],
    config: Required<SiteAiAuditConfig>
  ): Promise<SiteAiAuditResult["sitemap"]> {
    const candidates = [...hints, `${startUrl.origin}/sitemap.xml`];

    for (const url of candidates) {
      const result = await this.fetchText(url, config, false);
      if (!result.ok) continue;

      return {
        checked: true,
        url,
        found: true,
        status: result.status,
        urls: (await this.extractSitemapPageUrls(result.text, config)).slice(0, this.sitemapCandidateReadLimit(config)),
      };
    }

    return {
      checked: true,
      url: `${startUrl.origin}/sitemap.xml`,
      found: false,
      status: null,
      urls: [],
    };
  }

  private async extractSitemapPageUrls(
    xml: string,
    config: Required<SiteAiAuditConfig>
  ): Promise<string[]> {
    const locs = this.extractSitemapUrls(xml);
    const candidateLimit = this.sitemapCandidateReadLimit(config);
    const nestedSitemaps = locs.filter((url) => /\.xml(?:$|\?)/i.test(url)).slice(0, 25);
    const pageUrls = locs.filter((url) => !/\.xml(?:$|\?)/i.test(url));

    for (const sitemapUrl of nestedSitemaps) {
      if (pageUrls.length >= candidateLimit) break;

      const result = await this.fetchText(sitemapUrl, config, false);
      if (!result.ok) continue;

      const nestedUrls = this.extractSitemapUrls(result.text).filter((url) => !/\.xml(?:$|\?)/i.test(url));
      pageUrls.push(...nestedUrls);
    }

    return Array.from(new Set(pageUrls.map((url) => this.safeNormalizeUrl(url)).filter(Boolean) as string[]));
  }

  private sitemapCandidateReadLimit(config: Required<SiteAiAuditConfig>): number {
    return Math.min(5000, Math.max(500, config.maxPages * 40));
  }

  private async inspectLlmsTxt(
    startUrl: URL,
    config: Required<SiteAiAuditConfig>
  ): Promise<SiteAiAuditResult["llmsTxt"]> {
    const url = `${startUrl.origin}/llms.txt`;
    const result = await this.fetchText(url, config, false);

    if (!result.ok) {
      return {
        checked: true,
        url,
        found: false,
        status: result.status,
        lineCount: 0,
        links: [],
      };
    }

    return {
      checked: true,
      url,
      found: true,
      status: result.status,
      lineCount: result.text.split(/\r?\n/).filter((line) => line.trim()).length,
      links: this.extractMarkdownLinks(result.text).slice(0, 100),
    };
  }

  private emptySitemap(startUrl: URL): SiteAiAuditResult["sitemap"] {
    return {
      checked: false,
      url: `${startUrl.origin}/sitemap.xml`,
      found: false,
      status: null,
      urls: [],
    };
  }

  private emptyLlmsTxt(startUrl: URL): SiteAiAuditResult["llmsTxt"] {
    return {
      checked: false,
      url: `${startUrl.origin}/llms.txt`,
      found: false,
      status: null,
      lineCount: 0,
      links: [],
    };
  }

  private async fetchPage(
    url: string,
    config: Required<SiteAiAuditConfig>
  ): Promise<PageFetchResult> {
    if (config.renderMode === "rendered") {
      return await this.fetchRenderedPage(url, config);
    }

    const result = await this.fetchText(url, config, true);
    if (!result.ok) {
      throw new Error(`GET ${url} -> ${result.status}`);
    }

    return {
      url,
      status: result.status ?? 200,
      html: result.text,
      responseMs: result.responseMs,
      htmlBytes: result.bytes,
      finalUrl: result.finalUrl || url,
    };
  }

  private async fetchText(
    url: string,
    config: Required<SiteAiAuditConfig>,
    requireOk: boolean
  ): Promise<{ ok: boolean; status: number | null; text: string; responseMs: number; bytes: number; finalUrl: string }> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      requireOk ? PAGE_FETCH_TIMEOUT_MS : AUX_FETCH_TIMEOUT_MS
    );

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": config.userAgent,
          "accept-language": config.acceptLanguage,
        },
        signal: controller.signal,
      });

      const text = await response.text();
      if (requireOk && !response.ok) {
        throw new Error(`GET ${url} -> ${response.status}`);
      }

      return {
        ok: response.ok,
        status: response.status,
        text,
        responseMs: Date.now() - started,
        bytes: new TextEncoder().encode(text).length,
        finalUrl: response.url || url,
      };
    } catch (error) {
      if (requireOk) throw error;
      return { ok: false, status: null, text: "", responseMs: Date.now() - started, bytes: 0, finalUrl: url };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getRenderContext(config: Required<SiteAiAuditConfig>): Promise<any> {
    if (this.renderContext) {
      return this.renderContext;
    }

    this.logProgress("render: launching shared Chromium context");
    const mod: any = await (Function("return import('playwright')")() as Promise<any>);
    this.renderBrowser = await mod.chromium.launch({ headless: true });
    this.renderContext = await this.renderBrowser.newContext({
      viewport: { width: 1365, height: 900 },
      userAgent: config.userAgent,
      extraHTTPHeaders: {
        "accept-language": config.acceptLanguage,
      },
    });

    return this.renderContext;
  }

  private async closeRenderContext(): Promise<void> {
    if (this.renderContext) {
      await this.renderContext.close().catch(() => {});
      this.renderContext = null;
    }

    if (this.renderBrowser) {
      await this.renderBrowser.close().catch(() => {});
      this.renderBrowser = null;
      this.logProgress("render: Chromium context closed");
    }
  }

  private async fetchRenderedPage(
    url: string,
    config: Required<SiteAiAuditConfig>
  ): Promise<PageFetchResult> {
    const context = await this.getRenderContext(config);
    const page = await context.newPage();
    const started = Date.now();

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: RENDER_GOTO_TIMEOUT_MS });
      await page.waitForSelector("main, h1, body", { timeout: RENDER_SELECTOR_TIMEOUT_MS }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: RENDER_IDLE_TIMEOUT_MS }).catch(() => {});
      await this.openInteractiveFaqElements(page);
      const html = await page.content();
      const finalUrl = page.url() || url;

      return {
        url,
        status: response?.status?.() ?? 200,
        html,
        responseMs: Date.now() - started,
        htmlBytes: new TextEncoder().encode(html).length,
        finalUrl,
      };
    } finally {
      await page.close().catch(() => {});
    }
  }

  private async openInteractiveFaqElements(page: any): Promise<void> {
    const selectors = [
      "summary",
      ".accordion-button",
      ".accordion__button",
      ".accordion-header button",
      "[data-accordion-trigger]",
      "[data-faq-item] button",
      "[aria-controls]",
    ];
    let clicked = 0;

    for (const selector of selectors) {
      const loc = page.locator(selector);
      const count = await loc.count().catch(() => 0);
      for (let index = 0; index < count && clicked < MAX_FAQ_ELEMENT_CLICKS; index++) {
        try {
          const element = loc.nth(index);
          const visible = await element.isVisible().catch(() => false);
          if (!visible) continue;
          await element.click({ force: true, timeout: 700 });
          clicked++;
          await page.waitForTimeout(35);
        } catch {
          // Best effort only.
        }
      }
      if (clicked >= MAX_FAQ_ELEMENT_CLICKS) break;
    }

    await page.locator("details").evaluateAll((nodes: any[]) => {
      nodes.forEach((node: any) => {
        node.open = true;
      });
    }).catch(() => {});
  }

  private extractInternalLinks(baseUrl: string, $: cheerio.Root): string[] {
    const host = new URL(baseUrl).host;
    const out = new Set<string>();

    $("a[href]").each((_, element) => {
      const href = ($(element).attr("href") || "").trim();
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

      const normalized = this.normalizeOptionalUrl(baseUrl, href);
      if (!normalized) return;

      const parsed = new URL(normalized);
      if (parsed.host !== host) return;
      if (ASSET_RE.test(parsed.pathname) || EXCLUDED_PATH_RE.test(parsed.pathname)) return;

      out.add(this.normalizeUrl(normalized));
    });

    return Array.from(out).slice(0, 200);
  }

  private extractLinkDiagnostics(
    baseUrl: string,
    $: cheerio.Root,
    internalLinks: string[]
  ): SiteAuditPage["linkDiagnostics"] {
    const host = new URL(baseUrl).host;
    const externalLinks = new Set<string>();
    const externalDomains = new Set<string>();
    let mailtoCount = 0;
    let telCount = 0;
    let nofollowExternalCount = 0;

    $("a[href]").each((_, element) => {
      const $link = $(element);
      const href = ($link.attr("href") || "").trim();
      if (!href) return;

      if (href.startsWith("mailto:")) {
        mailtoCount += 1;
        return;
      }

      if (href.startsWith("tel:")) {
        telCount += 1;
        return;
      }

      if (href.startsWith("#") || href.startsWith("javascript:")) return;

      const normalized = this.normalizeOptionalUrl(baseUrl, href);
      if (!normalized) return;

      const parsed = new URL(normalized);
      if (parsed.host === host) return;
      if (ASSET_RE.test(parsed.pathname)) return;

      externalLinks.add(this.normalizeUrl(normalized));
      externalDomains.add(parsed.host);

      const rel = ($link.attr("rel") || "").toLowerCase();
      if (rel.includes("nofollow")) {
        nofollowExternalCount += 1;
      }
    });

    return {
      internalCount: internalLinks.length,
      externalCount: externalLinks.size,
      externalLinks: Array.from(externalLinks).slice(0, 80),
      externalDomains: Array.from(externalDomains).sort().slice(0, 50),
      mailtoCount,
      telCount,
      nofollowExternalCount,
    };
  }

  private inspectMetaDiagnostics(
    pageUrl: string,
    $: cheerio.Root,
    title: string,
    metaDescription: string,
    canonical: string
  ): SiteAuditPage["metaDiagnostics"] {
    const h2Count = $("h2").length;
    return {
      titleLength: title.length,
      descriptionLength: metaDescription.length,
      h1Count: $("h1").length,
      h2Count,
      headingCount: $("h1, h2, h3, h4, h5, h6").length,
      hasCanonical: Boolean(canonical),
      canonicalMatchesUrl: Boolean(canonical) && this.normalizeUrl(canonical) === this.normalizeUrl(pageUrl),
      hasOpenGraphTitle: Boolean(this.cleanText($('head meta[property="og:title"]').attr("content") || "")),
      hasOpenGraphDescription: Boolean(this.cleanText($('head meta[property="og:description"]').attr("content") || "")),
      hasTwitterCard: Boolean(this.cleanText($('head meta[name="twitter:card"]').attr("content") || "")),
    };
  }

  private inspectContentDiagnostics(
    $: cheerio.Root,
    mainText: string,
    title: string,
    h1: string,
    metaDescription: string,
    linkDiagnostics: SiteAuditPage["linkDiagnostics"]
  ): SiteAuditPage["contentDiagnostics"] {
    const paragraphTexts: string[] = [];

    $("main p, main li, article p, article li, body p").each((_, element) => {
      const text = this.cleanText($(element).text());
      if (text.length >= 40) paragraphTexts.push(text);
    });

    const uniqueParagraphs = Array.from(new Set(paragraphTexts));
    const paragraphWordCounts = uniqueParagraphs.map((text) => this.countWords(text));
    const averageParagraphWords = paragraphWordCounts.length
      ? Math.round(paragraphWordCounts.reduce((sum, count) => sum + count, 0) / paragraphWordCounts.length)
      : 0;
    const quotableParagraphCount = uniqueParagraphs.filter((text) => {
      const words = this.countWords(text);
      if (words < 12 || words > 85) return false;
      if (/cookie|privacy|newsletter|subscribe|login|sign up|copyright/i.test(text)) return false;
      return /[.!?]$/.test(text) || words >= 18;
    }).length;
    const combined = `${title} ${h1} ${metaDescription} ${mainText}`;
    const externalDomains = linkDiagnostics.externalDomains || [];
    const sourceLikeDomains = externalDomains.filter((domain) => {
      return /\.(gov|edu|org)$/i.test(domain)
        || /wikipedia|google|maps|schema|trustpilot|tripadvisor|booking|expedia|linkedin/i.test(domain);
    });

    return {
      paragraphCount: uniqueParagraphs.length,
      quotableParagraphCount,
      averageParagraphWords,
      hasBrandEntitySignal: Boolean(title && h1 && metaDescription && this.sharedMeaningfulToken(title, `${h1} ${metaDescription}`)),
      hasDateSignal: /\b(20\d{2}|updated|last updated|published|נבדק|עודכן|פורסם)\b/i.test(combined),
      hasExpertiseSignal: /\b(author|written by|reviewed by|expert|team|certified|certification|licensed|experience|years of|about us|our team|מחבר|צוות|מומחה|ניסיון|הסמכה)\b/i.test(combined),
      hasCaseStudySignal: /\b(case study|case studies|example|examples|for example|use case|customer story|portfolio|מקרה בוחן|דוגמה|לדוגמה|לקוחות)\b/i.test(combined),
      hasNumericSignal: /\b\d{2,}|\d+%|\d+\s*(years|rooms|hotels|locations|clients|projects|שנים|חדרים|מלונות|לקוחות|פרויקטים)\b/i.test(combined),
      hasSourceLinks: sourceLikeDomains.length > 0,
    };
  }

  private inspectTechnicalDiagnostics(
    fetched: PageFetchResult,
    $: cheerio.Root
  ): SiteAuditPage["technicalDiagnostics"] {
    let imagesMissingAlt = 0;
    let lazyImageCount = 0;

    $("img").each((_, element) => {
      const $img = $(element);
      const alt = this.cleanText($img.attr("alt") || "");
      const loading = String($img.attr("loading") || "").toLowerCase();
      if (!alt) imagesMissingAlt += 1;
      if (loading === "lazy") lazyImageCount += 1;
    });

    return {
      responseMs: fetched.responseMs,
      htmlBytes: fetched.htmlBytes,
      finalUrl: fetched.finalUrl,
      redirected: this.normalizeUrl(fetched.finalUrl || fetched.url) !== this.normalizeUrl(fetched.url),
      imageCount: $("img").length,
      imagesMissingAlt,
      lazyImageCount,
      scriptCount: $("script").length,
      stylesheetCount: $('link[rel="stylesheet"]').length,
      viewportMeta: Boolean($('meta[name="viewport"]').attr("content")),
    };
  }

  private isFaqCandidatePage(
    url: string,
    title: string,
    h1: string,
    domQAs: QA[],
    schemaQAs: QA[],
    questionSignals: string[]
  ): boolean {
    return (
      domQAs.length > 0 ||
      schemaQAs.length > 0 ||
      questionSignals.length >= 3 ||
      FAQ_PAGE_HINT_RE.test(`${url} ${title} ${h1}`)
    );
  }

  private classifyPage(url: string, title: string, h1: string): SiteAuditPageType {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const text = `${path} ${title} ${h1}`.toLowerCase();
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    const first = segments[0] || "";
    const hotelSubpage = /^(rooms?|restaurants?|dining|facilities|amenities|spa|wellness|reviews?|meeting|meetings|location|directions|faq)$/i.test(last);
    const reservedTopLevel = /^(terms|privacy|cookie|cookies|contact|about|blog|meetings|wedding|newsletter|destinations|city-breaks|resorts-getaways|sustainability|limited-edition|leonardo-advantage-club|gift-voucher|nyx-tix|imprint)$/i.test(first);
    const hotelLikeText = `${last} ${title} ${h1}`;

    if (path === "/") return "homepage";
    if (FAQ_PAGE_HINT_RE.test(text)) return "faq";
    if (/\b(privacy|terms|cookies?|imprint|legal|policy)\b/.test(text)) return "legal";
    if (/\b(contact|about|corporation|company|newsletter)\b/.test(text)) return "contact";
    if (/\b(special-offers?|offers?|deals?|packages?|gift-voucher)\b/.test(text)) return "offer";
    if (/\b(meetings?|events?|conference|conferences|weddings?)\b/.test(text)) return "meeting";
    if (/\b(blog|news|magazine|article|stories)\b/.test(text)) return "blog";
    if (/\b(location|directions|getting here|how to get)\b/.test(`${last} ${title} ${h1}`)) return "destination";
    if (segments.length >= 2 && !hotelSubpage && /\b(hotel|hotels|hostel|resort|aparthotel|apartments?|suites?)\b/i.test(hotelLikeText)) {
      return "hotel";
    }
    if (/\b(brand|advantage-club|loyalty|limited-edition|nyx|royal|boutique)\b/.test(text)) return "brand";
    if (/\b(services?|amenities|facilities|spa|wellness|restaurant|restaurants|dining|bar|breakfast|parking|rooms?|suites?|accessibility)\b/.test(text)) {
      return "service";
    }
    if (segments.length === 2 && !reservedTopLevel) {
      return "hotel";
    }
    if (segments.length === 1 || /\b(hotels in|hotel in|destinations?|locations?|countries|country|cities|city|region)\b/.test(text)) {
      return "destination";
    }
    if (/\b(404|not-found|error)\b/.test(text)) return "technical";
    return "other";
  }

  private shouldFlagLowAnswerability(
    page: SiteAuditPage,
    config: Required<SiteAiAuditConfig>
  ): boolean {
    if (!config.includeAnswerability) return false;
    if (page.status >= 400) return false;
    if (page.wordCount < 180) return false;
    if (page.domFaqCount > 0 || page.schemaFaqCount > 0) return false;
    if (page.questionSignals.length >= 3) return false;

    return ["homepage", "hotel", "destination", "service", "offer", "meeting", "brand", "contact"].includes(page.pageType);
  }

  private shouldFlagMissingStructuredData(page: SiteAuditPage): boolean {
    if (page.status >= 400) return false;
    if (page.domFaqCount > 0 || page.schemaFaqCount > 0) return false;
    if (page.pageType === "faq") return true;

    // Not every regular page needs schema. We only surface this as an internal
    // opportunity for pages that are likely to represent a central entity or offer.
    return ["homepage", "hotel", "destination", "service", "offer", "meeting", "brand"].includes(page.pageType);
  }

  private pageHasLikelyMatchingSchema(page: SiteAuditPage): boolean {
    const types = new Set(page.jsonLdTypes.map((type) => type.toLowerCase()));
    if (!types.size || types.has("invalid json-ld")) return false;

    if (page.pageType === "homepage") {
      return ["website", "organization", "localbusiness"].some((type) => types.has(type));
    }
    if (page.pageType === "faq") {
      return types.has("faqpage");
    }
    if (page.pageType === "hotel") {
      return ["hotel", "lodgingbusiness", "localbusiness", "webpage", "breadcrumblist"].some((type) => types.has(type));
    }
    if (page.pageType === "destination" || page.pageType === "brand" || page.pageType === "meeting" || page.pageType === "service") {
      return ["webpage", "place", "localbusiness", "organization", "breadcrumblist", "event"].some((type) => types.has(type));
    }
    if (page.pageType === "offer") {
      return ["offer", "product", "service", "webpage", "breadcrumblist"].some((type) => types.has(type));
    }
    if (page.pageType === "blog") {
      return ["article", "blogposting", "webpage", "breadcrumblist"].some((type) => types.has(type));
    }
    if (page.pageType === "contact") {
      return ["contactpage", "organization", "localbusiness", "webpage"].some((type) => types.has(type));
    }

    return ["webpage", "website", "breadcrumblist"].some((type) => types.has(type));
  }

  private pageHasCoreSchemaFields(page: SiteAuditPage): boolean {
    const props = new Set(page.jsonLdProperties);
    if (!props.size || props.has("Invalid JSON-LD")) return false;

    if (page.jsonLdTypes.includes("FAQPage")) {
      return props.has("mainEntity") && props.has("name") && props.has("acceptedAnswer");
    }

    return props.has("@type") && (props.has("name") || props.has("headline")) && (props.has("url") || props.has("@id"));
  }

  private extractJsonLdTypes($: cheerio.Root): string[] {
    const types = new Set<string>();

    $('script[type="application/ld+json"]').each((_, element) => {
      const raw = $(element).contents().text();
      if (!raw.trim()) return;

      try {
        const parsed = JSON.parse(raw);
        const visit = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) {
            value.forEach(visit);
            return;
          }
          const obj = value as Record<string, unknown>;
          const type = obj["@type"];
          if (typeof type === "string") types.add(type);
          if (Array.isArray(type)) type.forEach((item) => typeof item === "string" && types.add(item));
          if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(visit);
          if (Array.isArray(obj.mainEntity)) obj.mainEntity.forEach(visit);
        };
        visit(parsed);
      } catch {
        types.add("Invalid JSON-LD");
      }
    });

    return Array.from(types).sort();
  }

  private extractJsonLdProperties($: cheerio.Root): string[] {
    const properties = new Set<string>();

    $('script[type="application/ld+json"]').each((_, element) => {
      const raw = $(element).contents().text();
      if (!raw.trim()) return;

      try {
        const parsed = JSON.parse(raw);
        const visit = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) {
            value.forEach(visit);
            return;
          }

          const obj = value as Record<string, unknown>;
          Object.keys(obj).forEach((key) => properties.add(key));
          Object.values(obj).forEach(visit);
        };
        visit(parsed);
      } catch {
        properties.add("Invalid JSON-LD");
      }
    });

    return Array.from(properties).sort().slice(0, 120);
  }

  private extractDomQAs($: cheerio.Root): QA[] {
    const items: QA[] = [];
    const push = (qRaw: string, aRaw: string) => {
      const q = this.cleanText(qRaw);
      const a = this.cleanText(aRaw);
      if (!q || !a || q.toLowerCase() === a.toLowerCase() || a.length < 5) return;
      if (!this.looksLikeUsefulFaqQuestion(q)) return;
      if (this.isBoilerplateQa(q, a)) return;
      items.push({ q, a });
    };

    $("details").each((_, element) => {
      const $details = $(element);
      const question = $details.find("summary").first().text();
      const answer = $details.clone().find("summary").remove().end().text();
      push(question, answer);
    });

    $("[aria-controls]").each((_, element) => {
      const $trigger = $(element);
      const id = $trigger.attr("aria-controls");
      if (!id) return;
      const $panel = $(`#${id}`);
      push($trigger.text(), $panel.text());
    });

    $(".accordion-item, .accordion__item, .faq-item, .faq__item, [data-faq-item], [data-accordion-item]").each((_, element) => {
      const $item = $(element);
      const question =
        $item.find("summary, h2, h3, h4, button, .question, [data-question], [role=button]").first().text();
      let answer =
        $item.find(".answer, .accordion-body, .accordion__panel, [data-answer], [class*='content'], [class*='panel']").first().text();
      if (!answer) {
        answer = $item.clone()
          .find("summary, h1, h2, h3, h4, h5, h6, button, .question, [data-question], [role=button]")
          .remove()
          .end()
          .text();
      }
      push(question, answer);
    });

    $("h2, h3, h4").each((_, element) => {
      const question = $(element).text();
      if (!this.looksLikeUsefulFaqQuestion(question)) return;
      let answer = "";
      const next = $(element).nextUntil("h1, h2, h3, h4");
      next.each((__, node) => {
        const tag = String((node as any).name || "").toLowerCase();
        if (["p", "div", "ul", "ol", "li"].includes(tag)) {
          answer += " " + $(node).text();
        }
      });
      push(question, answer);
    });

    this.extractNumberedTextQAs($).forEach((item) => push(item.q, item.a));

    return this.dedupeQAs(items).slice(0, 100);
  }

  private extractNumberedTextQAs($: cheerio.Root): QA[] {
    const text = this.mainText($);
    const matches = Array.from(text.matchAll(/(?:^|\s)(\d{1,3})[\.)]\s+([^?]{8,180}\?)/g));
    const items: QA[] = [];

    matches.forEach((match, index) => {
      const question = this.cleanText(match[2] || "");
      const answerStart = (match.index || 0) + match[0].length;
      const answerEnd = matches[index + 1]?.index ?? text.length;
      const answer = this.cleanText(text.slice(answerStart, answerEnd).replace(/^[-:–—\s]+/, ""));

      if (!this.looksLikeUsefulFaqQuestion(question)) return;
      if (!answer || this.countWords(answer) < 4) return;
      if (this.isBoilerplateQa(question, answer)) return;

      items.push({ q: question, a: answer });
    });

    return items.slice(0, 100);
  }

  private extractQuestionSignals($: cheerio.Root, qas: QA[]): string[] {
    const signals = new Set<string>();
    qas.slice(0, 20).forEach((item) => signals.add(item.q));

    $("h1, h2, h3, h4, h5, button, summary, a").each((_, element) => {
      const text = this.cleanText($(element).text());
      if (!text || text.length > 180) return;
      if (this.isBoilerplateQa(text, "")) return;
      if (this.looksLikeUsefulFaqQuestion(text) || FAQ_HINT_RE.test(text)) {
        signals.add(text);
      }
    });

    return Array.from(signals).slice(0, 40);
  }

  private filterUsefulQAs(qas: QA[]): QA[] {
    return this.dedupeQAs(qas.filter((item) => {
      const q = this.cleanText(item.q);
      const a = this.cleanText(item.a);
      return Boolean(q && a && this.looksLikeUsefulFaqQuestion(q) && !this.isBoilerplateQa(q, a));
    })).slice(0, 160);
  }

  private looksLikeUsefulFaqQuestion(text: string): boolean {
    const clean = this.cleanText(text);
    if (!clean || clean.length < 8 || clean.length > 220) return false;
    if (FAQ_BOILERPLATE_RE.test(clean)) return false;
    return QUESTION_RE.test(clean);
  }

  private isBoilerplateQa(question: string, answer: string): boolean {
    const text = `${question} ${answer}`.toLowerCase();
    if (FAQ_BOILERPLATE_RE.test(text)) return true;
    if (/^how it works\b/i.test(question.trim()) && /newsletter|questions\? we're here to help/i.test(text)) return true;
    return false;
  }

  private compareFaqSets(domQAs: QA[], schemaQAs: QA[]): { schemaOnly: string[]; domOnly: string[] } {
    const domSet = new Set(domQAs.map((item) => this.norm(item.q)));
    const schemaSet = new Set(schemaQAs.map((item) => this.norm(item.q)));

    return {
      schemaOnly: schemaQAs.filter((item) => !domSet.has(this.norm(item.q))).map((item) => item.q),
      domOnly: domQAs.filter((item) => !schemaSet.has(this.norm(item.q))).map((item) => item.q),
    };
  }

  private failedPage(url: string, error: unknown): SiteAuditPage {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      url,
      status: 0,
      title: "",
      metaDescription: "",
      h1: "",
      canonical: "",
      robotsMeta: "",
      wordCount: 0,
      pageType: "technical",
      internalLinks: [],
      isFaqCandidate: false,
      domQuestions: [],
      schemaQuestions: [],
      jsonLdTypes: [],
      schemaFaqCount: 0,
      domFaqCount: 0,
      schemaOnlyQuestions: [],
      domOnlyQuestions: [],
      questionSignals: [],
      jsonLdProperties: [],
      metaDiagnostics: {
        titleLength: 0,
        descriptionLength: 0,
        h1Count: 0,
        h2Count: 0,
        headingCount: 0,
        hasCanonical: false,
        canonicalMatchesUrl: false,
        hasOpenGraphTitle: false,
        hasOpenGraphDescription: false,
        hasTwitterCard: false,
      },
      contentDiagnostics: {
        paragraphCount: 0,
        quotableParagraphCount: 0,
        averageParagraphWords: 0,
        hasBrandEntitySignal: false,
        hasDateSignal: false,
        hasExpertiseSignal: false,
        hasCaseStudySignal: false,
        hasNumericSignal: false,
        hasSourceLinks: false,
      },
      technicalDiagnostics: {
        responseMs: 0,
        htmlBytes: 0,
        finalUrl: url,
        redirected: false,
        imageCount: 0,
        imagesMissingAlt: 0,
        lazyImageCount: 0,
        scriptCount: 0,
        stylesheetCount: 0,
        viewportMeta: false,
      },
      linkDiagnostics: {
        internalCount: 0,
        externalCount: 0,
        externalLinks: [],
        externalDomains: [],
        mailtoCount: 0,
        telCount: 0,
        nofollowExternalCount: 0,
      },
      extractionReliability: {
        reliable: false,
        confidence: "low",
        reasons: [detail],
      },
      issues: [
        this.issue("critical", "crawlability", url, "Page fetch failed", detail, "Check URL accessibility, redirects, render mode and server blocking."),
      ],
    };
  }

  private robotsBlocksAll(body: string): boolean {
    const lines = body.split(/\r?\n/).map((line) => line.replace(/#.*/, "").trim());
    let appliesToAll = false;

    for (const line of lines) {
      if (!line) continue;
      const [fieldRaw, ...rest] = line.split(":");
      const field = fieldRaw.trim().toLowerCase();
      const value = rest.join(":").trim().toLowerCase();

      if (field === "user-agent") {
        appliesToAll = value === "*";
        continue;
      }

      if (appliesToAll && field === "disallow" && value === "/") {
        return true;
      }
    }

    return false;
  }

  private defaultAiCrawlerAccess(evidence: string): SiteAiAuditResult["robots"]["aiCrawlerAccess"] {
    return ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot"].map((bot) => ({
      bot,
      allowed: true,
      evidence,
    }));
  }

  private inspectAiCrawlerAccess(body: string): SiteAiAuditResult["robots"]["aiCrawlerAccess"] {
    const bots = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot"];
    const groups = this.parseRobotsGroups(body);

    return bots.map((bot) => {
      const match = this.findRobotGroupDecision(groups, bot);
      return {
        bot,
        allowed: match.allowed,
        evidence: match.evidence,
      };
    });
  }

  private parseRobotsGroups(body: string): Array<{ agents: string[]; allows: string[]; disallows: string[] }> {
    const groups: Array<{ agents: string[]; allows: string[]; disallows: string[] }> = [];
    let current: { agents: string[]; allows: string[]; disallows: string[] } | null = null;

    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*/, "").trim();
      if (!line) continue;

      const [fieldRaw, ...rest] = line.split(":");
      const field = fieldRaw.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (field === "user-agent") {
        if (!current || current.allows.length || current.disallows.length) {
          current = { agents: [], allows: [], disallows: [] };
          groups.push(current);
        }
        current.agents.push(value.toLowerCase());
        continue;
      }

      if (!current) continue;
      if (field === "allow") current.allows.push(value);
      if (field === "disallow") current.disallows.push(value);
    }

    return groups;
  }

  private findRobotGroupDecision(
    groups: Array<{ agents: string[]; allows: string[]; disallows: string[] }>,
    bot: string
  ): { allowed: boolean; evidence: string } {
    const botLower = bot.toLowerCase();
    const exact = groups.find((group) => group.agents.some((agent) => agent === botLower));
    const wildcard = groups.find((group) => group.agents.some((agent) => agent === "*"));
    const group = exact || wildcard;

    if (!group) {
      return { allowed: true, evidence: "No matching robots.txt group found; treated as allowed" };
    }

    const blocksRoot = group.disallows.some((value) => value.trim() === "/");
    const explicitlyAllowsRoot = group.allows.some((value) => value.trim() === "/" || value.trim() === "");

    if (blocksRoot && !explicitlyAllowsRoot) {
      return {
        allowed: false,
        evidence: `${exact ? bot : "User-agent: *"} has Disallow: /`,
      };
    }

    return {
      allowed: true,
      evidence: exact ? `Specific ${bot} group does not block /` : "Wildcard group does not block /",
    };
  }

  private extractSitemapUrls(xml: string): string[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    return $("loc")
      .map((_, element) => this.cleanText($(element).text()))
      .get()
      .filter(Boolean);
  }

  private extractMarkdownLinks(markdown: string): string[] {
    const links = new Set<string>();
    for (const match of markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)) {
      links.add(match[1]);
    }
    return Array.from(links);
  }

  private mainText($: cheerio.Root): string {
    const $scope = $("main").length ? $("main").clone() : $("body").clone();
    $scope.find("script, style, noscript, svg, header, footer, nav").remove();
    return this.cleanText($scope.text());
  }

  private cleanText(value: string): string {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  private norm(value: string): string {
    return this.cleanText(value).toLowerCase();
  }

  private sharedMeaningfulToken(a: string, b: string): boolean {
    const stop = new Set([
      "the", "and", "for", "with", "from", "this", "that", "your", "you",
      "hotel", "hotels", "home", "page", "site", "official", "best",
      "של", "על", "עם", "את", "זה", "זו", "מלון", "עמוד", "אתר",
    ]);
    const tokens = (value: string) => this.norm(value)
      .split(/[^a-z0-9א-ת]+/i)
      .filter((token) => token.length >= 4 && !stop.has(token));
    const aTokens = new Set(tokens(a));
    return tokens(b).some((token) => aTokens.has(token));
  }

  private countWords(value: string): number {
    const words = this.cleanText(value).split(/\s+/).filter(Boolean);
    return words.length;
  }

  private normalizeUrl(rawUrl: string): string {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const url = new URL(withProtocol);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  }

  private safeNormalizeUrl(rawUrl: string): string | null {
    try {
      return this.normalizeUrl(rawUrl);
    } catch {
      return null;
    }
  }

  private normalizeOptionalUrl(base: string, href: string): string {
    if (!href) return "";
    try {
      return this.normalizeUrl(new URL(href, base).toString());
    } catch {
      return "";
    }
  }

  private issue(
    severity: SiteAuditIssue["severity"],
    category: SiteAuditIssue["category"],
    pageUrl: string | undefined,
    title: string,
    detail: string,
    recommendation: string
  ): SiteAuditIssue {
    return { severity, category, pageUrl, title, detail, recommendation };
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

  private dedupeIssues(items: SiteAuditIssue[]): SiteAuditIssue[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.severity}|${item.category}|${item.pageUrl}|${item.title}|${item.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private clampScore(value: number, max = 20): number {
    return Math.max(0, Math.min(max, Math.round(value)));
  }

  private logProgress(message: string): void {
    console.log(`[site-ai-audit] ${message}`);
  }
}

function actionGroupPriorityWeight(group: ActionIssueGroup): number {
  const worst = group.issues.reduce((max, issue) => {
    const text = `${issue.title} ${issue.detail}`;
    if (
      issue.severity === "critical" &&
      /blocks all|No pages crawled|Page blocks indexing|Page returned an error status|Page fetch failed/i.test(text)
    ) {
      return Math.max(max, 4);
    }

    if (issue.severity === "critical") return Math.max(max, 3);
    if (issue.severity === "warning") return Math.max(max, 2);
    return Math.max(max, 1);
  }, 0);

  return worst;
}

export async function runSiteAiAuditFromPayload(payload: SiteAiAuditConfig): Promise<SiteAiAuditResult> {
  const job = new SiteAiAuditCrawlerJob();
  return await job.run(payload);
}

function readCliConfig(argv: string[]): SiteAiAuditConfig | null {
  const get = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const has = (name: string) => argv.includes(name);
  const url = get("--url");

  if (!url) return null;

  return {
    startUrl: url,
    maxPages: Number(get("--max-pages") || DEFAULT_MAX_PAGES),
    maxDepth: Number(get("--max-depth") || DEFAULT_MAX_DEPTH),
    renderMode: has("--render") ? "rendered" : "static",
    crawlScope: has("--faq-only") ? "faq-only" : "site",
    includeSitemap: !has("--no-sitemap"),
    includeLlmsTxt: !has("--no-llms"),
    includeFaqAudit: !has("--no-faq"),
    includeStructuredData: !has("--no-schema"),
    includeAnswerability: !has("--no-answerability"),
    includeMetaAudit: !has("--no-meta"),
    includeLinkAudit: !has("--no-links"),
    sameHostOnly: !has("--allow-external"),
    respectRobots: has("--respect-robots"),
  };
}

async function runCli() {
  const config = readCliConfig(process.argv.slice(2));
  if (!config) return;

  const result = await runSiteAiAuditFromPayload(config);
  console.log(JSON.stringify(result, null, 2));
}

const directRunPath = process.argv[1] || "";
if (/site-ai-audit-crawler\.(ts|js)$/.test(directRunPath)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
