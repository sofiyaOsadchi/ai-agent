// src/jobs/subjobs/preview-events.ts
// Shared preview event helpers for live UI previews.

export type PreviewChangeEvent = {
  kind: "change";
  fileName: string;
  spreadsheetId: string;
  tabName: string;
  cell: string;
  row: number;
  column: string;
  before: string;
  after: string;
};

export type PreviewPlanEvent = {
  kind: "plan";
  fileName: string;
  spreadsheetId: string;
  tabName?: string;
  title: string;
  details: string[];
};

export type SheetPreviewCell = {
  column: string;
  value: string;
  changed?: boolean;
  before?: string;
};

export type SheetPreviewRow = {
  rowNumber: number;
  cells: SheetPreviewCell[];
};

export type SheetPreviewEvent = {
  kind: "sheet_preview";
  fileName: string;
  spreadsheetId: string;
  tabName: string;
  rangeA1: string;
  columns: string[];
  rows: SheetPreviewRow[];
  changedCellsCount: number;
  badgeLabel?: string;
};

export type PreviewEvent = PreviewChangeEvent | PreviewPlanEvent | SheetPreviewEvent;

const PREVIEW_PREFIX = "CARMELON_PREVIEW_EVENT_JSON=";

export function printPreviewEvent(event: PreviewEvent): void {
  console.log(`${PREVIEW_PREFIX}${JSON.stringify(event)}`);
}

export function isPreviewEventLine(line: string): boolean {
  return line.trim().startsWith(PREVIEW_PREFIX);
}

export function parsePreviewEventLine(line: string): PreviewEvent | null {
  const clean = line.trim();

  if (!clean.startsWith(PREVIEW_PREFIX)) {
    return null;
  }

  const rawJson = clean.slice(PREVIEW_PREFIX.length);

  try {
    return JSON.parse(rawJson) as PreviewEvent;
  } catch {
    return null;
  }
}
