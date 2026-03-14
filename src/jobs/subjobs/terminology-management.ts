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

    es: { mappings: [
      {
  forbidden: "Grammar mismatch after term replacement",
  preferred: "Gender and number agreement",
  reason: "In Spanish, if a term is replaced (e.g., 'propiedad' to 'hotel'), you must update the surrounding articles (el/la) and adjectives to match the new gender (masculine/feminine). Always ensure 'el hotel' or 'las instalaciones' instead of keeping feminine articles for masculine nouns."
},
    {
      forbidden: "propiedad",
      preferred: "hotel / establecimiento / instalaciones",
      reason: "While 'property' is standard in English hospitality, 'propiedad' in Spanish sounds overly legal or related to real estate. 'Hotel' or 'Instalaciones' is much warmer."
    },
    {
      forbidden: "debe efectuarse antes de / debe realizarse",
      preferred: "es hasta las / se hace antes de",
      reason: "Verbs like 'efectuarse' sound like a formal contract. 'El check-out es hasta las 12:00' is friendlier and matches how people actually speak."
    },
    {
      forbidden: "facilidades para preparar café y té",
      preferred: "set de café y té / hervidor de agua",
      reason: "'Facilidades' is a false friend (anglicism). In Spanish, it refers to 'ease'. For amenities, use 'set', 'kit', or the specific equipment name."
    },
    {
      forbidden: "bolsa de desayuno",
      preferred: "desayuno para llevar / picnic de desayuno",
      reason: "Literal translation of 'breakfast bag'. 'Desayuno para llevar' is the standard term used by travelers and hotel staff."
    },
    {
      forbidden: "cash-free",
      preferred: "no acepta efectivo / solo pagos con tarjeta",
      reason: "'No acepta efectivo' is more direct and natural for a traveler than the corporate buzzword 'cash-free'."
    },
    {
      forbidden: "cortinas opacas",
      preferred: "cortinas blackout / cortinas de oscurecimiento",
      reason: "'Blackout' is the widely accepted industry standard in Spanish-speaking markets to guarantee total darkness."
    },
    {
      forbidden: "cargo moderado / cargo suplementario",
      preferred: "suplemento / pequeño coste adicional",
      reason: "'Suplemento' is the precise professional term for extra hotel fees. 'Cargo moderado' feels like an unnatural literal translation."
    },
    {
      forbidden: "acceso sin escalones",
      preferred: "acceso para personas con movilidad reducida / accesible",
      reason: "'Sin escalones' is a literal translation. The professional term is 'accesibilidad' or 'movilidad reducida'."
    },
    {
      forbidden: "tomar prestados paraguas",
      preferred: "servicio de préstamo de paraguas / paraguas de cortesía",
      reason: "'Tomar prestado' sounds slightly informal or childish. 'Servicio de préstamo' is professional, and 'de cortesía' adds a touch of hospitality."
    },
    {
      forbidden: "proyecta / transmite eventos deportivos",
      preferred: "televisa los partidos / pone los deportes",
      reason: "Guests don't ask about 'broadcasting events'; they ask if the bar 'puts the match on' (pone el partido)."
    },
    {
      forbidden: "identificación oficial con fotografía",
      preferred: "DNI o pasaporte / identificación vigente",
      reason: "Replaced bureaucratic language with terms guests actually use for their ID."
    },
    {
      forbidden: "¿Se da la bienvenida a los niños...?",
      preferred: "¿El hotel es apto para niños? / ¿Se admiten niños...?",
      reason: "'Se da la bienvenida' is a literal translation of 'welcome'. In Spanish, it's more natural to ask about suitability or permission."
    }

    ], 
    examples: [
{
      draft: "¿Leonardo Hotel Almere City Center ofrece Wi-Fi gratuito en todo el hotel?",
      polish: "¿El hotel ofrece Wi-Fi gratuito en todas las instalaciones?",
      note: "Simplified brand name and improved flow."
    },
    {
      draft: "¿A qué hora es el check-out en Leonardo Hotel Almere City Center?",
      polish: "¿Hasta qué hora puedo hacer el check-out?",
      note: "Shifted focus to the guest's action for a more natural inquiry."
    },
    {
      draft: "¿Las habitaciones incluyen facilidades para preparar café y té?",
      polish: "¿Tienen las habitaciones hervidor de agua ו-set de café y té?",
      note: "Removed the anglicism 'facilidades'."
    },
    {
      draft: "¿Se exige un depósito de garantía al registrarse?",
      polish: "¿Hay que dejar fianza o depósito al llegar?",
      note: "Used common travel terms like 'fianza' instead of formal 'depósito de garantía'."
    },
    {
      draft: "¿Leonardo Boutique Museumhotel Amsterdam City Center es un establecimiento cash-free?",
      polish: "¿El hotel acepta pagos en efectivo?",
      note: "Replaced business jargon with a practical question about cash."
    },
    {
      draft: "¿Se da la bienvenida a los niños para comer en la Coffee Boutique?",
      polish: "¿Pueden los niños comer en la Coffee Boutique?",
      note: "Turned a stiff greeting into a natural question about permission."
    },
    {
      draft: "¿El sports bar transmite eventos deportivos en directo?",
      polish: "¿Ponen los partidos de fútbol o deportes en el bar?",
      note: "Used conversational language ('ponen los partidos') instead of technical terms."
    },
    {
      draft: "¿Hay un ascensor que ofrezca acceso sin escalones a todos los pisos?",
      polish: "¿Es el hotel accesible para personas con movilidad reducida a través de ascensor?",
      note: "Used professional hospitality terminology for accessibility."
    },
    {
      draft: "¿Leonardo Hotel Almere City Center ofrece una bolsa de desayuno para llevar?",
      polish: "¿Disponen de desayunos para llevar si salgo temprano?",
      note: "Used the natural 'desayuno para llevar' and added conversational context."
    },
    {
      draft: "¿Pueden los huéspedes tomar prestados paraguas?",
      polish: "¿Disponen de paraguas de cortesía para los días de lluvia?",
      note: "Polished the verb and added a hospitality touch ('de cortesía')."
    }


    ] },

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
},
{
  forbidden: "viel Spaß bereiten",
  preferred: "zur Unterhaltung",
  reason: "Avoid overly colloquial phrases in marketing copy; use professional hospitality tone."
},
{
  forbidden: "Kaffee-und-Kuchen-Pause",
  preferred: "Kaffee- und Kuchenpause",
  reason: "Avoid excessive hyphenation (hyphen monsters) for better readability."
},
{
  forbidden: "nachmittägliche",
  preferred: "am Nachmittag",
  reason: "Avoid clunky adjectives like 'nachmittägliche'. Prefer adding 'am Nachmittag' at the end of the phrase."
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
            {
  draft: "… können ohne Aufpreis ein Babybett, eine Babywanne und einen Flaschenwärmer angefordert werden.",
  polish: "… können ohne Aufpreis ein Babybett, eine Babywanne und ein Flaschenwärmer angefordert werden.",
  note: "Grammar fix: In passive sentences ('können ... angefordert werden'), enumerated subjects must remain in the nominative case ('ein Flaschenwärmer', not accusative 'einen')."
},
{
  draft: "Die All-Inclusive-Plus-Gäste genießen eine nachmittägliche Kaffee-und-Kuchen-Pause.",
  polish: "Die All-Inclusive-Plus-Gäste genießen eine Kaffee- und Kuchenpause am Nachmittag.",
  note: "Avoid excessive hyphenation and clunky adjectives. Rephrase for a more elegant, natural flow."
},
{
  draft: "Im Games Room gibt es Videospiele, die Kindern viel Spaß bereiten.",
  polish: "Im Games Room stehen Videospiele zur Unterhaltung der Kinder zur Verfügung.",
  note: "Replace colloquial phrases like 'viel Spaß bereiten' with upscale, professional hotel phrasing ('zur Unterhaltung ... zur Verfügung')."
}
        ],
    },

    it:
    { mappings: [
  {
    "forbidden": "Quante camere dispone...",
    "preferred": "Di quante camere dispone... / Quante camere ha...",
    "reason": "The verb 'disporre' requires the preposition 'di'. In a question, use 'Di quante...' or the more natural 'Quante camere ha...'."
  },
  {
    "forbidden": "Articoli da toeletta",
    "preferred": "Set di cortesia / Prodotti da bagno",
    "reason": "'Set di cortesia' is the specific luxury hospitality term for guest amenities; 'articoli da toeletta' sounds dated or generic."
  },
  {
    "forbidden": "Accesso senza gradini",
    "preferred": "Accesso facilitato / Senza barriere architettoniche",
    "reason": "'Senza gradini' is a literal translation. The professional Italian standard for accessibility is 'senza barriere architettoniche'."
  },
  {
    "forbidden": "Consegnare le camere",
    "preferred": "Camere disponibili / Disponibilità delle camere",
    "reason": "'Consegnare' (to hand over) sounds transactional. Using 'disponibilità' or 'a disposizione' creates a more welcoming guest experience."
  },
  {
    "forbidden": "Aria condizionata autonoma / individuale",
    "preferred": "Climatizzazione regolabile individualmente",
    "reason": "For central systems, 'climatizzazione' is more precise and sounds higher-end than the basic 'aria condizionata'."
  },
  {
    "forbidden": "Il sports bar",
    "preferred": "Lo sports bar",
    "reason": "Grammatical accuracy: Words starting with 's + consonant' must take the article 'Lo' instead of 'Il'."
  },
  {
    "forbidden": "Sacchetto colazione",
    "preferred": "Colazione al sacco / Breakfast box",
    "reason": "'Sacchetto' sounds like a grocery bag. 'Colazione al sacco' is the proper Italian term for a packed meal."
  },
  {
    "forbidden": "Presso [Hotel Name]",
    "preferred": "Al / All' [Hotel Name]",
    "reason": "Using 'Al' (at the) feels like a destination. Use 'All'' if the name starts with a vowel, and 'Al' if it starts with a consonant."
  },
  {
    "forbidden": "Aliquota della tassa di soggiorno",
    "preferred": "Tassa di soggiorno",
    "reason": "Guests ask 'how much is the tax', not for the 'tax percentage'. Avoid bureaucratic terms like 'aliquota'."
  },
  {
    "forbidden": "Cani educati / Cani ben comportati",
    "preferred": "Cani ben educati / Animali domestici",
    "reason": "Avoid literal translations of 'well-behaved'. 'Ben educati' is the correct Italian expression for pets."
  },
  {
    "forbidden": "Pasti leggeri",
    "preferred": "Snack veloci / Light meal",
    "reason": "'Pasti leggeri' sounds like a clinical diet. 'Snack' or the international 'Light meal' is much more elegant in a lounge context."
  },
  {
    "forbidden": "Punti di ricarica",
    "preferred": "Stazioni di ricarica / Colonnine",
    "reason": "The professional term for EV charging infrastructure is 'stazioni' or 'colonnine', not 'punti'."
  }

    ], 
    examples: [
      {
                draft: "Quante camere dispone in totale il Leonardo Boutique Museumhotel?",
                polish: "Di quante camere dispone in totale il Leonardo Boutique Museumhotel?",
                note: "Corrects the grammatical omission of the preposition 'di' with the verb 'disporre'."
            },
            {
                draft: "Il Leonardo Boutique Museumhotel fornisce articoli da toeletta ecologici?",
                polish: "Il Leonardo Boutique Museumhotel offre un set di cortesia ecologico in omaggio?",
                note: "Uses 'set di cortesia' for guest amenities and 'in omaggio' for a more premium tone."
            },
            {
                draft: "Jan Luyken Amsterdam dispone di un ascensore che garantisce accesso senza gradini?",
                polish: "Il Jan Luyken Amsterdam dispone di un ascensore che garantisce un accesso privo di barriere?",
                note: "Upgrades 'step-free' to the professional 'privo di barriere'."
            },
            {
                draft: "Le camere vengono consegnate dalle 15:00.",
                polish: "Le camere sono a disposizione degli ospiti dalle 15:00.",
                note: "Replaces the transactional 'delivered/released' with a welcoming guest-centric phrase."
            },
            {
                draft: "Le camere non dispongono di aria condizionata autonoma.",
                polish: "Le camere dispongono di un sistema di climatizzazione centralizzato.",
                note: "Uses 'climatizzazione' for a more sophisticated description of climate control."
            },
            {
                draft: "Il sports bar del Leonardo Hotel Almere...",
                polish: "Lo sports bar del Leonardo Hotel Almere...",
                note: "Corrects the article 'Lo' for words starting with 's + consonant'."
            },
            {
                draft: "È possibile richiedere un sacchetto colazione?",
                polish: "È possibile richiedere una colazione al sacco?",
                note: "Corrects the literal translation of 'breakfast bag'."
            },
            {
                draft: "Presso Jan Luyken Amsterdam il check-in inizia alle 15:00.",
                polish: "Al Jan Luyken Amsterdam il check-in inizia alle 15:00.",
                note: "Uses the destination-oriented 'Al' instead of the bureaucratic 'Presso'."
            },
            {
                draft: "Qual è l'aliquota della tassa di soggiorno?",
                polish: "A quanto ammonta la tassa di soggiorno?",
                note: "Uses natural phrasing for inquiring about costs."
            },
            {
                draft: "I cani educati sono i benvenuti.",
                polish: "I cani ben educati sono i benvenuti.",
                note: "Fixes the literal translation of 'well-behaved'."
            }
    ] },

 nl: { mappings: [], examples: [] },
    fr: {
  mappings: [
    {
      forbidden: "L'enregistrement officiel au... commence à",
      preferred: "Les arrivées s'effectuent à partir de",
      reason: "In French hospitality, referring to 'Les arrivées' is more elegant and guest-centric than the technical 'L'enregistrement'."
    },
    {
      forbidden: "Le check-out doit s’effectuer",
      preferred: "Les chambres doivent être libérées",
      reason: "Using the English loanword 'check-out' in a French response is considered low-tier. 'Libérer la chambre' is the professional standard for high-end hotels."
    },
    {
      forbidden: "Offrant un départ détendu",
      preferred: "Pour un départ en toute sérénité",
      reason: "'Détendu' is too casual/literal. 'En toute sérénité' is the standard luxury phrasing for a relaxed experience."
    },
    {
      forbidden: "Garantissant une assistance à tout moment",
      preferred: "Pour vous accompagner à chaque instant",
      reason: "As noted before, 'assistance' implies a problem. 'Accompagner' or 'À votre entière disposition' sounds like proactive service."
    },
    {
      forbidden: "Ventilateurs portatifs",
      preferred: "Ventilateurs d'appoint",
      reason: "'Portatifs' sounds like a gadget (like a phone). 'D'appoint' is the correct professional term for extra equipment provided by a hotel."
    },
    {
      forbidden: "Facilement sollicité via l’application",
      preferred: "Disponible sur simple demande via l’application",
      reason: "The phrase 'sur simple demande' is a staple of French hospitality, making the service sound effortless for the guest."
    },
    {
      forbidden: "Propose des options végétariennes",
      preferred: "Propose une sélection de mets végétariens",
      reason: "Using 'Mets' (dishes) and 'Sélection' adds a culinary, upscale feel compared to the generic 'options'."
    },
    {
      forbidden: "Un environnement maîtrisé en matière d'allergènes",
      preferred: "Un environnement préservé de tout allergène",
      reason: "'Maîtrisé' sounds like a laboratory report. 'Préservé' sounds like a guest benefit and a clean, luxury space."
    }
  ],
  examples: [
    {
      draft: "Le check-out doit s’effectuer avant 12h00, offrant un départ détendu avant midi.",
      polish: "Au Leonardo Hotel Almere City Center, les chambres doivent être libérées avant 12h00, vous permettant un départ en toute sérénité.",
      note: "Replacing anglicisms and literal translations with professional French hospitality idioms."
    },
    {
      draft: "L'enregistrement officiel au Leonardo Hotel Almere City Center commence à 15h00...",
      polish: "Les arrivées au Leonardo Hotel Almere City Center s'effectuent à partir de 15h00...",
      note: "Standardizing the welcome process phrasing."
    },
    {
      draft: "Oui, le Wi-Fi haut débit est offert gratuitement dans l’ensemble des chambres...",
      polish: "Oui, une connexion Wi-Fi haut débit est gracieusement mise à votre disposition dans l'ensemble des chambres du Leonardo Hotel Almere City Center...",
      note: "Using 'gracieusement mise à disposition' instead of just 'offert' for a more prestigious tone."
    },
    {
      draft: "Les clients non résidents peuvent-ils dîner au Bierfabriek Almere...",
      polish: "La clientèle non-résidente peut-elle déjeuner ou dîner au Bierfabriek Almere...",
      note: "Specifying the type of guest (clientèle) and the meals (déjeuner/dîner) for a more complete response."
    }
  ]
},
    pl: { mappings: [], examples: [] },
    ru: { mappings: [], examples: [] },
    he: { mappings: [], examples: [] },
    zh: { mappings: [], examples: [] },
    ar: { mappings: [], examples: [] },
};