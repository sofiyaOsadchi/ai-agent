import {
  AnalyticsService,
  type AnalyticsAccount,
  type AnalyticsFaqLandingPage,
  type AnalyticsFaqSearchTerm,
} from "./analytics.js";
import {
  SearchConsoleService,
  type SearchConsoleDimensionFilter,
  type SearchConsoleQueryRow,
  type SearchConsoleSite,
} from "./search-console.js";

type DateRangeInput = {
  startDate?: string;
  endDate?: string;
};

export type FaqDemandInput = {
  subject?: string;
  websiteUrl?: string;
  dateRange?: DateRangeInput;
  analytics?: {
    enabled?: boolean;
    accountId?: string;
    propertyId?: string;
  };
  searchConsole?: {
    enabled?: boolean;
    siteUrl?: string;
  };
  limit?: number;
  maxPhrases?: number;
  questionsPerPhrase?: number;
};

export type FaqDemandPhrase = {
  phrase: string;
  intent: string;
  category: string;
  source: "search-console" | "analytics-page" | "analytics-site-search" | "starter-intent";
  page?: string;
  score: number;
  evidence: string;
};

export type FaqDemandCandidate = {
  question: string;
  category: string;
  source: "search-console" | "analytics-page" | "analytics-site-search" | "starter-intent";
  signal: string;
  page?: string;
  score: number;
  evidence: string;
};

export type FaqDemandCategory = {
  title: string;
  description: string;
  count: number;
  signals: string[];
};

export type FaqOpportunityStrength = "strong" | "maybe" | "weak" | "rejected";

export type FaqOpportunityRisk = "low" | "medium" | "high";

export type FaqOpportunityVerificationStatus = "query_supported" | "needs_verification" | "rejected";

export type FaqOpportunity = {
  id: string;
  topic: string;
  category: string;
  candidateQuestion: string;
  strength: FaqOpportunityStrength;
  verificationStatus: FaqOpportunityVerificationStatus;
  reason: string;
  risk: FaqOpportunityRisk;
  sourceQueries: string[];
  pages: string[];
  metrics: {
    impressions: number;
    clicks: number;
    ctr?: number;
    avgPosition?: number;
  };
};

export type FaqDemandResult = {
  ok: true;
  generatedAt: string;
  subject: string;
  sources: {
    analyticsAccount?: AnalyticsAccount;
    searchConsoleSite?: SearchConsoleSite;
    dateRange: {
      startDate?: string;
      endDate?: string;
    };
    signalCounts: {
      rawQueries: number;
      matchedQueries: number;
      rawLandingPages: number;
      matchedLandingPages: number;
      rawSiteSearchTerms: number;
      matchedSiteSearchTerms: number;
      sourcePhrases: number;
      starterIdeas: number;
    };
    warnings: string[];
  };
  topQueries: SearchConsoleQueryRow[];
  topLandingPages: AnalyticsFaqLandingPage[];
  topSiteSearchTerms: AnalyticsFaqSearchTerm[];
  phrases: FaqDemandPhrase[];
  opportunities: FaqOpportunity[];
  categories: FaqDemandCategory[];
  candidates: FaqDemandCandidate[];
  promptBrief: string;
};

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  booking: {
    title: "Booking & Price Intent",
    description: "Pricing, booking, cancellation, payment, deposits and commercial friction.",
  },
  location: {
    title: "Location & Access Intent",
    description: "Address, transport, nearby places, parking, airport, public transit and arrival planning.",
  },
  amenities: {
    title: "Amenities & Facilities Intent",
    description: "Rooms, facilities, comfort, Wi-Fi, kitchen, breakfast, pool, accessibility and practical stay details.",
  },
  policy: {
    title: "Policies & Requirements Intent",
    description: "Rules, restrictions, check-in, check-out, pets, age, documents and stay conditions.",
  },
  comparison: {
    title: "Comparison & Trust Intent",
    description: "Reviews, alternatives, suitability, legitimacy, quality, ratings and decision confidence.",
  },
  support: {
    title: "Support & Problem-Solving Intent",
    description: "Contact, help, changes, troubleshooting, special requests and what happens next.",
  },
  general: {
    title: "General Discovery Intent",
    description: "Broad informational searches and pages that can become clearer FAQ coverage.",
  },
};

const SUBJECT_GENERIC_TOKENS = new Set([
  "a",
  "an",
  "and",
  "apartment",
  "apartments",
  "com",
  "hotel",
  "hotels",
  "house",
  "inn",
  "official",
  "resort",
  "site",
  "stay",
  "suite",
  "suites",
  "the",
  "this",
  "villa",
  "villas",
  "website",
  "www",
]);

const HOSPITALITY_ENTITY_TOKENS = new Set([
  "apartment",
  "apartments",
  "hotel",
  "hotels",
  "house",
  "inn",
  "resort",
  "suite",
  "suites",
  "villa",
  "villas",
]);

const DEMAND_INTENT_TOKENS = new Set([
  "access",
  "accessible",
  "accessibility",
  "address",
  "airport",
  "amenities",
  "amenity",
  "apartment",
  "apartments",
  "arrival",
  "attraction",
  "attractions",
  "balcony",
  "bar",
  "beach",
  "book",
  "booking",
  "breakfast",
  "business",
  "cancel",
  "cancellation",
  "center",
  "centre",
  "check",
  "checkin",
  "checkout",
  "close",
  "code",
  "contact",
  "corporate",
  "cost",
  "coworking",
  "deal",
  "deals",
  "deposit",
  "directions",
  "distance",
  "dryer",
  "email",
  "extended",
  "facilities",
  "facility",
  "fee",
  "fees",
  "fitness",
  "help",
  "gym",
  "kid",
  "kids",
  "kitchen",
  "landmark",
  "linen",
  "location",
  "long",
  "luggage",
  "map",
  "near",
  "nearby",
  "occupancy",
  "parking",
  "payment",
  "pets",
  "phone",
  "policy",
  "pool",
  "price",
  "rate",
  "rates",
  "refund",
  "restaurant",
  "rooftop",
  "review",
  "reviews",
  "room",
  "rooms",
  "service",
  "spa",
  "storage",
  "support",
  "terrace",
  "term",
  "train",
  "transport",
  "vat",
  "washer",
  "wifi",
  "wi",
  "fi",
  "workspace",
]);

type FaqOpportunityTopicDefinition = {
  id: string;
  topic: string;
  category: string;
  terms: string[];
  question: string;
  risk: FaqOpportunityRisk;
  intentBase: number;
  reason: string;
  verificationRequired?: boolean;
  rejected?: boolean;
};

type FaqOpportunitySignal = {
  text: string;
  page?: string;
  source: "search-console" | "analytics-page" | "analytics-site-search";
  impressions: number;
  clicks: number;
  ctr?: number;
  position?: number;
};

type FaqOpportunityAccumulator = {
  definition: FaqOpportunityTopicDefinition;
  sourceQueries: Set<string>;
  pages: Set<string>;
  impressions: number;
  clicks: number;
  positionWeightedTotal: number;
  positionWeight: number;
  faqIntentScores: number[];
  pageFitScores: number[];
  performanceScores: number[];
  finalScores: number[];
  reasonFlags: Set<string>;
};

const FAQ_OPPORTUNITY_TOPICS: FaqOpportunityTopicDefinition[] = [
  {
    id: "room-types",
    topic: "Room types and suites",
    category: "amenities",
    terms: ["room type", "room types", "rooms", "room", "suite", "suites", "junior suite", "family room", "family rooms", "zimmer", "suite", "suiten", "camera", "camere", "habitacion", "habitación", "habitaciones", "חדר", "חדרים", "סוויטה", "סוויטות"],
    question: "What room types and suites are available at {{subject}}?",
    risk: "low",
    intentBase: 88,
    reason: "Direct room or suite query support; the opportunity stays close to the source search intent.",
  },
  {
    id: "parking",
    topic: "Parking",
    category: "location",
    terms: ["parking", "car park", "parkplatz", "parken", "parcheggio", "aparcamiento", "estacionamiento", "חניה", "חניון"],
    question: "What parking options are available at {{subject}}?",
    risk: "medium",
    intentBase: 90,
    reason: "Clear practical arrival-planning intent.",
    verificationRequired: true,
  },
  {
    id: "breakfast",
    topic: "Breakfast",
    category: "amenities",
    terms: ["breakfast", "fruhstuck", "frühstück", "colazione", "desayuno", "ארוחת בוקר"],
    question: "What breakfast options are available at {{subject}}?",
    risk: "medium",
    intentBase: 88,
    reason: "Common stay-planning question with stable factual answers.",
    verificationRequired: true,
  },
  {
    id: "check-in",
    topic: "Check-in",
    category: "policy",
    terms: ["check in", "check-in", "checkin", "einchecken", "arrival time", "orario arrivo", "orario check in", "entrada", "hora de entrada", "צק אין", "צ ק אין", "צ'ק אין"],
    question: "What are the standard check-in times at {{subject}}?",
    risk: "low",
    intentBase: 90,
    reason: "High-value operational FAQ intent before arrival.",
  },
  {
    id: "check-out",
    topic: "Check-out",
    category: "policy",
    terms: ["check out", "check-out", "checkout", "auschecken", "departure time", "orario partenza", "orario check out", "salida", "hora de salida", "צק אאוט", "צ ק אאוט", "צ'ק אאוט"],
    question: "Can guests arrange late check-out at {{subject}}?",
    risk: "low",
    intentBase: 88,
    reason: "High-value operational FAQ intent during stay planning.",
  },
  {
    id: "cancellation",
    topic: "Cancellation",
    category: "booking",
    terms: ["cancellation", "cancel", "refund", "storno", "stornierung", "cancellazione", "annullamento", "cancelacion", "cancelación", "reembolso", "ביטול", "החזר"],
    question: "What is the cancellation policy for reservations at {{subject}}?",
    risk: "medium",
    intentBase: 86,
    reason: "Commercial friction intent that can reduce repeated support questions.",
  },
  {
    id: "pets",
    topic: "Pets",
    category: "policy",
    terms: ["pets", "pet friendly", "dog", "dogs", "cat", "hund", "hunde", "haustiere", "animali", "cane", "mascotas", "perros", "חיות מחמד", "כלבים"],
    question: "Are pets allowed at {{subject}}?",
    risk: "medium",
    intentBase: 86,
    reason: "Specific policy intent with a clear FAQ answer.",
    verificationRequired: true,
  },
  {
    id: "accessibility",
    topic: "Accessibility",
    category: "amenities",
    terms: ["accessible", "accessibility", "wheelchair", "disabled", "barrierefrei", "rollstuhl", "accessibile", "sedia a rotelle", "accesible", "silla de ruedas", "נגיש", "נגישות", "כיסא גלגלים"],
    question: "What accessibility options are available at {{subject}}?",
    risk: "medium",
    intentBase: 88,
    reason: "Important guest-fit intent with practical factual needs.",
    verificationRequired: true,
  },
  {
    id: "family-rooms",
    topic: "Family rooms",
    category: "amenities",
    terms: ["family room", "family rooms", "families", "kids", "children", "connecting rooms", "familienzimmer", "kinder", "camera familiare", "bambini", "habitacion familiar", "habitación familiar", "familias", "ninos", "niños", "חדר משפחה", "חדרי משפחה", "ילדים", "משפחה"],
    question: "Is {{subject}} suitable for families or longer stays?",
    risk: "medium",
    intentBase: 84,
    reason: "Guest-fit intent that often creates useful room and policy FAQs.",
    verificationRequired: true,
  },
  {
    id: "apartment-hotel-fit",
    topic: "Hotel vs apartment stay",
    category: "general",
    terms: ["serviced apartment", "apartment hotel", "apartments", "hotel or apartment", "private apartment", "ferienwohnung", "aparthotel", "appartamento", "apartamento", "דירה", "דירות", "מלון דירות"],
    question: "Is {{subject}} more like a hotel or a private apartment?",
    risk: "low",
    intentBase: 84,
    reason: "Useful fit question for guests comparing stay types.",
  },
  {
    id: "business-travel",
    topic: "Business travel",
    category: "support",
    terms: ["business", "business traveller", "business traveler", "corporate", "work trip", "geschäftsreise", "business reise", "viaggio di lavoro", "corporate stay", "viaje de negocios", "נסיעת עסקים", "עסקים"],
    question: "Is {{subject}} set up for business travellers?",
    risk: "low",
    intentBase: 82,
    reason: "Decision-fit intent for corporate and work stays.",
  },
  {
    id: "long-stay",
    topic: "Long stay",
    category: "booking",
    terms: ["long stay", "long-term stay", "extended stay", "monthly stay", "several weeks", "langzeitaufenthalt", "soggiorno lungo", "larga estancia", "estancia larga", "שהייה ארוכה", "לטווח ארוך"],
    question: "Is {{subject}} suitable for a long-term stay?",
    risk: "low",
    intentBase: 82,
    reason: "Strong suitability intent for guests planning longer stays.",
  },
  {
    id: "workspace",
    topic: "Workspace",
    category: "amenities",
    terms: ["workspace", "work space", "desk", "co-working", "coworking", "remote work", "arbeitsplatz", "coworking", "scrivania", "lavoro remoto", "espacio de trabajo", "coworking", "עמדת עבודה", "חלל עבודה", "עבודה מרחוק"],
    question: "Is there a workspace or co-working area at {{subject}}?",
    risk: "medium",
    intentBase: 82,
    reason: "Practical amenity intent for remote workers.",
    verificationRequired: true,
  },
  {
    id: "wifi",
    topic: "Wi-Fi",
    category: "amenities",
    terms: ["wifi", "wi fi", "wi-fi", "internet", "wlan", "אינטרנט", "וויי פיי", "וייפיי"],
    question: "Does {{subject}} provide complimentary Wi-Fi?",
    risk: "medium",
    intentBase: 82,
    reason: "Specific amenity intent with a simple factual answer.",
    verificationRequired: true,
  },
  {
    id: "fitness",
    topic: "Fitness centre",
    category: "amenities",
    terms: ["fitness", "gym", "fitness center", "fitness centre", "fitnessraum", "palestra", "gimnasio", "חדר כושר", "כושר"],
    question: "Does {{subject}} have a fitness centre?",
    risk: "medium",
    intentBase: 80,
    reason: "Specific amenity intent with clear FAQ value.",
    verificationRequired: true,
  },
  {
    id: "rooftop",
    topic: "Rooftop terrace",
    category: "amenities",
    terms: ["rooftop", "roof terrace", "terrace", "panoramic terrace", "dachterrasse", "terrazza", "terraza", "גג", "מרפסת גג", "רופטופ"],
    question: "Can guests use the rooftop terrace at {{subject}}?",
    risk: "medium",
    intentBase: 80,
    reason: "Specific facility question that can become useful FAQ coverage.",
    verificationRequired: true,
  },
  {
    id: "luggage-storage",
    topic: "Luggage storage",
    category: "support",
    terms: ["luggage", "baggage", "bag storage", "luggage storage", "koffer", "gepäck", "deposito bagagli", "equipaje", "consigna", "שמירת חפצים", "אחסון מזוודות", "מזוודות"],
    question: "Does {{subject}} offer luggage storage before check-in or after check-out?",
    risk: "low",
    intentBase: 84,
    reason: "Common pre-arrival and departure support question.",
  },
  {
    id: "spa",
    topic: "Spa",
    category: "amenities",
    terms: ["spa", "wellness", "massage", "ספא", "מסאז"],
    question: "Does {{subject}} have spa or wellness facilities?",
    risk: "medium",
    intentBase: 80,
    reason: "Amenity intent that can produce concrete FAQ coverage.",
    verificationRequired: true,
  },
  {
    id: "pool",
    topic: "Pool",
    category: "amenities",
    terms: ["pool", "swimming pool", "piscina", "schwimmbad", "בריכה"],
    question: "Does {{subject}} have a pool?",
    risk: "medium",
    intentBase: 82,
    reason: "Specific facility intent with stable guest-facing details.",
    verificationRequired: true,
  },
  {
    id: "all-inclusive",
    topic: "All-inclusive stays",
    category: "booking",
    terms: ["all inclusive", "all-inclusive", "allinclusive", "alles inklusive", "tutto incluso", "todo incluido", "הכל כלול", "הכול כלול"],
    question: "Does {{subject}} offer all-inclusive stays?",
    risk: "medium",
    intentBase: 78,
    reason: "Direct all-inclusive query support, but this service claim must be verified against an official source before use.",
    verificationRequired: true,
  },
  {
    id: "restaurant",
    topic: "Restaurant and dining",
    category: "amenities",
    terms: ["restaurant", "restaurants", "dining", "dinner", "lunch", "bar", "ristorante", "cena", "pranzo", "restaurante", "comida", "essen", "abendessen", "מסעדה", "מסעדות", "ארוחת ערב", "בר"],
    question: "What dining options are available at {{subject}}?",
    risk: "medium",
    intentBase: 82,
    reason: "Common in-stay planning intent with useful FAQ potential.",
    verificationRequired: true,
  },
  {
    id: "kitchen",
    topic: "Kitchen facilities",
    category: "amenities",
    terms: ["kitchen", "kitchenette", "oven", "stovetop", "microwave", "dishwasher", "fridge", "refrigerator", "küche", "cucina", "cocina", "מטבח", "מיקרוגל", "מדיח", "מקרר"],
    question: "Do rooms or apartments at {{subject}} include a kitchen?",
    risk: "low",
    intentBase: 82,
    reason: "Specific room-facility intent that helps guests assess fit.",
  },
  {
    id: "washer-dryer",
    topic: "Washer and dryer",
    category: "amenities",
    terms: ["washer", "dryer", "washer dryer", "laundry", "washing machine", "waschmaschine", "trockner", "lavatrice", "asciugatrice", "lavadora", "secadora", "מכונת כביסה", "מייבש", "כביסה"],
    question: "Is a washer or dryer available at {{subject}}?",
    risk: "low",
    intentBase: 80,
    reason: "Useful practical-stay detail, especially for longer stays.",
  },
  {
    id: "cleaning",
    topic: "Cleaning and linen",
    category: "amenities",
    terms: ["cleaning", "housekeeping", "linen", "towels", "sheets", "room cleaning", "zimmerreinigung", "reinigung", "pulizia", "biancheria", "limpieza", "sabanas", "sábanas", "ניקיון", "מצעים", "מגבות"],
    question: "How often are cleaning and linen changes provided at {{subject}}?",
    risk: "low",
    intentBase: 80,
    reason: "Operational stay-detail question with strong FAQ value.",
  },
  {
    id: "payment",
    topic: "Payment",
    category: "booking",
    terms: ["payment", "pay", "credit card", "card", "prepayment", "zahlung", "kreditkarte", "pagamento", "carta di credito", "pago", "tarjeta", "תשלום", "אשראי", "כרטיס אשראי"],
    question: "What payment methods and deposits does {{subject}} require?",
    risk: "medium",
    intentBase: 84,
    reason: "Booking-friction intent that can become a useful policy FAQ.",
  },
  {
    id: "access-code",
    topic: "Access code",
    category: "policy",
    terms: ["access code", "door code", "entry code", "self check-in", "self check in", "codigo de acceso", "código de acceso", "codice accesso", "zugangscode", "קוד כניסה", "קוד גישה"],
    question: "When will guests receive the access code for {{subject}}?",
    risk: "low",
    intentBase: 86,
    reason: "Specific arrival-flow question that can prevent support issues.",
  },
  {
    id: "deposit",
    topic: "Damage deposit",
    category: "booking",
    terms: ["damage deposit", "security deposit", "deposit", "kaution", "cauzione", "fianza", "deposito", "depósito", "פיקדון", "פקדון"],
    question: "Is a damage deposit required at {{subject}}?",
    risk: "medium",
    intentBase: 84,
    reason: "Booking-friction intent that belongs in a policy FAQ when source-confirmed.",
  },
  {
    id: "vat-tax",
    topic: "VAT and taxes",
    category: "booking",
    terms: ["vat", "tax", "taxes", "tourist tax", "iva", "mwst", "mehrwertsteuer", "impuestos", "imposta", "מע מ", "מע״מ", "מס", "מיסים"],
    question: "Does {{subject}} charge VAT or local taxes?",
    risk: "medium",
    intentBase: 80,
    reason: "Commercial policy intent that is useful when verified against official sources.",
  },
  {
    id: "occupancy",
    topic: "Occupancy",
    category: "policy",
    terms: ["occupancy", "maximum guests", "max guests", "capacity", "persons", "people", "belegung", "ospiti", "capienza", "ocupacion", "ocupación", "תפוסה", "מספר אורחים", "אורחים"],
    question: "What is the maximum occupancy for each room or apartment type at {{subject}}?",
    risk: "low",
    intentBase: 80,
    reason: "Specific suitability and policy question for booking decisions.",
  },
  {
    id: "airport",
    topic: "Airport access",
    category: "location",
    terms: ["airport", "airport shuttle", "flughafen", "aeroporto", "aeropuerto", "שדה תעופה", "נתבג"],
    question: "What airport transfer options are available for {{subject}}?",
    risk: "medium",
    intentBase: 84,
    reason: "Arrival-planning intent with practical location value.",
    verificationRequired: true,
  },
  {
    id: "transport",
    topic: "Transport",
    category: "location",
    terms: ["transport", "public transport", "bus", "train", "metro", "taxi", "bahnhof", "zug", "autobus", "trasporto", "transporte", "tren", "תחבורה", "רכבת", "אוטובוס", "מונית"],
    question: "What public transport options are near {{subject}}?",
    risk: "low",
    intentBase: 82,
    reason: "Practical arrival and local-navigation intent.",
  },
  {
    id: "location",
    topic: "Location",
    category: "location",
    terms: ["location", "address", "where", "map", "adresse", "lage", "posizione", "indirizzo", "ubicacion", "ubicación", "direccion", "dirección", "כתובת", "מיקום", "איפה"],
    question: "Where is {{subject}} located?",
    risk: "low",
    intentBase: 80,
    reason: "Direct location or address query support without inventing nearby attractions.",
  },
  {
    id: "location-ibiza-area",
    topic: "Location ambiguity",
    category: "location",
    terms: ["es canar", "santa eularia", "santa eulalia del rio", "santa eulària", "cala nova"],
    question: "Is {{subject}} located in Es Canar or Santa Eulalia?",
    risk: "low",
    intentBase: 86,
    reason: "Direct area-name query support suggests guests may need location disambiguation.",
  },
  {
    id: "beach-distance",
    topic: "Beach distance",
    category: "location",
    terms: ["beach", "beaches", "strand", "spiaggia", "playa", "חוף"],
    question: "How close is {{subject}} to the beach?",
    risk: "low",
    intentBase: 78,
    reason: "Direct beach-distance intent; the question stays close to the searched location signal.",
  },
  {
    id: "city-centre-distance",
    topic: "City centre distance",
    category: "location",
    terms: ["city centre", "city center", "center", "centre", "zentrum", "centro", "מרכז"],
    question: "How close is {{subject}} to the city centre?",
    risk: "low",
    intentBase: 78,
    reason: "Direct centre-distance intent; the question stays close to the searched location signal.",
  },
  {
    id: "nearby-attractions",
    topic: "Nearby attractions",
    category: "location",
    terms: ["attractions", "things to do", "nearby attractions", "nightlife", "market", "promenade", "shopping", "sehenswurdigkeiten", "sehenswürdigkeiten", "attrazioni", "cose da fare", "atracciones", "que hacer", "qué hacer", "אטרקציות", "מה לעשות", "שוק", "טיילת", "חיי לילה"],
    question: "What attractions or places of interest are near {{subject}}?",
    risk: "low",
    intentBase: 80,
    reason: "Direct attractions or things-to-do query support.",
  },
  {
    id: "policies",
    topic: "Policies",
    category: "policy",
    terms: ["policy", "policies", "rules", "smoking", "age", "allowed", "hours", "richtlinie", "regeln", "rauchen", "politica", "politiche", "fumare", "politica", "política", "normas", "fumar", "מדיניות", "כללים", "עישון", "גיל", "מותר"],
    question: "What house rules or quiet hours apply at {{subject}}?",
    risk: "low",
    intentBase: 82,
    reason: "Specific rule or requirement intent that belongs in FAQs.",
  },
  {
    id: "price",
    topic: "Price and rates",
    category: "booking",
    terms: ["price", "prices", "rate", "rates", "cost", "cheap", "preco", "preços", "prezzo", "prezzi", "precio", "precios", "preis", "preise", "מחיר", "מחירים", "עלות"],
    question: "Where can guests check current rates for {{subject}}?",
    risk: "high",
    intentBase: 58,
    reason: "Commercial intent is real, but prices change and should not be auto-used without care.",
    verificationRequired: true,
  },
];

const FAQ_NOISE_TOPICS: FaqOpportunityTopicDefinition[] = [
  {
    id: "noise-photos",
    topic: "Photos and images",
    category: "general",
    terms: ["photo", "photos", "image", "images", "picture", "pictures", "gallery", "fotos", "bilder", "immagini", "imagenes", "imágenes", "תמונה", "תמונות", "גלריה"],
    question: "Filtered out: photo and image searches for {{subject}}",
    risk: "high",
    intentBase: 8,
    reason: "Rejected as visual intent, not a FAQ/GEO opportunity.",
    rejected: true,
  },
  {
    id: "noise-reviews",
    topic: "Reviews",
    category: "comparison",
    terms: ["review", "reviews", "rating", "ratings", "tripadvisor", "opinion", "opinions", "avaliacao", "avaliacoes", "avaliação", "avaliações", "bewertung", "bewertungen", "recensione", "recensioni", "opiniones", "reseñas", "ביקורת", "ביקורות", "חוות דעת", "דירוג"],
    question: "Filtered out: review and trust searches for {{subject}}",
    risk: "high",
    intentBase: 8,
    reason: "Rejected as review/trust intent, not a direct FAQ opportunity.",
    rejected: true,
  },
  {
    id: "noise-official-homepage",
    topic: "Official site and homepage",
    category: "general",
    terms: ["official", "official website", "homepage", "home page", "website", "sito ufficiale", "web oficial", "offizielle website", "אתר רשמי", "האתר הרשמי"],
    question: "Filtered out: official-site navigation for {{subject}}",
    risk: "high",
    intentBase: 8,
    reason: "Rejected as navigational intent rather than guest FAQ intent.",
    rejected: true,
  },
  {
    id: "noise-booking-navigation",
    topic: "Booking navigation",
    category: "booking",
    terms: ["booking.com", "booking com", "book hotel", "hotel booking", "reservar hotel", "prenota hotel", "hotel buchen", "בוקינג"],
    question: "Filtered out: booking-platform navigation for {{subject}}",
    risk: "high",
    intentBase: 10,
    reason: "Rejected as booking-platform or navigation intent unless the query contains a concrete policy topic.",
    rejected: true,
  },
];

export class FaqDemandService {
  private analytics = new AnalyticsService();
  private searchConsole = new SearchConsoleService();

  async listSources(): Promise<{
    analyticsAccounts: AnalyticsAccount[];
    searchConsoleSites: SearchConsoleSite[];
  }> {
    const [analyticsAccounts, searchConsoleSites] = await Promise.all([
      Promise.resolve(this.analytics.listAccounts()),
      this.searchConsole.listSites(),
    ]);

    return {
      analyticsAccounts,
      searchConsoleSites,
    };
  }

  async analyze(input: FaqDemandInput = {}): Promise<FaqDemandResult> {
    const subject = String(input.subject || input.websiteUrl || "this site").trim();
    const limit = Math.max(25, Math.min(Number(input.limit || 200), 500));
    const maxPhrases = Math.max(3, Math.min(Number(input.maxPhrases || 10), 30));
    const questionsPerPhrase = Math.max(1, Math.min(Number(input.questionsPerPhrase || 1), 5));
    const warnings: string[] = [];

    let analyticsAccount: AnalyticsAccount | undefined;
    let searchConsoleSite: SearchConsoleSite | undefined;
    let topLandingPages: AnalyticsFaqLandingPage[] = [];
    let topSiteSearchTerms: AnalyticsFaqSearchTerm[] = [];
    let topQueries: SearchConsoleQueryRow[] = [];

    if (input.analytics?.enabled !== false) {
      try {
        const analyticsResult = await this.analytics.fetchFaqDemandSignals({
          accountId: input.analytics?.accountId,
          propertyId: input.analytics?.propertyId,
          dateRange: input.dateRange,
          limit,
        });
        analyticsAccount = analyticsResult.account;
        topLandingPages = analyticsResult.landingPages;
        topSiteSearchTerms = analyticsResult.siteSearchTerms;
      } catch (error: any) {
        warnings.push(`Analytics signals were not loaded: ${error?.message || "unknown error"}`);
      }
    }

    if (input.searchConsole?.enabled !== false) {
      try {
        const searchResult = await this.searchConsole.fetchQueryRows({
          siteUrl: input.searchConsole?.siteUrl || input.websiteUrl,
          dateRange: input.dateRange,
          limit,
        });
        searchConsoleSite = searchResult.site;
        const subjectRows = await this.fetchSubjectSearchConsoleRows({
          subject,
          siteUrl: searchConsoleSite.siteUrl,
          dateRange: input.dateRange,
          limit: Math.min(limit, 150),
        });
        topQueries = this.uniqueSearchConsoleRows([...searchResult.rows, ...subjectRows.rows])
          .sort((a, b) => this.searchConsoleScore(b) - this.searchConsoleScore(a));
        warnings.push(...subjectRows.warnings);
      } catch (error: any) {
        warnings.push(`Search Console signals were not loaded: ${error?.message || "unknown error"}`);
      }
    }

    const rawQueries = topQueries.length;
    const rawLandingPages = topLandingPages.length;
    const rawSiteSearchTerms = topSiteSearchTerms.length;
    const rawSignalCount = rawQueries + rawLandingPages + rawSiteSearchTerms;
    const matchedQueryRows = this.filterBySubject(topQueries, subject, (row) => `${row.query} ${row.page}`);
    const matchedLandingPageRows = this.filterBySubject(topLandingPages, subject, (page) => `${page.pageTitle} ${page.pagePath}`);
    const matchedSiteSearchTermRows = this.filterBySubject(topSiteSearchTerms, subject, (term) => term.searchTerm);
    topQueries = matchedQueryRows.slice(0, 40);
    topLandingPages = matchedLandingPageRows.slice(0, 20);
    topSiteSearchTerms = matchedSiteSearchTermRows.slice(0, 20);

    const matchedQueries = matchedQueryRows.length;
    const matchedLandingPages = matchedLandingPageRows.length;
    const matchedSiteSearchTerms = matchedSiteSearchTermRows.length;
    const subjectSignalCount = matchedQueries + matchedLandingPages + matchedSiteSearchTerms;
    if (rawSignalCount && !subjectSignalCount) {
      warnings.push(`Ignored ${rawSignalCount - subjectSignalCount} signals that did not match "${subject}". Check the selected GA4 property or Search Console site if this looks too strict.`);
    }

    let phrases = this.buildPhrases(subject, topQueries, topLandingPages, topSiteSearchTerms)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPhrases);
    const realPhraseCount = phrases.length;
    if (!realPhraseCount) {
      phrases = this.addStarterPhrases(subject, phrases, maxPhrases);
      warnings.push(`No subject-matching search phrases were found for "${subject}". Showing starter FAQ phrases instead of unrelated account data.`);
    }
    const opportunities = this.buildOpportunities(subject, matchedQueryRows, matchedLandingPageRows, matchedSiteSearchTermRows);
    const sourcePhraseCount = phrases.filter((phrase) => phrase.source !== "starter-intent").length;
    const starterIdeaCount = phrases.filter((phrase) => phrase.source === "starter-intent").length;
    const candidates = this.buildCandidates(subject, phrases, questionsPerPhrase);
    const categories = this.buildCategories(candidates);

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      subject,
      sources: {
        analyticsAccount,
        searchConsoleSite,
        dateRange: {
          startDate: input.dateRange?.startDate,
          endDate: input.dateRange?.endDate,
        },
        signalCounts: {
          rawQueries,
          matchedQueries,
          rawLandingPages,
          matchedLandingPages,
          rawSiteSearchTerms,
          matchedSiteSearchTerms,
          sourcePhrases: sourcePhraseCount,
          starterIdeas: starterIdeaCount,
        },
        warnings,
      },
      topQueries,
      topLandingPages,
      topSiteSearchTerms,
      phrases,
      opportunities,
      categories,
      candidates,
      promptBrief: this.buildPromptBrief(subject, topQueries, topLandingPages, topSiteSearchTerms, phrases, opportunities, categories, candidates, warnings, questionsPerPhrase),
    };
  }

  private async fetchSubjectSearchConsoleRows(input: {
    subject: string;
    siteUrl: string;
    dateRange?: DateRangeInput;
    limit: number;
  }): Promise<{ rows: SearchConsoleQueryRow[]; warnings: string[] }> {
    const filterSets = this.searchConsoleFilterSetsForSubject(input.subject);
    if (!filterSets.length) return { rows: [], warnings: [] };

    const results = await Promise.allSettled(
      filterSets.map((dimensionFilters) =>
        this.searchConsole.fetchQueryRows({
          siteUrl: input.siteUrl,
          dateRange: input.dateRange,
          dimensionFilters,
          limit: input.limit,
        })
      )
    );

    const rows: SearchConsoleQueryRow[] = [];
    const warnings: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        rows.push(...result.value.rows);
      } else {
        warnings.push(`A targeted Search Console lookup failed: ${result.reason?.message || String(result.reason)}`);
      }
    }

    return {
      rows: this.uniqueSearchConsoleRows(rows),
      warnings,
    };
  }

  private searchConsoleFilterSetsForSubject(subject: string): SearchConsoleDimensionFilter[][] {
    const filters: SearchConsoleDimensionFilter[] = [];
    const seen = new Set<string>();
    const anchors = this.subjectAnchorTokens(subject);
    const subjectPhrase = this.cleanSignal(subject).toLowerCase();
    const anchorPhrase = anchors.join(" ");
    const tailPhrase = anchors.slice(-2).join(" ");
    const subjectSlug = this.slugifyForSearchConsole(subjectPhrase);
    const tailSlug = this.slugifyForSearchConsole(tailPhrase);

    const add = (dimension: SearchConsoleDimensionFilter["dimension"], expression: string) => {
      const cleanExpression = String(expression || "").trim().toLowerCase();
      if (cleanExpression.length < 3) return;
      const key = `${dimension}:${cleanExpression}`;
      if (seen.has(key)) return;
      seen.add(key);
      filters.push({ dimension, operator: "contains", expression: cleanExpression });
    };

    add("query", subjectPhrase);
    add("query", anchorPhrase);
    add("query", tailPhrase);
    add("page", subjectSlug);
    add("page", tailSlug);

    return filters.map((filter) => [filter]);
  }

  private uniqueSearchConsoleRows(rows: SearchConsoleQueryRow[]): SearchConsoleQueryRow[] {
    const byKey = new Map<string, SearchConsoleQueryRow>();
    for (const row of rows) {
      const key = `${row.query.toLowerCase()}|${row.page.toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing || this.searchConsoleScore(row) > this.searchConsoleScore(existing)) {
        byKey.set(key, row);
      }
    }
    return Array.from(byKey.values());
  }

  private searchConsoleScore(row: SearchConsoleQueryRow): number {
    return row.impressions + row.clicks * 8 + (row.position ? Math.max(0, 20 - row.position) * 3 : 0);
  }

  private buildPhrases(
    subject: string,
    queries: SearchConsoleQueryRow[],
    landingPages: AnalyticsFaqLandingPage[],
    siteSearchTerms: AnalyticsFaqSearchTerm[]
  ): FaqDemandPhrase[] {
    const seen = new Set<string>();
    const phrases: FaqDemandPhrase[] = [];

    const add = (phrase: FaqDemandPhrase) => {
      const key = this.intentKey(subject, phrase.phrase || phrase.intent);
      if (!key || key.length < 3 || seen.has(key)) return;
      seen.add(key);
      phrases.push(phrase);
    };

    for (const row of queries) {
      const phrase = this.cleanSignal(row.query || this.pathToSignal(row.page));
      const intent = this.intentFromPhrase(subject, phrase);
      if (!this.matchesSubject(subject, `${phrase} ${row.page}`)) continue;
      if (this.isLikelySiblingEntitySignal(subject, `${phrase} ${row.page}`)) continue;
      if (!this.isUsefulPhrase(subject, phrase, intent)) continue;
      const category = this.classify(`${phrase} ${intent}`);
      add({
        phrase,
        intent,
        category,
        source: "search-console",
        page: row.page,
        score: Math.round(row.impressions + row.clicks * 12 + (row.position ? Math.max(0, 20 - row.position) * 3 : 0)),
        evidence: `${row.impressions} impressions, ${row.clicks} clicks, avg. position ${this.round(row.position)}`,
      });
    }

    for (const term of siteSearchTerms) {
      const phrase = this.cleanSignal(term.searchTerm);
      const intent = this.intentFromPhrase(subject, phrase);
      if (!this.matchesSubject(subject, phrase)) continue;
      if (this.isLikelySiblingEntitySignal(subject, phrase)) continue;
      if (!this.isUsefulPhrase(subject, phrase, intent)) continue;
      const category = this.classify(`${phrase} ${intent}`);
      add({
        phrase,
        intent,
        category,
        source: "analytics-site-search",
        score: Math.round(term.events * 10 + term.sessions),
        evidence: `${term.events} site-search events${term.sessions ? `, ${term.sessions} sessions` : ""}`,
      });
    }

    for (const page of landingPages) {
      const phrase = this.cleanSignal(this.pageSignal(page));
      const intent = this.intentFromPhrase(subject, phrase);
      if (!this.matchesSubject(subject, `${phrase} ${page.pagePath}`)) continue;
      if (this.isLikelySiblingEntitySignal(subject, `${phrase} ${page.pagePath}`)) continue;
      if (!this.isUsefulPhrase(subject, phrase, intent)) continue;
      const category = this.classify(`${phrase} ${page.pagePath} ${intent}`);
      add({
        phrase,
        intent,
        category,
        source: "analytics-page",
        page: page.pagePath,
        score: Math.round(page.sessions + page.views * 0.3 + page.events * 0.05),
        evidence: `${page.sessions} sessions, ${page.views} views`,
      });
    }

    return phrases;
  }

  private buildOpportunities(
    subject: string,
    queries: SearchConsoleQueryRow[],
    _landingPages: AnalyticsFaqLandingPage[],
    siteSearchTerms: AnalyticsFaqSearchTerm[]
  ): FaqOpportunity[] {
    const signals: FaqOpportunitySignal[] = [
      ...queries.map((row) => ({
        text: this.cleanSignal(row.query || this.pathToSignal(row.page)),
        page: row.page,
        source: "search-console" as const,
        impressions: Math.max(0, Math.round(row.impressions || 0)),
        clicks: Math.max(0, Math.round(row.clicks || 0)),
        ctr: row.ctr,
        position: row.position,
      })),
      ...siteSearchTerms.map((term) => ({
        text: this.cleanSignal(term.searchTerm),
        page: undefined,
        source: "analytics-site-search" as const,
        impressions: Math.max(0, Math.round(term.sessions || term.events || 0)),
        clicks: 0,
      })),
    ].filter((signal) => signal.text || signal.page);

    const groups = new Map<string, FaqOpportunityAccumulator>();

    for (const signal of signals) {
      const text = `${signal.text} ${signal.page || ""}`;
      if (!this.matchesSubject(subject, text)) continue;

      const definition = this.opportunityDefinitionForSignal(subject, signal);
      if (!definition) continue;

      const key = definition.id;
      const accumulator = groups.get(key) || this.createOpportunityAccumulator(definition);
      const faqIntentScore = this.faqIntentScore(subject, signal, definition);
      const pageFitScore = this.pageFitScore(signal, definition);
      const performanceScore = this.performanceScore(signal);
      const finalOpportunityScore = this.finalOpportunityScore(faqIntentScore, pageFitScore, performanceScore, definition);

      accumulator.sourceQueries.add(signal.text || this.pathToSignal(signal.page || ""));
      if (signal.page) accumulator.pages.add(signal.page);
      accumulator.impressions += signal.impressions;
      accumulator.clicks += signal.clicks;
      if (Number.isFinite(signal.position) && signal.position && signal.impressions > 0) {
        accumulator.positionWeightedTotal += signal.position * signal.impressions;
        accumulator.positionWeight += signal.impressions;
      }
      accumulator.faqIntentScores.push(faqIntentScore);
      accumulator.pageFitScores.push(pageFitScore);
      accumulator.performanceScores.push(performanceScore);
      accumulator.finalScores.push(finalOpportunityScore);
      this.addOpportunityReasonFlags(subject, signal, definition, accumulator.reasonFlags);
      groups.set(key, accumulator);
    }

    return Array.from(groups.values())
      .map((accumulator) => this.finalizeOpportunity(subject, accumulator))
      .sort((a, b) => {
        const order: Record<FaqOpportunityStrength, number> = {
          strong: 0,
          maybe: 1,
          weak: 2,
          rejected: 3,
        };
        const byStrength = order[a.strength] - order[b.strength];
        if (byStrength) return byStrength;
        return b.metrics.impressions - a.metrics.impressions;
      });
  }

  private createOpportunityAccumulator(definition: FaqOpportunityTopicDefinition): FaqOpportunityAccumulator {
    return {
      definition,
      sourceQueries: new Set<string>(),
      pages: new Set<string>(),
      impressions: 0,
      clicks: 0,
      positionWeightedTotal: 0,
      positionWeight: 0,
      faqIntentScores: [],
      pageFitScores: [],
      performanceScores: [],
      finalScores: [],
      reasonFlags: new Set<string>(),
    };
  }

  private opportunityDefinitionForSignal(subject: string, signal: FaqOpportunitySignal): FaqOpportunityTopicDefinition | null {
    const text = signal.text || "";
    const intentText = this.intentFromPhrase(subject, text);
    const noiseDefinition = FAQ_NOISE_TOPICS.find((definition) => this.matchesAnyTerm(text, definition.terms));
    const positiveDefinition = FAQ_OPPORTUNITY_TOPICS.find((definition) => this.matchesAnyTerm(intentText, definition.terms));

    if (noiseDefinition?.rejected) {
      return noiseDefinition;
    }

    if (this.isBookingNavigationSignal(text) && !positiveDefinition) {
      return FAQ_NOISE_TOPICS.find((definition) => definition.id === "noise-booking-navigation") || null;
    }

    if (!positiveDefinition && (this.isBrandOnly(subject, signal.text) || this.isEntityVariantSignal(subject, signal.text))) {
      return {
        id: "noise-brand-navigation",
        topic: "Brand or hotel-name variant",
        category: "general",
        terms: [],
        question: "Filtered out: brand or hotel-name navigation for {{subject}}",
        risk: "high",
        intentBase: 5,
        reason: "Rejected as brand-only or hotel-name navigation without a concrete FAQ intent.",
        rejected: true,
      };
    }

    return positiveDefinition || null;
  }

  private faqIntentScore(subject: string, signal: FaqOpportunitySignal, definition: FaqOpportunityTopicDefinition): number {
    if (definition.rejected) return definition.intentBase;

    const text = `${signal.text} ${signal.page || ""}`;
    const intentText = this.intentFromPhrase(subject, signal.text);
    let score = definition.intentBase;

    if (this.looksLikeQuestion(signal.text)) score += 10;
    if (this.matchesAnyTerm(text, ["how", "what", "when", "where", "does", "is", "are", "can", "should", "wie", "was", "wann", "wo", "como", "cómo", "que", "qué", "donde", "dónde", "איך", "מה", "מתי", "איפה", "האם"])) {
      score += 6;
    }

    const intentTokens = this.intentKey(subject, signal.text).split(" ").filter(Boolean);
    if (intentTokens.length >= 2) score += 6;
    if (intentTokens.length >= 4) score += 4;

    if (definition.rejected && this.matchesAnyTerm(text, ["photo", "photos", "image", "reviews", "official", "homepage", "booking.com"])) {
      score -= 35;
    } else if (this.matchesAnyTerm(text, ["photo", "photos", "image", "reviews", "booking.com"])) {
      score -= 6;
    }

    if (!this.matchesAnyTerm(intentText, definition.terms)
      && (this.isBrandOnly(subject, signal.text) || this.isEntityVariantSignal(subject, signal.text))) {
      score -= 50;
    }

    return this.clampScore(score);
  }

  private pageFitScore(signal: FaqOpportunitySignal, definition: FaqOpportunityTopicDefinition): number {
    const page = signal.page || "";
    if (!page) return signal.source === "analytics-site-search" ? 58 : 48;

    let score = 54;
    if (this.matchesAnyTerm(page, [definition.topic, ...definition.terms])) score += 24;
    if (this.matchesAnyTerm(page, ["faq", "questions", "help", "info", "amenities", "facilities", "rooms", "location", "policy", "policies"])) score += 10;
    if (/\/$/.test(page) || this.matchesAnyTerm(page, ["homepage", "home", "gallery", "photos", "reviews"])) score -= 24;

    return this.clampScore(score);
  }

  private performanceScore(signal: FaqOpportunitySignal): number {
    const impressionScore = Math.min(42, Math.log10(Math.max(1, signal.impressions) + 1) * 18);
    const clickScore = Math.min(28, Math.sqrt(Math.max(0, signal.clicks)) * 8);
    const positionScore = signal.position ? Math.max(0, 30 - Math.min(30, signal.position)) : 10;
    return this.clampScore(impressionScore + clickScore + positionScore);
  }

  private finalOpportunityScore(
    faqIntentScore: number,
    pageFitScore: number,
    performanceScore: number,
    definition: FaqOpportunityTopicDefinition
  ): number {
    const weighted = faqIntentScore * 0.5 + pageFitScore * 0.25 + performanceScore * 0.25;
    const riskPenalty = definition.risk === "high" ? 12 : definition.risk === "medium" ? 4 : 0;
    const rejectedCap = definition.rejected ? 24 : 100;
    return Math.min(rejectedCap, this.clampScore(weighted - riskPenalty));
  }

  private addOpportunityReasonFlags(
    subject: string,
    signal: FaqOpportunitySignal,
    definition: FaqOpportunityTopicDefinition,
    flags: Set<string>
  ): void {
    const intentText = this.intentFromPhrase(subject, signal.text);

    if (definition.rejected) flags.add(definition.reason);
    if (definition.verificationRequired) flags.add("Needs verification from an official source before it can be used automatically.");
    if (definition.risk === "high") flags.add("High factual or usefulness risk; should not be used automatically.");
    if (this.matchesAnyTerm(intentText, definition.terms)) flags.add(definition.reason);
    if (this.looksLikeQuestion(signal.text)) flags.add("The source query is already phrased like a question.");
    if (signal.clicks > 0 || signal.impressions >= 50) flags.add("There is measurable demand, but demand is capped in scoring.");
    if (!this.matchesAnyTerm(intentText, definition.terms)
      && (this.isBrandOnly(subject, signal.text) || this.isEntityVariantSignal(subject, signal.text))) {
      flags.add("Brand-only or hotel-name variant signal with no concrete guest question.");
    }
  }

  private finalizeOpportunity(subject: string, accumulator: FaqOpportunityAccumulator): FaqOpportunity {
    const definition = accumulator.definition;
    const faqIntentScore = this.averageScore(accumulator.faqIntentScores);
    const pageFitScore = this.averageScore(accumulator.pageFitScores);
    const performanceScore = this.performanceScore({
      text: definition.topic,
      source: "search-console",
      impressions: accumulator.impressions,
      clicks: accumulator.clicks,
      position: accumulator.positionWeight ? accumulator.positionWeightedTotal / accumulator.positionWeight : undefined,
    });
    const finalOpportunityScore = this.finalOpportunityScore(faqIntentScore, pageFitScore, performanceScore, definition);
    const strength = this.opportunityStrength(definition, finalOpportunityScore);
    const verificationStatus = this.opportunityVerificationStatus(definition);
    const avgPosition = accumulator.positionWeight
      ? accumulator.positionWeightedTotal / accumulator.positionWeight
      : undefined;
    const ctr = accumulator.impressions > 0 ? accumulator.clicks / accumulator.impressions : undefined;
    const scoreSummary = `Scores: intent ${Math.round(faqIntentScore)}, page ${Math.round(pageFitScore)}, performance ${Math.round(performanceScore)}, final ${Math.round(finalOpportunityScore)}.`;

    return {
      id: definition.id,
      topic: definition.topic,
      category: definition.category,
      candidateQuestion: this.renderOpportunityQuestion(definition, subject),
      strength,
      verificationStatus,
      reason: [Array.from(accumulator.reasonFlags)[0] || definition.reason, scoreSummary].join(" "),
      risk: definition.risk,
      sourceQueries: Array.from(accumulator.sourceQueries).filter(Boolean).slice(0, 8),
      pages: Array.from(accumulator.pages).filter(Boolean).slice(0, 6),
      metrics: {
        impressions: accumulator.impressions,
        clicks: accumulator.clicks,
        ...(ctr != null ? { ctr: this.roundNumber(ctr, 4) } : {}),
        ...(avgPosition != null ? { avgPosition: this.roundNumber(avgPosition, 1) } : {}),
      },
    };
  }

  private opportunityStrength(
    definition: FaqOpportunityTopicDefinition,
    finalOpportunityScore: number
  ): FaqOpportunityStrength {
    if (definition.rejected) return "rejected";
    if (definition.verificationRequired && finalOpportunityScore >= 48) return "maybe";
    if (finalOpportunityScore >= 72 && definition.risk !== "high") return "strong";
    if (finalOpportunityScore >= 48) return "maybe";
    return "weak";
  }

  private opportunityVerificationStatus(definition: FaqOpportunityTopicDefinition): FaqOpportunityVerificationStatus {
    if (definition.rejected) return "rejected";
    if (definition.verificationRequired) return "needs_verification";
    return "query_supported";
  }

  private renderOpportunityQuestion(definition: FaqOpportunityTopicDefinition, subject: string): string {
    return definition.question.replace(/{{subject}}/g, subject || "this property");
  }

  private isEntityVariantSignal(subject: string, signal: string): boolean {
    const key = this.intentKey(subject, signal);
    const tokens = this.tokenize(key);
    if (!tokens.length) return false;
    return tokens.every((token) =>
      HOSPITALITY_ENTITY_TOKENS.has(token) ||
      SUBJECT_GENERIC_TOKENS.has(token) ||
      ["royal", "grand", "palace", "plaza", "beach"].includes(token)
    );
  }

  private isBookingNavigationSignal(text: string): boolean {
    if (!this.matchesAnyTerm(text, ["booking", "booking.com", "booking com", "book hotel"])) return false;
    return !this.matchesAnyTerm(text, ["cancel", "cancellation", "refund", "payment", "deposit", "policy", "policies", "ביטול", "תשלום", "החזר"]);
  }

  private addStarterPhrases(subject: string, phrases: FaqDemandPhrase[], maxPhrases: number): FaqDemandPhrase[] {
    if (!this.hasSubjectAnchors(subject) || phrases.length >= maxPhrases) return phrases;

    const output = [...phrases];
    const seen = new Set(output.map((phrase) => this.intentKey(subject, phrase.phrase)));
    const starterIntents = [
      { intent: "check-in", category: "policy" },
      { intent: "check-out", category: "policy" },
      { intent: "breakfast", category: "amenities" },
      { intent: "parking", category: "location" },
      { intent: "rooms", category: "amenities" },
      { intent: "location", category: "location" },
      { intent: "cancellation policy", category: "booking" },
      { intent: "contact", category: "support" },
      { intent: "accessibility", category: "amenities" },
      { intent: "pets", category: "policy" },
    ];

    for (const starter of starterIntents) {
      if (output.length >= maxPhrases) break;
      const phrase = this.cleanSignal(`${subject} ${starter.intent}`);
      const key = this.intentKey(subject, phrase);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push({
        phrase,
        intent: starter.intent,
        category: starter.category,
        source: "starter-intent",
        score: 1,
        evidence: "starter FAQ intent; no matching source row found",
      });
    }

    return output;
  }

  private buildCandidates(
    subject: string,
    phrases: FaqDemandPhrase[],
    questionsPerPhrase: number
  ): FaqDemandCandidate[] {
    return phrases.flatMap((phrase) =>
      this.questionAnglesForPhrase(subject, phrase, questionsPerPhrase).map((question) => ({
        question,
        category: phrase.category,
        source: phrase.source,
        signal: phrase.phrase,
        page: phrase.page,
        score: phrase.score,
        evidence: phrase.evidence,
      }))
    );
  }

  private buildCategories(candidates: FaqDemandCandidate[]): FaqDemandCategory[] {
    const grouped = new Map<string, FaqDemandCandidate[]>();
    for (const candidate of candidates) {
      grouped.set(candidate.category, [...(grouped.get(candidate.category) || []), candidate]);
    }

    return Array.from(grouped.entries())
      .map(([category, items]) => {
        const meta = CATEGORY_META[category] || CATEGORY_META.general;
        return {
          title: meta.title,
          description: meta.description,
          count: items.length,
          signals: Array.from(new Set(items.map((item) => item.signal))).slice(0, 6),
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  private buildPromptBrief(
    subject: string,
    queries: SearchConsoleQueryRow[],
    landingPages: AnalyticsFaqLandingPage[],
    siteSearchTerms: AnalyticsFaqSearchTerm[],
    phrases: FaqDemandPhrase[],
    opportunities: FaqOpportunity[],
    _categories: FaqDemandCategory[],
    _candidates: FaqDemandCandidate[],
    warnings: string[],
    questionsPerPhrase: number
  ): string {
    const mandatoryOpportunities = opportunities.filter((opportunity) =>
      opportunity.strength === "strong"
      && opportunity.risk !== "high"
      && opportunity.verificationStatus !== "needs_verification"
    );
    const reviewOnlyOpportunities = opportunities.filter((opportunity) =>
      opportunity.strength === "maybe"
      || opportunity.verificationStatus === "needs_verification"
    );
    const rejectedOpportunities = opportunities.filter((opportunity) => opportunity.strength === "rejected");
    const lines = [
      `SEARCH-DEMAND FAQ BRIEF FOR ${subject}`,
      "",
      "Use Search Console and GA4 signals as question-demand evidence only. They are not factual answer sources.",
      "For final answers, verify facts against official or otherwise approved sources.",
      "Mandatory opportunities are strong, low-risk and query-supported. Add them to the Research questions plan unless they duplicate another row or violate source rules.",
      "Review-only opportunities need human/source verification and must not be added automatically.",
      `Use the candidate question itself as preferred wording. Create at most ${questionsPerPhrase} row(s) per opportunity and merge duplicates across similar topics.`,
      "",
      "Mandatory FAQ opportunities:",
      ...(mandatoryOpportunities.length
        ? mandatoryOpportunities.slice(0, 12).map((opportunity) =>
            `- ${opportunity.candidateQuestion} | Topic: ${opportunity.topic} | ${opportunity.category} | ${opportunity.metrics.impressions} impressions, ${opportunity.metrics.clicks} clicks | Queries: ${opportunity.sourceQueries.join(", ")} | ${opportunity.reason}`
          )
        : ["- No mandatory query-supported FAQ opportunities were found."]),
      "",
      "Review-only opportunities:",
      ...(reviewOnlyOpportunities.length
        ? reviewOnlyOpportunities.slice(0, 8).map((opportunity) =>
            `- ${opportunity.candidateQuestion} | ${opportunity.verificationStatus} | ${opportunity.metrics.impressions} impressions, ${opportunity.metrics.clicks} clicks | Queries: ${opportunity.sourceQueries.join(", ")}`
          )
        : ["- None."]),
      "",
      "Rejected signals for debug only:",
      ...(rejectedOpportunities.length
        ? rejectedOpportunities.slice(0, 8).map((opportunity) =>
            `- ${opportunity.topic}: ${opportunity.sourceQueries.join(", ")} | ${opportunity.reason}`
          )
        : ["- None."]),
      "",
      "Raw source phrases for evidence only:",
      ...phrases.slice(0, 20).map((phrase) => `- ${phrase.phrase} | Intent: ${phrase.intent} | ${phrase.source} | ${phrase.evidence}${phrase.page ? ` | Page: ${phrase.page}` : ""}`),
      "",
      "Top Search Console queries:",
      ...queries.slice(0, 12).map((row) => `- ${row.query || "(empty query)"} | ${row.impressions} impressions, ${row.clicks} clicks, avg. position ${this.round(row.position)}${row.page ? ` | ${row.page}` : ""}`),
      "",
      "Top Analytics landing pages:",
      ...landingPages.slice(0, 10).map((page) => `- ${page.pageTitle} | ${page.pagePath} | ${page.sessions} sessions, ${page.views} views`),
      "",
      "Internal site-search terms:",
      ...(siteSearchTerms.length ? siteSearchTerms.slice(0, 10).map((term) => `- ${term.searchTerm} | ${term.events} events`) : ["- No GA4 site-search terms were found or configured."]),
    ];

    if (warnings.length) {
      lines.push("", "Warnings:", ...warnings.map((warning) => `- ${warning}`));
    }

    return lines.join("\n");
  }

  private intentFromPhrase(subject: string, phrase: string): string {
    const subjectTokens = new Set(this.tokenize(subject));
    const tokens = this.tokenize(phrase)
      .filter((token) => !subjectTokens.has(token))
      .filter((token) => !["hotel", "hotels", "official", "website", "www", "com", "near", "the", "a", "an"].includes(token));
    const intent = tokens.join(" ").trim();
    return intent || this.cleanSignal(phrase);
  }

  private intentKey(subject: string, phrase: string): string {
    return this.intentFromPhrase(subject, phrase)
      .toLowerCase()
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
      .replace(/\b(hotel|hotels|official|website|near|the|a|an|and|or)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private isUsefulPhrase(subject: string, phrase: string, intent: string): boolean {
    const cleanPhrase = this.cleanSignal(phrase);
    const cleanIntent = this.cleanSignal(intent);
    if (!cleanPhrase || cleanPhrase.length < 3) return false;
    if (!this.matchesSubject(subject, cleanPhrase)) return false;
    if (!cleanIntent || cleanIntent.length < 3) return false;
    if (this.intentKey(subject, cleanPhrase).split(" ").filter(Boolean).length < 1) return false;
    if (this.isBrandOnly(subject, cleanPhrase)) return false;
    return true;
  }

  private isBrandOnly(subject: string, phrase: string): boolean {
    const phraseTokens = this.tokenize(phrase);
    const subjectTokens = new Set(this.tokenize(subject));
    if (!phraseTokens.length || !subjectTokens.size) return false;
    return phraseTokens.every((token) => subjectTokens.has(token) || ["hotel", "hotels", "official", "website"].includes(token));
  }

  private isLikelySiblingEntitySignal(subject: string, signal: string): boolean {
    const anchors = this.subjectAnchorTokens(subject);
    if (anchors.length !== 2) return false;

    const signalTokens = this.tokenize(signal);
    const signalTokenSet = new Set(signalTokens);
    if (!anchors.every((token) => signalTokenSet.has(token))) return false;
    if (!signalTokens.some((token) => HOSPITALITY_ENTITY_TOKENS.has(token))) return false;

    const subjectAnchorSet = new Set(anchors);
    const nonIntentExtraTokens = Array.from(new Set(signalTokens.filter((token) => {
      return token.length >= 3
        && !subjectAnchorSet.has(token)
        && !SUBJECT_GENERIC_TOKENS.has(token)
        && !DEMAND_INTENT_TOKENS.has(token);
    })));

    return nonIntentExtraTokens.length > 0;
  }

  private tokenize(value: string): string[] {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private filterBySubject<T>(items: T[], subject: string, textForItem: (item: T) => string): T[] {
    if (!this.hasSubjectAnchors(subject)) return items;
    return items.filter((item) => this.matchesSubject(subject, textForItem(item)));
  }

  private hasSubjectAnchors(subject: string): boolean {
    return this.subjectAnchorTokens(subject).length > 0;
  }

  private matchesSubject(subject: string, text: string): boolean {
    const anchors = this.subjectAnchorTokens(subject);
    if (!anchors.length) return true;

    const textTokens = this.tokenize(text);
    const textTokenSet = new Set(textTokens);
    const textCompact = textTokens.join("");
    const subjectCompact = anchors.join("");
    if (subjectCompact && textCompact.includes(subjectCompact)) return true;

    const matchedTokens = anchors.filter((token) => textTokenSet.has(token) || textCompact.includes(token));
    if (anchors.length === 1) return matchedTokens.length === 1;

    const distinctiveTokens = this.subjectDistinctiveTokens(anchors);
    const distinctiveMatches = distinctiveTokens.filter((token) => textTokenSet.has(token) || textCompact.includes(token));
    if (!distinctiveMatches.length) return false;

    if (anchors.length === 2) return matchedTokens.length === 2;

    const firstAnchorMatches = textTokenSet.has(anchors[0]) || textCompact.includes(anchors[0]);
    if (anchors.length >= 4 && firstAnchorMatches && matchedTokens.length >= 2) return true;
    if (anchors.length >= 4 && distinctiveMatches.length >= 2) return true;

    const required = anchors.length >= 5 ? 3 : 2;
    return matchedTokens.length >= required;
  }

  private subjectAnchorTokens(subject: string): string[] {
    const tokens = this.tokenize(subject)
      .filter((token) => token.length >= 3)
      .filter((token) => !SUBJECT_GENERIC_TOKENS.has(token));
    return Array.from(new Set(tokens));
  }

  private subjectDistinctiveTokens(anchors: string[]): string[] {
    if (anchors.length <= 1) return anchors;
    if (anchors.length === 2) return anchors.slice(1);
    if (anchors.length === 3) return anchors.slice(2);
    return anchors.slice(-3);
  }

  private questionAnglesForPhrase(subject: string, phrase: FaqDemandPhrase, maxQuestions: number): string[] {
    const subjectName = subject || "this property";
    const intent = phrase.intent || phrase.phrase;
    const category = phrase.category;
    const questions: string[] = [];

    if (this.looksLikeQuestion(phrase.phrase)) {
      questions.push(this.ensureQuestionMark(this.capitalize(phrase.phrase)));
    }

    if (category === "booking") {
      questions.push(`What should guests know about ${intent} at ${subjectName}?`);
      questions.push(`Does ${subjectName} have any booking rules for ${intent}?`);
    } else if (category === "location") {
      questions.push(`How does ${subjectName} handle ${intent}?`);
      questions.push(`What should guests know about ${intent} before arriving at ${subjectName}?`);
    } else if (category === "amenities") {
      questions.push(`Does ${subjectName} offer ${intent}?`);
      questions.push(`What should guests know about ${intent} at ${subjectName}?`);
    } else if (category === "policy") {
      questions.push(`What is the policy for ${intent} at ${subjectName}?`);
      questions.push(`How does ${subjectName} handle ${intent}?`);
    } else if (category === "comparison") {
      questions.push(`What should users know when comparing ${subjectName} for ${intent}?`);
      questions.push(`Is ${subjectName} a good fit for users searching for ${intent}?`);
    } else if (category === "support") {
      questions.push(`How can users get help with ${intent} at ${subjectName}?`);
      questions.push(`Who should users contact about ${intent} at ${subjectName}?`);
    } else {
      questions.push(`What should users know about ${intent} at ${subjectName}?`);
      questions.push(`How does ${subjectName} answer questions about ${intent}?`);
    }

    return Array.from(new Set(questions.map((question) => this.ensureQuestionMark(question)))).slice(0, maxQuestions);
  }

  private classify(value: string): string {
    const text = this.normalizeMatchText(value);
    if (/price|prices|preco|precos|prezzo|prezzi|precio|precios|preis|preise|cost|fee|fees|deposit|refund|cancel|cancellation|payment|book|booking|rate|rates|cheap|deal|מחיר|עלות|ביטול|הזמנה|תשלום/.test(text)) return "booking";
    if (/contact|support|help|phone|email|change|problem|request|service|customer|צור קשר|עזרה|תמיכה|טלפון|שירות/.test(text)) return "support";
    if (/where|address|location|near|nearby|close|airport|flughafen|aeroporto|aeropuerto|train|metro|parking|parkplatz|parcheggio|aparcamiento|transport|map|directions|beach|center|centre|distance|attraction|attractions|landmark|איפה|כתובת|חניה|קרוב|שדה|מיקום/.test(text)) return "location";
    if (/room|suite|apartment|amenit|facility|facilities|wifi|wi fi|wi-fi|wlan|breakfast|fruhstuck|colazione|desayuno|pool|piscina|spa|kitchen|balcony|air conditioning|\bac\b|accessible|accessibility|barrierefrei|accessibile|accesible|חדר|בריכה|ארוחת|מטבח|מרפסת|נגיש|אינטרנט/.test(text)) return "amenities";
    if (/policy|policies|check.?in|check.?out|pet|pets|smok|children|kid|age|rules|allowed|hours|haustiere|animali|mascotas|צ.?ק|חיות|עישון|ילדים|מותר|מדיניות/.test(text)) return "policy";
    if (/review|reviews|best|vs|versus|compare|comparison|rating|worth|safe|legit|recommended|bewertung|recension|opiniones|המלצות|ביקורות|מומלץ|השוואה/.test(text)) return "comparison";
    return "general";
  }

  private pageSignal(page: AnalyticsFaqLandingPage): string {
    const title = String(page.pageTitle || "").replace(/\s+[|-]\s+.*$/, "").trim();
    return title || this.pathToSignal(page.pagePath);
  }

  private pathToSignal(pagePath: string): string {
    return String(pagePath || "")
      .split("?")[0]
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join(" ")
      .replace(/[-_]+/g, " ")
      .trim();
  }

  private cleanSignal(signal: string): string {
    return String(signal || "")
      .replace(/\s+/g, " ")
      .replace(/[?!.]+$/g, "")
      .trim()
      .slice(0, 120);
  }

  private matchesAnyTerm(value: string, terms: string[]): boolean {
    return terms.some((term) => this.matchesTerm(value, term));
  }

  private matchesTerm(value: string, term: string): boolean {
    const haystack = this.normalizeMatchText(value);
    const needle = this.normalizeMatchText(term);
    if (!haystack || !needle) return false;

    const compactHaystack = haystack.replace(/\s+/g, "");
    const compactNeedle = needle.replace(/\s+/g, "");
    if (needle.includes(" ")) {
      return haystack.includes(needle) || compactHaystack.includes(compactNeedle);
    }

    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack)
      || (compactNeedle.length >= 4 && compactHaystack.includes(compactNeedle));
  }

  private normalizeMatchText(value: string): string {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private averageScore(scores: number[]): number {
    if (!scores.length) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private clampScore(score: number): number {
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(100, score));
  }

  private roundNumber(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  private slugifyForSearchConsole(value: string): string {
    return String(value || "")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  private looksLikeQuestion(signal: string): boolean {
    return /^(who|what|when|where|why|how|is|are|can|does|do|should|כמה|איך|איפה|האם|מתי|למה|מה)\b/i.test(signal);
  }

  private ensureQuestionMark(value: string): string {
    return value.endsWith("?") ? value : `${value}?`;
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private round(value: number): string {
    return Number.isFinite(value) ? String(Math.round(value * 10) / 10) : "0";
  }
}
