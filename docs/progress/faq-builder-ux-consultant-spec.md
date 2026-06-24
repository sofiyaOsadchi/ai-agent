# אפיון UX: FAQ Workflow Builder

תאריך: 2026-06-06  
מסך: `public/faq-playground.html`  
מצב גיבוי: `.local-history/snapshots/2026-06-06T00-00-00+0300__faq-builder-before-chat-ux-spec`

## מטרת המסמך

המסמך נועד ליועץ UX שצריך להבין את ה-FAQ Builder, לזהות למה העמוד עדיין לא מספיק אינטואיטיבי, ולתכנן גרסה ברורה יותר של העורך ושל Guided setup chat.

המסמך מתאר:

- מה הבילדר עושה היום.
- אילו קבצי frontend מרכיבים אותו.
- מה ה-flow הידני ומה ה-flow בצ'אט.
- אילו הגדרות הצ'אט מכסה היום ואילו לא.
- הצעה לארגון חדש של הצ'אט כך שיהיה קצר יותר, חכם יותר ומקיף יותר.

## תמונת מצב מוצרית

ה-FAQ Builder בונה workflow ליצירת FAQ Sheet. המשתמש מזין נושא אחד או יותר, בוחר workflow type, מגדיר מקורות, שפה, audience, טווח שאלות, קטגוריות ומשימות, ואז מריץ agent שיוצר Google Sheet.

התוצר הסופי הרצוי הוא FAQ שימושי ומקורקע:

- שאלות שמבוססות על intent אמיתי ולא על category headings גנריים.
- תשובות קצרות, מועילות ומבוססות מקורות.
- סימון ברור של עובדות שלא אומתו.
- אפשרות להשתמש ב-GA4/Search Console כ-question-demand signals בלבד.
- הפרדה בין "אותות ביקוש לשאלות" לבין "מקורות עובדתיים לתשובות".

## קבצי frontend רלוונטיים

### `public/faq-playground.html`

הקובץ המרכזי. כולל:

- HTML של כל המסך.
- CSS פנימי גדול לעיצוב העמוד.
- JavaScript פנימי לניהול מצב, presets, קטגוריות, משימות, שמירה, הרצה, תוכניות ו-FAQ demand helper.
- טעינה של `user-profile.js` ושל `faq-builder-chatbot.js`.

אזורים עיקריים:

- Header: לוגו, שם המוצר, סטטוס שמירה, user profile.
- Tabs: `Editor` ו-`Guided setup`.
- `setupPanel`: workflow type, subjects, model, target, language, audience, words to avoid, research sources, official URL, Search Console/GA4 helper.
- `workflowPanel`: כרטיסי משימות לעריכת prompts, models, source policy ו-output mode.
- `categoryPanel`: קטגוריות יצירת שאלות, טווחים ו-intents.
- `outputsPanel`: תוכניות שמורות וקבצים שנוצרו.
- Sticky run bar: Plans, plan name, duplicate, reset, run.
- Rail ימני: reading map, what will run now, outputs, run log.

### `public/faq-builder-chatbot.js`

ה-state machine של Guided setup. זהו flow לינארי שממלא חלק מהשדות בעורך דרך `window.faqBuilderBridge`.

הוא כולל:

- `defaultAnswers`
- רשימת `steps`
- chat transcript ב-localStorage
- quick replies
- multi-select steps
- summary panel
- mapping מהתשובות לשדות בעורך

### `public/user-profile.js`

רכיב shared של פרופיל משתמש שמתווסף ל-topbar. לא חלק מהלוגיקה של ה-FAQ, אבל משפיע על header, spacing ועל תחושת "חשבון/תוכניות".

### `public/mobile-responsive.css`

CSS רספונסיבי כללי. יש בו חוקים ספציפיים ל-`.faq-builder-page`. חשוב לבדוק אותו בכל שינוי UX, כי חלק מהחוקים עדיין מזכירים כפתורים ישנים כמו `downloadPlanBtn` / `copyPlanBtn`.

### `public/index.html`

דף הבית שמקשר ל-FAQ Builder דרך card:

- Title: `FAQ Workflow Builder`
- URL: `/faq-playground.html`
- Mode: `faq-playground`

## חוזה הרצה ו-state

הרצה מהעורך שולחת:

```json
{
  "mode": "faq-playground",
  "subjects": ["..."],
  "tasks": [...],
  "faqDemand": {...}
}
```

נקודות חשובות:

- `subjects` הם הישויות/עמודים/מוצרים עצמם, לא קטגוריות.
- `tasks` הם חמשת שלבי העבודה, עם `id`, `enabled`, `system`, `user`, `model`, `provider`.
- `faqDemand` מפעיל mining אוטומטי של GA4/Search Console אם Auto mine דולק.
- `Official website URL` נשמר ב-controls ומשמש גם ל-source policy וגם fallback ל-Search Console site.
- `Words to avoid` נטען רק מתוכנית שמורה/import/assistant handoff, לא מ-browser draft רגיל.

## Workflow ידני קיים

### 1. Workflow type

כפתורי workflow type הם עכשיו מקור האמת:

- `Hotels`
- `Product / service`
- `Vehicle models`

לחיצה על סוג workflow צריכה לעדכן מיד:

- categories
- audience
- source instructions
- task prompt notes

הכפתור `Apply setup from topics` הוסר בכוונה. אין יותר auto-infer לפי subject.

### 2. Subjects / topics

שדה טקסט חופשי. תומך בכמה subjects דרך שורות או פסיקים. כרגע יש subject history שמוסיף topics קודמים בלי להחליף את הטקסט הקיים.

סיכון UX:

- Placeholder כולל דוגמאות מעורבות: hotel, car, CRM. זה יכול לגרום למשתמש לחשוב שמותר לערבב סוגים באותו run.
- בפועל, אם workflow type אחד משפיע על כל categories/prompts, ערבוב נושאים מסוגים שונים באותו run עלול לייצר עבודה לא מדויקת.

המלצה:

- להסביר ליד השדה: "Use multiple subjects only when they share the same workflow type."
- אם יש כמה subjects, להציג chip/indicator: "Same setup will run for all subjects."

### 3. Core controls

שדות קיימים:

- Main model
- Question target
- Output language
- Audience
- Words to avoid
- Research sources
- Official website URL
- Advanced source policy
- Search phrase helper

סיכון UX:

- יש יותר מדי החלטות קריטיות באותו אזור.
- חלק מההגדרות הן "תוכנית עבודה" וחלק הן "מקורות להרצה", אבל הן מוצגות ברצף אחד.
- המשתמש לא תמיד מבין מה נשמר אוטומטית בדפדפן ומה נשמר כ-Plan.

המלצה:

- לחלק ל-3 קבוצות ברורות:
  - Subject & workflow
  - Evidence & sources
  - Output & quality
- להציג badge קטן ליד שדות: `Autosaved` / `Saved in plan` / `Runtime only`.

### 4. Research sources ו-Official URL

הכוונה המוצרית טובה:

- `Official website` הוא מקור עובדות.
- GBP/OTAs/Reviews/Competitors יכולים לשמש בעיקר ל-question intent, לא להמצאת עובדות.

פער UX:

- לא מספיק ברור ש-Search Console/GA4 אינם מקורות עובדתיים.
- Official website URL הוא קריטי לשמות מדויקים ואימות, אבל נראה כמו עוד input רגיל.

המלצה:

- להפוך Official URL לשדה מודגש יותר: "Primary factual source".
- ליד GA4/Search Console לכתוב "Question demand only".
- להציג warning אם Auto mine דולק ואין Official URL.

### 5. Search phrase helper

ה-helper כולל:

- Auto mine
- GA4/Search Console toggles
- Date range
- Top phrases
- Questions per phrase
- Search Console site
- Find opportunities
- FAQ opportunities result list

כוונה מוצרית:

- במצב אוטומטי, הריצה סורקת כל subject ומוסיפה רק opportunities חזקות, low-risk, query-supported.
- raw phrases לא הופכים אוטומטית לשאלות.

פער UX:

- זה אחד הדברים הכי חשובים במוצר, אבל הוא תחת details "Optional question helper".
- אם המשתמש לא פותח אותו, הוא לא מבין שה-agent כן ישתמש בו אוטומטית.

המלצה:

- להפוך אותו לסטטוס קומפקטי גלוי: `Search demand: Auto mine ON`.
- אם פותחים, להציג "What will happen on run" ולא רק controls.
- להפריד בין "automatic mining during run" לבין "manual preview scan".

### 6. Workflow tasks

חמש משימות:

1. Research questions
2. Write answers
3. Duplicate check
4. Source verification
5. Grammar and answer fit

המשתמש יכול לפתוח כל task, לערוך model, tone, sources, system prompt, user prompt ו-output mode.

סיכון UX:

- זה אזור מאוד כוחני למשתמש מתקדם, אבל מפחיד למשתמש רגיל.
- "System prompt" ו-"Agent work instructions" נשמעים טכניים.
- עריכת prompts דרך הצ'אט מחליפה prompt מלא, וזה מסוכן.

המלצה:

- ברירת מחדל: להציג task cards במצב "summary only".
- לפתוח prompt editor תחת "Advanced".
- הצ'אט לא צריך לבקש "replace main prompt" כברירת מחדל. במקום זה הוא צריך להוסיף structured guidance blocks.

### 7. Categories

הקטגוריות הן guidance פנימי ל-question generation.

סיכון UX:

- משתמשים עלולים לחשוב שאלה יהיו ה-FAQ questions עצמן.
- המיקום אחרי Workflow גורם לזה להיראות אופציונלי מדי, אבל categories משפיעות מאוד על Task 1.

המלצה:

- לקרוא לאזור "Question coverage plan" במקום "Question-generation categories".
- להציג summary גלוי: enabled categories + target style.
- לאפשר "coverage template" לפי workflow type.

## Guided setup chat קיים

הצ'אט היום הוא flow לינארי:

1. scope
2. subjects
3. audience
4. language
5. count
6. sources
7. naming
8. questionBrief
9. questionTone
10. answerBrief
11. answerTone
12. qaChecks
13. categories
14. optional custom category count
15. optional custom categories
16. optional promptTasks
17. optional taskPrompt replacement

הצ'אט ממפה תשובות לעורך דרך:

- `subjects`
- `outputLanguage`
- `questionCountMode`
- `questionCount`
- `sourceInstructions`
- `namingPolicy`
- `namingRules`
- `audience`
- `sourceOptions`
- `categories`
- prompt guidance blocks
- task enablement
- optional full prompt replacement

## בעיות בצ'אט הנוכחי

### 1. הצ'אט לא תואם לעורך הנוכחי

עדיין קיימות אפשרויות:

- `Local business` ב-scope.
- `Local business set` ב-categories.

אבל העורך הידני מציג רק:

- Hotels
- Product / service
- Vehicle models

זה מייצר חוסר אמון: הצ'אט מציע דבר שאין לו workflow אמיתי בעורך.

### 2. יותר מדי שאלות לפני value

המשתמש עובר הרבה שלבים לפני שהוא מבין מה באמת עומד להיווצר. הצ'אט שואל על tone, answer brief, categories ו-prompt replacement, אבל לא מציג מספיק מוקדם "זו התוכנית שנבנתה".

### 3. הצ'אט לא שואל על Official website URL

זה אחד השדות החשובים ביותר לדיוק עובדתי, אבל Guided setup לא אוסף אותו.

הוא גם לא מבצע הבחנה ברורה בין:

- factual source
- question-demand source
- competitor/review inspiration

### 4. הצ'אט לא מכסה Search Console/GA4

אין שאלות על:

- Auto mine on/off
- האם להשתמש ב-GA4
- האם להשתמש ב-Search Console
- Search Console site
- date range
- מה לעשות אם אין signals

זה פער גדול, כי היום Search Console/GA4 הם חלק מרכזי מהאיכות של שאלות FAQ.

### 5. הצ'אט לא מכסה Words to avoid

הצ'אט יכול לקבל forbidden phrases רק דרך handoff חיצוני. Guided setup עצמו לא שואל על זה.

המלצה:

- לשאול שאלה אופציונלית קצרה: "Any exact words or phrases to avoid?"
- ברירת מחדל: skip.

### 6. prompt replacement מסוכן מדי

הצ'אט שואל אם להחליף prompt מלא למשימות. זה מתאים למפתח/מומחה, לא למשתמש רגיל.

סיכון:

- המשתמש עלול למחוק משתנים חיוניים כמו `{{subject}}`, `{{last}}`, `{{answersTsv}}`.
- החלפת prompt מלא שוברת את ה-workflow בלי שהמשתמש מבין.

המלצה:

- להסיר מה-flow הראשי.
- להעביר ל-Advanced chat action: "Add special instruction to a step".
- אם מאפשרים replacement מלא, להציג validation לפני שמירה.

### 7. אין adaptive flow חכם

הצ'אט שואל כמעט אותו דבר לכל workflow type.

המלצה:

- אחרי בחירת workflow type, להתאים את השאלות:
  - Hotels: official hotel URL, guest journey, property policies, Search Console site.
  - Vehicle: market/region, model year, official manufacturer/spec source, comparison intent.
  - Product/service: pricing/support/comparison/source authority.

### 8. אין progress ברור

יש summary, אבל אין stepper או phase labels. משתמש לא יודע אם נשארו שתי שאלות או עשר.

המלצה:

- להציג "Step 2 of 5" או phase labels:
  - Basics
  - Evidence
  - Output
  - QA
  - Review

## הצעה ל-flow חדש לצ'אט

המטרה: להפוך את הצ'אט ל-wizard חכם, לא שאלון ארוך.

### Phase 1: Basics

שאלות:

1. What are we building?
   - Hotels
   - Product / service
   - Vehicle models

2. What subject(s)?
   - textarea
   - warning: same workflow type only

3. Output language?
   - quick replies

4. Audience preset?
   - auto-default לפי workflow type
   - אפשרות edit

מה מתעדכן:

- workflow type
- subjects
- language
- audience
- categories/prompt notes לפי preset

### Phase 2: Evidence & Source Rules

שאלות:

1. Primary factual source URL?
   - input
   - optional skip, אבל עם warning

2. Which source types may inspire questions?
   - Official website
   - GBP
   - OTAs
   - Reviews
   - Competitors

3. Should search-demand mining run automatically?
   - Yes, use GA4/Search Console automatically
   - Manual only
   - Off

4. If auto/manual: date range and source toggles
   - Last 90 days default
   - GA4 on/off
   - Search Console on/off

מה מתעדכן:

- `officialSourceUrl`
- `sourceOptions`
- `sourceInstructions`
- `faqDemand.enabled`
- `faqDemand.analytics.enabled`
- `faqDemand.searchConsole.enabled`
- `faqDemand.dateRange`

### Phase 3: Output Shape

שאלות:

1. Question target
   - Lean 10-15
   - Standard 20-30
   - Deep 30-45
   - Quality first

2. Coverage template
   - default from workflow type
   - short/basic
   - custom

3. Any exact words/phrases to avoid?
   - skip by default
   - textarea if yes

מה מתעדכן:

- question target
- categories/category targets
- forbidden phrases

### Phase 4: QA & Safety

שאלות:

1. Which checks should run?
   - Duplicate check
   - Grammar and answer fit
   - Source verification

2. Strictness
   - Fast draft
   - Balanced
   - Verification-heavy

מה מתעדכן:

- enabled task ids
- QA guidance blocks
- optional source verification task

### Phase 5: Review & Run

במקום לשאול על prompt replacement, להציג review card:

- Subjects
- Workflow type
- Language
- Audience
- Official factual source
- Search demand mode
- Categories enabled
- Tasks enabled
- Words to avoid

פעולות:

- Open editor
- Save plan
- Run FAQ Workflow
- Add advanced instruction

## צ'אט חכם יותר: כללי החלטה

הצ'אט צריך להפסיק להיות רשימת שאלות זהה לכולם, ולעבוד לפי חוקים:

- אם workflow type הוא Hotels, default audience הוא guests.
- אם workflow type הוא Vehicle, לא להשתמש ב-hotel categories.
- אם אין Official URL, לא לחסום אבל לסמן "facts may need verification".
- אם Reviews/Competitors נבחרו, source instructions חייבים לומר שהם question inspiration בלבד.
- אם Auto mine דולק ואין Search Console site, להשתמש ב-Official URL fallback או להציג warning.
- אם יש יותר מ-subject אחד, להזהיר שכל subject יקבל אותו workflow setup.
- אם בוחרים Source verification, להפעיל Task 4.
- אם אין source verification, עדיין תשובות עם facts לא רשמיים צריכות לקבל `[VERIFY]`.

## המלצות UX לעמוד כולו

### 1. לחזק את ההיררכיה

כרגע הכל מרגיש חשוב באותה מידה. מומלץ להציג:

- "Required before run"
- "Recommended for better questions"
- "Advanced prompt controls"

### 2. להפוך את הצ'אט לדרך הראשית למשתמשים חדשים

במקום שהצ'אט יהיה tab צדדי, אפשר לשקול:

- Start screen עם שתי אפשרויות:
  - Guided setup
  - Advanced editor
- אחרי Guided setup, המשתמש מגיע ל-review/editor.

### 3. להפריד בין "תכנון" לבין "הרצה"

המשתמש צריך לדעת:

- מה נשמר בדפדפן
- מה נשמר כ-plan
- מה יישלח ל-agent רק בזמן run
- מה נוצר כ-Google Sheet

### 4. להפחית technical prompt exposure

Prompts הם כוח חשוב, אבל לא צריכים להיות מרכז החוויה למשתמש רגיל.

המלצה:

- task cards: summary first
- prompt editor: advanced
- chat: structured guidance, לא prompt replacement

### 5. להציג preview של "מה הסוכן יעשה"

לפני run, להציג:

- Task 1 will research questions using categories + search-demand opportunities.
- Task 2 will write answers from approved sources.
- Task 3 will check duplicates.
- Task 4 optional source verification.
- Task 5 optional grammar/answer fit.

## Definition of Done לגרסת UX הבאה

גרסת הצ'אט הבאה תיחשב טובה אם:

- אין אפשרויות workflow שלא קיימות בעורך.
- הצ'אט מכסה Official URL, Words to avoid ו-Search demand mode.
- אפשר לסיים setup בסיסי ב-5-7 החלטות.
- יש Review step ברור לפני פתיחת editor או run.
- הצ'אט לא מחליף prompts מלאים כברירת מחדל.
- כל החלטה בצ'אט מופיעה מיד בעורך וב-summary.
- ב-mobile אין אזורים שמרגישים מוסתרים או "תקועים".
- משתמש חדש מבין מה יישמר, מה ירוץ ומה ייווצר.

## שאלות פתוחות ליועץ UX

1. האם Guided setup צריך להיות tab בתוך העמוד או הכניסה הראשית?
2. האם "Workflow setup" צריך להיות wizard במקום long form?
3. כמה prompt-level controls נכון לחשוף למשתמש רגיל?
4. האם Search Console/GA4 helper צריך להיות גלוי תמיד כ-status, גם כשהוא סגור?
5. האם categories צריכות להופיע לפני workflow tasks?
6. האם rail הימני עוזר, או מוסיף עומס וצריך להפוך ל-review summary?
7. האם sticky run bar ברור מספיק, או שהוא צריך להפוך ל-final review/run drawer?

## המלצת יישום טכנית

לא לבצע redesign גדול בקפיצה אחת. מומלץ לעבוד בשלבים:

1. לסנכרן את `faq-builder-chatbot.js` עם שלושת workflow types הקיימים.
2. להוסיף לצ'אט Official URL, Words to avoid ו-Search demand mode.
3. להחליף prompt replacement ב-advanced guidance blocks.
4. להוסיף review step.
5. רק אחרי זה לשנות layout כולל בעורך.

קבצים שכדאי לערוך בשלב ראשון:

- `public/faq-builder-chatbot.js`
- `public/faq-playground.html`

קבצים לבדיקה אחרי שינוי:

- `public/mobile-responsive.css`
- `public/index.html`

בדיקות מומלצות:

- `npx tsc --noEmit`
- Playwright smoke ל-Editor ול-Guided setup
- אם נוגעים בצ'אט הכללי של assistant workspace: `node scripts/assistant-chat-regression.cjs`
