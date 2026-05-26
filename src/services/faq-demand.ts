import {
  AnalyticsService,
  type AnalyticsAccount,
  type AnalyticsFaqLandingPage,
  type AnalyticsFaqSearchTerm,
} from "./analytics.js";
import {
  SearchConsoleService,
  type SearchConsoleDimensionFilter,
  type SearchConsoleQueryRow,
  type SearchConsoleSite,
} from "./search-console.js";

type DateRangeInput = {
  startDate?: string;
  endDate?: string;
};

export type FaqDemandInput = {
  subject?: string;
  websiteUrl?: string;
  dateRange?: DateRangeInput;
  analytics?: {
    enabled?: boolean;
    accountId?: string;
    propertyId?: string;
  };
  searchConsole?: {
    enabled?: boolean;
    siteUrl?: string;
  };
  limit?: number;
  maxPhrases?: number;
  questionsPerPhrase?: number;
};

export type FaqDemandPhrase = {
  phrase: string;
  intent: string;
  category: string;
  source: "search-console" | "analytics-page" | "analytics-site-search" | "starter-intent";
  page?: string;
  score: number;
  evidence: string;
};

export type FaqDemandCandidate = {
  question: string;
  category: string;
  source: "search-console" | "analytics-page" | "analytics-site-search" | "starter-intent";
  signal: string;
  page?: string;
  score: number;
  evidence: string;
};

export type FaqDemandCategory = {
  title: string;
  description: string;
  count: number;
  signals: string[];
};

export type FaqDemandResult = {
  ok: true;
  generatedAt: string;
  subject: string;
  sources: {
    analyticsAccount?: AnalyticsAccount;
    searchConsoleSite?: SearchConsoleSite;
    dateRange: {
      startDate?: string;
      endDate?: string;
    };
    signalCounts: {
      rawQueries: number;
      matchedQueries: number;
      rawLandingPages: number;
      matchedLandingPages: number;
      rawSiteSearchTerms: number;
      matchedSiteSearchTerms: number;
      sourcePhrases: number;
      starterIdeas: number;
    };
    warnings: string[];
  };
  topQueries: SearchConsoleQueryRow[];
  topLandingPages: AnalyticsFaqLandingPage[];
  topSiteSearchTerms: AnalyticsFaqSearchTerm[];
  phrases: FaqDemandPhrase[];
  categories: FaqDemandCategory[];
  candidates: FaqDemandCandidate[];
  promptBrief: string;
};

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  booking: {
    title: "Booking & Price Intent",
    description: "Pricing, booking, cancellation, payment, deposits and commercial friction.",
  },
  location: {
    title: "Location & Access Intent",
    description: "Address, transport, nearby places, parking, airport, public transit and arrival planning.",
  },
  amenities: {
    title: "Amenities & Facilities Intent",
    description: "Rooms, facilities, comfort, Wi-Fi, kitchen, breakfast, pool, accessibility and practical stay details.",
  },
  policy: {
    title: "Policies & Requirements Intent",
    description: "Rules, restrictions, check-in, check-out, pets, age, documents and stay conditions.",
  },
  comparison: {
    title: "Comparison & Trust Intent",
    description: "Reviews, alternatives, suitability, legitimacy, quality, ratings and decision confidence.",
  },
  support: {
    title: "Support & Problem-Solving Intent",
    description: "Contact, help, changes, troubleshooting, special requests and what happens next.",
  },
  general: {
    title: "General Discovery Intent",
    description: "Broad informational searches and pages that can become clearer FAQ coverage.",
  },
};

const SUBJECT_GENERIC_TOKENS = new Set([
  "a",
  "an",
  "and",
  "apartment",
  "apartments",
  "com",
  "hotel",
  "hotels",
  "house",
  "inn",
  "official",
  "resort",
  "site",
  "stay",
  "suite",
  "suites",
  "the",
  "this",
  "villa",
  "villas",
  "website",
  "www",
]);

const HOSPITALITY_ENTITY_TOKENS = new Set([
  "apartment",
  "apartments",
  "hotel",
  "hotels",
  "house",
  "inn",
  "resort",
  "suite",
  "suites",
  "villa",
  "villas",
]);

const DEMAND_INTENT_TOKENS = new Set([
  "access",
  "accessible",
  "accessibility",
  "address",
  "airport",
  "amenities",
  "amenity",
  "arrival",
  "attraction",
  "attractions",
  "balcony",
  "bar",
  "beach",
  "book",
  "booking",
  "breakfast",
  "cancel",
  "cancellation",
  "center",
  "centre",
  "check",
  "checkin",
  "checkout",
  "close",
  "contact",
  "cost",
  "deal",
  "deals",
  "deposit",
  "directions",
  "distance",
  "email",
  "facilities",
  "facility",
  "fee",
  "fees",
  "help",
  "kid",
  "kids",
  "kitchen",
  "landmark",
  "location",
  "map",
  "near",
  "nearby",
  "parking",
  "payment",
  "pets",
  "phone",
  "policy",
  "pool",
  "price",
  "rate",
  "rates",
  "refund",
  "restaurant",
  "review",
  "reviews",
  "room",
  "rooms",
  "service",
  "spa",
  "support",
  "train",
  "transport",
  "wifi",
  "wi",
  "fi",
]);

export class FaqDemandService {
  private analytics = new AnalyticsService();
  private searchConsole = new SearchConsoleService();

  async listSources(): Promise<{
    analyticsAccounts: AnalyticsAccount[];
    searchConsoleSites: SearchConsoleSite[];
  }> {
    const [analyticsAccounts, searchConsoleSites] = await Promise.all([
      Promise.resolve(this.analytics.listAccounts()),
      this.searchConsole.listSites(),
    ]);

    return {
      analyticsAccounts,
      searchConsoleSites,
    };
  }

  async analyze(input: FaqDemandInput = {}): Promise<FaqDemandResult> {
    const subject = String(input.subject || input.websiteUrl || "this site").trim();
    const limit = Math.max(10, Math.min(Number(input.limit || 60), 150));
    const maxPhrases = Math.max(3, Math.min(Number(input.maxPhrases || 10), 30));
    const questionsPerPhrase = Math.max(1, Math.min(Number(input.questionsPerPhrase || 1), 5));
    const warnings: string[] = [];

    let analyticsAccount: AnalyticsAccount | undefined;
    let searchConsoleSite: SearchConsoleSite | undefined;
    let topLandingPages: AnalyticsFaqLandingPage[] = [];
    let topSiteSearchTerms: AnalyticsFaqSearchTerm[] = [];
    let topQueries: SearchConsoleQueryRow[] = [];

    if (input.analytics?.enabled !== false) {
      try {
        const analyticsResult = await this.analytics.fetchFaqDemandSignals({
          accountId: input.analytics?.accountId,
          propertyId: input.analytics?.propertyId,
          dateRange: input.dateRange,
          limit,
        });
        analyticsAccount = analyticsResult.account;
        topLandingPages = analyticsResult.landingPages;
        topSiteSearchTerms = analyticsResult.siteSearchTerms;
      } catch (error: any) {
        warnings.push(`Analytics signals were not loaded: ${error?.message || "unknown error"}`);
      }
    }

    if (input.searchConsole?.enabled !== false) {
      try {
        const searchResult = await this.searchConsole.fetchQueryRows({
          siteUrl: input.searchConsole?.siteUrl || input.websiteUrl,
          dateRange: input.dateRange,
          limit,
        });
        searchConsoleSite = searchResult.site;
        const subjectRows = await this.fetchSubjectSearchConsoleRows({
          subject,
          siteUrl: searchConsoleSite.siteUrl,
          dateRange: input.dateRange,
          limit: Math.min(limit, 50),
        });
        topQueries = this.uniqueSearchConsoleRows([...searchResult.rows, ...subjectRows.rows])
          .sort((a, b) => this.searchConsoleScore(b) - this.searchConsoleScore(a));
        warnings.push(...subjectRows.warnings);
      } catch (error: any) {
        warnings.push(`Search Console signals were not loaded: ${error?.message || "unknown error"}`);
      }
    }

    const rawQueries = topQueries.length;
    const rawLandingPages = topLandingPages.length;
    const rawSiteSearchTerms = topSiteSearchTerms.length;
    const rawSignalCount = rawQueries + rawLandingPages + rawSiteSearchTerms;
    topQueries = this.filterBySubject(topQueries, subject, (row) => `${row.query} ${row.page}`).slice(0, 40);
    topLandingPages = this.filterBySubject(topLandingPages, subject, (page) => `${page.pageTitle} ${page.pagePath}`).slice(0, 20);
    topSiteSearchTerms = this.filterBySubject(topSiteSearchTerms, subject, (term) => term.searchTerm).slice(0, 20);

    const matchedQueries = topQueries.length;
    const matchedLandingPages = topLandingPages.length;
    const matchedSiteSearchTerms = topSiteSearchTerms.length;
    const subjectSignalCount = topQueries.length + topLandingPages.length + topSiteSearchTerms.length;
    if (rawSignalCount && !subjectSignalCount) {
      warnings.push(`Ignored ${rawSignalCount - subjectSignalCount} signals that did not match "${subject}". Check the selected GA4 property or Search Console site if this looks too strict.`);
    }

    let phrases = this.buildPhrases(subject, topQueries, topLandingPages, topSiteSearchTerms)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPhrases);
    const realPhraseCount = phrases.length;
    if (!realPhraseCount) {
      phrases = this.addStarterPhrases(subject, phrases, maxPhrases);
      warnings.push(`No subject-matching search phrases were found for "${subject}". Showing starter FAQ phrases instead of unrelated account data.`);
    }
    const sourcePhraseCount = phrases.filter((phrase) => phrase.source !== "starter-intent").length;
    const starterIdeaCount = phrases.filter((phrase) => phrase.source === "starter-intent").length;
    const candidates = this.buildCandidates(subject, phrases, questionsPerPhrase);
    const categories = this.buildCategories(candidates);

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      subject,
      sources: {
        analyticsAccount,
        searchConsoleSite,
        dateRange: {
          startDate: input.dateRange?.startDate,
          endDate: input.dateRange?.endDate,
        },
        signalCounts: {
          rawQueries,
          matchedQueries,
          rawLandingPages,
          matchedLandingPages,
          rawSiteSearchTerms,
          matchedSiteSearchTerms,
          sourcePhrases: sourcePhraseCount,
          starterIdeas: starterIdeaCount,
        },
        warnings,
      },
      topQueries,
      topLandingPages,
      topSiteSearchTerms,
      phrases,
      categories,
      candidates,
      promptBrief: this.buildPromptBrief(subject, topQueries, topLandingPages, topSiteSearchTerms, phrases, categories, candidates, warnings, questionsPerPhrase),
    };
  }

  private async fetchSubjectSearchConsoleRows(input: {
    subject: string;
    siteUrl: string;
    dateRange?: DateRangeInput;
    limit: number;
  }): Promise<{ rows: SearchConsoleQueryRow[]; warnings: string[] }> {
    const filterSets = this.searchConsoleFilterSetsForSubject(input.subject);
    if (!filterSets.length) return { rows: [], warnings: [] };

    const results = await Promise.allSettled(
      filterSets.map((dimensionFilters) =>
        this.searchConsole.fetchQueryRows({
          siteUrl: input.siteUrl,
          dateRange: input.dateRange,
          dimensionFilters,
          limit: input.limit,
        })
      )
    );

    const rows: SearchConsoleQueryRow[] = [];
    const warnings: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        rows.push(...result.value.rows);
      } else {
        warnings.push(`A targeted Search Console lookup failed: ${result.reason?.message || String(result.reason)}`);
      }
    }

    return {
      rows: this.uniqueSearchConsoleRows(rows),
      warnings,
    };
  }

  private searchConsoleFilterSetsForSubject(subject: string): SearchConsoleDimensionFilter[][] {
    const filters: SearchConsoleDimensionFilter[] = [];
    const seen = new Set<string>();
    const anchors = this.subjectAnchorTokens(subject);
    const subjectPhrase = this.cleanSignal(subject).toLowerCase();
    const anchorPhrase = anchors.join(" ");
    const tailPhrase = anchors.slice(-2).join(" ");
    const subjectSlug = this.slugifyForSearchConsole(subjectPhrase);
    const tailSlug = this.slugifyForSearchConsole(tailPhrase);

    const add = (dimension: SearchConsoleDimensionFilter["dimension"], expression: string) => {
      const cleanExpression = String(expression || "").trim().toLowerCase();
      if (cleanExpression.length < 3) return;
      const key = `${dimension}:${cleanExpression}`;
      if (seen.has(key)) return;
      seen.add(key);
      filters.push({ dimension, operator: "contains", expression: cleanExpression });
    };

    add("query", subjectPhrase);
    add("query", anchorPhrase);
    add("query", tailPhrase);
    add("page", subjectSlug);
    add("page", tailSlug);

    return filters.map((filter) => [filter]);
  }

  private uniqueSearchConsoleRows(rows: SearchConsoleQueryRow[]): SearchConsoleQueryRow[] {
    const byKey = new Map<string, SearchConsoleQueryRow>();
    for (const row of rows) {
      const key = `${row.query.toLowerCase()}|${row.page.toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing || this.searchConsoleScore(row) > this.searchConsoleScore(existing)) {
        byKey.set(key, row);
      }
    }
    return Array.from(byKey.values());
  }

  private searchConsoleScore(row: SearchConsoleQueryRow): number {
    return row.impressions + row.clicks * 8 + (row.position ? Math.max(0, 20 - row.position) * 3 : 0);
  }

  private buildPhrases(
    subject: string,
    queries: SearchConsoleQueryRow[],
    landingPages: AnalyticsFaqLandingPage[],
    siteSearchTerms: AnalyticsFaqSearchTerm[]
  ): FaqDemandPhrase[] {
    const seen = new Set<string>();
    const phrases: FaqDemandPhrase[] = [];

    const add = (phrase: FaqDemandPhrase) => {
      const key = this.intentKey(subject, phrase.phrase || phrase.intent);
      if (!key || key.length < 3 || seen.has(key)) return;
      seen.add(key);
      phrases.push(phrase);
    };

    for (const row of queries) {
      const phrase = this.cleanSignal(row.query || this.pathToSignal(row.page));
      const intent = this.intentFromPhrase(subject, phrase);
      if (!this.matchesSubject(subject, `${phrase} ${row.page}`)) continue;
      if (this.isLikelySiblingEntitySignal(subject, `${phrase} ${row.page}`)) continue;
      if (!this.isUsefulPhrase(subject, phrase, intent)) continue;
      const category = this.classify(`${phrase} ${intent}`);
      add({
        phrase,
        intent,
        category,
        source: "search-console",
        page: row.page,
        score: Math.round(row.impressions + row.clicks * 12 + (row.position ? Math.max(0, 20 - row.position) * 3 : 0)),
        evidence: `${row.impressions} impressions, ${row.clicks} clicks, avg. position ${this.round(row.position)}`,
      });
    }

    for (const term of siteSearchTerms) {
      const phrase = this.cleanSignal(term.searchTerm);
      const intent = this.intentFromPhrase(subject, phrase);
      if (!this.matchesSubject(subject, phrase)) continue;
      if (this.isLikelySiblingEntitySignal(subject, phrase)) continue;
      if (!this.isUsefulPhrase(subject, phrase, intent)) continue;
      const category = this.classify(`${phrase} ${intent}`);
      add({
        phrase,
        intent,
        category,
        source: "analytics-site-search",
        score: Math.round(term.events * 10 + term.sessions),
        evidence: `${term.events} site-search events${term.sessions ? `, ${term.sessions} sessions` : ""}`,
      });
    }

    for (const page of landingPages) {
      const phrase = this.cleanSignal(this.pageSignal(page));
      const intent = this.intentFromPhrase(subject, phrase);
      if (!this.matchesSubject(subject, `${phrase} ${page.pagePath}`)) continue;
      if (this.isLikelySiblingEntitySignal(subject, `${phrase} ${page.pagePath}`)) continue;
      if (!this.isUsefulPhrase(subject, phrase, intent)) continue;
      const category = this.classify(`${phrase} ${page.pagePath} ${intent}`);
      add({
        phrase,
        intent,
        category,
        source: "analytics-page",
        page: page.pagePath,
        score: Math.round(page.sessions + page.views * 0.3 + page.events * 0.05),
        evidence: `${page.sessions} sessions, ${page.views} views`,
      });
    }

    return phrases;
  }

  private addStarterPhrases(subject: string, phrases: FaqDemandPhrase[], maxPhrases: number): FaqDemandPhrase[] {
    if (!this.hasSubjectAnchors(subject) || phrases.length >= maxPhrases) return phrases;

    const output = [...phrases];
    const seen = new Set(output.map((phrase) => this.intentKey(subject, phrase.phrase)));
    const starterIntents = [
      { intent: "check-in", category: "policy" },
      { intent: "check-out", category: "policy" },
      { intent: "breakfast", category: "amenities" },
      { intent: "parking", category: "location" },
      { intent: "rooms", category: "amenities" },
      { intent: "location", category: "location" },
      { intent: "cancellation policy", category: "booking" },
      { intent: "contact", category: "support" },
      { intent: "accessibility", category: "amenities" },
      { intent: "pets", category: "policy" },
    ];

    for (const starter of starterIntents) {
      if (output.length >= maxPhrases) break;
      const phrase = this.cleanSignal(`${subject} ${starter.intent}`);
      const key = this.intentKey(subject, phrase);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push({
        phrase,
        intent: starter.intent,
        category: starter.category,
        source: "starter-intent",
        score: 1,
        evidence: "starter FAQ intent; no matching source row found",
      });
    }

    return output;
  }

  private buildCandidates(
    subject: string,
    phrases: FaqDemandPhrase[],
    questionsPerPhrase: number
  ): FaqDemandCandidate[] {
    return phrases.flatMap((phrase) =>
      this.questionAnglesForPhrase(subject, phrase, questionsPerPhrase).map((question) => ({
        question,
        category: phrase.category,
        source: phrase.source,
        signal: phrase.phrase,
        page: phrase.page,
        score: phrase.score,
        evidence: phrase.evidence,
      }))
    );
  }

  private buildCategories(candidates: FaqDemandCandidate[]): FaqDemandCategory[] {
    const grouped = new Map<string, FaqDemandCandidate[]>();
    for (const candidate of candidates) {
      grouped.set(candidate.category, [...(grouped.get(candidate.category) || []), candidate]);
    }

    return Array.from(grouped.entries())
      .map(([category, items]) => {
        const meta = CATEGORY_META[category] || CATEGORY_META.general;
        return {
          title: meta.title,
          description: meta.description,
          count: items.length,
          signals: Array.from(new Set(items.map((item) => item.signal))).slice(0, 6),
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  private buildPromptBrief(
    subject: string,
    queries: SearchConsoleQueryRow[],
    landingPages: AnalyticsFaqLandingPage[],
    siteSearchTerms: AnalyticsFaqSearchTerm[],
    phrases: FaqDemandPhrase[],
    categories: FaqDemandCategory[],
    candidates: FaqDemandCandidate[],
    warnings: string[],
    questionsPerPhrase: number
  ): string {
    const lines = [
      `SEARCH-DEMAND FAQ BRIEF FOR ${subject}`,
      "",
      "Use these GA4/Search Console phrases as evidence for question demand. The phrases are not factual answer sources.",
      "If a phrase is marked as starter-intent, treat it as a fallback suggestion only, not as evidence that users searched it.",
      "For final answers, verify facts against official or otherwise approved sources.",
      `For each selected phrase, generate up to ${questionsPerPhrase} natural FAQ question(s), only when the questions are useful and not duplicates.`,
      "Avoid duplicate questions caused by similar long-tail phrases. Merge similar intents into one stronger question.",
      "",
      "Selected search phrases and inferred intents:",
      ...phrases.slice(0, 20).map((phrase) => `- ${phrase.phrase} | Intent: ${phrase.intent} | ${phrase.source} | ${phrase.evidence}${phrase.page ? ` | Page: ${phrase.page}` : ""}`),
      "",
      "Intent categories:",
      ...categories.slice(0, 8).map((category) => `- ${category.title}: ${category.description} Signals: ${category.signals.join(", ")}`),
      "",
      "Possible question angles:",
      ...candidates.slice(0, 18).map((candidate) => `- [${candidate.source}] ${candidate.question} | Evidence: ${candidate.evidence}${candidate.page ? ` | Page: ${candidate.page}` : ""}`),
      "",
      "Top Search Console queries:",
      ...queries.slice(0, 12).map((row) => `- ${row.query || "(empty query)"} | ${row.impressions} impressions, ${row.clicks} clicks, avg. position ${this.round(row.position)}${row.page ? ` | ${row.page}` : ""}`),
      "",
      "Top Analytics landing pages:",
      ...landingPages.slice(0, 10).map((page) => `- ${page.pageTitle} | ${page.pagePath} | ${page.sessions} sessions, ${page.views} views`),
      "",
      "Internal site-search terms:",
      ...(siteSearchTerms.length ? siteSearchTerms.slice(0, 10).map((term) => `- ${term.searchTerm} | ${term.events} events`) : ["- No GA4 site-search terms were found or configured."]),
    ];

    if (warnings.length) {
      lines.push("", "Warnings:", ...warnings.map((warning) => `- ${warning}`));
    }

    return lines.join("\n");
  }

  private intentFromPhrase(subject: string, phrase: string): string {
    const subjectTokens = new Set(this.tokenize(subject));
    const tokens = this.tokenize(phrase)
      .filter((token) => !subjectTokens.has(token))
      .filter((token) => !["hotel", "hotels", "official", "website", "www", "com", "near", "the", "a", "an"].includes(token));
    const intent = tokens.join(" ").trim();
    return intent || this.cleanSignal(phrase);
  }

  private intentKey(subject: string, phrase: string): string {
    return this.intentFromPhrase(subject, phrase)
      .toLowerCase()
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
      .replace(/\b(hotel|hotels|official|website|near|the|a|an|and|or)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isUsefulPhrase(subject: string, phrase: string, intent: string): boolean {
    const cleanPhrase = this.cleanSignal(phrase);
    const cleanIntent = this.cleanSignal(intent);
    if (!cleanPhrase || cleanPhrase.length < 3) return false;
    if (!this.matchesSubject(subject, cleanPhrase)) return false;
    if (!cleanIntent || cleanIntent.length < 3) return false;
    if (this.intentKey(subject, cleanPhrase).split(" ").filter(Boolean).length < 1) return false;
    if (this.isBrandOnly(subject, cleanPhrase)) return false;
    return true;
  }

  private isBrandOnly(subject: string, phrase: string): boolean {
    const phraseTokens = this.tokenize(phrase);
    const subjectTokens = new Set(this.tokenize(subject));
    if (!phraseTokens.length || !subjectTokens.size) return false;
    return phraseTokens.every((token) => subjectTokens.has(token) || ["hotel", "hotels", "official", "website"].includes(token));
  }

  private isLikelySiblingEntitySignal(subject: string, signal: string): boolean {
    const anchors = this.subjectAnchorTokens(subject);
    if (anchors.length !== 2) return false;

    const signalTokens = this.tokenize(signal);
    const signalTokenSet = new Set(signalTokens);
    if (!anchors.every((token) => signalTokenSet.has(token))) return false;
    if (!signalTokens.some((token) => HOSPITALITY_ENTITY_TOKENS.has(token))) return false;

    const subjectAnchorSet = new Set(anchors);
    const nonIntentExtraTokens = Array.from(new Set(signalTokens.filter((token) => {
      return token.length >= 3
        && !subjectAnchorSet.has(token)
        && !SUBJECT_GENERIC_TOKENS.has(token)
        && !DEMAND_INTENT_TOKENS.has(token);
    })));

    return nonIntentExtraTokens.length > 0;
  }

  private tokenize(value: string): string[] {
    return String(value || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private filterBySubject<T>(items: T[], subject: string, textForItem: (item: T) => string): T[] {
    if (!this.hasSubjectAnchors(subject)) return items;
    return items.filter((item) => this.matchesSubject(subject, textForItem(item)));
  }

  private hasSubjectAnchors(subject: string): boolean {
    return this.subjectAnchorTokens(subject).length > 0;
  }

  private matchesSubject(subject: string, text: string): boolean {
    const anchors = this.subjectAnchorTokens(subject);
    if (!anchors.length) return true;

    const textTokens = this.tokenize(text);
    const textTokenSet = new Set(textTokens);
    const textCompact = textTokens.join("");
    const subjectCompact = anchors.join("");
    if (subjectCompact && textCompact.includes(subjectCompact)) return true;

    const matchedTokens = anchors.filter((token) => textTokenSet.has(token) || textCompact.includes(token));
    if (anchors.length === 1) return matchedTokens.length === 1;

    const distinctiveTokens = this.subjectDistinctiveTokens(anchors);
    const distinctiveMatches = distinctiveTokens.filter((token) => textTokenSet.has(token) || textCompact.includes(token));
    if (!distinctiveMatches.length) return false;

    if (anchors.length === 2) return matchedTokens.length === 2;

    const firstAnchorMatches = textTokenSet.has(anchors[0]) || textCompact.includes(anchors[0]);
    if (anchors.length >= 4 && firstAnchorMatches && matchedTokens.length >= 2) return true;
    if (anchors.length >= 4 && distinctiveMatches.length >= 2) return true;

    const required = anchors.length >= 5 ? 3 : 2;
    return matchedTokens.length >= required;
  }

  private subjectAnchorTokens(subject: string): string[] {
    const tokens = this.tokenize(subject)
      .filter((token) => token.length >= 3)
      .filter((token) => !SUBJECT_GENERIC_TOKENS.has(token));
    return Array.from(new Set(tokens));
  }

  private subjectDistinctiveTokens(anchors: string[]): string[] {
    if (anchors.length <= 1) return anchors;
    if (anchors.length === 2) return anchors.slice(1);
    if (anchors.length === 3) return anchors.slice(2);
    return anchors.slice(-3);
  }

  private questionAnglesForPhrase(subject: string, phrase: FaqDemandPhrase, maxQuestions: number): string[] {
    const subjectName = subject || "this property";
    const intent = phrase.intent || phrase.phrase;
    const category = phrase.category;
    const questions: string[] = [];

    if (this.looksLikeQuestion(phrase.phrase)) {
      questions.push(this.ensureQuestionMark(this.capitalize(phrase.phrase)));
    }

    if (category === "booking") {
      questions.push(`What should guests know about ${intent} at ${subjectName}?`);
      questions.push(`Does ${subjectName} have any booking rules for ${intent}?`);
    } else if (category === "location") {
      questions.push(`How does ${subjectName} handle ${intent}?`);
      questions.push(`What should guests know about ${intent} before arriving at ${subjectName}?`);
    } else if (category === "amenities") {
      questions.push(`Does ${subjectName} offer ${intent}?`);
      questions.push(`What should guests know about ${intent} at ${subjectName}?`);
    } else if (category === "policy") {
      questions.push(`What is the policy for ${intent} at ${subjectName}?`);
      questions.push(`How does ${subjectName} handle ${intent}?`);
    } else if (category === "comparison") {
      questions.push(`What should users know when comparing ${subjectName} for ${intent}?`);
      questions.push(`Is ${subjectName} a good fit for users searching for ${intent}?`);
    } else if (category === "support") {
      questions.push(`How can users get help with ${intent} at ${subjectName}?`);
      questions.push(`Who should users contact about ${intent} at ${subjectName}?`);
    } else {
      questions.push(`What should users know about ${intent} at ${subjectName}?`);
      questions.push(`How does ${subjectName} answer questions about ${intent}?`);
    }

    return Array.from(new Set(questions.map((question) => this.ensureQuestionMark(question)))).slice(0, maxQuestions);
  }

  private classify(value: string): string {
    const text = String(value || "").toLowerCase();
    if (/price|cost|fee|fees|deposit|refund|cancel|cancellation|payment|book|booking|rate|rates|cheap|deal|מחיר|עלות|ביטול|הזמנה/.test(text)) return "booking";
    if (/contact|support|help|phone|email|change|problem|request|service|customer|צור קשר|עזרה|תמיכה|טלפון|שירות/.test(text)) return "support";
    if (/where|address|location|near|nearby|close|airport|train|metro|parking|transport|map|directions|beach|center|centre|distance|attraction|attractions|landmark|איפה|כתובת|חניה|קרוב|שדה/.test(text)) return "location";
    if (/room|suite|apartment|amenit|facility|facilities|wifi|wi-fi|breakfast|pool|spa|kitchen|balcony|air conditioning|\bac\b|accessible|accessibility|חדר|בריכה|ארוחת|מטבח|מרפסת|נגיש/.test(text)) return "amenities";
    if (/policy|policies|check.?in|check.?out|pet|pets|smok|children|kid|age|rules|allowed|hours|צ.?ק|חיות|עישון|ילדים|מותר/.test(text)) return "policy";
    if (/review|reviews|best|vs|versus|compare|comparison|rating|worth|safe|legit|recommended|המלצות|ביקורות|מומלץ|השוואה/.test(text)) return "comparison";
    return "general";
  }

  private pageSignal(page: AnalyticsFaqLandingPage): string {
    const title = String(page.pageTitle || "").replace(/\s+[|-]\s+.*$/, "").trim();
    return title || this.pathToSignal(page.pagePath);
  }

  private pathToSignal(pagePath: string): string {
    return String(pagePath || "")
      .split("?")[0]
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join(" ")
      .replace(/[-_]+/g, " ")
      .trim();
  }

  private cleanSignal(signal: string): string {
    return String(signal || "")
      .replace(/\s+/g, " ")
      .replace(/[?!.]+$/g, "")
      .trim()
      .slice(0, 120);
  }

  private slugifyForSearchConsole(value: string): string {
    return String(value || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  private looksLikeQuestion(signal: string): boolean {
    return /^(who|what|when|where|why|how|is|are|can|does|do|should|כמה|איך|איפה|האם|מתי|למה|מה)\b/i.test(signal);
  }

  private ensureQuestionMark(value: string): string {
    return value.endsWith("?") ? value : `${value}?`;
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private round(value: number): string {
    return Number.isFinite(value) ? String(Math.round(value * 10) / 10) : "0";
  }
}
