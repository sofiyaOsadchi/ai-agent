import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type TidHotelInQuestionCrossCheckConfig = {
  masterSpreadsheetId: string; // URL או ID
  masterTabName: string;
  masterTranslatableIdCol: number; // B = 1
  masterHotelCol: number;          // C = 2

  fixesSpreadsheetId: string; // URL או ID
  fixesTabName: string;
  fixesTranslatableIdCol: number; // B = 1
  fixesQuestionCol: number;       // C = 2

  outputTitle?: string;
};

type MasterRef = { hotel: string; rowIndex: number };

export class TidHotelInQuestionCrossCheckJob {
  constructor(private sheets: SheetsService) {}

  private normalizeForContains(s: string): string {
    if (!s) return "";
    // Lowercase + remove punctuation/extra spaces, keep letters/numbers (including accented)
    return s
      .toLowerCase()
      .replace(/<\/?[^>]+(>|$)/g, " ") // strip basic HTML tags if they exist
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async run(cfg: TidHotelInQuestionCrossCheckConfig): Promise<{ reportSpreadsheetId: string }> {
    console.log(chalk.blue("🧾 Starting TID -> HotelName-in-Question CrossCheck..."));

    const masterId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);
    const fixesId = this.sheets.parseSpreadsheetId(cfg.fixesSpreadsheetId);

    console.log(chalk.yellow("📥 Loading Master..."));
    const masterRows = await this.sheets.readValues(masterId, `${cfg.masterTabName}!A:Z`);

    console.log(chalk.yellow("📥 Loading Fixes..."));
    const fixesRows = await this.sheets.readValues(fixesId, `${cfg.fixesTabName}!A:Z`);

    // Build master map: translatable_id -> hotel name
    const masterMap = new Map<string, MasterRef>();
    const masterDuplicates: string[] = [];

    for (let r = 1; r < masterRows.length; r++) {
      const row = masterRows[r] ?? [];
      const tid = String(row[cfg.masterTranslatableIdCol] ?? "").trim();
      const hotel = String(row[cfg.masterHotelCol] ?? "").trim();
      if (!tid) continue;

      if (masterMap.has(tid)) masterDuplicates.push(tid);
      masterMap.set(tid, { hotel, rowIndex: r + 1 }); // sheet rows are 1-based
    }

    // Report
    let ok = 0;
    let missingInMaster = 0;
    let hotelMissingInMasterRow = 0;
    let hotelNotInQuestion = 0;
    let emptyTidInFixes = 0;

    const report: string[][] = [
      [
        "status",
        "translatable_id",
        "master_hotel",
        "question",
        "master_row",
        "fixes_row",
        "note",
      ],
    ];

    for (let r = 1; r < fixesRows.length; r++) {
      const row = fixesRows[r] ?? [];
      const tid = String(row[cfg.fixesTranslatableIdCol] ?? "").trim();
      const question = String(row[cfg.fixesQuestionCol] ?? "").trim();

      if (!tid) {
        emptyTidInFixes++;
        report.push(["EMPTY_TID_IN_FIXES", "", "", question, "", String(r + 1), "Fixes row missing translatable_id"]);
        continue;
      }

      const master = masterMap.get(tid);
      if (!master) {
        missingInMaster++;
        report.push(["MISSING_IN_MASTER", tid, "", question, "", String(r + 1), "translatable_id not found in Master"]);
        continue;
      }

      const hotel = (master.hotel ?? "").trim();
      if (!hotel) {
        hotelMissingInMasterRow++;
        report.push(["EMPTY_HOTEL_IN_MASTER", tid, "", question, String(master.rowIndex), String(r + 1), "Master hotel cell is empty"]);
        continue;
      }

      const hotelNorm = this.normalizeForContains(hotel);
      const questionNorm = this.normalizeForContains(question);

      const contains = hotelNorm !== "" && questionNorm.includes(hotelNorm);

      if (!contains) {
        hotelNotInQuestion++;
        report.push([
          "HOTEL_NOT_IN_QUESTION",
          tid,
          hotel,
          question,
          String(master.rowIndex),
          String(r + 1),
          "Hotel name from Master does not appear in question text",
        ]);
        continue;
      }

      ok++;
      report.push(["OK", tid, hotel, question, String(master.rowIndex), String(r + 1), ""]);
    }

    const today = new Date().toISOString().slice(0, 10);
    const title = cfg.outputTitle?.trim() || `TID Hotel-in-Question CrossCheck - ${today}`;

    console.log(chalk.yellow(`🆕 Creating report spreadsheet: ${title}`));
    const reportSpreadsheetId = await this.sheets.createSpreadsheet(title);

    await this.sheets.writeValues(reportSpreadsheetId, `Sheet1!A1`, report);

    const summary: string[][] = [
      ["metric", "value"],
      ["OK", String(ok)],
      ["MISSING_IN_MASTER", String(missingInMaster)],
      ["EMPTY_HOTEL_IN_MASTER", String(hotelMissingInMasterRow)],
      ["HOTEL_NOT_IN_QUESTION", String(hotelNotInQuestion)],
      ["EMPTY_TID_IN_FIXES", String(emptyTidInFixes)],
      ["MASTER_DUPLICATE_IDS", String(masterDuplicates.length)],
    ];
    await this.sheets.writeValues(reportSpreadsheetId, `Sheet1!I1`, summary);

    if (masterDuplicates.length) {
      await this.sheets.writeValues(
        reportSpreadsheetId,
        `Sheet1!K2`,
        [["Master duplicate translatable_id list"], ...masterDuplicates.map(x => [x])]
      );
    }

    console.log(chalk.green("✅ Report created successfully."));
    console.log(chalk.cyan(`Report Spreadsheet ID: ${reportSpreadsheetId}`));

    return { reportSpreadsheetId };
  }
}