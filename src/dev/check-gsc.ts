import "dotenv/config";
import { google } from "googleapis";

const credentialsPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "./src/credentials/service-account.json";

async function main(): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  const searchconsole = google.searchconsole({
    version: "v1",
    auth,
  });

  const sitesResponse = await searchconsole.sites.list();
  const sites = sitesResponse.data.siteEntry || [];

  console.log(`Sites returned: ${sites.length}`);

  if (!sites.length) {
    console.log("No Search Console properties found for this service account.");
    console.log("Make sure the service account was added in Search Console settings.");
    return;
  }

  console.table(
    sites.map((site) => ({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel,
    }))
  );
}

main().catch((error) => {
  console.error("Search Console check failed:");
  console.error(error?.message || error);
  process.exit(1);
});