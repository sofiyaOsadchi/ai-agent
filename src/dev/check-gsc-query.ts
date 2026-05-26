import "dotenv/config";
import { google } from "googleapis";

const credentialsPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "./src/credentials/service-account.json";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

async function main(): Promise<void> {
  const siteUrl = process.env.GSC_SITE_URL;

  if (!siteUrl) {
    throw new Error("Missing GSC_SITE_URL in .env");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  const searchconsole = google.searchconsole({
    version: "v1",
    auth,
  });

  // Search Console data usually has a delay, so we avoid today's date.
  const startDate = daysAgo(35);
  const endDate = daysAgo(3);

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: 25,
      startRow: 0,
    },
  });

  const rows = response.data.rows || [];

  console.log(`GSC siteUrl: ${siteUrl}`);
  console.log(`Date range: ${startDate} to ${endDate}`);
  console.log(`Rows returned: ${rows.length}`);

  if (!rows.length) {
    console.log("No Search Console rows returned for this date range.");
    return;
  }

  console.table(
    rows.map((row) => ({
      query: row.keys?.[0] || "",
      page: row.keys?.[1] || "",
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr ? `${(row.ctr * 100).toFixed(2)}%` : "0.00%",
      position: row.position ? row.position.toFixed(2) : "0.00",
    }))
  );
}

main().catch((error) => {
  console.error("Search Console query check failed:");
  console.error(error?.message || error);
  process.exit(1);
});