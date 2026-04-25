import chalk from "chalk";
import { SheetsService } from "../services/sheets.js";

export type MasterCoverageSourceSheet = {
  spreadsheet: string;
  tab?: string;
  hotelNameExact?: string;
};

export type MasterCoverageFromSheetsConfig = {
  masterSpreadsheetId: string;
  sourceFolderRecursive?: boolean;
  masterTabName: string;
  masterHotelCol: number;
  masterQuestionCol: number;

  sourceFolderId?: string;
  sourceSheets?: MasterCoverageSourceSheet[];
  sourceTabName?: string;
  sourceQuestionCol: number;
  sourceHotelCol?: number;

  reportTabName?: string;
  summaryOnly?: boolean;
  writeReport?: boolean;
  strictHotelNameMatch?: boolean;
  ignoreQuestionsContaining?: string[];
  failIfMissing?: boolean;
};

type MissingRow = {
  hotel: string;
  sourceFileName: string;
  sourceSpreadsheetId: string;
  sourceTabName: string;
  question: string;
  normalizedQuestion: string;
  matchedBy: string;
};

export class MasterCoverageFromSheetsJob {
  constructor(private sheets: SheetsService) {}

  private readonly DEFAULT_IGNORE = [
    "meta description",
    "find answers to frequently asked questions",
    "faq schema",
    "json-ld",
    "category",
    "question",
    "answer",
    "frequency",
  ];

private parseDriveFolderId(input: string): string {
  const trimmed = String(input ?? "").trim();

  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  const match =
    trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);

  if (!match) {
    throw new Error(`Cannot parse folderId from: ${input}`);
  }

  return match[1];
}

private normalizeTabTitle(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[‐-‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

private async resolveSourceTabTitle(spreadsheetId: string, preferredTab?: string): Promise<string> {
  const titles = await this.sheets.listSheetTitles(spreadsheetId);

  if (!titles.length) {
    throw new Error(`No tabs found in spreadsheet ${spreadsheetId}`);
  }

  if (!preferredTab?.trim()) {
    return titles[0];
  }

  const preferredNorm = this.normalizeTabTitle(preferredTab);

  const exact = titles.find(
    (title) => this.normalizeTabTitle(title) === preferredNorm
  );
  if (exact) return exact;

  const heTab = titles.find((title) => {
    const norm = this.normalizeTabTitle(title);
    return norm.includes("sheet1") && norm.includes("he");
  });
  if (heTab) return heTab;

  return titles[0];
}

 private normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/["'`´‘’“”״׳]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

  private normalizeQuestion(value: string): string {
    return this.normalizeText(value)
      .replace(/\b(the|a|an)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalizeHotel(value: string): string {
    return this.normalizeText(value)
      .replace(/\bhotel\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private shouldIgnore(question: string, extraIgnore: string[]): boolean {
    const raw = String(question ?? "").trim();
    if (!raw) return true;

    const norm = this.normalizeText(raw);
    if (!norm) return true;

    return extraIgnore.some((phrase) => norm.includes(this.normalizeText(phrase)));
  }

  private columnIndexToLetter(index: number): string {
    let current = index;
    let letter = "";
    while (current >= 0) {
      const temp = current % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      current = Math.floor(current / 26) - 1;
    }
    return letter;
  }

  private quoteA1Sheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  private resolveHotelName(args: {
    explicitHotelName?: string;
    fileName: string;
    rowHotel?: string;
  }): { hotelName: string; matchedBy: string } {
    if (args.explicitHotelName?.trim()) {
      return { hotelName: args.explicitHotelName.trim(), matchedBy: "explicit config" };
    }
    if (args.rowHotel?.trim()) {
      return { hotelName: args.rowHotel.trim(), matchedBy: "source row hotel column" };
    }
    return { hotelName: args.fileName.trim(), matchedBy: "source file name" };
  }

  private findBestHotelMatch(
    candidate: string,
    masterHotels: string[],
    strict: boolean,
  ): { hotel: string; matchedBy: string } | null {
    const normCandidate = this.normalizeHotel(candidate);
    if (!normCandidate) return null;

    for (const hotel of masterHotels) {
      if (this.normalizeHotel(hotel) === normCandidate) {
        return { hotel, matchedBy: "exact normalized hotel" };
      }
    }

    if (strict) return null;

    const sorted = [...masterHotels].sort((a, b) => this.normalizeHotel(b).length - this.normalizeHotel(a).length);
    for (const hotel of sorted) {
      const normHotel = this.normalizeHotel(hotel);
      if (!normHotel) continue;
      if (normCandidate.includes(normHotel) || normHotel.includes(normCandidate)) {
        return { hotel, matchedBy: "contains normalized hotel" };
      }
    }

    return null;
  }

  async run(cfg: MasterCoverageFromSheetsConfig): Promise<void> {
    const masterSpreadsheetId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);
    const ignoreList = [...this.DEFAULT_IGNORE, ...(cfg.ignoreQuestionsContaining ?? [])];
    const reportTabName = cfg.reportTabName ?? "Master Coverage Report";
    const strictHotelNameMatch = cfg.strictHotelNameMatch ?? false;
    const writeReport = cfg.writeReport ?? true;

    console.log(chalk.blue("🧭 Starting master coverage validation from source sheets..."));

    const masterRows = await this.sheets.readValues(masterSpreadsheetId, `${cfg.masterTabName}!A:Z`);
    if (masterRows.length <= 1) {
      throw new Error("Master sheet is empty or contains headers only.");
    }

    const masterMap = new Map<string, Set<string>>();
    const masterHotels: string[] = [];

    for (let i = 1; i < masterRows.length; i++) {
      const row = masterRows[i] ?? [];
      const hotel = String(row[cfg.masterHotelCol] ?? "").trim();
      const question = String(row[cfg.masterQuestionCol] ?? "").trim();
      if (!hotel || this.shouldIgnore(question, ignoreList)) continue;

      const normalizedQuestion = this.normalizeQuestion(question);
      if (!normalizedQuestion) continue;

      if (!masterMap.has(hotel)) {
        masterMap.set(hotel, new Set());
        masterHotels.push(hotel);
      }
      masterMap.get(hotel)!.add(normalizedQuestion);
    }

    console.log(chalk.green(`✅ Master loaded: ${masterMap.size} hotels, ${Array.from(masterMap.values()).reduce((sum, s) => sum + s.size, 0)} unique questions.`));

    const sourceTargets: Array<{ spreadsheetId: string; fileName: string; tab?: string; hotelNameExact?: string }> = [];

    if (cfg.sourceSheets?.length) {
      for (const item of cfg.sourceSheets) {
        const spreadsheetId = this.sheets.parseSpreadsheetId(item.spreadsheet);
        const fileName = await this.sheets.getSpreadsheetTitle(spreadsheetId);
        sourceTargets.push({ spreadsheetId, fileName, tab: item.tab, hotelNameExact: item.hotelNameExact });
      }
    }

    if (cfg.sourceFolderId) {
  const parsedFolderId = this.parseDriveFolderId(cfg.sourceFolderId);

  const folderFiles = cfg.sourceFolderRecursive
    ? await this.sheets.listSpreadsheetsInFolderWithNamesRecursive(parsedFolderId)
    : await this.sheets.listSpreadsheetsInFolderWithNames(parsedFolderId);

  for (const file of folderFiles) {
    if (!sourceTargets.some((t) => t.spreadsheetId === file.id)) {
      sourceTargets.push({
        spreadsheetId: file.id,
        fileName: file.name,
        tab: cfg.sourceTabName,
      });
    }
  }
}

    if (sourceTargets.length === 0) {
      throw new Error("No source sheets were found. Provide sourceFolderId or sourceSheets.");
    }

    console.log(chalk.cyan(`📂 Source sheets to scan: ${sourceTargets.length}`));

    const missingRows: MissingRow[] = [];
    const unmatchedHotels: Array<{ sourceFileName: string; sourceSpreadsheetId: string; candidateHotel: string }> = [];

   
   let totalSourceQuestions = 0;
let matchedSourceQuestions = 0;
let hotelsWithIssues = 0;
let processedCount = 0;

for (const target of sourceTargets) {
  processedCount++;

  console.log(
    chalk.blue(`[${processedCount}/${sourceTargets.length}] Checking "${target.fileName}"`)
  );

  const tabName = await this.resolveSourceTabTitle(
    target.spreadsheetId,
    target.tab?.trim() || cfg.sourceTabName?.trim()
  );
      const rows = await this.sheets.readValues(target.spreadsheetId, `${this.quoteA1Sheet(tabName)}!A:Z`);

      if (rows.length <= 1) {
        console.log(chalk.gray(`⚪ ${target.fileName} -> skipped, no data rows in tab ${tabName}`));
        continue;
      }

      const firstRowHotel = cfg.sourceHotelCol != null
        ? String(rows[1]?.[cfg.sourceHotelCol] ?? "").trim()
        : "";

      const resolvedHotel = this.resolveHotelName({
        explicitHotelName: target.hotelNameExact,
        fileName: target.fileName,
        rowHotel: firstRowHotel,
      });

      const hotelMatch = this.findBestHotelMatch(resolvedHotel.hotelName, masterHotels, strictHotelNameMatch);
      if (!hotelMatch) {
        unmatchedHotels.push({
          sourceFileName: target.fileName,
          sourceSpreadsheetId: target.spreadsheetId,
          candidateHotel: resolvedHotel.hotelName,
        });
        console.log(chalk.yellow(`⚠️ ${target.fileName} -> no hotel match in master`));
        continue;
      }

      const masterQuestions = masterMap.get(hotelMatch.hotel)! ?? new Set<string>();
      const fileMissing: MissingRow[] = [];
      const seenFileQuestions = new Set<string>();

      const sourceQuestionColLetter = this.columnIndexToLetter(cfg.sourceQuestionCol);
const masterQuestionColLetter = this.columnIndexToLetter(cfg.masterQuestionCol);

console.log(
  chalk.cyan(
    `[DEBUG] Source file="${target.fileName}" | sourceSpreadsheetId=${target.spreadsheetId} | tab="${tabName}" | resolvedHotel="${resolvedHotel.hotelName}" | matchedHotel="${hotelMatch.hotel}"`
  )
);
console.log(
  chalk.gray(
    `[DEBUG] Comparing source ${sourceQuestionColLetter} against master ${masterQuestionColLetter}`
  )
);

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        const question = String(row[cfg.sourceQuestionCol] ?? "").trim();
        if (this.shouldIgnore(question, ignoreList)) continue;

        const normalizedQuestion = this.normalizeQuestion(question);
        if (!normalizedQuestion || seenFileQuestions.has(normalizedQuestion)) continue;
        seenFileQuestions.add(normalizedQuestion);
        totalSourceQuestions++;

        if (masterQuestions.has(normalizedQuestion)) {
          matchedSourceQuestions++;
          continue;
        }

        fileMissing.push({
          hotel: hotelMatch.hotel,
          sourceFileName: target.fileName,
          sourceSpreadsheetId: target.spreadsheetId,
          sourceTabName: tabName,
          question,
          normalizedQuestion,
          matchedBy: `${resolvedHotel.matchedBy} + ${hotelMatch.matchedBy}`,
        });
      }

      console.log(
  chalk.yellow(
    `[DEBUG] ${target.fileName} | source rows=${rows.length - 1} | unique source questions=${seenFileQuestions.size} | master unique questions for matched hotel=${masterQuestions.size}`
  )
);

      if (fileMissing.length > 0) {
    
        hotelsWithIssues++;
        missingRows.push(...fileMissing);
        console.log(chalk.red(`❌ ${target.fileName} -> ${fileMissing.length} question(s) missing in master`));
        fileMissing.forEach((item) => console.log(chalk.gray(`   - ${item.question}`)));
      } else {
        console.log(chalk.green(`✅ ${target.fileName} -> all source questions exist in master`));
      }
    }

    const coverage = totalSourceQuestions === 0
      ? 100
      : Number(((matchedSourceQuestions / totalSourceQuestions) * 100).toFixed(2));

    console.log(chalk.gray("---------------------------------------------------"));
    console.log(chalk.white(`Source questions checked: ${totalSourceQuestions}`));
    console.log(chalk.white(`Found in master: ${matchedSourceQuestions}`));
    console.log(chalk.white(`Missing in master: ${missingRows.length}`));
    console.log(chalk.white(`Coverage: ${coverage}%`));
    console.log(chalk.white(`Hotels with missing questions: ${hotelsWithIssues}`));
    console.log(chalk.white(`Unmatched hotel files: ${unmatchedHotels.length}`));

    if (writeReport) {
      await this.sheets.ensureTab(masterSpreadsheetId, reportTabName);
      await this.sheets.clearTabValues(masterSpreadsheetId, reportTabName);

      const reportRows: string[][] = [
        ["Status", "Hotel", "Source File", "Source Tab", "Question", "Normalized Question", "Matching Method", "Source Spreadsheet ID"],
      ];

      if (missingRows.length === 0) {
        reportRows.push(["OK", "", "", "", "No missing questions found", "", "", ""]);
      } else {
        for (const row of missingRows) {
          reportRows.push([
            "MISSING_IN_MASTER",
            row.hotel,
            row.sourceFileName,
            row.sourceTabName,
            row.question,
            row.normalizedQuestion,
            row.matchedBy,
            row.sourceSpreadsheetId,
          ]);
        }
      }

      if (unmatchedHotels.length > 0) {
        reportRows.push(["", "", "", "", "", "", "", ""]);
        reportRows.push(["UNMATCHED_HOTELS", "Candidate Hotel", "Source File", "", "", "", "", "Source Spreadsheet ID"]);
        for (const item of unmatchedHotels) {
          reportRows.push([
            "UNMATCHED_HOTEL",
            item.candidateHotel,
            item.sourceFileName,
            "",
            "",
            "",
            "",
            item.sourceSpreadsheetId,
          ]);
        }
      }

      const summaryStartCol = "J";
      const summaryRows: string[][] = [
        ["Metric", "Value"],
        ["Source questions checked", String(totalSourceQuestions)],
        ["Found in master", String(matchedSourceQuestions)],
        ["Missing in master", String(missingRows.length)],
        ["Coverage %", String(coverage)],
        ["Hotels with missing questions", String(hotelsWithIssues)],
        ["Unmatched hotel files", String(unmatchedHotels.length)],
      ];

      await this.sheets.batchWriteValues(masterSpreadsheetId, [
        { range: `${this.quoteA1Sheet(reportTabName)}!A1`, values: reportRows },
        { range: `${this.quoteA1Sheet(reportTabName)}!${summaryStartCol}1`, values: summaryRows },
      ]);

      console.log(chalk.green(`📝 Report written to tab: ${reportTabName}`));
    }

    if (cfg.failIfMissing !== false && (missingRows.length > 0 || unmatchedHotels.length > 0)) {
      throw new Error(`Coverage validation failed. Missing questions: ${missingRows.length}, unmatched hotels: ${unmatchedHotels.length}.`);
    }

    console.log(chalk.green.bold("🏁 Master coverage validation completed."));
  }
}
