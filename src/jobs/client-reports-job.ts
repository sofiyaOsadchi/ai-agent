// src/jobs/client-reports-job.ts
// Code in English. Comments can be Hebrew.

import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";
import {
  calculateBreakdown,
  calculateComparison,
  calculateTotals,
  detectBasicAnomalies,
  filterRowsByDateRange,
  inferColumnMapping,
  buildPreviousPeriodRows,
  normalizeRows,
  normalizeDate,
  type BreakdownRow,
  type DateRange,
  type ReportColumnMapping,
  type ReportMetricKey,
  type ReportTotals,
} from "./subjobs/report-calculations.js";
import { buildReportChartData, type ReportChartData } from "./subjobs/report-chart-data.js";
import {

  generateAiInsights,

  buildDeterministicInsights,

  generateAiInsightBlocks,

  buildDeterministicInsightBlocks,

  type ReportInsightOutput,

  type InsightBlock,

} from "./subjobs/report-insights.js";

export type ClientReportType =
  | "campaign-performance-overview"
  | "monthly-client-report"
  | "channel-comparison-report"
  | "budget-pacing-report"
  | "leads-conversions-report"
  | "seo-traffic-report"
  | "ecommerce-roas-report"
  | "anomaly-opportunities-report"
  | "executive-summary-report"
  | "custom-metrics-dashboard";

export type ClientDashboardConfig = {
  visibleSections?: {
    kpiCards?: boolean;
    trendChart?: boolean;
    breakdownChart?: boolean;
    performanceTable?: boolean;
    aiSummary?: boolean;
    recommendations?: boolean;
    sourcePreview?: boolean;
  };

  kpiMetrics?: ReportMetricKey[];

  trendChart?: {
    type?: "line" | "bar";
    metrics?: ReportMetricKey[];
    groupBy?: "date" | "month";
  };

  breakdownChart?: {
    type?: "horizontalBar" | "bar";
    metric?: ReportMetricKey;
    limit?: number;
    sort?: "desc" | "asc";
  };

  table?: {
    columns?: string[];
    sortBy?: ReportMetricKey | "label" | "rows";
    sortDirection?: "desc" | "asc";
  };

  display?: {
    accentColor?: string;
    currency?: string;
    numberFormat?: "short" | "full";
  };
};

export type ResolvedClientDashboardConfig = {
  visibleSections: {
    kpiCards: boolean;
    trendChart: boolean;
    breakdownChart: boolean;
    performanceTable: boolean;
    aiSummary: boolean;
    recommendations: boolean;
    sourcePreview: boolean;
  };

  kpiMetrics: ReportMetricKey[];

  trendChart: {
    type: "line" | "bar";
    metrics: ReportMetricKey[];
    groupBy: "date" | "month";
  };

  breakdownChart: {
    type: "horizontalBar" | "bar";
    metric: ReportMetricKey;
    limit: number;
    sort: "desc" | "asc";
  };

  table: {
    columns: string[];
    sortBy: ReportMetricKey | "label" | "rows";
    sortDirection: "desc" | "asc";
  };

  display: {
    accentColor: string;
    currency: string;
    numberFormat: "short" | "full";
  };
};

export type ClientReportsPayload = {
  spreadsheetId: string;
  sourceTab?: string;

  reportType?: ClientReportType;
  dateRange?: DateRange;

  columnMapping?: ReportColumnMapping;

  primaryMetric?: ReportMetricKey;
  breakdown?: "campaign" | "channel" | "country" | "month" | "none";

  dashboardConfig?: ClientDashboardConfig;

  options?: {
    dryRun?: boolean;
    exportToSheet?: boolean;
    outputTabName?: string;
    includeAiSummary?: boolean;
    includeRecommendations?: boolean;
    // בלוקים שהקמפיינר ערך/קיבע - מועברים ל-job כדי שלא יידרסו ב-regeneration.
    preservedBlocks?: InsightBlock[];
  };
};

export type ClientReportResult = {
  ok: boolean;
  reportType: ClientReportType;
  spreadsheetId: string;
  sourceTab: string;
  outputTabName?: string;
  rowCount: number;
  filteredRowCount: number;
  resolvedMapping: ReportColumnMapping;
  dateInfo: {
    hasDateColumn: boolean;
    minDate?: string;
    maxDate?: string;
    selectedStartDate?: string;
    selectedEndDate?: string;
  };
  dashboardConfig: ResolvedClientDashboardConfig;
  totals: ReportTotals;
  comparison: ReturnType<typeof calculateComparison>;
  breakdownRows: BreakdownRow[];
  chartData: ReportChartData;
  anomalies: string[];
  insights: ReportInsightOutput;
  // השדה החדש - בלוקים נפרדים עם id יציב לעריכה.
  insightBlocks: InsightBlock[];
  previewRows: Array<Record<string, string>>;
  exported: boolean;
};

const DEFAULT_VISIBLE_SECTIONS: ResolvedClientDashboardConfig["visibleSections"] = {
  kpiCards: true,
  trendChart: true,
  breakdownChart: true,
  performanceTable: true,
  aiSummary: true,
  recommendations: true,
  sourcePreview: true,
};

const REPORT_PRESETS: Record<ClientReportType, ResolvedClientDashboardConfig> = {
  "campaign-performance-overview": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "clicks", "ctr", "conversions", "cpa", "revenue", "roas"],
    trendChart: { type: "line", metrics: ["conversions", "spend"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "conversions", limit: 8, sort: "desc" },
    table: {
      columns: ["label", "spend", "clicks", "ctr", "conversions", "conversionRate", "cpa", "revenue", "roas"],
      sortBy: "conversions",
      sortDirection: "desc",
    },
    display: { accentColor: "#00B3A4", currency: "₪", numberFormat: "short" },
  },

  "monthly-client-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "clicks", "conversions", "cpa", "revenue", "roas"],
    trendChart: { type: "line", metrics: ["spend", "revenue", "conversions"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "revenue", limit: 8, sort: "desc" },
    table: {
      columns: ["label", "spend", "clicks", "conversions", "cpa", "revenue", "roas"],
      sortBy: "revenue",
      sortDirection: "desc",
    },
    display: { accentColor: "#00B3A4", currency: "₪", numberFormat: "short" },
  },

  "channel-comparison-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "clicks", "ctr", "conversions", "cpa", "revenue", "roas"],
    trendChart: { type: "line", metrics: ["conversions", "revenue"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "roas", limit: 8, sort: "desc" },
    table: {
      columns: ["label", "spend", "clicks", "ctr", "conversions", "cpa", "revenue", "roas"],
      sortBy: "roas",
      sortDirection: "desc",
    },
    display: { accentColor: "#4F8CFF", currency: "₪", numberFormat: "short" },
  },

  "budget-pacing-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "impressions", "clicks", "cpc", "conversions", "cpa"],
    trendChart: { type: "bar", metrics: ["spend"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "spend", limit: 10, sort: "desc" },
    table: {
      columns: ["label", "spend", "impressions", "clicks", "cpc", "conversions", "cpa"],
      sortBy: "spend",
      sortDirection: "desc",
    },
    display: { accentColor: "#F59E0B", currency: "₪", numberFormat: "short" },
  },

  "leads-conversions-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "leads", "cpl", "conversions", "conversionRate", "clicks", "ctr"],
    trendChart: { type: "line", metrics: ["leads", "conversions", "spend"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "leads", limit: 8, sort: "desc" },
    table: {
      columns: ["label", "spend", "clicks", "ctr", "leads", "cpl", "conversions", "cpa"],
      sortBy: "leads",
      sortDirection: "desc",
    },
    display: { accentColor: "#22C55E", currency: "₪", numberFormat: "short" },
  },

  "seo-traffic-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["sessions", "users", "organicTraffic", "conversions", "revenue", "conversionRate"],
    trendChart: { type: "line", metrics: ["sessions", "users", "organicTraffic"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "sessions", limit: 8, sort: "desc" },
    table: {
      columns: ["label", "sessions", "users", "organicTraffic", "conversions", "conversionRate", "revenue"],
      sortBy: "sessions",
      sortDirection: "desc",
    },
    display: { accentColor: "#A855F7", currency: "₪", numberFormat: "short" },
  },

  "ecommerce-roas-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "revenue", "roas", "conversions", "cpa", "conversionRate"],
    trendChart: { type: "line", metrics: ["revenue", "spend", "roas"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "roas", limit: 8, sort: "desc" },
    table: {
      columns: ["label", "spend", "revenue", "roas", "conversions", "conversionRate", "cpa"],
      sortBy: "roas",
      sortDirection: "desc",
    },
    display: { accentColor: "#14B8A6", currency: "₪", numberFormat: "short" },
  },

  "anomaly-opportunities-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "conversions", "cpa", "revenue", "roas", "ctr"],
    trendChart: { type: "line", metrics: ["conversions", "cpa", "roas"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "cpa", limit: 10, sort: "desc" },
    table: {
      columns: ["label", "spend", "clicks", "ctr", "conversions", "cpa", "revenue", "roas"],
      sortBy: "cpa",
      sortDirection: "desc",
    },
    display: { accentColor: "#EF4444", currency: "₪", numberFormat: "short" },
  },

  "executive-summary-report": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "revenue", "roas", "conversions", "cpa", "leads"],
    trendChart: { type: "line", metrics: ["revenue", "spend"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "revenue", limit: 5, sort: "desc" },
    table: {
      columns: ["label", "spend", "conversions", "cpa", "revenue", "roas"],
      sortBy: "revenue",
      sortDirection: "desc",
    },
    display: { accentColor: "#6366F1", currency: "₪", numberFormat: "short" },
  },

  "custom-metrics-dashboard": {
    visibleSections: DEFAULT_VISIBLE_SECTIONS,
    kpiMetrics: ["spend", "clicks", "conversions", "revenue", "roas", "leads"],
    trendChart: { type: "line", metrics: ["conversions", "revenue"], groupBy: "date" },
    breakdownChart: { type: "horizontalBar", metric: "conversions", limit: 8, sort: "desc" },
    table: {
      columns: ["label", "spend", "clicks", "conversions", "revenue", "roas", "leads"],
      sortBy: "conversions",
      sortDirection: "desc",
    },
    display: { accentColor: "#00B3A4", currency: "₪", numberFormat: "short" },
  },
};

export class ClientReportsJob {
  constructor(private agent: AIAgent, private sheets: SheetsService) {}

  async runFromEnv(): Promise<void> {
    const payload = this.readPayloadFromEnv();
    const result = await this.run(payload);

    console.log("CLIENT_REPORT_RESULT_JSON_START");
    console.log(JSON.stringify(result));
    console.log("CLIENT_REPORT_RESULT_JSON_END");
  }

  async run(payload: ClientReportsPayload): Promise<ClientReportResult> {
    const spreadsheetId = this.coerceSpreadsheetId(payload.spreadsheetId);

    if (!spreadsheetId) {
      throw new Error("client-reports: Missing spreadsheetId.");
    }

    const reportType = payload.reportType || "campaign-performance-overview";
    const primaryMetric = payload.primaryMetric || "conversions";
    const breakdown = payload.breakdown || "campaign";
    const dashboardConfig = this.resolveDashboardConfig(reportType, payload.dashboardConfig, primaryMetric);

    const sourceTab =
      payload.sourceTab?.trim() ||
      await this.sheets.getFirstSheetTitle(spreadsheetId);

    console.log(chalk.blue("📊 Starting Client Reports job."));
    console.log(chalk.cyan(`Spreadsheet: ${spreadsheetId}`));
    console.log(chalk.cyan(`Tab: ${sourceTab}`));
    console.log(chalk.cyan(`Report type: ${reportType}`));

    const range = `${this.quoteA1Sheet(sourceTab)}!A:ZZ`;
    const rawRows = await this.sheets.readValues(spreadsheetId, range);

    if (!rawRows.length) {
      throw new Error(`Source tab "${sourceTab}" is empty.`);
    }

    const headers = rawRows[0].map((h) => String(h ?? ""));
    const resolvedMapping = inferColumnMapping(headers, payload.columnMapping ?? {});

    console.log(chalk.yellow("Resolved column mapping:"));
    console.log(JSON.stringify(resolvedMapping, null, 2));

    const allRows = normalizeRows(rawRows, resolvedMapping);
    const dateInfo = this.getDateInfo(allRows.map((row) => row.date).filter(Boolean) as string[]);

    const normalizedRange: DateRange = {
      startDate: normalizeDate(payload.dateRange?.startDate),
      endDate: normalizeDate(payload.dateRange?.endDate),
    };

    const hasRange = Boolean(normalizedRange.startDate || normalizedRange.endDate);
    const filteredRows = hasRange ? filterRowsByDateRange(allRows, normalizedRange) : allRows;

    if (!filteredRows.length) {
      const details = [
        "No rows matched the selected filters.",
        `Detected date range: ${dateInfo.minDate || "unknown"} to ${dateInfo.maxDate || "unknown"}.`,
        `Selected date range: ${normalizedRange.startDate || "empty"} to ${normalizedRange.endDate || "empty"}.`,
        "Check date range or column mapping.",
      ].join(" ");

      throw new Error(details);
    }

    const totals = calculateTotals(filteredRows);
    const previousRows = buildPreviousPeriodRows(allRows, normalizedRange);
    const previousTotals = calculateTotals(previousRows);

    const comparisonMetrics: ReportMetricKey[] = Array.from(
      new Set<ReportMetricKey>([
        primaryMetric,
        ...dashboardConfig.kpiMetrics,
        ...dashboardConfig.trendChart.metrics,
        dashboardConfig.breakdownChart.metric,
      ])
    );

    const comparison = calculateComparison(totals, previousTotals, comparisonMetrics);

    let breakdownRows = calculateBreakdown(filteredRows, breakdown, dashboardConfig.breakdownChart.metric);

    breakdownRows = this.sortBreakdownRows(
      breakdownRows,
      dashboardConfig.table.sortBy,
      dashboardConfig.table.sortDirection
    );

    const anomalies = detectBasicAnomalies(breakdownRows, dashboardConfig.breakdownChart.metric);

    const chartData = buildReportChartData({
      rows: filteredRows,
      breakdownRows,
      primaryMetric: dashboardConfig.breakdownChart.metric,
      lineMetrics: dashboardConfig.trendChart.metrics,
    });

    const insightInput = {
      reportType,
      primaryMetric,
      breakdown,
      totals,
      comparison,
      topBreakdownRows: breakdownRows.slice(0, dashboardConfig.breakdownChart.limit),
      anomalies,
    };

    const includeAiSummary = payload.options?.includeAiSummary !== false;
    const includeRecommendations = payload.options?.includeRecommendations !== false;

    // === Insights הישנים (נשארים לתאימות לאחור) ===
    const insights = includeAiSummary || includeRecommendations
      ? await generateAiInsights(this.agent, insightInput)
      : buildDeterministicInsights(insightInput);

    if (!includeAiSummary) {
      insights.summary = "";
    }

    if (!includeRecommendations) {
      insights.recommendations = [];
    }

    // === Insight Blocks החדשים (id יציב, ניתן לעריכה) ===
    // preservedBlocks מגיע כשהקמפיינר מבקש regeneration אחרי שערך/קיבע בלוקים.
    const insightBlocksInput = {
      ...insightInput,
      preservedBlocks: payload.options?.preservedBlocks,
    };

    const insightBlocksResult = includeAiSummary || includeRecommendations
      ? await generateAiInsightBlocks(this.agent, insightBlocksInput)
      : buildDeterministicInsightBlocks(insightBlocksInput);

    const insightBlocks = insightBlocksResult.blocks;

    const outputTabName = payload.options?.outputTabName?.trim()
      || `Client Report - ${new Date().toISOString().slice(0, 10)}`;

    let exported = false;

    if (payload.options?.exportToSheet && !payload.options?.dryRun) {
      await this.exportReportToSheet({
        spreadsheetId,
        outputTabName,
        result: {
          reportType,
          sourceTab,
          rowCount: allRows.length,
          filteredRowCount: filteredRows.length,
          resolvedMapping,
          totals,
          comparison,
          breakdownRows,
          chartData,
          anomalies,
          insights,
          dashboardConfig,
        },
      });

      exported = true;
    }

    const result: ClientReportResult = {
      ok: true,
      reportType,
      spreadsheetId,
      sourceTab,
      outputTabName: exported ? outputTabName : undefined,
      rowCount: allRows.length,
      filteredRowCount: filteredRows.length,
      resolvedMapping,
      dateInfo: {
        ...dateInfo,
        selectedStartDate: normalizedRange.startDate,
        selectedEndDate: normalizedRange.endDate,
      },
      dashboardConfig,
      totals,
      comparison,
      breakdownRows: breakdownRows.slice(0, 100),
      chartData,
      anomalies,
      insights,
      insightBlocks,
      previewRows: rawRows.slice(1, 11).map((row) => {
        const out: Record<string, string> = {};

        headers.forEach((header, i) => {
          out[header] = String(row[i] ?? "");
        });

        return out;
      }),
      exported,
    };

    console.log(chalk.green(`✅ Client report generated. Rows: ${filteredRows.length}`));

    if (exported) {
      console.log(chalk.green(`✅ Exported to tab: ${outputTabName}`));
    }

    return result;
  }

  private readPayloadFromEnv(): ClientReportsPayload {
    const raw = process.env.DYNAMIC_PAYLOAD || "{}";

    try {
      return JSON.parse(raw) as ClientReportsPayload;
    } catch {
      throw new Error("client-reports: DYNAMIC_PAYLOAD is not valid JSON.");
    }
  }

  private coerceSpreadsheetId(input: string): string {
    const s = String(input ?? "").trim();

    if (!s) {
      return "";
    }

    const match = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

    if (match?.[1]) {
      return match[1];
    }

    return s;
  }

  private quoteA1Sheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  private resolveDashboardConfig(
    reportType: ClientReportType,
    provided: ClientDashboardConfig | undefined,
    primaryMetric: ReportMetricKey
  ): ResolvedClientDashboardConfig {
    const preset = REPORT_PRESETS[reportType] || REPORT_PRESETS["campaign-performance-overview"];

    const resolvedBreakdownMetric: ReportMetricKey =
      provided?.breakdownChart?.metric ||
      preset.breakdownChart.metric ||
      primaryMetric;

    const resolvedTrendMetrics: ReportMetricKey[] =
      provided?.trendChart?.metrics?.length
        ? provided.trendChart.metrics
        : preset.trendChart.metrics.length
          ? preset.trendChart.metrics
          : [primaryMetric];

    const resolvedKpiMetrics: ReportMetricKey[] =
      provided?.kpiMetrics?.length
        ? provided.kpiMetrics
        : preset.kpiMetrics.length
          ? preset.kpiMetrics
          : [primaryMetric, "spend", "revenue", "conversions"];

    return {
      visibleSections: {
        ...preset.visibleSections,
        ...(provided?.visibleSections || {}),
      },
      kpiMetrics: resolvedKpiMetrics,
      trendChart: {
        type: provided?.trendChart?.type || preset.trendChart.type,
        metrics: resolvedTrendMetrics,
        groupBy: provided?.trendChart?.groupBy || preset.trendChart.groupBy,
      },
      breakdownChart: {
        type: provided?.breakdownChart?.type || preset.breakdownChart.type,
        metric: resolvedBreakdownMetric,
        limit: provided?.breakdownChart?.limit || preset.breakdownChart.limit,
        sort: provided?.breakdownChart?.sort || preset.breakdownChart.sort,
      },
      table: {
        columns: provided?.table?.columns?.length ? provided.table.columns : preset.table.columns,
        sortBy: provided?.table?.sortBy || preset.table.sortBy || resolvedBreakdownMetric,
        sortDirection: provided?.table?.sortDirection || preset.table.sortDirection,
      },
      display: {
        accentColor: provided?.display?.accentColor || preset.display.accentColor,
        currency: provided?.display?.currency || preset.display.currency,
        numberFormat: provided?.display?.numberFormat || preset.display.numberFormat,
      },
    };
  }

  private getDateInfo(dates: string[]): {
    hasDateColumn: boolean;
    minDate?: string;
    maxDate?: string;
  } {
    const clean = dates
      .map((date) => normalizeDate(date))
      .filter((date): date is string => Boolean(date))
      .sort();

    return {
      hasDateColumn: clean.length > 0,
      minDate: clean[0],
      maxDate: clean[clean.length - 1],
    };
  }

  private getBreakdownValue(row: BreakdownRow, key?: ReportMetricKey | "label" | "rows"): number | string {
    if (!key || key === "label") {
      return row.label;
    }

    if (key === "rows") {
      return row.rows;
    }

    return Number((row as Record<string, unknown>)[key] ?? 0);
  }

  private sortBreakdownRows(
    rows: BreakdownRow[],
    sortBy?: ReportMetricKey | "label" | "rows",
    direction: "desc" | "asc" = "desc"
  ): BreakdownRow[] {
    const multiplier = direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const av = this.getBreakdownValue(a, sortBy);
      const bv = this.getBreakdownValue(b, sortBy);

      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * multiplier;
      }

      return (Number(av) - Number(bv)) * multiplier;
    });
  }

  private async exportReportToSheet(params: {
    spreadsheetId: string;
    outputTabName: string;
    result: {
      reportType: ClientReportType;
      sourceTab: string;
      rowCount: number;
      filteredRowCount: number;
      resolvedMapping: ReportColumnMapping;
      totals: ReportTotals;
      comparison: ReturnType<typeof calculateComparison>;
      breakdownRows: BreakdownRow[];
      chartData: ReportChartData;
      anomalies: string[];
      insights: ReportInsightOutput;
      dashboardConfig: ResolvedClientDashboardConfig;
    };
  }): Promise<void> {
    const { spreadsheetId, outputTabName, result } = params;

    await this.sheets.ensureTab(spreadsheetId, outputTabName);
    await this.sheets.clearTabValues(spreadsheetId, outputTabName);

    const rows: string[][] = [];

    rows.push(["Client Report"]);
    rows.push(["Generated At", new Date().toISOString()]);
    rows.push(["Report Type", result.reportType]);
    rows.push(["Source Tab", result.sourceTab]);
    rows.push(["Rows Read", String(result.rowCount)]);
    rows.push(["Rows Included", String(result.filteredRowCount)]);
    rows.push([]);

    rows.push(["AI Summary"]);
    rows.push([result.insights.summary || ""]);
    rows.push([]);

    rows.push(["Recommendations"]);

    for (const rec of result.insights.recommendations) {
      rows.push([rec]);
    }

    rows.push([]);

    rows.push(["KPI", "Value"]);

    for (const [key, value] of Object.entries(result.totals)) {
      rows.push([key, String(value)]);
    }

    rows.push([]);

    rows.push(["Comparison", "Current", "Previous", "Change", "Change %", "Direction"]);

    for (const item of result.comparison) {
      rows.push([
        item.metric,
        String(item.current),
        String(item.previous),
        String(item.changeAbs),
        item.changePct == null ? "" : String(item.changePct),
        item.direction,
      ]);
    }

    rows.push([]);

    rows.push(result.dashboardConfig.table.columns);

    for (const item of result.breakdownRows) {
      rows.push(
        result.dashboardConfig.table.columns.map((col) =>
          String((item as Record<string, unknown>)[col] ?? "")
        )
      );
    }

    rows.push([]);

    rows.push(["Dashboard Config JSON"]);
    rows.push([JSON.stringify(result.dashboardConfig, null, 2)]);

    await this.sheets.writeValues(
      spreadsheetId,
      `${this.quoteA1Sheet(outputTabName)}!A1`,
      rows
    );
  }
}