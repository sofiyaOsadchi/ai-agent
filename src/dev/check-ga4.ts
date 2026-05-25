import "dotenv/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

type ReportRow = {
  pagePath: string;
  pageTitle: string;
  views: number;
  activeUsers: number;
  sessions: number;
};

function getDimension(row: any, index: number): string {
  return row.dimensionValues?.[index]?.value || "";
}

function getMetric(row: any, index: number): number {
  const value = row.metricValues?.[index]?.value || "0";
  return Number(value);
}

async function main(): Promise<void> {
  const propertyId = process.env.GA4_PROPERTY_ID;

  if (!propertyId) {
    throw new Error("Missing GA4_PROPERTY_ID in .env");
  }

  const analyticsClient = new BetaAnalyticsDataClient();

  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: "7daysAgo",
        endDate: "today",
      },
    ],
    dimensions: [
      { name: "pagePathPlusQueryString" },
      { name: "pageTitle" },
    ],
    metrics: [
      { name: "screenPageViews" },
      { name: "activeUsers" },
      { name: "sessions" },
    ],
    orderBys: [
      {
        metric: {
          metricName: "screenPageViews",
        },
        desc: true,
      },
    ],
    limit: 10,
  });

  const rows: ReportRow[] = (response.rows || []).map((row: any) => ({
    pagePath: getDimension(row, 0),
    pageTitle: getDimension(row, 1),
    views: getMetric(row, 0),
    activeUsers: getMetric(row, 1),
    sessions: getMetric(row, 2),
  }));

  console.log(`GA4 property: ${propertyId}`);
  console.log(`Rows returned: ${rows.length}`);

  if (rows.length === 0) {
    console.log("No data returned for the selected date range.");
    return;
  }

  console.table(rows);
}

main().catch((error) => {
  console.error("GA4 check failed:");
  console.error(error?.message || error);
  process.exit(1);
});