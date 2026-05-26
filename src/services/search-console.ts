import fs from "fs";
import { google } from "googleapis";

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export type SearchConsoleSite = {
  id: string;
  siteUrl: string;
  name: string;
  permissionLevel?: string;
};

export type SearchConsoleQueryRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleDateRange = {
  startDate: string;
  endDate: string;
};

export type SearchConsoleDimensionFilter = {
  dimension: "query" | "page";
  operator: "contains" | "equals" | "includingRegex" | "notContains" | "notEquals" | "excludingRegex";
  expression: string;
};

export type SearchConsoleQueryInput = {
  siteUrl?: string;
  dateRange?: Partial<SearchConsoleDateRange>;
  dimensionFilters?: SearchConsoleDimensionFilter[];
  limit?: number;
};

function loadServiceAccount(): GoogleServiceAccount {
  const raw = fs.readFileSync(credentialsPath(), "utf8");
  return JSON.parse(raw) as GoogleServiceAccount;
}

function credentialsPath(): string {
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "./src/credentials/service-account.json";
}

function cleanSiteUrl(input: string): string {
  return String(input || "").trim();
}

function dateOffset(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export class SearchConsoleService {
  async listSites(): Promise<SearchConsoleSite[]> {
    const configured = this.sitesFromEnv();
    if (configured.length) return configured;

    try {
      const response = await this.withWebmasters((webmasters) => webmasters.sites.list());
      const sites = response.data.siteEntry || [];
      const parsedSites: Array<SearchConsoleSite | null> = sites
        .map((site, index): SearchConsoleSite | null => {
          const siteUrl = cleanSiteUrl(site.siteUrl || "");
          if (!siteUrl) return null;
          return {
            id: siteUrl,
            siteUrl,
            name: siteUrl.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/\/$/, "") || `Search Console site ${index + 1}`,
            permissionLevel: site.permissionLevel || "",
          };
        });
      return parsedSites.filter((site): site is SearchConsoleSite => Boolean(site));
    } catch {
      return [];
    }
  }

  async fetchQueryRows(input: SearchConsoleQueryInput = {}): Promise<{
    site: SearchConsoleSite;
    dateRange: SearchConsoleDateRange;
    rows: SearchConsoleQueryRow[];
  }> {
    const site = await this.resolveSite(input.siteUrl);
    const dateRange = this.resolveDateRange(input.dateRange);
    const requestBody: Record<string, unknown> = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dimensions: ["query", "page"],
      rowLimit: input.limit || 100,
    };

    if (input.dimensionFilters?.length) {
      requestBody.dimensionFilterGroups = [{ filters: input.dimensionFilters }];
    }

    const response = await this.withWebmasters((webmasters) => webmasters.searchanalytics.query({
      siteUrl: site.siteUrl,
      requestBody,
    }));

    return {
      site,
      dateRange,
      rows: (response.data.rows || []).map((row) => ({
        query: String(row.keys?.[0] || "").trim(),
        page: String(row.keys?.[1] || "").trim(),
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
      })).filter((row) => row.query || row.page),
    };
  }

  private authAttempts(): Array<{ label: string; auth: any }> {
    const attempts: Array<{ label: string; auth: any }> = [{
      label: "service-account",
      auth: new google.auth.GoogleAuth({
        keyFile: credentialsPath(),
        scopes: [SEARCH_CONSOLE_SCOPE],
      }),
    }];

    const impersonatedEmail = cleanSiteUrl(
      process.env.SEARCH_CONSOLE_IMPERSONATE_EMAIL
      || process.env.GSC_IMPERSONATE_EMAIL
      || process.env.OWNER_EMAIL
      || ""
    );
    if (!impersonatedEmail) return attempts;

    const serviceAccount = loadServiceAccount();
    attempts.push({
      label: "impersonated-user",
      auth: new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [SEARCH_CONSOLE_SCOPE],
        subject: impersonatedEmail,
      }),
    });

    return attempts;
  }

  private async withWebmasters<T>(operation: (webmasters: ReturnType<typeof google.webmasters>) => Promise<T>): Promise<T> {
    const failures: string[] = [];

    for (const attempt of this.authAttempts()) {
      try {
        const webmasters = google.webmasters({
          version: "v3",
          auth: attempt.auth,
        });
        return await operation(webmasters);
      } catch (error: any) {
        failures.push(`${attempt.label}: ${error?.message || String(error)}`);
      }
    }

    throw new Error(`Search Console auth failed. ${failures.join(" | ")}`);
  }

  private sitesFromEnv(): SearchConsoleSite[] {
    const rawJson = process.env.SEARCH_CONSOLE_SITES || process.env.GSC_SITES || "";
    if (rawJson.trim()) {
      try {
        const parsed = JSON.parse(rawJson) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .map((item, index) => {
              if (!item || typeof item !== "object") return null;
              const record = item as Record<string, unknown>;
              const siteUrl = cleanSiteUrl(String(record.siteUrl || record.url || record.id || ""));
              if (!siteUrl) return null;
              return {
                id: String(record.id || siteUrl),
                siteUrl,
                name: String(record.name || record.label || siteUrl || `Search Console site ${index + 1}`),
              };
            })
            .filter((site): site is SearchConsoleSite => Boolean(site));
        }
      } catch {
        return this.sitesFromCsvEnv(rawJson);
      }

      return this.sitesFromCsvEnv(rawJson);
    }

    const singleSite = cleanSiteUrl(process.env.SEARCH_CONSOLE_SITE_URL || process.env.GSC_SITE_URL || "");
    return singleSite ? [{ id: singleSite, siteUrl: singleSite, name: singleSite }] : [];
  }

  private sitesFromCsvEnv(raw: string): SearchConsoleSite[] {
    return String(raw || "")
      .split(",")
      .map((siteUrl) => cleanSiteUrl(siteUrl))
      .filter(Boolean)
      .map((siteUrl) => ({ id: siteUrl, siteUrl, name: siteUrl }));
  }

  private async resolveSite(siteUrl?: string): Promise<SearchConsoleSite> {
    const clean = cleanSiteUrl(siteUrl || "");
    if (clean) {
      return { id: clean, siteUrl: clean, name: clean };
    }

    const sites = await this.listSites();
    if (!sites.length) {
      throw new Error("No Search Console site is configured or accessible.");
    }

    return sites[0];
  }

  private resolveDateRange(input?: Partial<SearchConsoleDateRange>): SearchConsoleDateRange {
    return {
      startDate: input?.startDate || dateOffset(92),
      endDate: input?.endDate || dateOffset(2),
    };
  }
}
