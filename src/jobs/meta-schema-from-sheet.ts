// src/jobs/meta-schema-from-sheet.ts
import { AIAgent } from "../core/agent.js";   // נשמר לתאימות (לא בשימוש)
import { SheetsService } from "../services/sheets.js";

type MetaSchemaJobConfig = {
  spreadsheetId: string;
  sourceTab?: string;      // נשמר לתאימות בלבד, לא נשתמש בו (כמו במקור)
  metaRow?: number;        // default: 70
  schemaRow?: number;      // default: metaRow + 3
  metaStartCol?: string;   // default: "A"
  schemaCol?: string;      // default: "E"
};

type QAItem = { q: string; a: string };

export class MetaSchemaFromSheetJob {
  constructor(private _agent: AIAgent, private sheets: SheetsService) {}

  // === Utilities (כמו במקור) ===
  private extractJson(text: string): string {
    const first = text.indexOf("{");
    const last  = text.lastIndexOf("}");
    if (first >= 0 && last > first) return text.slice(first, last + 1);
    return text.trim();
  }

  private sanitizeHotelTitle(raw: string): string {
    const s0 = (raw ?? "").trim();
    let s = s0.replace(/\s*[\(\[\{](?:[^)\]\}]{0,40})[\)\]\}]\s*$/gi, "");
    s = s.replace(/\s*[-_.–—]\s*(updated|edited|final|copy|duplicate|draft|temp|bak|backup|ver\s*\d+|v\d+)\s*$/gi, "");
    s = s.replace(/\s*(נערך|מעודכן|עותק|העתק|מתוקן|טיוטה)\s*$/g, "");
    s = s.replace(/\s*(\(\s*\)|\[\s*\]|\{\s*\})\s*$/g, "");
    return s.trim();
  }

  private sanitizeOneLine(s: string): string {
    return (s ?? "").replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  private quoteA1Sheet(title: string): string {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  private collectQA(rows: string[][]): QAItem[] {
    const Q_COL = 1; // B
    const A_COL = 2; // C
    const out: QAItem[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const q = (row[Q_COL] ?? "").toString().trim();
      const a = (row[A_COL] ?? "").toString().trim();
      if (!q || !a) continue;
      out.push({ q, a });
    }
    return out;
  }

  private buildFaqJsonLd(qa: QAItem[]): object {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": qa.map(item => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": { "@type": "Answer", "text": item.a }
      }))
    };
  }

  // === Main ===
  async run(cfg: MetaSchemaJobConfig): Promise<void> {
    const metaRow      = cfg.metaRow ?? 70;
    const schemaRow    = cfg.schemaRow ?? (metaRow + 3);
    const metaStartCol = cfg.metaStartCol ?? "A";
    const schemaCol    = cfg.schemaCol ?? "E";

    // ⚠️ כמו במקור: מתבססים על הטאב הראשון בלבד (לא משתמשים ב-sourceTab)
    const firstTabTitle = await this.sheets.getFirstSheetTitle(cfg.spreadsheetId);
    const tabA1 = this.quoteA1Sheet(firstTabTitle);

    // קריאה של כל השורות
    const rows = await this.sheets.readValues(cfg.spreadsheetId, `${tabA1}!A:Z`);
    if (rows.length === 0) throw new Error(`Source tab "${firstTabTitle}" is empty`);

    // שם המלון מנוקה מרעשים
    const rawTitle  = await this.sheets.getSpreadsheetTitle(cfg.spreadsheetId);
    const hotelName = this.sanitizeHotelTitle(rawTitle);

    // Q/A עבור סכמת FAQ
    const qa = this.collectQA(rows);
    if (qa.length === 0) throw new Error(`No Q/A rows found in tab "${firstTabTitle}"`);

    const metaTitle = this.sanitizeOneLine(`FAQ | ${hotelName}`);
const h1        = this.sanitizeOneLine(`FAQ about ${hotelName}`);
let   metaDesc  = this.sanitizeOneLine(
  `Find answers to frequently asked questions about ${hotelName}. ` +
  `Learn about check-in times, parking, Wi-Fi, location, amenities, and more.`
);

    // אופציונלי: לשמור על 160 תווים כמו שהיית רגילה
    if (metaDesc.length > 160) metaDesc = metaDesc.slice(0, 160).trim();

    // ✅ סכמת FAQ (ללא שינוי לוגיקה)
    const schemaObj    = this.buildFaqJsonLd(qa);
    const schemaPretty = JSON.stringify(schemaObj, null, 2);
    const schemaWrapped =
`<script type="application/ld+json">
${schemaPretty}
</script>`;

    // כתיבה ל-Sheet: מטא
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${metaStartCol}${metaRow}`, [
      ["Meta Title", "Meta Description", "H1"],
    ]);
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${metaStartCol}${metaRow + 1}`, [
      [metaTitle, metaDesc, h1],
    ]);

    // ריווח
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${schemaCol}${schemaRow - 1}`, [[""]]);

    // כתיבת סכמת FAQ
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${schemaCol}${schemaRow}`, [
      ["FAQ Schema (JSON-LD)"],
    ]);
    await this.sheets.writeValues(cfg.spreadsheetId, `${tabA1}!${schemaCol}${schemaRow + 1}`, [
      [schemaWrapped],
    ]);

    // עיצוב כמו FAQ
    await this.sheets.formatSheetLikeFAQ(cfg.spreadsheetId, firstTabTitle);
  }
}