# Handoff For A New Chat

מסמך זה נועד לצ'אט חדש שצריך להמשיך לעבוד על הפרויקט בלי לאבד הקשר.

## One-Paragraph Summary

זהו פרויקט Node.js/TypeScript בשם `ai-agent` שמפעיל jobs סביב OpenAI, Google Sheets ו-Google Drive. יש שרת demo מקומי (`src/server-demo.ts`) שמגיש עמודי HTML מ-`public/` ומריץ את `src/index.ts` ב-child process עם `MODE` ו-`DYNAMIC_PAYLOAD`. `src/index.ts` הוא router גדול לכל המצבים: תרגום FAQ, יצירת FAQ, QA למאסטר, הזרקת תרגומים, formatting, sheet utilities ודוחות client reports. שכבות התשתית הן `AIAgent` ל-OpenAI ו-`SheetsService` ל-Google APIs.

## Start Here

קראו לפי הסדר:

1. `README.md`
2. `docs/knowledge/01-architecture.md`
3. `docs/knowledge/02-modes-and-jobs.md`
4. `docs/knowledge/03-data-contracts.md`
5. `docs/knowledge/04-development-notes.md`

אם המשימה קשורה ל-UI, פתחו גם:

- `src/server-demo.ts`
- קובץ ה-HTML הרלוונטי תחת `public/`
- ה-job המתאים תחת `src/jobs/`

למסך התרגום יש שכבת Guided Chat נפרדת:

- `public/translate-demo.html` - החיבור למסך וה-bridge ל-state הקיים.
- `public/translate-chatbot.js` - לוגיקת הצ'אט, שאלות מכוונות, parsing ומילוי הטופס.
- `public/translate-chatbot.css` - עיצוב הצ'אט.

אם המשימה קשורה להרצת CLI, פתחו:

- `src/index.ts`
- ה-job המתאים תחת `src/jobs/`

## User Guardrails

אלו כללי עבודה מחייבים מהמשתמש:

- כל שינוי ב-`src/index.ts` דורש אישור נפרד ומפורש לפני עריכה.
- אין לערוך את `src/core/agent.ts`.
- אין לערוך את `src/services/sheets.ts`.
- אם נדרש שינוי ב-`agent.ts` או `sheets.ts`, יש לשלוח למשתמש מה לשנות במקום לערוך ישירות.
- אין לגשת ל-`.env`.
- אין לגשת ל-`src/credentials/` או לקבצי credentials.
- אין לערוך את `package.json`; אם נדרש שינוי, יש לשלוח למשתמש את ההצעה.
- כל שינוי שמשפיע רוחבית על הפרויקט דורש אישור מיוחד נוסף.
- רוב העבודה הנוכחית אמורה להתמקד ב-`public/*.html` ובקבצי `src/jobs/*` שתומכים בהם.
- אין ליצור snapshot מקומי בלי אישור מפורש מהמשתמש.
- Snapshot מיועד לסיום פיצ׳ר משמעותי אחרי בדיקה ואישור, לא לכל שינוי קטן או התחלת עבודה.
- שחזור snapshot הוא פעולה רחבה ולכן דורש אישור מפורש לפני הרצה.

## Current Documentation Work

נוצרו קבצי תיעוד בלבד. לא שונתה לוגיקת runtime.

קבצים שנוספו/עודכנו:

- `README.md`
- `docs/knowledge/00-handoff.md`
- `docs/knowledge/01-architecture.md`
- `docs/knowledge/02-modes-and-jobs.md`
- `docs/knowledge/03-data-contracts.md`
- `docs/knowledge/04-development-notes.md`

## Critical Runtime Facts

- `npm run demo-ui` מריץ `tsx watch src/server-demo.ts`.
- השרת פותח את `/index.html` אוטומטית בסביבת non-production.
- כל UI שולח `socket.emit("start-agent", payload)`.
- השרת מעביר payload ל-child process דרך env:
  - `MODE`
  - `DYNAMIC_PAYLOAD`
  - `DYNAMIC_TARGET_ID`
  - `DYNAMIC_INPUT_TYPE`
  - `DYNAMIC_LANGS`
- `src/index.ts` קורא את `MODE` ומפעיל ענף מתאים.
- רוב קונפיגורציות ה-CLI hardcoded ב-`src/index.ts`.
- `SheetsService` דורש Google service account credentials.
- `AIAgent` דורש `OPENAI_API_KEY`.
- אין ליצור snapshot מקומי בלי אישור מפורש מהמשתמש.
- snapshots נשמרים תחת `.local-history/` ומוחרגים מ-git.
- למרות שיש מנגנון snapshot, אין לבצע restore בלי אישור מפורש כי הוא יכול להחליף קבצים רבים.

## Main Mental Model

```text
HTML page
  builds payload
  sends start-agent

server-demo.ts
  normalizes mode
  serializes payload
  starts npx tsx src/index.ts
  streams stdout/stderr to UI

index.ts
  creates SafetyManager, AIAgent, SheetsService
  selects MODE branch
  runs job

job
  reads/writes Google Sheets or Drive
  optionally calls OpenAI through AIAgent
  logs status and result markers
```

## Risk Areas

- Many jobs write to live Google Sheets. Prefer `dryRun` where available.
- `src/index.ts` contains real Google Sheet and Drive URLs/IDs. Treat it as operational config.
- Some jobs assume specific columns by index or letter. Check column contracts before running.
- `client-reports` and `client-reports-edit` rely on stdout JSON markers; changing logs around those markers can break UI parsing.
- `design-formatting` preview events rely on the exact `CARMELON_PREVIEW_EVENT_JSON=` prefix.
- There is no test suite configured. `npm run build` is the minimum verification.

## Good First Commands

```bash
rg --files
sed -n '1,220p' src/server-demo.ts
sed -n '645,1645p' src/index.ts
npm run build
```

## Local Rollback Workflow

מנגנון ה-snapshots נמצא ב-`scripts/local-version.mjs`. לא יוצרים snapshot אוטומטית; שומרים גרסה רק אחרי שהמשתמש אישר שהפיצ׳ר המשמעותי מוכן ורוצה נקודת חזרה.

פקודות:

```bash
npm run snapshot -- "approved checkpoint after feature"
npm run snapshot:list
npm run snapshot:restore -- <snapshot-id> --force
npm run snapshot:prune -- 20
```

הנתיבים המנוהלים הם `src`, `public`, `prompts`, `docs`, `scripts`, `README.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`.

לא מגובים: `.env`, `src/credentials`, `node_modules`, `dist`, `.git`, `.local-history`.

Restore מחליף את הנתיבים המנוהלים, ולכן הוא דורש `--force`; לפני restore נוצר snapshot אוטומטי של המצב הנוכחי.

## Current Known Code Smells

- `src/index.ts` is too large and mixes config, routing and orchestration.
- `tid-hotel-in-question` appears twice in the mode chain.
- `server-demo.ts` has unused stream helper functions while duplicated stream logic is implemented inline.
- `package.json` has inconsistent indentation.
- `dist/` exists but should not be treated as source of truth.
