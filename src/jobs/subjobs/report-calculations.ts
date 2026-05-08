// src/jobs/subjobs/report-calculations.ts

export type ReportMetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "conversions"
  | "conversionRate"
  | "cpa"
  | "roas"
  | "revenue"
  | "leads"
  | "cpl"
  | "sessions"
  | "users"
  | "organicTraffic"
  | "paidTraffic"
  | "emailSends"
  | "emailOpens"
  | "emailClicks"
  | "emailOpenRate"
  | "emailClickRate";

export type ReportColumnMapping = {
  date?: string;
  campaign?: string;
  channel?: string;
  country?: string;

  spend?: string;
  impressions?: string;
  clicks?: string;
  conversions?: string;
  revenue?: string;
  leads?: string;

  sessions?: string;
  users?: string;
  organicTraffic?: string;
  paidTraffic?: string;

  emailSends?: string;
  emailOpens?: string;
  emailClicks?: string;
};

export type NormalizedReportRow = {
  raw: Record<string, string>;
  date?: string;
  campaign?: string;
  channel?: string;
  country?: string;

  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  leads: number;

  sessions: number;
  users: number;
  organicTraffic: number;
  paidTraffic: number;

  emailSends: number;
  emailOpens: number;
  emailClicks: number;
};

export type ReportTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversionRate: number;
  cpa: number;
  roas: number;
  revenue: number;
  leads: number;
  cpl: number;
  sessions: number;
  users: number;
  organicTraffic: number;
  paidTraffic: number;
  emailSends: number;
  emailOpens: number;
  emailClicks: number;
  emailOpenRate: number;
  emailClickRate: number;
};

export type BreakdownRow = ReportTotals & {
  label: string;
  rows: number;
};

export type ComparisonResult = {
  metric: ReportMetricKey;
  current: number;
  previous: number;
  changeAbs: number;
  changePct: number | null;
  direction: "up" | "down" | "flat";
};

export type DateRange = {
  startDate?: string;
  endDate?: string;
};

const NUMERIC_FIELDS: Array<keyof Omit<NormalizedReportRow, "raw" | "date" | "campaign" | "channel" | "country">> = [
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "revenue",
  "leads",
  "sessions",
  "users",
  "organicTraffic",
  "paidTraffic",
  "emailSends",
  "emailOpens",
  "emailClicks",
];

export function normalizeHeader(input: string): string {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseNumber(input: unknown): number {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/[₪$€£,%]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

export function roundNumber(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function inferColumnMapping(headers: string[], provided: ReportColumnMapping): ReportColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  const find = (candidates: string[]): string | undefined => {
    const normalizedCandidates = candidates.map(normalizeHeader);

    const exact = normalizedHeaders.find((h) => normalizedCandidates.includes(h.normalized));
    if (exact) return exact.original;

    const includes = normalizedHeaders.find((h) =>
      normalizedCandidates.some((candidate) => h.normalized.includes(candidate))
    );

    return includes?.original;
  };

  return {
    date: provided.date || find(["date", "day", "created date", "month"]),
    campaign: provided.campaign || find(["campaign", "campaign name", "utm campaign"]),
    channel: provided.channel || find(["channel", "source medium", "source", "platform"]),
    country: provided.country || find(["country", "market", "geo"]),

    spend: provided.spend || find(["spend", "cost", "amount spent", "media spend"]),
    impressions: provided.impressions || find(["impressions", "impr"]),
    clicks: provided.clicks || find(["clicks", "link clicks"]),
    conversions: provided.conversions || find(["conversions", "purchases", "sales"]),
    revenue: provided.revenue || find(["revenue", "purchase value", "sales value"]),
    leads: provided.leads || find(["leads", "lead"]),

    sessions: provided.sessions || find(["sessions"]),
    users: provided.users || find(["users", "active users"]),
    organicTraffic: provided.organicTraffic || find(["organic traffic", "organic sessions"]),
    paidTraffic: provided.paidTraffic || find(["paid traffic", "paid sessions"]),

    emailSends: provided.emailSends || find(["email sends", "sends", "sent"]),
    emailOpens: provided.emailOpens || find(["email opens", "opens"]),
    emailClicks: provided.emailClicks || find(["email clicks"]),
  };
}

export function columnNameToIndex(headers: string[], columnName?: string): number | null {
  if (!columnName) return null;

  const target = normalizeHeader(columnName);
  const idx = headers.findIndex((header) => normalizeHeader(header) === target);

  return idx >= 0 ? idx : null;
}

export function normalizeRows(rows: string[][], mapping: ReportColumnMapping): NormalizedReportRow[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => String(h ?? ""));
  const dataRows = rows.slice(1);

  const indexOf = (key: keyof ReportColumnMapping) => columnNameToIndex(headers, mapping[key]);

  const idx = {
    date: indexOf("date"),
    campaign: indexOf("campaign"),
    channel: indexOf("channel"),
    country: indexOf("country"),

    spend: indexOf("spend"),
    impressions: indexOf("impressions"),
    clicks: indexOf("clicks"),
    conversions: indexOf("conversions"),
    revenue: indexOf("revenue"),
    leads: indexOf("leads"),

    sessions: indexOf("sessions"),
    users: indexOf("users"),
    organicTraffic: indexOf("organicTraffic"),
    paidTraffic: indexOf("paidTraffic"),

    emailSends: indexOf("emailSends"),
    emailOpens: indexOf("emailOpens"),
    emailClicks: indexOf("emailClicks"),
  };

  return dataRows
    .map((row) => {
      const raw: Record<string, string> = {};

      headers.forEach((header, i) => {
        raw[header] = String(row[i] ?? "");
      });

      const getText = (col: number | null): string | undefined => {
        if (col == null) return undefined;
        const value = String(row[col] ?? "").trim();
        return value || undefined;
      };

      const getNumber = (col: number | null): number => {
        if (col == null) return 0;
        return parseNumber(row[col]);
      };

      return {
        raw,
        date: normalizeDate(getText(idx.date)),
        campaign: getText(idx.campaign),
        channel: getText(idx.channel),
        country: getText(idx.country),

        spend: getNumber(idx.spend),
        impressions: getNumber(idx.impressions),
        clicks: getNumber(idx.clicks),
        conversions: getNumber(idx.conversions),
        revenue: getNumber(idx.revenue),
        leads: getNumber(idx.leads),

        sessions: getNumber(idx.sessions),
        users: getNumber(idx.users),
        organicTraffic: getNumber(idx.organicTraffic),
        paidTraffic: getNumber(idx.paidTraffic),

        emailSends: getNumber(idx.emailSends),
        emailOpens: getNumber(idx.emailOpens),
        emailClicks: getNumber(idx.emailClicks),
      };
    })
    .filter((row) => {
      const hasAnyNumber = NUMERIC_FIELDS.some((field) => row[field] !== 0);
      const hasAnyDimension = Boolean(row.date || row.campaign || row.channel || row.country);
      return hasAnyNumber || hasAnyDimension;
    });
}

export function normalizeDate(input?: string): string | undefined {
  const value = String(input ?? "").trim();
  if (!value) return undefined;

  const native = new Date(value);
  if (!Number.isNaN(native.getTime())) {
    return native.toISOString().slice(0, 10);
  }

  const ddmmyyyy = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3].length === 2 ? `20${ddmmyyyy[3]}` : ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  return value;
}

export function filterRowsByDateRange(rows: NormalizedReportRow[], range?: DateRange): NormalizedReportRow[] {
  if (!range?.startDate && !range?.endDate) return rows;

  const start = range.startDate ? normalizeDate(range.startDate) : undefined;
  const end = range.endDate ? normalizeDate(range.endDate) : undefined;

  return rows.filter((row) => {
    if (!row.date) return false;
    if (start && row.date < start) return false;
    if (end && row.date > end) return false;
    return true;
  });
}

export function calculateTotals(rows: NormalizedReportRow[]): ReportTotals {
  const base = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    leads: 0,
    sessions: 0,
    users: 0,
    organicTraffic: 0,
    paidTraffic: 0,
    emailSends: 0,
    emailOpens: 0,
    emailClicks: 0,
  };

  for (const row of rows) {
    base.spend += row.spend;
    base.impressions += row.impressions;
    base.clicks += row.clicks;
    base.conversions += row.conversions;
    base.revenue += row.revenue;
    base.leads += row.leads;
    base.sessions += row.sessions;
    base.users += row.users;
    base.organicTraffic += row.organicTraffic;
    base.paidTraffic += row.paidTraffic;
    base.emailSends += row.emailSends;
    base.emailOpens += row.emailOpens;
    base.emailClicks += row.emailClicks;
  }

  return {
    spend: roundNumber(base.spend),
    impressions: roundNumber(base.impressions),
    clicks: roundNumber(base.clicks),
    ctr: roundNumber(safeDivide(base.clicks, base.impressions) * 100),
    cpc: roundNumber(safeDivide(base.spend, base.clicks)),
    cpm: roundNumber(safeDivide(base.spend, base.impressions) * 1000),
    conversions: roundNumber(base.conversions),
    conversionRate: roundNumber(safeDivide(base.conversions, base.clicks) * 100),
    cpa: roundNumber(safeDivide(base.spend, base.conversions)),
    roas: roundNumber(safeDivide(base.revenue, base.spend)),
    revenue: roundNumber(base.revenue),
    leads: roundNumber(base.leads),
    cpl: roundNumber(safeDivide(base.spend, base.leads)),
    sessions: roundNumber(base.sessions),
    users: roundNumber(base.users),
    organicTraffic: roundNumber(base.organicTraffic),
    paidTraffic: roundNumber(base.paidTraffic),
    emailSends: roundNumber(base.emailSends),
    emailOpens: roundNumber(base.emailOpens),
    emailClicks: roundNumber(base.emailClicks),
    emailOpenRate: roundNumber(safeDivide(base.emailOpens, base.emailSends) * 100),
    emailClickRate: roundNumber(safeDivide(base.emailClicks, base.emailSends) * 100),
  };
}

export function getMetricValue(totals: ReportTotals, metric: ReportMetricKey): number {
  return totals[metric] ?? 0;
}

export function calculateBreakdown(
  rows: NormalizedReportRow[],
  breakdown: "campaign" | "channel" | "country" | "month" | "none",
  primaryMetric: ReportMetricKey
): BreakdownRow[] {
  if (breakdown === "none") {
    return [{ label: "All data", rows: rows.length, ...calculateTotals(rows) }];
  }

  const groups = new Map<string, NormalizedReportRow[]>();

  for (const row of rows) {
    let label = "Unknown";

    if (breakdown === "campaign") label = row.campaign || "Unknown campaign";
    if (breakdown === "channel") label = row.channel || "Unknown channel";
    if (breakdown === "country") label = row.country || "Unknown country";
    if (breakdown === "month") label = row.date ? row.date.slice(0, 7) : "Unknown month";

    groups.set(label, [...(groups.get(label) ?? []), row]);
  }

  return Array.from(groups.entries())
    .map(([label, groupRows]) => ({
      label,
      rows: groupRows.length,
      ...calculateTotals(groupRows),
    }))
    .sort((a, b) => getMetricValue(b, primaryMetric) - getMetricValue(a, primaryMetric));
}

export function buildPreviousPeriodRows(
  allRows: NormalizedReportRow[],
  currentRange?: DateRange
): NormalizedReportRow[] {
  if (!currentRange?.startDate || !currentRange?.endDate) return [];

  const start = normalizeDate(currentRange.startDate);
  const end = normalizeDate(currentRange.endDate);
  if (!start || !end) return [];

  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

  const rangeMs = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const previousStart = new Date(previousEnd.getTime() - rangeMs);

  const previousRange = {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  };

  return filterRowsByDateRange(allRows, previousRange);
}

export function calculateComparison(
  currentTotals: ReportTotals,
  previousTotals: ReportTotals,
  metrics: ReportMetricKey[]
): ComparisonResult[] {
  return metrics.map((metric) => {
    const current = getMetricValue(currentTotals, metric);
    const previous = getMetricValue(previousTotals, metric);
    const changeAbs = roundNumber(current - previous);
    const changePct = previous === 0 ? null : roundNumber(((current - previous) / previous) * 100);
    const direction = changeAbs > 0 ? "up" : changeAbs < 0 ? "down" : "flat";

    return {
      metric,
      current,
      previous,
      changeAbs,
      changePct,
      direction,
    };
  });
}

export function detectBasicAnomalies(
  breakdownRows: BreakdownRow[],
  primaryMetric: ReportMetricKey
): string[] {
  const anomalies: string[] = [];
  if (breakdownRows.length < 2) return anomalies;

  const values = breakdownRows.map((row) => getMetricValue(row, primaryMetric));
  const avg = safeDivide(values.reduce((sum, value) => sum + value, 0), values.length);

  for (const row of breakdownRows.slice(0, 10)) {
    const value = getMetricValue(row, primaryMetric);
    if (avg > 0 && value >= avg * 2) {
      anomalies.push(`${row.label} is significantly above the average for ${primaryMetric}.`);
    }

    if (avg > 0 && value <= avg * 0.35) {
      anomalies.push(`${row.label} is significantly below the average for ${primaryMetric}.`);
    }
  }

  return anomalies.slice(0, 6);
}