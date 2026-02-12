// terminology-management.ts

export type LangKey =
    | "en" | "de" | "es" | "nl" | "it" | "fr" | "pl" | "ru" | "he" | "zh" | "ar";

export type TerminologyMapRule = {
  forbidden: string;
  preferred: string;
  reason?: string;
  tags?: string[];
};

export type FewShotExample = {
  draft: string;
  polish: string;
  note?: string;
  tags?: string[];
};


export type TerminologyProfile = {
    // soft deterministic mapping - the model should obey but keep grammar/cases/gender/etc.
    mappings?: TerminologyMapRule[];

    // grammar/syntax fixes shown via examples (best for inflections and phrasing)
    examples?: FewShotExample[];
};

export type TerminologyManagement = Record<LangKey, TerminologyProfile>;

// Separation is absolute: each language has its own isolated profile.
// Everything is defined from English intent, but applied in target language output.
export const TERMINOLOGY_MANAGEMENT: TerminologyManagement = {
    en: {
        mappings: [
            { forbidden: "Free", preferred: "Complimentary", reason: "Hospitality standard phrasing." },
            { forbidden: "Reception", preferred: "Front Desk", reason: "Hospitality standard in EN-US." },
        ],
        examples: [
            {
                draft: "Yes, there is a pool.",
                polish: "Yes, the hotel offers a pool.",
                note: "Avoid robotic 'There is'. Keep upscale tone.",
            },
        ],
    },

    de: {
        mappings: [
            // === EXISTING MAPPINGS ===
            { forbidden: "Haus", preferred: "Hotel", reason: "Do not refer to the property as 'Haus'." },
            { forbidden: "Hausgäste", preferred: "Hotelgäste", reason: "Avoid 'Hausgäste'." },
            { forbidden: "in ca.", preferred: "in etwa", reason: "Prefer natural German." },
            { forbidden: "Ernährungswünsche", preferred: "Ernährungsbedürfnisse" },
            { forbidden: "eigenes Badezimmer", preferred: "en-suite Badezimmer", reason: "Keep 'en-suite' explicit." },
            { forbidden: "Familienreisende", preferred: "Familien", reason: "Natural German; avoid literal translation of 'family travelers'." },
            { forbidden: "Bügeleisen und brett", preferred: "Bügeleisen und Bügelbrett", reason: "Grammar fix." },
            { forbidden: "Gepäckaufbewahrungsregelung", preferred: "Gepäckaufbewahrung", reason: "Natural phrasing for guests." },
            { forbidden: "aufgeführt", preferred: "angeboten", reason: "Avoid saying 'listed'; act as the provider, not an observer." },
            { forbidden: "Wie lauten die regulären", preferred: "Wann sind die regulären", reason: "Avoid stiff template 'Wie lauten ...?'. Prefer natural 'Wann ...?'" },
            { forbidden: "Wie lautet die Stornierungsregelung", preferred: "Wie sind die Stornierungsbedingungen", reason: "More natural and standard phrasing in hotel FAQs." },
            { forbidden: "steht ... bereit", preferred: "steht ... zur Verfügung", reason: "Prefer standard hospitality phrasing." },
            { forbidden: "auf Wunsch", preferred: "auf Anfrage", reason: "Standard hospitality phrasing for requests." },

            // === NEW MAPPINGS — cover orphaned examples ===
            { forbidden: "Fitnessstudio", preferred: "Fitnessraum", reason: "Prefer hotel-typical 'Fitnessraum' unless official label is 'Fitnessstudio'." },
            { forbidden: "besitzt", preferred: "verfügt über", reason: "Prefer standard hospitality verb 'verfügt über' over 'besitzt'." },
            { forbidden: "mittags", preferred: "", reason: "Remove unnecessary 'mittags' after explicit time like '12:00 Uhr'. The time itself is clear." },
            { forbidden: "Same-Day", preferred: "am selben Tag", reason: "Avoid English terms in German. Use 'mit Rückgabe am selben Tag'." },
            { forbidden: "Mitarbeitenden", preferred: "Personal", reason: "Use 'das Personal' for natural hotel tone; avoids HR-style wording." },
            { forbidden: "Frühstücksangebote", preferred: "Frühstücksoptionen", reason: "More standard hotel phrasing." },
            { forbidden: "In-Room-Dining", preferred: "Zimmerservice", reason: "Use consistent German term; avoid mixed English." },
            { forbidden: "Room-Service", preferred: "Zimmerservice", reason: "Use consistent German term." },
            { forbidden: "engagiert", preferred: "", reason: "Avoid 'engagiert(e)' for reception. Rephrase to 'Rezeptionsteam steht ... zur Verfügung'." },
            { forbidden: "arrangiert", preferred: "bereitgestellt", reason: "Avoid 'arrangiert'; prefer 'bereitgestellt', 'eingerichtet', or 'nach vorheriger Absprache'." },
            { forbidden: "zu Fuß zurückgelegt werden", preferred: "zu Fuß zurücklegen", reason: "Prefer natural active 'lässt sich ... zurücklegen' over passive." },
            { forbidden: "Haustür", preferred: "Hotel", reason: "Avoid metaphorical 'von der Haustür'. Use factual 'vom Hotel'." },
            { forbidden: "durchgehend 24 Stunden", preferred: "rund um die Uhr", reason: "Prefer concise, natural 24/7 phrasing." },
            { forbidden: "Unterstützung gewährleistet", preferred: "steht zur Verfügung", reason: "Prefer guest-focused phrasing over generic 'Unterstützung gewährleistet'." },
            { forbidden: "Wie lautet", preferred: "Wie sind", reason: "Avoid stiff 'Wie lautet/lauten'; prefer natural question forms." },
            // === NEW MAPPINGS — uncovered issues from current DE output ===

{ 
  forbidden: "Early Check-in", 
  preferred: "früher Check-in", 
  reason: "Avoid English hospitality terms; use natural German phrasing." 
},
{
  forbidden: "(Italienisch, Russisch, Spanisch, Kroatisch)",
  preferred: "(Italienisch, Russisch, Spanisch und Kroatisch)",
  reason: "In Aufzählungen im Deutschen vor dem letzten Element 'und' verwenden (statt nur Kommas).",
},
{
  forbidden: "sorgen für Barrierefreiheit und Komfort für Gäste mit eingeschränkter Mobilität",
  preferred: "sorgen für einen barrierefreien und komfortablen Aufenthalt für Gäste mit eingeschränkter Mobilität",
  reason: "Natürlicher und idiomatischer im Hotelkontext, vermeidet das abstrakte Substantiv 'Barrierefreiheit' in dieser Satzstruktur.",
},
{
  forbidden: "Hallenschwimmbad",
  preferred: "Innenpool",
  reason: "Im Hotelkontext ist 'Innenpool' die gängigere Bezeichnung als 'Hallenschwimmbad'.",
},

{ 
  forbidden: "Late Check-out", 
  preferred: "später Check-out", 
  reason: "Avoid English hospitality terms; use natural German phrasing." 
},
{ 
  forbidden: "(Ortszeit)", 
  preferred: "", 
  reason: "Redundant after explicit times; standard hotel German omits it." 
},
{ 
  forbidden: "zu erfolgen", 
  preferred: "", 
  reason: "Overly bureaucratic phrasing; prefer natural forms like 'erfolgt bis'." 
},
{ 
  forbidden: "Anlage", 
  preferred: "Hotel", 
  reason: "Avoid property-style wording; 'Hotel' is the standard hospitality term." 
},
{ 
  forbidden: "Front-Office-Team", 
  preferred: "Rezeptionsteam", 
  reason: "Avoid Denglish; use standard German hotel terminology." 
},
{ 
  forbidden: "Front Office", 
  preferred: "Rezeption", 
  reason: "Avoid English terminology in German hotel copy." 
},
{ 
  forbidden: "Gym", 
  preferred: "Fitnessraum", 
  reason: "Avoid English; 'Fitnessraum' is the typical hotel term." 
},
{ 
  forbidden: "mehrsprachigen Service", 
  preferred: "mehrsprachige Unterstützung", 
  reason: "Avoid generic 'Service'; prefer guest-focused wording." 
},
{ 
  forbidden: " – ", 
  preferred: "-", 
  reason: "Avoid spaced en dashes in numeric ranges; use hyphen without spaces (e.g., 6-25)." 
},
{
  forbidden: "kostenlos",
  preferred: "kostenfrei",
  reason: "Preferred wording in upscale hotel communication."
},
{
  forbidden: "nur Frühstück",
  preferred: "ausschließlich Frühstück",
  reason: "Prefer more polished hospitality tone."
},
{
  forbidden: "warm-kaltes",
  preferred: "warmes und kaltes",
  reason: "Use natural coordinated adjectives in German."
},
{
  forbidden: "muss bis",
  preferred: "erfolgt bis",
  reason: "Avoid regulatory tone; prefer neutral hospitality phrasing."
},
{
  forbidden: "mehrsprachigen Service",
  preferred: "mehrsprachige Unterstützung",
  reason: "Avoid generic 'Service'; prefer natural guest-focused phrasing."
},
{
  forbidden: "Ortszeit",
  preferred: "",
  reason: "Redundant in hotel FAQs; local time is assumed."
},
{
  forbidden: "auf dem Gelände",
  preferred: "vor Ort",
  reason: "More natural hotel phrasing."
}
        ],
        examples: [
            {
                draft: "Gibt es im Haus kostenloses WLAN?",
                polish: "Bietet das Hotel kostenloses WLAN?",
                note: "Avoid 'Haus'. Prefer natural verb like 'bietet'.",
            },
            {
                draft: "Ja, auf Wunsch bereitet das Restaurant vegetarische und vegane Speisen zu.",
                polish: "Ja, auf Anfrage bereitet das Restaurant vegetarische und vegane Gerichte zu.",
                note: "In dietary context, 'Gerichte' often sounds more natural than 'Speisen'. Keep 'auf Anfrage'.",
            },
            {
                draft: "Sind Familienreisende willkommen?",
                polish: "Sind Familien mit Kindern im Hotel herzlich willkommen?",
                note: "Avoid 'Familienreisende'. Use 'Familien mit Kindern' for a warmer tone.",
            },
            {
                draft: "Gibt es im Hotel ein Fitnessstudio?",
                polish: "Gibt es im Hotel einen Fitnessraum?",
                note: "Prefer the more hotel-typical term 'Fitnessraum' unless the official label is 'Fitnessstudio'.",
            },
            {
                draft: "Ja, Kinder dürfen in Begleitung von Erwachsenen die Bar betreten.",
                polish: "Ja, Kinder dürfen die Bar in Begleitung von Erwachsenen betreten.",
                note: "Better word order for natural German flow.",
            },
            {
                draft: "Es sind keine speziellen Kinderaktivitäten aufgeführt.",
                polish: "Nein, es werden derzeit keine speziellen Kinderaktivitäten angeboten.",
                note: "Never use 'not listed'. Speak as the hotel: 'not offered'.",
            },
            {
                draft: "Welche Gepäckaufbewahrungsregelung gilt?",
                polish: "Gibt es im Hotel eine Gepäckaufbewahrung?",
                note: "Rephrase technical terms into natural guest questions.",
            },
            {
                draft: "Das Hotel bietet gegen Gebühr Parkplätze.",
                polish: "Das Hotel bietet Parkplätze direkt am Hotel gegen eine Gebühr an.",
                note: "Be precise about location (vor Ort / direkt am Hotel).",
            },
            {
                draft: "Verfügt jedes Zimmer im Leonardo Hotel Köln über einen Safe?",
                polish: "Gibt es in jedem Zimmer des Leonardo Hotel Köln einen Safe?",
                note: "Prefer direct 'Gibt es ...?' question form in FAQs.",
            },
            {
                draft: "Ja, das Hotel besitzt eine Bar für Gäste (in der Regel abends geöffnet).",
                polish: "Ja, das Hotel verfügt über eine Bar, die in der Regel abends geöffnet ist.",
                note: "Prefer 'verfügt über' and avoid parentheses-heavy phrasing.",
            },
            {
                draft: "Welche Gepäckaufbewahrungsregelung gilt im {HOTEL_NAME} für frühe Ankünfte oder späte Abreisen?",
                polish: "Gibt es im {HOTEL_NAME} eine Gepäckaufbewahrung für frühe Ankünfte oder späte Abreisen?",
                note: "Avoid bureaucratic compounds; use a guest-friendly question form.",
            },
            {
                draft: "Serviert {HOTEL_NAME} Mittag- oder Abendessen und sind Reservierungen erforderlich?",
                polish: "Serviert {HOTEL_NAME} Abendessen, und sind Reservierungen erforderlich?",
                note: "Align the question to what the answer actually covers; do not add facts.",
            },
            {
                draft: "Die Rezeption ist durchgehend 24 Stunden am Tag besetzt.",
                polish: "Die Rezeption ist rund um die Uhr besetzt.",
                note: "Prefer concise, natural 24/7 phrasing; avoid redundancy.",
            },
            {
                draft: "Der Check-out erfolgt bis 12:00 Uhr mittags.",
                polish: "Der Check-out erfolgt bis 12:00 Uhr.",
                note: "Avoid unnecessary 'mittags' in standard time statements.",
            },
            {
                draft: "… steht ein Same-Day-Wäsche- und Trockenreinigungsservice zur Verfügung.",
                polish: "… steht ein Wäsche- und Trockenreinigungsservice mit Rückgabe am selben Tag zur Verfügung.",
                note: "Avoid English 'Same-Day' in German; use a natural equivalent.",
            },
            {
                draft: "Ja, die Rezeption ist rund um die Uhr besetzt, sodass jederzeit Unterstützung gewährleistet ist.",
                polish: "Ja, das Rezeptionsteam steht Hotelgästen rund um die Uhr für alle Anliegen zur Verfügung.",
                note: "Prefer the defined reception tone ('Rezeptionsteam ... zur Verfügung') over generic 'Unterstützung gewährleistet'. Keeps wording guest-focused and premium.",
            },
            {
                draft: "Ja, die Mitarbeitenden an der Rezeption sprechen Deutsch, Englisch sowie weitere Sprachen (Italienisch, Russisch, Spanisch, Kroatisch) und bieten damit einen mehrsprachigen Service.",
                polish: "Ja, das Personal an der Rezeption spricht Deutsch, Englisch sowie weitere Sprachen (Italienisch, Russisch, Spanisch, Kroatisch) und bietet damit einen mehrsprachigen Service.",
                note: "Use 'das Personal' for a more natural hotel tone; avoids HR-style wording while preserving meaning and formality.",
            },
            {
                draft: "Ja, Kinder sind herzlich willkommen; Babybetten, Familienzimmer und kinderfreundliche Frühstücksangebote stehen zur Verfügung.",
                polish: "Ja, Kinder sind herzlich willkommen; Babybetten, Familienzimmer und kinderfreundliche Frühstücksoptionen stehen zur Verfügung.",
                note: "Prefer the more standard hotel phrasing 'Frühstücksoptionen' over 'Frühstücksangebote' for a smoother native feel.",
            },
            {
                draft: "… da kein Room-Service oder In-Room-Dining betrieben wird.",
                polish: "… da kein Zimmerservice angeboten wird.",
                note: "Use one consistent German term; avoid mixed English terms.",
            },
            {
                draft: "Nein, Zimmerservice wird angeboten, steht jedoch nicht durchgehend zur Verfügung.",
                polish: "Nein, Zimmerservice wird angeboten, ist jedoch nicht rund um die Uhr verfügbar.",
                note: "Avoid internal contradiction; keep negation consistent and phrasing natural.",
            },
            {
                draft: "Wie lauten die regulären Check-in- und Check-out-Zeiten?",
                polish: "Wann sind die regulären Check-in- und Check-out-Zeiten?",
                note: "Avoid stiff template 'Wie lauten ...?'. Prefer 'Wann ...?'.",
            },
            {
                draft: "Verfügt das Hotel über einen Safe?",
                polish: "Gibt es im Zimmer einen Safe?",
                note: "Prefer direct 'Gibt es ...?' question form in FAQs.",
            },
            {
                draft: "Verfügt das Hotel über eine Bar vor Ort und wie sind deren Öffnungszeiten?",
                polish: "Gibt es im Hotel eine Bar vor Ort, und wie sind die Öffnungszeiten?",
                note: "Cleaner coordination; prefer 'Gibt es ...?' and avoid 'deren'.",
            },
            {
                draft: "… und kann die Strecke bequem zu Fuß zurückgelegt werden?",
                polish: "… und lässt sich die Strecke bequem zu Fuß zurücklegen?",
                note: "Prefer natural active phrasing over passive construction.",
            },
            {
                draft: "Ja, das engagierte Team an der Rezeption ist rund um die Uhr für alle Anliegen verfügbar.",
                polish: "Ja, das Rezeptionsteam steht Gästen rund um die Uhr für alle Anliegen zur Verfügung.",
                note: "Avoid 'engagiert(e)' for reception; use standard hospitality phrasing.",
            },
            {
                draft: "Steht im Hotel mehrsprachiges Personal zur Unterstützung internationaler Gäste zur Verfügung?",
                polish: "Steht im Hotel mehrsprachiges Personal zur Verfügung, um internationale Gäste zu unterstützen?",
                note: "Avoid repetition ('zur Unterstützung ... zur Verfügung'). Keep flow natural.",
            },
            {
                draft: "Ja, auf Wunsch stellt das Frühstücksteam glutenfreie Produkte bereit.",
                polish: "Ja, auf Anfrage stellt das Frühstücksteam glutenfreie Produkte bereit.",
                note: "Prefer 'auf Anfrage' over 'auf Wunsch' in hotel phrasing.",
            },
            {
                draft: "Berücksichtigt das Hotel vegetarische und vegane Ernährungswünsche?",
                polish: "Berücksichtigt das Hotel vegetarische und vegane Ernährungsbedürfnisse?",
                note: "Prefer 'Ernährungsbedürfnisse' for dietary needs.",
            },
            {
                draft: "Die Sehenswürdigkeit ist in ca. acht Minuten erreichbar.",
                polish: "Die Sehenswürdigkeit ist in etwa acht Minuten erreichbar.",
                note: "Prefer 'in etwa' over 'in ca.' in German prose.",
            },
            {
                draft: "Für größere Gruppen können reservierte Bereiche arrangiert werden.",
                polish: "Für größere Gruppen können reservierte Bereiche eingerichtet werden.",
                note: "Avoid 'arrangiert' here; prefer 'eingerichtet' or 'reserviert' depending on meaning.",
            },
            {
                draft: "Serviert das Hotel Mittag- und Abendessen, und sind Reservierungen erforderlich?",
                polish: "Serviert das Hotel Abendessen, und sind Reservierungen erforderlich?",
                note: "If the answer only covers dinner, align the question without adding facts.",
            },
            {
                draft: "Ja, der Busbahnhof liegt nur einen kurzen Spaziergang entfernt – weniger als fünf Gehminuten von der Haustür.",
                polish: "Ja, der Busbahnhof ist weniger als fünf Gehminuten vom Hotel entfernt.",
                note: "Prefer concise, factual phrasing; avoid metaphorical wording.",
            },
            {
                draft: "Nein, Zimmerservice wird angeboten, steht jedoch nicht durchgehend zur Verfügung.",
                polish: "Nein, Zimmerservice wird angeboten, ist jedoch nicht rund um die Uhr verfügbar.",
                note: "Avoid internal contradiction and keep negation consistent.",
            },
            {
                draft: "Der Check-in ist ab 15:00&nbsp;Uhr möglich; Check-out wird bis 11:00&nbsp;Uhr erbeten.",
                polish: "Der Check-in ist ab 15:00&nbsp;Uhr möglich; der Check-out erfolgt bis 11:00&nbsp;Uhr.",
                note: "Keep HTML entities unchanged. Improve flow: avoid 'wird ... erbeten'.",
            },
            {
                draft: "Welche Gepäckaufbewahrungsregelung gilt für frühe Ankünfte oder späte Abreisen?",
                polish: "Gibt es eine Gepäckaufbewahrung für frühe Ankünfte oder späte Abreisen?",
                note: "Avoid bureaucratic '...regelung'. Use guest-friendly question form.",
            },
            {
                draft: "Bügeleisen und brett sind auf Anfrage erhältlich.",
                polish: "Bügeleisen und Bügelbrett sind auf Anfrage erhältlich.",
                note: "Fix missing compound noun; keep capitalization consistent.",
            },
        ],
    },

    es: { mappings: [], examples: [] },
    nl: { mappings: [], examples: [] },
    it: { mappings: [], examples: [] },
    fr: { mappings: [], examples: [] },
    pl: { mappings: [], examples: [] },
    ru: { mappings: [], examples: [] },
    he: { mappings: [], examples: [] },
    zh: { mappings: [], examples: [] },
    ar: { mappings: [], examples: [] },
};