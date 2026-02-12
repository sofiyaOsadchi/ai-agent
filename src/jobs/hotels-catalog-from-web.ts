// src/jobs/hotels-catalog-from-web.ts

import * as cheerio from "cheerio";
import { SheetsService } from "../services/sheets.js";

type CityItem = { country: string; city: string; cityUrl: string };
type HotelRowBase = { country: string; city: string; hotel: string; hotelUrl: string };

export type HotelLanguageConfig = {
  /**
   * Language code used for sheet columns.
   * Examples: "en", "he", "de", "es", "nl", "it", "fr", "pl", "ru", "zh", "ar"
   */
  code: string;

  /**
   * Site origin for that language.
   * Examples:
   * - en: https://www.leonardo-hotels.com
   * - he: https://www.leonardo-hotels.co.il
   * - de: https://www.leonardo-hotels.de
   * - ar: https://www.ar.leonardo-hotels.com
   * - zh: https://www.leonardo-hotels.cn
   */
  origin: string;

  /** Optional custom Accept-Language header */
  acceptLanguage?: string;

  /** Optional sheet label (defaults to code) */
  label?: string;
};

type EnrichedHotelRow = HotelRowBase & {
  i18n: Record<
    string,
    {
      hotel?: string;
      hotelUrl?: string;
      error?: string;
    }
  >;
};

export class HotelsCatalogFromWebJob {
  constructor(private sheets: SheetsService) {}

  async run(opts: {
    destinationsUrl?: string; // default: https://www.leonardo-hotels.com/destinations
    sheetTitle: string;

    /**
     * Controls which languages you want in the output.
     * - If omitted: ["en"]
     * - If provided as strings: ["en","he","de"]
     * - If provided as objects: [{ code:"he", origin:"https://www.leonardo-hotels.co.il" }, ...]
     */
    languages?: Array<string | Partial<HotelLanguageConfig>>;

    /**
     * Which language is the "base" crawl language (Country/City/Hotel/URL columns).
     * Defaults to "en".
     */
    baseLanguageCode?: string;

    /**
     * Concurrency limit for i18n hotel page fetches.
     * Defaults to 6.
     */
    i18nConcurrency?: number;
  }): Promise<{ spreadsheetId: string; countries: number; cities: number; hotels: number }> {
    const destinationsUrl = opts.destinationsUrl ?? "https://www.leonardo-hotels.com/destinations";
    const baseLanguageCode = (opts.baseLanguageCode ?? "en").trim().toLowerCase() || "en";
    const i18nConcurrency = Math.max(1, opts.i18nConcurrency ?? 6);

    // Normalize language configuration
    const langConfigs = this.normalizeLanguages(destinationsUrl, baseLanguageCode, opts.languages);
    const baseLang = langConfigs[0]; // ensured base is first

    // 1) Collect cities grouped by country from /destinations (base language site)
    const cities = await this.collectCountriesAndCities(destinationsUrl, baseLang);

    // 2) Create sheet
    const spreadsheetId = await this.sheets.createSpreadsheet(opts.sheetTitle);
    const firstTabTitle = await this.sheets.getFirstSheetTitle(spreadsheetId);
    await this.sheets.renameSheet(spreadsheetId, firstTabTitle, "Hotels Catalog");
    await this.sheets.duplicateSheet(spreadsheetId, 0, "Countries Summary");

    // 3) Crawl each city page and collect hotels (base language site)
    const rows: HotelRowBase[] = [];
    for (const c of cities) {
      const cityHotels = await this.collectHotelsFromCity(c, baseLang);
      rows.push(...cityHotels);
    }

    // 4) Global dedupe by canonical hotel URL (base language canonical URL)
    const globalSeen = new Set<string>();
    const dedupedRows: HotelRowBase[] = [];
    for (const r of rows) {
      const key = this.canonicalizeHotelUrl(r.hotelUrl);
      if (globalSeen.has(key)) continue;
      globalSeen.add(key);
      dedupedRows.push({ ...r, hotelUrl: key });
    }

    // 5) Enrich hotels with additional languages (fetch hotel page per language and extract h1)
    const enriched: EnrichedHotelRow[] = dedupedRows.map(r => ({ ...r, i18n: {} }));

    const extraLangs = langConfigs.slice(1);

    for (const lang of extraLangs) {
      await this.mapLimit(
        enriched,
        i18nConcurrency,
        async row => {
          const localizedUrl = this.localizeUrl(row.hotelUrl, lang.origin);
          try {
            const html = await this.fetchText(localizedUrl, lang.acceptLanguage ?? this.defaultAcceptLanguage(lang.code));
            const hotelName = this.extractHotelNameFromHotelPage(html);

            row.i18n[lang.code] = {
              hotel: hotelName || "",
              hotelUrl: this.canonicalizeHotelUrl(localizedUrl),
            };
          } catch (e: any) {
            row.i18n[lang.code] = {
              hotel: "",
              hotelUrl: this.canonicalizeHotelUrl(localizedUrl),
              error: String(e?.message || e),
            };
          }
        }
      );
    }

    // 6) Write Hotels Catalog (base + i18n columns)
    const header: string[] = ["Country", "City", `Hotel (${baseLang.code})`, `Hotel URL (${baseLang.code})`];

    for (const lang of extraLangs) {
      const label = lang.label?.trim() || lang.code;
      header.push(`Hotel (${label})`, `Hotel URL (${label})`);
    }

    const values: string[][] = [header];

    for (const r of enriched) {
      const row: string[] = [r.country, r.city, r.hotel, r.hotelUrl];

      for (const lang of extraLangs) {
        const it = r.i18n[lang.code];
        row.push(it?.hotel ?? "", it?.hotelUrl ?? this.canonicalizeHotelUrl(this.localizeUrl(r.hotelUrl, lang.origin)));
      }

      values.push(row);
    }

    await this.sheets.writeValues(spreadsheetId, "Hotels Catalog!A1", values);
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Hotels Catalog");

    // 7) Write Countries Summary (based on base language rows)
    const byCountry = new Map<string, { cities: Set<string>; hotels: number }>();
    for (const r of dedupedRows) {
      if (!byCountry.has(r.country)) byCountry.set(r.country, { cities: new Set<string>(), hotels: 0 });
      const it = byCountry.get(r.country)!;
      it.cities.add(r.city);
      it.hotels += 1;
    }

    const summary: string[][] = [["Country", "Cities", "Hotels"]];
    for (const [country, it] of [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      summary.push([country, String(it.cities.size), String(it.hotels)]);
    }

    await this.sheets.writeValues(spreadsheetId, "Countries Summary!A1", summary);
    await this.sheets.formatSheetLikeFAQ(spreadsheetId, "Countries Summary");

    return {
      spreadsheetId,
      countries: byCountry.size,
      cities: new Set(cities.map(x => x.cityUrl)).size,
      hotels: dedupedRows.length,
    };
  }

  private normalizeLanguages(
    destinationsUrl: string,
    baseLanguageCode: string,
    languages?: Array<string | Partial<HotelLanguageConfig>>
  ): HotelLanguageConfig[] {
    const baseOrigin = (() => {
      try {
        return new URL(destinationsUrl).origin;
      } catch {
        return "https://www.leonardo-hotels.com";
      }
    })();

    // Build requested list
    const requested: Array<string | Partial<HotelLanguageConfig>> =
      languages && languages.length > 0 ? languages : [baseLanguageCode];

    // Convert into configs
    const out: HotelLanguageConfig[] = [];
    for (const item of requested) {
      if (typeof item === "string") {
        const code = item.trim().toLowerCase();
        if (!code) continue;

        if (code === baseLanguageCode) {
          out.push({
            code,
            origin: baseOrigin,
            acceptLanguage: this.defaultAcceptLanguage(code),
            label: code,
          });
        } else {
          const def = this.defaultLanguageConfig(code);
          out.push(def);
        }
      } else {
        const code = String(item.code || "").trim().toLowerCase();
        if (!code) continue;

        const origin =
          String(item.origin || "").trim() ||
          (code === baseLanguageCode ? baseOrigin : this.defaultLanguageConfig(code).origin);

        out.push({
          code,
          origin,
          acceptLanguage: String(item.acceptLanguage || "").trim() || this.defaultAcceptLanguage(code),
          label: String(item.label || "").trim() || code,
        });
      }
    }

    // Ensure base language exists and is first
    const byCode = new Map<string, HotelLanguageConfig>();
    for (const c of out) {
      if (!byCode.has(c.code)) byCode.set(c.code, c);
    }

    if (!byCode.has(baseLanguageCode)) {
      byCode.set(baseLanguageCode, {
        code: baseLanguageCode,
        origin: baseOrigin,
        acceptLanguage: this.defaultAcceptLanguage(baseLanguageCode),
        label: baseLanguageCode,
      });
    }

    const base = byCode.get(baseLanguageCode)!;
    const rest = [...byCode.values()].filter(x => x.code !== baseLanguageCode);

    return [base, ...rest];
  }

  private defaultLanguageConfig(code: string): HotelLanguageConfig {
    const c = code.trim().toLowerCase();

    // Based on Leonardo’s language sites structure:
    // - English: leonardo-hotels.com
    // - German: leonardo-hotels.de
    // - Spanish: leonardo-hotels.es
    // - Dutch: leonardo-hotels.nl
    // - Italian: leonardo-hotels.it
    // - French: leonardo-hotels.fr
    // - Polish: leonardo-hotels.pl
    // - Russian: leonardo-hotels.ru
    // - Hebrew: leonardo-hotels.co.il
    // - Chinese: leonardo-hotels.cn
    // - Arabic: ar.leonardo-hotels.com
    const originByCode: Record<string, string> = {
      en: "https://www.leonardo-hotels.com",
      de: "https://www.leonardo-hotels.de",
      es: "https://www.leonardo-hotels.es",
      nl: "https://www.leonardo-hotels.nl",
      it: "https://www.leonardo-hotels.it",
      fr: "https://www.leonardo-hotels.fr",
      pl: "https://www.leonardo-hotels.pl",
      ru: "https://www.leonardo-hotels.ru",
      he: "https://www.leonardo-hotels.co.il",
      zh: "https://www.leonardo-hotels.cn",
      ar: "https://www.ar.leonardo-hotels.com",
    };

    const origin = originByCode[c] ?? "https://www.leonardo-hotels.com";

    return {
      code: c,
      origin,
      acceptLanguage: this.defaultAcceptLanguage(c),
      label: c,
    };
  }

  private defaultAcceptLanguage(code: string): string {
    const c = code.trim().toLowerCase();

    const map: Record<string, string> = {
      en: "en-GB,en;q=0.9",
      de: "de-DE,de;q=0.9,en;q=0.7",
      es: "es-ES,es;q=0.9,en;q=0.7",
      nl: "nl-NL,nl;q=0.9,en;q=0.7",
      it: "it-IT,it;q=0.9,en;q=0.7",
      fr: "fr-FR,fr;q=0.9,en;q=0.7",
      pl: "pl-PL,pl;q=0.9,en;q=0.7",
      ru: "ru-RU,ru;q=0.9,en;q=0.7",
      he: "he-IL,he;q=0.9,en;q=0.7",
      zh: "zh-CN,zh;q=0.9,en;q=0.7",
      ar: "ar,ar-EG;q=0.9,en;q=0.7",
    };

    return map[c] ?? "en-GB,en;q=0.9";
  }

  private async collectCountriesAndCities(destinationsUrl: string, lang: HotelLanguageConfig): Promise<CityItem[]> {
    const html = await this.fetchText(destinationsUrl, lang.acceptLanguage);
    const $ = cheerio.load(html);

    let $scope = $("main");
    if ($scope.length === 0) $scope = $("body");

    const out: CityItem[] = [];
    let currentCountry = "";

    $scope.find("a[href]").each((_, a) => {
      const text = $(a).text().replace(/\s+/g, " ").trim();
      if (!text) return;

      const hrefRaw = String($(a).attr("href") || "").trim();
      if (!hrefRaw.startsWith("/")) return;

      const abs = this.makeAbsolute(destinationsUrl, hrefRaw);

      // Allow language site domains as well, but keep the crawl within the base origin
      // (destinationsUrl defines the base origin)
      let u: URL;
      try {
        u = new URL(abs);
      } catch {
        return;
      }

      const baseOrigin = (() => {
        try {
          return new URL(destinationsUrl).origin.toLowerCase();
        } catch {
          return "";
        }
      })();

      if (baseOrigin && u.origin.toLowerCase() !== baseOrigin) return;

      const segs = u.pathname.split("/").filter(Boolean);
      if (segs.length !== 1) return;

      // Skip obvious non-destination routes
      if (
        /^(destinations|hotels|meetings|offers?|brand|advantage|club|loyalty|contact|privacy|terms|imprint|press|blog)$/i.test(
          segs[0]
        )
      ) {
        return;
      }

      const parentTag = (a as any)?.parent?.name ? String((a as any).parent.name).toLowerCase() : "";
      const parentClass = ($(a).parent().attr("class") || "").toLowerCase();

      const looksLikeCountry =
        /^h[1-6]$/.test(parentTag) || parentClass.includes("country") || parentClass.includes("destination-country");

      const looksLikeCity = parentTag === "li" || parentClass.includes("city") || parentClass.includes("destination-city");

      if (looksLikeCountry) {
        currentCountry = text;
        return;
      }

      if (looksLikeCity && currentCountry) {
        out.push({ country: currentCountry, city: text, cityUrl: abs });
      }
    });

    // Fallback heuristic if needed
    if (out.length === 0) {
      const items: Array<{ text: string; url: string; parentTag: string }> = [];
      $scope.find("a[href]").each((_, a) => {
        const text = $(a).text().replace(/\s+/g, " ").trim();
        const hrefRaw = String($(a).attr("href") || "").trim();
        if (!text || !hrefRaw.startsWith("/")) return;

        const abs = this.makeAbsolute(destinationsUrl, hrefRaw);

        let u: URL;
        try {
          u = new URL(abs);
        } catch {
          return;
        }

        const baseOrigin = (() => {
          try {
            return new URL(destinationsUrl).origin.toLowerCase();
          } catch {
            return "";
          }
        })();

        if (baseOrigin && u.origin.toLowerCase() !== baseOrigin) return;

        const segs = u.pathname.split("/").filter(Boolean);
        if (segs.length !== 1) return;
        if (/^(destinations|hotels|meetings|offers?)$/i.test(segs[0])) return;

        const parentTag = (a as any)?.parent?.name ? String((a as any).parent.name).toLowerCase() : "";
        items.push({ text, url: abs, parentTag });
      });

      const seenCity = new Set<string>();
      let country = "";
      for (const it of items) {
        if (/^h[1-6]$/.test(it.parentTag)) {
          country = it.text;
          continue;
        }
        if (country && it.parentTag === "li" && !seenCity.has(it.url)) {
          seenCity.add(it.url);
          out.push({ country, city: it.text, cityUrl: it.url });
        }
      }
    }

    // Deduplicate by cityUrl
    const seen = new Set<string>();
    const deduped = out.filter(x => {
      if (seen.has(x.cityUrl)) return false;
      seen.add(x.cityUrl);
      return true;
    });

    return deduped;
  }

  private async collectHotelsFromCity(city: CityItem, lang: HotelLanguageConfig): Promise<HotelRowBase[]> {
    const html = await this.fetchText(city.cityUrl, lang.acceptLanguage);
    const $ = cheerio.load(html);

    let $scope = $("main");
    if ($scope.length === 0) $scope = $("body");

    const citySlug = new URL(city.cityUrl).pathname.split("/").filter(Boolean)[0] || "";

    // canonicalUrl -> bestName
    const byUrl = new Map<string, string>();

    $scope.find("a[href]").each((_, a) => {
      const hrefRaw = String($(a).attr("href") || "").trim();
      if (!hrefRaw) return;

      const abs = this.makeAbsolute(city.cityUrl, hrefRaw);

      let u: URL;
      try {
        u = new URL(abs);
      } catch {
        return;
      }

      // Keep inside the same origin as the city page
      const baseOrigin = new URL(city.cityUrl).origin.toLowerCase();
      if (u.origin.toLowerCase() !== baseOrigin) return;

      const segs = u.pathname.split("/").filter(Boolean);
      if (segs.length !== 2) return;
      if (segs[0].toLowerCase() !== citySlug.toLowerCase()) return;

      const canonicalUrl = this.canonicalizeHotelUrl(abs);

      // Prefer aria-label/title, fallback to anchor text
      const aria = String($(a).attr("aria-label") || "").trim();
      const title = String($(a).attr("title") || "").trim();
      const text = $(a).text().replace(/\s+/g, " ").trim();

      const candidateName = (aria || title || text).trim();
      if (!candidateName) return;

      const prev = byUrl.get(canonicalUrl) || "";
      byUrl.set(canonicalUrl, this.pickBetterHotelName(prev, candidateName));
    });

    // Fallback: extract from URL slugs
    if (byUrl.size <= 1) {
      $scope.find("a[href]").each((_, a) => {
        const hrefRaw = String($(a).attr("href") || "").trim();
        if (!hrefRaw) return;

        const abs = this.makeAbsolute(city.cityUrl, hrefRaw);

        let u: URL;
        try {
          u = new URL(abs);
        } catch {
          return;
        }

        const baseOrigin = new URL(city.cityUrl).origin.toLowerCase();
        if (u.origin.toLowerCase() !== baseOrigin) return;

        const segs = u.pathname.split("/").filter(Boolean);
        if (segs.length !== 2) return;
        if (segs[0].toLowerCase() !== citySlug.toLowerCase()) return;

        const canonicalUrl = this.canonicalizeHotelUrl(abs);
        const hotelSlug = segs[1];
        const nameFromUrl = decodeURIComponent(hotelSlug).replace(/-/g, " ").trim();

        const prev = byUrl.get(canonicalUrl) || "";
        byUrl.set(canonicalUrl, this.pickBetterHotelName(prev, nameFromUrl));
      });
    }

    const hotels: HotelRowBase[] = [];
    for (const [hotelUrl, hotelName] of byUrl.entries()) {
      hotels.push({
        country: city.country,
        city: city.city,
        hotel: hotelName,
        hotelUrl,
      });
    }

    return hotels;
  }

  private extractHotelNameFromHotelPage(html: string): string {
    const $ = cheerio.load(html);

    // Best effort: h1
    const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
    if (h1) return h1;

    // Fallback: og:title
    const og = $('meta[property="og:title"]').attr("content");
    if (og && String(og).trim()) return String(og).replace(/\s+/g, " ").trim();

    // Fallback: <title>
    const t = $("title").first().text().replace(/\s+/g, " ").trim();
    if (t) return t;

    return "";
  }

  private localizeUrl(baseHotelUrl: string, targetOrigin: string): string {
    try {
      const u = new URL(baseHotelUrl);
      const o = new URL(targetOrigin);
      u.protocol = o.protocol;
      u.host = o.host;
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch {
      return baseHotelUrl;
    }
  }

  private canonicalizeHotelUrl(raw: string): string {
    try {
      const u = new URL(raw);
      const pathname = u.pathname.replace(/\/+$/, "");
      return `${u.origin}${pathname}`;
    } catch {
      return raw.replace(/[#?].*$/, "").replace(/\/+$/, "");
    }
  }

  private pickBetterHotelName(current: string, candidate: string): string {
    const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
    const a = norm(current);
    const b = norm(candidate);

    if (!a) return b;
    if (!b) return a;

    const upperCount = (s: string) => (s.match(/[A-Z]/g) || []).length;
    const ua = upperCount(a);
    const ub = upperCount(b);
    if (ub !== ua) return ub > ua ? b : a;

    if (b.length !== a.length) return b.length > a.length ? b : a;

    return a;
  }

  private async fetchText(url: string, acceptLanguage?: string): Promise<string> {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 HotelsCatalogBot",
        "accept-language": acceptLanguage || "en-GB,en;q=0.9",
      },
    });
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
    return await r.text();
  }

  private makeAbsolute(base: string, href: string): string {
    try {
      return new URL(href, base).toString();
    } catch {
      return href;
    }
  }

  private async mapLimit<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>): Promise<void> {
    const n = Math.max(1, limit | 0);
    let i = 0;

    const workers = new Array(n).fill(0).map(async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        await fn(items[idx], idx);
      }
    });

    await Promise.all(workers);
  }
}