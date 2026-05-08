// src/jobs/subjobs/report-chart-data.ts

import {
  calculateTotals,
  getMetricValue,
  type BreakdownRow,
  type NormalizedReportRow,
  type ReportMetricKey,
} from "./report-calculations.js";

export type ChartPoint = {
  label: string;
  value: number;
};

export type LineChartSeries = {
  metric: ReportMetricKey;
  points: ChartPoint[];
};

export type ReportChartData = {
  line: LineChartSeries[];
  bars: ChartPoint[];
};

export function buildLineChartData(
  rows: NormalizedReportRow[],
  metrics: ReportMetricKey[]
): LineChartSeries[] {
  const groups = new Map<string, NormalizedReportRow[]>();

  for (const row of rows) {
    if (!row.date) continue;
    groups.set(row.date, [...(groups.get(row.date) ?? []), row]);
  }

  const sortedDates = Array.from(groups.keys()).sort();

  return metrics.map((metric) => ({
    metric,
    points: sortedDates.map((date) => {
      const totals = calculateTotals(groups.get(date) ?? []);
      return {
        label: date,
        value: getMetricValue(totals, metric),
      };
    }),
  }));
}

export function buildBarChartData(
  breakdownRows: BreakdownRow[],
  primaryMetric: ReportMetricKey,
  limit = 8
): ChartPoint[] {
  return breakdownRows.slice(0, limit).map((row) => ({
    label: row.label,
    value: getMetricValue(row, primaryMetric),
  }));
}

export function buildReportChartData(params: {
  rows: NormalizedReportRow[];
  breakdownRows: BreakdownRow[];
  primaryMetric: ReportMetricKey;
  lineMetrics?: ReportMetricKey[];
}): ReportChartData {
  const lineMetrics = params.lineMetrics?.length
    ? params.lineMetrics
    : [params.primaryMetric];

  return {
    line: buildLineChartData(params.rows, lineMetrics),
    bars: buildBarChartData(params.breakdownRows, params.primaryMetric),
  };
}