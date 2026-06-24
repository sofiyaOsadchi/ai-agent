# FAQ Builder UX Spec - Builder Page Only

Created: 2026-06-06
Scope: `public/faq-playground.html` as the manual FAQ Workflow Builder page in Editor view.

## מטרת המסמך

המסמך מיועד ליועץ UX שצריך להבין את עמוד ה-FAQ Builder כפי שהוא היום במצב Editor. המטרה היא לעזור לתכנן עמוד ברור, אינטואיטיבי ומקצועי יותר לבניית workflow שמייצר שאלות FAQ, תשובות, בדיקות איכות ופלט Google Sheet.

הבעיה המרכזית אינה חוסר יכולת טכנית. הבילדר כבר כולל הרבה יכולות מתקדמות. הבעיה היא שהמשתמש רואה הרבה הגדרות, מקורות, פרומפטים, קטגוריות וכלי הרצה ביחד, ולא תמיד ברור מה חובה, מה אופציונלי, מה נשמר אוטומטית, ומה משפיע בפועל על הסוכן.

## קבצים רלוונטיים

### `public/faq-playground.html`

הקובץ המרכזי של הבילדר. הוא כולל:

- HTML של כל עמוד הבילדר.
- CSS ראשי בתוך תגית `<style>` בתחילת הקובץ.
- JavaScript של state, presets, category rendering, task rendering, source settings, demand mining, save/load/run.
- קישור ל-`/mobile-responsive.css` עבור מסכים עד 760px.
- קישורים ל-assets וקבצים משותפים שהעמוד צריך בזמן טעינה מקומית.

### `public/mobile-responsive.css`

קובץ CSS חיצוני שמשפיע על תצוגת mobile. יש בו אזור ספציפי ל-`.faq-builder-page`, כולל topbar, tabs, run strip ו-layout צר.

### `public/user-profile.js`

רכיב shared topbar/profile. רלוונטי רק לאזור העליון: שם משתמש, avatar, מצב טעינה ושמירה.

### `public/index.html`

עמוד הבית של הכלים. מכיל קישור ל-FAQ Builder. אינו מגדיר את חוויית הבילדר עצמה.

## מטרת המוצר

ה-FAQ Builder נועד לאפשר למשתמש ליצור workflow איכותי לבניית FAQ:

1. להזין נושא אחד או כמה נושאים.
2. לבחור workflow type.
3. להגדיר שפה, קהל יעד, מודל ומספר שאלות.
4. להגדיר מקורות מחקר וכללי מקור.
5. להשתמש ב-GA4/Search Console כאותות ביקוש לשאלות, לא כמקור עובדתי.
6. לשלוט בקטגוריות השאלות.
7. לערוך או להפעיל משימות workflow.
8. להריץ agent שמייצר פלט, בדרך כלל Google Sheet.
9. לשמור או לטעון תוכנית עבודה.

## קהל יעד משוער

- אנשי SEO ותוכן שרוצים לייצר שאלות FAQ מבוססות intent אמיתי.
- מנהלי לקוחות או אנשי agency שמריצים את אותו workflow על הרבה נכסים.
- משתמשים טכניים למחצה שיודעים מה הם רוצים לקבל, אבל לא רוצים לערוך פרומפטים ארוכים.
- משתמשים מתקדמים שרוצים שליטה מלאה על מקורות, קטגוריות ומשימות.

## מבנה העמוד הנוכחי

### 1. Header

כולל לוגו Carmelon, שם הכלי, תיאור קצר, סטטוס שמירה ופרופיל משתמש.

בעיה UX:

- הסטטוס "Saved in browser" נראה כמו סטטוס מערכת כללי, אבל לא מסביר מה נשמר, איפה, ומה לא נשמר.
- אין הבחנה ברורה בין browser autosave לבין saved account plan.

המלצה:

- להציג סטטוס שמירה בשפה פעולה: "Draft saved locally" / "Account plan loaded".
- להוסיף affordance קטן שמסביר ש-local draft אינו תוכנית שמורה בחשבון.

### 2. View tabs

יש שני טאבים:

- `Editor`
- `Guided setup`

במסמך זה מתייחסים רק ל-Editor.

בעיה UX:

- הטאב של Guided setup נראה שווה ערך לעורך, אבל בפועל המשתמש צריך להבין מה ההבדל בין עורך מלא לבין תהליך מקוצר.

המלצה לעמוד הבילדר:

- אם נשארים שני טאבים, Editor צריך להרגיש כמו "Full editor" ולא כמו ברירת מחדל סתמית.
- אפשר לשקול שהעורך יהיה מחולק לשלבים פנימיים גם בתוך מצב Editor.

### 3. Workflow setup

זהו החלק המרכזי בתחילת העמוד. הוא כולל:

- מדדי header: Subjects, Categories, Tasks, Model.
- Workflow type:
  - Hotels
  - Product / service
  - Vehicle models
- Subjects / topics.
- Subject history.
- Main model.
- Question target.
- Output language.
- Audience.
- Words to avoid.
- Global sources.
- Official website URL.
- Advanced source policy.
- Optional question helper.
- Sheet name preview.

בעיה UX:

- יותר מדי decisions באותו אזור.
- חלק מהשדות הם חובה, חלק אופציונליים, וחלק מתקדמים, אך כולם מקבלים משקל חזותי דומה.
- Workflow type משנה categories, audience, source rules ו-task prompts מיד, אבל קשה להבין שזה קרה.
- Subjects הוא input מרכזי, אבל מוקף בכלים מתקדמים שמסיחים את המשתמש.

המלצה:

לחלק את Workflow setup לשלושה bands ברורים:

1. Basics:
   - Workflow type
   - Subjects
   - Output language
   - Question target

2. Audience and Guardrails:
   - Audience
   - Words to avoid
   - Naming/source factuality note

3. Research and Demand Signals:
   - Research sources
   - Official website URL
   - Search demand helper
   - Advanced source policy

## Workflow type

המצב הנוכחי טוב יותר מהמצב הקודם: אין יותר כפתור "Apply setup from topics". שלושת כפתורי ה-workflow type הם המקור האמיתי לשינוי setup.

התנהגות נוכחית:

- לחיצה על preset מעדכנת categories.
- לחיצה על preset מעדכנת task prompt notes.
- כאשר `updateFields` מופעל, היא מעדכנת גם audience, source rules ו-source chips.

בעיה UX:

- אין feedback מספיק ברור אחרי בחירת preset.
- המשתמש לא רואה "מה השתנה".
- אם המשתמש כבר ערך שדות, לא ברור אם preset החליף אותם או שמר אותם.

המלצה:

- אחרי החלפת workflow type, להציג micro-summary קצר:
  - "Updated categories, task guidance, and source rules for Hotels."
- אם שדה נערך ידנית, לשקול להציג "Keep my edits / Apply preset defaults".
- להציג את preset ההקשרי בשורת summary: "Hotel FAQ workflow".

## Subjects / Topics

התנהגות נוכחית:

- ניתן להזין כמה נושאים בשורות נפרדות או מופרדים בפסיקים.
- subject history מציע נושאים קודמים ככפתורים בודדים.
- sheet name preview נוצר אוטומטית מה-subject.

בעיה UX:

- המשתמש עלול לא להבין אם כמה subjects ירוצו יחד או כ-jobs נפרדים.
- subject history יכול להיראות כמו autocomplete, אבל בפועל הוא מוסיף נושא.
- sheet preview מופיע נמוך מדי יחסית להחלטה המרכזית.

המלצה:

- לנסח ליד input:
  - "Each line becomes a separate run."
- להציג counter קרוב לשדה:
  - "3 separate runs".
- להציג sheet preview או output naming preview צמוד יותר ל-subjects.

## Core Controls

### Main model

בחירה גלובלית של המודל. יש גם אפשרות ברמת כל task להשתמש במודל אחר או inherit.

בעיה UX:

- לא ברור למה משתמש רגיל צריך לבחור מודל בשלב מוקדם.
- לא ברור מה ההבדל בין o3, gpt-5.5, gpt-5.4 וכו'.

המלצה:

- להציג ברירת מחדל פשוטה: "Balanced".
- להעביר בחירת מודל מתקדמת לאזור advanced, או לפחות לתת תיאור קצר: speed / quality / writing.

### Question target

בחירת טווח:

- Lean 10-15
- Standard 20-30
- Deep 30-45
- Full 45-60

המלצה:

- זה control טוב. כדאי להשאיר אותו ב-Basics.
- לשנות label ל-"FAQ size" או "Question volume" כדי שיהיה ברור יותר.

### Output language

בחירת שפת הפלט.

המלצה:

- להשאיר ב-Basics.
- אם subject או source בשפה אחרת, ייתכן שכדאי להציג בעתיד auto-detect suggestion.

## Audience

התנהגות נוכחית:

- שדה טקסט פתוח.
- preset hotel ממלא: "Guests before booking, guests before arrival, and in-house guests".

בעיה UX:

- זהו שדה חשוב מאוד לאיכות השאלות, אבל הוא נראה כמו input רגיל.
- אין הצעות מוכנות לפי workflow type.

המלצה:

- להפוך ל-combobox או chips:
  - Guests before booking
  - Guests before arrival
  - Existing customers
  - Buyers comparing options
  - Service prospects
  - Vehicle buyers
- לאפשר free text אחרי בחירת chips.

## Words to Avoid

התנהגות נוכחית:

- נמצא בתוך details compact.
- נשמר רק אם נטען מתוכנית שמורה/JSON/assistant handoff, ולא אמור להיטען אוטומטית מטיוטה ישנה.
- משפיע על prompts ועל output polish.

בעיה UX:

- השדה חשוב כסוג של brand/legal guardrail, אבל מוסתר יחסית.
- לא ברור אם הוא חל על שאלות, תשובות או כל workflow.

המלצה:

- למקם תחת "Guardrails".
- label ברור:
  - "Avoid these words everywhere"
- helper:
  - "One phrase per line. Applied to questions, answers, and final review."

## Research Sources

התנהגות נוכחית:

המשתמש יכול לבחור:

- Official website
- Google Business Profile
- OTAs
- Public reviews
- Competitors

בנוסף יש:

- Official website URL
- Advanced source policy

בעיה UX:

- source chips מערבבים מקור עובדתי ומקורות לגילוי intent.
- Official website URL נראה כמו עוד שדה, למרות שהוא קריטי לשמות מדויקים ומידע עובדתי.
- Advanced source policy הוא טקסט פרומפטי, לא user-friendly.

המלצה:

- להפריד בין:
  - Factual source of truth
  - Intent discovery sources
- Official website URL צריך להיות השדה המרכזי של source of truth.
- Reviews/OTAs/Competitors צריכים להיות מסומנים כ-"Question discovery only" או "Intent signals".
- Advanced source policy צריך להיות collapsed תחת "Advanced".

## Search Demand Helper

התנהגות נוכחית:

החלק נקרא:

- Optional question helper
- Use search phrases for guidance

כולל:

- Auto mine toggle
- Google Analytics toggle
- Search Console toggle
- Date range
- Top phrases
- Questions per phrase
- Search Console site
- Find opportunities
- Metrics: matched queries, matched pages, FAQ opportunities, noise/rejected
- רשימת opportunities לבחירה

התנהגות חשובה:

- Auto mine אמור להכניס לבריף רק opportunities חזקות ולא מסוכנות.
- Search Console/GA4 הם question-demand signals בלבד.
- הם אינם מקור עובדתי לתשובות.

בעיה UX:

- זה אחד החלקים הכי חשובים לאיכות השאלות, אבל הוא מוסתר תחת details.
- הכותרת "Use search phrases for guidance" לא משקפת את הערך: בניית FAQ לפי ביקוש אמיתי.
- המונחים GA4/Search Console טכניים מדי למשתמש לא טכני.
- Auto mine יכול להיות דולק בלי שהמשתמש מבין מה יקרה בזמן run.

המלצה:

- להציג כ-card ברור: "Real search demand".
- להראות status פשוט:
  - "Auto mining is on"
  - "Will scan each subject during run"
  - "Uses Search Console + GA4"
- להפריד בין automatic mode לבין manual review:
  - Automatic: agent mines strong opportunities.
  - Manual: open and choose specific opportunities.
- להוסיף warning/status אם Search Console site חסר.

## Workflow Tasks

התנהגות נוכחית:

העמוד מציג stack של tasks. לכל task יש:

- enabled toggle.
- title/description.
- provider/model controls.
- output mode.
- user prompt.
- system prompt או default instructions.
- variables.
- expand/collapse.

המשימות המרכזיות הן workflow steps ליצירת שאלות, תשובות, בדיקות ופוליש.

בעיה UX:

- Tasks הם החלק הכי טכני בעמוד.
- משתמשים רגילים כנראה לא רוצים לראות פרומפטים מלאים כברירת מחדל.
- עריכת prompt מלאה עלולה לפגוע באיכות ה-workflow.
- לא ברור אילו tasks חובה ואילו אופציונליים.

המלצה:

- להציג task list במצב summary:
  - Step number
  - What it does
  - Enabled/disabled
  - Output destination
  - Last customized indicator
- להסתיר prompt editor תחת "Advanced prompt editor".
- להציע "Add guidance" במקום "Replace prompt" למשתמש רגיל.
- להציג dependency:
  - Task 2 depends on questions from Task 1.
  - QA tasks depend on generated answers.

## Categories

התנהגות נוכחית:

- Preset categories משתנות לפי workflow type.
- לכל category יש enabled, target/range, description, intents.
- קיימים tools ל-apply range, expand all, collapse all.

בעיה UX:

- קטגוריות הן חשובות, אבל עבור משתמש רגיל הן נראות כמו עוד אזור עריכה מורכב.
- לא ברור אם category target משפיע על מספר השאלות הכולל או רק על distribution.
- כמות הקטגוריות יכולה ליצור עומס.

המלצה:

- להציג categories כ-"Question mix".
- לתת summary:
  - "7 categories active"
  - "Balanced across booking, rooms, location..."
- להציג advanced details רק בפתיחה.
- להסביר ש-question target הוא היעד הכולל, ו-categories מכוונות את התמהיל.

## Sticky Run Strip

התנהגות נוכחית:

ה-run strip כולל:

- Run summary.
- Plan dock.
- Rename/copy plan controls.
- Reset.
- Run FAQ Workflow.

בעיה UX:

- זה אזור חשוב וטוב, אבל הוא מנסה לעשות גם save/load plan וגם run.
- "Unsaved plan" יכול להרגיש כמו שגיאה גם אם browser draft שמור.
- לא ברור מה ההבדל בין plan לבין current browser state.

המלצה:

- לפצל חזותית:
  - Left: readiness summary.
  - Middle: plan state.
  - Right: primary run action.
- להשתמש במילים:
  - "Local draft saved"
  - "No account plan selected"
- להציג blockers:
  - "Add at least one subject"
  - "Enable at least one task"
  - "Official URL recommended"

## Outputs

התנהגות נוכחית:

- Plans and generated files מופיעים אחרי הרצות.
- ניתן clear all.
- artifacts נשמרים ב-localStorage עד גבול זמן/כמות.

בעיה UX:

- Outputs בסוף העמוד, אבל הם קשורים לתוצאה של הרצה.
- לא ברור אם output הוא Google Sheet, JSON plan, או artifact אחר.

המלצה:

- להציג output type badges.
- אחרי run מוצלח, להעלות output summary קרוב ל-run strip או להציג toast/action.

## State and Saving

התנהגות נוכחית:

- Browser state נשמר ב-localStorage תחת schema version.
- Outputs נשמרים ב-localStorage.
- Subject history נשמר בנפרד.
- Account plans נטענים דרך API ומייצגים תוכנית שמורה.
- Words to avoid לא אמור להשתחזר מדראפט browser רגיל, אלא רק ממקור מכוון כמו תוכנית שמורה, JSON או handoff.

בעיה UX:

- המשתמש לא רואה בבירור מה נשמר מקומית ומה נשמר כתוכנית.
- Reset יכול להיות מפחיד כי לא ברור מה הוא מוחק.

המלצה:

- להוסיף save model ברור:
  - Local draft: automatic.
  - Account plan: explicit save.
  - Export JSON: optional advanced.
- Reset dialog צריך לפרט:
  - Clears local draft for this browser.
  - Does not delete account plans unless explicitly selected.

## Payload and Run Contract

כאשר מריצים workflow, ה-builder שולח socket event:

```js
socket.emit("start-agent", {
  mode: "faq-playground",
  subjects,
  tasks,
  faqDemand
});
```

`subjects` מגיעים משדה topics.

`tasks` מגיעים מ-task cards פעילים, כולל:

- task id.
- title.
- provider.
- model.
- system prompt.
- user prompt.
- output options.
- source rules.
- selected demand brief.
- forbidden phrases.
- official source URL.

`faqDemand` כולל:

- enabled.
- websiteUrl.
- dateRange.
- GA4 settings.
- Search Console settings.
- maxPhrases.
- questionsPerPhrase.
- limit.

משמעות UX:

- כל control שמופיע בעמוד צריך להיות קשור בבירור לאחד משלושת חלקי payload:
  - Subjects
  - Tasks
  - Demand signals
- אם control אינו משפיע על payload, הוא לא צריך להיות בולט.

## Pain Points מרכזיים

1. העמוד נראה כמו כלי פנימי חזק, לא כמו flow שמוביל משתמש.
2. אין היררכיה חזקה בין חובה, מומלץ ואופציונלי.
3. יש יותר מדי טקסט פרומפטי חשוף.
4. מקורות עובדתיים ומקורות intent מעורבבים חזותית.
5. Auto mine הוא feature מרכזי אבל מוסבר כמו helper צדדי.
6. תוכניות, דראפטים ופלטים לא מובחנים מספיק.
7. המשתמש לא מקבל preview פשוט של מה הסוכן יעשה לפני Run.

## הצעת ארגון מחדש

### Section 1: Plan Basics

מטרה: להגיע מהר ל-ready state.

שדות:

- Workflow type.
- Subjects.
- Output language.
- FAQ size.
- Audience.

Summary:

- "3 subjects will run separately"
- "Hotel workflow"
- "20-30 questions each"

### Section 2: Evidence and Source Rules

מטרה: להבהיר מאיפה מגיעות השאלות ומאיפה מגיעות העובדות.

שדות:

- Official website URL as source of truth.
- Intent discovery sources.
- Search demand auto mine status.
- Advanced source policy collapsed.

Copy מומלץ:

- "Use official sources for facts."
- "Use Search Console/GA4 only to discover what people ask."

### Section 3: Question Mix

מטרה: לשלוט בתמהיל בלי להציף.

שדות:

- Category summary.
- Active categories count.
- Optional category editor.
- Apply global range.

Default:

- Closed summary mode.

### Section 4: Workflow Steps

מטרה: לתת ביטחון במה יקרה, בלי לדרוש עריכת prompt.

תצוגה:

- Step cards collapsed by default.
- Each card shows purpose, enabled state, output target.
- Advanced prompt editor hidden.

### Section 5: Review and Run

מטרה: לפני הרצה, להראות exactly what will happen.

Checklist:

- Subjects count.
- Workflow type.
- Sources selected.
- Official URL status.
- Demand mining status.
- Active tasks.
- Expected output.

CTA:

- Run FAQ Workflow.

## Recommended Labels

הצעות ניסוח:

- `Workflow setup` -> `FAQ Plan`
- `Subjects / topics` -> `Topics to run`
- `Question target` -> `FAQ size`
- `Global sources` -> `Research and source rules`
- `Official website URL` -> `Official source of truth`
- `Optional question helper` -> `Real search demand`
- `Question-generation categories` -> `Question mix`
- `FAQ workflow` -> `Workflow steps`
- `Plans and generated files` -> `Outputs`

## UX Definition of Done

גרסת UX טובה יותר של הבילדר צריכה לעמוד בתנאים הבאים:

1. משתמש חדש מבין תוך 10 שניות מה חובה להזין כדי להריץ.
2. משתמש מבין מה ההבדל בין official factual source לבין GA4/Search Console demand signals.
3. בחירת workflow type מבהירה מה השתנה.
4. אין צורך לפתוח prompt editor כדי להשתמש בבילדר.
5. Auto mine ברור גם כשה-helper סגור.
6. Save state ברור: local draft מול saved plan.
7. Run strip מציג readiness ולא רק כפתורים.
8. Categories נתפסות כתמהיל שאלות, לא כמערכת ניהול מורכבת.
9. Mobile אינו מציג control חשוב מתחת ל-run strip או במיקום בלתי נגיש.
10. לפני Run יש preview ברור של הפעולה שה-agent עומד לבצע.

## שאלות פתוחות ליועץ UX

1. האם הבילדר צריך להיות single-page עם progressive disclosure, או wizard/editor hybrid?
2. האם Search demand צריך להיות visible status קבוע במקום details סגור?
3. האם Tasks צריכים להופיע למשתמש רגיל, או רק כ-Advanced?
4. האם Categories צריכות להופיע לפני Workflow steps או אחריהן?
5. האם Save/Plans צריכים להיות חלק מה-topbar או מה-run strip?
6. כמה technical copy המשתמש צריך לראות כדי לסמוך על התוצאה?
