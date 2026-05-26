(() => {
  const languageMap = {
    english: "en",
    hebrew: "he",
    german: "de",
    deutsch: "de",
    french: "fr",
    spanish: "es",
    italian: "it",
    dutch: "nl",
    polish: "pl",
    russian: "ru",
    chinese: "zh",
    arabic: "ar",
    אנגלית: "en",
    עברית: "he",
    גרמנית: "de",
    צרפתית: "fr",
    ספרדית: "es",
    איטלקית: "it",
    הולנדית: "nl",
    פולנית: "pl",
    רוסית: "ru",
    סינית: "zh",
    ערבית: "ar"
  };

  function compact(value) {
    return String(value || "").trim();
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function stripTrailingUrlPunctuation(url) {
    return compact(url).replace(/[),.;\]]+$/g, "");
  }

  function extractUrls(text) {
    return unique((String(text || "").match(/https?:\/\/[^\s"'<>]+/gi) || []).map(stripTrailingUrlPunctuation));
  }

  function extractUrl(text) {
    return extractUrls(text)[0] || "";
  }

  function extractSpreadsheetId(raw) {
    const value = compact(raw);
    return value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ||
      value.match(/^([a-zA-Z0-9-_]{20,})$/)?.[1] ||
      value;
  }

  function extractFolderId(raw) {
    const value = compact(raw);
    return value.match(/\/folders\/([a-zA-Z0-9-_]+)/)?.[1] ||
      value.match(/[?&]id=([a-zA-Z0-9-_]+)/)?.[1] ||
      value.match(/^([a-zA-Z0-9-_]{20,})$/)?.[1] ||
      value;
  }

  function extractFilePath(text) {
    const withoutUrls = String(text || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ");
    const match = withoutUrls.match(/(?:^|[\s`'"])((?:\.\/)?(?:public|src|docs|scripts|content|data|assets|config|tests?|pages|components|lib)\/[^\s"'<>]+|[A-Za-z0-9_.-]+\.(?:md|txt|json|csv|ts|tsx|js|jsx|html|css|scss|yml|yaml))(?:$|[\s`'"])/i);
    return compact(match?.[1] || "").replace(/[),.;\]]+$/g, "");
  }

  function extractOutputCell(text, fallback = "E73") {
    const matches = Array.from(String(text || "").matchAll(/\b(?:[\w -]+!)?[A-Z]{1,3}\d{1,6}\b/gi))
      .map((match) => match[0].trim());
    const cell = matches.find((item) => item.includes("!")) ||
      matches.find((cell) => /^[A-Z]{1,2}\d{1,6}$/i.test(cell)) ||
      fallback;
    const sheetMatch = cell.match(/^(.*)!([A-Z]{1,3}\d{1,6})$/i);
    if (!sheetMatch) return cell.toUpperCase();
    const sheetName = sheetMatch[1]
      .replace(/.*\b(?:output|write|place|put|cell|to|into|in|at)\b\s*/i, "")
      .trim();
    return `${sheetName || "Sheet1"}!${sheetMatch[2].toUpperCase()}`;
  }

  function detectSourceType(value) {
    const text = String(value || "").toLowerCase();
    const clean = compact(value);
    if (text.includes("/drive/folders/")) return "folder";
    if (text.includes("/spreadsheets/") || /^[a-zA-Z0-9_-]{20,}$/.test(clean)) return "sheet";
    if (/^https?:\/\//i.test(clean)) return "website";
    return "manual";
  }

  function sourcePayload(sourceUrl) {
    const type = detectSourceType(sourceUrl);
    if (type === "folder") return { sourceType: "folder", sourceFolderId: sourceUrl, folderId: sourceUrl };
    if (type === "sheet") return { sourceType: "sheet", spreadsheetId: sourceUrl, targetId: sourceUrl };
    return { sourceType: "manual" };
  }

  function detectLanguages(text, fallback = []) {
    const lower = String(text || "").toLowerCase();
    const boundary = "(?:^|\\s|,|;|\\/|:|\\.|!|\\?)";
    const named = Object.entries(languageMap)
      .filter(([name]) => {
        const isHebrewName = /[\u0590-\u05ff]/.test(name);
        const prefix = isHebrewName ? `(?:${boundary}|[בלמו])` : boundary;
        return new RegExp(`${prefix}${name}(?=\\s|,|;|\\/|:|\\.|!|\\?|$)`, "i").test(lower);
      })
      .map(([, code]) => code);
    const explicitCodes = lower.match(/\b(en|he|de|fr|es|it|nl|pl|ru|zh|ar)\b/g) || [];
    return unique([...named, ...explicitCodes]).length ? unique([...named, ...explicitCodes]) : fallback;
  }

  function detectTargetLanguages(text, fallback = []) {
    const value = String(text || "");
    const lower = value.toLowerCase();
    const targetSegment =
      lower.match(/\b(?:to|into)\s+([a-z,\s/;]+?)(?:\s+\b(?:from|in|using|with)\b|$)/i)?.[1] ||
      value.match(/(?:ל|ל-|ל־)(אנגלית|עברית|גרמנית|צרפתית|ספרדית|איטלקית|הולנדית|פולנית|רוסית|סינית|ערבית)(?:\s*(?:ו|,)\s*(אנגלית|עברית|גרמנית|צרפתית|ספרדית|איטלקית|הולנדית|פולנית|רוסית|סינית|ערבית))?/i)?.[0] ||
      "";
    const candidates = targetSegment ? detectLanguages(targetSegment, []) : [];
    if (candidates.length) return candidates;
    if (/\bfrom\s+\w+\s+to\s+\w+/i.test(lower)) {
      const afterTo = lower.split(/\bto\b/i).pop() || "";
      const langs = detectLanguages(afterTo, []);
      if (langs.length) return langs;
    }
    return detectLanguages(value, fallback);
  }

  function cleanSubjectText(value) {
    const cleaned = compact(value)
      .replace(/\bsource\s*:.*/i, "")
      .replace(/\b(?:primary\s+)?source\b.*/i, "")
      .replace(/\b(?:audience|language|style|tone|qa|depth|count|words?\s+to\s+avoid|forbidden\s+phrases?)\s*:.*/i, "")
      .replace(/(?:בלי|לא)\s+להשתמש\s+(?:במילים|בביטויים|במונחים)?.*$/i, "")
      .replace(/(?:מילים|ביטויים)\s+(?:אסורות|שלא להשתמש בהן|להימנע מהן).*$/i, "")
      .replace(/\b(?:do\s+not\s+use|don't\s+use|avoid\s+these)\b.*$/i, "")
      .replace(/\s+\b(?:in|to)\s+(?:english|hebrew|german|french|spanish|italian|dutch|polish|russian|chinese|arabic)\b.*$/i, "")
      .split(/\s+(?:for tourists|for audience|for guests|for customers|for visitors|לקהל|קהל|עבור קהל)(?:\s|$)/i)[0]
      .replace(/^(hotel|property|business|product|service|מלון|עסק|מוצר|שירות)\s+/i, "")
      .replace(/[.!?]+$/g, "")
      .trim();

    if (/^(and\s+)?(?:abroad|israel|international|tourists?|guests?|source)$/i.test(cleaned)) return "";
    return cleaned;
  }

  function splitForbiddenPhrases(value) {
    return String(value || "")
      .replace(/[“”"']/g, "")
      .split(/\n|;|,|،|\s+\+\s+|\s+\|\s+/)
      .map((item) => compact(item))
      .map((item) => item.replace(/^(?:במילים|בביטויים|מילים|ביטויים|words?|phrases?)\s+/i, ""))
      .map((item) => item.replace(/[.!?]+$/g, "").trim())
      .filter((item) => item.length > 1)
      .slice(0, 20);
  }

  function extractForbiddenPhrases(text) {
    const raw = String(text || "");
    const patterns = [
      /(?:בלי|לא)\s+להשתמש\s+(?:במילים|בביטויים|במונחים)?\s*[:：-]?\s*([^.!?\n]+)/i,
      /(?:מילים|ביטויים)\s+(?:אסורות|שלא להשתמש בהן|להימנע מהן)\s*[:：-]?\s*([^.!?\n]+)/i,
      /\b(?:words?\s+to\s+avoid|forbidden\s+phrases?|do\s+not\s+use|don't\s+use|avoid\s+these)\s*[:：-]?\s*([^.!?\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match?.[1]) return splitForbiddenPhrases(match[1]);
    }

    return [];
  }

  function extractSubjects(text) {
    const withoutUrl = String(text || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ");
    const quoted = Array.from(withoutUrl.matchAll(/"([^"]{2,90})"/g)).map((match) => compact(match[1]));
    if (quoted.length) return quoted;

    const patterns = [
      /\b(?:faq|questions|answers)\s+(?:for|about)\s+(.{2,140})/i,
      /\b(?:build|create|prepare|generate|make)\s+(?:an?\s+)?(?:faq|workflow)?\s*(?:for|about)\s+(.{2,140})/i,
      /(?:FAQ|שאלות(?:\s*(?:ו)?תשובות)?|פאק)\s+(?:עבור|על|ל|ל-|ל־)\s+(.{2,140})/i,
      /(?:לבנות|ליצור|להכין|תבנה|תכין|צור)\s+(?:FAQ|שאלות(?:\s*(?:ו)?תשובות)?)?\s*(?:עבור|על|ל|ל-|ל־)\s+(.{2,140})/i,
      /(?:למלון|מלון)\s+(.{2,100})/i
    ];

    for (const pattern of patterns) {
      const match = withoutUrl.match(pattern);
      if (match?.[1]) {
        return match[1]
          .split(/\n|,|;/i)
          .map(cleanSubjectText)
          .filter((item) => item.length > 1)
          .slice(0, 8);
      }
    }

    return [];
  }

  function detectWorkflowType(message) {
    const lower = String(message || "").toLowerCase();
    if (/\b(car|cars|vehicle|vehicles|automotive|auto|trim|trims|hybrid|ev|electric|suv|sedan|engine|lease|leasing)\b/.test(lower) || /רכב|מכונית|דגם|היברידי|חשמלי/.test(message)) return "vehicle";
    if (/\b(service|product|software|platform|saas|app)\b/.test(lower) || /שירות|מוצר|תוכנה|פלטפורמה/.test(message)) return "service";
    if (/\b(local|business|clinic|restaurant|shop|store)\b/.test(lower) || /עסק|מסעדה|חנות|קליניקה|מקומי/.test(message)) return "local";
    return "hotel";
  }

  function splitList(value) {
    if (Array.isArray(value)) return value.map(compact).filter(Boolean);
    return String(value || "").split(/\n|,|;/).map(compact).filter(Boolean);
  }

  function isNone(value) {
    return /^(none|no|skip|default|auto|אין|בלי|דלג|לא)$/i.test(compact(value));
  }

  function parsePreserveTerms(value) {
    if (isNone(value)) return [];
    return splitList(value)
      .map((item) => item.replace(/^[-*]\s*/, "").replace(/^(keep exactly|preserve|שמור בדיוק|לשמור בדיוק)\s*:\s*/i, "").trim())
      .filter(Boolean);
  }

  function parseGlossaryLines(value) {
    if (isNone(value)) return {};
    const out = {};
    splitList(value).forEach((line) => {
      const parts = line.includes("->") ? line.split("->") : line.split("=");
      const source = compact(parts[0]);
      const target = compact(parts.slice(1).join("="));
      if (source && target) out[source] = target;
    });
    return out;
  }

  function parseTerminologyLines(value) {
    if (isNone(value)) return { mappings: [], examples: [] };
    const mappings = [];
    splitList(value).forEach((line) => {
      const [main, reasonRaw = "User-provided terminology rule."] = line.split("|");
      const parts = main.includes("->") ? main.split("->") : main.split("=");
      const forbidden = compact(parts[0]);
      const preferred = compact(parts.slice(1).join("="));
      if (forbidden && preferred) {
        mappings.push({ forbidden, preferred, reason: compact(reasonRaw) || "User-provided terminology rule." });
      }
    });
    return { mappings, examples: [] };
  }

  function byLang(targetLangs, value) {
    const langs = splitList(targetLangs).length ? splitList(targetLangs) : ["de"];
    return Object.fromEntries(langs.map((lang) => [lang, value]));
  }

  function outputStartCell(values) {
    const col = compact(values.outputStartColumn || values.startColumn || "A").toUpperCase() || "A";
    const row = Math.max(1, Number(values.outputStartRow || values.startRow || 1) || 1);
    return `${col}${row}`;
  }

  function siteAuditProfileDefaults(profile) {
    const id = compact(profile || "general-fast") || "general-fast";
    const presets = {
      "general-fast": {
        auditProfile: "general-fast",
        maxPages: 25,
        maxDepth: 2,
        renderMode: "static",
        crawlScope: "site",
        includeAiAnalysis: false
      },
      "full-ai": {
        auditProfile: "full-ai",
        maxPages: 30,
        maxDepth: 2,
        renderMode: "static",
        crawlScope: "site",
        includeAiAnalysis: true
      },
      "faq-schema": {
        auditProfile: "faq-schema",
        maxPages: 50,
        maxDepth: 3,
        renderMode: "static",
        crawlScope: "faq-only",
        includeAiAnalysis: true
      },
      "rendered-deep": {
        auditProfile: "rendered-deep",
        maxPages: 25,
        maxDepth: 2,
        renderMode: "rendered",
        crawlScope: "site",
        includeAiAnalysis: true
      }
    };
    return presets[id] || presets["general-fast"];
  }

  function withoutUrls(value) {
    return String(value || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ");
  }

  function isAnswerResearchIntent(value) {
    if (isRemoveSourcesFromAnswersIntent(value)) return false;
    const text = withoutUrls(value).toLowerCase();
    return /search answers|find answers|complete answers|fill answers|missing answers|verify answers|verified answers|source-backed|source backed|trusted sources|official sources|web search|ai answers|\[verify\]|information is currently not available/.test(text) ||
      /לחפש\s+תשובות|למצוא\s+תשובות|להשלים\s+תשובות|למלא\s+תשובות|תשובות\s+חסרות|תשובות\s+לא\s+זמינות|תשובות\s+מאומתות|מקורות\s+מהימנים|בעזרת\s+מקורות|בינה\s+מלאכותית|חיפוש|בוקינג|מידע\s+לא\s+זמין|לא\s+זמין|אימות|מאומת/.test(value);
  }

  function isRemoveSourcesFromAnswersIntent(value) {
    const text = withoutUrls(value);
    const lower = text.toLowerCase();
    return /(remove|delete|strip|hide|clean).{0,50}(source|sources|reference|references|citation|citations).{0,60}(answer|answers|cell|cells)?/i.test(text) ||
      /(source|sources|reference|references|citation|citations).{0,50}(remove|deleted|stripped|hidden|gone)/i.test(text) ||
      /(להסיר|למחוק|להעלים|להוריד|לנקות).{0,50}(מקורות|מקור|רפרנסים|ציטוטים).{0,80}(תשובות|תאים|עמודה)?/.test(text) ||
      /(מקורות|מקור|רפרנסים|ציטוטים).{0,50}(יעלמו|ייעלמו|לא\s+יופיעו|להעלים|להסיר|למחוק|לנקות)/.test(text) ||
      /(לא|שלא|בלי|ללא).{0,30}(יכיל|יכילו|מכיל|מכילים|יהיו|יופיעו|להכיל)?.{0,40}(קישור|קישורים|לינק|לינקים|links?|urls?).{0,40}(מקורות|מקור|sources?|references?|citations?)/i.test(lower) ||
      /(קישור|קישורים|לינק|לינקים|links?|urls?).{0,40}(מקורות|מקור|sources?|references?|citations?)/i.test(lower) ||
      /(בתשובות|בתאים|answers|cells).{0,60}(בלי|ללא|without).{0,30}(מקורות|sources|references|citations)/i.test(lower);
  }

  function isMissingQuestionIntent(value) {
    const text = withoutUrls(value).toLowerCase();
    return /missing questions|add questions|question gaps|faq gaps|gap fill/.test(text) ||
      /שאלות\s+חסרות|להוסיף\s+שאלות|חוסרות\s+שאלות|פערים/.test(value);
  }

  function isLanguageReviewIntent(value) {
    const text = withoutUrls(value).toLowerCase();
    return /language review|grammar|polish|rewrite|style|tone/.test(text) ||
      /לשפר\s+ניסוח|דקדוק|ללטש|שפה|ניסוח|סגנון/.test(value);
  }

  function isQuestionReviewIntent(value) {
    const text = withoutUrls(value).toLowerCase();
    return /question review|duplicate questions|fix questions|answer fit/.test(text) ||
      /בדיקת\s+שאלות|כפילויות|שאלות\s+לא\s+מתאימות|לתקן\s+שאלות/.test(value);
  }

  function isNameReviewIntent(value) {
    const text = withoutUrls(value).toLowerCase();
    return /name usage|property name|hotel name|brand name/.test(text) ||
      /שם\s+מלון|שם\s+המלון|שם\s+מותג|שימוש\s+בשם/.test(value);
  }

  function isClientCommentIntent(value) {
    const text = withoutUrls(value).toLowerCase();
    return /client comments|client notes|apply comments|notes column/.test(text) ||
      /הערות\s+לקוח|הערות\s+לקוחות|קומנטים|הערות/.test(value);
  }

  function wantsReplaceOriginalAnswer(value) {
    const text = withoutUrls(value).toLowerCase();
    return /replace|overwrite|write back|in place|same column|answer column/.test(text) ||
      /במקום|להחליף|תחליף|אותו\s+מקום|אותה\s+עמודה|לעמודת\s+התשובה|לתוך\s+התשובה/.test(value);
  }

  function normalizeColumn(value) {
    const match = String(value || "").match(/[A-Z]{1,3}/i);
    return match ? match[0].toUpperCase() : "";
  }

  function extractSheetEditColumn(value) {
    const text = withoutUrls(value).replace(/[־–—]/g, "-");
    const patterns = [
      /(?:column|col)\s*([A-Z]{1,3})/i,
      /(?:עמוד(?:ה|ת)|העמוד(?:ה|ת)|בעמוד(?:ה|ת)|לעמוד(?:ה|ת)|מתוך\s+עמוד(?:ה|ת))\s*([A-Z]{1,3})/i,
      /(?:^|[\s,;])(?:ב|ל|מ)[\s-]*([A-Z]{1,3})(?=\b|[\s,;.])/i
    ];
    return normalizeColumn(patterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean));
  }

  function extractColumnTransfer(value, fallbacks = {}) {
    const text = withoutUrls(value).replace(/[־–—]/g, "-");
    const sourcePatterns = [
      /(?:from|source\s+column|copy\s+from|move\s+from)\s+(?:column\s*)?([A-Z]{1,3})/i,
      /(?:^|[\s,;])מ[\s\-]*([A-Z]{1,3})(?=\b|[\s,;.])/i,
      /(?:מעמוד(?:ה|ת)|מהעמוד(?:ה|ת)|מתוך\s+עמוד(?:ה|ת)|מקול(?:ון)?|מהקול(?:ון)?)\s*([A-Z]{1,3})/i,
      /(?:ב|בתוך|בעמוד(?:ה|ת))\s*([A-Z]{1,3})(?=.*(?:לעמוד|לתוך|to|into|להחליף|תחליף))/i
    ];
    const targetPatterns = [
      /(?:to|into|target\s+column|replace\s+(?:column\s*)?)\s+(?:column\s*)?([A-Z]{1,3})/i,
      /(?:^|[\s,;])ל[\s\-]*([A-Z]{1,3})(?=\b|[\s,;.])/i,
      /(?:לעמוד(?:ה|ת)|לתוך\s+עמוד(?:ה|ת)|אל\s+עמוד(?:ה|ת))\s*([A-Z]{1,3})/i,
      /(?:תכניס|להכניס|הכנס|שים|תשים|לשים|תכתוב|כתוב|לכתוב|insert|put|write)\s+(?:את\s+)?(?:זה|אותו|אותה|הערכים|values?)?\s*(?:ב|בתוך|בעמוד(?:ה|ת))\s*([A-Z]{1,3})/i
    ];
    const trimmed = text.trim();
    const bareTargetCorrection =
      trimmed.match(/^(?:עכשיו\s*)?ל[\s-]*([A-Z]{1,3})$/i) ||
      trimmed.match(/^(?:now\s+)?(?:to|into)\s+(?:column\s*)?([A-Z]{1,3})$/i);
    const negatedBareTarget = trimmed.match(/^(?:לא|not|no)\s+([A-Z]{1,3})\s*[,;]\s*([A-Z]{1,3})$/i);
    const explicitSourceColumn = normalizeColumn(sourcePatterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean));
    const explicitTargetColumn = normalizeColumn(
      negatedBareTarget?.[2] ||
      bareTargetCorrection?.[1] ||
      targetPatterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean)
    );
    const sourceColumn = normalizeColumn(explicitSourceColumn || fallbacks.sourceColumn);
    const targetColumn = normalizeColumn(explicitTargetColumn || fallbacks.targetColumn);
    return { sourceColumn, targetColumn, explicitSourceColumn, explicitTargetColumn };
  }

  function isColumnReplaceIntent(value) {
    if (isRemoveSourcesFromAnswersIntent(value)) return false;
    const text = withoutUrls(value).toLowerCase();
    const hebrewAction = /תעביר|להעביר|העבר|תעתיק|להעתיק|העתק|תחליף|להחליף|החלף|תיקח|קח|לקחת|תכניס|להכניס|הכנס|שים|תשים|לשים|תכתוב|כתוב|לכתוב/.test(value);
    const englishAction = /replace|copy|move|transfer|write\s+back|put|insert|take\s+.*\s+from/.test(text);
    const hasColumnSignal = /column|col\b|עמוד(?:ה|ת)|[בלמ][\s־-]*[A-Z]{1,3}\b/i.test(value);
    const correction = /^(?:עכשיו\s*)?ל[\s־-]*[A-Z]{1,3}$/i.test(String(value || "").trim()) ||
      /^(?:now\s+)?(?:to|into)\s+(?:column\s*)?[A-Z]{1,3}$/i.test(String(value || "").trim()) ||
      /^(?:לא|not|no)\s+[A-Z]{1,3}\s*[,;]\s*[A-Z]{1,3}$/i.test(String(value || "").trim());
    return ((hebrewAction || englishAction) && hasColumnSignal) || correction;
  }

  function designFormattingOperation(values) {
    const instruction = [
      values.instruction,
      values.assistantInstruction,
      values.instructions
    ].map((item) => compact(item || "")).filter(Boolean).join("\n");
    const cleanInstruction = compact(withoutUrls(instruction)) || instruction;
    const sourceUrl = compact(values.sourceUrl || "");
    const sourcePolicy = [
      sourceUrl ? `Use this source first: ${sourceUrl}` : "",
      compact(values.sourcePolicy || ""),
      cleanInstruction
    ].filter(Boolean).join("\n");
    const commonFaq = {
      model: values.model || "o3",
      categoryCol: values.categoryCol || "A",
      questionCol: values.questionCol || "B",
      answerCol: values.answerCol || "C",
      commentCol: values.commentCol || "D",
      targetCol: values.targetCol || "F",
      questionFixCol: values.questionFixCol || "G",
      qaNoteCol: values.qaNoteCol || "H",
      hotelNameCol: values.hotelNameCol || "I",
      targetHeader: values.targetHeader || "Agent Final Answer",
      questionFixHeader: values.questionFixHeader || "Question Correction",
      qaNoteHeader: values.qaNoteHeader || "QA Note",
      hotelNameHeader: values.hotelNameHeader || "Hotel Name Status",
      hotelName: values.hotelName || "",
      formatAfterWrite: values.formatAfterWrite !== false
    };

    if (values.operationType === "faq_language_review" || isRemoveSourcesFromAnswersIntent(instruction)) {
      const answerColumn = extractSheetEditColumn(instruction) || normalizeColumn(values.answerCol) || "C";
      return {
        type: "faq_language_review",
        ...commonFaq,
        answerCol: answerColumn,
        targetCol: answerColumn,
        targetHeader: values.targetHeader || "Answer",
        languageDepth: "publication",
        languageTone: "clear_hospitality",
        editorInstruction: values.assistantInstruction || cleanInstruction || "Remove visible source references, URLs, citation labels and source notes from answer text while keeping answers factual and natural."
      };
    }

    if (values.operationType === "replace_column_when_value" || isColumnReplaceIntent(instruction)) {
      const columns = extractColumnTransfer(instruction, {
        sourceColumn: values.sourceColumn || values.targetCol || "F",
        targetColumn: values.targetColumn || values.answerCol || "C"
      });
      return {
        type: "replace_column_when_value",
        sourceColumn: columns.sourceColumn || "F",
        targetColumn: columns.targetColumn || "C",
        startRow: Number(values.startRow) || 2,
        targetHeader: values.targetHeader || "Answer"
      };
    }

    if (isAnswerResearchIntent(instruction)) {
      const replaceOriginal = wantsReplaceOriginalAnswer(instruction);
      return {
        type: "faq_answer_research",
        ...commonFaq,
        targetCol: replaceOriginal ? (values.answerCol || "C") : (values.targetCol || "F"),
        targetHeader: replaceOriginal ? (values.answerHeader || "Answer") : (values.targetHeader || "Agent Researched Answer"),
        useWebSearch: true,
        sourcePolicy: sourcePolicy || "Use trustworthy public sources. If a fact cannot be verified, keep [VERIFY].",
        answerPlaceholder: values.answerPlaceholder || "Information is currently not available. [VERIFY]",
        replaceOriginal
      };
    }

    if (isMissingQuestionIntent(instruction)) {
      return {
        type: "faq_missing_questions",
        ...commonFaq,
        missingRequirements: sourcePolicy || "Find practical missing FAQ questions from the visible sheet patterns."
      };
    }
    if (isLanguageReviewIntent(instruction)) return { type: "faq_language_review", ...commonFaq, languageDepth: "publication", languageTone: "clear_hospitality" };
    if (isQuestionReviewIntent(instruction)) return { type: "faq_question_review", ...commonFaq, detectDuplicates: true };
    if (isNameReviewIntent(instruction)) return { type: "faq_name_injection", ...commonFaq, nameScope: "answers", nameOutputMode: "final_answer" };
    if (isClientCommentIntent(instruction)) return { type: "faq_apply_client_comments", ...commonFaq, commentMode: "rewrite_if_needed" };

    return { type: "format_table", preset: "clean", freezeHeader: true, headerStyle: true, borders: true, wrapText: true, autoResize: true };
  }

  const tools = [
    {
      id: "faq-playground",
      title: "FAQ Workflow Builder",
      group: "FAQ workflows",
      mode: "faq-playground",
      href: "/faq-playground.html",
      icon: "FAQ",
      status: "adapter-active",
      risk: "generates-content",
      canRunDirectly: true,
      description: "Build FAQ question plans, answers and QA workflows with category-aware prompts.",
      intentHints: ["faq", "faq builder", "questions", "answers", "hotel faq", "שאלות", "שאלות ותשובות", "מלון", "אורחים"],
      requiredInputs: [
        { key: "subjects", label: "Subjects", question: "What is the exact hotel, page, product, service or model name?", type: "textarea" },
        { key: "workflowType", label: "FAQ type", question: "What type of FAQ is this?", type: "select", options: ["hotel", "local", "service", "vehicle"] },
        { key: "audience", label: "Audience", question: "Who is this FAQ for?", type: "text" }
      ],
      optionalInputs: [
        { key: "sourceUrl", label: "Primary source URL", type: "url" },
        { key: "language", label: "Output language", type: "text", defaultValue: "English (UK)" },
        { key: "count", label: "Question depth", type: "text", defaultValue: "20-30" },
        { key: "forbiddenPhrases", label: "Words to avoid", type: "textarea" },
        { key: "qaMode", label: "QA checks", type: "text", defaultValue: "duplicates|writing" },
        { key: "style", label: "Answer style", type: "text", defaultValue: "Warm, concise, reliable." }
      ],
      quickReplies: [
        { label: "Hotel / hospitality", value: "scope:hotel" },
        { label: "Local business", value: "scope:local" },
        { label: "Product / service", value: "scope:service" },
        { label: "Vehicle model", value: "scope:vehicle" }
      ],
      confirmationRules: {
        beforeRun: "Confirm before creating Google Sheets or spending AI calls.",
        beforeOpen: "Opening the builder is safe and browser-local."
      },
      infer(message) {
        return {
          subjects: extractSubjects(message).join("\n"),
          workflowType: detectWorkflowType(message),
          sourceUrl: extractUrl(message),
          language: detectLanguages(message, [])[0] || "",
          forbiddenPhrases: extractForbiddenPhrases(message).join("\n"),
          audience: ""
        };
      },
      payloadBuilder(values) {
        return {
          mode: "assistant-draft",
          assistantAction: "open-faq-builder",
          subjects: splitList(values.subjects),
          workflowType: values.workflowType || "hotel",
          audience: values.audience || "",
          forbiddenPhrases: values.forbiddenPhrases || "",
          sourceUrl: values.sourceUrl || ""
        };
      }
    },
    {
      id: "translate-demo",
      title: "AI Translation Engine",
      group: "FAQ workflows",
      mode: "translate-demo",
      href: "/translate-demo.html",
      icon: "TR",
      status: "adapter-ready",
      risk: "writes-to-sheet",
      canRunDirectly: true,
      description: "Translate a Google Sheet or Drive folder with glossary, terminology and polish steps.",
      intentHints: ["translate", "translation", "localize", "localise", "language", "תרגום", "תרגם", "תרגמי", "תרגמו", "לתרגם"],
      requiredInputs: [
        { key: "sourceUrl", label: "Google Sheet or Drive folder", question: "Send the Google Sheet or Drive folder URL / ID to translate.", type: "url" },
        { key: "targetLangs", label: "Target languages", question: "Which target languages should be created?", type: "tags" }
      ],
      optionalInputs: [
        {
          key: "sourceTab",
          label: "Source tab",
          question: "Which tab should be read? Choose Auto-detect if you are not sure.",
          type: "text",
          quickReplies: [{ label: "Auto-detect", value: "toolfield:sourceTab:__auto__" }]
        },
        {
          key: "splitIntoTwo",
          label: "Split calls",
          question: "Should I split the sheet into two translation parts for safer large-sheet runs?",
          type: "boolean",
          quickReplies: [
            { label: "Yes, split into 2", value: "toolfield:splitIntoTwo:true" },
            { label: "No, one pass", value: "toolfield:splitIntoTwo:false" }
          ]
        },
        {
          key: "preserveTerms",
          label: "Keep exactly",
          question: "Any names, phrases, URLs, product names or tokens that must stay exactly as written? Send a list, or choose None.",
          type: "textarea",
          quickReplies: [{ label: "No special phrases", value: "toolfield:preserveTerms:none" }]
        },
        {
          key: "glossaryLines",
          label: "Exact translations",
          question: "Any exact translation pairs? Use source = translation. If there are none, choose Skip.",
          type: "textarea",
          quickReplies: [{ label: "Skip glossary", value: "toolfield:glossaryLines:none" }]
        },
        {
          key: "terminologyLines",
          label: "Avoid wording",
          question: "Any wording to avoid and what to use instead? Use avoid = use instead | reason. If none, choose Skip.",
          type: "textarea",
          quickReplies: [{ label: "Skip terminology", value: "toolfield:terminologyLines:none" }]
        },
        {
          key: "languageNotes",
          label: "Tone notes",
          question: "How should the final translation sound? For example: natural spoken German, formal hotel language, preserve FAQ style.",
          type: "textarea",
          defaultValue: "Natural native wording, clear FAQ style, faithful to the source.",
          quickReplies: [
            { label: "Natural, native, FAQ tone", value: "toolfield:languageNotes:Natural native wording, clear FAQ style, faithful to the source." },
            { label: "Formal hotel tone", value: "toolfield:languageNotes:Formal, polished hospitality wording. Keep facts exact and avoid over-promising." }
          ]
        },
        { key: "model", label: "Model", type: "select", defaultValue: "o3", options: ["o3", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"] },
        { key: "instructions", label: "Translation instructions", type: "textarea" }
      ],
      quickReplies: [
        { label: "German", value: "lang:de" },
        { label: "French", value: "lang:fr" },
        { label: "Spanish", value: "lang:es" },
        { label: "Hebrew", value: "lang:he" }
      ],
      confirmationRules: {
        beforeRun: "Confirm because translation writes tabs back to Google Sheets and spends AI calls.",
        preferWorkspace: "Use the workspace for glossary or terminology editing."
      },
      infer(message) {
        return {
          sourceUrl: extractUrl(message),
          targetLangs: detectTargetLanguages(message, []),
          model: "o3",
          sourceTab: "",
          splitIntoTwo: undefined,
          preserveTerms: "",
          glossaryLines: "",
          terminologyLines: "",
          languageNotes: "",
          instructions: ""
        };
      },
      payloadBuilder(values) {
        const sourceType = detectSourceType(values.sourceUrl) === "folder" ? "folder" : "sheet";
        const targetLangs = splitList(values.targetLangs);
        const instructions = [
          compact(values.instructions),
          compact(values.languageNotes),
          parsePreserveTerms(values.preserveTerms).length
            ? `Keep these terms exactly as written unless a glossary rule says otherwise: ${parsePreserveTerms(values.preserveTerms).join(", ")}.`
            : ""
        ].filter(Boolean).join("\n");
        const exactGlossary = parseGlossaryLines(values.glossaryLines);
        const preserveGlossary = Object.fromEntries(parsePreserveTerms(values.preserveTerms).map((term) => [term, term]));
        const glossary = { ...preserveGlossary, ...exactGlossary };
        const terminology = parseTerminologyLines(values.terminologyLines);
        return {
          mode: "translate-demo",
          sourceType,
          spreadsheetId: sourceType === "sheet" ? extractSpreadsheetId(values.sourceUrl) : "",
          sourceFolderId: sourceType === "folder" ? extractFolderId(values.sourceUrl) : "",
          sourceTab: values.sourceTab === "__auto__" ? "" : (values.sourceTab || ""),
          model: values.model || "o3",
          targetLangs,
          translateHeader: true,
          splitIntoTwo: values.splitIntoTwo !== false && values.splitIntoTwo !== "false",
          prompts: {},
          languageNotes: instructions ? byLang(targetLangs, instructions) : {},
          glossaryByLang: Object.keys(glossary).length ? byLang(targetLangs, glossary) : {},
          terminologyByLang: terminology.mappings.length ? byLang(targetLangs, terminology) : {}
        };
      }
    },
    {
      id: "schema-builder",
      title: "Schema Builder",
      group: "FAQ workflows",
      mode: "schema-builder",
      href: "/schema-builder.html",
      icon: "{}",
      status: "adapter-ready",
      risk: "writes-to-sheet",
      canRunDirectly: true,
      description: "Generate FAQPage JSON-LD from a Sheet or Drive folder.",
      intentHints: ["schema", "json-ld", "faqpage", "rich results", "סכמה", "סכימה"],
      requiredInputs: [
        { key: "sourceUrl", label: "Google Sheet or Drive folder", question: "Send the Google Sheet or Drive folder that contains the FAQ rows.", type: "url" }
      ],
      optionalInputs: [
        { key: "tabName", label: "FAQ tab", type: "text", defaultValue: "Sheet1" },
        { key: "questionColumn", label: "Question column", type: "text", defaultValue: "B" },
        { key: "answerColumn", label: "Answer column", type: "text", defaultValue: "C" },
        { key: "outputCell", label: "Output cell", type: "text", defaultValue: "E73" },
        { key: "previewOnly", label: "Preview only", type: "checkbox", defaultValue: true }
      ],
      quickReplies: [
        { label: "Preview only", value: "schema:preview" },
        { label: "Write to Sheet", value: "schema:write" },
        { label: "Change output cell", value: "schema:output" },
        { label: "Columns B / C", value: "schema:columns:B:C" }
      ],
      confirmationRules: {
        beforeRun: "Preview is safe. Writing schema to a Sheet requires confirmation."
      },
      infer(message) {
        return {
          sourceUrl: extractUrl(message),
          tabName: "",
          questionColumn: "B",
          answerColumn: "C",
          outputCell: extractOutputCell(message),
          previewOnly: !/\b(write|inject|save|to sheet)\b|לכתוב|להכניס|לשמור/.test(String(message || "").toLowerCase())
        };
      },
      payloadBuilder(values) {
        const sourceType = detectSourceType(values.sourceUrl) === "folder" ? "folder" : "sheet";
        const previewOnly = values.previewOnly !== false;
        return {
          mode: "schema-builder",
          sourceType,
          targetId: values.sourceUrl,
          tabName: values.tabName || "Sheet1",
          recursive: true,
          maxFiles: Number(values.maxFiles) || 30,
          schemaType: "FAQPage",
          questionColumn: values.questionColumn || "B",
          answerColumn: values.answerColumn || "C",
          startRow: Number(values.startRow) || 2,
          maxRows: Number(values.maxRows) || 500,
          outputCell: values.outputCell || "E73",
          includeScriptTag: true,
          previewOnly,
          dryRun: previewOnly
        };
      }
    },
    {
      id: "meta-tags",
      title: "Meta Tags Studio",
      group: "SEO tools",
      mode: "meta-tags",
      href: "/meta-tags.html",
      icon: "SEO",
      status: "adapter-ready",
      risk: "writes-to-sheet",
      canRunDirectly: true,
      description: "Create meta titles, descriptions, H1 and Open Graph rows from templates or AI assistance.",
      intentHints: ["meta", "title tag", "description", "h1", "seo tags", "תגיות", "מטא", "טייטלים"],
      requiredInputs: [
        { key: "pageList", label: "Pages or source", question: "Which pages, domain, Google Sheet, or Drive folder should get metadata?", type: "textarea" }
      ],
      optionalInputs: [
        { key: "sourceUrl", label: "Source URL", type: "url" },
        { key: "generationMode", label: "Generation mode", type: "select", defaultValue: "template", options: ["template", "ai"] },
        { key: "languages", label: "Languages", type: "tags", defaultValue: ["en"] },
        { key: "domain", label: "Domain", type: "text", defaultValue: "example.com" },
        { key: "outputMode", label: "Output mode", type: "select", defaultValue: "preview", options: ["preview", "newTab", "firstTabRange", "existingRange"] },
        { key: "outputTabName", label: "Output tab", type: "text", defaultValue: "Meta Tags" }
      ],
      quickReplies: [
        { label: "Template", value: "meta:template" },
        { label: "AI mode", value: "meta:ai" },
        { label: "Preview only", value: "meta:preview" }
      ],
      confirmationRules: {
        beforeRun: "Preview is safe. Writing metadata back to Sheets requires confirmation."
      },
      infer(message) {
        const url = extractUrl(message);
        const sourceType = detectSourceType(url);
        const domain = sourceType === "website" ? url.replace(/^https?:\/\//i, "").split("/")[0] : "";
        return {
          sourceUrl: sourceType === "sheet" || sourceType === "folder" ? url : "",
          pageList: sourceType === "website"
            ? url
            : sourceType === "sheet"
              ? "Use the spreadsheet file name as the page topic."
              : sourceType === "folder"
                ? "Use spreadsheet file names in the Drive folder as page topics."
                : "",
          domain: domain || "example.com",
          generationMode: /\bai\b|בינה|איי/.test(String(message || "").toLowerCase()) ? "ai" : "template",
          languages: detectLanguages(message, ["en"]),
          outputMode: /\b(write|sheet|tab)\b|לכתוב|גיליון|טאב/.test(String(message || "").toLowerCase()) ? "newTab" : "preview",
          outputTabName: "Meta Tags"
        };
      },
      payloadBuilder(values) {
        const sourceUrl = values.sourceUrl || "";
        const detected = detectSourceType(sourceUrl);
        const sourceType = detected === "folder" || detected === "sheet" ? detected : "manual";
        return {
          mode: "meta-tags",
          generationMode: values.generationMode || "template",
          sourceType,
          brandName: values.brandName || "",
          domain: values.domain || "example.com",
          pageList: values.pageList || "Homepage",
          spreadsheetId: sourceType === "sheet" ? sourceUrl : "",
          folderId: sourceType === "folder" ? sourceUrl : "",
          folderRecursive: false,
          folderMaxFiles: Number(values.folderMaxFiles) || 50,
          language: splitList(values.languages)[0] || "en",
          languages: splitList(values.languages).length ? splitList(values.languages) : ["en"],
          pageType: "general",
          intent: "search",
          titleMax: Number(values.titleMax) || 60,
          descMax: Number(values.descMax) || 155,
          variantCount: values.generationMode === "ai" ? Number(values.variantCount) || 1 : 1,
          titleTemplate: values.titleTemplate || "{{page}} | FAQ",
          descTemplate: values.descTemplate || "Explore {{page}}.",
          voice: values.voice || "clear",
          primaryKeyword: values.primaryKeyword || "",
          aiBrief: values.aiBrief || "",
          outputMode: values.outputMode || "preview",
          outputTabName: values.outputTabName || "Meta Tags",
          outputStartCell: outputStartCell(values),
          activeRules: Array.isArray(values.activeRules) ? values.activeRules : ["brandInTitle", "includeH1", "openGraph"]
        };
      }
    },
    {
      id: "site-ai-audit",
      title: "AI Site Audit Crawler",
      group: "Audits",
      mode: "site-ai-audit",
      href: "/site-ai-audit.html",
      icon: "AI",
      status: "adapter-ready",
      risk: "read-and-ai-cost",
      canRunDirectly: true,
      description: "Crawl a site and audit AI/search readiness, schema, meta, links and page quality.",
      intentHints: ["site audit", "crawler", "crawl", "ai audit", "audit site", "audit website", "אודיט", "אודיט אתר", "בדיקת אתר", "בדיקה לאתר", "לבדוק אתר", "סריקה"],
      requiredInputs: [
        { key: "siteUrl", label: "Website URL", question: "Which website should I audit?", type: "url" },
        {
          key: "auditProfile",
          label: "Audit type",
          question: "What kind of site audit should I run?",
          type: "select",
          quickReplies: [
            { label: "Fast general audit", value: "auditprofile:general-fast" },
            { label: "Full + AI summary", value: "auditprofile:full-ai" },
            { label: "FAQ/schema focus", value: "auditprofile:faq-schema" },
            { label: "Rendered JS deep audit", value: "auditprofile:rendered-deep" }
          ]
        },
        {
          key: "auditFocus",
          label: "Checks",
          question: "What should this audit focus on?",
          type: "select",
          quickReplies: [
            { label: "Full AI/search audit", value: "toolfield:auditFocus:full" },
            { label: "FAQ + schema", value: "toolfield:auditFocus:faq-schema" },
            { label: "Technical SEO + metadata", value: "toolfield:auditFocus:technical-meta" },
            { label: "AI answerability", value: "toolfield:auditFocus:answerability" },
            { label: "Links + trust signals", value: "toolfield:auditFocus:links-trust" }
          ]
        },
        {
          key: "maxPages",
          label: "Page budget",
          question: "How many pages should the crawler inspect deeply?",
          type: "number",
          quickReplies: [
            { label: "Quick · 15 pages", value: "toolfield:maxPages:15" },
            { label: "Standard · 25 pages", value: "toolfield:maxPages:25" },
            { label: "Deep · 50 pages", value: "toolfield:maxPages:50" },
            { label: "Very deep · 100 pages", value: "toolfield:maxPages:100" }
          ]
        }
      ],
      optionalInputs: [
        { key: "maxDepth", label: "Crawl depth", type: "number" },
        { key: "renderMode", label: "Reading mode", type: "select" },
        { key: "crawlScope", label: "Scope", type: "select" },
        { key: "includeAiAnalysis", label: "AI analysis", type: "checkbox" },
        { key: "acceptLanguage", label: "Site language", type: "select", defaultValue: "en-GB,en;q=0.9" },
        { key: "respectRobots", label: "Respect robots.txt", type: "checkbox", defaultValue: false }
      ],
      quickReplies: [
        { label: "Fast general audit", value: "auditprofile:general-fast" },
        { label: "FAQ/schema focus", value: "auditprofile:faq-schema" },
        { label: "Rendered JS deep audit", value: "auditprofile:rendered-deep" },
        { label: "No AI analysis", value: "audit:no-ai" }
      ],
      confirmationRules: {
        beforeRun: "Confirm before crawling a site and spending AI analysis calls."
      },
      infer(message) {
        const text = String(message || "");
        const profile = /faq|schema|סכמה|שאלות/i.test(text)
          ? "faq-schema"
          : (/render|playwright|javascript|js|דפדפן|מרונדר/i.test(text)
            ? "rendered-deep"
            : (/ai summary|ai analysis|ניתוח ai|סיכום ai/i.test(text)
              ? "full-ai"
              : (/fast|quick|מהיר|זריז/i.test(text) ? "general-fast" : "")));
        const defaults = profile ? siteAuditProfileDefaults(profile) : {};
        const explicitPages = Number(text.match(/\b(\d{1,3})\s+(?:pages?|עמודים?)\b/i)?.[1]) || "";
        const focus = /faq|schema|סכמה|שאלות/i.test(text)
          ? "faq-schema"
          : (/meta|metadata|technical|seo|מטא|טכני/i.test(text)
            ? "technical-meta"
            : (/links?|trust|domains?|קישורים|אמון/i.test(text)
              ? "links-trust"
              : (/answerability|answers?|ai readiness|תשובות|מענה/i.test(text) ? "answerability" : "")));
        return {
          siteUrl: extractUrl(message),
          ...defaults,
          suggestedMaxPages: defaults.maxPages || "",
          maxPages: explicitPages,
          auditFocus: focus || (profile ? "full" : ""),
          includeAiAnalysis: /without ai|no ai|בלי ai|ללא ai/i.test(text) ? false : defaults.includeAiAnalysis
        };
      },
      payloadBuilder(values) {
        const profileDefaults = siteAuditProfileDefaults(values.auditProfile);
        const merged = { ...profileDefaults, ...values };
        const focus = String(merged.auditFocus || "full");
        const focusDefaults = {
          full: { includeSitemap: true, includeLlmsTxt: true, includeFaqAudit: true, includeStructuredData: true, includeAnswerability: true, includeMetaAudit: true, includeLinkAudit: true },
          "faq-schema": { includeSitemap: true, includeLlmsTxt: true, includeFaqAudit: true, includeStructuredData: true, includeAnswerability: true, includeMetaAudit: false, includeLinkAudit: false },
          "technical-meta": { includeSitemap: true, includeLlmsTxt: false, includeFaqAudit: false, includeStructuredData: true, includeAnswerability: false, includeMetaAudit: true, includeLinkAudit: true },
          answerability: { includeSitemap: true, includeLlmsTxt: true, includeFaqAudit: true, includeStructuredData: true, includeAnswerability: true, includeMetaAudit: true, includeLinkAudit: false },
          "links-trust": { includeSitemap: true, includeLlmsTxt: false, includeFaqAudit: false, includeStructuredData: false, includeAnswerability: false, includeMetaAudit: true, includeLinkAudit: true }
        }[focus] || {};
        const customFocus = focus === "custom";
        const checkValue = (key) => merged[key] ?? focusDefaults[key] ?? !customFocus;
        return {
          mode: "site-ai-audit",
          startUrl: merged.siteUrl,
          auditProfile: merged.auditProfile || "general-fast",
          maxPages: Number(merged.maxPages) || profileDefaults.maxPages,
          maxDepth: Number(merged.maxDepth) || profileDefaults.maxDepth,
          renderMode: merged.renderMode || profileDefaults.renderMode,
          crawlScope: merged.crawlScope || profileDefaults.crawlScope,
          auditFocus: focus,
          includeSitemap: checkValue("includeSitemap"),
          includeLlmsTxt: checkValue("includeLlmsTxt"),
          includeFaqAudit: checkValue("includeFaqAudit"),
          includeStructuredData: checkValue("includeStructuredData"),
          includeAnswerability: checkValue("includeAnswerability"),
          includeMetaAudit: checkValue("includeMetaAudit"),
          includeLinkAudit: checkValue("includeLinkAudit"),
          includeAiAnalysis: merged.includeAiAnalysis === undefined ? profileDefaults.includeAiAnalysis : merged.includeAiAnalysis !== false,
          sameHostOnly: true,
          respectRobots: merged.respectRobots === true,
          acceptLanguage: merged.acceptLanguage || "en-GB,en;q=0.9"
        };
      }
    },
    {
      id: "site-ai-faq-audit",
      title: "AI FAQ Audit",
      group: "Audits",
      mode: "site-ai-faq-audit",
      href: "/site-ai-faq-audit.html",
      icon: "QA",
      status: "adapter-ready",
      risk: "creates-report-sheet",
      canRunDirectly: true,
      description: "Audit visible FAQ, FAQPage schema and source-file implementation.",
      intentHints: ["faq audit", "audit faq", "faq schema audit", "בדיקת faq", "בדיקת שאלות"],
      requiredInputs: [
        { key: "siteUrl", label: "Website URL", question: "Which website should I audit for FAQ and schema?", type: "url" }
      ],
      optionalInputs: [
        { key: "sourceInput", label: "Source Sheet or folder", type: "url" },
        { key: "groups", label: "Mapped groups", type: "multi-select" },
        { key: "maxPages", label: "Max pages", type: "number", defaultValue: 50 },
        { key: "renderMode", label: "Render mode", type: "select", defaultValue: "rendered" }
      ],
      quickReplies: [
        { label: "Static crawl", value: "faqaudit:static" },
        { label: "Rendered crawl", value: "faqaudit:rendered" },
        { label: "Compare source Sheet", value: "faqaudit:source" }
      ],
      confirmationRules: {
        beforeRun: "Confirm before crawling and creating the FAQ audit report Sheet."
      },
      infer(message) {
        const urls = extractUrls(message);
        return {
          siteUrl: urls.find((url) => detectSourceType(url) === "website") || urls[0] || "",
          sourceInput: urls.find((url) => detectSourceType(url) === "sheet" || detectSourceType(url) === "folder") || "",
          maxPages: 50,
          renderMode: /static|html only|סטטית|סטטי/i.test(String(message || "")) ? "static" : "rendered"
        };
      },
      payloadBuilder(values) {
        return {
          mode: "site-ai-faq-audit",
          startUrl: values.siteUrl,
          urls: Array.isArray(values.urls) && values.urls.length ? values.urls : undefined,
          groups: Array.isArray(values.groups) && values.groups.length ? values.groups : undefined,
          urlIncludes: Array.isArray(values.urlIncludes) && values.urlIncludes.length ? values.urlIncludes : undefined,
          maxPages: Number(values.maxPages) || 50,
          maxDiscoveryUrls: Number(values.maxDiscoveryUrls) || 1000,
          maxDepth: Number(values.maxDepth) || 3,
          maxFaqCandidateChecks: Number(values.maxFaqCandidateChecks) || 120,
          faqCandidateConcurrency: 12,
          fetchTimeoutMs: 5000,
          renderMode: values.renderMode || "rendered",
          sourceCompareEnabled: Boolean(values.sourceInput),
          sourceInput: values.sourceInput || "",
          sourceTabName: values.sourceTabName || "",
          sourceHeaderRow: Number(values.sourceHeaderRow) || 0
        };
      }
    },
    {
      id: "design-formatting",
      title: "FAQ Editing Workspace",
      group: "FAQ workflows",
      mode: "design-formatting",
      href: "/design-formatting.html",
      icon: "EDIT",
      status: "workspace-first",
      risk: "writes-to-sheet",
      canRunDirectly: true,
      description: "Format and edit FAQ sheets, apply notes, research missing answers, replace columns and preview sheet data.",
      intentHints: [
        "format", "formatting", "edit sheet", "sheet edit", "client notes", "AI edit", "AI answers",
        "search answers", "find answers", "complete answers", "fill answers", "missing answers",
        "source-backed answers", "verify answers", "web search answers", "replace column", "copy column",
        "עיצוב", "עריכת גיליון", "עריכת גוגל", "הערות לקוח", "לחפש תשובות", "למצוא תשובות",
        "להשלים תשובות", "למלא תשובות", "תשובות חסרות", "להעביר עמודה", "להחליף עמודה", "להכניס לעמודה", "מקורות", "מקור", "בינה מלאכותית"
      ],
      requiredInputs: [
        { key: "targetUrl", label: "Google Sheet", question: "Which Google Sheet should be edited?", type: "url" },
        { key: "instruction", label: "Edit instruction", question: "What should change in the Sheet?", type: "textarea" }
      ],
      optionalInputs: [
        { key: "tabName", label: "Tab", type: "text", defaultValue: "Sheet1" },
        { key: "dryRun", label: "Dry run", type: "checkbox", defaultValue: true },
        { key: "sourceUrl", label: "Research source URL", type: "url" },
        { key: "model", label: "AI model", type: "select", defaultValue: "o3" }
      ],
      quickReplies: [
        { label: "Run dry run here", value: "format:dry-run" },
        { label: "Preview mode", value: "format:preview" },
        { label: "Open editor", value: "open-tool" }
      ],
      confirmationRules: {
        beforeRun: "Direct dry-run is allowed from chat. Live AI/web-search writes require explicit confirmation."
      },
      infer(message) {
        const urls = extractUrls(message);
        const targetUrl = urls.find((url) => {
          const type = detectSourceType(url);
          return type === "sheet" || type === "folder";
        }) || "";
        const sourceUrl = urls.find((url) => detectSourceType(url) === "website") || "";
        const textWithoutUrls = withoutUrls(message);
        const transfer = extractColumnTransfer(message);
        const hasConcreteEdit = /לערוך|ערוך|עריכה|עריכות|לעריכה|לתקן|שנה|לעדכן|הערות|להשלים|למלא|לרוקן|להכניס|תכניס|הכנס|להוסיף|להעביר|תעביר|העבר|להעתיק|תעתיק|העתק|להחליף|תחליף|החלף|לקחת|תיקח|קח|לשים|תשים|שים|לכתוב|תכתוב|כתוב|לחפש|למצוא|מקורות|תשובות|edit|change|update|fix|format|clean|search|find|complete|fill|source|replace|copy|move|transfer|put|insert/i.test(textWithoutUrls);
        return {
          targetUrl,
          sourceUrl,
          instruction: hasConcreteEdit ? compact(message) : "",
          tabName: "",
          dryRun: true,
          model: "o3",
          operationType: isColumnReplaceIntent(message) ? "replace_column_when_value" : "",
          sourceColumn: transfer.sourceColumn,
          targetColumn: transfer.targetColumn
        };
      },
      payloadBuilder(values) {
        const operation = designFormattingOperation(values);
        const operations = [operation];
        const targetSourceType = detectSourceType(values.targetUrl) === "folder" ? "folder" : "sheet";
        return {
          mode: "design-formatting",
          sourceType: targetSourceType,
          targetId: values.targetUrl,
          tabName: values.tabName || "Sheet1",
          dryRun: values.dryRun !== false,
          createBackup: false,
          range: { columnScope: "sheet", rowScope: "all" },
          operation,
          operations,
          assistantInstruction: values.instruction || "",
          assistantSourceUrl: values.sourceUrl || "",
          selectedOperation: operation.type
        };
      }
    },
    {
      id: "client-reports",
      title: "Client Reports Dashboard",
      group: "Reports",
      mode: "client-reports",
      href: "/client-reports.html",
      icon: "REP",
      status: "workspace-ready",
      risk: "reads-analytics-or-sheet-and-creates-report",
      canRunDirectly: false,
      description: "Build polished client performance dashboards from Google Analytics or a Google Sheet, with KPI cards, charts, tables and summary sections.",
      intentHints: ["client report", "client reports", "dashboard", "performance report", "monthly report", "kpi report", "analytics report", "ga4 report", "google analytics", "דוח לקוח", "דוחות לקוח", "דשבורד", "ביצועים", "אנליטיקס", "גוגל אנליטיקס"],
      requiredInputs: [],
      optionalInputs: [
        { key: "sourceType", label: "Data source", type: "select", defaultValue: "analytics" },
        { key: "analyticsAccount", label: "Analytics account", type: "select", defaultValue: "default-ga4" },
        { key: "spreadsheetId", label: "Google Sheet", question: "Which Google Sheet should the client report use?", type: "url" },
        { key: "sourceTab", label: "Source tab", type: "text" },
        { key: "reportType", label: "Report type", type: "select", defaultValue: "seo-traffic-report" },
        { key: "datePreset", label: "Date range", type: "select", defaultValue: "all" },
        { key: "primaryMetric", label: "Primary metric", type: "text", defaultValue: "sessions" },
        { key: "breakdown", label: "Breakdown", type: "text", defaultValue: "channel" },
        { key: "includeAiSummary", label: "AI summary", type: "checkbox", defaultValue: true }
      ],
      quickReplies: [
        { label: "Analytics report", value: "toolfield:sourceType:analytics" },
        { label: "Google Sheet report", value: "toolfield:sourceType:sheet" },
        { label: "Campaign overview", value: "toolfield:reportType:campaign-performance-overview" },
        { label: "Monthly client report", value: "toolfield:reportType:monthly-client-report" },
        { label: "SEO traffic", value: "toolfield:reportType:seo-traffic-report" },
        { label: "Open dashboard workspace", value: "open-tool" }
      ],
      confirmationRules: {
        beforeRun: "Use the dashboard workspace to review chart and table settings before generating a client report."
      },
      infer(message) {
        const text = String(message || "").toLowerCase();
        const sheetUrl = extractUrls(message).find((url) => detectSourceType(url) === "sheet") || "";
        const sourceType = sheetUrl || /sheet|spreadsheet|גיליון|שיט/i.test(text)
          ? "sheet"
          : "analytics";
        const defaultReportType = sourceType === "analytics" ? "seo-traffic-report" : "campaign-performance-overview";
        return {
          sourceType,
          analyticsAccount: "default-ga4",
          spreadsheetId: sheetUrl || (sourceType === "sheet" ? extractUrl(message) : ""),
          reportType: /seo/.test(text)
            ? "seo-traffic-report"
            : (/monthly|חודשי/.test(text)
              ? "monthly-client-report"
              : (/leads?|conversions?|לידים|המרות/.test(text)
                ? "leads-conversions-report"
                : defaultReportType)),
          datePreset: /7/.test(text) ? "last-7" : (/30/.test(text) ? "last-30" : "all"),
          primaryMetric: sourceType === "analytics" ? "sessions" : "conversions",
          breakdown: sourceType === "analytics" ? "channel" : "campaign",
          includeAiSummary: /\bai\b|summary|סיכום/i.test(text) || sourceType === "analytics"
        };
      },
      payloadBuilder(values) {
        const sourceType = values.sourceType === "sheet" || values.spreadsheetId ? "sheet" : "analytics";
        const isAnalytics = sourceType === "analytics";
        return {
          mode: "client-reports",
          sourceType,
          spreadsheetId: isAnalytics ? "" : (values.spreadsheetId || ""),
          sourceTab: isAnalytics ? "" : (values.sourceTab || ""),
          analytics: isAnalytics ? {
            accountId: values.analyticsAccount || "default-ga4",
            accountName: "Connected GA4 account",
            propertyId: ""
          } : undefined,
          reportType: values.reportType || (isAnalytics ? "seo-traffic-report" : "campaign-performance-overview"),
          datePreset: values.datePreset || "all",
          primaryMetric: values.primaryMetric || (isAnalytics ? "sessions" : "conversions"),
          breakdown: values.breakdown || (isAnalytics ? "channel" : "campaign"),
          columnMapping: {},
          options: {
            dryRun: true,
            exportToSheet: false,
            includeAiSummary: values.includeAiSummary !== false,
            includeRecommendations: true
          }
        };
      }
    },
    {
      id: "sheet-utilities",
      title: "Sheet Utilities",
      group: "Sheet operations",
      mode: "sheet-utilities",
      href: "/sheet-utilities.html",
      icon: "UTIL",
      status: "workspace-ready",
      risk: "writes-to-sheet",
      canRunDirectly: false,
      description: "Run cross-file Sheet operations such as lookup copy, folder-to-master injection, cross-checks, coverage reports, column copy and work-file builds.",
      intentHints: ["sheet utilities", "vlookup", "lookup copy", "cross check", "coverage report", "copy columns", "folder to master", "work file", "כלי גיליון", "הצלבה", "כיסוי", "להעתיק עמודות"],
      requiredInputs: [
        { key: "instruction", label: "Sheet utility request", question: "What Sheet utility operation should I prepare?", type: "textarea" }
      ],
      optionalInputs: [
        { key: "operationType", label: "Operation type", type: "select" },
        { key: "sourceUrl", label: "Source Sheet or folder", type: "url" },
        { key: "targetUrl", label: "Target Sheet", type: "url" },
        { key: "dryRun", label: "Dry run", type: "checkbox", defaultValue: true }
      ],
      quickReplies: [
        { label: "Lookup copy", value: "toolfield:operationType:lookup_copy" },
        { label: "Cross-check", value: "toolfield:operationType:cross_check" },
        { label: "Coverage report", value: "toolfield:operationType:coverage_report" },
        { label: "Copy columns", value: "toolfield:operationType:copy_columns" }
      ],
      confirmationRules: {
        beforeRun: "Use the Sheet Utilities workspace to review mappings before any write operation."
      },
      infer(message) {
        const urls = extractUrls(message);
        const text = String(message || "").toLowerCase();
        const sourceUrl = urls.find((url) => detectSourceType(url) === "folder") || urls[0] || "";
        const targetUrl = urls.find((url, index) => index > 0 && detectSourceType(url) === "sheet") || "";
        const operationType = /cross|הצלב|השווא/i.test(text)
          ? "cross_check"
          : (/coverage|כיסוי/i.test(text)
            ? "coverage_report"
            : (/copy columns|להעתיק עמודות|עמודות/i.test(text)
              ? "copy_columns"
              : (/folder|master|מאסטר/i.test(text) ? "folder_to_master_injection" : "lookup_copy")));
        return {
          instruction: compact(message),
          operationType,
          sourceUrl,
          targetUrl,
          dryRun: true
        };
      },
      payloadBuilder(values) {
        return {
          mode: "sheet-utilities",
          operationType: values.operationType || "lookup_copy",
          instruction: values.instruction || "",
          sourceUrl: values.sourceUrl || "",
          targetUrl: values.targetUrl || "",
          dryRun: values.dryRun !== false
        };
      }
    },
    {
      id: "file-draft",
      title: "Code / Local File Edit Draft",
      group: "General abilities",
      icon: "FILE",
      status: "draft-only",
      risk: "requires-review",
      canRunDirectly: false,
      description: "Draft a safe Codex change request for local repo files. Google Sheets and Drive sources are routed to workspace tools instead.",
      intentHints: ["edit local file", "repo file", "code file", "change code", "create file", "write file", "קובץ מקומי", "קובץ קוד", "לתקן קוד"],
      requiredInputs: [
        { key: "instruction", label: "Requested edit", question: "What should change?", type: "textarea" }
      ],
      optionalInputs: [
        { key: "filePath", label: "File path", type: "text" },
        { key: "targetScope", label: "Target scope", type: "text" },
        { key: "targetKind", label: "Target kind", type: "text", defaultValue: "repo-discovery" }
      ],
      quickReplies: [
        { label: "Let Codex find files", value: "file:discover" },
        { label: "I’ll send a repo path", value: "file:ask-path" },
        { label: "Edit Google Sheet", value: "start:sheet-edit" },
        { label: "Pasted content", value: "file:pasted-content" }
      ],
      confirmationRules: {
        beforeRun: "Browser chat does not write files. Codex handles code edits with explicit review."
      },
      infer(message) {
        return {
          filePath: extractFilePath(message),
          targetScope: extractFilePath(message) ? "" : "Codex should identify the relevant local files from the request.",
          targetKind: extractFilePath(message) ? "repo-path" : "repo-discovery",
          instruction: compact(message)
        };
      },
      payloadBuilder(values) {
        return {
          action: "draft-file-edit",
          filePath: values.filePath || "",
          targetScope: values.targetScope || "",
          targetKind: values.targetKind || (values.filePath ? "repo-path" : "repo-discovery"),
          needsCodexDiscovery: !values.filePath,
          instruction: values.instruction || "",
          protectedFiles: [".env", "package.json", "credentials", "service-account.json", "src/core/agent.ts", "src/services/sheets.ts", "src/index.ts"],
          note: "The assistant page drafts file edits only; Codex applies changes with guardrails and confirmation."
        };
      }
    }
  ];

  function outputTypeForTool(tool) {
    if (tool.id === "site-ai-audit") return "audit-report";
    if (tool.id === "site-ai-faq-audit") return "faq-audit-report";
    if (tool.id === "client-reports") return "client-dashboard-report";
    if (tool.id === "sheet-utilities") return "sheet-utility-preview-or-write";
    if (tool.id === "schema-builder") return "schema-preview-or-sheet-write";
    if (tool.id === "meta-tags") return "metadata-preview-or-sheet-write";
    if (tool.id === "translate-demo") return "translated-sheet-tabs";
    if (tool.id === "design-formatting") return "sheet-preview-or-sheet-write";
    if (tool.id === "file-draft") return "codex-edit-request";
    return "generated-output";
  }

  function followUpsForTool(tool) {
    const defaults = ["add_detail", "show_payload", "open_workspace", "start_over"];
    if (tool.id === "design-formatting") {
      return [
        "dry_run",
        "confirm_live_write",
        "replace_column_when_value",
        "faq_answer_research",
        "ask_where_output_went",
        ...defaults
      ];
    }
    if (tool.id === "translate-demo") return ["change_languages", "add_preserve_terms", "add_glossary", "add_terminology", ...defaults];
    if (tool.id === "schema-builder") return ["preview", "write_to_sheet", "change_output_cell", "change_columns", ...defaults];
    if (tool.id === "site-ai-audit") return ["change_audit_profile", "change_checks", "change_page_budget", "disable_ai_summary", "open_report", ...defaults];
    if (tool.id === "client-reports") return ["change_report_type", "change_metric", "change_date_range", "open_workspace", ...defaults];
    if (tool.id === "sheet-utilities") return ["change_operation", "change_source", "change_target", "open_workspace", ...defaults];
    return defaults;
  }

  function capabilityForTool(tool) {
    return {
      id: tool.id,
      modes: [tool.mode || tool.id],
      canRunDirectly: Boolean(tool.canRunDirectly),
      directRunAllowed: tool.id === "translate-demo"
        ? "single Google Sheet only; Drive folders should open the workspace"
        : Boolean(tool.canRunDirectly),
      needsConfirmation: tool.risk === "writes-to-sheet" || /creates|cost|ai/i.test(String(tool.risk || "")),
      operationModes: tool.id === "design-formatting"
        ? [
            "faq_answer_research",
            "replace_column_when_value",
            "faq_missing_questions",
            "faq_apply_client_comments",
            "faq_language_review",
            "faq_question_review",
            "faq_name_injection",
            "format_table"
          ]
        : [tool.mode || tool.id],
      requiredInputs: (tool.requiredInputs || []).map((field) => field.key),
      optionalInputs: (tool.optionalInputs || []).map((field) => field.key),
      outputType: outputTypeForTool(tool),
      workspaceUrl: tool.href || "",
      resultParser: tool.id === "site-ai-audit"
        ? "SITE_AI_AUDIT JSON marker -> formatted report card"
        : tool.id === "schema-builder"
          ? "SCHEMA_BUILDER JSON marker -> preview or sheet link"
          : "log links and preview-event markers",
      followUpActions: followUpsForTool(tool)
    };
  }

  const normalizedTools = tools.map((tool) => ({
    ...tool,
    keywords: tool.intentHints,
    fields: [...(tool.requiredInputs || []), ...(tool.optionalInputs || [])],
    capability: tool.capability || capabilityForTool(tool),
    buildPayload: tool.payloadBuilder
  }));

  window.CarmelonAssistantTools = {
    tools: normalizedTools,
    getTool(id) {
      return normalizedTools.find((tool) => tool.id === id) || null;
    },
    helpers: {
      compact,
      detectLanguages,
      detectSourceType,
      extractFilePath,
      extractSubjects,
      extractUrl,
      extractUrls,
      sourcePayload,
      splitList
    }
  };
})();
