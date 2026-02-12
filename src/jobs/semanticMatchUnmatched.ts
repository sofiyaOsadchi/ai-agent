import chalk from "chalk";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { SheetsService } from "../services/sheets.js";

export type SemanticMatchUnmatchedConfig = {
  masterSpreadsheetId: string;
  hotelsFolderId: string;

  unmatchedTabName?: string; // default: "Unmatched (Hebrew Injection)"

  // Hotel sheets
  hotelEnglishTabName?: string; // default: first tab
  hotelEnglishRangeA1?: string; // default: "B:C" (Question, Answer)

  hotelHebrewTabName?: string; // optional, auto-detect if empty
  hotelHebrewRangeA1?: string; // default: "B:C"

  // Matching behavior
  model?: string; // default: "text-embedding-3-small"
  minScoreToWrite?: number; // default: 0.80 (still writes status if below)
  strictHotelNameMatch?: boolean; // default: true (normalized equality)
  includeAnswerInQuery?: boolean; // default: true (use Q + A for semantics)

  // Output columns appended to unmatched tab
  outputStartColLetter?: string; // default: "F"
};

type UnmatchedRow = {
  rowIndex0: number; // 0-based index in tab values array
  hotel: string;
  questionId: string;
  questionEn: string;
  answerEn: string;
};

export class SemanticMatchUnmatchedJob {
  constructor(private sheets: SheetsService) {}

  private normalizeHotelName(input: string): string {
    return (input ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  private extractIdFromFolderUrl(urlOrId: string): string {
    const m = urlOrId.match(/\/folders\/([A-Za-z0-9_-]+)/);
    return (m?.[1] ?? urlOrId).trim();
  }

  // Quote tab titles safely for A1 ranges
  private a1(tabTitle: string, range: string): string {
    const safe = (tabTitle ?? "").replace(/'/g, "''");
    return `'${safe}'!${range}`;
  }

  private async resolveTabOrFirst(spreadsheetId: string, tabName?: string): Promise<string> {
    if (tabName && tabName.trim()) {
      try {
        await this.sheets.getSheetIdByTitle(spreadsheetId, tabName.trim());
        return tabName.trim();
      } catch {
        return await this.sheets.getFirstSheetTitle(spreadsheetId);
      }
    }
    return await this.sheets.getFirstSheetTitle(spreadsheetId);
  }

  private async detectHebrewTab(spreadsheetId: string, preferred?: string): Promise<string> {
    if (preferred && preferred.trim()) return await this.resolveTabOrFirst(spreadsheetId, preferred);

    const titles = await this.sheets.listSheetTitles(spreadsheetId);
    const norm = (t: string) => (t ?? "").toLowerCase().replace(/\u00A0/g, " ").trim();

    const candidates = titles.filter((t) => {
      const n = norm(t);
      return n.includes(" he") || n.includes("- he") || n.includes("– he") || n.includes("hebrew") || n.includes("עבר");
    });

    if (candidates.length > 0) return candidates[0];
    if (titles.length >= 2) return titles[1];
    if (titles.length === 1) return titles[0];

    throw new Error(`Cannot detect Hebrew tab in spreadsheet ${spreadsheetId}`);
  }

  private findColumnIndexByHeader(headers: string[], desired: string[]): number | null {
    const normalizeHeader = (x: string) =>
      (x ?? "")
        .toLowerCase()
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const set = new Set(desired.map(normalizeHeader));
    for (let i = 0; i < headers.length; i++) {
      const h = normalizeHeader(String(headers[i] ?? ""));
      if (set.has(h)) return i;
    }
    return null;
  }

  private cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i];
      const y = b[i];
      dot += x * y;
      na += x * x;
      nb += y * y;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private cacheDir(): string {
    const dir = path.join(process.cwd(), ".cache", "semantic-match");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private loadEmbeddingsCache(key: string): Record<string, number[]> | null {
    const file = path.join(this.cacheDir(), `${key}.json`);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }

  private saveEmbeddingsCache(key: string, data: Record<string, number[]>): void {
    const file = path.join(this.cacheDir(), `${key}.json`);
    fs.writeFileSync(file, JSON.stringify(data), "utf8");
  }

  private async embedTexts(openai: OpenAI, model: string, texts: string[]): Promise<number[][]> {
    const resp = await openai.embeddings.create({
      model,
      input: texts,
      encoding_format: "float",
    });
    return resp.data.map((d) => d.embedding as unknown as number[]);
  }

  private buildQueryText(u: UnmatchedRow, includeAnswer: boolean): string {
    if (includeAnswer && u.answerEn) {
      return `Question: ${u.questionEn}\nAnswer: ${u.answerEn}`;
    }
    return `Question: ${u.questionEn}`;
  }

  async run(cfg: SemanticMatchUnmatchedConfig): Promise<void> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const model = cfg.model ?? "text-embedding-3-small";
    const minScoreToWrite = cfg.minScoreToWrite ?? 0.8;
    const strictHotelNameMatch = cfg.strictHotelNameMatch ?? true;
    const includeAnswerInQuery = cfg.includeAnswerInQuery ?? true;

    const outputStartColLetter = (cfg.outputStartColLetter ?? "F").toUpperCase();
    const unmatchedTabName = cfg.unmatchedTabName?.trim() || "Unmatched (Hebrew Injection)";

    const masterId = this.sheets.parseSpreadsheetId(cfg.masterSpreadsheetId);

    console.log(chalk.blue(`🔎 Semantic matching on tab: "${unmatchedTabName}"`));

    const unmatchedRowsRaw = await this.sheets.readValues(masterId, this.a1(unmatchedTabName, "A:Z"));
    if (unmatchedRowsRaw.length <= 1) {
      console.log(chalk.yellow(`⚠️ Unmatched tab is empty (or only header). Nothing to do.`));
      return;
    }

    const headers = (unmatchedRowsRaw[0] ?? []).map((x) => String(x ?? ""));
    const hotelCol = this.findColumnIndexByHeader(headers, ["hotel"]) ?? 0;
    const qidCol = this.findColumnIndexByHeader(headers, ["question_id", "question id", "qid", "id"]);
    const qCol = this.findColumnIndexByHeader(headers, ["question_en", "question en", "question"]) ?? 3;
    const aCol = this.findColumnIndexByHeader(headers, ["answer_en", "answer en", "answer"]) ?? 4;

    const unmatched: UnmatchedRow[] = [];
    for (let i = 1; i < unmatchedRowsRaw.length; i++) {
      const row = unmatchedRowsRaw[i] ?? [];
      const hotel = String(row[hotelCol] ?? "").trim();
      const questionEn = String(row[qCol] ?? "").trim();
      if (!hotel || !questionEn) continue;

      unmatched.push({
        rowIndex0: i,
        hotel,
        questionId: qidCol != null ? String(row[qidCol] ?? "").trim() : "",
        questionEn,
        answerEn: aCol != null ? String(row[aCol] ?? "").trim() : "",
      });
    }

    if (unmatched.length === 0) {
      console.log(chalk.yellow(`⚠️ No actionable rows found in Unmatched tab.`));
      return;
    }

    const folderId = this.extractIdFromFolderUrl(cfg.hotelsFolderId);
    const hotelSheetIds = await this.sheets.listSpreadsheetIdsInFolder(folderId);

    const idByHotelNorm = new Map<string, { spreadsheetId: string; titleRaw: string }>();
    for (const id of hotelSheetIds) {
      const title = await this.sheets.getSpreadsheetTitle(id);
      const norm = this.normalizeHotelName(title);
      if (!norm) continue;
      if (!idByHotelNorm.has(norm)) idByHotelNorm.set(norm, { spreadsheetId: id, titleRaw: title });
    }

    const byHotel = new Map<string, UnmatchedRow[]>();
    for (const u of unmatched) {
      const norm = this.normalizeHotelName(u.hotel);
      const arr = byHotel.get(norm) ?? [];
      arr.push(u);
      byHotel.set(norm, arr);
    }

    // Outputs aligned to original tab row count
    const outMatchedQ = new Array<string>(unmatchedRowsRaw.length).fill("");
    const outMatchedA = new Array<string>(unmatchedRowsRaw.length).fill("");
    const outScore = new Array<string>(unmatchedRowsRaw.length).fill("");
    const outHotelRow = new Array<string>(unmatchedRowsRaw.length).fill("");
    const outStatus = new Array<string>(unmatchedRowsRaw.length).fill("");
    const outMatchedQHe = new Array<string>(unmatchedRowsRaw.length).fill("");
    const outMatchedAHe = new Array<string>(unmatchedRowsRaw.length).fill("");

    outMatchedQ[0] = "matched_question_en";
    outMatchedA[0] = "matched_answer_en";
    outScore[0] = "semantic_score";
    outHotelRow[0] = "hotel_sheet_row";
    outStatus[0] = "status";
    outMatchedQHe[0] = "matched_question_he";
    outMatchedAHe[0] = "matched_answer_he";

    // Helpers for columns
    const letterToIndex = (s: string) => {
      let n = 0;
      for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
      return n - 1;
    };
    const indexToLetter = (index0: number) => {
      let n = index0 + 1;
      let out = "";
      while (n > 0) {
        const r = (n - 1) % 26;
        out = String.fromCharCode(65 + r) + out;
        n = Math.floor((n - 1) / 26);
      }
      return out;
    };
    const to2D = (arr: string[]) => arr.map((v) => [v]);

    // Per-hotel loop
    for (const [hotelNorm, rows] of byHotel.entries()) {
      const hotelMap = idByHotelNorm.get(hotelNorm);
      if (!hotelMap) {
        for (const u of rows) outStatus[u.rowIndex0] = "hotel_not_found_exact";
        continue;
      }

      if (strictHotelNameMatch) {
        const titleNorm = this.normalizeHotelName(hotelMap.titleRaw);
        if (titleNorm !== hotelNorm) {
          for (const u of rows) outStatus[u.rowIndex0] = "hotel_name_mismatch";
          continue;
        }
      }

      const hotelSheetId = hotelMap.spreadsheetId;

      const hotelEnTab = await this.resolveTabOrFirst(hotelSheetId, cfg.hotelEnglishTabName);
      const rangeEn = cfg.hotelEnglishRangeA1 ?? "B:C";

      const hotelHeTab = await this.detectHebrewTab(hotelSheetId, cfg.hotelHebrewTabName);
      const rangeHe = cfg.hotelHebrewRangeA1 ?? "B:C";

      const hotelEnRows = await this.sheets.readValues(hotelSheetId, this.a1(hotelEnTab, rangeEn));
      const hotelHeRows = await this.sheets.readValues(hotelSheetId, this.a1(hotelHeTab, rangeHe));

      if (hotelEnRows.length <= 1) {
        for (const u of rows) outStatus[u.rowIndex0] = "hotel_sheet_no_rows";
        continue;
      }

      // Candidates from English tab (skip header)
      const candidates: Array<{ q: string; a: string; sheetRowNumber: number; text: string }> = [];
      for (let i = 1; i < hotelEnRows.length; i++) {
        const r = hotelEnRows[i] ?? [];
        const q = String(r[0] ?? "").trim();
        const a = String(r[1] ?? "").trim();
        if (!q) continue;

        const sheetRowNumber = i + 1; // actual sheet row (1-based)
        const text = includeAnswerInQuery && a ? `Question: ${q}\nAnswer: ${a}` : `Question: ${q}`;
        candidates.push({ q, a, sheetRowNumber, text });
      }

      if (candidates.length === 0) {
        for (const u of rows) outStatus[u.rowIndex0] = "no_candidates";
        continue;
      }

      // Candidate embeddings cache
      const cacheKey = `${hotelSheetId}_${hotelEnTab}_${rangeEn}`.replace(/[^A-Za-z0-9_-]/g, "_");
      const cache = this.loadEmbeddingsCache(cacheKey) ?? {};

      const textsToEmbed: string[] = [];
      const textOrder: string[] = [];
      for (const c of candidates) {
        if (!cache[c.text]) {
          textsToEmbed.push(c.text);
          textOrder.push(c.text);
        }
      }

      if (textsToEmbed.length > 0) {
        const vecs = await this.embedTexts(openai, model, textsToEmbed);
        for (let i = 0; i < vecs.length; i++) cache[textOrder[i]] = vecs[i];
        this.saveEmbeddingsCache(cacheKey, cache);
      }

      // Query embeddings for this hotel
      const queries = rows.map((u) => this.buildQueryText(u, includeAnswerInQuery));
      const qVecs = await this.embedTexts(openai, model, queries);

      for (let i = 0; i < rows.length; i++) {
        const u = rows[i];
        const qVec = qVecs[i];

        let bestIdx = -1;
        let bestScore = -1;
        let secondScore = -1;

        for (let j = 0; j < candidates.length; j++) {
          const c = candidates[j];
          const cVec = cache[c.text];
          if (!cVec) continue;

          const s = this.cosine(qVec, cVec);
          if (s > bestScore) {
            secondScore = bestScore;
            bestScore = s;
            bestIdx = j;
          } else if (s > secondScore) {
            secondScore = s;
          }
        }

        if (bestIdx === -1) {
          outStatus[u.rowIndex0] = "no_embedding_match";
          continue;
        }

        const best = candidates[bestIdx];
        const margin = bestScore - secondScore;

        outMatchedQ[u.rowIndex0] = best.q;
        outMatchedA[u.rowIndex0] = best.a;
        outScore[u.rowIndex0] = bestScore.toFixed(4);
        outHotelRow[u.rowIndex0] = String(best.sheetRowNumber);

        // Pull Hebrew from same row number in Hebrew tab (B:C)
        const heIndex0 = best.sheetRowNumber - 1; // values array is 0-based
        const heRow = hotelHeRows[heIndex0] ?? [];
        const heQ = String(heRow[0] ?? "").trim();
        const heA = String(heRow[1] ?? "").trim();
        if (heQ || heA) {
          outMatchedQHe[u.rowIndex0] = heQ;
          outMatchedAHe[u.rowIndex0] = heA;
        }

        // Status
        if (bestScore < minScoreToWrite) {
          outStatus[u.rowIndex0] = `low_score(${bestScore.toFixed(3)})`;
        } else if (margin < 0.02) {
          outStatus[u.rowIndex0] = `low_margin(${margin.toFixed(3)})`;
        } else {
          outStatus[u.rowIndex0] = "ok";
        }

        if (!heQ && !heA) {
          outStatus[u.rowIndex0] = `${outStatus[u.rowIndex0]}_missing_he`;
        }
      }
    }

    // Write output columns: 7 columns starting from outputStartColLetter (default F)
    const startIdx = letterToIndex(outputStartColLetter);
    const col1 = indexToLetter(startIdx); // matched_question_en
    const col2 = indexToLetter(startIdx + 1); // matched_answer_en
    const col3 = indexToLetter(startIdx + 2); // score
    const col4 = indexToLetter(startIdx + 3); // hotel row
    const col5 = indexToLetter(startIdx + 4); // status
    const col6 = indexToLetter(startIdx + 5); // matched_question_he
    const col7 = indexToLetter(startIdx + 6); // matched_answer_he

    await this.sheets.writeValues(masterId, this.a1(unmatchedTabName, `${col1}1`), to2D(outMatchedQ));
    await this.sheets.writeValues(masterId, this.a1(unmatchedTabName, `${col2}1`), to2D(outMatchedA));
    await this.sheets.writeValues(masterId, this.a1(unmatchedTabName, `${col3}1`), to2D(outScore));
    await this.sheets.writeValues(masterId, this.a1(unmatchedTabName, `${col4}1`), to2D(outHotelRow));
    await this.sheets.writeValues(masterId, this.a1(unmatchedTabName, `${col5}1`), to2D(outStatus));
    await this.sheets.writeValues(masterId, this.a1(unmatchedTabName, `${col6}1`), to2D(outMatchedQHe));
    await this.sheets.writeValues(masterId, this.a1(unmatchedTabName, `${col7}1`), to2D(outMatchedAHe));

    console.log(
      chalk.green(
        `✅ Semantic matching completed. Wrote results to ${unmatchedTabName}!${col1}:${col7}`
      )
    );
  }
}