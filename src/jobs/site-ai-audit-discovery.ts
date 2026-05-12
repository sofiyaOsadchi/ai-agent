// src/jobs/site-ai-audit-discovery.ts
// Standalone URL discovery layer for the new AI site audit flow.

import * as cheerio from "cheerio";

export type SiteUrlGroup =
  | "faq"
  | "hotel"
  | "location"
  | "offer"
  | "blog"
  | "legal"
  | "contact"
  | "booking"
  | "asset"
  | "other";

export type DiscoverySource =
  | "start-url"
  | "robots-sitemap"
  | "sitemap"
  | "page-link"
  | "faq-candidate";

export type SiteDiscoveryConfig = {
  startUrl: string;
  maxUrls?: number;
  maxSitemapUrls?: number;
  maxFaqCandidateChecks?: number;
  faqCandidateConcurrency?: number;
  maxDepth?: number;
  fetchTimeoutMs?: number;
  sameHostOnly?: boolean;
  acceptLanguage?: string;
  userAgent?: string;
};

export type DiscoveredUrl = {
  url: string;
  path: string;
  depth: number;
  sources: DiscoverySource[];
  groups: SiteUrlGroup[];
  title: string;
};

export type SiteDiscoveryGroupSummary = {
  group: SiteUrlGroup;
  count: number;
  examples: string[];
};

export type SiteDiscoveryResult = {
  startedAt: string;
  finishedAt: string;
  startUrl: string;
  normalizedStartUrl: string;
  host: string;
  robots: {
    url: string;
    found: boolean;
    status: number | null;
    sitemapHints: string[];
  };
  faqCandidates: {
    checked: number;
    found: number;
    examples: string[];
  };
  urls: DiscoveredUrl[];
  groups: SiteDiscoveryGroupSummary[];
};

type QueueItem = { url: string; depth: number };

const DEFAULT_MAX_URLS = 600;
const DEFAULT_MAX_SITEMAP_URLS = 4000;
const DEFAULT_MAX_FAQ_CANDIDATE_CHECKS = 500;
const DEFAULT_FAQ_CANDIDATE_CONCURRENCY = 8;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_ACCEPT_LANGUAGE = "en-GB,en;q=0.9";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 SiteAiDiscoveryBot/0.2 (+https://carmelon.local)";

const ASSET_RE = /\.(?:jpg|jpeg|png|gif|webp|avif|svg|pdf|zip|rar|mp4|webm|mov|css|js|ico|woff2?|ttf|eot)$/i;
const FAQ_RE = /\b(faq|faqs|frequently-asked|questions|answers|help|support)\b/i;
const HOTEL_RE = /\b(hotel|hotels|aparthotel|aparthotels|apartment|apartments|serviced-apartments|rooms|suites|resort|resorts|hostel|hostels|stay)\b/i;
const LOCATION_RE = /\b(destination|destinations|location|locations|city|cities|country|countries|london|rome|barcelona|athens|hamburg|salzburg|tel-aviv|berlin|madrid|vienna|munich|prague|venice|paris)\b/i;
const OFFER_RE = /\b(offer|offers|deal|deals|special|voucher|gift|package|packages)\b/i;
const BLOG_RE = /\b(blog|article|articles|news|magazine|guide|guides)\b/i;
const LEGAL_RE = /\b(privacy|terms|cookies|cookie-policy|imprint|accessibility|policy|policies)\b/i;
const CONTACT_RE = /\b(contact|about|corporation|company|newsletter)\b/i;
const BOOKING_RE = /\b(book|booking|reserve|reservation|checkout|cart)\b/i;
const FAQ_CHILD_PATHS = new Set([
  "apartments",
  "family-apartments",
  "rooms",
  "suites",
  "reviews",
  "special-offers",
  "offers",
  "deals",
  "location",
  "directions",
  "facilities",
  "gallery",
  "photos",
]);

export class SiteAiAuditDiscoveryJob {
  async run(input: SiteDiscoveryConfig): Promise<SiteDiscoveryResult> {
    const startedAt = new Date().toISOString();
    const config = this.normalizeConfig(input);
    const normalizedStartUrl = this.normalizeUrl(config.startUrl);
    const start = new URL(normalizedStartUrl);
    const robots = await this.inspectRobots(start, config);
    const sitemapUrls = await this.collectSitemapUrls(start, robots.sitemapHints, config);
    const pageUrls = await this.collectLinkedUrls(normalizedStartUrl, config);
    const faqCandidates = await this.collectFaqCandidateUrls(
      start,
      [normalizedStartUrl, ...sitemapUrls, ...pageUrls],
      config
    );
    const merged = this.mergeUrls(normalizedStartUrl, sitemapUrls, pageUrls, faqCandidates.urls, config);

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      startUrl: input.startUrl,
      normalizedStartUrl,
      host: start.host,
      robots,
      faqCandidates: {
        checked: faqCandidates.checked,
        found: faqCandidates.urls.length,
        examples: faqCandidates.urls.slice(0, 8),
      },
      urls: merged,
      groups: this.summarizeGroups(merged),
    };
  }

  private normalizeConfig(input: SiteDiscoveryConfig): Required<SiteDiscoveryConfig> {
    if (!input.startUrl) {
      throw new Error("Missing startUrl");
    }

    return {
      startUrl: input.startUrl,
      maxUrls: Math.max(1, Math.min(5000, Number(input.maxUrls ?? DEFAULT_MAX_URLS))),
      maxSitemapUrls: Math.max(1, Math.min(20000, Number(input.maxSitemapUrls ?? DEFAULT_MAX_SITEMAP_URLS))),
      maxFaqCandidateChecks: Math.max(
        0,
        Math.min(5000, Number(input.maxFaqCandidateChecks ?? DEFAULT_MAX_FAQ_CANDIDATE_CHECKS))
      ),
      faqCandidateConcurrency: Math.max(
        1,
        Math.min(20, Number(input.faqCandidateConcurrency ?? DEFAULT_FAQ_CANDIDATE_CONCURRENCY))
      ),
      maxDepth: Math.max(0, Math.min(6, Number(input.maxDepth ?? DEFAULT_MAX_DEPTH))),
      fetchTimeoutMs: Math.max(1000, Math.min(30000, Number(input.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS))),
      sameHostOnly: input.sameHostOnly ?? true,
      acceptLanguage: input.acceptLanguage || DEFAULT_ACCEPT_LANGUAGE,
      userAgent: input.userAgent || DEFAULT_USER_AGENT,
    };
  }

  private async inspectRobots(
    start: URL,
    config: Required<SiteDiscoveryConfig>
  ): Promise<SiteDiscoveryResult["robots"]> {
    const url = `${start.origin}/robots.txt`;
    const result = await this.fetchText(url, config);

    if (!result.ok) {
      return { url, found: false, status: result.status, sitemapHints: [] };
    }

    return {
      url,
      found: true,
      status: result.status,
      sitemapHints: result.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^sitemap:/i.test(line))
        .map((line) => line.replace(/^sitemap:\s*/i, "").trim())
        .filter(Boolean),
    };
  }

  private async collectSitemapUrls(
    start: URL,
    hints: string[],
    config: Required<SiteDiscoveryConfig>
  ): Promise<string[]> {
    const out = new Set<string>();
    const seenSitemaps = new Set<string>();
    const queue = [...hints, `${start.origin}/sitemap.xml`].filter(Boolean);

    while (queue.length && out.size < config.maxSitemapUrls) {
      const raw = queue.shift();
      if (!raw) continue;

      const sitemapUrl = this.normalizeOptionalUrl(start.origin, raw);
      if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
      seenSitemaps.add(sitemapUrl);

      const response = await this.fetchText(sitemapUrl, config);
      if (!response.ok || !response.text.trim()) continue;

      const locs = this.extractSitemapLocs(response.text);
      for (const loc of locs) {
        if (out.size >= config.maxSitemapUrls) break;
        const normalized = this.normalizeOptionalUrl(start.origin, loc);
        if (!normalized) continue;

        const parsed = new URL(normalized);
        if (config.sameHostOnly && parsed.host !== start.host) continue;

        if (/sitemap/i.test(parsed.pathname) && /\.xml(?:\.gz)?$/i.test(parsed.pathname)) {
          queue.push(normalized);
          continue;
        }

        out.add(normalized);
      }
    }

    return Array.from(out);
  }

  private async collectLinkedUrls(
    startUrl: string,
    config: Required<SiteDiscoveryConfig>
  ): Promise<string[]> {
    const out = new Set<string>();
    const visited = new Set<string>();
    const queue: QueueItem[] = [{ url: startUrl, depth: 0 }];
    const host = new URL(startUrl).host;

    while (queue.length && visited.size < config.maxUrls) {
      const item = queue.shift();
      if (!item) break;

      const normalized = this.normalizeUrl(item.url);
      if (visited.has(normalized)) continue;
      visited.add(normalized);
      out.add(normalized);

      if (item.depth >= config.maxDepth) continue;

      const response = await this.fetchText(normalized, config);
      if (!response.ok || !response.text.trim()) continue;

      const $ = cheerio.load(response.text);
      for (const link of this.extractInternalLinks(normalized, $)) {
        if (visited.size + queue.length >= config.maxUrls) break;
        if (config.sameHostOnly && new URL(link).host !== host) continue;
        if (visited.has(link)) continue;
        queue.push({ url: link, depth: item.depth + 1 });
      }
    }

    return Array.from(out);
  }

  private async collectFaqCandidateUrls(
    start: URL,
    baseUrls: string[],
    config: Required<SiteDiscoveryConfig>
  ): Promise<{ checked: number; urls: string[] }> {
    if (config.maxFaqCandidateChecks <= 0) {
      return { checked: 0, urls: [] };
    }

    const candidates = this.buildFaqCandidateUrls(start, baseUrls)
      .sort((a, b) => this.faqCandidateWeight(a) - this.faqCandidateWeight(b) || a.localeCompare(b))
      .slice(0, config.maxFaqCandidateChecks);

    const found = new Set<string>();
    let checked = 0;
    let index = 0;

    const workerCount = Math.min(config.faqCandidateConcurrency, candidates.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (index < candidates.length) {
        const candidate = candidates[index];
        index += 1;
        if (!candidate) continue;

        const response = await this.fetchText(candidate, config);
        checked += 1;
        const validUrl = this.getValidFaqCandidateUrl(candidate, response, start);

        if (validUrl) {
          found.add(validUrl);
        }
      }
    });

    await Promise.all(workers);

    return { checked, urls: Array.from(found).sort() };
  }

  private buildFaqCandidateUrls(start: URL, baseUrls: string[]): string[] {
    const out = new Set<string>();
    const normalizedBaseUrls = this.uniqueUrls(baseUrls);

    for (const rawUrl of normalizedBaseUrls) {
      const normalized = this.normalizeOptionalUrl(start.origin, rawUrl);
      if (!normalized) continue;

      const parsed = new URL(normalized);
      if (parsed.host !== start.host) continue;
      if (ASSET_RE.test(parsed.pathname)) continue;
      if (/\/faq\/?$/i.test(parsed.pathname)) continue;

      const parts = parsed.pathname.split("/").filter(Boolean);

      if (!parts.length) {
        out.add(this.normalizeUrl(`${parsed.origin}/faq`));
        continue;
      }

      out.add(this.normalizeUrl(`${parsed.origin}/${parts.join("/")}/faq`));

      if (parts.length >= 2) {
        out.add(this.normalizeUrl(`${parsed.origin}/${parts.slice(0, 2).join("/")}/faq`));
      }

      const lastPart = parts[parts.length - 1] || "";
      if (parts.length >= 2 && FAQ_CHILD_PATHS.has(lastPart)) {
        out.add(this.normalizeUrl(`${parsed.origin}/${parts.slice(0, -1).join("/")}/faq`));
      }

      if (parts.length === 1 && this.looksLikeLocationPath(parsed.pathname)) {
        out.add(this.normalizeUrl(`${parsed.origin}/${parts[0]}/faq`));
      }
    }

    return Array.from(out);
  }

  private faqCandidateWeight(url: string): number {
    const parsed = new URL(url);
    const basePath = parsed.pathname.replace(/\/faq\/?$/i, "");
    const decoded = decodeURIComponent(basePath).toLowerCase();
    const parts = basePath.split("/").filter(Boolean);

    if (HOTEL_RE.test(decoded) && parts.length >= 2) return 0;
    if (parts.length >= 2) return 1;
    if (LOCATION_RE.test(decoded) || this.looksLikeLocationPath(basePath)) return 2;
    return 3;
  }

  private getValidFaqCandidateUrl(
    candidate: string,
    response: { ok: boolean; status: number | null; text: string; finalUrl: string },
    start: URL
  ): string {
    if (!response.ok) return "";

    const normalizedFinalUrl = this.normalizeOptionalUrl(candidate, response.finalUrl || candidate);
    if (!normalizedFinalUrl) return "";

    const parsed = new URL(normalizedFinalUrl);
    if (parsed.host !== start.host) return "";
    if (!/\/faq\/?$/i.test(parsed.pathname)) return "";

    const text = response.text.toLowerCase();
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = this.cleanText(titleMatch?.[1] || "").toLowerCase();
    if (/404|not found|page not found/.test(title)) return "";

    return this.normalizeUrl(normalizedFinalUrl);
  }

  private mergeUrls(
    startUrl: string,
    sitemapUrls: string[],
    pageUrls: string[],
    faqCandidateUrls: string[],
    config: Required<SiteDiscoveryConfig>
  ): DiscoveredUrl[] {
    const map = new Map<string, DiscoveredUrl>();
    const add = (url: string, source: DiscoverySource, depth = 999) => {
      const normalized = this.normalizeUrl(url);
      const parsed = new URL(normalized);
      const existing = map.get(normalized);

      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        existing.depth = Math.min(existing.depth, depth);
        return;
      }

      map.set(normalized, {
        url: normalized,
        path: parsed.pathname,
        depth,
        sources: [source],
        groups: this.classifyUrl(normalized),
        title: "",
      });
    };

    add(startUrl, "start-url", 0);
    sitemapUrls.forEach((url) => add(url, "sitemap"));
    pageUrls.forEach((url) => add(url, "page-link"));
    faqCandidateUrls.forEach((url) => add(url, "faq-candidate", 998));

    return Array.from(map.values()).sort((a, b) => {
      return this.bestGroupWeight(a.groups) - this.bestGroupWeight(b.groups)
        || a.depth - b.depth
        || a.path.localeCompare(b.path);
    }).slice(0, config.maxUrls);
  }

  private classifyUrl(url: string): SiteUrlGroup[] {
    const parsed = new URL(url);
    const text = decodeURIComponent(`${parsed.pathname} ${parsed.search}`).toLowerCase();
    const groups: SiteUrlGroup[] = [];

    if (ASSET_RE.test(parsed.pathname)) groups.push("asset");
    if (FAQ_RE.test(text)) groups.push("faq");
    if (HOTEL_RE.test(text)) groups.push("hotel");
    if (LOCATION_RE.test(text) || this.looksLikeLocationPath(parsed.pathname)) groups.push("location");
    if (OFFER_RE.test(text)) groups.push("offer");
    if (BLOG_RE.test(text)) groups.push("blog");
    if (LEGAL_RE.test(text)) groups.push("legal");
    if (CONTACT_RE.test(text)) groups.push("contact");
    if (BOOKING_RE.test(text)) groups.push("booking");

    return groups.length ? groups : ["other"];
  }

  private looksLikeLocationPath(pathname: string): boolean {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return false;
    const part = parts[0] || "";
    return /^[a-z][a-z-]{2,40}$/i.test(part) && !LEGAL_RE.test(part) && !CONTACT_RE.test(part);
  }

  private summarizeGroups(urls: DiscoveredUrl[]): SiteDiscoveryGroupSummary[] {
    const map = new Map<SiteUrlGroup, string[]>();

    for (const item of urls) {
      for (const group of item.groups) {
        if (!map.has(group)) map.set(group, []);
        map.get(group)?.push(item.url);
      }
    }

    return Array.from(map.entries())
      .map(([group, items]) => ({
        group,
        count: items.length,
        examples: items.slice(0, 8),
      }))
      .sort((a, b) => {
        return this.bestGroupWeight([a.group]) - this.bestGroupWeight([b.group])
          || b.count - a.count
          || a.group.localeCompare(b.group);
      });
  }

  private bestGroupWeight(groups: SiteUrlGroup[]): number {
    const weights: Record<SiteUrlGroup, number> = {
      faq: 0,
      hotel: 1,
      location: 2,
      offer: 3,
      contact: 4,
      booking: 5,
      blog: 6,
      legal: 7,
      other: 8,
      asset: 9,
    };

    return Math.min(...groups.map((group) => weights[group] ?? 99));
  }

  private extractSitemapLocs(xml: string): string[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    return $("loc")
      .map((_, element) => this.cleanText($(element).text()))
      .get()
      .filter(Boolean);
  }

  private extractInternalLinks(baseUrl: string, $: cheerio.Root): string[] {
    const host = new URL(baseUrl).host;
    const out = new Set<string>();

    $("a[href]").each((_, element) => {
      const href = ($(element).attr("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

      const normalized = this.normalizeOptionalUrl(baseUrl, href);
      if (!normalized) return;

      const parsed = new URL(normalized);
      if (parsed.host !== host) return;
      if (ASSET_RE.test(parsed.pathname)) return;

      out.add(this.normalizeUrl(normalized));
    });

    return Array.from(out);
  }

  private async fetchText(
    url: string,
    config: Required<SiteDiscoveryConfig>
  ): Promise<{ ok: boolean; status: number | null; text: string; finalUrl: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": config.userAgent,
          "accept-language": config.acceptLanguage,
        },
      });

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
        finalUrl: response.url || url,
      };
    } catch {
      return { ok: false, status: null, text: "", finalUrl: url };
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeUrl(rawUrl: string): string {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const url = new URL(withProtocol);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  }

  private normalizeOptionalUrl(base: string, href: string): string {
    if (!href) return "";
    try {
      return this.normalizeUrl(new URL(href, base).toString());
    } catch {
      return "";
    }
  }

  private cleanText(value: string): string {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  private uniqueUrls(urls: string[]): string[] {
    const out = new Set<string>();

    for (const url of urls) {
      const normalized = this.normalizeOptionalUrl(url, url);
      if (normalized) out.add(normalized);
    }

    return Array.from(out);
  }
}

export async function discoverSiteUrls(input: SiteDiscoveryConfig): Promise<SiteDiscoveryResult> {
  const job = new SiteAiAuditDiscoveryJob();
  return await job.run(input);
}

function readCliConfig(argv: string[]): SiteDiscoveryConfig | null {
  const get = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const has = (name: string) => argv.includes(name);
  const url = get("--url");

  if (!url) return null;

  return {
    startUrl: url,
    maxUrls: Number(get("--max-urls") || DEFAULT_MAX_URLS),
    maxSitemapUrls: Number(get("--max-sitemap-urls") || DEFAULT_MAX_SITEMAP_URLS),
    maxFaqCandidateChecks: Number(get("--max-faq-candidate-checks") || DEFAULT_MAX_FAQ_CANDIDATE_CHECKS),
    faqCandidateConcurrency: Number(get("--faq-candidate-concurrency") || DEFAULT_FAQ_CANDIDATE_CONCURRENCY),
    maxDepth: Number(get("--max-depth") || DEFAULT_MAX_DEPTH),
    fetchTimeoutMs: Number(get("--fetch-timeout-ms") || DEFAULT_FETCH_TIMEOUT_MS),
    sameHostOnly: !has("--allow-external"),
  };
}

async function runCli() {
  const config = readCliConfig(process.argv.slice(2));
  if (!config) return;

  const result = await discoverSiteUrls(config);
  console.log(JSON.stringify(result, null, 2));
}

const directRunPath = process.argv[1] || "";
if (/site-ai-audit-discovery\.(ts|js)$/.test(directRunPath)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
