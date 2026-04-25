import chalk from "chalk";
import { AIAgent } from "../core/agent.js";
import { SheetsService } from "../services/sheets.js";

export type QnaConsistencyMode = "node-only" | "ai-hybrid";

export type QnaConsistencyConfig = {
  spreadsheet: string;
  tab?: string;
  mode: QnaConsistencyMode;
  headers?: {
    id?: string;
    question?: string;
    answer?: string;
    active?: string;
    locale?: string;
    sourceKey?: string;
  };
  output?: {
    status?: string;
    issueType?: string;
    reason?: string;
    confidence?: string;
    nodeFlags?: string;
    duplicateGroup?: string;
    cleanedQuestion?: string;
    cleanedAnswer?: string;
  };
  startRow?: number;
  onlyActive?: boolean;
  batchSize?: number;
};

type RawRow = Record<string, string>;

type InputRow = {
  rowNumber: number;
  id: string;
  question: string;
  answer: string;
  active: string;
  locale: string;
  sourceKey: string;
};

type CheckStatus = "OK" | "ISSUE" | "SKIPPED";

type IssueType =
  | "NONE"
  | "EMPTY_VALUE"
  | "HOTEL_MISMATCH"
  | "TOPIC_MISMATCH"
  | "POSSIBLE_DUPLICATE"
  | "GENERIC_ANSWER"
  | "LOW_OVERLAP"
  | "INACTIVE_ROW"
  | "AI_CONFIRMED_OTHER";

type NodeFlag =
  | "EMPTY_VALUE"
  | "HOTEL_MISMATCH"
  | "TOPIC_MISMATCH"
  | "POSSIBLE_DUPLICATE"
  | "GENERIC_ANSWER"
  | "LOW_OVERLAP"
  | "INACTIVE_ROW";

type NodeCheckResult = {
  rowNumber: number;
  status: "OK" | "REVIEW" | "SKIPPED";
  nodeFlags: NodeFlag[];
  reason: string;
  duplicateGroup: string;
  cleanedQuestion: string;
  cleanedAnswer: string;
};

type FinalCheckResult = {
  rowNumber: number;
  status: CheckStatus;
  issueType: IssueType;
  reason: string;
  confidence: number;
  nodeFlags: string;
  duplicateGroup: string;
  cleanedQuestion: string;
  cleanedAnswer: string;
};

type DuplicateInfo = {
  flags: NodeFlag[];
  duplicateGroup: string;
};

const DEFAULT_HEADERS = {
  id: "id",
  question: "question",
  answer: "answer",
  active: "active",
  locale: "locale",
  sourceKey: "shatap",
};

const DEFAULT_OUTPUT = {
  status: "qa_status",
  issueType: "qa_issue_type",
  reason: "qa_reason",
  confidence: "qa_confidence",
  nodeFlags: "qa_node_flags",
  duplicateGroup: "qa_duplicate_group",
  cleanedQuestion: "qa_clean_question",
  cleanedAnswer: "qa_clean_answer",
};

export class QnaConsistencyJob {
  constructor(
    private agent: AIAgent,
    private sheets: SheetsService
  ) {}

  async run(config: QnaConsistencyConfig): Promise<void> {
    const spreadsheetId = this.sheets.parseSpreadsheetId(config.spreadsheet);
    const tabName = config.tab?.trim() || await this.sheets.getFirstSheetTitle(spreadsheetId);
    const startRow = config.startRow ?? 2;
    const batchSize = config.batchSize ?? 20;

    const headers = {
      ...DEFAULT_HEADERS,
      ...(config.headers || {}),
    };

    const output = {
      ...DEFAULT_OUTPUT,
      ...(config.output || {}),
    };

    console.log(chalk.blue("🔎 Starting Q&A consistency check..."));
    console.log(chalk.gray(`Sheet: ${spreadsheetId} | Tab: ${tabName} | Mode: ${config.mode}`));

    const rows = await this.readAsObjects(spreadsheetId, tabName);
    if (!rows.length) {
      console.log(chalk.yellow("⚠️ No rows found."));
      return;
    }

    const preparedRows = this.prepareRows(rows, headers, startRow);
    if (!preparedRows.length) {
      console.log(chalk.yellow("⚠️ No data rows found."));
      return;
    }

    const duplicateMap = this.buildDuplicateMap(preparedRows);

    const nodeResults = preparedRows.map((row) => this.runNodeChecks(row, config, duplicateMap));

    let finalResults: FinalCheckResult[] = nodeResults.map((nodeItem) => {
      if (nodeItem.status === "SKIPPED") {
        return {
          rowNumber: nodeItem.rowNumber,
          status: "SKIPPED",
          issueType: "INACTIVE_ROW",
          reason: nodeItem.reason,
          confidence: 100,
          nodeFlags: nodeItem.nodeFlags.join(", "),
          duplicateGroup: nodeItem.duplicateGroup,
          cleanedQuestion: nodeItem.cleanedQuestion,
          cleanedAnswer: nodeItem.cleanedAnswer,
        };
      }

      if (nodeItem.status === "OK") {
        return {
          rowNumber: nodeItem.rowNumber,
          status: "OK",
          issueType: "NONE",
          reason: "No issues detected by node",
          confidence: 88,
          nodeFlags: "",
          duplicateGroup: nodeItem.duplicateGroup,
          cleanedQuestion: nodeItem.cleanedQuestion,
          cleanedAnswer: nodeItem.cleanedAnswer,
        };
      }

      return {
        rowNumber: nodeItem.rowNumber,
        status: "ISSUE",
        issueType: "AI_CONFIRMED_OTHER",
        reason: nodeItem.reason,
        confidence: 40,
        nodeFlags: nodeItem.nodeFlags.join(", "),
        duplicateGroup: nodeItem.duplicateGroup,
        cleanedQuestion: nodeItem.cleanedQuestion,
        cleanedAnswer: nodeItem.cleanedAnswer,
      };
    });

    if (config.mode === "ai-hybrid") {
      const suspiciousRows = nodeResults
        .filter((item) => item.status === "REVIEW")
        .map((item) => {
          const source = preparedRows.find((row) => row.rowNumber === item.rowNumber);
          if (!source) {
            throw new Error(`Missing source row for rowNumber ${item.rowNumber}`);
          }

          return {
            row: source,
            node: item,
          };
        });

      const aiResults: FinalCheckResult[] = [];

      for (let i = 0; i < suspiciousRows.length; i += batchSize) {
        const chunk = suspiciousRows.slice(i, i + batchSize);
        const prompt = this.buildAiPrompt(chunk);

        const raw = await this.agent.runWithSystem(
          prompt,
          "You validate hotel FAQ question-answer pairs. Return only valid JSON. Be strict and concise.",
          "o3"
        );

        const parsed = this.parseAiResults(raw, chunk);
        aiResults.push(...parsed);

        console.log(chalk.gray(`   ↳ AI batch ${Math.floor(i / batchSize) + 1} completed`));
      }

      const aiMap = new Map<number, FinalCheckResult>();
      for (const item of aiResults) {
        aiMap.set(item.rowNumber, item);
      }

      finalResults = finalResults.map((item) => {
        const aiResult = aiMap.get(item.rowNumber);
        return aiResult ?? item;
      });
    }

    await this.writeResults(spreadsheetId, tabName, output, finalResults);

    const summary = this.buildSummary(finalResults);
    console.log(chalk.green("✅ Q&A consistency check completed"));
    console.log(chalk.cyan(`OK: ${summary.OK}`));
    console.log(chalk.red(`ISSUE: ${summary.ISSUE}`));
    console.log(chalk.gray(`SKIPPED: ${summary.SKIPPED}`));
  }

  private async readAsObjects(spreadsheetId: string, tabName: string): Promise<RawRow[]> {
    const values = await this.sheets.readValues(spreadsheetId, `${tabName}!A:ZZ`);
    if (!values.length) return [];

    const headers = (values[0] || []).map((cell) => String(cell || "").trim());
    const dataRows = values.slice(1);

    return dataRows.map((row) => {
      const out: RawRow = {};
      for (let i = 0; i < headers.length; i++) {
        out[headers[i]] = String(row[i] ?? "").trim();
      }
      return out;
    });
  }

  private prepareRows(
    rows: RawRow[],
    headers: typeof DEFAULT_HEADERS,
    startRow: number
  ): InputRow[] {
    return rows.map((row, index) => ({
      rowNumber: index + startRow,
      id: row[headers.id] || "",
      question: row[headers.question] || "",
      answer: row[headers.answer] || "",
      active: row[headers.active] || "",
      locale: row[headers.locale] || "",
      sourceKey: row[headers.sourceKey] || "",
    }));
  }

  private buildDuplicateMap(rows: InputRow[]): Map<number, DuplicateInfo> {
    const duplicateMap = new Map<number, DuplicateInfo>();

    const normalizedQuestions = new Map<string, number[]>();
    const normalizedAnswers = new Map<string, number[]>();

    for (const row of rows) {
      const cleanQuestion = this.normalizeForDuplicateCheck(row.question);
      const cleanAnswer = this.normalizeForDuplicateCheck(row.answer);

      if (cleanQuestion) {
        const existing = normalizedQuestions.get(cleanQuestion) || [];
        existing.push(row.rowNumber);
        normalizedQuestions.set(cleanQuestion, existing);
      }

      if (cleanAnswer) {
        const existing = normalizedAnswers.get(cleanAnswer) || [];
        existing.push(row.rowNumber);
        normalizedAnswers.set(cleanAnswer, existing);
      }
    }

    for (const [, rowNumbers] of normalizedQuestions.entries()) {
      if (rowNumbers.length < 2) continue;

      const group = `Q:${rowNumbers.join("|")}`;
      for (const rowNumber of rowNumbers) {
        const current = duplicateMap.get(rowNumber) || {
          flags: [],
          duplicateGroup: "",
        };

        if (!current.flags.includes("POSSIBLE_DUPLICATE")) {
          current.flags.push("POSSIBLE_DUPLICATE");
        }

        current.duplicateGroup = current.duplicateGroup
          ? `${current.duplicateGroup} ; ${group}`
          : group;

        duplicateMap.set(rowNumber, current);
      }
    }

    for (const [, rowNumbers] of normalizedAnswers.entries()) {
      if (rowNumbers.length < 2) continue;

      const group = `A:${rowNumbers.join("|")}`;
      for (const rowNumber of rowNumbers) {
        const current = duplicateMap.get(rowNumber) || {
          flags: [],
          duplicateGroup: "",
        };

        if (!current.flags.includes("POSSIBLE_DUPLICATE")) {
          current.flags.push("POSSIBLE_DUPLICATE");
        }

        current.duplicateGroup = current.duplicateGroup
          ? `${current.duplicateGroup} ; ${group}`
          : group;

        duplicateMap.set(rowNumber, current);
      }
    }

    return duplicateMap;
  }

  private runNodeChecks(
    row: InputRow,
    config: QnaConsistencyConfig,
    duplicateMap: Map<number, DuplicateInfo>
  ): NodeCheckResult {
    const cleanedQuestion = this.cleanText(row.question);
    const cleanedAnswer = this.cleanText(row.answer);

    if ((config.onlyActive ?? true) && row.active && row.active.toLowerCase() !== "true") {
      return {
        rowNumber: row.rowNumber,
        status: "SKIPPED",
        nodeFlags: ["INACTIVE_ROW"],
        reason: "Row is inactive",
        duplicateGroup: "",
        cleanedQuestion,
        cleanedAnswer,
      };
    }

    const nodeFlags: NodeFlag[] = [];
    const duplicateInfo = duplicateMap.get(row.rowNumber);

    if (!cleanedQuestion || !cleanedAnswer) {
      nodeFlags.push("EMPTY_VALUE");
    }

    const questionHotel = this.extractHotelName(cleanedQuestion);
    const answerHotel = this.extractHotelName(cleanedAnswer);

    if (questionHotel && answerHotel && questionHotel !== answerHotel) {
      nodeFlags.push("HOTEL_MISMATCH");
    }

    const questionTopic = this.detectTopic(cleanedQuestion);
    const answerTopic = this.detectTopic(cleanedAnswer);

    if (
      questionTopic !== "unknown" &&
      answerTopic !== "unknown" &&
      questionTopic !== answerTopic
    ) {
      nodeFlags.push("TOPIC_MISMATCH");
    }

    if (this.isGenericAnswer(cleanedAnswer)) {
      nodeFlags.push("GENERIC_ANSWER");
    }

    const overlap = this.getKeywordOverlapScore(cleanedQuestion, cleanedAnswer);
    if (overlap < 0.14) {
      nodeFlags.push("LOW_OVERLAP");
    }

    if (duplicateInfo?.flags?.length) {
      for (const flag of duplicateInfo.flags) {
        if (!nodeFlags.includes(flag)) {
          nodeFlags.push(flag);
        }
      }
    }

    if (!nodeFlags.length) {
      return {
        rowNumber: row.rowNumber,
        status: "OK",
        nodeFlags: [],
        reason: "No issues detected by node",
        duplicateGroup: duplicateInfo?.duplicateGroup || "",
        cleanedQuestion,
        cleanedAnswer,
      };
    }

    return {
      rowNumber: row.rowNumber,
      status: "REVIEW",
      nodeFlags,
      reason: `Node flagged: ${nodeFlags.join(", ")}`,
      duplicateGroup: duplicateInfo?.duplicateGroup || "",
      cleanedQuestion,
      cleanedAnswer,
    };
  }

  private buildAiPrompt(
    rows: Array<{ row: InputRow; node: NodeCheckResult }>
  ): string {
    const payload = rows.map(({ row, node }) => ({
      rowNumber: row.rowNumber,
      question: this.cleanText(row.question),
      answer: this.cleanText(row.answer),
      locale: row.locale,
      sourceKey: row.sourceKey,
      nodeFlags: node.nodeFlags,
      duplicateGroup: node.duplicateGroup,
    }));

    return `
Validate suspicious hotel FAQ rows.

Rules:
1. Ignore HTML tags completely.
2. Detect if question and answer are about different hotels.
3. Detect if question and answer are about different topics.
4. Detect duplicates only when they are genuinely duplicated or reused in a problematic way.
5. If node suspicion is false, return OK.
6. If there is a real problem, return ISSUE.
7. Be strict but not paranoid.

Allowed status values:
- OK
- ISSUE

Allowed issueType values:
- NONE
- EMPTY_VALUE
- HOTEL_MISMATCH
- TOPIC_MISMATCH
- POSSIBLE_DUPLICATE
- GENERIC_ANSWER
- LOW_OVERLAP
- AI_CONFIRMED_OTHER

Return ONLY valid JSON array.
Each item must include:
rowNumber, status, issueType, reason, confidence

Input:
${JSON.stringify(payload, null, 2)}
    `.trim();
  }

  private parseAiResults(
    raw: string,
    sourceRows: Array<{ row: InputRow; node: NodeCheckResult }>
  ): FinalCheckResult[] {
    try {
      const cleanedRaw = raw
        .trim()
        .replace(/^```json/i, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();

      const parsed = JSON.parse(cleanedRaw);
      if (!Array.isArray(parsed)) {
        throw new Error("AI response is not an array");
      }

      return parsed.map((item: any) => {
        const source = sourceRows.find((x) => x.row.rowNumber === Number(item.rowNumber));
        if (!source) {
          throw new Error(`AI returned unknown rowNumber: ${String(item.rowNumber)}`);
        }

        const normalizedStatus = this.normalizeStatus(item.status);
        const normalizedIssueType = this.normalizeIssueType(item.issueType);

        return {
          rowNumber: source.row.rowNumber,
          status: normalizedStatus,
          issueType: normalizedIssueType,
          reason: String(item.reason || source.node.reason || "No reason"),
          confidence: this.clampNumber(Number(item.confidence), 0, 100, 50),
          nodeFlags: source.node.nodeFlags.join(", "),
          duplicateGroup: source.node.duplicateGroup,
          cleanedQuestion: source.node.cleanedQuestion,
          cleanedAnswer: source.node.cleanedAnswer,
        };
      });
    } catch {
      return sourceRows.map(({ row, node }) => ({
        rowNumber: row.rowNumber,
        status: "ISSUE" as CheckStatus,
        issueType: "AI_CONFIRMED_OTHER" as IssueType,
        reason: "AI response could not be parsed",
        confidence: 35,
        nodeFlags: node.nodeFlags.join(", "),
        duplicateGroup: node.duplicateGroup,
        cleanedQuestion: node.cleanedQuestion,
        cleanedAnswer: node.cleanedAnswer,
      }));
    }
  }

  private async writeResults(
    spreadsheetId: string,
    tabName: string,
    output: typeof DEFAULT_OUTPUT,
    results: FinalCheckResult[]
  ): Promise<void> {
    const statusCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.status);
    const issueTypeCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.issueType);
    const reasonCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.reason);
    const confidenceCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.confidence);

    const writes: Array<{ range: string; values: string[][] }> = [
      {
        range: `${tabName}!${statusCol}2`,
        values: results.map((item) => [item.status]),
      },
      {
        range: `${tabName}!${issueTypeCol}2`,
        values: results.map((item) => [item.issueType]),
      },
      {
        range: `${tabName}!${reasonCol}2`,
        values: results.map((item) => [item.reason]),
      },
      {
        range: `${tabName}!${confidenceCol}2`,
        values: results.map((item) => [String(item.confidence)]),
      },
    ];

    if (output.nodeFlags) {
      const nodeFlagsCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.nodeFlags);
      writes.push({
        range: `${tabName}!${nodeFlagsCol}2`,
        values: results.map((item) => [item.nodeFlags]),
      });
    }

    if (output.duplicateGroup) {
      const duplicateGroupCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.duplicateGroup);
      writes.push({
        range: `${tabName}!${duplicateGroupCol}2`,
        values: results.map((item) => [item.duplicateGroup]),
      });
    }

    if (output.cleanedQuestion) {
      const cleanedQuestionCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.cleanedQuestion);
      writes.push({
        range: `${tabName}!${cleanedQuestionCol}2`,
        values: results.map((item) => [item.cleanedQuestion]),
      });
    }

    if (output.cleanedAnswer) {
      const cleanedAnswerCol = await this.ensureOutputColumn(spreadsheetId, tabName, output.cleanedAnswer);
      writes.push({
        range: `${tabName}!${cleanedAnswerCol}2`,
        values: results.map((item) => [item.cleanedAnswer]),
      });
    }

    await this.sheets.batchWriteValues(spreadsheetId, writes, "RAW");
  }

  private async ensureOutputColumn(
    spreadsheetId: string,
    tabName: string,
    headerName: string
  ): Promise<string> {
    const headerRow = await this.sheets.readValues(spreadsheetId, `${tabName}!1:1`);
    const headers = (headerRow[0] || []).map((cell) => String(cell || "").trim());

    const existingIndex = headers.findIndex((header) => header === headerName);
    if (existingIndex >= 0) {
      return this.indexToLetter(existingIndex);
    }

    const newIndex = headers.length;
    const newCol = this.indexToLetter(newIndex);

    await this.sheets.writeValues(spreadsheetId, `${tabName}!${newCol}1`, [[headerName]]);
    return newCol;
  }

  private cleanText(value: string): string {
    return String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&rsquo;|&lsquo;|&#39;/gi, "'")
      .replace(/&rdquo;|&ldquo;|&quot;/gi, "\"")
      .replace(/&ndash;|&mdash;/gi, "-")
      .replace(/&amp;/gi, "&")
      .replace(/&euro;/gi, "euro")
      .replace(/&pound;/gi, "pound")
      .replace(/&[^;]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalizeForDuplicateCheck(value: string): string {
    return this.cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private extractHotelName(text: string): string {
    const match = text.match(
      /\b(Leonardo Royal Hotel [A-Za-z' -]+|Leonardo Hotel [A-Za-z' -]+|Leonardo Boutique Hotel [A-Za-z' -]+|NYX Hotel [A-Za-z' -]+)\b/i
    );

    return match ? match[1].toLowerCase().trim() : "";
  }

  private detectTopic(text: string): string {
    const value = text.toLowerCase();

    if (/\b(check[- ]?in|check[- ]?out)\b/.test(value)) return "checkin";
    if (/\b(parking|car park|carpark)\b/.test(value)) return "parking";
    if (/\b(train station|bus station|airport|taxi|transport|walkable|walk)\b/.test(value)) return "transport";
    if (/\b(wifi|wi-fi|internet)\b/.test(value)) return "wifi";
    if (/\b(room service|restaurant|breakfast|dinner|lunch|bar|menu|coffee)\b/.test(value)) return "food";
    if (/\b(pets|guide dogs|assistance dogs)\b/.test(value)) return "pets";
    if (/\b(accessible|wheelchair|adapted|step-free|step free|lifts)\b/.test(value)) return "accessibility";
    if (/\b(family rooms|guestrooms|rooms|beds|cribs|cots|toiletries|mini-fridge|mini fridge|safe)\b/.test(value)) return "rooms";
    if (/\b(meeting room|meeting spaces|business centre|business center|banquet hall|delegates)\b/.test(value)) return "business";
    if (/\b(cancellation|prepayment|refund|policy|policies)\b/.test(value)) return "policy";
    if (/\b(laundry|dry-cleaning|dry cleaning)\b/.test(value)) return "laundry";

    return "unknown";
  }

  private isGenericAnswer(text: string): boolean {
    const value = text.toLowerCase();

    return [
      "subject to availability",
      "please contact the hotel",
      "please contact reception",
      "please check with the hotel",
      "please contact the property",
      "depends on availability",
    ].some((phrase) => value.includes(phrase));
  }

  private getKeywordOverlapScore(question: string, answer: string): number {
    const qTokens = this.extractKeywords(question);
    const aTokens = this.extractKeywords(answer);

    if (!qTokens.length || !aTokens.length) return 0;

    const answerSet = new Set(aTokens);
    const overlapCount = qTokens.filter((token) => answerSet.has(token)).length;

    return overlapCount / qTokens.length;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "can", "could",
      "how", "what", "when", "where", "which", "who", "and", "or", "for", "with", "from",
      "into", "onto", "that", "this", "these", "those", "there", "their", "about", "have",
      "has", "had", "will", "would", "should", "hotel", "guest", "guests", "provide", "offers",
      "offer", "available", "standard", "nearest"
    ]);

    return [...new Set(
      this.cleanText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !stopWords.has(token))
    )];
  }

  private normalizeStatus(value: string): CheckStatus {
    if (value === "OK" || value === "ISSUE" || value === "SKIPPED") {
      return value;
    }
    return "ISSUE";
  }

  private normalizeIssueType(value: string): IssueType {
    const allowed: IssueType[] = [
      "NONE",
      "EMPTY_VALUE",
      "HOTEL_MISMATCH",
      "TOPIC_MISMATCH",
      "POSSIBLE_DUPLICATE",
      "GENERIC_ANSWER",
      "LOW_OVERLAP",
      "INACTIVE_ROW",
      "AI_CONFIRMED_OTHER",
    ];

    return allowed.includes(value as IssueType)
      ? (value as IssueType)
      : "AI_CONFIRMED_OTHER";
  }

  private clampNumber(value: number, min: number, max: number, fallback: number): number {
    if (Number.isNaN(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  }

  private indexToLetter(index: number): string {
    let current = index + 1;
    let out = "";

    while (current > 0) {
      const rem = (current - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      current = Math.floor((current - 1) / 26);
    }

    return out;
  }

  private buildSummary(results: FinalCheckResult[]) {
    return results.reduce(
      (acc, item) => {
        acc[item.status]++;
        return acc;
      },
      {
        OK: 0,
        ISSUE: 0,
        SKIPPED: 0,
      }
    );
  }
}