// src/jobs/subjobs/site-ai-audit-ai-analysis.ts
// AI summary layer for the experimental site audit crawler.

import type { AIAgent } from "../../core/agent.js";
import type {
  SiteAiAuditResult,
  SiteAuditActionItem,
  SiteAuditIssue,
  SiteAuditPage,
} from "../site-ai-audit-crawler.js";

export type SiteAiAuditAiAnalysis = NonNullable<SiteAiAuditResult["aiAnalysis"]>;

type RunWithSystemAgent = Pick<AIAgent, "runWithSystem">;
const AI_ANALYSIS_TIMEOUT_MS = 90_000;

export async function analyzeSiteAuditWithAi(
  agent: RunWithSystemAgent,
  result: SiteAiAuditResult,
  model = "gpt-5.5"
): Promise<SiteAiAuditAiAnalysis> {
  const system = [
    "You are a senior digital marketing website auditor.",
    "You receive deterministic crawler evidence and turn it into client-facing and internal conclusions.",
    "Do not invent facts, URLs, status codes, schemas, or missing items.",
    "Do not discuss implementation, prompts, the chat, or the user request.",
    "Avoid repeating FAQ recommendations unless the evidence shows a real FAQ/schema gap.",
    "Return only valid JSON in Hebrew.",
  ].join("\n");

  const prompt = [
    "Analyze this website audit evidence and return JSON with exactly these keys:",
    "confidence, executiveSummary, clientNarrative, internalRisks, topOpportunities, recommendedNextSteps, uncertainties, suggestedClientSections.",
    "",
    "Field rules:",
    "- confidence: high | medium | low",
    "- executiveSummary: 2-4 sentences, practical and specific.",
    "- clientNarrative: 1 short paragraph a digital agency could show a client.",
    "- internalRisks: array of up to 5 internal cautions or manual checks.",
    "- topOpportunities: array of up to 6 meaningful improvement opportunities.",
    "- recommendedNextSteps: array of up to 6 practical next actions.",
    "- uncertainties: array of up to 5 places where evidence is incomplete or needs manual review.",
    "- suggestedClientSections: array of up to 6 report sections that are useful to show the client.",
    "",
    "Crawler evidence:",
    JSON.stringify(buildEvidencePack(result)),
  ].join("\n");

  console.log(`[site-ai-audit] ai-analysis: starting ${model}`);
  let raw = "";
  try {
    raw = await withTimeout(
      agent.runWithSystem(prompt, system, model),
      AI_ANALYSIS_TIMEOUT_MS,
      `AI analysis timed out after ${Math.round(AI_ANALYSIS_TIMEOUT_MS / 1000)} seconds`
    );
    console.log("[site-ai-audit] ai-analysis: completed");
  } catch (error) {
    console.log(`[site-ai-audit] ai-analysis: skipped (${error instanceof Error ? error.message : String(error)})`);
    throw error;
  }
  const parsed = parseModelJson(raw);

  return normalizeAiAnalysis(parsed, model);
}

function buildEvidencePack(result: SiteAiAuditResult): Record<string, unknown> {
  const pages = Array.isArray(result.pages) ? result.pages : [];
  const issues = Array.isArray(result.issues) ? result.issues : [];
  const actions = Array.isArray(result.actionItems) ? result.actionItems : [];

  return {
    site: {
      host: result.host,
      startUrl: result.normalizedStartUrl || result.startUrl,
      renderMode: result.config?.renderMode,
      pagesCrawled: pages.length,
      score: compactScore(result.score),
      robots: result.robots,
      sitemap: {
        found: result.sitemap?.found,
        url: result.sitemap?.url,
        urlCount: result.sitemap?.urls?.length || 0,
      },
      llmsTxt: result.llmsTxt,
    },
    issueStats: summarizeIssues(issues),
    pageTypeCoverage: summarizePageTypes(pages),
    importantPages: pickImportantPages(pages),
    priorityActions: actions.slice(0, 12).map(actionToEvidence),
    criticalIssueGroups: groupIssues(issues).slice(0, 14),
    metadata: summarizeMetadata(pages),
    links: summarizeLinks(pages),
    structuredData: summarizeStructuredData(pages),
    deterministicRecommendations: result.recommendations || [],
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function compactScore(score: SiteAiAuditResult["score"]): Record<string, unknown> {
  return {
    total: score.total,
    geoAiReadiness: score.geoAiReadiness,
    technicalSeo: score.technicalSeo,
    contentEeAt: score.contentEeAt,
    structuredData: score.structuredData,
    crawlerRendering: score.crawlerRendering,
    performance: score.performance,
    confidence: score.confidence,
    sections: (score.sections || []).map((section) => ({
      key: section.key,
      label: section.label,
      score: section.score,
      max: section.max,
      summary: section.summary,
      components: (section.components || []).map((component) => ({
        key: component.key,
        label: component.label,
        score: component.score,
        max: component.max,
        evidenceLevel: component.evidenceLevel,
      })),
    })),
  };
}

function summarizeIssues(issues: SiteAuditIssue[]): Record<string, number> {
  return issues.reduce<Record<string, number>>((acc, issue) => {
    const key = `${issue.severity}:${issue.category}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function summarizePageTypes(pages: SiteAuditPage[]): Record<string, number> {
  return pages.reduce<Record<string, number>>((acc, page) => {
    acc[page.pageType || "other"] = (acc[page.pageType || "other"] || 0) + 1;
    return acc;
  }, {});
}

function pickImportantPages(pages: SiteAuditPage[]): Array<Record<string, unknown>> {
  return pages
    .slice()
    .sort((a, b) => pageImportanceScore(b) - pageImportanceScore(a))
    .slice(0, 18)
    .map((page) => ({
      url: page.url,
      type: page.pageType,
      status: page.status,
      title: page.title,
      h1: page.h1,
      wordCount: page.wordCount,
      metaDescriptionLength: page.metaDiagnostics?.descriptionLength || 0,
      h1Count: page.metaDiagnostics?.h1Count || 0,
      canonicalMatchesUrl: page.metaDiagnostics?.canonicalMatchesUrl,
      schemaTypes: page.jsonLdTypes,
      domFaqCount: page.domFaqCount,
      schemaFaqCount: page.schemaFaqCount,
      internalLinks: page.linkDiagnostics?.internalCount || 0,
      externalLinks: page.linkDiagnostics?.externalCount || 0,
    }));
}

function pageImportanceScore(page: SiteAuditPage): number {
  const typeWeight: Record<string, number> = {
    homepage: 100,
    hotel: 88,
    destination: 80,
    brand: 72,
    meeting: 68,
    offer: 64,
    faq: 55,
    contact: 42,
    blog: 35,
    legal: 10,
    technical: 5,
    other: 20,
  };

  return (typeWeight[page.pageType] || 20)
    + (page.status < 400 ? 8 : -20)
    + Math.min(10, (page.jsonLdTypes || []).length * 2)
    + Math.min(8, Math.round((page.wordCount || 0) / 180));
}

function actionToEvidence(item: SiteAuditActionItem): Record<string, unknown> {
  return {
    priority: item.priority,
    workstream: item.workstream,
    owner: item.owner,
    effort: item.effort,
    impact: item.impact,
    affectedCount: item.affectedCount,
    pageType: item.pageType,
    finding: item.finding,
    whyItMatters: item.whyItMatters,
    recommendedFix: item.recommendedFix,
    examples: (item.affectedUrls || []).slice(0, 5),
    evidence: item.evidence,
  };
}

function groupIssues(issues: SiteAuditIssue[]): Array<Record<string, unknown>> {
  const map = new Map<string, { issue: SiteAuditIssue; urls: Set<string>; count: number }>();

  for (const issue of issues) {
    const key = `${issue.severity}|${issue.category}|${issue.title}|${issue.recommendation}`;
    if (!map.has(key)) {
      map.set(key, { issue, urls: new Set<string>(), count: 0 });
    }
    const group = map.get(key)!;
    group.count++;
    if (issue.pageUrl) group.urls.add(issue.pageUrl);
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .map((group) => ({
      severity: group.issue.severity,
      category: group.issue.category,
      title: group.issue.title,
      count: group.count,
      detail: group.issue.detail,
      recommendation: group.issue.recommendation,
      examples: Array.from(group.urls).slice(0, 5),
    }));
}

function summarizeMetadata(pages: SiteAuditPage[]): Record<string, number> {
  return {
    missingTitle: pages.filter((page) => !page.title).length,
    missingDescription: pages.filter((page) => !page.metaDescription).length,
    missingH1: pages.filter((page) => !page.h1).length,
    multipleH1: pages.filter((page) => (page.metaDiagnostics?.h1Count || 0) > 1).length,
    canonicalMismatch: pages.filter((page) => page.canonical && page.metaDiagnostics && !page.metaDiagnostics.canonicalMatchesUrl).length,
    noindex: pages.filter((page) => /noindex|none/i.test(page.robotsMeta || "")).length,
  };
}

function summarizeLinks(pages: SiteAuditPage[]): Record<string, unknown> {
  const domains = new Map<string, number>();
  let internal = 0;
  let external = 0;

  for (const page of pages) {
    internal += page.linkDiagnostics?.internalCount || 0;
    external += page.linkDiagnostics?.externalCount || 0;
    for (const domain of page.linkDiagnostics?.externalDomains || []) {
      domains.set(domain, (domains.get(domain) || 0) + 1);
    }
  }

  return {
    internal,
    external,
    topExternalDomains: Array.from(domains.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([domain, count]) => ({ domain, count })),
  };
}

function summarizeStructuredData(pages: SiteAuditPage[]): Record<string, unknown> {
  const typeCounts = new Map<string, number>();
  for (const page of pages) {
    for (const type of page.jsonLdTypes || []) {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
  }

  return {
    pagesWithJsonLd: pages.filter((page) => (page.jsonLdTypes || []).length).length,
    pagesWithoutJsonLd: pages.filter((page) => !(page.jsonLdTypes || []).length).length,
    faqPagesWithSchemaMismatch: pages.filter((page) => page.schemaOnlyQuestions.length || page.domOnlyQuestions.length).length,
    visibleFaqWithoutFaqPage: pages.filter((page) => page.domFaqCount > 0 && page.schemaFaqCount === 0).length,
    topTypes: Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([type, count]) => ({ type, count })),
  };
}

function parseModelJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI analysis did not return a JSON object");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeAiAnalysis(value: unknown, model: string): SiteAiAuditAiAnalysis {
  const obj = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const toString = (input: unknown): string => typeof input === "string" ? input.trim() : "";
  const toArray = (input: unknown): string[] => Array.isArray(input)
    ? input.map((item) => toString(item)).filter(Boolean).slice(0, 8)
    : [];
  const rawConfidence = toString(obj.confidence).toLowerCase();
  const confidence: SiteAiAuditAiAnalysis["confidence"] =
    rawConfidence === "high" || rawConfidence === "low" ? rawConfidence : "medium";

  return {
    model,
    generatedAt: new Date().toISOString(),
    confidence,
    executiveSummary: toString(obj.executiveSummary),
    clientNarrative: toString(obj.clientNarrative),
    internalRisks: toArray(obj.internalRisks),
    topOpportunities: toArray(obj.topOpportunities),
    recommendedNextSteps: toArray(obj.recommendedNextSteps),
    uncertainties: toArray(obj.uncertainties),
    suggestedClientSections: toArray(obj.suggestedClientSections),
  };
}
