function stripHtmlTags(s: string): string {
  return String(s ?? "").replace(/<[^>]*>/g, " ");
}

function stripHtmlEntities(s: string): string {
  return String(s ?? "")
    .replace(/&#\d+;/g, " ")
    .replace(/&#x[0-9a-f]+;/gi, " ")
    .replace(/&[a-z]+;/gi, " ");
}

function normalizeDigits(text: string): string {
  return String(text ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function normalizeBase(text: string): string {
  return normalizeDigits(stripHtmlEntities(stripHtmlTags(String(text ?? ""))))
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\u00A0/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function convert12hTo24h(text: string): string {
  return text.replace(
    /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\b/gi,
    (_m, hStr, minStr, apRaw) => {
      let h = parseInt(String(hStr), 10);
      const m = minStr ? parseInt(String(minStr), 10) : 0;
      const ap = String(apRaw).toLowerCase().replace(/[\s.]/g, "");
      const isPm = ap === "pm";
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  );
}

function applyStandaloneWordMap(text: string, map: Record<string, number>): string {
  let t = text;
  const words = Object.keys(map).sort((a, b) => b.length - a.length);
  if (words.length === 0) return t;
  const pattern = words.map(escapeRegExp).join("|");
  t = t.replace(
    new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, "gu"),
    (_m, prefix, word) => `${prefix}${map[word]}`
  );
  return t;
}

function wordsToNumbers(text: string, lang: string): string {
  let t = text;

  const enBase: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
  };

  const enTens: Record<string, number> = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };

  const deBase: Record<string, number> = {
    null: 0,
    eins: 1,
    eine: 1,
    ein: 1,
    zwei: 2,
    drei: 3,
    vier: 4,
    funf: 5,
    fuenf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,
    zehn: 10,
    elf: 11,
    zwolf: 12,
    zwoelf: 12,
    dreizehn: 13,
    vierzehn: 14,
    funfzehn: 15,
    fuenfzehn: 15,
    sechzehn: 16,
    siebzehn: 17,
    achtzehn: 18,
    neunzehn: 19,
  };

  const deTens: Record<string, number> = {
    zwanzig: 20,
    dreissig: 30,
    dreißig: 30,
    vierzig: 40,
    funfzig: 50,
    fuenfzig: 50,
    sechzig: 60,
    siebzig: 70,
    achtzig: 80,
    neunzig: 90,
  };

  const esBase: Record<string, number> = {
    cero: 0,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
    veinte: 20,
    veintiuno: 21,
    veintidos: 22,
    veintitres: 23,
    veinticuatro: 24,
  };

  const itBase: Record<string, number> = {
    zero: 0,
    uno: 1,
    una: 1,
    due: 2,
    tre: 3,
    quattro: 4,
    cinque: 5,
    sei: 6,
    sette: 7,
    otto: 8,
    nove: 9,
    dieci: 10,
    undici: 11,
    dodici: 12,
    tredici: 13,
    quattordici: 14,
    quindici: 15,
    sedici: 16,
    diciassette: 17,
    diciotto: 18,
    diciannove: 19,
    venti: 20,
    ventuno: 21,
    ventidue: 22,
    ventitre: 23,
    ventiquattro: 24,
  };

  const ruBase: Record<string, number> = {
    ноль: 0,
    один: 1,
    одна: 1,
    одно: 1,
    два: 2,
    две: 2,
    три: 3,
    четыре: 4,
    пять: 5,
    шесть: 6,
    семь: 7,
    восемь: 8,
    девять: 9,
    десять: 10,
    одиннадцать: 11,
    двенадцать: 12,
    тринадцать: 13,
    четырнадцать: 14,
    пятнадцать: 15,
    шестнадцать: 16,
    семнадцать: 17,
    восемнадцать: 18,
    девятнадцать: 19,
    двадцать: 20,
    "двадцать один": 21,
    "двадцать одна": 21,
    "двадцать два": 22,
    "двадцать две": 22,
    "двадцать три": 23,
    "двадцать четыре": 24,
  };

  if (lang === "en") {
    t = t.replace(
      new RegExp(`\\b(${Object.keys(enTens).join("|")})[-\\s]+(${Object.keys(enBase).join("|")})\\b`, "g"),
      (_m, tensW, baseW) => String(enTens[tensW] + enBase[baseW])
    );
    t = applyStandaloneWordMap(t, enBase);
    t = applyStandaloneWordMap(t, enTens);
  }

  if (lang === "de") {
    t = applyStandaloneWordMap(t, deBase);
    t = applyStandaloneWordMap(t, deTens);
  }

  if (lang === "es") {
    t = applyStandaloneWordMap(t, esBase);
  }

  if (lang === "it") {
    t = applyStandaloneWordMap(t, itBase);
  }

  if (lang === "ru") {
    t = applyStandaloneWordMap(t, ruBase);
  }

  return t;
}

function get24hPatterns(lang: string): RegExp[] {
  const common = [
    /\b24\s*\/\s*7\b/g,
    /\b24\s*h\b/g,
    /\b24h\b/g,
    /\b24\s*(?:hours?|hrs?|stunden|horas|ore|heures)\b/g,
    /\b24-?hour\b/g,
    /\b24\s*\/\s*24\b/g,
  ];

  const en = [
    /\baround the clock\b/g,
    /\bround-?the-?clock\b/g,
    /\ball day and night\b/g,
    /\ball day\b/g,
    /\bat any time\b/g,
    /\banytime\b/g,
    /\btwenty-?four\s*(?:hours?|hrs?)\b/g,
  ];

  const de = [
    /\brund um die uhr\b/g,
    /\bdurchgehend\b/g,
    /\btag und nacht\b/g,
    /\bjederzeit\b/g,
  ];

  const he = [
    /24\s*שעות/g,
    /24\s*שעות\s*ביממה/g,
    /מסביב\s+לשעון/g,
    /בכל\s+עת/g,
    /בכל\s+שעה/g,
    /כל\s+שעות\s+היממה/g,
    /כל\s+היום/g,
    /כל\s+הזמן/g,
  ];

  const es = [
    /\blas\s+24\s+horas\b/g,
    /\b24\s+horas\s+al\s+dia\b/g,
    /\btodo\s+el\s+dia\b/g,
    /\btodo\s+el\s+tiempo\b/g,
    /\bdia\s+y\s+noche\b/g,
    /\ba\s+cualquier\s+hora\b/g,
    /\ben\s+cualquier\s+momento\b/g,
    /\bsiempre\s+disponible\b/g,
    /\bdurante\s+todo\s+el\s+dia\b/g,
  ];

  const it = [
    /\b24\s+ore\s+su\s+24\b/g,
    /\b24\s+ore\b/g,
    /\btutto\s+il\s+giorno\b/g,
    /\bgiorno\s+e\s+notte\b/g,
    /\ba\s+qualsiasi\s+ora\b/g,
    /\bin\s+qualsiasi\s+momento\b/g,
    /\bsempre\s+disponibile\b/g,
    /\bsempre\s+apert[oa]\b/g,
  ];

  const ar = [
    /على\s+مدار\s+الساعة/g,
    /طوال\s+اليوم/g,
    /طيلة\s+اليوم/g,
    /كل\s+اليوم/g,
    /في\s+اي\s+وقت/g,
    /في\s+أي\s+وقت/g,
    /اي\s+وقت/g,
    /أي\s+وقت/g,
    /دائما/g,
    /متاح\s+دائما/g,
    /24\s*ساعة/g,
  ];

  const ru = [
    /круглосуточно/g,
    /круглосуточн(?:ая|ый|ое|ые|ого|ому|ую|ым|ыми)?/g,
    /24\s*часа/g,
    /24\s*часов/g,
    /24\s*часа\s+в\s+сутки/g,
    /в\s+любое\s+время/g,
  ];

  const byLang: Record<string, RegExp[]> = { en, de, he, es, it, ar, ru };
  return [...common, ...(byLang[lang] ?? [])];
}

function inject24hToken(text: string, lang: string): string {
  let t = text;
  for (const pattern of get24hPatterns(lang)) {
    pattern.lastIndex = 0;
    t = t.replace(pattern, " 24h ");
  }
  return t.replace(/\s+/g, " ").trim();
}

export function normalizeQaTextForNumberCompare(text: string, lang: string): string {
  let t = normalizeBase(text);
  if (!t) return "";

  t = t
    .replace(/\bnoon\b/g, "12:00")
    .replace(/\bmidnight\b/g, "00:00");

  if (lang === "de") {
    t = t.replace(/\bmittag\b/g, "12:00").replace(/\bmitternacht\b/g, "00:00");
  }

  if (lang === "es") {
    t = t.replace(/\bmediodia\b/g, "12:00").replace(/\bmedianoche\b/g, "00:00");
  }

  if (lang === "it") {
    t = t.replace(/\bmezzogiorno\b/g, "12:00").replace(/\bmezzanotte\b/g, "00:00");
  }

  if (lang === "ar") {
    t = t.replace(/منتصف\s+النهار/g, "12:00").replace(/منتصف\s+الليل/g, "00:00");
  }

  if (lang === "ru") {
    t = t.replace(/\bполдень\b/g, "12:00").replace(/\bполночь\b/g, "00:00");
  }

  t = convert12hTo24h(t);
  t = inject24hToken(t, lang);
  t = t.replace(/\b(\d{1,3})(?:[.\s,]\d{3})+(?!\d)\b/g, (m) => m.replace(/[.\s,]/g, ""));
  t = t.replace(/\b(\d+),(\d+)\b/g, "$1.$2");
  t = wordsToNumbers(t, lang);

  return t;
}

export function extractQaNumberTokens(text: string, lang: string): string[] {
  const t = normalizeQaTextForNumberCompare(text, lang);
  if (!t) return [];

  const tokens: string[] = [];

  const timeMatches = t.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
  for (const tm of timeMatches) {
    const [hhRaw, mm] = tm.split(":");
    const hh = String(parseInt(hhRaw, 10)).padStart(2, "0");
    tokens.push(`${hh}:${mm}`);
  }

  const tNoTimes = t.replace(/\b\d{1,2}:\d{2}\b/g, " ");
  const has24h = /\b24h\b/.test(t);
  if (has24h) tokens.push("24h");

  const numMatches = tNoTimes.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  for (const nm of numMatches) {
    if (has24h && nm === "24") continue;
    if (has24h && nm === "7" && /\b24\s*\/\s*7\b/.test(normalizeBase(text))) continue;
    tokens.push(nm);
  }

  const seen = new Set<string>();
  return tokens.filter((x) => {
    if (!x) return false;
    if (seen.has(x)) return false;
    seen.add(x);
    return true;
  });
}

export function qaNumberTokensEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  if (aSet.size !== new Set(b).size) return false;
  return b.every((token) => aSet.has(token));
}
