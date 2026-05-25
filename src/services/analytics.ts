import { BetaAnalyticsDataClient } from "@google-analytics/data";

type DateRangeInput = {
  startDate?: string;
  endDate?: string;
};

export type AnalyticsAccount = {
  id: string;
  name: string;
  propertyId: string;
};

export type AnalyticsReportRowsInput = {
  accountId?: string;
  propertyId?: string;
  dateRange?: DateRangeInput;
  limit?: number;
};

export type AnalyticsReportRowsResult = {
  account: AnalyticsAccount;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  rows: string[][];
};

export type AnalyticsFaqLandingPage = {
  pagePath: string;
  pageTitle: string;
  sessions: number;
  users: number;
  views: number;
  events: number;
};

export type AnalyticsFaqSearchTerm = {
  searchTerm: string;
  events: number;
  sessions: number;
};

export type AnalyticsFaqDemandSignalsResult = {
  account: AnalyticsAccount;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  landingPages: AnalyticsFaqLandingPage[];
  siteSearchTerms: AnalyticsFaqSearchTerm[];
};

type MetricPlan = {
  names: string[];
  conversionsMetric: "keyEvents" | "conversions" | "";
};

const DEFAULT_ACCOUNT_ID = "default-ga4";

const HEADER_ROW = [
  "Date",
  "Channel",
  "Campaign",
  "Country",
  "Sessions",
  "Users",
  "Organic Traffic",
  "Paid Traffic",
  "Conversions",
  "Revenue",
  "Views",
  "Events",
];

export class AnalyticsService {
  private client = new BetaAnalyticsDataClient();

  listAccounts(): AnalyticsAccount[] {
    const configured = this.accountsFromJsonEnv();
    if (configured.length) return configured;

    const propertyId = this.cleanPropertyId(process.env.GA4_PROPERTY_ID || "");
    if (!propertyId) return [];

    return [{
      id: DEFAULT_ACCOUNT_ID,
      name: process.env.GA4_PROPERTY_NAME || `Connected GA4 property ${propertyId}`,
      propertyId,
    }];
  }

  async fetchClientReportRows(input: AnalyticsReportRowsInput = {}): Promise<AnalyticsReportRowsResult> {
    const account = this.resolveAccount(input);
    const dateRange = this.resolveDateRange(input.dateRange);
    const metricPlan = await this.runReportWithFallback(account.propertyId, dateRange, input.limit);

    return {
      account,
      dateRange,
      rows: this.toRows(metricPlan.rows, metricPlan.metricNames, metricPlan.conversionsMetric),
    };
  }

  async fetchFaqDemandSignals(input: AnalyticsReportRowsInput = {}): Promise<AnalyticsFaqDemandSignalsResult> {
    const account = this.resolveAccount(input);
    const dateRange = this.resolveDateRange(input.dateRange);
    const limit = input.limit || 50;

    const [landingPages, siteSearchTerms] = await Promise.all([
      this.fetchLandingPageSignals(account.propertyId, dateRange, limit),
      this.fetchSiteSearchSignals(account.propertyId, dateRange, Math.min(limit, 25)),
    ]);

    return {
      account,
      dateRange,
      landingPages,
      siteSearchTerms,
    };
  }

  private accountsFromJsonEnv(): AnalyticsAccount[] {
    const raw = process.env.ANALYTICS_ACCOUNTS || process.env.GA4_ACCOUNTS || "";
    if (!raw.trim()) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((item, index) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const propertyId = this.cleanPropertyId(String(record.propertyId || record.ga4PropertyId || ""));
          if (!propertyId) return null;

          return {
            id: String(record.id || record.accountId || `ga4-${index + 1}`),
            name: String(record.name || record.label || `GA4 property ${propertyId}`),
            propertyId,
          };
        })
        .filter((item): item is AnalyticsAccount => Boolean(item));
    } catch {
      return [];
    }
  }

  private resolveAccount(input: AnalyticsReportRowsInput): AnalyticsAccount {
    const propertyId = this.cleanPropertyId(input.propertyId || "");
    if (propertyId) {
      const existing = this.listAccounts().find((account) => account.propertyId === propertyId);
      return existing || {
        id: input.accountId || `ga4-${propertyId}`,
        name: `GA4 property ${propertyId}`,
        propertyId,
      };
    }

    const accounts = this.listAccounts();
    if (!accounts.length) {
      throw new Error("No GA4 property is configured. Set GA4_PROPERTY_ID or ANALYTICS_ACCOUNTS.");
    }

    return accounts.find((account) => account.id === input.accountId) || accounts[0];
  }

  private cleanPropertyId(input: string): string {
    return String(input || "").trim().replace(/^properties\//, "");
  }

  private resolveDateRange(input?: DateRangeInput): { startDate: string; endDate: string } {
    return {
      startDate: input?.startDate || "90daysAgo",
      endDate: input?.endDate || "today",
    };
  }

  private async runReportWithFallback(
    propertyId: string,
    dateRange: { startDate: string; endDate: string },
    limit = 10000
  ): Promise<{ rows: unknown[]; metricNames: string[]; conversionsMetric: MetricPlan["conversionsMetric"] }> {
    const plans: MetricPlan[] = [
      { names: ["sessions", "activeUsers", "screenPageViews", "eventCount", "keyEvents", "totalRevenue"], conversionsMetric: "keyEvents" },
      { names: ["sessions", "activeUsers", "screenPageViews", "eventCount", "conversions", "totalRevenue"], conversionsMetric: "conversions" },
      { names: ["sessions", "activeUsers", "screenPageViews", "eventCount", "totalRevenue"], conversionsMetric: "" },
      { names: ["sessions", "activeUsers", "screenPageViews"], conversionsMetric: "" },
    ];

    let lastError: unknown = null;

    for (const plan of plans) {
      try {
        const [response] = await this.client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [
            { name: "date" },
            { name: "sessionDefaultChannelGroup" },
            { name: "sessionCampaignName" },
            { name: "country" },
          ],
          metrics: plan.names.map((name) => ({ name })),
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit,
        });

        return {
          rows: response.rows || [],
          metricNames: plan.names,
          conversionsMetric: plan.conversionsMetric,
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError || "GA4 report failed."));
  }

  private async fetchLandingPageSignals(
    propertyId: string,
    dateRange: { startDate: string; endDate: string },
    limit: number
  ): Promise<AnalyticsFaqLandingPage[]> {
    const [response] = await this.client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [dateRange],
      dimensions: [
        { name: "landingPagePlusQueryString" },
        { name: "pageTitle" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "eventCount" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit,
    });

    return (response.rows || []).map((row) => ({
      pagePath: this.cleanDimension(this.getDimension(row, 0), "/"),
      pageTitle: this.cleanDimension(this.getDimension(row, 1), "Untitled page"),
      sessions: this.getMetric(row, 0),
      users: this.getMetric(row, 1),
      views: this.getMetric(row, 2),
      events: this.getMetric(row, 3),
    }));
  }

  private async fetchSiteSearchSignals(
    propertyId: string,
    dateRange: { startDate: string; endDate: string },
    limit: number
  ): Promise<AnalyticsFaqSearchTerm[]> {
    const plans = [
      { metrics: ["eventCount", "sessions"] },
      { metrics: ["eventCount"] },
    ];

    for (const plan of plans) {
      try {
        const [response] = await this.client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [dateRange],
          dimensions: [{ name: "searchTerm" }],
          metrics: plan.metrics.map((name) => ({ name })),
          orderBys: [{ metric: { metricName: plan.metrics[0] }, desc: true }],
          limit,
        });

        return (response.rows || [])
          .map((row) => ({
            searchTerm: this.cleanDimension(this.getDimension(row, 0), ""),
            events: this.getMetric(row, 0),
            sessions: this.getMetric(row, 1),
          }))
          .filter((row) => row.searchTerm);
      } catch {
        // Some GA4 properties do not collect site-search terms. The demand module can still use landing pages and GSC.
      }
    }

    return [];
  }

  private toRows(rows: unknown[], metricNames: string[], conversionsMetric: MetricPlan["conversionsMetric"]): string[][] {
    const metricIndex = new Map(metricNames.map((name, index) => [name, index]));
    const values = rows.map((row) => {
      const date = this.gaDate(this.getDimension(row, 0));
      const channel = this.cleanDimension(this.getDimension(row, 1), "Unassigned");
      const campaign = this.cleanDimension(this.getDimension(row, 2), "Unassigned campaign");
      const country = this.cleanDimension(this.getDimension(row, 3), "Unknown country");
      const sessions = this.getMetric(row, metricIndex.get("sessions"));
      const users = this.getMetric(row, metricIndex.get("activeUsers"));
      const views = this.getMetric(row, metricIndex.get("screenPageViews"));
      const events = this.getMetric(row, metricIndex.get("eventCount"));
      const conversions = conversionsMetric ? this.getMetric(row, metricIndex.get(conversionsMetric)) : 0;
      const revenue = this.getMetric(row, metricIndex.get("totalRevenue"));
      const organicTraffic = this.isOrganicChannel(channel) ? sessions : 0;
      const paidTraffic = this.isPaidChannel(channel) ? sessions : 0;

      return [
        date,
        channel,
        campaign,
        country,
        String(sessions),
        String(users),
        String(organicTraffic),
        String(paidTraffic),
        String(conversions),
        String(revenue),
        String(views),
        String(events),
      ];
    });

    return [HEADER_ROW, ...values];
  }

  private getDimension(row: unknown, index: number): string {
    const record = row as { dimensionValues?: Array<{ value?: string | null }> };
    return record.dimensionValues?.[index]?.value || "";
  }

  private getMetric(row: unknown, index: number | undefined): number {
    if (index == null) return 0;
    const record = row as { metricValues?: Array<{ value?: string | null }> };
    const value = Number(record.metricValues?.[index]?.value || "0");
    return Number.isFinite(value) ? value : 0;
  }

  private gaDate(input: string): string {
    const value = String(input || "");
    if (/^\d{8}$/.test(value)) {
      return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }
    return value;
  }

  private cleanDimension(input: string, fallback: string): string {
    const value = String(input || "").trim();
    if (!value || value === "(not set)" || value === "(other)") return fallback;
    return value;
  }

  private isOrganicChannel(channel: string): boolean {
    return /organic/i.test(channel);
  }

  private isPaidChannel(channel: string): boolean {
    return /paid|display|cross-network|shopping|affiliate/i.test(channel);
  }
}
