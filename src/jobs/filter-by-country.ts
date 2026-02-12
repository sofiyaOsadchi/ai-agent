import { SheetsService } from "../services/sheets.js";
import chalk from "chalk";

export type FilterCountryConfig = {
  sourceSpreadsheetId: string;
  sourceTabName: string;
  targetCountry: string;
  
  countryColIndex: number; // לפי איזו עמודה לסנן (מדינה)
  hotelColIndex: number;   // לפי איזו עמודה למיין (שם המלון) - 👈 חדש
};

export class FilterByCountryJob {
  constructor(private sheets: SheetsService) {}

  async run(cfg: FilterCountryConfig): Promise<void> {
    console.log(chalk.blue(`🚀 Starting Country Export Job: "${cfg.targetCountry}"`));

    // 1. קריאת נתונים
    const rows = await this.sheets.readValues(cfg.sourceSpreadsheetId, `${cfg.sourceTabName}!A:Z`);
    if (!rows.length) throw new Error("Source sheet is empty");

    // 2. סינון (Filtering)
    const header = rows[0]; 
    const dataRows = rows.slice(1);

    const filtered = dataRows.filter(row => {
      const countryInRow = row[cfg.countryColIndex];
      return String(countryInRow || "").toLowerCase().trim() === cfg.targetCountry.toLowerCase().trim();
    });

    console.log(chalk.cyan(`🔍 Found ${filtered.length} rows for ${cfg.targetCountry}.`));

    if (filtered.length === 0) {
      console.log(chalk.red("❌ No rows found. Check country name or column index."));
      return;
    }

    // 3. מיון (Sorting) - 👈 החלק החדש והחשוב
    console.log(chalk.yellow(`🔃 Sorting rows by Hotel Name (Column Index: ${cfg.hotelColIndex})...`));
    
    filtered.sort((rowA, rowB) => {
      // שליפת שם המלון משני השורות
      const hotelA = String(rowA[cfg.hotelColIndex] || "").toLowerCase();
      const hotelB = String(rowB[cfg.hotelColIndex] || "").toLowerCase();
      
      // השוואה אלפביתית
      if (hotelA < hotelB) return -1;
      if (hotelA > hotelB) return 1;
      return 0;
    });

    // 4. יצירת קובץ
    const newFileName = `FAQ Export - ${cfg.targetCountry}`;
    console.log(chalk.yellow(`🆕 Creating new Spreadsheet: "${newFileName}"...`));

    const newSheetId = await this.createSpreadsheet(newFileName);
    
    console.log(chalk.green(`✅ File created! ID: ${newSheetId}`));
    console.log(chalk.underline(`https://docs.google.com/spreadsheets/d/${newSheetId}/edit`));

    // 5. כתיבה
    console.log(chalk.magenta(`✍️  Writing sorted data...`));
    const outputData = [header, ...filtered];
    
    // כתיבה לגיליון הראשון
    await this.sheets.writeValues(newSheetId, `A1`, outputData);

    console.log(chalk.green(`🎉 Export completed & sorted!`));
  }

  // Helper
  private async createSpreadsheet(title: string): Promise<string> {
    const sheetsClient = (this.sheets as any).sheets; 
    if (!sheetsClient) {
        throw new Error("Could not access google sheets client from service");
    }

    const res = await sheetsClient.spreadsheets.create({
      requestBody: {
        properties: {
          title: title,
        },
      },
    });
    return res.data.spreadsheetId;
  }
}