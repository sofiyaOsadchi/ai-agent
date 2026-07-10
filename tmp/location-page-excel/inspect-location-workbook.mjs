import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/osadchi/Desktop/ai-agent/outputs/location-page-demo-excel/Leonardo_Munich_Location_Content_verified.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

const sheets = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 4000,
});
console.log("SHEETS");
console.log(sheets.ndjson);

const content = await workbook.inspect({
  kind: "table",
  range: "'Location content'!A1:M30",
  include: "values,formulas",
  tableMaxRows: 30,
  tableMaxCols: 13,
  tableMaxCellChars: 1200,
  maxChars: 50000,
});
console.log("CONTENT");
console.log(content.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log("ERRORS");
console.log(errors.ndjson);
