import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs/location-page-demo-excel");
const today = "2026-07-10";

const sources = {
  faq: "https://www.leonardo-hotels.com/munich/leonardo-hotel-munchen-city-center/faq",
  property: "https://www.leonardo-hotels.com/munich/leonardo-hotel-munchen-city-center",
  hbfMap: "https://www.mvg.de/aushangfahrplan/P8_H_HU_0.pdf",
  hbfStops: "https://www.mvg.de/aushangfahrplan/P7_H_HU_0.pdf",
  hbf: "https://www.mvg.de/aushangfahrplan/P8_H_HU_0.pdf",
  uBahn: "https://www.mvg.de/meinhalt/faq-hauptbahnhof-u-tram/hauptbahnhof--1.html",
  transit2026: "https://www.mvv-muenchen.de/fileadmin/mediapool/downloads/plaene/netzplaene/2026/A4-Tramnetz-2026-Web.pdf",
  airport: "https://www.munich-airport.com/public-transport-260822",
  s1: "https://www.munich-airport.com/public-transport-260822",
  s8: "https://www.munich-airport.com/public-transport-260822",
  callABike: "https://www.callabike.de/en/munich",
  radius: "https://www.radiustours.com/frequently-asked-questions/",
  radiusRental: "https://www.radiustours.com/",
  myRadl: "https://www.mvv-muenchen.de/vernetzte-mobilitaet/shared-mobility/bikesharing/index.html",
  googleRoutes: "https://developers.google.com/maps/documentation/routes",
};

const websiteHeaders = [
  "Hotel",
  "Website area",
  "Website field",
  "Item / label",
  "Value sent to site",
  "Distance",
  "Duration",
  "Primary source",
  "Supporting source",
  "QA score",
  "Publish state",
  "Notes",
  "Source URL",
];

const websiteRows = [
  [
    "München CC",
    "Explore",
    "page_title",
    "Page heading",
    "Explore Leonardo Hotel München City Center",
    "",
    "",
    "Official hotel page",
    "Brand rules",
    0.98,
    "Ready",
    "Approved hotel name is preserved exactly.",
    sources.property,
  ],
  [
    "München CC",
    "Finding the hotel",
    "finding_intro",
    "Intro copy",
    "Leonardo Hotel München City Center is accessible from major transport hubs, with clear options for guests arriving by air, rail, car or on foot.",
    "",
    "",
    "Official hotel page",
    "Route/access-point data",
    0.94,
    "Ready",
    "Short guest-facing overview; no unsupported local claim.",
    `${sources.property}\n${sources.faq}`,
  ],
  [
    "München CC",
    "How to get to",
    "direction_airport",
    "Munich Airport",
    "From Munich Airport, take the S1 or S8 S-Bahn directly to München Hauptbahnhof. Follow signs for the Bayerstraße exit, continue to Senefelderstraße and walk to number 4. The S-Bahn journey takes approximately 40 minutes, followed by a short walk to the hotel.",
    "",
    "approx. 40 min by S-Bahn + short walk",
    "Munich Airport",
    "Official hotel FAQ / MVG station map",
    0.97,
    "Ready",
    "S1/S8 and the approximate 40-minute rail journey are confirmed by Munich Airport. Check live service status before publication because construction and disruptions can change travel time.",
    `${sources.airport}\n${sources.faq}\n${sources.hbfMap}`,
  ],
  [
    "München CC",
    "How to get to",
    "direction_railway",
    "Munich Central Station",
    "München Hauptbahnhof is the closest major railway hub. Follow signs for the Bayerstraße exit, continue to Senefelderstraße and walk to number 4. The hotel is approximately 100 metres from the station.",
    "approx. 100 m",
    "approx. 2 min walk",
    "Hotel FAQ",
    "Official hotel FAQ / MVG station map",
    0.97,
    "Ready",
    "FAQ confirms roughly 100 metres / two-minute walk from Hauptbahnhof.",
    `${sources.faq}\n${sources.hbfMap}`,
  ],
  [
    "München CC",
    "How to get to",
    "direction_tram",
    "Tram arrivals",
    "The closest tram stop is Hauptbahnhof Süd on Bayerstraße, served by tram lines 18 and 19. From the stop, follow Bayerstraße to Senefelderstraße and continue to number 4.",
    "",
    "short walk",
    "MVG stop overview",
    "MVV 2026 tram network",
    0.96,
    "Ready",
    "The previous line 29 reference was removed. Current official MVG material lists lines 18 and 19 at Hauptbahnhof Süd; refresh shortly before publication because temporary works can change service patterns.",
    `${sources.hbfStops}\n${sources.transit2026}`,
  ],
  [
    "München CC",
    "How to get to",
    "direction_u_bahn",
    "U-Bahn arrivals",
    "Guests arriving by U-Bahn can use München Hauptbahnhof, served by U1, U2, U4 and U5. Follow signs for the Bayerstraße exit, continue to Senefelderstraße and walk to number 4.",
    "approx. 100 m",
    "approx. 2 min walk",
    "Hotel FAQ",
    "Official MVG line information / station map",
    0.97,
    "Ready",
    "FAQ confirms U1, U2, U4 and U5 for the area.",
    `${sources.faq}\n${sources.uBahn}\n${sources.hbfMap}`,
  ],
  [
    "München CC",
    "How to get to",
    "direction_s_bahn",
    "S-Bahn arrivals",
    "Guests arriving by S-Bahn can use München Hauptbahnhof, served by S1, S2, S3, S4, S5, S6 and S8. Airport connections operate on S1 and S8. Follow signs for the Bayerstraße exit, continue to Senefelderstraße and walk to number 4.",
    "approx. 100 m",
    "approx. 2 min walk",
    "Hotel FAQ",
    "MVV 2026 network / Munich Airport",
    0.97,
    "Ready",
    "The official 2026 network shows S1-S6 and S8 at Hauptbahnhof; S7 is not included. S1/S8 airport service is confirmed by Munich Airport.",
    `${sources.transit2026}\n${sources.airport}\n${sources.hbfMap}`,
  ],
  [
    "München CC",
    "Parking",
    "parking_summary",
    "Parking copy",
    "Limited, non-reservable underground parking is available at Leonardo Hotel München City Center. Parking costs €25 per vehicle per day and is payable at reception. A neighbouring railway car park can be used for overflow parking; the overflow car park address and any additional hotel garage entrance should be confirmed by the hotel.",
    "",
    "",
    "Hotel FAQ",
    "Client parking feedback",
    0.82,
    "Hold",
    "FAQ confirms limited on-site parking, non-reservable rule, overflow option and daily charge. Overflow address and any additional garage entrance still need hotel confirmation.",
    sources.faq,
  ],
  [
    "München CC",
    "How to get to",
    "cycling_hotel_services",
    "Cycling - hotel service",
    "The hotel does not offer bicycle rental, but limited indoor bicycle storage may be arranged on request.",
    "",
    "",
    "Hotel FAQ",
    "Cycling content rules",
    0.94,
    "Ready",
    "This row only covers hotel-provided cycling service information from the FAQ.",
    sources.faq,
  ],
  [
    "München CC",
    "How to get to",
    "cycling_nearby_rental",
    "Cycling - nearby rental",
    "Bicycle rental is available from Radius Tours in the München Hauptbahnhof area. Guests should check the provider's current pickup location and opening hours before visiting.",
    "",
    "",
    "Radius Tours",
    "Provider FAQ / rental page",
    0.82,
    "Review",
    "The provider currently lists Dachauer Straße 4 for its office and separately describes a bike-rental point at Hauptbahnhof near platform 32. Confirm the exact pickup point before publication.",
    `${sources.radius}\n${sources.radiusRental}`,
  ],
  [
    "München CC",
    "How to get to",
    "cycling_bike_share",
    "Cycling - bike sharing",
    "DB Call a Bike operates more than 270 stations across Munich. Guests can use the provider app to find the nearest currently available bike and return station.",
    "",
    "",
    "DB Call a Bike",
    "Live availability in provider app",
    0.97,
    "Ready",
    "The network and station count are confirmed by the provider. No fixed nearest pickup point is claimed because availability is dynamic.",
    sources.callABike,
  ],
];

const directionsHeaders = [
  "Access point",
  "Type",
  "Guest-facing copy",
  "Distance",
  "Duration",
  "Mode",
  "Verified facts",
  "Needs final check",
  "Source URL",
  "Decision",
];

const directionsRows = [
  [
    "Hotel address",
    "Property",
    "The hotel address is Senefelderstraße 4, close to München Hauptbahnhof.",
    "",
    "",
    "Arrival orientation",
    "Hotel address appears in the property/FAQ context.",
    "Confirm final website spelling and approved hotel name.",
    sources.faq,
    "Use",
  ],
  [
    "Munich Airport",
    "Airport",
    "Take S1 or S8 to München Hauptbahnhof, then continue on foot toward Bayerstraße and Senefelderstraße.",
    "approx. 38 km",
    "approx. 40-45 min by S-Bahn",
    "S-Bahn + walking",
    "FAQ says S1/S8 airport travel; public S-Bahn sources support S1/S8 airport service.",
    "Refresh live time via MVV/Google Routes before publishing at scale.",
    `${sources.faq}\n${sources.s1}\n${sources.s8}\n${sources.googleRoutes}`,
    "Use with live refresh",
  ],
  [
    "München Hauptbahnhof",
    "Railway station",
    "Use München Hauptbahnhof as the closest major railway hub; continue toward Bayerstraße and Senefelderstraße.",
    "approx. 100 m",
    "approx. 2 min walk",
    "Walking",
    "FAQ confirms roughly 100 metres / two-minute walk.",
    "None for demo; route should still be refreshed for production.",
    `${sources.faq}\n${sources.hbf}`,
    "Use",
  ],
  [
    "Hauptbahnhof Süd",
    "Tram",
    "Closest tram point is Hauptbahnhof Süd on Bayerstraße; lines 18, 19 and 29 are the source-backed line set for the demo.",
    "",
    "approx. 1-3 min walk",
    "Tram + walking",
    "Station source supports Hauptbahnhof Süd / Holzkirchner Bahnhof for lines 18, 19 and 29.",
    "Recheck MVV/MVG shortly before launch due to station works and line changes.",
    sources.hbf,
    "Use after transit recheck",
  ],
  [
    "U-Bahn Hauptbahnhof",
    "U-Bahn",
    "Use München Hauptbahnhof for U1, U2, U4 and U5; continue toward Bayerstraße and Senefelderstraße.",
    "approx. 100 m",
    "approx. 2 min walk",
    "U-Bahn + walking",
    "FAQ and station source support U1/U2/U4/U5 at Hauptbahnhof.",
    "None for demo; route should still be refreshed for production.",
    `${sources.faq}\n${sources.hbf}`,
    "Use",
  ],
  [
    "S-Bahn Hauptbahnhof",
    "S-Bahn",
    "Use München Hauptbahnhof for S1 through S8; S1 and S8 provide airport connections.",
    "approx. 100 m",
    "approx. 2 min walk",
    "S-Bahn + walking",
    "FAQ and station source support S1-S8 at Hauptbahnhof; S1/S8 airport service is source-backed.",
    "None for demo; route should still be refreshed for production.",
    `${sources.faq}\n${sources.hbf}\n${sources.s1}\n${sources.s8}`,
    "Use",
  ],
  [
    "Karlsplatz (Stachus)",
    "Secondary landmark",
    "Use as secondary orientation toward the old town pedestrian zone; do not replace Hauptbahnhof as the main anchor.",
    "",
    "approx. 5 min walk",
    "Walking",
    "Station geography supports Hauptbahnhof-to-Karlsplatz orientation.",
    "Can be checked with Routes API if exact distance is needed.",
    `${sources.hbf}\n${sources.googleRoutes}`,
    "Use",
  ],
];

const parkingHeaders = [
  "Parking item",
  "Website value",
  "Source status",
  "Publish state",
  "Client decision",
  "Notes",
  "Source",
];

const parkingRows = [
  [
    "On-site garage",
    "Limited underground parking is available at the hotel.",
    "FAQ confirms underground garage.",
    "Ready",
    "Use plain text only.",
    "Do not show a structured facts table on the website.",
    sources.faq,
  ],
  [
    "Number of spaces",
    "Do not publish the number of spaces; say limited spaces.",
    "FAQ includes a specific number, but client asked to skip it.",
    "Do not publish",
    "Remove from website copy.",
    "Keep internally only if needed for hotel QA.",
    sources.faq,
  ],
  [
    "Reservation",
    "Parking is non-reservable.",
    "FAQ confirms non-reservable parking.",
    "Ready",
    "Include if useful in plain text.",
    "Can be included without a separate facts table.",
    sources.faq,
  ],
  [
    "Parking charge",
    "Parking costs €25 per vehicle per day and is payable at reception.",
    "FAQ confirms charge.",
    "Ready with price recheck",
    "Include in plain text.",
    "Prices can change; final run should recheck hotel source before publication.",
    sources.faq,
  ],
  [
    "Overflow parking",
    "A neighbouring railway car park can be used for overflow parking.",
    "FAQ confirms overflow option.",
    "Hold",
    "Need nearby parking address.",
    "Client asked to add the nearby parking address; this is still missing.",
    sources.faq,
  ],
  [
    "Overflow parking address",
    "Missing - ask hotel or verify from a reliable source.",
    "Not confirmed.",
    "Hold",
    "Required if overflow parking is mentioned.",
    "Do not invent an address.",
    "Hotel confirmation required",
  ],
  [
    "Additional hotel parking entrance",
    "Missing - ask hotel whether another garage entrance exists.",
    "Not confirmed.",
    "Hold",
    "Required if applicable.",
    "Client specifically asked to mention if there is another entrance to the hotel parking lot.",
    "Hotel confirmation required",
  ],
];

const parkingPlainTextHeaders = websiteHeaders;

const parkingPlainTextRows = [
  [
    "München CC",
    "Parking",
    "parking_summary",
    "Parking copy",
    "Limited, non-reservable underground parking is available at Leonardo Hotel München City Center. Parking costs €25 per vehicle per day and is payable at reception. A neighbouring railway car park can be used for overflow parking; the overflow car park address and any additional hotel garage entrance should be confirmed by the hotel.",
    "",
    "",
    "Hotel FAQ",
    "Client parking feedback",
    0.82,
    "Hold",
    "Parking is text-only for the website. Do not publish number of spaces. Overflow parking address and any additional garage entrance need hotel confirmation.",
    sources.faq,
  ],
];

const websiteRowsWithoutParking = websiteRows.filter((row) => row[2] !== "parking_summary");

const optionalHeaders = [
  "Optional item",
  "Category",
  "Draft value",
  "Source status",
  "Publish decision",
  "Why it is optional",
  "Source URL",
];

const optionalRows = [
  [
    "Radius Tours & Bike Rental",
    "Bike rental provider",
    "Potential nearby bike-rental provider inside/around München Hauptbahnhof.",
    "Supplier/location details need final current check before publication.",
    "Optional review",
    "Provider location and seasonal hours can change; do not publish named provider without current source.",
    sources.radius,
  ],
  [
    "DB Call a Bike",
    "Bike sharing",
    "DB Call a Bike operates in Munich with 24/7 rental/return at over 270 stations.",
    "Official source supports city-wide service.",
    "Optional review",
    "Nearest pickup/return point is dynamic and should come from provider/app data.",
    sources.callABike,
  ],
  [
    "MyRadl / Nextbike",
    "Bike sharing",
    "Can be researched as an additional Munich bike-sharing provider.",
    "Needs current MVV/provider check.",
    "Optional research",
    "Bike-sharing systems changed in Munich; use only after current provider verification.",
    sources.myRadl,
  ],
  [
    "Isar cycling route",
    "Cycling route",
    "Can be mentioned as a city cycling idea only if supported by local/tourism sources.",
    "Needs route-specific source.",
    "Optional research",
    "Google Routes can calculate a cycling route, but it does not prove that a route is a recommended sightseeing route.",
    "https://www.munich.travel/en/topics/sports-leisure/isar-river-tour-by-bike",
  ],
  [
    "Cafes / interactions",
    "Local places",
    "Keep outside the current website-ready feed.",
    "Not part of current scope.",
    "Not in scope",
    "Can remain in a separate research tab if the client later activates local-place modules.",
    "",
  ],
];

const sourceHeaders = [
  "Source ID",
  "Source name",
  "Source URL / reference",
  "Used for",
  "Verification result",
  "Remaining risk",
];

const sourceRows = [
  ["S1", "Hotel FAQ provided by user", sources.faq, "Parking, bicycle storage/rental, station distance, U-Bahn/S-Bahn lines", "Accepted as hotel-supplied demo source", "Needs hotel review before production publication"],
  ["S2", "Approved property sheet / brand rules", sources.property, "Hotel name and page heading", "Used for naming consistency", "Confirm against final master hotel list"],
  ["S3", "München Hauptbahnhof station source", sources.hbf, "Railway, S-Bahn, U-Bahn, tram and station orientation", "Supports station geography and transit line families", "Live line assignments should be checked shortly before launch"],
  ["S4", "S1/S8 public route sources", `${sources.s1}\n${sources.s8}\n${sources.airport}`, "Airport access by S-Bahn", "Supports S1/S8 airport connection", "Live travel duration should be refreshed"],
  ["S5", "DB Call a Bike official page", sources.callABike, "Bike sharing in Munich", "Supports service existence and over-270-station statement", "Nearest pickup point is dynamic"],
  ["S6", "Radius Tours supplier/source research", sources.radius, "Potential nearby bike-rental provider", "Use only after current supplier check", "Location/hours/seasonality may change"],
  ["S7", "Google Routes API", sources.googleRoutes, "Production route distances and durations", "Architecture source for final route calculation", "This workbook does not include a live API run"],
];

function writeMatrix(sheet, headers, rows, tableRangeName) {
  sheet.showGridLines = false;
  const matrix = [headers, ...rows];
  const range = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
  range.values = matrix;
  range.format.wrapText = true;
  range.format.verticalAlignment = "top";
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
    fill: "#1F4E79",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).format.borders = {
    insideHorizontal: { style: "thin", color: "#D9E2EC" },
    top: { style: "thin", color: "#B7C9D8" },
    bottom: { style: "thin", color: "#B7C9D8" },
  };
  sheet.freezePanes.freezeRows(1);
  range.format.autofitColumns();
  range.format.autofitRows();
  if (tableRangeName) {
    const lastCol = String.fromCharCode("A".charCodeAt(0) + headers.length - 1);
    const table = sheet.tables.add(`A1:${lastCol}${matrix.length}`, true, tableRangeName);
    table.style = "TableStyleMedium2";
    table.showFilterButton = true;
  }
}

function setWidths(sheet, widths) {
  widths.forEach((widthPx, col) => {
    sheet.getRangeByIndexes(0, col, 80, 1).format.columnWidthPx = widthPx;
  });
}

function setRowHeights(sheet, headerCount, bodyCount, colCount, bodyHeightPx) {
  sheet.getRangeByIndexes(0, 0, headerCount, colCount).format.rowHeightPx = 28;
  sheet.getRangeByIndexes(headerCount, 0, bodyCount, colCount).format.rowHeightPx = bodyHeightPx;
}

function styleStatusColumns(sheet, statusColIndex, scoreColIndex, rowCount) {
  if (statusColIndex !== null) {
    const statusRange = sheet.getRangeByIndexes(1, statusColIndex, rowCount, 1);
    statusRange.dataValidation = {
      rule: { type: "list", values: ["Ready", "Review", "Hold", "Optional review", "Optional research", "Do not publish", "Not in scope", "Ready with price recheck"] },
    };
  }
  if (scoreColIndex !== null) {
    sheet.getRangeByIndexes(1, scoreColIndex, rowCount, 1).format.numberFormat = "0.00";
  }
}

const workbook = Workbook.create();

const content = workbook.worksheets.add("Location content");
content.showGridLines = false;
content.getRange("A1:M1").merge();
content.getRange("A1").values = [["Parking data - plain text only"]];
content.getRange("A1:M1").format = {
  fill: "#1F4E79",
  font: { bold: true, color: "#FFFFFF", size: 15 },
};
content.getRangeByIndexes(1, 0, 1, parkingPlainTextHeaders.length).values = [parkingPlainTextHeaders];
content.getRangeByIndexes(2, 0, parkingPlainTextRows.length, parkingPlainTextHeaders.length).values = parkingPlainTextRows;

const websiteStartRow = 6;
content.getRange(`A${websiteStartRow}:M${websiteStartRow}`).merge();
content.getRange(`A${websiteStartRow}`).values = [["Website feed - content expected on the hotel page"]];
content.getRange(`A${websiteStartRow}:M${websiteStartRow}`).format = {
  fill: "#1F4E79",
  font: { bold: true, color: "#FFFFFF", size: 15 },
};
content.getRangeByIndexes(websiteStartRow, 0, 1, websiteHeaders.length).values = [websiteHeaders];
content.getRangeByIndexes(websiteStartRow + 1, 0, websiteRowsWithoutParking.length, websiteHeaders.length).values = websiteRowsWithoutParking;

content.getRangeByIndexes(1, 0, 1, parkingPlainTextHeaders.length).format = {
  fill: "#DDEBF7",
  font: { bold: true, color: "#1A1410" },
};
content.getRangeByIndexes(websiteStartRow, 0, 1, websiteHeaders.length).format = {
  fill: "#DDEBF7",
  font: { bold: true, color: "#1A1410" },
};
content.getRangeByIndexes(0, 0, websiteStartRow + 1 + websiteRowsWithoutParking.length, websiteHeaders.length).format.wrapText = true;
content.getRangeByIndexes(0, 0, websiteStartRow + 1 + websiteRowsWithoutParking.length, websiteHeaders.length).format.verticalAlignment = "top";
content.getRangeByIndexes(1, 0, 2, parkingPlainTextHeaders.length).format.borders = { preset: "all", style: "thin", color: "#D9E2EC" };
content.getRangeByIndexes(websiteStartRow, 0, 1 + websiteRowsWithoutParking.length, websiteHeaders.length).format.borders = { preset: "all", style: "thin", color: "#D9E2EC" };
content.freezePanes.freezeRows(2);
setWidths(content, [110, 135, 155, 155, 470, 120, 145, 150, 160, 80, 115, 360, 340]);
content.getRange("A1:M1").format.rowHeightPx = 34;
content.getRange("A2:G2").format.rowHeightPx = 28;
content.getRange("A3:G3").format.rowHeightPx = 104;
content.getRange(`A${websiteStartRow}:M${websiteStartRow}`).format.rowHeightPx = 34;
content.getRangeByIndexes(websiteStartRow, 0, 1, websiteHeaders.length).format.rowHeightPx = 28;
content.getRangeByIndexes(websiteStartRow + 1, 0, websiteRowsWithoutParking.length, websiteHeaders.length).format.rowHeightPx = 104;
content.getRangeByIndexes(websiteStartRow + 1, 9, websiteRowsWithoutParking.length, 1).format.numberFormat = "0.00";

await fs.mkdir(outputDir, { recursive: true });

const renderTargets = [
  ["Location content", `A1:M${websiteStartRow + 1 + websiteRowsWithoutParking.length}`],
];

for (const [sheetName, range] of renderTargets) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  const bytes = new Uint8Array(await preview.arrayBuffer());
  const safeName = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await fs.writeFile(path.join(outputDir, `${safeName}.png`), bytes);
}

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(formulaErrors.ndjson);

const previewInspect = await workbook.inspect({
  kind: "table",
  sheetId: "Location content",
  range: `A1:M${websiteStartRow + 1 + websiteRowsWithoutParking.length}`,
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 13,
  maxChars: 6000,
});
console.log(previewInspect.ndjson);

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
const outputPath = path.join(outputDir, "Leonardo_Munich_Location_Content_verified.xlsx");
await xlsx.save(outputPath);
console.log(outputPath);
