import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type TranslatableIdCrossCheckConfig = {
  masterSpreadsheetId: string; // URL או ID
  masterTabName: string;       // למשל "Sheet1"
  masterTranslatableIdCol: number; // B = 1
  masterHotelCol: number;          // C = 2

  fixesSpreadsheetId: string;  // URL או ID
  fixesTabName: string;        // למשל "Sheet1"
  fixesTranslatableIdCol: number;  // B = 1
  fixesHotelCol: number;           // C = 2

  outputTitle?: string; // אופציונלי
};

type RowRef = { hotel: string; rowIndex: number };

export class TranslatableIdCrossCheckJob {
  constructor(private sheets: SheetsService) {}

  async run(cfg: TranslatableIdCrossCheckConfig): Promise<{ reportSpreadsheetId: string }> {
    console.log(chalk.blue("🧾 Starting TranslatableId CrossCheck..."));

    const masterId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);
    const fixesId = this.sheets.parseSpreadsheetId(cfg.fixesSpreadsheetId);

    // 1) Read Master + Fixes
    console.log(chalk.yellow("📥 Loading Master..."));
    const masterRows = await this.sheets.readValues(masterId, `${cfg.masterTabName}!A:Z`);

    console.log(chalk.yellow("📥 Loading Fixes..."));
    const fixesRows = await this.sheets.readValues(fixesId, `${cfg.fixesTabName}!A:Z`);

    // 2) Build maps: translatable_id -> {hotel,row}
    const masterMap = new Map<string, RowRef>();
    const fixesMap = new Map<string, RowRef>();

    const masterDuplicates: string[] = [];
    for (let r = 1; r < masterRows.length; r++) {
      const row = masterRows[r] ?? [];
      const tid = String(row[cfg.masterTranslatableIdCol] ?? "").trim();
      const hotel = String(row[cfg.masterHotelCol] ?? "").trim();
      if (!tid) continue;

      if (masterMap.has(tid)) masterDuplicates.push(tid);
      masterMap.set(tid, { hotel, rowIndex: r + 1 }); // +1 כי שורות שיט הן 1-based
    }

    const fixesDuplicates: string[] = [];
    for (let r = 1; r < fixesRows.length; r++) {
      const row = fixesRows[r] ?? [];
      const tid = String(row[cfg.fixesTranslatableIdCol] ?? "").trim();
      const hotel = String(row[cfg.fixesHotelCol] ?? "").trim();
      if (!tid) continue;

      if (fixesMap.has(tid)) fixesDuplicates.push(tid);
      fixesMap.set(tid, { hotel, rowIndex: r + 1 });
    }

    // 3) Produce report
    const allIds = new Set<string>([...masterMap.keys(), ...fixesMap.keys()]);

    let ok = 0;
    let missingInMaster = 0;
    let missingInFixes = 0;
    let hotelMismatch = 0;

    const report: string[][] = [
      [
        "status",
        "translatable_id",
        "master_hotel",
        "fixes_hotel",
        "master_row",
        "fixes_row",
        "note",
      ],
    ];

    for (const tid of Array.from(allIds).sort((a, b) => a.localeCompare(b))) {
      const m = masterMap.get(tid);
      const f = fixesMap.get(tid);

      if (!m) {
        missingInMaster++;
        report.push(["MISSING_IN_MASTER", tid, "", f?.hotel ?? "", "", String(f?.rowIndex ?? ""), ""]);
        continue;
      }
      if (!f) {
        missingInFixes++;
        report.push(["MISSING_IN_FIXES", tid, m.hotel, "", String(m.rowIndex), "", ""]);
        continue;
      }

      if ((m.hotel ?? "").trim() !== (f.hotel ?? "").trim()) {
        hotelMismatch++;
        report.push([
          "HOTEL_MISMATCH",
          tid,
          m.hotel,
          f.hotel,
          String(m.rowIndex),
          String(f.rowIndex),
          "Hotel name must match exactly",
        ]);
        continue;
      }

      ok++;
      report.push(["OK", tid, m.hotel, f.hotel, String(m.rowIndex), String(f.rowIndex), ""]);
    }

    // 4) Create output "work file"
    const today = new Date().toISOString().slice(0, 10);
    const title =
      cfg.outputTitle?.trim() ||
      `TranslatableId CrossCheck Report - ${today}`;

    console.log(chalk.yellow(`🆕 Creating report spreadsheet: ${title}`));
    const reportSpreadsheetId = await this.sheets.createSpreadsheet(title);

    // Write report to Sheet1
    await this.sheets.writeValues(reportSpreadsheetId, `Sheet1!A1`, report);

    // Also write a small summary block to the right
    const summary: string[][] = [
      ["metric", "value"],
      ["OK", String(ok)],
      ["MISSING_IN_MASTER", String(missingInMaster)],
      ["MISSING_IN_FIXES", String(missingInFixes)],
      ["HOTEL_MISMATCH", String(hotelMismatch)],
      ["MASTER_DUPLICATE_IDS", String(masterDuplicates.length)],
      ["FIXES_DUPLICATE_IDS", String(fixesDuplicates.length)],
    ];
    await this.sheets.writeValues(reportSpreadsheetId, `Sheet1!I1`, summary);

    if (masterDuplicates.length) {
      await this.sheets.writeValues(
        reportSpreadsheetId,
        `Sheet1!K2`,
        [["Master duplicate translatable_id list"], ...masterDuplicates.map(x => [x])]
      );
    }
    if (fixesDuplicates.length) {
      await this.sheets.writeValues(
        reportSpreadsheetId,
        `Sheet1!L2`,
        [["Fixes duplicate translatable_id list"], ...fixesDuplicates.map(x => [x])]
      );
    }

    console.log(chalk.green("✅ Report created successfully."));
    console.log(chalk.cyan(`Report Spreadsheet ID: ${reportSpreadsheetId}`));

    return { reportSpreadsheetId };
  }
}