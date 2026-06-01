# Carmelon AI Agent

מערכת TypeScript/Node.js להפעלת סוכני AI סביב Google Sheets, Google Drive, FAQ של מלונות, תרגום, QA, formatting ודוחות לקוח. המערכת בנויה משני נתיבי עבודה עיקריים:

1. ממשק web demo מקומי תחת `public/`, שמפעיל jobs דרך Socket.IO.
2. הרצות CLI לפי `MODE`, דרך `src/index.ts`.

התיעוד הזה הוא נקודת כניסה מהירה. לתיעוד handoff עמוק יותר לצ'אט חדש קראו את קבצי הידע תחת `docs/knowledge/`.

## Quick Start

```bash
npm install
npm run demo-ui
```

שרת ה-demo עולה על `http://localhost:3000/index.html` כברירת מחדל. אם `PORT` מוגדר בסביבה, הוא ישתמש בו במקום 3000.

פקודות שימושיות:

```bash
npm run build
npm run demo-ui
npm run translate-demo
npm run translate
npm run rewrite
npm run validate-lite
npm run faq-audit
npm run qa-lang-master
```

הרצה ישירה של מצב:

```bash
MODE=sheet-utilities npx tsx src/index.ts
```

## Local Snapshots

יש בפרויקט מנגנון גרסאות מקומי, אבל לא יוצרים snapshot אוטומטית ולא לפני כל שינוי. יוצרים גרסה מקומית רק אחרי פיצ׳ר משמעותי שהמשתמש בדק, אישר ואהב, ורק אחרי אישור מפורש לשמור גרסה.

```bash
npm run snapshot -- "approved checkpoint after translate chat"
npm run snapshot:list
npm run snapshot:restore -- <snapshot-id> --force
```

מה נשמר:

- `src/`
- `public/`
- `prompts/`
- `docs/`
- `scripts/`
- `README.md`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.gitignore`

מה לא נשמר בכוונה:

- `.env`
- `src/credentials/`
- `node_modules/`
- `dist/`
- `.git/`
- `.local-history/`

ה-snapshots נשמרים מקומית תחת `.local-history/`, והתיקייה מוחרגת מ-git. שחזור מחליף את הנתיבים המנוהלים, ולכן הוא דורש `--force`. לפני כל שחזור הסקריפט יוצר snapshot נוסף של המצב הנוכחי.

## Project Guardrails

כללי עבודה מחייבים לפרויקט הזה:

- כל שינוי ב-`src/index.ts` דורש אישור נפרד ומפורש לפני עריכה.
- אין לערוך את `src/core/agent.ts` או את `src/services/sheets.ts`. אם נדרש שינוי שם, יש לשלוח הצעה/patch טקסטואלי לאישור במקום לערוך ישירות.
- אין לגשת ל-`.env` או ל-`src/credentials/`.
- אין לערוך את `package.json`. אם נדרש שינוי scripts/dependencies, יש לשלוח מה לשנות ולקבל אישור.
- כל שינוי שמשפיע רוחבית על הפרויקט דורש אישור מיוחד נוסף.
- מוקד העבודה הנוכחי הוא קבצי HTML תחת `public/` וקבצי jobs שתומכים בהם תחת `src/jobs/`.
- אין ליצור snapshot מקומי בלי אישור מפורש מהמשתמש. Snapshot מיועד לסיום פיצ׳ר משמעותי אחרי בדיקה ואישור, לא לכל שינוי.
- שחזור snapshot הוא פעולה רחבה ודורש אישור מפורש.

## Environment

המערכת תלויה בגישה ל-OpenAI ול-Google APIs.

קובץ `.env` טיפוסי:

```bash
OPENAI_API_KEY=...
OWNER_EMAIL=...
GOOGLE_APPLICATION_CREDENTIALS=./src/credentials/service-account.json
DEV_USER_EMAIL=
FIRST_ADMIN_EMAIL=
FIRESTORE_PROJECT_ID=
PORT=3000
```

הערות חשובות:

- `src/services/sheets.ts` מחפש credentials ב-`GOOGLE_APPLICATION_CREDENTIALS`, ואם לא קיים אז ב-`./src/credentials/service-account.json`.
- `OWNER_EMAIL` משמש כ-subject של Google JWT delegation.
- `DEV_USER_EMAIL` מאפשר זיהוי משתמש רק בהרצה מקומית, כשאין IAP header.
- `FIRST_ADMIN_EMAIL` מקבל role של `admin` ביצירת המשתמש, וגם המשתמש הראשון ב-Firestore נוצר כ-admin.
- `FIRESTORE_PROJECT_ID` מכוון את Firebase Admin לפרויקט Firestore הרצוי בלי hardcode בקוד.
- אל תכניסו credentials או קבצי service account לתיעוד או לקומיטים.
- רוב ה-jobs כותבים ישירות ל-Google Sheets. בממשקים שתומכים בזה, התחילו ב-`dryRun`.

## Web Demo

נקודת הכניסה היא:

```bash
npm run demo-ui
```

השרת נמצא ב-`src/server-demo.ts`. הוא מגיש את `public/`, מאזין ל-Socket.IO event בשם `start-agent`, בונה משתני סביבה דינמיים, ואז מריץ child process:

```bash
npx tsx src/index.ts
```

עמודי UI קיימים:

| URL | Mode | תפקיד |
| --- | --- | --- |
| `/index.html` | hub | מסך הבית לכל הכלים |
| `/faq-playground.html` | `faq-playground` | Creator Studio לשרשור prompts ויצירת FAQ Sheets |
| `/translate-demo.html` | `translate-demo` | תרגום דינמי עם glossary, terminology ו-prompts מה-UI |
| `/design-formatting.html` | `design-formatting` | פעולות formatting/cleanup על Sheets או תיקיות |
| `/sheet-utilities.html` | `sheet-utilities` | פעולות data utility כמו lookup, injection, cross-check, coverage |
| `/client-reports.html` | `client-reports` | בניית dashboard/report מנתוני קמפיינים ב-Sheet |
| `/client-reports-edit.html` | `client-reports-edit` | עריכת insight blocks בעזרת AI |

## Architecture

```text
public/*.html
  -> socket.emit("start-agent", payload)
src/server-demo.ts
  -> MODE + DYNAMIC_PAYLOAD + DYNAMIC_TARGET_ID + DYNAMIC_LANGS
  -> spawn("npx", ["tsx", "src/index.ts"])
src/index.ts
  -> switch לפי MODE
  -> job.run(...)
src/jobs/*
  -> SheetsService / AIAgent / helper subjobs
Google Sheets / Drive / OpenAI
```

קבצי תשתית מרכזיים:

- `src/index.ts` - router ראשי לכל מצבי ההפעלה. רוב קונפיגורציות ה-CLI hardcoded כאן.
- `src/server-demo.ts` - שרת Express + Socket.IO ל-demo UI.
- `src/core/agent.ts` - עטיפה סביב OpenAI Responses API / Chat Completions.
- `src/services/sheets.ts` - Google Sheets/Drive helper, כולל read/write, batch update, folders, tabs, formatting ו-backoff.
- `src/services/docs.ts` - Google Docs helper בסיסי.
- `src/config/safety.ts` - מגבלות קריאות API ומשימות.
- `src/jobs/subjobs/*` - מודולים משותפים: glossary, terminology, report calculations, preview events ועוד.

## Main Modes

מצבי web payload:

| Mode | Job | קובץ UI |
| --- | --- | --- |
| `faq-playground` | `runFaqPlayground` | `public/faq-playground.html` |
| `translate-demo` | `TranslateFromSheetDemoJob` | `public/translate-demo.html` |
| `design-formatting` | `DesignFormattingJob` | `public/design-formatting.html` |
| `sheet-utilities` | `SheetUtilitiesJob` | `public/sheet-utilities.html` |
| `client-reports` | `ClientReportsJob` | `public/client-reports.html` |
| `client-reports-edit` | `ClientReportsEditJob` | `public/insight-editor.js` |

מצבי CLI חשובים:

| Mode | תפקיד |
| --- | --- |
| `translate` | תרגום Sheets לפי קונפיג ב-`src/index.ts` |
| `rewrite` | rewrite/QA של תשובות לפי הערות לקוח |
| `validate-lite` | בדיקת FAQ קלה וכתיבת issue/fix |
| `meta-schema` | יצירת meta title/description/schema מתוך FAQ Sheet |
| `inject-meta-schema` | הזרקת meta/schema ממלונות אל master |
| `faq-audit` | סריקת אתרי Leonardo ובדיקת FAQ/schema |
| `faq-audit-structure` | audit מבני של FAQ באתר |
| `qa-lang-master` | QA דטרמיניסטי למאסטר מתורגם |
| `qa-master-triage` | סינון issues אמיתיים בעזרת AI |
| `qa-master-apply-fixes` | החלת fixes מטאב triage חזרה למאסטר |
| `master-coverage` | דוח coverage בין master לבין Sheets מקור |
| `inject-lang` | הזרקת תרגומי שפה מתיקיית hotel sheets אל master |
| `semantic-match-unmatched` | embedding match לשורות unmatched |
| `vlookup-hebrew` | העתקת עברית מתוך unmatched לפי question/master row |
| `inject-hebrew-from-unmatched` | הזרקת עברית ל-master מתוך טאב unmatched |
| `qa-hebrew-injection` | QA לתהליך הזרקת עברית |
| `sheet-utilities` | סט פעולות utilities גנריות על Sheets |
| `client-reports` | יצירת preview JSON לדוח לקוח |

ראו פירוט מלא ב-`docs/knowledge/02-modes-and-jobs.md`.

## Data Contracts

חוזים מרכזיים:

- `MODE` קובע איזו זרימה תרוץ ב-`src/index.ts`.
- `DYNAMIC_PAYLOAD` הוא JSON מה-UI. בחלק מה-modes זה ה-input היחיד.
- `DYNAMIC_TARGET_ID`, `DYNAMIC_INPUT_TYPE`, `DYNAMIC_LANGS` משמשים בעיקר לתרגום ולכלים דינמיים.
- `design-formatting` מדפיס preview events עם prefix:

```text
CARMELON_PREVIEW_EVENT_JSON=
```

השרת מזהה את השורות האלה ושולח אותן ל-UI כ-`preview-event`, בלי להציג JSON ענק ב-terminal.

`client-reports` ו-`client-reports-edit` מחזירים JSON דרך markers:

```text
CLIENT_REPORT_RESULT_JSON_START
CLIENT_REPORT_RESULT_JSON_END
CLIENT_REPORT_EDIT_RESULT_JSON_START
CLIENT_REPORT_EDIT_RESULT_JSON_END
```

## Knowledge Files

קבצי הידע נועדו להמשך עבודה בצ'אט חדש:

- `docs/knowledge/00-handoff.md` - תקציר handoff והקשר מיידי.
- `docs/knowledge/01-architecture.md` - מפת מערכת וזרימות runtime.
- `docs/knowledge/02-modes-and-jobs.md` - inventory של modes, scripts ו-jobs.
- `docs/knowledge/03-data-contracts.md` - payloads, env vars, schemas ו-markers.
- `docs/knowledge/04-development-notes.md` - איך להוסיף mode, debug, known issues וצ'קליסטים.

## Known Caveats

- `src/index.ts` גדול מאוד ומשלב routing, קונפיגורציות hardcoded והרצות בפועל. לפני שינוי mode, בדקו גם את הקונפיג בראש הקובץ וגם את ענף ה-`MODE` הרלוונטי.
- יש כפילות בענף `tid-hotel-in-question` ב-`src/index.ts`.
- `src/server-demo.ts` כולל helper בשם `createStreamHandler` ו-`flushStreamBuffer`, אבל הזרימה בפועל משתמשת כרגע בלוגיקה inline דומה.
- `package.json` עובד, אבל העיצוב שלו לא אחיד.
- אין לערוך את `src/index.ts` או `package.json` בלי אישור נפרד ומפורש.
- אין כרגע test suite מוגדר ב-`package.json`.
- `dist/` קיים כפלט build; מקור האמת הוא `src/`.
- מנגנון local snapshots נמצא ב-`scripts/local-version.mjs`; מריצים אותו רק אחרי אישור מפורש מהמשתמש.

## Suggested Workflow

1. קראו קודם את `README.md` ואת `docs/knowledge/00-handoff.md`.
2. אל תיצרו snapshot בלי אישור מפורש מהמשתמש.
3. אם עובדים על UI flow, פתחו את `src/server-demo.ts`, את קובץ ה-HTML המתאים, ואת ה-job המתאים.
4. אם עובדים על CLI mode, מותר לקרוא את `src/index.ts`, אבל עריכה שלו דורשת אישור נפרד.
5. התחילו ב-`dryRun` בכל job שתומך בזה.
6. אחרי שינוי TypeScript, הריצו:

```bash
npm run build
```
