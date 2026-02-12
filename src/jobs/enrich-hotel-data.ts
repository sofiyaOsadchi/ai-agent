import { SheetsService } from "../services/sheets.js";
import chalk from "chalk";

export type EnrichConfig = {
  faqSpreadsheetId: string;
  faqTabName: string;
  hotelsSpreadsheetId: string;
  hotelsTabName?: string;
  
  questionColIndex: number; 
  targetHotelCol: string;   
  targetCountryCol: string; 
};

type HotelRef = {
  name: string;
  country: string;
  cleanName: string;
};

export class EnrichHotelDataJob {
  constructor(private sheets: SheetsService) {}

  private normalize(str: string): string {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  async run(cfg: EnrichConfig): Promise<void> {
    console.log(chalk.blue(`🚀 Starting Hotel Enrichment (Smart Mode)...`));

    // --- 1. Load Hotels ---
    const hotelTab = cfg.hotelsTabName || await this.sheets.getFirstSheetTitle(cfg.hotelsSpreadsheetId);
    const hotelRows = await this.sheets.readValues(cfg.hotelsSpreadsheetId, `${hotelTab}!A:B`);
    
    const hotels: HotelRef[] = hotelRows
      .filter(row => row[0] && row[0].trim().length > 0 && row[0] !== "Hotel Name")
      .map(row => ({
        name: String(row[0]).trim(),
        country: row[1] ? String(row[1]).trim() : "Unknown",
        cleanName: this.normalize(String(row[0]))
      }));

    hotels.sort((a, b) => b.cleanName.length - a.cleanName.length);
    console.log(chalk.green(`✅ Loaded ${hotels.length} hotels.`));

    // --- 2. Load FAQ ---
    console.log(chalk.yellow(`📥 Loading FAQ data from "${cfg.faqTabName}"...`));
    const faqRows = await this.sheets.readValues(cfg.faqSpreadsheetId, `${cfg.faqTabName}!A:Z`);
    if (!faqRows || faqRows.length === 0) throw new Error("FAQ Sheet is empty");

    const updates: string[][] = [];
    updates.push([ "Enriched Hotel Name", "Enriched Country" ]); 

    // משתנים לשמירת ה"אחרון שנמצא"
    let lastFoundHotel: string = "";
    let lastFoundCountry: string = "";
    
    // מעקב סטטיסטי
    let directMatches = 0;
    let inheritedMatches = 0;
    const missingRowsIndices: number[] = []; // רשימת השורות שלא נמצא להן כלום

    // --- 3. Process Rows ---
    for (let i = 1; i < faqRows.length; i++) {
      const row = faqRows[i];
      const rawQuestion = row[cfg.questionColIndex] ? String(row[cfg.questionColIndex]) : "";
      const cleanQuestion = this.normalize(rawQuestion);

      let foundHotel: HotelRef | undefined;

      // ניסיון איתור ישיר
      if (cleanQuestion.length > 3) { 
        foundHotel = hotels.find(h => cleanQuestion.includes(h.cleanName));
      }

      if (foundHotel) {
        // מצאנו! מעדכנים את ה"אחרון ידוע"
        lastFoundHotel = foundHotel.name;
        lastFoundCountry = foundHotel.country;
        
        updates.push([ foundHotel.name, foundHotel.country ]);
        directMatches++;
      } else {
        // לא מצאנו...
        if (lastFoundHotel) {
          // יש לנו אחד בזיכרון? נשתמש בו (פולואפ)
          updates.push([ lastFoundHotel, lastFoundCountry ]);
          inheritedMatches++;
          missingRowsIndices.push(i + 1); // +1 כדי שיתאים למספר השורה באקסל
        } else {
          // אין לנו אפילו בזיכרון (כנראה השורות הראשונות בקובץ)
          updates.push([ "", "" ]);
        }
      }
    }

    // --- 4. Write back ---
    console.log(chalk.magenta(`✍️  Writing back...`));
    await this.sheets.writeValues(cfg.faqSpreadsheetId, `${cfg.faqTabName}!${cfg.targetHotelCol}1`, updates.map(u => [u[0]]));
    await this.sheets.writeValues(cfg.faqSpreadsheetId, `${cfg.faqTabName}!${cfg.targetCountryCol}1`, updates.map(u => [u[1]]));

    // --- 5. Summary Report ---
    console.log(chalk.green(`🎉 Done!`));
    console.log(`- Direct Matches (found in text): ${directMatches}`);
    console.log(`- Inherited Matches (follow-ups): ${inheritedMatches}`);
    console.log(`- Total Covered: ${directMatches + inheritedMatches} / ${faqRows.length - 1}`);
    
    if (missingRowsIndices.length > 0) {
        console.log(chalk.yellow(`\n⚠️  Rows that used "Inherited" name (Check manually if needed):`));
        // מדפיס רק את ה-50 הראשונים כדי לא להציף את המסך, אם יש המון
        console.log(missingRowsIndices.slice(0, 100).join(", ") + (missingRowsIndices.length > 100 ? "..." : ""));
    }
  }
}