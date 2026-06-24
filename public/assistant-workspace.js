(() => {
  const socket = typeof io === "function" ? io() : null;
  const manifest = window.CarmelonAssistantTools || { tools: [], helpers: {} };

  const els = {
    form: document.getElementById("assistantForm"),
    input: document.getElementById("assistantInput"),
    chatLog: document.getElementById("chatLog"),
    quickReplies: document.getElementById("quickReplies"),
    actionsList: document.getElementById("actionsList"),
    runLog: document.getElementById("runLog"),
    toolStrip: document.getElementById("toolStrip"),
    latestOutputPanel: document.getElementById("latestOutputPanel"),
    resetChatBtn: document.getElementById("resetChatBtn"),
    clearActionsBtn: document.getElementById("clearActionsBtn"),
    clearLogBtn: document.getElementById("clearLogBtn"),
    sourcesList: document.getElementById("sourcesList"),
    sourcesCount: document.getElementById("sourcesCount"),
    outputsList: document.getElementById("outputsList"),
    outputsCount: document.getElementById("outputsCount")
  };

  const presetLabels = {
    hotel: "Hotel / hospitality",
    local: "Local business",
    service: "Product / service",
    vehicle: "Vehicle / car model"
  };

  const presetLabelsHe = {
    hotel: "מלון / אירוח",
    local: "עסק מקומי",
    service: "מוצר / שירות",
    vehicle: "דגם רכב"
  };

  const presetAudiences = {
    hotel: "Guests before booking, guests before arrival, and in-house guests.",
    local: "Potential customers researching the business before contacting, visiting or buying.",
    service: "Potential customers comparing products, services, pricing, suitability and next steps.",
    vehicle: "Car buyers comparing models, trims, ownership costs, reliability and day-to-day fit."
  };

  const presetAudienceLabelsHe = new Map([
    [presetAudiences.hotel, "אורחים לפני הזמנה, לפני הגעה ובמהלך השהות."],
    [presetAudiences.local, "לקוחות שבודקים את העסק לפני יצירת קשר, ביקור או רכישה."],
    [presetAudiences.service, "לקוחות שמשווים אפשרויות, התאמה, מחיר והשלב הבא."],
    [presetAudiences.vehicle, "רוכשי רכב שמשווים דגמים, עלויות, אמינות והתאמה יומיומית."],
    ["Potential customers comparing options, trust signals, pricing, suitability and next steps.", "לקוחות שמשווים אפשרויות, אמון, מחיר והתאמה."],
    ["Existing customers who need clear practical answers, support guidance and next steps.", "לקוחות קיימים שצריכים תשובות מעשיות והכוונה ברורה."],
    ["International guests and tourists checking fit, location, booking terms and arrival details.", "אורחים ותיירים מחו״ל שבודקים התאמה, מיקום, תנאי הזמנה והגעה."],
    ["Families checking room fit, facilities, policies, food and practical stay details.", "משפחות שבודקות חדרים, מתקנים, מדיניות, אוכל ופרטי שהות."]
  ]);

  const qaCheckLabels = {
    duplicates: { he: "כפילויות", en: "Duplicates" },
    sources: { he: "בדיקת מקורות", en: "Source check" },
    writing: { he: "כתיבה ובהירות", en: "Writing fit" }
  };

  const audienceOptionsByScope = {
    hotel: [
      {
        id: "before_booking",
        en: "Guests before booking",
        he: "אורחים לפני הזמנה",
        value: "Guests before booking who compare fit, value, location, trust signals and booking terms."
      },
      {
        id: "before_arrival",
        en: "Guests before arrival",
        he: "אורחים לפני הגעה",
        value: "Guests before arrival who need practical details about check-in, access, policies, services and preparation."
      },
      {
        id: "in_house",
        en: "In-house guests",
        he: "אורחים בזמן השהות",
        value: "In-house guests who need clear answers about facilities, services, support and stay logistics."
      },
      {
        id: "families",
        en: "Families",
        he: "משפחות",
        value: "Families checking room fit, facilities, food, policies and practical stay details."
      },
      {
        id: "international",
        en: "International guests",
        he: "אורחים מחו״ל",
        value: "International guests and tourists checking location, language, arrival, booking terms and local fit."
      }
    ],
    local: [
      {
        id: "first_contact",
        en: "Before contacting",
        he: "לפני יצירת קשר",
        value: "Potential customers researching the business before contacting, visiting or buying."
      },
      {
        id: "local_compare",
        en: "Comparing local options",
        he: "משווים עסקים דומים",
        value: "Local customers comparing nearby options, trust signals, pricing, availability and fit."
      },
      {
        id: "existing",
        en: "Existing customers",
        he: "לקוחות קיימים",
        value: "Existing customers who need practical answers, support guidance, policies and next steps."
      },
      {
        id: "urgent",
        en: "Urgent needs",
        he: "צורך דחוף",
        value: "Customers with urgent or time-sensitive needs who need fast, practical answers."
      }
    ],
    service: [
      {
        id: "compare",
        en: "Comparing options",
        he: "משווים אפשרויות",
        value: "Potential customers comparing options, trust signals, pricing, suitability and next steps."
      },
      {
        id: "decision_makers",
        en: "Decision makers",
        he: "מקבלי החלטות",
        value: "Decision makers who need business fit, risk, implementation, pricing and proof points."
      },
      {
        id: "existing",
        en: "Existing customers",
        he: "לקוחות קיימים",
        value: "Existing customers who need clear practical answers, support guidance and next steps."
      },
      {
        id: "onboarding",
        en: "Onboarding users",
        he: "משתמשים בהתחלה",
        value: "New users who need setup, onboarding, usage and support answers."
      }
    ],
    vehicle: [
      {
        id: "buyers",
        en: "Car buyers",
        he: "רוכשי רכב",
        value: "Car buyers comparing models, trims, ownership costs, reliability and day-to-day fit."
      },
      {
        id: "families",
        en: "Families",
        he: "משפחות",
        value: "Families checking space, comfort, safety, storage, running costs and daily practicality."
      },
      {
        id: "city_drivers",
        en: "City drivers",
        he: "נהיגה עירונית",
        value: "City drivers checking size, parking, fuel or charging, comfort and everyday usability."
      },
      {
        id: "owners",
        en: "Current owners",
        he: "בעלים קיימים",
        value: "Current owners who need maintenance, warranty, service, features and troubleshooting answers."
      }
    ]
  };

  const styleOptions = [
    { id: "warm", en: "Warm and concise", he: "חם וקצר", value: "Warm, concise, reliable." },
    { id: "professional", en: "Professional and direct", he: "מקצועי וישיר", value: "Professional, direct and source-grounded." },
    { id: "seo", en: "SEO / AI readiness", he: "SEO / מוכנות AI", value: "Clear, entity-rich and useful for search and AI systems." },
    { id: "plain", en: "Plain and practical", he: "פשוט ומעשי", value: "Plain, practical and easy to scan." }
  ];

  const questionGuidanceOptions = [
    {
      id: "natural_user_language",
      en: "Natural user wording",
      he: "ניסוח טבעי של משתמשים",
      value: "Write questions in the natural wording real people would use, including direct, practical phrasing rather than internal marketing language."
    },
    {
      id: "real_question_research",
      en: "Real question demand",
      he: "שאלות אמיתיות מהרשת",
      value: "Use approved sources, public reviews, competitor pages, search-style phrasing and common user intent signals to discover real questions people ask."
    },
    {
      id: "geo_search_coverage",
      en: "SEO / GEO coverage",
      he: "כיסוי SEO / GEO",
      value: "Cover entity understanding, policies, location, trust signals, comparison needs and practical decision blockers that search and AI systems need."
    },
    {
      id: "avoid_generic_duplicates",
      en: "Avoid generic duplicates",
      he: "בלי שאלות גנריות כפולות",
      value: "Avoid vague category-heading questions, duplicated intent and questions that cannot be answered from reliable sources."
    }
  ];

  const answerGuidanceOptions = [
    {
      id: "source_grounded",
      en: "Source-grounded facts",
      he: "עובדות מבוססות מקור",
      value: "Answer only with facts supported by approved sources. Mark missing or uncertain facts as Needs source confirmation / [VERIFY]."
    },
    {
      id: "direct_answer",
      en: "Direct answer first",
      he: "תשובה ישירה קודם",
      value: "Start with the direct answer before adding conditions, details or caveats."
    },
    {
      id: "useful_detail",
      en: "Useful practical detail",
      he: "פרטים שימושיים בפועל",
      value: "Include practical details users need for decisions or next steps, while avoiding unsupported promises."
    },
    {
      id: "no_sales_copy",
      en: "No sales copy",
      he: "בלי טקסט מכירתי",
      value: "Keep answers helpful, calm and non-promotional. Do not inflate claims beyond the source."
    }
  ];

  const languageOptions = [
    { code: "en", en: "English", he: "אנגלית" },
    { code: "he", en: "Hebrew", he: "עברית" },
    { code: "de", en: "German", he: "גרמנית" },
    { code: "fr", en: "French", he: "צרפתית" },
    { code: "es", en: "Spanish", he: "ספרדית" },
    { code: "it", en: "Italian", he: "איטלקית" },
    { code: "nl", en: "Dutch", he: "הולנדית" },
    { code: "pl", en: "Polish", he: "פולנית" },
    { code: "ru", en: "Russian", he: "רוסית" },
    { code: "ar", en: "Arabic", he: "ערבית" }
  ];

  const auditCheckLabels = {
    includeSitemap: { he: "Sitemap", en: "Sitemap" },
    includeLlmsTxt: { he: "llms.txt", en: "llms.txt" },
    includeFaqAudit: { he: "FAQ", en: "FAQ" },
    includeStructuredData: { he: "Schema", en: "Schema" },
    includeAnswerability: { he: "מענה AI", en: "AI answerability" },
    includeMetaAudit: { he: "Meta", en: "Meta" },
    includeLinkAudit: { he: "קישורים ואמון", en: "Links + trust" }
  };

  const categoryPlans = {
    hotel: [
      "General information: identity, location, who it suits, trust signals.",
      "Booking and payment: prices, cancellation, deposit, direct booking.",
      "Arrival and stay: check-in, check-out, reception, services during the stay.",
      "Rooms and amenities: room types, accessibility, facilities, families.",
      "Location and transport: parking, public transport, nearby attractions.",
      "Food and policies: breakfast, restaurant, pets, smoking, special requests."
    ],
    local: [
      "General information: what the business does and who it serves.",
      "Services and pricing: what is offered, cost expectations, packages.",
      "Contact and booking: how to book, response time, next steps.",
      "Location and access: address, parking, service area, opening hours.",
      "Trust and fit: reviews, guarantees, experience, who it is right for."
    ],
    service: [
      "Overview and fit: what the product or service does and who needs it.",
      "Features and use cases: workflows, benefits, limits and setup.",
      "Pricing and plans: cost, packages, commitments and cancellation.",
      "Implementation and support: onboarding, integrations, help, timelines.",
      "Comparison and trust: alternatives, proof points, risks and decision blockers."
    ],
    vehicle: [
      "Model overview: positioning, body style, who it suits.",
      "Price and ownership: trims, leasing, insurance, fuel or charging, maintenance.",
      "Specs and performance: engine, battery, range, drivetrain, safety.",
      "Daily use: space, comfort, cargo, city driving, family fit.",
      "Technology and reliability: infotainment, driver assistance, reviews, warranty."
    ]
  };

  const resultMarkerNames = new Set([
    "CLIENT_REPORT",
    "CLIENT_REPORT_EDIT",
    "SCHEMA_BUILDER",
    "META_TAGS",
    "SITE_AI_AUDIT",
    "SITE_AI_DISCOVERY",
    "SITE_FAQ_AUDIT"
  ]);

  const state = createConversationState();
  let latestChatMessageEl = null;
  let pendingChatScrollFrame = 0;
  let pendingChatScrollTarget = null;

  function createConversationState() {
    return {
      messages: [],
      mode: "none",
      step: "idle",
      running: false,
      runningToolId: "",
      runningPayload: null,
      activeIntent: "",
      activeToolId: "",
      activeStep: "idle",
      collectedInputs: {},
      missingInputs: [],
      sources: [],
      pendingQuestion: null,
      readyToRun: false,
      lastPayload: null,
      lastRun: null,
      lastResult: null,
      liveRunConfirmed: false,
      runConfirmed: false,
      outputs: [],
      chatLocale: "en",
      taskMemory: freshTaskMemory(),
      answers: freshAnswers(),
      fileTask: freshFileTask(),
      faqSubjectValidation: null,
      faqAuditDiscovery: null,
      faqAuditDiscoveryPending: false,
      faqAuditGroupSelectionTouched: false,
      auditCheckSelectionTouched: false,
      marker: null
    };
  }

  function freshAnswers() {
    return {
      scope: "",
      subjects: "",
      subjectRaw: "",
      audience: "",
      language: "English (UK)",
      count: "20-30",
      sourceMode: "",
      sourceUrl: "",
      sourceInstructions: "Use the official website as the primary factual source. If a fact is missing, mark it as Needs source confirmation.",
      forbiddenPhrases: "",
      categories: "",
      categoryCounts: "",
      questionGuidance: "",
      answerGuidance: "",
      qaMode: "duplicates|writing",
      style: "Warm, concise, reliable.",
      model: "o3",
      extraGuidance: "",
      audienceConfirmed: false,
      languageConfirmed: false,
      countConfirmed: false,
      categoriesConfirmed: false,
      categoryCountsConfirmed: false,
      sourceConfirmed: false,
      questionGuidanceConfirmed: false,
      answerGuidanceConfirmed: false,
      qaConfirmed: false,
      styleConfirmed: false
    };
  }

  function freshFileTask() {
    return {
      filePath: "",
      targetScope: "",
      targetKind: "repo-discovery",
      instruction: "",
      status: "draft"
    };
  }

  function freshTaskMemory() {
    return {
      lastToolId: "",
      lastSource: null,
      lastSheet: null,
      lastWebsite: null,
      lastOperation: null,
      lastOutputColumns: {},
      lastGeneratedOutput: null,
      references: {}
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function compact(value) {
    return String(value || "").trim();
  }

  function withoutUrlsForDisplay(value) {
    return String(value || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ").replace(/\s+/g, " ").trim();
  }

  function siteAuditProfileDefaults(profile) {
    const presets = {
      "general-fast": {
        auditProfile: "general-fast",
        label: "Fast general audit",
        maxPages: 25,
        maxDepth: 2,
        renderMode: "static",
        crawlScope: "site",
        includeAiAnalysis: false
      },
      "full-ai": {
        auditProfile: "full-ai",
        label: "Full + AI summary",
        maxPages: 30,
        maxDepth: 2,
        renderMode: "static",
        crawlScope: "site",
        includeAiAnalysis: true
      },
      "faq-schema": {
        auditProfile: "faq-schema",
        label: "FAQ/schema focus",
        maxPages: 50,
        maxDepth: 3,
        renderMode: "static",
        crawlScope: "faq-only",
        includeAiAnalysis: true
      },
      "rendered-deep": {
        auditProfile: "rendered-deep",
        label: "Rendered JS deep audit",
        maxPages: 25,
        maxDepth: 2,
        renderMode: "rendered",
        crawlScope: "site",
        includeAiAnalysis: true
      }
    };
    return presets[profile] || presets["general-fast"];
  }

  function localizedSiteAuditProfileLabel(profile) {
    const defaults = siteAuditProfileDefaults(profile);
    if (!prefersHebrew()) return defaults.label;
    return {
      "general-fast": "אודיט כללי מהיר",
      "full-ai": "אודיט מלא + AI summary",
      "faq-schema": "מיקוד FAQ / Schema",
      "rendered-deep": "אודיט עמוק עם JS rendered"
    }[defaults.auditProfile] || defaults.label;
  }

  function hasHebrew(value) {
    return /[\u0590-\u05ff]/.test(String(value || ""));
  }

  function detectLocaleFromText(value) {
    const text = String(value || "");
    if (hasHebrew(text)) return "he";
    if (/[A-Za-z]/.test(text)) return "en";
    return "";
  }

  function rememberLocaleFromText(value) {
    const locale = detectLocaleFromText(value);
    if (!locale) return;
    if (state.step === "idle" || state.mode === "none" || !state.messages.some((message) => message.role === "user")) {
      state.chatLocale = locale;
    }
  }

  function isHebrewUi() {
    return state.chatLocale === "he";
  }

  function localeText(hebrewText, englishText) {
    return isHebrewUi() ? hebrewText : englishText;
  }

  function messageDir(value) {
    return hasHebrew(value) ? "rtl" : "ltr";
  }

  function cleanAnsi(text) {
    return String(text || "").replace(/\x1B\[[0-9;]*m/g, "");
  }

  function helper(name, fallback) {
    return manifest.helpers?.[name] || fallback;
  }

  function scrollChatToLatest(target = latestChatMessageEl) {
    pendingChatScrollTarget = target || latestChatMessageEl;
    if (pendingChatScrollFrame) cancelAnimationFrame(pendingChatScrollFrame);
    pendingChatScrollFrame = requestAnimationFrame(() => {
      pendingChatScrollFrame = 0;
      const chat = els.chatLog;
      const message = pendingChatScrollTarget || latestChatMessageEl;
      if (!chat || !message || !chat.contains(message)) {
        if (chat) chat.scrollTop = chat.scrollHeight;
        return;
      }

      const chatRect = chat.getBoundingClientRect();
      const messageRect = message.getBoundingClientRect();
      const messageTop = chat.scrollTop + messageRect.top - chatRect.top;
      const messageHeight = message.offsetHeight;
      const viewportHeight = chat.clientHeight;
      const padding = 12;

      if (messageHeight + padding > viewportHeight) {
        chat.scrollTop = Math.max(0, messageTop - padding);
        return;
      }

      chat.scrollTop = Math.max(0, messageTop + messageHeight - viewportHeight + padding);
    });
  }

  const extractUrlsFromText = helper("extractUrls", (text) => {
    return (String(text || "").match(/https?:\/\/[^\s"'<>]+/gi) || [])
      .map((url) => compact(url).replace(/[),.;\]]+$/g, ""));
  });

  const detectSourceType = helper("detectSourceType", (value) => {
    const text = String(value || "").toLowerCase();
    if (text.includes("/drive/folders/")) return "folder";
    if (text.includes("/spreadsheets/")) return "sheet";
    if (/^https?:\/\//i.test(compact(value))) return "website";
    return "manual";
  });

  const detectLanguagesFromText = helper("detectLanguages", (text, fallback = []) => {
    const lower = String(text || "").toLowerCase();
    const matches = lower.match(/\b(en|he|de|fr|es|it|nl|pl|ru|zh|ar)\b/g) || [];
    return matches.length ? Array.from(new Set(matches)) : fallback;
  });

  const manifestSplitList = helper("splitList", (value) => {
    if (Array.isArray(value)) return value.map(compact).filter(Boolean);
    return String(value || "").split(/\n|,|;/).map(compact).filter(Boolean);
  });

  function getTool(toolId) {
    if (typeof manifest.getTool === "function") return manifest.getTool(toolId);
    return (manifest.tools || []).find((tool) => tool.id === toolId) || null;
  }

  function addMessage(role, text) {
    if (role === "user") rememberLocaleFromText(text);
    state.messages.push({ role, text });
    state.messages = state.messages.slice(-80);

    const item = document.createElement("div");
    item.className = `message ${role}`;
    item.dir = messageDir(text);
    item.textContent = text;
    els.chatLog.appendChild(item);
    latestChatMessageEl = item;
    scrollChatToLatest(item);
  }

  function bot(text) {
    addMessage("assistant", text);
  }

  function user(text) {
    addMessage("user", text);
    recordSourcesFromText(text, "user message");
  }

  function logLine(text, tone = "") {
    const line = document.createElement("div");
    line.className = tone;
    line.textContent = text;
    if (els.runLog.textContent === "Ready. Existing workflows run through the same backend socket.") {
      els.runLog.textContent = "";
    }
    els.runLog.appendChild(line);
    els.runLog.scrollTop = els.runLog.scrollHeight;
  }

  function extractUrl(text) {
    return extractUrlsFromText(text)[0] || "";
  }

  function extractFilePath(text) {
    const withoutUrls = String(text || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ");
    const match = withoutUrls.match(/(?:^|[\s`'"])((?:\.\/)?(?:public|src|docs|scripts|content|data|assets|config|tests?|pages|components|lib)\/[^\s"'<>]+|[A-Za-z0-9_.-]+\.(?:md|txt|json|csv|ts|tsx|js|jsx|html|css|scss|yml|yaml))(?:$|[\s`'"])/i);
    return compact(match?.[1] || "").replace(/[),.;\]]+$/g, "");
  }

  function sheetUrlFromText(text) {
    return extractUrlsFromText(text).find((url) => {
      const type = detectSourceType(url);
      return type === "sheet" || type === "folder";
    }) || "";
  }

  function websiteUrlFromText(text) {
    return extractUrlsFromText(text).find((url) => detectSourceType(url) === "website") || "";
  }

  function extractOutputCell(text, fallback = "E73") {
    const source = withoutUrlsForDisplay(text);
    const matches = Array.from(String(source || "").matchAll(/\b(?:[\w -]+!)?[A-Z]{1,3}\d{1,6}\b/gi))
      .map((match) => match[0].trim());
    const reversedCell = Array.from(String(source || "").matchAll(/\b(\d{1,6})\s*([A-Z]{1,3})\b/gi))
      .map((match) => `${match[2]}${match[1]}`)
      .find((cell) => /^[A-Z]{1,3}\d{1,6}$/i.test(cell));
    const cell = matches.find((item) => item.includes("!")) ||
      matches.find((cell) => /^[A-Z]{1,2}\d{1,6}$/i.test(cell)) ||
      reversedCell ||
      fallback;
    const sheetMatch = cell.match(/^(.*)!([A-Z]{1,3}\d{1,6})$/i);
    if (!sheetMatch) return cell.toUpperCase();
    const sheetName = sheetMatch[1]
      .replace(/.*\b(?:output|write|place|put|cell|to|into|in|at)\b\s*/i, "")
      .trim();
    return `${sheetName || "Sheet1"}!${sheetMatch[2].toUpperCase()}`;
  }

  function sourceKind(url) {
    const type = detectSourceType(url);
    if (type === "sheet") return "Google Sheet";
    if (type === "folder") return "Drive folder";
    if (type === "website") return "Website";
    return "Link";
  }

  function extractSpreadsheetIdFromUrl(value) {
    return String(value || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || "";
  }

  function rememberSource(url, reason = "source", toolId = state.activeToolId) {
    const cleanUrl = compact(url).replace(/[),.;\]]+$/g, "");
    if (!cleanUrl) return;
    const kind = sourceKind(cleanUrl);
    const item = {
      url: cleanUrl,
      kind,
      reason,
      toolId: toolId || "",
      updatedAt: new Date().toISOString()
    };
    state.taskMemory.lastSource = item;
    if (kind === "Google Sheet" || kind === "Drive folder") {
      state.taskMemory.lastSheet = {
        ...state.taskMemory.lastSheet,
        url: cleanUrl,
        kind,
        spreadsheetId: extractSpreadsheetIdFromUrl(cleanUrl) || state.taskMemory.lastSheet?.spreadsheetId || "",
        tabName: state.taskMemory.lastSheet?.tabName || "Sheet1",
        updatedAt: item.updatedAt
      };
    }
    if (kind === "Website") {
      state.taskMemory.lastWebsite = item;
    }
  }

  function rememberOutputColumns(operation = {}) {
    if (!operation || typeof operation !== "object") return;
    const columns = {
      sourceColumn: normalizeSheetColumn(operation.sourceColumn || operation.sourceCol),
      targetColumn: normalizeSheetColumn(operation.targetColumn || operation.targetCol),
      answerColumn: normalizeSheetColumn(operation.answerCol || operation.answerColumn),
      outputColumn: normalizeSheetColumn(operation.outputColumn || operation.targetCol)
    };
    Object.entries(columns).forEach(([key, value]) => {
      if (value) state.taskMemory.lastOutputColumns[key] = value;
    });
    if (operation.type === "faq_answer_research") {
      const sourceColumn = columns.outputColumn || columns.targetColumn || "F";
      const targetColumn = columns.answerColumn || "C";
      state.taskMemory.references.it = {
        label: "last researched answers",
        sourceColumn,
        targetColumn
      };
    }
    if (operation.type === "replace_column_when_value") {
      state.taskMemory.references.it = {
        label: "last copied column values",
        sourceColumn: columns.sourceColumn,
        targetColumn: columns.targetColumn
      };
    }
  }

  function rememberToolPayload(toolId, payload = {}, values = state.collectedInputs) {
    if (!toolId) return;
    state.taskMemory.lastToolId = toolId;
    if (values?.targetUrl || payload?.targetId || payload?.targetUrl) {
      rememberSource(values.targetUrl || payload.targetId || payload.targetUrl, "active sheet task", toolId);
    }
    if (values?.sourceUrl) rememberSource(values.sourceUrl, "active source", toolId);
    if (toolId === "design-formatting") {
      const operation = payload.operation || payload.operations?.[0] || {};
      state.taskMemory.lastOperation = {
        toolId,
        type: operation.type || payload.selectedOperation || values.operationType || "",
        dryRun: payload.dryRun !== false,
        tabName: payload.tabName || values.tabName || "Sheet1",
        sourceColumn: operation.sourceColumn || values.sourceColumn || "",
        targetColumn: operation.targetColumn || values.targetColumn || "",
        targetCol: operation.targetCol || values.targetCol || "",
        answerCol: operation.answerCol || values.answerCol || "",
        outputColumn: operation.outputColumn || "",
        updatedAt: new Date().toISOString()
      };
      state.taskMemory.lastSheet = {
        ...(state.taskMemory.lastSheet || {}),
        url: values.targetUrl || payload.targetId || state.taskMemory.lastSheet?.url || "",
        kind: state.taskMemory.lastSheet?.kind || "Google Sheet",
        tabName: payload.tabName || values.tabName || state.taskMemory.lastSheet?.tabName || "Sheet1",
        updatedAt: new Date().toISOString()
      };
      rememberOutputColumns(operation);
    }
  }

  function recordSource(url, reason = "source", toolId = state.activeToolId) {
    const cleanUrl = compact(url).replace(/[),.;\]]+$/g, "");
    if (!cleanUrl) return;
    rememberSource(cleanUrl, reason, toolId);
    const existing = state.sources.find((item) => item.url === cleanUrl);
    if (existing) {
      existing.reason = reason || existing.reason;
      existing.toolId = toolId || existing.toolId;
      existing.updatedAt = new Date().toISOString();
      renderSources();
      return;
    }
    state.sources.unshift({
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: cleanUrl,
      kind: sourceKind(cleanUrl),
      reason,
      toolId: toolId || "",
      createdAt: new Date().toISOString()
    });
    state.sources = state.sources.slice(0, 30);
    renderSources();
  }

  function recordSourcesFromText(text, reason = "chat") {
    extractUrlsFromText(text).forEach((url) => recordSource(url, reason));
  }

  function recordOutput(output) {
    const next = {
      id: output.id || `out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: output.title || "Generated output",
      description: output.description || "",
      type: output.type || "result",
      url: output.url || "",
      source: output.source || state.activeToolId || "",
      createdAt: output.createdAt || new Date().toISOString()
    };
    state.taskMemory.lastGeneratedOutput = next;
    if (next.type === "audit-report" || next.type === "report" || next.type === "google-sheet") {
      state.lastResult = {
        status: "ready",
        title: next.title,
        type: next.type,
        url: next.url,
        description: next.description,
        source: next.source,
        updatedAt: next.createdAt
      };
    }

    const duplicate = state.outputs.find((item) => {
      if (next.url && item.url === next.url) return true;
      return !next.url && item.title === next.title && item.source === next.source;
    });

    if (duplicate) {
      Object.assign(duplicate, next, { id: duplicate.id });
    } else {
      state.outputs.unshift(next);
      state.outputs = state.outputs.slice(0, 30);
    }
    renderOutputs();
  }

  function renderSources() {
    els.sourcesCount.textContent = String(state.sources.length);
    if (!state.sources.length) {
      els.sourcesList.innerHTML = `<div class="resource-empty">URLs you send in chat will stay here and can become source inputs for tools.</div>`;
      return;
    }
    els.sourcesList.innerHTML = state.sources.map((item) => `
      <div class="resource-item">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>
        <span class="resource-meta">${escapeHtml(item.kind)} · ${escapeHtml(item.reason || "source")}</span>
      </div>
    `).join("");
  }

  function outputTypeLabel(type = "") {
    return String(type || "result").replace(/-/g, " ");
  }

  function latestOutputActionLabel(item = {}) {
    if (!item.url) return "";
    if (/audit|report/.test(item.type || "")) return "Open report";
    if (/sheet|writeback/.test(item.type || "")) return "Open generated file";
    if (/preview/.test(item.type || "")) return "Open preview";
    return "Open output";
  }

  function latestOutputKickerLabel(item = {}) {
    if (/sheet|writeback/.test(item.type || "")) return "New generated file";
    if (/audit|report/.test(item.type || "")) return "New report";
    return "New output";
  }

  function renderLatestOutput() {
    if (!els.latestOutputPanel) return;
    const latest = state.outputs[0];
    if (!latest) {
      els.latestOutputPanel.classList.add("is-empty");
      els.latestOutputPanel.innerHTML = "";
      return;
    }

    const actionLabel = latestOutputActionLabel(latest);
    els.latestOutputPanel.classList.remove("is-empty");
    els.latestOutputPanel.innerHTML = `
      <article class="latest-output-card">
        <div class="latest-output-kicker">
          <span>${escapeHtml(latestOutputKickerLabel(latest))}</span>
          <span>${escapeHtml(outputTypeLabel(latest.type))}</span>
        </div>
        <h3 class="latest-output-title">${escapeHtml(latest.title)}</h3>
        ${latest.description ? `<p class="latest-output-description">${escapeHtml(latest.description)}</p>` : ""}
        <div class="latest-output-actions">
          ${latest.url ? `<a class="latest-output-link" href="${escapeHtml(latest.url)}" target="_blank" rel="noopener">${escapeHtml(actionLabel)}</a>` : ""}
          <span class="latest-output-meta">${escapeHtml(latest.source || "assistant")} · just created</span>
        </div>
      </article>
    `;
  }

  function renderOutputs() {
    renderLatestOutput();
    const history = state.outputs.slice(1);
    els.outputsCount.textContent = String(state.outputs.length);
    if (!history.length) {
      els.outputsList.innerHTML = state.outputs.length
        ? `<div class="resource-empty">The newest generated output is highlighted above. Older outputs will collect here.</div>`
        : `<div class="resource-empty">Older sheets, reports and parsed result links from runs will appear here.</div>`;
      return;
    }
    els.outputsList.innerHTML = history.map((item) => `
      <div class="resource-item">
        ${item.url
          ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>`
          : `<strong>${escapeHtml(item.title)}</strong>`}
        <span class="resource-meta">${escapeHtml(outputTypeLabel(item.type))}${item.description ? ` · ${escapeHtml(item.description)}` : ""}</span>
      </div>
    `).join("");
  }

  function hasEditWord(text) {
    const lower = String(text || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ").toLowerCase();
    return /לערוך|תערוך|ערוך|עריכה|עריכות|לעריכה|לתקן|תתקן|שנה|תשנה|לעדכן|תעדכן|להשלים|למלא|לרוקן|להכניס|תכניס|הכנס|להוסיף|להעביר|תעביר|העבר|להעתיק|תעתיק|העתק|להחליף|תחליף|החלף|לקחת|תיקח|קח|לשים|תשים|שים|לכתוב|תכתוב|כתוב|לחפש|למצוא|מקורות|תשובות|edit|change|update|fix|create|write|modify|patch|format|clean|search|find|complete|fill|source|replace|copy|move|transfer|put|insert/.test(lower);
  }

  function normalizeSheetColumn(value) {
    const match = String(value || "").match(/[A-Z]{1,3}/i);
    return match ? match[0].toUpperCase() : "";
  }

  function isDesignFormattingPayload(payload) {
    return payload?.mode === "design-formatting" || Boolean(payload?.operation || payload?.operations || payload?.selectedOperation);
  }

  function latestDesignFormattingPayload() {
    if (state.lastRun?.toolId === "design-formatting" && state.lastRun.payload) return state.lastRun.payload;
    if (state.runningToolId === "design-formatting" && state.runningPayload) return state.runningPayload;
    if (state.activeToolId === "design-formatting" && isDesignFormattingPayload(state.lastPayload)) return state.lastPayload;
    return null;
  }

  function latestDesignFormattingOperation() {
    const payload = latestDesignFormattingPayload() || {};
    const operation = payload.operation || payload.operations?.[0] || {};
    if (operation.type) return operation;
    return state.taskMemory.lastOperation?.toolId === "design-formatting" ? state.taskMemory.lastOperation : {};
  }

  function latestSheetUrl() {
    const direct = state.activeToolId === "design-formatting" ? state.collectedInputs.targetUrl : "";
    const payload = latestDesignFormattingPayload() || {};
    const source = state.sources.find((item) => item.kind === "Google Sheet" || detectSourceType(item.url) === "sheet");
    return direct || payload.targetId || payload.targetUrl || state.taskMemory.lastSheet?.url || source?.url || "";
  }

  function latestGeneratedSheetUrl() {
    const output = state.outputs.find((item) => {
      if (!item?.url || detectSourceType(item.url) !== "sheet") return false;
      return item.type === "google-sheet" || /sheet|spreadsheet/i.test(item.title || item.description || "");
    });
    return output?.url || "";
  }

  function latestEditableSheetUrl(text = "") {
    const explicit = sheetUrlFromText(text);
    if (explicit) return explicit;
    const generated = latestGeneratedSheetUrl();
    const faqContext = state.mode === "faq" || state.activeToolId === "faq-playground" || state.taskMemory.lastToolId === "faq-playground";
    return (faqContext && generated) ? generated : (latestSheetUrl() || generated);
  }

  function latestSheetTab() {
    const payload = latestDesignFormattingPayload() || {};
    return payload.tabName || state.collectedInputs.tabName || state.taskMemory.lastSheet?.tabName || "Sheet1";
  }

  function extractColumnTransfer(text) {
    const clean = withoutUrlsForDisplay(text).replace(/[־–—]/g, "-");
    const operation = latestDesignFormattingOperation();
    const memoryColumns = state.taskMemory.lastOutputColumns || {};
    const reference = state.taskMemory.references?.it || {};
    const fallbackSource = normalizeSheetColumn(
      operation.targetCol ||
      operation.outputColumn ||
      operation.sourceColumn ||
      reference.sourceColumn ||
      memoryColumns.outputColumn ||
      memoryColumns.sourceColumn
    );
    const fallbackTarget = normalizeSheetColumn(
      operation.answerCol ||
      operation.targetColumn ||
      reference.targetColumn ||
      memoryColumns.answerColumn ||
      memoryColumns.targetColumn
    );
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
    const trimmed = clean.trim();
    const bareTargetCorrection =
      trimmed.match(/^(?:עכשיו\s*)?ל[\s-]*([A-Z]{1,3})$/i) ||
      trimmed.match(/^(?:now\s+)?(?:to|into)\s+(?:column\s*)?([A-Z]{1,3})$/i);
    const negatedBareTarget = trimmed.match(/^(?:לא|not|no)\s+([A-Z]{1,3})\s*[,;]\s*([A-Z]{1,3})$/i);
    const explicitSourceColumn = normalizeSheetColumn(sourcePatterns.map((pattern) => clean.match(pattern)?.[1]).find(Boolean));
    const explicitTargetColumn = normalizeSheetColumn(
      negatedBareTarget?.[2] ||
      bareTargetCorrection?.[1] ||
      targetPatterns.map((pattern) => clean.match(pattern)?.[1]).find(Boolean)
    );
    const sourceColumn = normalizeSheetColumn(explicitSourceColumn || fallbackSource);
    const targetColumn = normalizeSheetColumn(explicitTargetColumn || fallbackTarget);
    return { sourceColumn, targetColumn, explicitSourceColumn, explicitTargetColumn };
  }

  function extractSheetEditColumn(text) {
    const clean = withoutUrlsForDisplay(text).replace(/[־–—]/g, "-");
    const patterns = [
      /(?:column|col)\s*([A-Z]{1,3})/i,
      /(?:עמוד(?:ה|ת)|העמוד(?:ה|ת)|בעמוד(?:ה|ת)|לעמוד(?:ה|ת)|מתוך\s+עמוד(?:ה|ת))\s*([A-Z]{1,3})/i,
      /(?:^|[\s,;])(?:ב|ל|מ)[\s-]*([A-Z]{1,3})(?=\b|[\s,;.])/i
    ];
    return normalizeSheetColumn(patterns.map((pattern) => clean.match(pattern)?.[1]).find(Boolean));
  }

  function isSheetColumnTransferIntent(text) {
    if (isRemoveSourcesFromAnswersIntent(text)) return false;
    const clean = withoutUrlsForDisplay(text).toLowerCase();
    const hebrewAction = /תעביר|להעביר|העבר|תעתיק|להעתיק|העתק|תחליף|להחליף|החלף|תיקח|קח|לקחת|תכניס|להכניס|הכנס|שים|תשים|לשים|תכתוב|כתוב|לכתוב/.test(text);
    const englishAction = /replace|copy|move|transfer|write\s+back|put|insert|take\s+.*\s+from/.test(clean);
    const hasColumnSignal = /column|col\b|עמוד(?:ה|ת)|[בלמ][\s־-]*[A-Z]{1,3}\b/i.test(text);
    return ((hebrewAction || englishAction) && hasColumnSignal) || isImplicitColumnTransferFollowUp(text) || isColumnCorrectionFollowUp(text);
  }

  function isFollowUpReference(text) {
    return /\b(now|then|same|that|it|those|there|again|next)\b|עכשיו|ואז|אותו|אותה|אותם|זה|זו|זאת|שם|לשם|הזה|הזאת|הקודם|הקודמת/.test(String(text || ""));
  }

  function hasDesignFormattingMemory() {
    const operation = latestDesignFormattingOperation();
    return state.taskMemory.lastToolId === "design-formatting" &&
      Boolean(latestSheetUrl()) &&
      Boolean(operation.targetCol || operation.outputColumn || operation.sourceColumn || state.taskMemory.references?.it?.sourceColumn || state.taskMemory.lastOutputColumns?.outputColumn);
  }

  function isColumnCorrectionFollowUp(text) {
    if (!hasDesignFormattingMemory()) return false;
    const clean = withoutUrlsForDisplay(text).replace(/[־–—]/g, "-").trim();
    return /^(?:עכשיו\s*)?ל[\s-]*[A-Z]{1,3}$/i.test(clean) ||
      /^(?:now\s+)?(?:to|into)\s+(?:column\s*)?[A-Z]{1,3}$/i.test(clean) ||
      /^(?:לא|not|no)\s+[A-Z]{1,3}\s*[,;]\s*[A-Z]{1,3}$/i.test(clean);
  }

  function isImplicitColumnTransferFollowUp(text) {
    const clean = withoutUrlsForDisplay(text).toLowerCase();
    const hasTransferAction = /replace|copy|move|transfer|write\s+back|put|insert/.test(clean) ||
      /תעביר|להעביר|העבר|תעתיק|להעתיק|העתק|תחליף|להחליף|החלף|תיקח|קח|לקחת|תכניס|להכניס|הכנס|שים|תשים|לשים|תכתוב|כתוב|לכתוב/.test(text);
    if (!hasTransferAction || !isFollowUpReference(text)) return false;
    if (extractUrl(text)) return false;
    const operation = latestDesignFormattingOperation();
    return state.taskMemory.lastToolId === "design-formatting" &&
      Boolean(latestSheetUrl()) &&
      Boolean(operation.targetCol || operation.outputColumn || operation.sourceColumn || state.taskMemory.references?.it?.sourceColumn);
  }

  function hasSheetReference(text) {
    const lower = String(text || "").toLowerCase();
    const urls = extractUrlsFromText(text);
    return urls.some((url) => {
      const type = detectSourceType(url);
      return type === "sheet" || type === "folder";
    }) || /google\s*(sheet|sheets|drive)|spreadsheet|גוגל\s*שיט|גוגל\s*שיטס|גיליון|גיליונות|דרייב/.test(lower);
  }

  function isNegatedLocalFile(text) {
    return /לא\s+(?:קובץ|פייל)|לא\s+מדובר\s+בקובץ|not\s+(?:a\s+)?file|not\s+local\s+file/i.test(String(text || ""));
  }

  function isSheetEditIntent(text) {
    if (/schema|json-ld|faqpage|rich results|סכמה|סכימה/i.test(String(text || ""))) return false;
    return (hasSheetReference(text) && (hasEditWord(text) || isAnswerResearchIntent(text) || isRemoveSourcesFromAnswersIntent(text))) ||
      isGeneratedSheetEditIntent(text) ||
      isSheetColumnTransferIntent(text);
  }

  function isAnswerResearchIntent(text) {
    if (isRemoveSourcesFromAnswersIntent(text)) return false;
    const clean = String(text || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ");
    return /search answers|find answers|complete answers|fill answers|missing answers|verify answers|verified answers|source-backed|trusted sources|official sources|web search|ai answers|\[verify\]|information is currently not available/i.test(clean) ||
      /לחפש\s+תשובות|למצוא\s+תשובות|להשלים\s+תשובות|למלא\s+תשובות|תשובות\s+חסרות|תשובות\s+לא\s+זמינות|תשובות\s+מאומתות|Information is currently not available|מקורות\s+מהימנים|בעזרת\s+מקורות|בינה\s+מלאכותית|חיפוש|בוקינג|מידע\s+לא\s+זמין|לא\s+זמין|אימות|מאומת/.test(text);
  }

  function isRemoveSourcesFromAnswersIntent(text) {
    const clean = String(text || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ");
    const lower = clean.toLowerCase();
    return /(remove|delete|strip|hide|clean).{0,50}(source|sources|reference|references|citation|citations).{0,60}(answer|answers|cell|cells)?/i.test(clean) ||
      /(source|sources|reference|references|citation|citations).{0,50}(remove|deleted|stripped|hidden|gone)/i.test(clean) ||
      /(להסיר|למחוק|להעלים|להוריד|לנקות).{0,50}(מקורות|מקור|רפרנסים|ציטוטים).{0,80}(תשובות|תאים|עמודה)?/.test(clean) ||
      /(מקורות|מקור|רפרנסים|ציטוטים).{0,50}(יעלמו|ייעלמו|לא\s+יופיעו|להעלים|להסיר|למחוק|לנקות)/.test(clean) ||
      /(לא|שלא|בלי|ללא).{0,30}(יכיל|יכילו|מכיל|מכילים|יהיו|יופיעו|להכיל)?.{0,40}(קישור|קישורים|לינק|לינקים|links?|urls?).{0,40}(מקורות|מקור|sources?|references?|citations?)/i.test(lower) ||
      /(קישור|קישורים|לינק|לינקים|links?|urls?).{0,40}(מקורות|מקור|sources?|references?|citations?)/i.test(lower) ||
      /(בתשובות|בתאים|answers|cells).{0,60}(בלי|ללא|without).{0,30}(מקורות|sources|references|citations)/i.test(lower);
  }

  function isGeneratedSheetEditIntent(text) {
    if (isSheetColumnTransferIntent(text)) return false;
    if (/schema|json-ld|faqpage|rich results|סכמה|סכימה/i.test(String(text || ""))) return false;
    const clean = withoutUrlsForDisplay(text);
    const lower = clean.toLowerCase();
    const hasTarget = hasSheetReference(text) || Boolean(latestGeneratedSheetUrl() || state.taskMemory.lastSheet?.url);
    const refersToGeneratedSheet =
      hasSheetReference(text) ||
      /הקובץ|הגיליון|השיט|הטבלה|התאים|בתאים|מה\s+שיצרת|שיצרת|שנוצר|החדש|sheet|spreadsheet|cells|created|generated|that file|this file|that sheet|this sheet/i.test(lower);
    const editRequest = hasEditWord(clean) || isRemoveSourcesFromAnswersIntent(text);
    const faqContext = state.mode === "faq" || state.activeToolId === "faq-playground" || state.taskMemory.lastToolId === "faq-playground";
    return Boolean(hasTarget && editRequest && (hasSheetReference(text) || refersToGeneratedSheet || faqContext));
  }

  function isResultLocationQuestion(text) {
    if (isSheetColumnTransferIntent(text)) return false;
    const clean = String(text || "").toLowerCase();
    return /(איפה|היכן|לאן|איזו\s+עמודה|איפה\s+שמת|איפה\s+נשמר|where|which column|where did|where are|output|results)/i.test(clean) &&
      /(תשובות|תוצאה|תוצאות|שמת|נשמר|נכתבו|עמודה|answer|answers|result|results|written|put|saved)/i.test(clean);
  }

  function describeLastRunOutput(questionText = "") {
    const run = state.lastRun || {
      toolId: state.runningToolId || state.activeToolId,
      payload: state.runningPayload || state.lastPayload
    };
    const payload = run?.payload || {};
    const toolId = run?.toolId || state.activeToolId;
    const hebrew = hasHebrew(questionText) || hasHebrew(JSON.stringify(payload));

    if (toolId === "design-formatting") {
      const operation = payload.operation || payload.operations?.[0] || {};
      const tab = payload.tabName || "Sheet1";
      const targetCol = operation.targetCol || operation.outputColumn || operation.targetColumn || "עמודת הפלט שהוגדרה";
      const sourceCol = operation.answerCol || "C";
      const dry = payload.dryRun !== false;
      if (operation.type === "faq_answer_research") {
        return hebrew
          ? [
              dry ? "זו היתה בדיקה מקדימה, אז עוד לא נכתבו תשובות חדשות לגיליון." : "התשובות החדשות נכתבו לגיליון לפי האישור שלך.",
              `מיקום: טאב ${tab}, עמודה ${targetCol}.`,
              operation.replaceOriginal ? `זה מחליף את עמודת התשובות המקורית (${sourceCol}).` : `זה משאיר את עמודת התשובות המקורית (${sourceCol}) ומוסיף תשובה מחקרית בעמודה ${targetCol}.`,
              "אם תרצי להחליף את המקור במקום להוסיף עמודה חדשה, כתבי: להחליף בעמודת התשובות המקורית."
            ].join("\n")
          : [
              dry ? "That was a dry run, so no new answers were written yet." : "Per the confirmed payload, the new answers are written to the Sheet.",
              `Location: tab ${tab}, column ${targetCol}.`,
              operation.replaceOriginal ? `It replaces the original answer column (${sourceCol}).` : `It keeps the original answer column (${sourceCol}) and writes researched answers to ${targetCol}.`
            ].join("\n");
      }
      if (operation.type === "replace_column_when_value") {
        const source = operation.sourceColumn || "עמודת המקור";
        const target = operation.targetColumn || "עמודת היעד";
        return hebrew
          ? [
              dry ? "זו היתה בדיקה מקדימה, אז עוד לא הוחלפו ערכים בפועל." : "הערכים הועתקו לגיליון לפי האישור שלך.",
              `מיקום: טאב ${tab}.`,
              `פעולה: כל ערך שקיים בעמודה ${source} מחליף את הערך המקביל בעמודה ${target}.`
            ].join("\n")
          : [
              dry ? "That was a dry run, so no values were changed yet." : "Per the confirmed payload, values were copied in the Sheet.",
              `Location: tab ${tab}.`,
              `Action: every value present in column ${source} replaces the matching row in column ${target}.`
            ].join("\n");
      }
      return hebrew
        ? `הפעולה האחרונה היתה ${designOperationLabel(operation, true)}. השינויים מיועדים לטאב ${tab}${targetCol ? `, עמודה ${targetCol}` : ""}.`
        : `The last run was ${operation.type || "a sheet operation"}. Output/changes are configured for tab ${tab}${targetCol ? `, column ${targetCol}` : ""}.`;
    }

    if (state.outputs.length) {
      const latest = state.outputs[0];
      return hebrew
        ? `הפלט האחרון שמור בצד ימין תחת הקבצים שנוצרו: ${latest.title}${latest.url ? ` — ${latest.url}` : ""}.`
        : `The latest output is in Generated outputs: ${latest.title}${latest.url ? ` — ${latest.url}` : ""}.`;
    }

    return hebrew
      ? "עוד אין לי פלט שמור להרצה האחרונה. אם זו היתה בדיקה מקדימה, היא רק הציגה תוכנית ולא כתבה לגיליון."
      : "I do not have a saved output for the last run yet. If it was a dry run, it only previewed the plan and did not write to the Sheet.";
  }

  function isFileIntent(text) {
    const lower = String(text || "").toLowerCase();
    const path = extractFilePath(text);
    if (!path && (isNegatedLocalFile(text) || hasSheetReference(text))) return false;
    const hasFileWord = /קובץ(?:\s+מקומי|\s+קוד)?|קבצים|file|files|repo|code|html|javascript|css|typescript|\.html|\.js|\.css|\.ts|\.tsx|\.json|\.md/.test(lower);
    return Boolean(path) || (hasFileWord && hasEditWord(text));
  }

  function isFaqIntent(text) {
    const lower = String(text || "").toLowerCase();
    if (isFaqImplementationAuditIntent(text)) return false;
    return /faq|שאלות ותשובות|שאלות|מלון|אורחים|hotel|hospitality/.test(lower) &&
      !/schema|json-ld|סכמה|סכימה|audit|crawler|סריקה|בדיקת|לבדוק|בדיקה|הטמעה|יישום|implementation|תואם/i.test(lower) &&
      !isSheetColumnTransferIntent(text) &&
      !isFileIntent(text);
  }

  function isFaqImplementationAuditIntent(text) {
    const lower = String(text || "").toLowerCase();
    const mentionsFaq = /faq|faqpage|questions?\s+answers?|שאלות\s*(?:ו)?תשובות|שאלות|תשובות/.test(lower);
    if (!mentionsFaq) return false;
    const wantsCheck = /לבדוק|לבחון|בחינה|בדיקה|ביקורת|audit|check|verify|validation|validate|inspect|review|תואם|התאמה|מול|כנגד|השוואה/i.test(lower);
    const implementation = /הטמעה|הוטמע|הוטמעו|הוטמעה|מוטמע|מוטמעת|מוטמעים|יישום|implementation|implemented|schema|json-ld|סכמה|סכימה|faqpage|rich results|אתר|עמוד|website|site|page/i.test(lower);
    return wantsCheck && implementation;
  }

  function scoreTool(tool, text) {
    const lower = String(text || "").toLowerCase();
    let score = 0;
    (tool.intentHints || tool.keywords || []).forEach((hint) => {
      if (lower.includes(String(hint).toLowerCase())) score += String(hint).length > 8 ? 3 : 2;
    });
    if (tool.id === "site-ai-faq-audit" && /faq.*audit|audit.*faq|בדיקת.*faq|faq.*schema.*audit/i.test(lower)) score += 8;
    if (tool.id === "site-ai-faq-audit" && isFaqImplementationAuditIntent(text)) score += 18;
    if (tool.id === "site-ai-audit" && /site audit|audit site|crawler|crawl|סריקה|בדיקת אתר/i.test(lower)) score += 7;
    if (tool.id === "schema-builder" && /schema|json-ld|סכמה|סכימה/i.test(lower)) score += 8;
    if (tool.id === "translate-demo" && /translate|translation|localize|localise|תרגום|תרגם|תרגמי|תרגמו|לתרגם/i.test(lower)) score += 8;
    if (tool.id === "meta-tags" && /meta|title tag|description|h1|seo|מטא|טייטלים/i.test(lower)) score += 7;
    if (tool.id === "client-reports" && /client report|dashboard|performance report|monthly report|kpi|analytics report|ga4|google analytics|דוח לקוח|דוחות לקוח|דשבורד|ביצועים|אנליטיקס|גוגל אנליטיקס/i.test(lower)) score += 9;
    if (tool.id === "sheet-utilities" && /sheet utilities|vlookup|lookup copy|cross.?check|coverage report|copy columns|folder to master|work file|כלי גיליון|הצלבה|כיסוי|להעתיק עמודות/i.test(lower)) score += 9;
    if (tool.id === "design-formatting" && /format|formatting|edit sheet|sheet edit|client notes|search answers|find answers|complete answers|missing answers|עיצוב|עריכת גיליון|עריכת גוגל|הערות לקוח|לחפש תשובות|למצוא תשובות|להשלים תשובות|תשובות חסרות|מקורות/i.test(lower)) score += 6;
    if (tool.id === "design-formatting" && /schema|json-ld|faqpage|rich results|סכמה|סכימה/i.test(lower)) score -= 8;
    if (tool.id === "design-formatting" && isSheetEditIntent(text)) score += 10;
    if (tool.id === "design-formatting" && isSheetColumnTransferIntent(text)) score += 14;
    if (tool.id === "design-formatting" && hasSheetReference(text) && isAnswerResearchIntent(text)) score += 12;
    if (tool.id === "faq-playground" && isFaqIntent(text)) score += 8;
    if (tool.id === "faq-playground" && isFaqImplementationAuditIntent(text)) score -= 14;
    if (tool.id === "file-draft" && isFileIntent(text)) score += 10;
    return score;
  }

  function detectToolIntent(text) {
    const tools = manifest.tools || [];
    const ranked = tools
      .map((tool) => ({ tool, score: scoreTool(tool, text) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.tool || null;
  }

  function subjectList(value = state.answers.subjects) {
    return String(value || "")
      .split(/\n|,|;|\s+\+\s+/)
      .map(compact)
      .filter(Boolean)
      .slice(0, 10);
  }

  function cleanSubject(value) {
    const cleaned = compact(value)
      .replace(/\bsource\s*:.*/i, "")
      .replace(/\b(?:primary\s+)?source\b.*/i, "")
      .replace(/\b(?:audience|language|style|tone|qa|depth|count|words?\s+to\s+avoid|forbidden\s+phrases?)\s*:.*/i, "")
      .replace(/(?:בלי|לא)\s+להשתמש\s+(?:במילים|בביטויים|במונחים)?.*$/i, "")
      .replace(/(?:מילים|ביטויים)\s+(?:אסורות|שלא להשתמש בהן|להימנע מהן).*$/i, "")
      .replace(/\b(?:do\s+not\s+use|don't\s+use|avoid\s+these)\b.*$/i, "")
      .replace(/\s+\b(?:in|to)\s+(?:english|hebrew|german|french|spanish|italian|dutch|polish|russian|chinese|arabic)\b.*$/i, "")
      .replace(/[?؟]\s*(?:אנגלית|עברית|גרמנית|צרפתית|ספרדית|english|hebrew|german|french|spanish)(?:\s+(?:uk|us|gb|usa|בריטית|אמריקאית))?\s*$/i, "")
      .replace(/\s+(?:אנגלית|עברית|גרמנית|צרפתית|ספרדית|english|hebrew|german|french|spanish)(?:\s+(?:uk|us|gb|usa|בריטית|אמריקאית))?\s*$/i, "")
      .split(/\s+(?:לקהל|קהל|עבור קהל|for audience|for guests|for customers|for tourists)(?:\s|$)/i)[0]
      .replace(/^(hotel|property|business|product|service|מלון|עסק|מוצר|שירות)\s+/i, "")
      .replace(/[.!?]+$/g, "")
      .trim();
    if (/^(and\s+)?(?:abroad|israel|international|tourists?|guests?|source)$/i.test(cleaned)) return "";
    return cleaned;
  }

  const knownFaqSubjectAliases = [
    {
      official: "Leonardo Hotel Berlin",
      sourceUrl: "https://www.leonardo-hotels.com/berlin/leonardo-hotel-berlin",
      sourceTitle: "Leonardo Hotel Berlin official page",
      aliases: [
        "Leonardo Hotel Berlin",
        "מלון לאונרדו ברלין",
        "לאונרדו ברלין",
        "מלון לאונדרו ברלין",
        "לאונדרו ברלין",
        "מלון ליאונרדו ברלין",
        "ליאונרדו ברלין"
      ]
    }
  ];

  function normalizeFaqSubjectLookupText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0591-\u05c7]/g, "")
      .replace(/[׳'"`´’‘]/g, "")
      .replace(/\b(?:faq|questions?|answers?|questionnaire|builder|page)\b/gi, " ")
      .replace(/\b(?:english|hebrew|german|french|spanish|uk|gb|us|usa|language|locale)\b/gi, " ")
      .replace(/(?:אנגלית|עברית|גרמנית|צרפתית|ספרדית|שפה|בריטית|אמריקאית)/gi, " ")
      .replace(/(?:לאונדרו|ליאונדרו|ליאונרדו|ליאונרדו)/gi, "לאונרדו")
      .replace(/(?:^|\s)(?:מלון|המלון|בית מלון)(?=\s|$)/g, " ")
      .replace(/[^a-z0-9\u0590-\u05ff]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function knownFaqOfficialSubject(value) {
    return knownFaqSubjectRecord(value)?.official || "";
  }

  function knownFaqSubjectRecord(value) {
    const lookup = normalizeFaqSubjectLookupText(value);
    if (!lookup) return null;
    for (const entry of knownFaqSubjectAliases) {
      const candidates = [entry.official, ...entry.aliases];
      if (candidates.some((candidate) => normalizeFaqSubjectLookupText(candidate) === lookup)) return entry;
    }
    if (lookup.includes("לאונרדו") && lookup.includes("ברלין")) return knownFaqSubjectAliases[0];
    return null;
  }

  function detectScope(text) {
    const lower = String(text || "").toLowerCase();
    if (/\b(car|cars|vehicle|vehicles|automotive|trim|trims|hybrid|ev|electric|suv|sedan|engine|lease|leasing)\b/.test(lower) || /רכב|מכונית|דגם|היברידי|חשמלי/.test(text)) return "vehicle";
    if (/\b(service|product|software|platform|saas|app)\b/.test(lower) || /שירות|מוצר|תוכנה|פלטפורמה/.test(text)) return "service";
    if (/\b(local|business|clinic|restaurant|shop|store)\b/.test(lower) || /עסק|מסעדה|חנות|קליניקה|מקומי/.test(text)) return "local";
    if (/\b(hotel|property|guest|booking)\b/.test(lower) || /מלון|אורחים|הזמנה|תיירים/.test(text)) return "hotel";
    return "";
  }

  function detectAudience(text) {
    const lower = String(text || "").toLowerCase();
    if (/israel|abroad|international|tourists|תייר|ישראל|חו.?ל|מחו.?ל/.test(lower)) {
      return "Tourists and guests from Israel and abroad who are researching before booking or arrival.";
    }
    if (/guest|visitor|booking|arrival|אורח|אורחים|הזמנה/.test(lower)) return presetAudiences.hotel;
    if (/customer|buyer|lead|client|לקוח|לקוחות|רוכש|קונים/.test(lower)) return presetAudiences.service;
    return "";
  }

  function detectLanguage(text) {
    const lower = String(text || "").toLowerCase();
    if (/עברית|hebrew|\bhe\b/.test(lower)) return "Hebrew";
    if (/english us|american/.test(lower)) return "English (US)";
    if (/english|אנגלית|\ben\b/.test(lower)) return "English (UK)";
    if (/german|deutsch|גרמנית|\bde\b/.test(lower)) return "German";
    if (/french|français|צרפתית|\bfr\b/.test(lower)) return "French";
    if (/spanish|español|ספרדית|\bes\b/.test(lower)) return "Spanish";
    return "";
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

  function appendForbiddenPhrases(phrases) {
    const existing = splitForbiddenPhrases(state.answers.forbiddenPhrases);
    const seen = new Set(existing.map((item) => item.toLowerCase()));
    for (const phrase of phrases || []) {
      const clean = compact(phrase);
      const key = clean.toLowerCase();
      if (clean && !seen.has(key)) {
        existing.push(clean);
        seen.add(key);
      }
    }
    state.answers.forbiddenPhrases = existing.join("\n");
  }

  function forbiddenPhrasesRulesText() {
    const phrases = splitForbiddenPhrases(state.answers.forbiddenPhrases);
    if (!phrases.length) return "No extra forbidden words or phrases.";
    return `Do not use these words or phrases anywhere in the generated FAQ unless they are part of a required proper noun: ${phrases.join(", ")}.`;
  }

  function forbiddenPhrasesLabel() {
    const phrases = splitForbiddenPhrases(state.answers.forbiddenPhrases);
    return phrases.length ? phrases.join(", ") : "";
  }

  function extractSubjects(text) {
    if (manifest.helpers?.extractSubjects) return manifest.helpers.extractSubjects(text);
    return [];
  }

  function parseSubjectAnswer(text) {
    const manualList = subjectList(text);
    if (manualList.length > 1) return manualList.map(compact).filter(Boolean).join("\n");
    const inferred = extractSubjects(text);
    if (inferred.length) return inferred.map(cleanSubject).filter(Boolean).join("\n");
    const direct = String(text || "").match(/(?:הנושא הוא|השם הוא|שם המלון הוא|subject is|name is)\s+(.{2,120})/i)?.[1];
    if (direct) return cleanSubject(direct);
    return subjectList(text).map(cleanSubject).filter(Boolean).join("\n") || cleanSubject(text) || compact(text);
  }

  function syncConversationFromFaq() {
    state.activeIntent = "faq";
    state.activeToolId = "faq-playground";
    state.activeStep = state.step;
    state.collectedInputs = {
      subjects: subjectList(),
      subjectRaw: state.answers.subjectRaw || "",
      workflowType: state.answers.scope,
      audience: state.answers.audienceConfirmed ? audienceText() : "",
      sourceUrl: state.answers.sourceUrl,
      language: state.answers.languageConfirmed ? state.answers.language : "",
      count: state.answers.countConfirmed ? state.answers.count : "",
      forbiddenPhrases: state.answers.forbiddenPhrases || "",
      categories: state.answers.categoriesConfirmed ? faqCategoryValues() : [],
      categoryCounts: state.answers.categoryCountsConfirmed ? state.answers.categoryCounts : "",
      qaMode: state.answers.qaConfirmed ? state.answers.qaMode : "",
      style: state.answers.styleConfirmed ? state.answers.style : "",
      questionGuidance: state.answers.questionGuidanceConfirmed ? state.answers.questionGuidance : "",
      answerGuidance: state.answers.answerGuidanceConfirmed ? state.answers.answerGuidance : "",
      extraGuidance: state.answers.extraGuidance
    };
    state.missingInputs = completionItems().filter(([, done]) => !done).map(([label]) => label);
    state.readyToRun = state.step === "ready";
    state.lastPayload = state.readyToRun ? buildPayload() : null;
  }

  function applyInference(text) {
    const inferredScope = detectScope(text);
    const inferredSubjects = extractSubjects(text);
    const inferredAudience = detectAudience(text);
    const inferredLanguage = detectLanguage(text);
    const inferredForbiddenPhrases = extractForbiddenPhrases(text);
    const url = extractUrl(text);

    if (inferredScope && !state.answers.scope) state.answers.scope = inferredScope;
    if (inferredSubjects.length && !state.answers.subjects) {
      state.answers.subjects = inferredSubjects.map(cleanSubject).filter(Boolean).join("\n");
      state.answers.subjectRaw = text;
    }
    if (inferredAudience) {
      state.answers.audience = inferredAudience;
      state.answers.audienceConfirmed = true;
    }
    if (inferredLanguage) {
      state.answers.language = inferredLanguage;
      state.answers.languageConfirmed = true;
    }
    if (inferredForbiddenPhrases.length) {
      appendForbiddenPhrases(inferredForbiddenPhrases);
    }
    if (url) {
      state.answers.sourceMode = "url";
      state.answers.sourceUrl = url;
      state.answers.sourceInstructions = `Use this source as the primary factual source: ${url}. If a fact is missing, mark it as Needs source confirmation.`;
      state.answers.sourceConfirmed = true;
      recordSource(url, "FAQ source", "faq-playground");
    }
    syncConversationFromFaq();
  }

  function quickReplyVariant(reply = {}) {
    if (reply.primary === true || reply.variant === "primary") return "primary";
    if (reply.primary === false) return reply.variant || "";
    if (reply.variant) return reply.variant;
    const value = String(reply.value || "");
    if (/^(schema|meta):run:/.test(value)) return "primary";
    if (["run", "run-tool", "tool:confirm-run", "format:dry-run", "format:live-run"].includes(value)) return "primary";
    return "";
  }

  function shouldEchoQuickReply(reply = {}) {
    if (reply.echo === false) return false;
    if (reply.echo === true) return true;
    const value = String(reply.value || "");
    return !(
      value === "run" ||
      value === "run-tool" ||
      value === "tool:confirm-run" ||
      value === "open-tool" ||
      value === "review" ||
      value === "review-prompts" ||
      value === "reset" ||
      value.startsWith("start:") ||
      /(?:^|[-:])done$/.test(value) ||
      /(?:^|:)back$/.test(value) ||
      /(?:^|:)clear$/.test(value) ||
      /(?:^|:)recommended$/.test(value)
    );
  }

  function quickReplyClass(reply = {}) {
    return [
      "quick-reply",
      reply.selected ? "is-selected" : "",
      quickReplyVariant(reply) === "primary" ? "is-primary" : ""
    ].filter(Boolean).join(" ");
  }

  function setQuickReplies(replies = []) {
    els.quickReplies.innerHTML = replies.map((reply) => `
      <button class="${quickReplyClass(reply)}" type="button" dir="${messageDir(reply.label)}" data-reply-value="${escapeHtml(reply.value)}" data-reply-echo="${shouldEchoQuickReply(reply) ? "true" : "false"}" aria-pressed="${reply.selected ? "true" : "false"}">
        ${escapeHtml(reply.label)}
      </button>
    `).join("");
    scrollChatToLatest();
  }

  function localizedPresetLabel(scope) {
    return prefersHebrew() ? (presetLabelsHe[scope] || scope || "") : (presetLabels[scope] || scope || "");
  }

  function localizedAudience(value) {
    if (!value) return "";
    const values = String(value).split(/\n|\|/).map(compact).filter(Boolean);
    const allOptions = Object.values(audienceOptionsByScope).flat();
    return values.map((item) => {
      const match = allOptions.find((option) => option.value === item || option.id === item);
      if (match) return prefersHebrew() ? match.he : match.en;
      return prefersHebrew() ? (presetAudienceLabelsHe.get(item) || item) : item;
    }).join(prefersHebrew() ? " + " : " + ");
  }

  function faqAudienceOptions() {
    return audienceOptionsByScope[state.answers.scope || "hotel"] || audienceOptionsByScope.hotel;
  }

  function faqAudienceValues(value = state.answers.audience) {
    if (!value) return [];
    const values = String(value).split(/\n|\|/).map(compact).filter(Boolean);
    return values.length ? values : [];
  }

  function faqAudienceSet() {
    return new Set(faqAudienceValues());
  }

  function setFaqAudienceValues(values) {
    state.answers.audience = Array.from(new Set(values.filter(Boolean))).join("\n");
  }

  function audienceText() {
    return state.answers.audience || presetAudiences[state.answers.scope || "hotel"] || "";
  }

  function faqAudienceReplies() {
    const selected = faqAudienceSet();
    return [
      ...faqAudienceOptions().map((item) => ({
        label: `${selected.has(item.value) ? "✓ " : ""}${prefersHebrew() ? item.he : item.en}`,
        value: `audience-toggle:${item.id}`,
        selected: selected.has(item.value),
        echo: false
      })),
      { label: prefersHebrew() ? "אכתוב בעצמי" : "I’ll write it", value: "hint:custom-audience" },
      clearReply("audience-clear"),
      backReply(),
      { label: prefersHebrew() ? "להמשיך" : "Continue", value: "audience-done", echo: false }
    ];
  }

  function refreshFaqAudienceReplies() {
    state.step = "audience";
    state.activeStep = "audience";
    syncConversationFromFaq();
    setQuickReplies(faqAudienceReplies());
    renderWorkspace();
  }

  function askFaqAudience(prefix = "") {
    ask("audience", [prefix, prefersHebrew() ? "למי זה מיועד? אפשר לבחור כמה קהלים ואז להמשיך." : "Who is it for? You can choose more than one audience, then continue."].filter(Boolean).join("\n\n"), faqAudienceReplies());
  }

  function localizedLanguageLabel(value) {
    const labels = {
      "English (UK)": prefersHebrew() ? "אנגלית UK" : "English UK",
      "English (US)": prefersHebrew() ? "אנגלית US" : "English US",
      Hebrew: prefersHebrew() ? "עברית" : "Hebrew",
      German: prefersHebrew() ? "גרמנית" : "German",
      French: prefersHebrew() ? "צרפתית" : "French",
      Spanish: prefersHebrew() ? "ספרדית" : "Spanish"
    };
    return labels[value] || value || "";
  }

  function localizedLanguageCode(code) {
    const option = languageOptions.find((item) => item.code === code);
    return option ? (prefersHebrew() ? option.he : option.en) : (code || "");
  }

  function localizedLanguageCodes(value) {
    return manifestSplitList(value)
      .map(localizedLanguageCode)
      .filter(Boolean)
      .join(prefersHebrew() ? " + " : " + ");
  }

  function toolLanguageKey() {
    return state.pendingQuestion?.key || (state.activeToolId === "translate-demo" ? "targetLangs" : "languages");
  }

  function toolLanguageValues(key = toolLanguageKey()) {
    return manifestSplitList(state.collectedInputs[key]);
  }

  function setToolLanguageValues(key, values) {
    state.collectedInputs[key] = Array.from(new Set(values.filter(Boolean)));
  }

  function toolLanguageReplies(key = toolLanguageKey()) {
    const selected = new Set(toolLanguageValues(key));
    return [
      ...languageOptions.slice(0, 7).map((item) => ({
        label: `${selected.has(item.code) ? "✓ " : ""}${prefersHebrew() ? item.he : item.en}`,
        value: `lang-toggle:${item.code}`,
        selected: selected.has(item.code),
        echo: false
      })),
      { label: prefersHebrew() ? "אכתוב שפות" : "I’ll type languages", value: "hint:custom-languages" },
      clearReply("lang-clear"),
      backReply(),
      { label: prefersHebrew() ? "להמשיך" : "Continue", value: "lang-done", echo: false }
    ];
  }

  function refreshToolLanguageReplies(key = toolLanguageKey()) {
    state.step = "toolField";
    state.activeStep = key;
    state.pendingQuestion = { toolId: state.activeToolId, key };
    updateToolMissingInputs();
    setQuickReplies(toolLanguageReplies(key));
    renderWorkspace();
  }

  function askToolLanguages(tool, field, prefix = "") {
    const question = field.key === "targetLangs"
      ? (prefersHebrew() ? "לאילו שפות יעד לתרגם? אפשר לבחור כמה ואז להמשיך." : "Which target languages should I create? You can choose more than one, then continue.")
      : (prefersHebrew() ? "באילו שפות להשתמש? אפשר לבחור כמה ואז להמשיך." : "Which languages should I use? You can choose more than one, then continue.");
    ask("toolField", [prefix, question].filter(Boolean).join("\n\n"), toolLanguageReplies(field.key));
  }

  function localizedQaLabel(value = state.answers.qaMode) {
    const checks = faqQaChecks(value);
    if (!checks.size) return prefersHebrew() ? "ללא QA" : "No QA";
    return Array.from(checks)
      .map((id) => qaCheckLabels[id]?.[prefersHebrew() ? "he" : "en"] || id)
      .join(prefersHebrew() ? " + " : " + ");
  }

  function faqQaOptions() {
    return ["duplicates", "sources", "writing"].map((id) => ({
      id,
      label: qaCheckLabels[id]?.[prefersHebrew() ? "he" : "en"] || id
    }));
  }

  function faqQaChecks(value = state.answers.qaMode) {
    if (!value || value === "none") return new Set();
    return new Set(String(value).split("|").filter(Boolean));
  }

  function setFaqQaChecks(checks) {
    const ordered = faqQaOptions().map((item) => item.id).filter((id) => checks.has(id));
    state.answers.qaMode = ordered.length ? ordered.join("|") : "none";
  }

  function faqQaReplies() {
    const checks = faqQaChecks();
    return [
      ...faqQaOptions().map((item) => ({
        label: `${checks.has(item.id) ? "✓ " : ""}${item.label}`,
        value: `qa-toggle:${item.id}`,
        selected: checks.has(item.id),
        echo: false
      })),
      { label: prefersHebrew() ? "בלי QA" : "No QA", value: "qa:none", echo: false },
      clearReply("qa-clear"),
      backReply(),
      { label: prefersHebrew() ? "להמשיך" : "Continue", value: "qa-done", echo: false }
    ];
  }

  function refreshFaqQaReplies() {
    state.step = "qa";
    state.activeStep = "qa";
    syncConversationFromFaq();
    setQuickReplies(faqQaReplies());
    renderWorkspace();
  }

  function askFaqQa(prefix = "") {
    ask("qa", [prefix, prefersHebrew() ? "אילו בדיקות להריץ אחרי כתיבת התשובות? אפשר לבחור כמה ואז להמשיך." : "Which checks should run after the answers are written? Choose any, then continue."].filter(Boolean).join("\n\n"), faqQaReplies());
  }

  function styleValues(value = state.answers.style) {
    if (!value) return [];
    return String(value).split(/\n|\|/).map(compact).filter(Boolean);
  }

  function styleSet() {
    return new Set(styleValues());
  }

  function setStyleValues(values) {
    state.answers.style = Array.from(new Set(values.filter(Boolean))).join("\n");
  }

  function localizedStyleLabel(value = state.answers.style) {
    const values = styleValues(value);
    if (!values.length) return "";
    return values.map((item) => {
      const match = styleOptions.find((option) => option.value === item || option.id === item);
      return match ? (prefersHebrew() ? match.he : match.en) : item;
    }).join(prefersHebrew() ? " + " : " + ");
  }

  function styleText() {
    return state.answers.style || "Warm, concise, reliable.";
  }

  function questionGuidanceText() {
    const values = guidanceValues("questionGuidance", questionGuidanceOptions);
    return values.length ? values.map((item) => `- ${item}`).join("\n") : "- Use the core research rules only.";
  }

  function answerGuidanceText() {
    const values = guidanceValues("answerGuidance", answerGuidanceOptions);
    return values.length ? values.map((item) => `- ${item}`).join("\n") : "- Use the core answer rules only.";
  }

  function faqStyleReplies() {
    const selected = styleSet();
    return [
      ...styleOptions.map((item) => ({
        label: `${selected.has(item.value) ? "✓ " : ""}${prefersHebrew() ? item.he : item.en}`,
        value: `style-toggle:${item.id}`,
        selected: selected.has(item.value),
        echo: false
      })),
      { label: prefersHebrew() ? "אכתוב דגשים" : "I’ll write guidance", value: "style:custom" },
      clearReply("style-clear"),
      backReply(),
      { label: prefersHebrew() ? "להמשיך" : "Continue", value: "style-done", echo: false }
    ];
  }

  function refreshFaqStyleReplies() {
    state.step = "style";
    state.activeStep = "style";
    syncConversationFromFaq();
    setQuickReplies(faqStyleReplies());
    renderWorkspace();
  }

  function askFaqStyle(prefix = "") {
    ask("style", [prefix, prefersHebrew() ? "איזה סגנון כתיבה לשמור בתשובות? אפשר לבחור כמה ואז להמשיך." : "Which writing style should the answers use? Choose any, then continue."].filter(Boolean).join("\n\n"), faqStyleReplies());
  }

  function parseCategoryOption(line) {
    const clean = compact(line);
    const [titleRaw, ...descParts] = clean.split(":");
    const title = compact(titleRaw || clean);
    const description = compact(descParts.join(":"));
    return {
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `cat-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description,
      value: description ? `${title}: ${description}` : title
    };
  }

  function faqCategoryOptions() {
    const scope = state.answers.scope || "hotel";
    const audience = audienceText();
    const options = (categoryPlans[scope] || categoryPlans.hotel).map(parseCategoryOption);
    const extras = [];
    if (/famil|משפח/i.test(audience)) {
      extras.push(parseCategoryOption("Family fit: room suitability, policies, food, access, practical stay details."));
    }
    if (/international|tourist|חו.?ל|תייר/i.test(audience)) {
      extras.push(parseCategoryOption("International guest fit: arrival, language, local transport, booking terms and location confidence."));
    }
    if (/existing|in-house|בזמן השהות|קיימ/i.test(audience)) {
      extras.push(parseCategoryOption("During-use support: services, troubleshooting, changes, support and next steps."));
    }
    const seen = new Set();
    return [...options, ...extras].filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }

  function faqCategoryValues(value = state.answers.categories) {
    return String(value || "").split(/\n|\|/).map(compact).filter(Boolean);
  }

  function setFaqCategoryValues(values) {
    state.answers.categories = Array.from(new Set(values.filter(Boolean))).join("\n");
  }

  function ensureFaqCategoryDefaults() {
    if (faqCategoryValues().length) return;
    setFaqCategoryValues(faqCategoryOptions().map((item) => item.value));
  }

  function categoryTitle(value) {
    return parseCategoryOption(value).title;
  }

  function localizedCategoryLabel(value = state.answers.categories) {
    const values = faqCategoryValues(value);
    return values.length ? values.map(categoryTitle).join(prefersHebrew() ? " + " : " + ") : "";
  }

  function faqCategoryReplies() {
    ensureFaqCategoryDefaults();
    const selected = new Set(faqCategoryValues());
    const options = faqCategoryOptions();
    const allSelected = options.length > 0 && options.every((item) => selected.has(item.value));
    return [
      ...options.map((item) => ({
        label: `${selected.has(item.value) ? "✓ " : ""}${item.title}`,
        value: `category-toggle:${item.id}`,
        selected: selected.has(item.value),
        echo: false
      })),
      { label: `${allSelected ? "✓ " : ""}${prefersHebrew() ? "כל הקטגוריות" : "All categories"}`, value: "categories:all", selected: allSelected, echo: false },
      { label: prefersHebrew() ? "בחירת ברירת מחדל" : "Recommended categories", value: "categories:recommended", echo: false },
      { label: prefersHebrew() ? "לנקות בחירה" : "Clear selection", value: "categories:clear", echo: false },
      { label: prefersHebrew() ? "אכתוב קטגוריות" : "I’ll write categories", value: "categories:custom" },
      backReply(),
      { label: prefersHebrew() ? "להמשיך" : "Continue", value: "categories-done", echo: false }
    ];
  }

  function refreshFaqCategoryReplies() {
    state.step = "categories";
    state.activeStep = "categories";
    syncConversationFromFaq();
    setQuickReplies(faqCategoryReplies());
    renderWorkspace();
  }

  function askFaqCategories(prefix = "") {
    ensureFaqCategoryDefaults();
    ask("categories", [prefix, prefersHebrew()
      ? "יצרתי קטגוריות מוצעות לפי סוג ה־FAQ, הנושא והקהל. באילו קטגוריות להשתמש? אפשר לבחור כמה ואז להמשיך."
      : "I generated suggested categories from the FAQ type, subject and audience. Which categories should I use? Choose one or more, then continue."].filter(Boolean).join("\n\n"), faqCategoryReplies());
  }

  function totalQuestionTargetText() {
    if (state.answers.count === "quality_first") return "quality-first, no fixed total";
    return state.answers.count || "20-30";
  }

  function categoryAllocationText() {
    return state.answers.categoryCounts || `Total target: ${totalQuestionTargetText()}. Allocate across selected categories according to real demand, source confidence and user decision importance. Keep the sum within the selected total range.`;
  }

  function localizedCategoryCountsLabel(value = state.answers.categoryCounts) {
    const text = String(value || "");
    if (/stronger real-user demand|search intent/i.test(text)) return prefersHebrew() ? "לפי ביקוש וכוונת חיפוש" : "By demand and intent";
    if (/evenly|Balanced/i.test(text)) return prefersHebrew() ? "חלוקה מאוזנת" : "Balanced split";
    if (/decision-making|booking, pricing/i.test(text)) return prefersHebrew() ? "עדיפות לנושאי החלטה" : "Prioritize decision topics";
    if (!text) return "";
    return text.length > 100 ? `${text.slice(0, 100)}...` : text;
  }

  function askFaqCategoryCounts(prefix = "") {
    const total = totalQuestionTargetText();
    const categories = localizedCategoryLabel() || (prefersHebrew() ? "הקטגוריות שנבחרו" : "selected categories");
    ask("categoryCounts", [prefix, prefersHebrew()
      ? `איך לחלק את ${total} השאלות בין הקטגוריות שנבחרו?\n${categories}`
      : `How should the ${total} questions be split across the selected categories?\n${categories}`].filter(Boolean).join("\n\n"), [
      { label: prefersHebrew() ? "לפי ביקוש וכוונת חיפוש" : "By demand and intent", value: "category-counts:demand", primary: true },
      { label: prefersHebrew() ? "חלוקה מאוזנת" : "Balanced split", value: "category-counts:balanced" },
      { label: prefersHebrew() ? "לתת עדיפות להחלטת רכישה" : "Prioritize decision topics", value: "category-counts:decision" },
      { label: prefersHebrew() ? "אכתוב ידנית" : "I’ll write it", value: "category-counts:custom" },
      backReply()
    ]);
  }

  function guidanceValues(key, options) {
    const value = state.answers[key];
    if (value === "__none__") return [];
    if (!value) return options.map((item) => item.value);
    return String(value).split(/\n|\|/).map(compact).filter(Boolean);
  }

  function setGuidanceValues(key, values) {
    state.answers[key] = Array.from(new Set(values.filter(Boolean))).join("\n");
  }

  function guidanceLabel(key, options) {
    const selected = guidanceValues(key, options);
    return selected.map((item) => {
      const match = options.find((option) => option.value === item || option.id === item);
      return match ? (prefersHebrew() ? match.he : match.en) : item;
    }).join(prefersHebrew() ? " + " : " + ");
  }

  function guidanceReplies(key, options, doneValue, clearValue, customValue) {
    const selected = new Set(guidanceValues(key, options));
    return [
      ...options.map((item) => ({
        label: `${selected.has(item.value) ? "✓ " : ""}${prefersHebrew() ? item.he : item.en}`,
        value: `${key}-toggle:${item.id}`,
        selected: selected.has(item.value),
        echo: false
      })),
      { label: prefersHebrew() ? "אכתוב דגשים" : "I’ll write guidance", value: customValue },
      clearReply(clearValue),
      backReply(),
      { label: prefersHebrew() ? "להמשיך" : "Continue", value: doneValue, echo: false }
    ];
  }

  function askQuestionGuidance(prefix = "") {
    ask("questionGuidance", [prefix, prefersHebrew()
      ? "אילו דגשים להוסיף לפרומפט השאלות? זה לא מחליף את הפרומפט, רק מוסיף הנחיות מחקר וניסוח."
      : "What guidance should I add to the question prompt? This does not replace the prompt; it adds research and wording guidance."].filter(Boolean).join("\n\n"), guidanceReplies("questionGuidance", questionGuidanceOptions, "question-guidance-done", "question-guidance-clear", "question-guidance:custom"));
  }

  function refreshQuestionGuidanceReplies() {
    state.step = "questionGuidance";
    state.activeStep = "questionGuidance";
    syncConversationFromFaq();
    setQuickReplies(guidanceReplies("questionGuidance", questionGuidanceOptions, "question-guidance-done", "question-guidance-clear", "question-guidance:custom"));
    renderWorkspace();
  }

  function askAnswerGuidance(prefix = "") {
    ask("answerGuidance", [prefix, prefersHebrew()
      ? "אילו דגשים להוסיף לפרומפט התשובות? זה מעבר לסגנון כתיבה: מקור, דיוק, מבנה ותוכן."
      : "What guidance should I add to the answer prompt? This is beyond writing style: sources, accuracy, structure and content."].filter(Boolean).join("\n\n"), guidanceReplies("answerGuidance", answerGuidanceOptions, "answer-guidance-done", "answer-guidance-clear", "answer-guidance:custom"));
  }

  function refreshAnswerGuidanceReplies() {
    state.step = "answerGuidance";
    state.activeStep = "answerGuidance";
    syncConversationFromFaq();
    setQuickReplies(guidanceReplies("answerGuidance", answerGuidanceOptions, "answer-guidance-done", "answer-guidance-clear", "answer-guidance:custom"));
    renderWorkspace();
  }

  function askForbiddenPhrases(prefix = "") {
    ask("forbiddenPhrases", [prefix, prefersHebrew()
      ? "אילו מילים או ביטויים אסור להשתמש בהם בכל ה־FAQ? כתבי אחד בשורה, או הפרידי בפסיקים."
      : "Which words or phrases should be avoided across the whole FAQ? Write one per line, or separate them with commas."].filter(Boolean).join("\n\n"), [
      { label: prefersHebrew() ? "אין מילים אסורות" : "No words to avoid", value: "forbidden:none", echo: false },
      { label: prefersHebrew() ? "חזרה" : "Back", value: "faq:back", echo: false }
    ]);
  }

  function auditCheckOptions() {
    return Object.keys(auditCheckLabels).map((id) => ({
      id,
      label: auditCheckLabels[id]?.[prefersHebrew() ? "he" : "en"] || id
    }));
  }

  function hasAuditCheck(id) {
    const value = state.collectedInputs[id];
    return value === true;
  }

  function selectedAuditCheckIds() {
    return auditCheckOptions()
      .map((item) => item.id)
      .filter((id) => hasAuditCheck(id));
  }

  function setAuditCheckIds(ids = []) {
    const selected = new Set(ids);
    auditCheckOptions().forEach((item) => {
      state.collectedInputs[item.id] = selected.has(item.id);
    });
  }

  function recommendedSiteAuditFocus() {
    const focus = String(state.collectedInputs.auditFocus || "");
    if (focus && focus !== "custom") return focus;
    const profile = String(state.collectedInputs.auditProfile || "");
    if (profile === "faq-schema") return "faq-schema";
    if (profile === "general-fast") return "technical-meta";
    return "full";
  }

  function recommendedSiteAuditCheckIds() {
    const presets = {
      full: ["includeSitemap", "includeLlmsTxt", "includeFaqAudit", "includeStructuredData", "includeAnswerability", "includeMetaAudit", "includeLinkAudit"],
      "faq-schema": ["includeSitemap", "includeLlmsTxt", "includeFaqAudit", "includeStructuredData", "includeAnswerability"],
      "technical-meta": ["includeSitemap", "includeStructuredData", "includeMetaAudit", "includeLinkAudit"],
      answerability: ["includeSitemap", "includeLlmsTxt", "includeFaqAudit", "includeStructuredData", "includeAnswerability", "includeMetaAudit"],
      "links-trust": ["includeSitemap", "includeMetaAudit", "includeLinkAudit"]
    };
    return presets[recommendedSiteAuditFocus()] || presets.full;
  }

  function auditCheckReplies() {
    const options = auditCheckOptions();
    const allSelected = options.every((item) => hasAuditCheck(item.id));
    return [
      ...options.map((item) => ({
        label: `${hasAuditCheck(item.id) ? "✓ " : ""}${item.label}`,
        value: `audit-toggle:${item.id}`,
        selected: hasAuditCheck(item.id),
        echo: false
      })),
      {
        label: `${allSelected ? "✓ " : ""}${prefersHebrew() ? "הכל" : "All checks"}`,
        value: "audit-checks:all",
        selected: allSelected,
        echo: false
      },
      {
        label: prefersHebrew() ? "בחירת ברירת מחדל" : "Recommended checks",
        value: "audit-checks:recommended",
        echo: false
      },
      {
        label: prefersHebrew() ? "לנקות בחירה" : "Clear selection",
        value: "audit-checks:clear",
        echo: false
      },
      {
        label: prefersHebrew() ? "חזרה" : "Back",
        value: "audit-checks:back",
        echo: false
      },
      { label: prefersHebrew() ? "להמשיך" : "Continue", value: "audit-checks-done", echo: false }
    ];
  }

  function refreshAuditCheckReplies() {
    state.step = "toolField";
    state.activeStep = "auditChecks";
    updateToolMissingInputs();
    setQuickReplies(auditCheckReplies());
    renderWorkspace();
  }

  function askSiteAuditChecks() {
    state.pendingQuestion = { toolId: state.activeToolId, key: "auditFocus" };
    ask("toolField", prefersHebrew() ? "מה לבדוק באודיט? אפשר לבחור כמה בדיקות, לבחור ברירת מחדל מומלצת, ואז להמשיך." : "What should this audit check? Choose one or more, or use the recommended checks, then continue.", auditCheckReplies());
    state.activeStep = "auditChecks";
    renderWorkspace();
  }

  function selectedAuditCheckLabel() {
    return auditCheckOptions()
      .filter((item) => hasAuditCheck(item.id))
      .map((item) => item.label)
      .join(prefersHebrew() ? " + " : " + ");
  }

  function showSelectedAnswer(label) {
    const text = compact(label || "");
    if (text) user(text);
  }

  function ask(step, text, replies = []) {
    state.step = step;
    state.activeStep = step;
    bot(text);
    setQuickReplies(replies);
    renderWorkspace();
  }

  function backReply() {
    return { label: prefersHebrew() ? "חזרה" : "Back", value: "faq:back", echo: false };
  }

  function clearReply(value, heLabel = "לנקות בחירה", enLabel = "Clear selection") {
    return { label: prefersHebrew() ? heLabel : enLabel, value, echo: false };
  }

  function askFaqScope(prefix = "") {
    const hebrew = prefersHebrew();
    ask("scope", [prefix, hebrew ? "איזה סוג FAQ זה?" : "What kind of FAQ is this?"].filter(Boolean).join("\n\n"), [
      { label: hebrew ? "מלון / אירוח" : "Hotel / hospitality", value: "scope:hotel" },
      { label: hebrew ? "עסק מקומי" : "Local business", value: "scope:local" },
      { label: hebrew ? "מוצר / שירות" : "Product / service", value: "scope:service" },
      { label: hebrew ? "דגם רכב" : "Vehicle / car model", value: "scope:vehicle" }
    ]);
  }

  function askFaqSubjects(prefix = "") {
    const hebrew = prefersHebrew();
    ask("subjects", [prefix, hebrew ? "על מה ה־FAQ?" : "What is the FAQ about?"].filter(Boolean).join("\n\n"), [
      { label: hebrew ? "יש לי שם אחד" : "I have one name", value: "hint:single-subject" },
      { label: hebrew ? "יש כמה נושאים" : "I have several subjects", value: "hint:multi-subject" },
      { label: hebrew ? "לא בטוחה עדיין" : "Not sure yet", value: "hint:not-sure-subject" },
      backReply()
    ]);
  }

  function askFaqLanguage(prefix = "") {
    const hebrew = prefersHebrew();
    ask("language", [prefix, hebrew ? "באיזו שפה ליצור את התוצאה?" : "What language should the output use?"].filter(Boolean).join("\n\n"), [
      { label: localizedLanguageLabel("English (UK)"), value: "language:English (UK)" },
      { label: localizedLanguageLabel("English (US)"), value: "language:English (US)" },
      { label: localizedLanguageLabel("Hebrew"), value: "language:Hebrew" },
      { label: localizedLanguageLabel("German"), value: "language:German" },
      { label: localizedLanguageLabel("French"), value: "language:French" },
      { label: localizedLanguageLabel("Spanish"), value: "language:Spanish" },
      backReply()
    ]);
  }

  function askFaqCount(prefix = "") {
    const hebrew = prefersHebrew();
    ask("count", [prefix, hebrew ? "כמה שאלות בערך?" : "About how many questions?"].filter(Boolean).join("\n\n"), [
      { label: hebrew ? "זריז: 10-15" : "Fast: 10-15", value: "count:10-15" },
      { label: hebrew ? "סטנדרטי: 20-30" : "Standard: 20-30", value: "count:20-30" },
      { label: hebrew ? "עמוק: 30-45" : "Deep: 30-45", value: "count:30-45" },
      { label: hebrew ? "רחב: 40-55" : "Wide: 40-55", value: "count:40-55" },
      { label: hebrew ? "רק מה שבאמת טוב" : "Quality first", value: "count:quality_first" },
      backReply()
    ]);
  }

  function resetActiveDraft() {
    state.activeIntent = "";
    state.activeToolId = "";
    state.activeStep = "idle";
    state.collectedInputs = {};
    state.missingInputs = [];
    state.pendingQuestion = null;
    state.readyToRun = false;
    state.lastPayload = null;
    state.liveRunConfirmed = false;
    state.runConfirmed = false;
  }

  function startFaq(text = "") {
    state.mode = "faq";
    state.activeToolId = "faq-playground";
    state.activeIntent = "faq";
    state.fileTask = freshFileTask();
    state.faqSubjectValidation = null;
    if (text) applyInference(text);
    nextStep();
  }

  function genericFileEditText(text) {
    const clean = compact(text);
    if (!clean) return true;
    if (extractFilePath(clean)) return false;
    return /^(edit a file|file edit|change a file|עריכה של קובץ|לערוך קובץ|עריכת קובץ|לתקן קובץ)$/i.test(clean) ||
      /^(יש לי|יש לנו).{0,28}קבצים.{0,28}(עריכות|לעריכה|לתקן|שינויים)/i.test(clean);
  }

  function fileTargetReplies(text = "") {
    if (hasHebrew(text) || prefersHebrew()) {
      return [
        { label: "לתת ל־Codex למצוא קבצים", value: "file:discover" },
        { label: "אשלח נתיב קובץ", value: "file:ask-path" },
        { label: "עריכת Google Sheet", value: "start:sheet-edit" },
        { label: "תוכן מודבק", value: "file:pasted-content" }
      ];
    }
    return [
      { label: "Let Codex find files", value: "file:discover" },
      { label: "I’ll send a repo path", value: "file:ask-path" },
      { label: "Edit Google Sheet", value: "start:sheet-edit" },
      { label: "Pasted content", value: "file:pasted-content" }
    ];
  }

  function askFileTarget(text = "") {
    ask("filePath", hasHebrew(text)
      ? "אפשר. זה קובץ מקומי בפרויקט, Google Sheet, או תוכן שתדביקי כאן? אם אין נתיב מדויק, אפשר לתת ל־Codex למצוא את הקבצים הרלוונטיים לפי ההנחיה."
      : "Sure. Is this a local project file, a Google Sheet, or pasted content? If you do not know the exact path, Codex can identify the relevant files from the instruction.",
    fileTargetReplies(text));
  }

  function codexDiscoveryTarget(text = "") {
    return hasHebrew(text) || prefersHebrew()
      ? "Codex יאתר את הקבצים הרלוונטיים לפי ההנחיה."
      : "Codex should identify the relevant local files from the request.";
  }

  function startFileTask(text = "") {
    if (isSheetEditIntent(text)) {
      startTool("design-formatting", text);
      return;
    }

    const filePath = extractFilePath(text);
    const needsTargetChoice = !filePath && genericFileEditText(text);
    state.mode = "file";
    state.step = "file";
    state.activeIntent = "file-edit";
    state.activeToolId = "file-draft";
    state.activeStep = "collecting";
    state.answers = freshAnswers();
    state.fileTask = {
      filePath,
      targetScope: filePath ? "" : (needsTargetChoice ? "" : codexDiscoveryTarget(text)),
      targetKind: filePath ? "repo-path" : "repo-discovery",
      instruction: needsTargetChoice ? "" : compact(text),
      status: "draft"
    };
    state.collectedInputs = { ...state.fileTask };

    const missingTarget = !state.fileTask.filePath && !state.fileTask.targetScope;
    const missingInstruction = !state.fileTask.instruction || state.fileTask.instruction === state.fileTask.filePath;
    renderWorkspace();

    if (missingTarget) {
      askFileTarget(text);
      return;
    }

    if (missingInstruction) {
      ask("fileInstruction", hasHebrew(text)
        ? `מצאתי את הקובץ ${state.fileTask.filePath}. מה לשנות בו?`
        : `I found ${state.fileTask.filePath}. What should change?`, []);
      return;
    }

    finishFileTask();
  }

  function finishFileTask() {
    state.step = "fileReady";
    state.activeStep = "drafted";
    state.collectedInputs = { ...state.fileTask };
    state.missingInputs = [];
    state.readyToRun = false;
    state.lastPayload = getTool("file-draft")?.payloadBuilder?.(state.fileTask) || state.fileTask;
    renderWorkspace();
    const targetLabel = state.fileTask.filePath ||
      state.fileTask.targetScope ||
      "Codex should identify the relevant files";
    bot(prefersHebrew()
      ? [
        "הבנתי את בקשת העריכה.",
        `יעד: ${targetLabel}`,
        `שינוי: ${state.fileTask.instruction || "חסרה הנחיה"}`,
        "",
        "הצ׳אט בדפדפן לא כותב לקבצים. הוא יוצר בקשת עבודה בטוחה, ו־Codex מאתר/עורך את הקבצים בפועל עם guardrails ואישור."
      ].join("\n")
      : [
        "I understand the file edit request.",
        `Target: ${targetLabel}`,
        `Change: ${state.fileTask.instruction || "missing instruction"}`,
        "",
        "The browser chat does not write files. It drafts a safe work request; Codex locates/edits the files with guardrails and review."
      ].join("\n"));
    setQuickReplies([
      { label: prefersHebrew() ? "להוסיף פרטים" : "Add detail", value: "file:detail" },
      { label: prefersHebrew() ? "להתחיל מחדש" : "Start over", value: "reset" }
    ]);
  }

  function faqSourceReplies() {
    const hebrew = prefersHebrew();
    const recentWebsite = state.sources.find((item) => item.kind === "Website");
    const replies = [
      { label: hebrew ? "יש לי URL" : "I have a URL", value: "source:url" },
      { label: hebrew ? "אתר רשמי בלבד" : "Official site only", value: "source:official" },
      { label: hebrew ? "אין מקור כרגע" : "No source yet", value: "source:none" },
      { label: hebrew ? "אכתוב כללי מקור" : "I’ll write source rules", value: "source:custom" },
      backReply()
    ];
    if (recentWebsite) {
      replies.unshift({ label: hebrew ? "להשתמש בקישור ששמרת" : "Use the saved link", value: `source:saved:${recentWebsite.url}` });
    }
    return replies;
  }

  function askFaqSource(prefix = "") {
    const hebrew = prefersHebrew();
    ask("source", [prefix, hebrew ? "מאיפה לקחת את המידע העובדתי?" : "Where should I take the factual information from?"].filter(Boolean).join("\n\n"), faqSourceReplies());
  }

  function nextStep() {
    syncConversationFromFaq();
    const hebrew = prefersHebrew();

    if (!state.answers.scope) {
      askFaqScope();
      return;
    }

    if (!subjectList().length) {
      askFaqSubjects();
      return;
    }

    if (!state.answers.audienceConfirmed) {
      askFaqAudience();
      return;
    }

    if (!state.answers.languageConfirmed) {
      askFaqLanguage();
      return;
    }

    if (!state.answers.countConfirmed) {
      askFaqCount();
      return;
    }

    if (!state.answers.categoriesConfirmed) {
      askFaqCategories();
      return;
    }

    if (!state.answers.categoryCountsConfirmed) {
      askFaqCategoryCounts();
      return;
    }

    if (!state.answers.sourceConfirmed) {
      askFaqSource();
      return;
    }

    if (!state.answers.questionGuidanceConfirmed) {
      askQuestionGuidance();
      return;
    }

    if (!state.answers.answerGuidanceConfirmed) {
      askAnswerGuidance();
      return;
    }

    if (!state.answers.styleConfirmed) {
      askFaqStyle();
      return;
    }

    if (!state.answers.qaConfirmed) {
      askFaqQa();
      return;
    }

    finishSetup();
  }

  function inputDefaultsForTool(tool) {
    const defaults = {};
    [...(tool.requiredInputs || []), ...(tool.optionalInputs || [])].forEach((field) => {
      if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue;
    });
    return defaults;
  }

  function mergeToolInference(tool, text) {
    const inferred = typeof tool.infer === "function" ? tool.infer(text) : {};
    return applyOperationPlan(tool, text, { ...inputDefaultsForTool(tool), ...inferred });
  }

  function planToolOperation(tool, text, values = {}) {
    if (!tool || tool.id !== "design-formatting") return {};
    const clean = compact(text);
    if (!clean) return {};
    if (isRemoveSourcesFromAnswersIntent(clean)) {
      const answerColumn = extractSheetEditColumn(clean) || normalizeSheetColumn(values.answerCol) || "C";
      return {
        targetUrl: values.targetUrl || latestEditableSheetUrl(clean),
        tabName: values.tabName || latestSheetTab(),
        dryRun: true,
        instruction: values.instruction || clean,
        instructions: values.instructions || clean,
        assistantInstruction: "Remove visible source references, URLs, citation labels and source notes from answer text while keeping the answers factual, natural and publication-ready.",
        operationType: "faq_language_review",
        answerCol: answerColumn,
        targetCol: answerColumn,
        targetHeader: values.targetHeader || "Answer"
      };
    }
    if (isSheetColumnTransferIntent(clean)) {
      const columns = extractColumnTransfer(clean);
      return {
        targetUrl: values.targetUrl || latestEditableSheetUrl(clean),
        tabName: values.tabName || latestSheetTab(),
        dryRun: true,
        instruction: clean,
        instructions: clean,
        operationType: "replace_column_when_value",
        sourceColumn: columns.sourceColumn || values.sourceColumn || state.taskMemory.references?.it?.sourceColumn || state.taskMemory.lastOutputColumns?.outputColumn || "F",
        targetColumn: columns.targetColumn || values.targetColumn || state.taskMemory.references?.it?.targetColumn || state.taskMemory.lastOutputColumns?.answerColumn || "C",
        startRow: values.startRow || 2,
        targetHeader: values.targetHeader || "Answer"
      };
    }
    if (isAnswerResearchIntent(clean)) {
      return {
        targetUrl: values.targetUrl || latestEditableSheetUrl(clean),
        sourceUrl: values.sourceUrl || websiteUrlFromText(clean),
        tabName: values.tabName || latestSheetTab(),
        dryRun: true,
        instruction: values.instruction || clean,
        instructions: values.instructions || clean,
        operationType: "faq_answer_research"
      };
    }
    if (state.taskMemory.lastToolId === "design-formatting" && isFollowUpReference(clean) && hasEditWord(clean)) {
      return {
        targetUrl: values.targetUrl || latestSheetUrl(),
        tabName: values.tabName || latestSheetTab(),
        dryRun: true,
        instruction: clean,
        instructions: clean
      };
    }
    return {};
  }

  function applyOperationPlan(tool, text, values = {}) {
    const plan = planToolOperation(tool, text, values);
    return { ...values, ...plan };
  }

  function applyColumnTransferInputs(text) {
    const columns = extractColumnTransfer(text);
    const instruction = compact(text);
    const targetUrl = latestEditableSheetUrl(text);
    const previousOperation = latestDesignFormattingOperation();
    const reference = state.taskMemory.references?.it || {};
    const sourceColumn = columns.sourceColumn ||
      normalizeSheetColumn(previousOperation.targetCol || previousOperation.outputColumn || previousOperation.sourceColumn || reference.sourceColumn || state.taskMemory.lastOutputColumns?.outputColumn) ||
      "F";
    const targetColumn = columns.targetColumn ||
      normalizeSheetColumn(previousOperation.answerCol || previousOperation.targetColumn || reference.targetColumn || state.taskMemory.lastOutputColumns?.answerColumn) ||
      "C";
    state.collectedInputs = {
      ...inputDefaultsForTool(getTool("design-formatting")),
      ...state.collectedInputs,
      targetUrl,
      tabName: latestSheetTab(),
      dryRun: true,
      model: state.collectedInputs.model || "o3",
      instruction,
      instructions: instruction,
      operationType: "replace_column_when_value",
      sourceColumn,
      targetColumn,
      startRow: state.collectedInputs.startRow || 2,
      targetHeader: state.collectedInputs.targetHeader || "Answer"
    };
    if (targetUrl) recordSource(targetUrl, "FAQ Editing Workspace column transfer", "design-formatting");
    rememberToolPayload("design-formatting", buildToolPayload(getTool("design-formatting"), state.collectedInputs), state.collectedInputs);
  }

  function startColumnTransferFollowup(text) {
    const tool = getTool("design-formatting");
    if (!tool) return false;
    state.mode = "tool";
    state.step = "tool";
    state.activeIntent = "design-formatting";
    state.activeToolId = "design-formatting";
    state.activeStep = "collecting";
    state.pendingQuestion = null;
    state.readyToRun = false;
    state.liveRunConfirmed = false;
    applyColumnTransferInputs(text);
    updateToolMissingInputs();

    const hebrew = hasHebrew(text) || prefersHebrew();
    const columnsReady = Boolean(state.collectedInputs.sourceColumn && state.collectedInputs.targetColumn);
    const prefix = hebrew
      ? `הבנתי. זו פעולת גיליון: להעתיק ערכים מ־${state.collectedInputs.sourceColumn || "עמודת המקור"} אל ${state.collectedInputs.targetColumn || "עמודת היעד"} רק בשורות שבהן יש ערך. נתחיל בבדיקה בלי כתיבה, ולא אכתוב לגיליון בלי אישור.`
      : `Got it. This is a sheet operation: copy values from ${state.collectedInputs.sourceColumn || "the source column"} into ${state.collectedInputs.targetColumn || "the target column"} only where the source has a value. I’ll start with a dry run and won’t write without confirmation.`;

    if (!columnsReady) {
      state.pendingQuestion = { toolId: "design-formatting", key: "columnTransfer" };
      ask("toolField", hebrew ? "איזו עמודה היא המקור ואיזו היא היעד? למשל: F ל־C." : "Which source and target columns? For example: F to C.", []);
      return true;
    }

    advanceToolFlow(prefix);
    return true;
  }

  function startSheetEditFollowup(text) {
    const tool = getTool("design-formatting");
    if (!tool) return false;
    const targetUrl = latestEditableSheetUrl(text);
    const tabName = latestSheetTab();
    const instruction = compact(withoutUrlsForDisplay(text)) || compact(text);

    state.mode = "tool";
    state.step = "tool";
    state.activeIntent = "design-formatting";
    state.activeToolId = "design-formatting";
    state.activeStep = "collecting";
    state.pendingQuestion = null;
    state.readyToRun = false;
    state.liveRunConfirmed = false;
    state.runConfirmed = false;
    state.collectedInputs = {
      ...mergeToolInference(tool, text),
      targetUrl,
      tabName,
      dryRun: true,
      instruction,
      instructions: instruction
    };
    if (targetUrl) recordSource(targetUrl, "FAQ Editing Workspace edit target", "design-formatting");
    updateToolMissingInputs();
    advanceToolFlow(hasHebrew(text)
      ? "קלטתי. זו עריכת Google Sheet על הקובץ שנוצר, לא FAQ חדש. מתחילה בבדיקה בלי לכתוב לגיליון."
      : "Got it. This is a Google Sheet edit on the generated file, not a new FAQ. I’ll start with a dry run.");
    return true;
  }

  function realignDesignFormattingBeforeRun() {
    if (state.activeToolId !== "design-formatting") return;
    const instruction = state.collectedInputs.instruction || state.collectedInputs.instructions || "";
    if (!isSheetColumnTransferIntent(instruction)) return;
    const payload = state.lastPayload || buildToolPayload(getTool("design-formatting"), state.collectedInputs);
    const operation = payload?.operation || payload?.operations?.[0] || {};
    if (operation.type === "replace_column_when_value") return;
    applyColumnTransferInputs(instruction);
    updateToolMissingInputs();
    bot(hasHebrew(instruction)
      ? "תיקנתי את סוג הפעולה לפני הרצה: זו לא פעולת עיצוב טבלה, אלא העתקת ערכים מעמודה לעמודה."
      : "I corrected the operation before running: this is column-to-column replacement, not table formatting.");
  }

  function payloadOperation(payload) {
    return payload?.operation || payload?.operations?.[0] || {};
  }

  function designOperationLabel(operation = {}, hebrew = prefersHebrew()) {
    const type = operation.type || "";
    if (type === "faq_answer_research") return hebrew ? "שיפור תשובות FAQ" : "FAQ answer research";
    if (type === "replace_column_when_value") return hebrew ? "העתקת ערכים בין עמודות" : "column replacement";
    return hebrew ? "עריכת גיליון" : "sheet edit";
  }

  function reconcileColumnTransferPayload(payload, announce = false) {
    if (state.activeToolId !== "design-formatting" || !payload) return payload;
    const operation = payloadOperation(payload);
    if (operation.type !== "replace_column_when_value") return payload;

    const instruction = state.collectedInputs.instruction ||
      state.collectedInputs.instructions ||
      payload.assistantInstruction ||
      "";
    const columns = extractColumnTransfer(instruction);
    const sourceColumn = normalizeSheetColumn(operation.sourceColumn);
    const targetColumn = normalizeSheetColumn(operation.targetColumn);
    const updates = {};

    if (columns.explicitSourceColumn && columns.explicitSourceColumn !== sourceColumn) {
      updates.sourceColumn = columns.explicitSourceColumn;
    }
    if (columns.explicitTargetColumn && columns.explicitTargetColumn !== targetColumn) {
      updates.targetColumn = columns.explicitTargetColumn;
    }

    if (!Object.keys(updates).length) return payload;

    state.collectedInputs = {
      ...state.collectedInputs,
      ...updates,
      operationType: "replace_column_when_value"
    };
    const nextPayload = buildToolPayload(getTool("design-formatting"), state.collectedInputs);
    state.lastPayload = nextPayload;
    rememberToolPayload("design-formatting", nextPayload, state.collectedInputs);
    if (announce) {
      const nextOperation = payloadOperation(nextPayload);
      bot(hasHebrew(instruction)
        ? `תיקנתי את העמודות לפי ההוראה שלך לפני הרצה: ${nextOperation.sourceColumn} -> ${nextOperation.targetColumn}.`
        : `I corrected the columns from your instruction before running: ${nextOperation.sourceColumn} -> ${nextOperation.targetColumn}.`);
    }
    return nextPayload;
  }

  function hasUnsafeColumnTransfer(payload) {
    const operation = payloadOperation(payload);
    if (operation.type !== "replace_column_when_value") return false;
    const sourceColumn = normalizeSheetColumn(operation.sourceColumn);
    const targetColumn = normalizeSheetColumn(operation.targetColumn);
    return Boolean(sourceColumn && targetColumn && sourceColumn === targetColumn && payload.dryRun === false);
  }

  function blockUnsafeColumnTransfer(payload) {
    const operation = payloadOperation(payload);
    const sourceColumn = normalizeSheetColumn(operation.sourceColumn) || "source";
    const targetColumn = normalizeSheetColumn(operation.targetColumn) || "target";
    state.collectedInputs.dryRun = true;
    state.liveRunConfirmed = false;
    updateToolMissingInputs();
    bot(prefersHebrew()
      ? `עצרתי את הכתיבה לגיליון. ההגדרות עדיין אומרות להעתיק ${sourceColumn} אל ${targetColumn}, כלומר אותה עמודה. זה נראה כמו פעולה לא נכונה. שלחי שוב במפורש, למשל: מ־F ל־C, או הריצי בדיקה בלי לכתוב.`
      : `I stopped the live write. The payload still says ${sourceColumn} -> ${targetColumn}, which is the same column. That looks like a risky no-op, not the requested edit. Send it explicitly, for example: F to C, or run a dry run.`);
    setGenericReadyReplies(getTool("design-formatting"));
  }

  function mergeSmartToolValues(tool, text, values = {}) {
    const inferred = typeof tool.infer === "function" ? tool.infer(text) : {};
    const merged = { ...inputDefaultsForTool(tool), ...inferred, ...(values || {}) };

    if (tool.id === "design-formatting") {
      const inferredInstruction = compact(inferred.instruction || "");
      const smartInstruction = compact(values?.instruction || "");
      const textInstruction = compact(withoutUrlsForDisplay(text || ""));
      if (isAnswerResearchIntent(text) && (!smartInstruction || smartInstruction.length < inferredInstruction.length)) {
        merged.instruction = inferredInstruction || textInstruction || smartInstruction;
      }
      if (!compact(merged.instruction || "") && textInstruction && hasEditWord(textInstruction)) {
        merged.instruction = textInstruction;
      }
    }

    return applyOperationPlan(tool, text, merged);
  }

  function startTool(toolId, text = "") {
    const tool = getTool(toolId);
    if (!tool) return false;

    if (tool.id === "faq-playground") {
      startFaq(text);
      return true;
    }
    if (tool.id === "file-draft") {
      startFileTask(text);
      return true;
    }

    state.mode = "tool";
    state.step = "tool";
    state.activeIntent = tool.id;
    state.activeToolId = tool.id;
    state.activeStep = "collecting";
    state.collectedInputs = mergeToolInference(tool, text);
    if (tool.id === "site-ai-faq-audit") {
      state.faqAuditDiscovery = null;
      state.faqAuditDiscoveryPending = false;
      state.faqAuditGroupSelectionTouched = false;
      delete state.collectedInputs.discoveryMapped;
      delete state.collectedInputs.groups;
    }
    if (tool.id === "site-ai-audit") {
      state.auditCheckSelectionTouched = false;
      auditCheckOptions().forEach((item) => {
        delete state.collectedInputs[item.id];
      });
    }
    if (tool.id === "meta-tags") {
      initializeMetaFlow(text);
    }
    state.pendingQuestion = null;
    state.readyToRun = false;
    state.lastPayload = null;
    state.liveRunConfirmed = false;
    state.runConfirmed = false;
    recordSourcesFromText(text, `${tool.title} input`);
    updateToolMissingInputs();

    advanceToolFlow();
    return true;
  }

  function startToolMessage(tool, text) {
    if (hasHebrew(text) || prefersHebrew()) {
      return `קלטתי: ${tool.title}. אאסוף רק מה שחסר.`;
    }
    return `Got it: ${tool.title}. I’ll ask only for what’s missing.`;
  }

  function updateToolMissingInputs() {
    const tool = getTool(state.activeToolId);
    if (!tool) {
      state.missingInputs = [];
      return;
    }
    if (tool.id === "site-ai-faq-audit") syncFaqAuditSelectedUrls();
    if (tool.id === "meta-tags") {
      state.missingInputs = metaMissingInputs();
      state.readyToRun = state.missingInputs.length === 0;
      state.lastPayload = state.readyToRun ? buildToolPayload(tool, state.collectedInputs) : null;
      if (state.lastPayload) rememberToolPayload(tool.id, state.lastPayload, state.collectedInputs);
      return;
    }
    state.missingInputs = (tool.requiredInputs || [])
      .filter((field) => !fieldHasValue(state.collectedInputs[field.key]))
      .map((field) => field.key);
    if (tool.id === "site-ai-faq-audit" && !state.missingInputs.length && !hasFaqAuditDiscovery()) {
      state.missingInputs = ["discoveryMapped"];
    }
    state.readyToRun = state.missingInputs.length === 0;
    state.lastPayload = state.readyToRun ? buildToolPayload(tool, state.collectedInputs) : null;
    if (state.lastPayload) rememberToolPayload(tool.id, state.lastPayload, state.collectedInputs);
  }

  function fieldHasValue(value) {
    if (Array.isArray(value)) return value.filter(Boolean).length > 0;
    return compact(value).length > 0 || value === true || value === false;
  }

  function firstMissingField(tool) {
    const key = state.missingInputs[0];
    return (tool.requiredInputs || []).find((field) => field.key === key) || null;
  }

  function hasFaqAuditDiscovery() {
    return Boolean(state.faqAuditDiscovery?.urls?.length && state.collectedInputs.discoveryMapped);
  }

  function faqAuditNeedsDiscovery(tool = getTool(state.activeToolId)) {
    return tool?.id === "site-ai-faq-audit" && fieldHasValue(state.collectedInputs.siteUrl) && !hasFaqAuditDiscovery();
  }

  function metaSourceType() {
    const sourceUrl = state.collectedInputs.sourceUrl || "";
    const pageList = state.collectedInputs.pageList || "";
    const detected = detectSourceType(sourceUrl || pageList);
    return detected === "folder" || detected === "sheet" || detected === "website" ? detected : "manual";
  }

  function hasExplicitMetaSource() {
    return fieldHasValue(state.collectedInputs.sourceUrl) || fieldHasValue(state.collectedInputs.pageList);
  }

  function metaFieldLabel(value = state.collectedInputs.metaFields) {
    const labels = prefersHebrew()
      ? {
        titleDescription: "Meta title + description",
        titleDescriptionH1: "Meta title + description + H1",
        full: "Meta title + description + H1 + Open Graph"
      }
      : {
        titleDescription: "Meta title + description",
        titleDescriptionH1: "Meta title + description + H1",
        full: "Meta title + description + H1 + Open Graph"
      };
    return labels[value] || "";
  }

  function setMetaFields(value) {
    const mode = value === "full" || value === "titleDescriptionH1" ? value : "titleDescription";
    state.collectedInputs.metaFields = mode;
    state.collectedInputs.metaFieldsConfirmed = true;
    if (mode === "full") {
      state.collectedInputs.activeRules = ["brandInTitle", "includeH1", "openGraph"];
    } else if (mode === "titleDescriptionH1") {
      state.collectedInputs.activeRules = ["brandInTitle", "includeH1"];
    } else {
      state.collectedInputs.activeRules = ["brandInTitle"];
    }
  }

  function inferMetaFields(text) {
    const lower = String(text || "").toLowerCase();
    const asksTitle = /title|טייטל|כותרת/.test(lower);
    const asksDescription = /description|desc|דסקריפש|תיאור/.test(lower);
    const asksH1 = /\bh1\b|כותרת\s*h1/.test(lower);
    const asksOg = /open\s*graph|\bog\b|social|פייסבוק|שיתוף/.test(lower);
    if (asksOg) return "full";
    if (asksH1) return "titleDescriptionH1";
    if (asksTitle || asksDescription) return "titleDescription";
    return "";
  }

  function hasExplicitMetaLanguage(text) {
    return detectLanguagesFromText(text, []).length > 0 || /אנגלית|עברית|גרמנית|צרפתית|ספרדית|איטלקית|פורטוגזית|הולנדית|פולנית|רוסית|ערבית/i.test(String(text || ""));
  }

  function hasExplicitMetaGenerationMode(text) {
    return /\bai\b|בינה|איי|template|תבנית|בלי\s+ai|ללא\s+ai/i.test(String(text || ""));
  }

  function hasExplicitMetaOutput(text) {
    const clean = withoutUrlsForDisplay(text);
    return /\bpreview\b|dry\s*run|new\s+tab|first\s+tab|output\s+to|write(?:\s+back)?|overwrite|range|cell|בלי כתיבה|לא לכתוב|בדיקה מקדימה|לכתוב|כתיבה|טאב|לשונית|תא|דרוס|לדרוס/i.test(clean);
  }

  function metaOutputIntentFromText(text) {
    const clean = withoutUrlsForDisplay(text);
    const lower = clean.toLowerCase();
    const cell = extractExplicitOutputCell(clean);
    const wantsPreview = /\bpreview\b|dry\s*run|בלי כתיבה|לא לכתוב|בדיקה מקדימה|תצוגה/i.test(clean);
    const wantsOverwrite = /overwrite|replace existing|דרוס|לדרוס|דריסה/i.test(clean);
    const wantsSkip = /skip|empty only|only if empty|if empty|ריק|תאים ריקים|דלג|לא לדרוס/i.test(clean);
    const wantsFirstTab = /first\s+tab|first\s+sheet|(?:ב|ל|ה)?טאב\s+(?:ה)?ראשון|(?:ב|ל|ה)?לשונית\s+(?:ה)?ראשונה|טאב\s+המקור/i.test(clean);
    const wantsNewTab = /new\s+tab|new\s+sheet|meta tags\s+tab|טאב\s+חדש|לשונית\s+חדשה|טאב\s+meta|מטא\s+tags/i.test(lower);
    const wantsWrite = /write(?:\s+back)?|output\s+to|put|place|save|לכתוב|להכניס|לשמור|כתיבה/i.test(clean);
    const outputMode = wantsPreview
      ? "preview"
      : wantsFirstTab || (cell && !wantsNewTab)
        ? "firstTabRange"
        : wantsNewTab || wantsWrite
          ? "newTab"
          : "";
    return {
      hasIntent: Boolean(outputMode || cell || wantsOverwrite || wantsSkip),
      outputMode,
      cell,
      policy: wantsOverwrite ? "overwrite" : (wantsSkip ? "skip" : "")
    };
  }

  function applyMetaOutputIntentFromText(text, options = {}) {
    const { confirm = false } = options;
    const intent = metaOutputIntentFromText(text);
    if (!intent.hasIntent) return false;
    if (intent.outputMode) state.collectedInputs.outputMode = intent.outputMode;
    if (intent.cell) {
      const cell = intent.cell.includes("!") ? intent.cell.split("!").pop() : intent.cell;
      state.collectedInputs.outputStartCell = cell.toUpperCase();
      if (!intent.outputMode) state.collectedInputs.outputMode = "firstTabRange";
    }
    if (state.collectedInputs.outputMode === "newTab") {
      state.collectedInputs.outputTabName = state.collectedInputs.outputTabName || "Meta Tags";
    }
    if (intent.policy) setExistingValuePolicy(intent.policy);
    else if (state.collectedInputs.outputMode && state.collectedInputs.outputMode !== "preview") setExistingValuePolicy("skip");
    if (confirm) state.collectedInputs.metaOutputConfirmed = true;
    return true;
  }

  function initializeMetaFlow(text = "") {
    const inputs = state.collectedInputs;
    const sourceType = metaSourceType();
    if (!Array.isArray(inputs.languages)) inputs.languages = manifestSplitList(inputs.languages);
    if (!inputs.languages.length) inputs.languages = ["en"];
    if (!inputs.outputTabName) inputs.outputTabName = "Meta Tags";
    if (!inputs.outputStartCell) inputs.outputStartCell = "A1";
    if (!inputs.existingValuePolicy) inputs.existingValuePolicy = "skip";
    if (!inputs.generationMode) inputs.generationMode = "template";
    if (!inputs.outputMode) inputs.outputMode = "preview";

    const inferredFields = inferMetaFields(text);
    if (inferredFields) setMetaFields(inferredFields);
    if (hasExplicitMetaOutput(text)) applyMetaOutputIntentFromText(text, { confirm: false });
    if (hasExplicitMetaLanguage(text)) inputs.metaLanguageConfirmed = true;
    if (hasExplicitMetaGenerationMode(text)) inputs.metaGenerationConfirmed = true;
    const outputIntent = metaOutputIntentFromText(text);
    if (outputIntent.outputMode === "preview" || outputIntent.policy) inputs.metaOutputConfirmed = true;
    if (sourceType === "manual" && hasExplicitMetaSource()) inputs.metaPageSourceConfirmed = true;
  }

  function metaMissingInputs() {
    const missing = [];
    const sourceType = metaSourceType();
    if (!hasExplicitMetaSource()) missing.push("pageList");
    else if ((sourceType === "sheet" || sourceType === "folder" || sourceType === "website") && !state.collectedInputs.metaPageSourceConfirmed) missing.push("metaPageSource");
    if (!state.collectedInputs.metaFieldsConfirmed) missing.push("metaFields");
    if (!state.collectedInputs.metaLanguageConfirmed) missing.push("languages");
    if (!state.collectedInputs.metaGenerationConfirmed) missing.push("generationMode");
    if (!state.collectedInputs.metaOutputConfirmed) missing.push("outputMode");
    return missing;
  }

  function metaOutputLabel() {
    const mode = state.collectedInputs.outputMode || "preview";
    const policy = existingValuePolicy();
    if (mode === "preview") return prefersHebrew() ? "בדיקה מקדימה בלי כתיבה" : "preview only";
    const target = mode === "firstTabRange"
      ? (prefersHebrew() ? "הטאב הראשון" : "first tab")
      : (state.collectedInputs.outputTabName || "Meta Tags");
    const start = state.collectedInputs.outputStartCell || "A1";
    return prefersHebrew()
      ? `${target}!${start} · ${policy === "overwrite" ? "לדרוס תאים מלאים" : "לכתוב רק אם הטווח ריק"}`
      : `${target}!${start} · ${policy === "overwrite" ? "overwrite filled cells" : "skip filled cells"}`;
  }

  function askMetaSource(prefix = "") {
    const hebrew = prefersHebrew();
    ask("toolField", [
      prefix,
      hebrew
        ? "מאיפה לבנות את ה־Meta tags? שלחי Google Sheet, תיקיית Drive, URL של עמוד, או רשימת עמודים."
        : "What should I build metadata for? Send a Google Sheet, Drive folder, page URL, or a list of pages."
    ].filter(Boolean).join("\n\n"), state.sources.slice(0, 4).map((source) => ({
      label: source.kind === "Website"
        ? (hebrew ? `להשתמש ב־${source.url.replace(/^https?:\/\//, "").slice(0, 34)}` : `Use ${source.url.replace(/^https?:\/\//, "").slice(0, 34)}`)
        : (hebrew ? `להשתמש ב־${source.kind}` : `Use ${source.kind}`),
      value: `toolfield:pageList:${source.url}`
    })));
    state.pendingQuestion = { toolId: state.activeToolId, key: "pageList" };
  }

  function askMetaPageSource(prefix = "") {
    const hebrew = prefersHebrew();
    const sourceType = metaSourceType();
    const source = state.collectedInputs.sourceUrl || state.collectedInputs.pageList;
    const sourceLabel = sourceType === "folder"
      ? (hebrew ? "תיקיית Drive" : "Drive folder")
      : sourceType === "sheet"
        ? (hebrew ? "Google Sheet" : "Google Sheet")
        : (hebrew ? "URL" : "URL");
    const fileNameLabel = sourceType === "folder"
      ? (hebrew ? "שמות הקבצים בתיקייה" : "folder file names")
      : sourceType === "sheet"
        ? (hebrew ? "שם הקובץ כעמוד אחד" : "the spreadsheet file name as one page")
        : (hebrew ? "ה־URL כעמוד אחד" : "this URL as one page");
    ask("metaPageSource", [
      prefix,
      hebrew
        ? `מצאתי ${sourceLabel}:\n${source}\n\nמאיפה לקחת את שמות העמודים למטא?`
        : `I found a ${sourceLabel}:\n${source}\n\nWhere should the page names come from?`
    ].filter(Boolean).join("\n\n"), [
      { label: fileNameLabel, value: "meta-pages:source", primary: true },
      { label: hebrew ? "אכתוב רשימת עמודים ידנית" : "I’ll type a page list", value: "meta-pages:manual" },
      { label: hebrew ? "לפתוח כלי Meta" : "Open Meta Tags Studio", value: "open-tool" }
    ]);
  }

  function askMetaFields(prefix = "") {
    const hebrew = prefersHebrew();
    ask("metaFields", [
      prefix,
      hebrew ? "מה לייצר לכל עמוד?" : "What should I generate for each page?"
    ].filter(Boolean).join("\n\n"), [
      { label: "Meta title + description", value: "meta-fields:titleDescription", primary: true },
      { label: "Title + description + H1", value: "meta-fields:titleDescriptionH1" },
      { label: "Title + description + H1 + OG", value: "meta-fields:full" }
    ]);
  }

  function askMetaLanguage(prefix = "") {
    const hebrew = prefersHebrew();
    ask("metaLanguage", [
      prefix,
      hebrew ? "באיזו שפה לייצר את המטא?" : "Which language should the metadata use?"
    ].filter(Boolean).join("\n\n"), [
      { label: hebrew ? "אנגלית UK" : "English", value: "meta-language:en", primary: true },
      { label: hebrew ? "עברית" : "Hebrew", value: "meta-language:he" },
      { label: hebrew ? "גרמנית" : "German", value: "meta-language:de" },
      { label: hebrew ? "צרפתית" : "French", value: "meta-language:fr" },
      { label: hebrew ? "כמה שפות" : "Several languages", value: "meta-language:custom" }
    ]);
  }

  function askMetaGeneration(prefix = "") {
    const hebrew = prefersHebrew();
    ask("metaGeneration", [
      prefix,
      hebrew
        ? "איך לבנות את הניסוחים?"
        : "How should I generate the copy?"
    ].filter(Boolean).join("\n\n"), [
      { label: hebrew ? "תבנית מהירה בלי AI" : "Fast template, no AI", value: "meta-build:template", primary: true },
      { label: hebrew ? "AI לניסוח מותאם" : "AI-written copy", value: "meta-build:ai" },
      { label: hebrew ? "לפתוח כלי Meta" : "Open Meta Tags Studio", value: "open-tool" }
    ]);
  }

  function askMetaOutput(prefix = "") {
    const hebrew = prefersHebrew();
    const canWrite = metaSourceType() === "sheet" || metaSourceType() === "folder";
    const startCell = state.collectedInputs.outputStartCell || "A1";
    const currentTarget = state.collectedInputs.outputMode === "firstTabRange"
      ? (hebrew ? `כרגע היעד שסימנת הוא הטאב הראשון מתא ${startCell}.` : `Current target: first tab from ${startCell}.`)
      : "";
    const replies = [
      { label: hebrew ? "לבדוק בלי לכתוב" : "Generate preview only", value: "meta-output:preview", primary: true },
      canWrite ? { label: hebrew ? "לכתוב לטאב Meta Tags רק אם ריק" : "Write to Meta Tags tab if empty", value: "meta-output:newTab:skip" } : null,
      canWrite ? { label: hebrew ? "לדרוס את טאב Meta Tags" : "Overwrite Meta Tags tab", value: "meta-output:newTab:overwrite" } : null,
      canWrite ? { label: hebrew ? `לכתוב בטאב הראשון מ־${startCell} רק אם ריק` : `Write to first tab from ${startCell} if empty`, value: "meta-output:firstTabRange:skip" } : null,
      canWrite ? { label: hebrew ? `לדרוס בטאב הראשון מ־${startCell}` : `Overwrite first tab from ${startCell}`, value: "meta-output:firstTabRange:overwrite" } : null,
      canWrite ? { label: hebrew ? "לבחור תא בטאב הראשון" : "Choose first-tab cell", value: "meta-output:firstTabCell" } : null,
      { label: hebrew ? "לפתוח כלי Meta" : "Open Meta Tags Studio", value: "open-tool" }
    ].filter(Boolean);
    ask("metaOutput", [
      prefix,
      currentTarget,
      canWrite
        ? (hebrew
          ? "לאן להכניס את התוצאות? בדיקה מקדימה לא כותבת לגיליון. כתיבה לגיליון דורשת בחירה אם לדלג או לדרוס תאים מלאים."
          : "Where should the output go? Preview does not write to the Sheet. Sheet writeback needs a skip/overwrite choice.")
        : (hebrew
          ? "המקור אינו Google Sheet או תיקיית Drive, לכן אפשר להריץ בדיקה מקדימה או לפתוח את הכלי."
          : "This source is not a Google Sheet or Drive folder, so I can generate a preview or open the tool.")
    ].filter(Boolean).join("\n\n"), replies);
  }

  function advanceMetaToolFlow(prefix = "") {
    updateToolMissingInputs();
    renderWorkspace();
    const next = state.missingInputs[0];
    if (!next) {
      finishToolSetup(prefix);
      return;
    }
    if (next === "pageList") return askMetaSource(prefix);
    if (next === "metaPageSource") return askMetaPageSource(prefix);
    if (next === "metaFields") {
      const latestUserText = [...state.messages].reverse().find((message) => message.role === "user")?.text || "";
      const inferredFields = inferMetaFields(latestUserText);
      if (inferredFields) {
        setMetaFields(inferredFields);
        advanceMetaToolFlow(prefix);
        return;
      }
      return askMetaFields(prefix);
    }
    if (next === "languages") return askMetaLanguage(prefix);
    if (next === "generationMode") return askMetaGeneration(prefix);
    if (next === "outputMode") return askMetaOutput(prefix);
    finishToolSetup(prefix);
  }

  function handleMetaStepText(text) {
    if (state.activeToolId !== "meta-tags" || state.mode !== "tool") return false;
    const clean = compact(text);
    if (!clean) return false;
    if (state.step === "metaPageSource") {
      if (/ידני|manual|רשימה/i.test(clean)) {
        state.pendingQuestion = { toolId: state.activeToolId, key: "metaManualPages" };
        ask("toolField", prefersHebrew() ? "כתבי כל עמוד בשורה נפרדת." : "Send each page on a separate line.", []);
        return true;
      }
      state.collectedInputs.metaPageSourceConfirmed = true;
      advanceToolFlow(prefersHebrew() ? "אשתמש בשם הקובץ/המקור כשם העמוד." : "I’ll use the source/file name as the page topic.");
      return true;
    }
    if (state.step === "metaFields") {
      const fields = inferMetaFields(clean) || (/h1/i.test(clean) ? "titleDescriptionH1" : "titleDescription");
      setMetaFields(fields);
      advanceToolFlow(prefersHebrew() ? `אבנה: ${metaFieldLabel()}.` : `I’ll generate: ${metaFieldLabel()}.`);
      return true;
    }
    if (state.step === "metaLanguage") {
      const langs = detectLanguagesFromText(clean, []);
      if (!langs.length) return false;
      state.collectedInputs.languages = langs;
      state.collectedInputs.metaLanguageConfirmed = true;
      advanceToolFlow(prefersHebrew() ? `השפה תהיה ${localizedLanguageCodes(langs)}.` : `Language set to ${localizedLanguageCodes(langs)}.`);
      return true;
    }
    if (state.step === "metaGeneration") {
      if (/\bai\b|בינה|איי/i.test(clean)) {
        state.collectedInputs.generationMode = "ai";
      } else {
        state.collectedInputs.generationMode = "template";
      }
      state.collectedInputs.metaGenerationConfirmed = true;
      advanceToolFlow(state.collectedInputs.generationMode === "ai"
        ? (prefersHebrew() ? "אבנה ניסוחים עם AI." : "I’ll use AI-written copy.")
        : (prefersHebrew() ? "אבנה מתבנית מהירה בלי AI." : "I’ll use a fast template without AI."));
      return true;
    }
    if (state.step === "metaFirstTabCell") {
      const cell = extractExplicitOutputCell(clean) || extractOutputCell(clean, "");
      if (!cell) {
        ask("metaFirstTabCell", prefersHebrew() ? "לאיזה תא בטאב הראשון לכתוב? למשל E70." : "Which first-tab cell should I start at? For example E70.", [
          { label: "E70", value: "toolfield:metaFirstTabCell:E70", primary: true },
          { label: "A1", value: "toolfield:metaFirstTabCell:A1" }
        ]);
        return true;
      }
      state.collectedInputs.outputMode = "firstTabRange";
      state.collectedInputs.outputStartCell = cell.includes("!") ? cell.split("!").pop().toUpperCase() : cell.toUpperCase();
      state.collectedInputs.metaOutputConfirmed = true;
      setExistingValuePolicy("skip");
      advanceToolFlow(prefersHebrew()
        ? `יעד הפלט: הטאב הראשון מתא ${state.collectedInputs.outputStartCell}, רק אם התאים ריקים.`
        : `Output destination: first tab from ${state.collectedInputs.outputStartCell}, only if cells are empty.`);
      return true;
    }
    if (state.step === "metaOutput") {
      if (applyMetaOutputIntentFromText(clean, { confirm: true })) {
        advanceToolFlow(prefersHebrew() ? `יעד הפלט: ${metaOutputLabel()}.` : `Output destination: ${metaOutputLabel()}.`);
        return true;
      }
      askMetaOutput(prefersHebrew()
        ? "לא הצלחתי להבין יעד פלט. אפשר לבחור בדיקה מקדימה, טאב Meta Tags, או תא בטאב הראשון."
        : "I could not read the output target. Choose preview, the Meta Tags tab, or a first-tab cell.");
      return true;
    }
    return false;
  }

  function faqAuditDiscoveryPayload() {
    const maxUrls = Number(state.collectedInputs.maxDiscoveryUrls) || 1000;
    return {
      mode: "site-ai-discovery",
      startUrl: state.collectedInputs.siteUrl,
      maxUrls,
      maxDepth: Number(state.collectedInputs.maxDepth) || 3,
      maxFaqCandidateChecks: Math.min(300, Math.max(80, maxUrls * 2)),
      faqCandidateConcurrency: 12,
      fetchTimeoutMs: 5000
    };
  }

  function faqAuditGroupLabel(group) {
    const labels = {
      faq: "FAQ",
      hotel: "Hotels / properties",
      location: "Locations / cities",
      offer: "Offers",
      blog: "Blog / content",
      legal: "Legal",
      contact: "Contact / about",
      booking: "Booking",
      asset: "Static assets",
      other: "Other"
    };
    return labels[group] || String(group || "");
  }

  function faqAuditGroupAliases(group) {
    const aliases = {
      faq: ["faq", "faqs", "faqpage", "questions", "שאלות", "שאלות ותשובות"],
      hotel: ["hotel", "hotels", "property", "properties", "מלון", "מלונות", "נכס", "נכסים"],
      location: ["location", "locations", "city", "cities", "מיקום", "מיקומים", "עיר", "ערים"],
      offer: ["offer", "offers", "deal", "deals", "מבצע", "מבצעים", "הטבה", "הטבות"],
      blog: ["blog", "content", "article", "articles", "בלוג", "תוכן", "מאמר", "מאמרים"],
      legal: ["legal", "policy", "policies", "terms", "privacy", "משפטי", "מדיניות", "תנאים", "פרטיות"],
      contact: ["contact", "about", "support", "צור קשר", "אודות", "תמיכה"],
      booking: ["booking", "book", "reservation", "reservations", "הזמנה", "הזמנות"],
      asset: ["asset", "assets", "static", "image", "images", "קבצים", "נכסים", "תמונות"],
      other: ["other", "misc", "miscellaneous", "אחר", "אחרים"]
    };
    return aliases[group] || [String(group || "")];
  }

  function textMatchesFaqAuditGroup(text, group) {
    const lower = String(text || "").toLowerCase();
    const label = faqAuditGroupLabel(group).toLowerCase();
    return faqAuditGroupAliases(group).some((alias) => lower.includes(alias.toLowerCase())) ||
      label.split("/").some((part) => part.trim() && lower.includes(part.trim()));
  }

  function faqAuditAvailableGroups() {
    return (state.faqAuditDiscovery?.groups || [])
      .map((group) => typeof group === "string" ? { group, count: 0 } : group)
      .filter((group) => group?.group);
  }

  function defaultFaqAuditGroups(groups = faqAuditAvailableGroups()) {
    const available = groups
      .map((group) => typeof group === "string" ? group : group?.group)
      .filter(Boolean);
    const defaults = ["faq", "hotel", "location"].filter((group) => available.includes(group));
    return defaults.length ? defaults : available.slice(0, 3);
  }

  function selectedFaqAuditGroups() {
    return Array.isArray(state.collectedInputs.groups) ? state.collectedInputs.groups.filter(Boolean) : [];
  }

  function selectedFaqAuditGroupLabel() {
    const groups = selectedFaqAuditGroups();
    return groups.length ? groups.map(faqAuditGroupLabel).join(" + ") : "No groups selected";
  }

  function faqAuditUrlsForGroups(groups = selectedFaqAuditGroups()) {
    const selected = new Set(groups);
    const urls = Array.isArray(state.faqAuditDiscovery?.urls) ? state.faqAuditDiscovery.urls : [];
    return urls
      .filter((item) => {
        const itemGroups = Array.isArray(item?.groups) ? item.groups : [];
        return itemGroups.some((group) => selected.has(group));
      })
      .map((item) => item.url)
      .filter(Boolean);
  }

  function syncFaqAuditSelectedUrls() {
    if (state.activeToolId !== "site-ai-faq-audit") return;
    if (!hasFaqAuditDiscovery()) return;
    const groups = selectedFaqAuditGroups();
    if (!groups.length) {
      delete state.collectedInputs.urls;
      return;
    }
    state.collectedInputs.urls = faqAuditUrlsForGroups(groups);
  }

  function selectedFaqAuditUrlCount() {
    const urls = Array.isArray(state.collectedInputs.urls) && state.collectedInputs.urls.length
      ? state.collectedInputs.urls
      : faqAuditUrlsForGroups();
    return urls.filter(Boolean).length;
  }

  function faqAuditGroupsFromText(text) {
    const clean = compact(text);
    const lower = clean.toLowerCase();
    const available = faqAuditAvailableGroups().map((group) => group.group);
    if (!available.length) return [];
    if (/\b(all|everything|all groups)\b|הכל|כל הקבוצות/i.test(clean)) return available;
    if (/\b(recommended|default|suggested)\b|ברירת מחדל|מומלץ|מומלצות/i.test(clean)) return defaultFaqAuditGroups();
    return available.filter((group) => textMatchesFaqAuditGroup(lower, group));
  }

  function applyFaqAuditGroupText(text) {
    const groups = faqAuditGroupsFromText(text);
    if (!groups.length) return false;
    state.collectedInputs.groups = groups;
    state.collectedInputs.urls = faqAuditUrlsForGroups(groups);
    state.faqAuditGroupSelectionTouched = true;
    updateToolMissingInputs();
    finishToolSetup(prefersHebrew()
      ? "בחרתי את קבוצות ה־URL מתוך המיפוי. עכשיו אפשר להריץ FAQ audit."
      : "Selected the URL groups from discovery. The FAQ audit is ready to run.");
    return true;
  }

  function applyFaqAuditDiscoveryTextSettings(text) {
    let changed = false;
    const urlBudget = String(text || "").match(/\b(100|250|500|750|1000|1500|2000)\s*(?:urls?|כתובות)?\b/i);
    if (urlBudget) {
      state.collectedInputs.maxDiscoveryUrls = Number(urlBudget[1]);
      changed = true;
    }
    const depth = String(text || "").match(/\bdepth\s*(\d+)|עומק\s*(\d+)/i);
    if (depth) {
      state.collectedInputs.maxDepth = Number(depth[1] || depth[2]) || 3;
      changed = true;
    }
    return changed;
  }

  function isFaqAuditDiscoveryRunText(text) {
    return /map|mapping|discover|discovery|crawl|crawler|scan|sitemap|robots|start|run|go ahead|continue|yes|למפות|מיפוי|תמפה|מפה|סרוק|לסרוק|סריקה|תסרקי|תסרוק|להמשיך|תמשיכי|כן|יאללה/i.test(String(text || ""));
  }

  function handleFaqAuditDiscoveryText(text) {
    if (state.activeToolId !== "site-ai-faq-audit" || state.step !== "toolDiscovery") return false;
    const changed = applyFaqAuditDiscoveryTextSettings(text);
    if (isFaqAuditDiscoveryRunText(text)) {
      runFaqAuditDiscovery();
      return true;
    }
    if (changed) {
      askFaqAuditDiscovery();
      return true;
    }
    return false;
  }

  function askFaqAuditDiscovery(prefix = "") {
    const hebrew = prefersHebrew();
    state.step = "toolDiscovery";
    state.activeStep = "faqAuditDiscovery";
    state.pendingQuestion = { toolId: state.activeToolId, key: "discoveryMapped" };
    const url = state.collectedInputs.siteUrl;
    const maxUrls = Number(state.collectedInputs.maxDiscoveryUrls) || 1000;
    const depth = Number(state.collectedInputs.maxDepth) || 3;
    ask("toolDiscovery", [
      prefix,
      hebrew
        ? `קודם נמפה את האתר, כדי לבחור את העמודים הנכונים לאודיט ה־FAQ.\n\nאתר: ${url}\nמיפוי: עד ${maxUrls} כתובות · עומק ${depth}`
        : `First we need to map the site, matching the original workspace flow. This checks robots.txt, sitemaps and internal URL groups before choosing pages for the FAQ audit.\n\nSite: ${url}\nMapping: up to ${maxUrls} URLs · depth ${depth}`
    ].filter(Boolean).join("\n\n"), [
      { label: hebrew ? "למפות אתר" : "Map site", value: "faqaudit:map-site", primary: true },
      { label: hebrew ? "500 URLs" : "500 URLs", value: "faqaudit:maxurls:500" },
      { label: hebrew ? "1000 URLs" : "1000 URLs", value: "faqaudit:maxurls:1000" },
      { label: hebrew ? "עומק 2" : "Depth 2", value: "faqaudit:depth:2" },
      { label: hebrew ? "עומק 3" : "Depth 3", value: "faqaudit:depth:3" },
      { label: hebrew ? "לפתוח כלי אודיט" : "Open workspace", value: "open-tool" }
    ]);
  }

  function runFaqAuditDiscovery() {
    const tool = getTool("site-ai-faq-audit");
    if (!tool || !state.collectedInputs.siteUrl) {
      advanceToolFlow();
      return;
    }
    if (!socket?.connected) {
      bot(prefersHebrew() ? "החיבור לשרת המקומי לא פעיל כרגע. פתחי את השרת ורענני, ואז אוכל למפות את האתר." : "The demo backend socket is not connected. Start the server and refresh, then I can map the site.");
      logLine("Backend socket is not connected.", "warn");
      return;
    }
    const payload = faqAuditDiscoveryPayload();
    state.running = true;
    state.runningToolId = tool.id;
    state.runningPayload = payload;
    state.lastPayload = payload;
    state.faqAuditDiscoveryPending = true;
    renderWorkspace();
    bot(prefersHebrew() ? "ממפה את האתר עכשיו. אחרי המיפוי נבחר קבוצות עמודים ואז נריץ את אודיט ה־FAQ." : "Mapping the site now. After discovery, we’ll choose URL groups and then run the FAQ audit.");
    setQuickReplies([
      { label: prefersHebrew() ? "פרטים טכניים" : "Show payload", value: "review" },
      { label: prefersHebrew() ? "לפתוח כלי" : "Open workspace", value: "open-tool" }
    ]);
    logLine("Starting AI FAQ Audit site discovery...");
    logLine(`Mode: ${payload.mode}`);
    socket.emit("start-agent", payload);
  }

  function applyFaqAuditDiscoveryResult(result) {
    if (!result || !Array.isArray(result.urls)) return;
    state.faqAuditDiscovery = result;
    state.collectedInputs.discoveryMapped = true;
    state.collectedInputs.groups = [];
    state.faqAuditGroupSelectionTouched = false;
    state.collectedInputs.maxDiscoveryUrls = Number(state.collectedInputs.maxDiscoveryUrls) || Number(result.urls.length) || 1000;
    state.faqAuditDiscoveryPending = false;
    updateToolMissingInputs();
  }

  function faqAuditGroupReplies() {
    const hebrew = prefersHebrew();
    const selected = new Set(selectedFaqAuditGroups());
    const groups = faqAuditAvailableGroups();
    const allGroups = groups.map((group) => group.group);
    const allSelected = allGroups.length > 0 && allGroups.every((group) => selected.has(group));
    const groupReplies = groups.slice(0, 8).map((group) => ({
      label: `${selected.has(group.group) ? "✓ " : ""}${faqAuditGroupLabel(group.group)}${group.count ? ` · ${group.count}` : ""}`,
      value: `faqaudit-group-toggle:${group.group}`,
      selected: selected.has(group.group),
      echo: false
    }));
    return [
      ...groupReplies,
      { label: `${allSelected ? "✓ " : ""}${hebrew ? "כל הקבוצות" : "All groups"}`, value: "faqaudit-groups:all", selected: allSelected, echo: false },
      { label: hebrew ? "לנקות בחירה" : "Clear selection", value: "faqaudit-groups:clear", echo: false },
      { label: hebrew ? "בחירת ברירת מחדל" : "Recommended groups", value: "faqaudit-groups:recommended", echo: false },
      { label: hebrew ? "חזרה" : "Back", value: "faqaudit-groups:back", echo: false },
      { label: hebrew ? "להמשיך" : "Continue", value: "faqaudit-groups-done", primary: true, echo: false }
    ];
  }

  function askFaqAuditGroups(prefix = "") {
    const hebrew = prefersHebrew();
    state.step = "toolField";
    state.activeStep = "faqAuditGroups";
    state.pendingQuestion = { toolId: state.activeToolId, key: "groups" };
    const result = state.faqAuditDiscovery || {};
    const urlCount = Array.isArray(result.urls) ? result.urls.length : 0;
    const groupCount = Array.isArray(result.groups) ? result.groups.length : 0;
    ask("toolField", [
      prefix,
      hebrew
        ? `המיפוי הושלם: ${urlCount} URLs ו־${groupCount} קבוצות נמצאו. אילו קבוצות להריץ באודיט ה־FAQ? אפשר לבחור יותר מאחת, לבחור ברירת מחדל מומלצת, ואז להמשיך.`
        : `Discovery is complete: ${urlCount} URLs and ${groupCount} groups found. Which groups should the FAQ audit inspect? Choose one or more, or use the recommended groups, then continue.`
    ].filter(Boolean).join("\n\n"), faqAuditGroupReplies());
  }

  function refreshFaqAuditGroupReplies() {
    if (state.step !== "toolField" || state.pendingQuestion?.key !== "groups") return;
    setQuickReplies(faqAuditGroupReplies());
    renderWorkspace();
  }

  function prefersHebrew() {
    return isHebrewUi();
  }

  function fieldQuestionText(tool, field) {
    if (!prefersHebrew()) return field.question || `Send ${field.label}.`;
    const key = `${tool.id}:${field.key}`;
    const localized = {
      "design-formatting:targetUrl": "שלחי את ה־Google Sheet שצריך לערוך.",
      "design-formatting:instruction": "מה לשנות בגיליון? אפשר לכתוב חופשי: טאב, עמודות, כפילויות, ניסוח, ניקוי או כללי עריכה.",
      "translate-demo:sourceUrl": "שלחי Google Sheet או תיקיית Drive לתרגום.",
      "translate-demo:targetLangs": "לאילו שפות לתרגם?",
      "schema-builder:sourceUrl": "שלחי Google Sheet או תיקיית Drive עם שורות ה־FAQ.",
      "meta-tags:pageList": "אילו עמודים, דומיין, Google Sheet או תיקיית Drive צריכים Meta tags?",
      "client-reports:spreadsheetId": "איזה Google Sheet ישמש לדוח הלקוח?",
      "client-reports:sourceType": "מאיזה מקור למשוך נתונים לדוח: Analytics או Google Sheet?",
      "client-reports:analyticsAccount": "איזה חשבון Analytics להשתמש בו?",
      "sheet-utilities:instruction": "איזו פעולת Sheet Utilities להכין? אפשר לתאר VLOOKUP, הצלבה, כיסוי, העתקת עמודות או folder-to-master.",
      "site-ai-audit:siteUrl": "איזה אתר לבדוק?",
      "site-ai-audit:auditProfile": "איזה סוג אודיט להריץ?",
      "site-ai-audit:auditFocus": "מה לבדוק באודיט?",
      "site-ai-audit:maxPages": "כמה עמודים לבדוק לעומק?",
      "site-ai-faq-audit:siteUrl": "איזה אתר לבדוק ל־FAQ ול־Schema?"
    };
    return localized[key] || field.question || `שלחי ${field.label}.`;
  }

  function localizedToolReply(reply = {}) {
    if (!prefersHebrew()) return reply;
    const value = reply.value || "";
    const exact = {
      "toolfield:sourceTab:__auto__": "זיהוי אוטומטי",
      "toolfield:splitIntoTwo:true": "כן, לחלק ל־2",
      "toolfield:splitIntoTwo:false": "לא, מעבר אחד",
      "toolfield:preserveTerms:none": "אין ביטויים מיוחדים",
      "toolfield:glossaryLines:none": "בלי glossary",
      "toolfield:terminologyLines:none": "בלי terminology",
      "toolfield:languageNotes:Natural native wording, clear FAQ style, faithful to the source.": "טבעי, מקומי, FAQ ברור",
      "toolfield:languageNotes:Formal, polished hospitality wording. Keep facts exact and avoid over-promising.": "פורמלי ומלוטש למלונאות",
      "schema:preview": "בדיקה מקדימה בלבד",
      "schema:write": "לכתוב לגיליון",
      "schema:output": "לשנות תא פלט",
      "schema:columns:B:C": "עמודות B / C",
      "meta:template": "Template",
      "meta:ai": "AI mode",
      "meta:preview": "בדיקה מקדימה בלבד",
      "auditprofile:general-fast": "מהיר כללי",
      "auditprofile:full-ai": "מלא + AI summary",
      "auditprofile:faq-schema": "FAQ / Schema",
      "auditprofile:rendered-deep": "עמוק עם JS rendered",
      "audit:no-ai": "בלי AI summary",
      "faqaudit:static": "סריקה סטטית",
      "faqaudit:rendered": "סריקה מרונדרת",
      "faqaudit:source": "להשוות ל־Sheet מקור",
      "format:dry-run": "לבדוק בלי לכתוב",
      "format:preview": "בדיקה מקדימה",
      "open-tool": "לפתוח כלי"
    };
    if (exact[value]) return { ...reply, label: exact[value] };
    if (value.startsWith("lang:")) {
      const code = value.replace("lang:", "");
      return { ...reply, label: localizedLanguageCode(code) || reply.label };
    }
    if (value.startsWith("toolfield:maxPages:")) {
      const count = value.split(":").pop();
      const labels = { 15: "זריז · 15 עמודים", 25: "סטנדרטי · 25 עמודים", 50: "עמוק · 50 עמודים", 100: "עמוק מאוד · 100 עמודים" };
      return { ...reply, label: labels[count] || `${count} עמודים` };
    }
    if (value.startsWith("toolfield:auditFocus:")) {
      return { ...reply, label: siteAuditFocusLabel(value.split(":").pop()) };
    }
    return reply;
  }

  function advanceToolFlow(prefix = "") {
    const tool = getTool(state.activeToolId);
    if (!tool) return;
    updateToolMissingInputs();
    renderWorkspace();

    if (faqAuditNeedsDiscovery(tool)) {
      askFaqAuditDiscovery(prefix);
      return;
    }

    if (tool.id === "meta-tags") {
      advanceMetaToolFlow(prefix);
      return;
    }

    const missingField = firstMissingField(tool);
    if (missingField) {
      state.pendingQuestion = { toolId: tool.id, key: missingField.key };
      if (["targetLangs", "languages"].includes(missingField.key)) {
        askToolLanguages(tool, missingField, prefix);
        return;
      }
      if (tool.id === "site-ai-audit" && missingField.key === "auditFocus") {
        askSiteAuditChecks();
        return;
      }
      ask("toolField", [prefix, fieldQuestionText(tool, missingField)].filter(Boolean).join("\n\n"), toolFieldReplies(tool, missingField));
      return;
    }

    finishToolSetup(prefix);
  }

  function toolFieldReplies(tool, field) {
    if (Array.isArray(field.quickReplies) && field.quickReplies.length) {
      return field.quickReplies.map(localizedToolReply);
    }
    if (field.key === "sourceUrl" || field.key === "siteUrl" || field.key === "targetUrl") {
      return state.sources.slice(0, 4).map((source) => ({
        label: source.kind === "Website"
          ? (prefersHebrew() ? `להשתמש ב־${source.url.replace(/^https?:\/\//, "").slice(0, 34)}` : `Use ${source.url.replace(/^https?:\/\//, "").slice(0, 34)}`)
          : (prefersHebrew() ? `להשתמש ב־${source.kind}` : `Use ${source.kind}`),
        value: `toolfield:${field.key}:${source.url}`
      }));
    }
    if (field.key === "targetLangs" || field.key === "languages") return toolLanguageReplies(field.key);
    return (tool.quickReplies || []).map(localizedToolReply);
  }

  function assignToolField(key, rawText) {
    const clean = compact(rawText);
    if (!key) return;
    if (["sourceUrl", "siteUrl", "targetUrl", "sourceInput"].includes(key)) {
      const url = extractUrl(clean) || clean;
      state.collectedInputs[key] = url;
      if (state.activeToolId === "site-ai-faq-audit" && key === "siteUrl") {
        state.faqAuditDiscovery = null;
        state.faqAuditDiscoveryPending = false;
        state.faqAuditGroupSelectionTouched = false;
        delete state.collectedInputs.discoveryMapped;
        delete state.collectedInputs.groups;
      }
      recordSource(url, `${getTool(state.activeToolId)?.title || "tool"} ${key}`, state.activeToolId);
      return;
    }
    if (state.activeToolId === "meta-tags" && key === "pageList") {
      const url = extractUrl(clean);
      const type = detectSourceType(url || clean);
      if (type === "sheet" || type === "folder") {
        state.collectedInputs.sourceUrl = url || clean;
        state.collectedInputs.pageList = type === "folder" ? "Use spreadsheet file names in the Drive folder as page topics." : "Use the spreadsheet file name as the page topic.";
        state.collectedInputs.metaPageSourceConfirmed = false;
        recordSource(state.collectedInputs.sourceUrl, "Meta Tags source", "meta-tags");
        return;
      }
      state.collectedInputs.sourceUrl = type === "website" ? "" : state.collectedInputs.sourceUrl || "";
      state.collectedInputs.pageList = clean;
      state.collectedInputs.metaPageSourceConfirmed = true;
      if (type === "website") recordSource(url || clean, "Meta Tags page", "meta-tags");
      return;
    }
    if (state.activeToolId === "meta-tags" && key === "metaManualPages") {
      state.collectedInputs.sourceUrl = "";
      state.collectedInputs.pageList = clean;
      state.collectedInputs.outputMode = "preview";
      state.collectedInputs.metaPageSourceConfirmed = true;
      return;
    }
    if (state.activeToolId === "meta-tags" && key === "metaFirstTabCell") {
      const cell = extractExplicitOutputCell(clean) || extractOutputCell(clean, "");
      state.collectedInputs.outputMode = "firstTabRange";
      state.collectedInputs.outputStartCell = (cell || "A1").includes("!")
        ? (cell || "A1").split("!").pop().toUpperCase()
        : (cell || "A1").toUpperCase();
      state.collectedInputs.metaOutputConfirmed = true;
      setExistingValuePolicy("skip");
      return;
    }
    if (key === "sourceTab" && clean === "__auto__") {
      state.collectedInputs[key] = "__auto__";
      return;
    }
    if (key === "splitIntoTwo") {
      state.collectedInputs[key] = /^(true|yes|split|כן)$/i.test(clean);
      return;
    }
    if (["includeAiAnalysis", "respectRobots"].includes(key)) {
      state.collectedInputs[key] = /^(true|yes|כן|on|enable|respect)$/i.test(clean);
      return;
    }
    if (["targetLangs", "languages"].includes(key)) {
      const langs = detectLanguagesFromText(clean, manifestSplitList(clean));
      state.collectedInputs[key] = langs.length ? langs : manifestSplitList(clean);
      if (state.activeToolId === "meta-tags" && key === "languages") state.collectedInputs.metaLanguageConfirmed = true;
      return;
    }
    if (key === "groups" && state.activeToolId === "site-ai-faq-audit") {
      const groups = faqAuditGroupsFromText(clean);
      state.collectedInputs.groups = groups.length ? groups : manifestSplitList(clean);
      state.collectedInputs.urls = faqAuditUrlsForGroups(state.collectedInputs.groups);
      state.faqAuditGroupSelectionTouched = true;
      return;
    }
    if (["maxPages", "maxFiles", "maxDepth", "startRow", "maxRows", "sourceHeaderRow"].includes(key)) {
      const number = Number(clean.match(/\d+/)?.[0] || clean);
      state.collectedInputs[key] = Number.isFinite(number) && number > 0 ? number : clean;
      if (state.activeToolId === "site-ai-audit") applySiteAuditHints(clean, { includePages: false });
      return;
    }
    if (key === "outputCell") {
      const cell = extractExplicitOutputCell(clean) || extractOutputCell(clean, clean);
      state.collectedInputs[key] = cell.trim();
      if (state.activeToolId === "schema-builder" && /write|inject|save|to sheet|לכתוב|להכניס|לשמור|לגיליון/i.test(clean)) {
        state.collectedInputs.previewOnly = false;
        state.collectedInputs.dryRun = false;
      }
      return;
    }
    if (key === "auditProfile") {
      if (/faq|schema|שאלות|סכמה/i.test(clean)) state.collectedInputs[key] = "faq-schema";
      else if (/render|playwright|javascript|js|עמוק|דפדפן/i.test(clean)) state.collectedInputs[key] = "rendered-deep";
      else if (/ai|full|מלא/i.test(clean)) state.collectedInputs[key] = "full-ai";
      else state.collectedInputs[key] = "general-fast";
      applySiteAuditProfile(state.collectedInputs[key]);
      return;
    }
    if (key === "auditFocus") {
      const requestedChecks = [
        [/sitemap|site map|מפת אתר/i, "includeSitemap"],
        [/llms\.?txt|llms|ai file/i, "includeLlmsTxt"],
        [/faq|שאלות/i, "includeFaqAudit"],
        [/schema|structured|json-ld|סכמה|סכימה/i, "includeStructuredData"],
        [/answer|answerability|geo|ai readiness|מענה|תשובות/i, "includeAnswerability"],
        [/meta|metadata|title|description|seo|מטא|טייטל/i, "includeMetaAudit"],
        [/links?|trust|domains?|קישור|קישורים|אמון/i, "includeLinkAudit"]
      ].filter(([pattern]) => pattern.test(clean)).map(([, id]) => id);
      if (requestedChecks.length > 1) {
        state.collectedInputs.auditFocus = "custom";
        auditCheckOptions().forEach((item) => {
          state.collectedInputs[item.id] = requestedChecks.includes(item.id);
        });
        return;
      }
      const focus = /faq|schema|שאלות|סכמה/i.test(clean)
        ? "faq-schema"
        : (/technical|meta|seo|טכני|מטא/i.test(clean)
          ? "technical-meta"
          : (/links?|trust|domains?|קישור|אמון/i.test(clean)
            ? "links-trust"
            : (/answer|ai|geo|מענה|תשובות/i.test(clean) ? "answerability" : "full")));
      applySiteAuditFocus(focus);
      return;
    }
    if (key === "columnTransfer") {
      const columns = extractColumnTransfer(clean);
      state.collectedInputs.sourceColumn = columns.sourceColumn || state.collectedInputs.sourceColumn || "F";
      state.collectedInputs.targetColumn = columns.targetColumn || state.collectedInputs.targetColumn || "C";
      state.collectedInputs.operationType = "replace_column_when_value";
      state.collectedInputs.instruction = [state.collectedInputs.instruction, clean]
        .map((item) => compact(item || ""))
        .filter(Boolean)
        .filter((item, index, arr) => arr.indexOf(item) === index)
        .join("\n");
      return;
    }
    if (key === "questionColumn" || key === "answerColumn") {
      state.collectedInputs[key] = clean.match(/[A-Z]{1,3}/i)?.[0]?.toUpperCase() || clean;
      return;
    }
    state.collectedInputs[key] = clean;
  }

  function buildToolPayload(tool, values) {
    if (typeof tool.payloadBuilder === "function") return tool.payloadBuilder(values);
    if (typeof tool.buildPayload === "function") return tool.buildPayload(values);
    return { mode: tool.mode, ...values };
  }

  function smartRouterTools() {
    return (manifest.tools || []).map((tool) => ({
      id: tool.id,
      title: tool.title,
      description: tool.description,
      intentHints: tool.intentHints || tool.keywords || [],
      capability: tool.capability || null,
      requiredInputs: (tool.requiredInputs || []).map((field) => ({ key: field.key, label: field.label, type: field.type })),
      optionalInputs: (tool.optionalInputs || []).map((field) => ({ key: field.key, label: field.label, type: field.type })),
      status: tool.status,
      risk: tool.risk,
      canRunDirectly: Boolean(tool.canRunDirectly)
    }));
  }

  function activeActionSnapshot() {
    if (!state.activeToolId && !state.taskMemory.lastToolId) return null;
    return {
      toolId: state.activeToolId || state.taskMemory.lastToolId,
      values: state.collectedInputs,
      lastPayload: state.lastPayload,
      lastRun: state.lastRun,
      taskMemory: state.taskMemory
    };
  }

  function commandPlannerSnapshot(text) {
    return {
      mode: state.mode,
      step: state.step,
      activeStep: state.activeStep,
      activeToolId: state.activeToolId,
      pendingQuestion: state.pendingQuestion,
      readyToRun: state.readyToRun,
      latestSheetUrl: latestSheetUrl(),
      latestGeneratedSheetUrl: latestGeneratedSheetUrl(),
      lastSheetUrl: state.taskMemory.lastSheet?.url || "",
      lastOperation: state.taskMemory.lastOperation || latestDesignFormattingOperation(),
      outputs: state.outputs.slice(0, 3),
      sources: state.sources.slice(0, 5),
      locale: state.chatLocale
    };
  }

  function planDeterministicAssistantCommands(text) {
    const planner = window.AssistantCommandModel?.planDeterministicCommands;
    if (typeof planner !== "function") return [];
    try {
      return (planner(text, commandPlannerSnapshot(text)) || [])
        .filter((command) => command && Number(command.confidence || 0) >= 0.72);
    } catch (error) {
      logLine(`Command planner skipped: ${error.message || error}`, "warn");
      return [];
    }
  }

  function commandSwitchPrefix(command, tool) {
    if (command.type !== "switch_task") return "";
    if (prefersHebrew()) {
      if (tool?.id === "site-ai-faq-audit") return "הבנתי, זו לא יצירת FAQ. מחליפה לבדיקת הטמעת FAQ / Schema באתר.";
      if (tool?.id === "design-formatting") return "מחליפה לעריכת Google Sheet.";
      return `מחליפה ל־${tool?.title || "הכלי המתאים"}.`;
    }
    if (tool?.id === "site-ai-faq-audit") return "Switching to the FAQ / schema implementation audit.";
    if (tool?.id === "design-formatting") return "Switching to Google Sheet editing.";
    return `Switching to ${tool?.title || "the right tool"}.`;
  }

  function startToolFromCommand(command, text) {
    const tool = getTool(command.toolId);
    if (!tool) return false;
    const values = command.fields || {};
    const prefix = commandSwitchPrefix(command, tool);
    if (tool.id === "faq-playground") {
      startFaqFromSmart(values, prefix || text, text);
      return true;
    }
    if (tool.id === "file-draft") {
      startFileFromSmart(values, prefix || text);
      return true;
    }

    state.mode = "tool";
    state.step = "tool";
    state.activeIntent = tool.id;
    state.activeToolId = tool.id;
    state.activeStep = "collecting";
    state.collectedInputs = mergeSmartToolValues(tool, text, values);
    if (tool.id === "meta-tags") {
      initializeMetaFlow(text);
    }
    if (tool.id === "site-ai-faq-audit") {
      state.faqAuditDiscovery = null;
      state.faqAuditDiscoveryPending = false;
      state.faqAuditGroupSelectionTouched = false;
      delete state.collectedInputs.discoveryMapped;
      delete state.collectedInputs.groups;
    }
    state.pendingQuestion = null;
    state.readyToRun = false;
    state.lastPayload = null;
    state.liveRunConfirmed = false;
    state.runConfirmed = false;
    recordSourcesFromText(text, `${tool.title} command route`);
    updateToolMissingInputs();
    advanceToolFlow(prefix);
    return true;
  }

  function handleAssistantCommand(command, text) {
    const type = command?.type || "";
    if (!type) return false;
    if (type === "show_result") {
      bot(describeLastRunOutput(text));
      if (state.mode === "tool" && state.activeToolId) setGenericReadyReplies(getTool(state.activeToolId));
      return true;
    }
    if (type === "show_payload") {
      handleSpecialReply("review");
      return true;
    }
    if (type === "open_workspace") {
      openCurrentToolWorkspace();
      return true;
    }
    if (type === "confirm_run") {
      if (state.activeToolId === "faq-playground" || state.mode === "faq") runWorkflow();
      else runCurrentTool({ confirmed: true });
      return true;
    }
    if (type === "request_dry_run" && state.activeToolId === "design-formatting") {
      state.collectedInputs.dryRun = true;
      state.liveRunConfirmed = false;
      updateToolMissingInputs();
      runCurrentTool();
      return true;
    }
    if (type === "set_field") {
      assignToolField(command.key, String(command.value || ""));
      advanceToolFlow();
      return true;
    }
    if (type === "start_sheet_edit") {
      startSheetEditFollowup(text);
      return true;
    }
    if (type === "start_column_transfer") {
      startColumnTransferFollowup(text);
      return true;
    }
    if (type === "start_task" || type === "switch_task") {
      return startToolFromCommand(command, text);
    }
    if (type === "append_instruction") {
      appendToolInstruction(command.text || text);
      finishToolSetup(hasHebrew(text) ? "הוספתי את זה כהנחיה לכלי." : "Added that as a tool instruction.");
      return true;
    }
    return false;
  }

  function handlePlannedAssistantCommands(text) {
    const commands = planDeterministicAssistantCommands(text);
    if (!commands.length) return false;
    for (const command of commands) {
      if (handleAssistantCommand(command, text)) {
        logLine(`Command planner: ${command.type}${command.toolId ? ` -> ${command.toolId}` : ""} (${command.reason || "deterministic"})`, "ok");
        return true;
      }
    }
    return false;
  }

  function shouldUseSmartRouter(text) {
    const clean = compact(text);
    if (clean.length < 16) return false;
    if (state.step !== "idle") return false;
    if (detectToolIntent(clean) || isFileIntent(clean)) return false;
    return /סוכן|תבנה|תעשה|להכין|לנהל|קבצים|מסמכים|לחפש|למצוא|להשלים|למלא|מקורות|תשובות|תשובות חסרות|workflow|agent|build|create|prepare|manage|plan|content|files|documents|search|find|complete|answers|sources/i.test(clean);
  }

  function startFaqFromSmart(values = {}, reply = "", text = "") {
    const sourceText = text || reply || "";
    state.mode = "faq";
    state.activeToolId = "faq-playground";
    state.activeIntent = "faq";
    state.fileTask = freshFileTask();
    state.faqSubjectValidation = null;
    state.answers = {
      ...freshAnswers(),
      scope: values.workflowType || values.scope || "",
      subjects: Array.isArray(values.subjects) ? values.subjects.join("\n") : (values.subjects || ""),
      audience: values.audience || "",
      language: values.language || "English (UK)",
      count: values.count || "20-30",
      categories: Array.isArray(values.categories) ? values.categories.join("\n") : (values.categories || ""),
      categoryCounts: values.categoryCounts || "",
      forbiddenPhrases: Array.isArray(values.forbiddenPhrases) ? values.forbiddenPhrases.join("\n") : (values.forbiddenPhrases || values.wordsToAvoid || values.forbiddenTerms || ""),
      questionGuidance: values.questionGuidance || "",
      answerGuidance: values.answerGuidance || "",
      sourceUrl: values.sourceUrl || "",
      sourceMode: values.sourceUrl ? "url" : "",
      audienceConfirmed: Boolean(values.audience),
      languageConfirmed: Boolean(values.language),
      countConfirmed: Boolean(values.count),
      categoriesConfirmed: Boolean(values.categories),
      categoryCountsConfirmed: Boolean(values.categoryCounts),
      questionGuidanceConfirmed: Boolean(values.questionGuidance),
      answerGuidanceConfirmed: Boolean(values.answerGuidance),
      sourceConfirmed: Boolean(values.sourceUrl)
    };
    if (values.sourceUrl) recordSource(values.sourceUrl, "FAQ source", "faq-playground");
    if (sourceText) applyInference(sourceText);
    nextStep();
  }

  function startFileFromSmart(values = {}, reply = "") {
    state.mode = "file";
    state.step = "file";
    state.activeIntent = "file-edit";
    state.activeToolId = "file-draft";
    state.activeStep = "collecting";
    state.answers = freshAnswers();
    state.fileTask = {
      ...freshFileTask(),
      filePath: values.filePath || "",
      targetScope: values.targetScope || (values.filePath ? "" : codexDiscoveryTarget(reply || values.instruction || "")),
      targetKind: values.targetKind || (values.filePath ? "repo-path" : "repo-discovery"),
      instruction: values.instruction || reply || "",
      status: "draft"
    };
    state.collectedInputs = { ...state.fileTask };
    renderWorkspace();
    if (!state.fileTask.instruction) {
      ask("fileInstruction", prefersHebrew() ? "מה צריך להשתנות בקבצים?" : "What should change in the files?", []);
      return;
    }
    finishFileTask();
  }

  function startToolFromSmart(tool, values = {}, reply = "", text = "") {
    if (!tool) return false;
    if (tool.id === "faq-playground") {
      startFaqFromSmart(values, reply, text);
      return true;
    }
    if (tool.id === "file-draft") {
      if (hasSheetReference(text)) {
        const sheetTool = getTool("design-formatting");
        return startToolFromSmart(sheetTool, { targetUrl: extractUrl(text) }, reply || "זה נראה כמו Google Sheet, אז אני מעביר לכלי עריכת הגיליונות.", text);
      }
      startFileFromSmart(values, reply);
      return true;
    }

    state.mode = "tool";
    state.step = "tool";
    state.activeIntent = tool.id;
    state.activeToolId = tool.id;
    state.activeStep = "collecting";
    state.collectedInputs = mergeSmartToolValues(tool, text, values);
    if (tool.id === "meta-tags") {
      initializeMetaFlow(text);
    }
    state.pendingQuestion = null;
    state.readyToRun = false;
    state.lastPayload = null;
    state.liveRunConfirmed = false;
    recordSourcesFromText(text, `${tool.title} smart route`);
    updateToolMissingInputs();
    advanceToolFlow();
    return true;
  }

  async function trySmartRouter(text) {
    if (!shouldUseSmartRouter(text)) return false;
    logLine("Smart router: asking assistant-chat to classify the request...");
    try {
      const response = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: state.messages.slice(-8),
          tools: smartRouterTools(),
          activeAction: activeActionSnapshot(),
          locale: state.chatLocale,
          responseLanguage: prefersHebrew() ? "Hebrew" : "English"
        })
      });
      if (!response.ok) {
        logLine(`Smart router skipped: ${response.status}`, "warn");
        return false;
      }
      const result = await response.json();
      const actions = Array.isArray(result.actions) ? result.actions : [];
      const action = actions
        .filter((item) => item?.toolId && Number(item.confidence || 0) >= 0.45)
        .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];
      if (!action) {
        if (result.reply) bot(result.reply);
        return Boolean(result.reply);
      }
      const tool = getTool(action.toolId);
      if (!tool) {
        if (result.reply) bot(result.reply);
        return Boolean(result.reply);
      }
      logLine(`Smart router chose ${tool.title} (${result.modelUsed || "assistant-chat"}).`, "ok");
      return startToolFromSmart(tool, action.values || {}, result.reply || "", text);
    } catch (error) {
      logLine(`Smart router skipped: ${error.message || error}`, "warn");
      return false;
    }
  }

  async function tryGeneralAssistant(text) {
    logLine("Assistant brain: asking AI for a natural response or tool route...");
    try {
      const response = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: state.messages.slice(-10),
          tools: smartRouterTools(),
          activeAction: activeActionSnapshot(),
          locale: state.chatLocale,
          responseLanguage: prefersHebrew() ? "Hebrew" : "English"
        })
      });
      if (!response.ok) {
        logLine(`Assistant brain skipped: ${response.status}`, "warn");
        return false;
      }
      const result = await response.json();
      const actions = Array.isArray(result.actions) ? result.actions : [];
      const action = actions
        .filter((item) => item?.toolId && Number(item.confidence || 0) >= 0.55)
        .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];
      if (action) {
        const tool = getTool(action.toolId);
        if (tool) {
          logLine(`Assistant brain chose ${tool.title} (${result.modelUsed || "assistant-chat"}).`, "ok");
          return startToolFromSmart(tool, action.values || {}, result.reply || "", text);
        }
      }
      if (result.reply) {
        bot(result.reply);
        setQuickReplies(homeReplies());
        logLine(`Assistant brain answered (${result.modelUsed || "assistant-chat"}).`, "ok");
        return true;
      }
      return false;
    } catch (error) {
      logLine(`Assistant brain skipped: ${error.message || error}`, "warn");
      return false;
    }
  }

  function deepMergeSafe(base, patch) {
    const output = Array.isArray(base) ? [...base] : { ...(base || {}) };
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (value === undefined) return;
      if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) {
        output[key] = deepMergeSafe(output[key], value);
        return;
      }
      output[key] = value;
    });
    return output;
  }

  function mergeTaskPromptPatch(baseTasks = [], patchTasks = []) {
    if (!Array.isArray(baseTasks) || !Array.isArray(patchTasks)) return baseTasks;
    const byId = new Map(patchTasks.map((task) => [String(task?.id), task]));
    return baseTasks.map((task) => {
      const patch = byId.get(String(task.id));
      if (!patch || typeof patch !== "object") return task;
      return {
        ...task,
        name: typeof patch.name === "string" ? patch.name : task.name,
        system: typeof patch.system === "string" ? patch.system : task.system,
        user: typeof patch.user === "string" ? patch.user : task.user,
        model: typeof patch.model === "string" ? patch.model : task.model,
        enabled: task.enabled
      };
    });
  }

  function mergeSafePayloadPatch(tool, payload, patch) {
    if (!patch || typeof patch !== "object") return payload;
    const locked = new Set([
      "mode", "sourceType", "sourceUrl", "spreadsheetId", "sourceFolderId", "folderId", "targetId",
      "targetUrl", "targetLangs", "languages", "outputCell", "previewOnly", "dryRun", "model",
      "subjects", "sourceTab", "questionColumn", "answerColumn", "existingValuePolicy", "operation", "operations", "selectedOperation"
    ]);
    const next = JSON.parse(JSON.stringify(payload || {}));

    Object.entries(patch).forEach(([key, value]) => {
      if (locked.has(key)) return;
      if (key === "tasks" && tool?.id === "faq-playground") {
        next.tasks = mergeTaskPromptPatch(next.tasks, value);
        return;
      }
      if (["prompts", "languageNotes", "glossaryByLang", "terminologyByLang", "polishRulesByLang"].includes(key)) {
        next[key] = deepMergeSafe(next[key] || {}, value || {});
        return;
      }
      if (key === "instructions" || key === "assistantPreflightNotes") {
        next[key] = value;
      }
    });

    return next;
  }

  function shouldSkipSmartPreflight(tool, payload) {
    if (!tool || !payload) return false;
    if (tool.id === "faq-playground" && state.faqSubjectValidation?.confirmed) return true;
    if (tool.id === "schema-builder" && payload.previewOnly !== false) return true;
    if (tool.id === "meta-tags" && payload.outputMode === "preview" && payload.generationMode !== "ai") return true;
    if (tool.id === "site-ai-faq-audit") return true;
    return false;
  }

  async function runSmartPreflight(tool, payload) {
    if (!tool || !payload || tool.id === "file-draft") return payload;
    if (shouldSkipSmartPreflight(tool, payload)) {
      const reason = tool.id === "site-ai-faq-audit" ? "run" : (tool.id === "faq-playground" ? "validated run" : "preview");
      logLine(`Smart preflight skipped for deterministic ${tool.title} ${reason}.`);
      return payload;
    }
    logLine(`Smart preflight: refining ${tool.title} payload before run...`);

    try {
      const response = await fetch("/api/assistant-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: tool.id,
          values: state.collectedInputs,
          payload,
          messages: state.messages.slice(-10),
          locale: state.chatLocale,
          responseLanguage: prefersHebrew() ? "Hebrew" : "English"
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logLine(`Smart preflight skipped: ${response.status} ${errorText.slice(0, 120)}`, "warn");
        return payload;
      }

      const result = await response.json();
      const enhanced = mergeSafePayloadPatch(tool, payload, result.payloadPatch || {});
      const warnings = Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [];
      if (result.reply) logLine(`Smart preflight note: ${result.reply}`, "ok");
      warnings.forEach((warning) => logLine(`Preflight warning: ${warning}`, "warn"));
      logLine(`Smart preflight model: ${result.modelUsed || "assistant-preflight"}`, "ok");
      return enhanced;
    } catch (error) {
      logLine(`Smart preflight skipped: ${error.message || error}`, "warn");
      return payload;
    }
  }

  function formatValidatedFaqLanguage(language = "", locale = "") {
    const lang = compact(language);
    const region = compact(locale).toUpperCase();
    if (!lang) return "";
    if (/^english$/i.test(lang) && /^(UK|GB|EN-GB|BRITISH)$/i.test(region)) return "English (UK)";
    if (/^english$/i.test(lang) && /^(US|USA|EN-US|AMERICAN)$/i.test(region)) return "English (US)";
    return region && !lang.toLowerCase().includes(region.toLowerCase()) ? `${lang} (${region})` : lang;
  }

  function faqValidationSignature() {
    return JSON.stringify({
      subjects: subjectList().join("\n"),
      subjectRaw: compact(state.answers.subjectRaw),
      language: compact(state.answers.language),
      scope: compact(state.answers.scope),
      count: compact(state.answers.count)
    });
  }

  function isEnglishFaqLanguage(language) {
    const value = compact(language);
    return /^english(?:\b|\s|\()/i.test(value) || /^en(?:[-_][a-z]+)?$/i.test(value);
  }

  function strengthenFaqValidationQuality(validation = {}, source = {}) {
    const currentSubject = subjectList().join(", ");
    const originalSubject = [
      currentSubject,
      state.answers.subjectRaw,
      source.originalSubject,
      source.detectedBrandOrEntity,
      source.normalizedSubject,
      source.subject
    ].map(compact).filter(Boolean).join(" ");
    const riskFlags = new Set(Array.isArray(source.riskFlags) ? source.riskFlags.map(compact).filter(Boolean) : []);
    const next = { ...validation };
    const officialRecord = knownFaqSubjectRecord(originalSubject);
    const officialSubject = officialRecord?.official || "";

    if (officialSubject) {
      if (next.normalizedSubject !== officialSubject) {
        riskFlags.add("official-name-normalized");
        next.normalizedSubject = officialSubject;
        next.detectedBrandOrEntity = officialSubject;
        next.subjectChanged = true;
        next.needsConfirmation = true;
      }
      next.officialNameVerified = true;
      next.confidence = Math.max(Number(next.confidence) || 0, 0.92);
    }

    if (officialRecord?.sourceUrl && !next.sourceUrlCandidate) {
      riskFlags.add("official-source-found");
      next.sourceUrlCandidate = officialRecord.sourceUrl;
      next.sourceTitle = officialRecord.sourceTitle || officialRecord.official;
      next.sourceType = "official";
      next.sourceConfidence = Math.max(Number(next.sourceConfidence) || 0, 0.9);
      next.sourceNeedsConfirmation = true;
      next.needsConfirmation = true;
    }

    if (faqSubjectLooksMixed()) {
      riskFlags.add("subject-contained-language-instruction");
      next.needsConfirmation = true;
    }

    const targetLanguage = next.language || state.answers.language;
    if (isEnglishFaqLanguage(targetLanguage) && hasHebrew(next.normalizedSubject || currentSubject) && !next.officialNameVerified) {
      riskFlags.add("english-output-subject-not-normalized");
      next.needsCorrection = true;
      next.needsConfirmation = true;
      next.confidence = Math.min(Number(next.confidence) || 0.6, 0.6);
    }

    next.riskFlags = Array.from(riskFlags);
    return next;
  }

  function normalizeFaqValidationResult(result = {}) {
    const source = result.faqValidation || result.validation || result;
    if (!source || typeof source !== "object") return null;
    const normalizedSubject = cleanSubject(source.normalizedSubject || source.subject || source.detectedBrandOrEntity || "");
    const requestedLanguage = compact(source.requestedLanguage || source.language || "");
    const requestedLocale = compact(source.requestedLocale || source.locale || "");
    const language = formatValidatedFaqLanguage(requestedLanguage, requestedLocale);
    const confidence = Number(source.confidence);
    const currentSubject = subjectList().join(", ");
    const currentLanguage = compact(state.answers.language);
    const subjectChanged = Boolean(normalizedSubject && currentSubject && normalizedSubject.toLowerCase() !== currentSubject.toLowerCase());
    const languageChanged = Boolean(language && currentLanguage && language.toLowerCase() !== currentLanguage.toLowerCase());
    const needsConfirmation = source.needsConfirmation === true ||
      subjectChanged ||
      languageChanged ||
      (Number.isFinite(confidence) && confidence < 0.9);

    if (!normalizedSubject && !language && !Number.isFinite(confidence)) return null;

    const validation = {
      normalizedSubject,
      detectedBrandOrEntity: compact(source.detectedBrandOrEntity || ""),
      requestedLanguage,
      requestedLocale,
      language,
      contentGoal: compact(source.contentGoal || ""),
      removedInstructionFragments: Array.isArray(source.removedInstructionFragments) ? source.removedInstructionFragments.map(compact).filter(Boolean) : [],
      confidence: Number.isFinite(confidence) ? confidence : 0,
      needsConfirmation,
      subjectChanged,
      languageChanged,
      confirmationQuestion: compact(source.confirmationQuestion || ""),
      reply: compact(result.reply || source.reply || ""),
      warnings: Array.isArray(result.warnings || source.warnings) ? (result.warnings || source.warnings).map(compact).filter(Boolean) : [],
      officialNameVerified: source.officialNameVerified === true,
      needsCorrection: source.needsCorrection === true || source.needsUserCorrection === true,
      sourceUrlCandidate: compact(source.sourceUrlCandidate || source.officialSourceUrl || source.sourceUrl || ""),
      sourceTitle: compact(source.sourceTitle || source.officialSourceTitle || ""),
      sourceType: compact(source.sourceType || ""),
      sourceConfidence: Number.isFinite(Number(source.sourceConfidence)) ? Number(source.sourceConfidence) : 0,
      sourceNeedsConfirmation: source.sourceNeedsConfirmation === true || source.needsSourceConfirmation === true,
      riskFlags: Array.isArray(source.riskFlags) ? source.riskFlags.map(compact).filter(Boolean) : []
    };
    return strengthenFaqValidationQuality(validation, source);
  }

  function faqSubjectLooksMixed() {
    const current = [subjectList().join(" "), state.answers.subjectRaw].filter(Boolean).join(" ");
    return /(?:אנגלית|עברית|גרמנית|צרפתית|ספרדית|english|hebrew|german|french|spanish|\buk\b|\bus\b|language|locale)/i.test(current);
  }

  function fallbackFaqValidationResult() {
    if (!faqSubjectLooksMixed()) return null;
    const current = [subjectList().join(", "), state.answers.subjectRaw].filter(Boolean).join(" ");
    const officialRecord = knownFaqSubjectRecord(current);
    const officialSubject = officialRecord?.official || "";
    const normalizedSubject = officialSubject || cleanSubject(current);
    const detectedLanguage = detectLanguage(current);
    if (!normalizedSubject || normalizedSubject.toLowerCase() === current.toLowerCase()) return null;
    return {
      normalizedSubject,
      detectedBrandOrEntity: officialSubject || "",
      requestedLanguage: detectedLanguage || state.answers.language || "",
      requestedLocale: /(\buk\b|בריטית)/i.test(current) ? "UK" : "",
      language: detectedLanguage || state.answers.language || "",
      contentGoal: "",
      removedInstructionFragments: [],
      confidence: officialSubject ? 0.92 : 0.65,
      needsConfirmation: true,
      subjectChanged: true,
      languageChanged: false,
      confirmationQuestion: "",
      reply: "",
      warnings: [],
      officialNameVerified: Boolean(officialSubject),
      sourceUrlCandidate: officialRecord?.sourceUrl || "",
      sourceTitle: officialRecord?.sourceTitle || "",
      sourceType: officialRecord?.sourceUrl ? "official" : "",
      sourceConfidence: officialRecord?.sourceUrl ? 0.9 : 0,
      sourceNeedsConfirmation: Boolean(officialRecord?.sourceUrl),
      riskFlags: officialSubject ? ["official-name-normalized", "official-source-found"] : ["subject-contained-language-instruction"]
    };
  }

  function applyFaqValidation(validation = {}) {
    if (validation.normalizedSubject) state.answers.subjects = validation.normalizedSubject;
    if (validation.language) {
      state.answers.language = validation.language;
      state.answers.languageConfirmed = true;
    }
    if (validation.sourceUrlCandidate && (!state.answers.sourceUrl || state.answers.sourceMode === "none" || state.answers.sourceMode === "official")) {
      state.answers.sourceUrl = validation.sourceUrlCandidate;
      state.answers.sourceMode = "url";
      state.answers.sourceInstructions = `Use this official source as the primary factual source: ${validation.sourceUrlCandidate}. Use other public sources only to understand question demand. Mark missing facts as Needs source confirmation.`;
      state.answers.sourceConfirmed = true;
      recordSource(validation.sourceUrlCandidate, validation.sourceTitle || "FAQ validation source", "faq-playground");
    }
    state.faqSubjectValidation = {
      ...validation,
      signature: faqValidationSignature(),
      confirmed: true,
      confirmedAt: new Date().toISOString()
    };
    syncConversationFromFaq();
  }

  function faqValidationConfirmationText(validation = {}) {
    const hebrew = prefersHebrew();
    const subject = validation.normalizedSubject || subjectList().join(", ") || (hebrew ? "הנושא הנוכחי" : "the current subject");
    const language = validation.language || state.answers.language || (hebrew ? "השפה הנוכחית" : "the current language");
    const sourceUrl = validation.sourceUrlCandidate || state.answers.sourceUrl || "";
    const sourceTitle = validation.sourceTitle || (hebrew ? "העמוד הרשמי" : "official page");
    const riskFlags = new Set(validation.riskFlags || []);
    if (hebrew) {
      return [
        "בדקתי רגע לפני יצירת הגיליון כדי לוודא שהבקשה נקייה והגיונית.",
        validation.officialNameVerified
          ? "זיהיתי שהשם נכתב בעברית או עם כתיב לא מדויק, ותיקנתי לשם אנגלי מוכר."
          : "",
        validation.needsCorrection
          ? "עדיין לא הצלחתי להפוך את שם הנושא לשם אנגלי נקי, ולכן לא אריץ על הטקסט המקורי."
          : "",
        riskFlags.has("subject-contained-language-instruction")
          ? "הוצאתי מהנושא הוראות כמו שפה/לוקאל כדי שלא ייכנסו לשם הגיליון."
          : "",
        `השם שיעבור ליצירה: ${subject}`,
        `שפת הפלט: ${localizedLanguageLabel(language)}`,
        sourceUrl ? `מקור עובדתי מוצע: ${sourceTitle}\n${sourceUrl}` : "לא מצאתי מקור רשמי מספיק בטוח בשלב הבדיקה.",
        "",
        validation.needsCorrection ? "כתבי את השם הרשמי או בחרי מה לשנות." : "להמשיך עם זה?"
      ].filter(Boolean).join("\n");
    }
    return [
      "I checked the setup before creating the Sheet.",
      validation.officialNameVerified ? "I corrected the typed/transliterated subject to a known English name." : "",
      validation.needsCorrection ? "I still could not turn the subject into a clean English name, so I will not run on the original text." : "",
      riskFlags.has("subject-contained-language-instruction") ? "I removed language/locale instructions from the subject." : "",
      `Subject to create: ${subject}`,
      `Output language: ${localizedLanguageLabel(language)}`,
      sourceUrl ? `Proposed factual source: ${sourceTitle}\n${sourceUrl}` : "I did not find a sufficiently reliable official source during validation.",
      "",
      validation.needsCorrection ? "Send the official name or choose what to edit." : "Should I continue with this?"
    ].filter(Boolean).join("\n");
  }

  function askFaqValidationConfirmation(validation) {
    state.faqSubjectValidation = {
      ...validation,
      signature: faqValidationSignature(),
      confirmed: false
    };
    const hebrew = prefersHebrew();
    const riskFlags = new Set(validation.riskFlags || []);
    const canRun = !validation.needsCorrection && Boolean(validation.normalizedSubject);
    const canKeepOriginal = canRun &&
      !validation.officialNameVerified &&
      !riskFlags.has("subject-contained-language-instruction") &&
      !riskFlags.has("english-output-subject-not-normalized");
    const replies = [
      canRun ? { label: validation.sourceUrlCandidate ? (hebrew ? "כן, להשתמש בשם ובמקור" : "Yes, use name and source") : (hebrew ? "כן, להשתמש בשם הזה" : "Yes, use this name"), value: "faq-validation:accept", primary: true } : null,
      { label: hebrew ? "לשנות נושא" : "Edit subject", value: "faq-validation:edit-subject", primary: !canRun },
      { label: hebrew ? "לשנות שפה" : "Edit language", value: "faq-validation:edit-language" },
      canKeepOriginal ? { label: hebrew ? "להשאיר כמו שכתבתי" : "Keep my original text", value: "faq-validation:keep-original" } : null
    ].filter(Boolean);
    ask("faqSubjectValidation", faqValidationConfirmationText(validation), replies);
  }

  async function validateFaqBeforeRun(payload) {
    const signature = faqValidationSignature();
    if (state.faqSubjectValidation?.confirmed && state.faqSubjectValidation.signature === signature) return true;
    logLine("FAQ validation: checking subject and language before creating the sheet...");
    bot(prefersHebrew()
      ? "בודקת רגע שהנושא והשפה הגיוניים לפני יצירת הגיליון."
      : "Checking the subject and language before creating the Sheet.");

    try {
      const response = await fetch("/api/assistant-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "faq-subject-validation",
          toolId: "faq-playground",
          values: buildFaqHandoffValues(),
          payload,
          messages: state.messages.slice(-10),
          locale: state.chatLocale,
          responseLanguage: prefersHebrew() ? "Hebrew" : "English"
        })
      });

      if (response.ok) {
        const result = await response.json();
        const validation = normalizeFaqValidationResult(result);
        if (validation?.warnings?.length) validation.warnings.forEach((warning) => logLine(`FAQ validation warning: ${warning}`, "warn"));
        if (validation?.needsConfirmation) {
          logLine(`FAQ validation needs confirmation (${result.modelUsed || "assistant-preflight"}).`, "warn");
          askFaqValidationConfirmation(validation);
          return false;
        }
        if (validation) {
          applyFaqValidation(validation);
          logLine(`FAQ validation passed (${result.modelUsed || "assistant-preflight"}).`, "ok");
          return true;
        }
      } else {
        const errorText = await response.text();
        logLine(`FAQ validation skipped: ${response.status} ${errorText.slice(0, 120)}`, "warn");
      }
    } catch (error) {
      logLine(`FAQ validation skipped: ${error.message || error}`, "warn");
    }

    const fallback = fallbackFaqValidationResult();
    if (fallback?.needsConfirmation) {
      askFaqValidationConfirmation(fallback);
      return false;
    }

    state.faqSubjectValidation = {
      signature,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      fallback: true
    };
    return true;
  }

  function finishToolSetup(prefix = "") {
    const tool = getTool(state.activeToolId);
    if (!tool) return;
    updateToolMissingInputs();
    state.step = "ready";
    state.activeStep = "ready";
    state.pendingQuestion = null;
    const summary = genericToolSummary(tool);
    bot([prefix, summary].filter(Boolean).join("\n\n"));
    setGenericReadyReplies(tool);
    renderWorkspace();
  }

  function genericToolSummary(tool) {
    const hebrew = prefersHebrew();
    if (tool.id === "translate-demo") {
      const source = state.collectedInputs.sourceUrl || "missing source";
      const langs = localizedLanguageCodes(state.collectedInputs.targetLangs) || (hebrew ? "חסרות שפות" : "missing languages");
      const sourceTab = state.collectedInputs.sourceTab === "__auto__" || !state.collectedInputs.sourceTab
        ? "Auto-detect"
        : state.collectedInputs.sourceTab;
      const split = state.collectedInputs.splitIntoTwo === false ? "One pass" : "Split into 2 parts";
      return [
        hebrew ? "התרגום מוכן להרצה:" : "Translation ready:",
        hebrew ? `שפות יעד: ${langs}` : `${langs} · ${sourceTab} · ${split}`,
        `${hebrew ? "מקור" : "Source"}: ${source}`,
        state.collectedInputs.preserveTerms && state.collectedInputs.preserveTerms !== "none" ? `${hebrew ? "לשמר" : "Preserve"}: ${state.collectedInputs.preserveTerms}` : "",
        hebrew ? "אפשר לפתוח את הכלי לפני הרצה." : "You can open the workspace before running."
      ].filter(Boolean).join("\n");
    }

    if (tool.id === "schema-builder") {
      const previewOnly = state.collectedInputs.previewOnly !== false;
      const tab = state.collectedInputs.tabName || "Sheet1";
      const questionColumn = state.collectedInputs.questionColumn || "B";
      const answerColumn = state.collectedInputs.answerColumn || "C";
      const outputCell = schemaOutputCell();
      if (hebrew) {
        return [
          "מצאתי את נתוני השאלות והתשובות.",
          `אקרא שאלות מעמודה ${questionColumn} ותשובות מעמודה ${answerColumn} בטאב ${tab}.`,
          previewOnly
            ? "כרגע זו בדיקה מקדימה בלבד, בלי כתיבה לגיליון."
            : `הסכמה מיועדת לתא ${outputCell}.`,
          `אם נכתוב לתא ${outputCell} ויש שם כבר ערך, מה לעשות?`
        ].join("\n");
      }
      return [
        "I found the FAQ question and answer data.",
        `I’ll read questions from column ${questionColumn} and answers from column ${answerColumn} in ${tab}.`,
        previewOnly
          ? "This is preview only, so nothing will be written to the Sheet."
          : `The schema target is ${outputCell}.`,
        `If ${outputCell} already has a value, what should I do?`
      ].join("\n");
    }

    if (tool.id === "meta-tags") {
      const outputMode = state.collectedInputs.outputMode || "preview";
      const target = outputMode === "firstTabRange"
        ? (hebrew ? "הטאב הראשון" : "the first tab")
        : (outputMode === "existingRange"
          ? (state.collectedInputs.outputTabName || "Meta Tags")
          : (state.collectedInputs.outputTabName || "Meta Tags"));
      const startCell = state.collectedInputs.outputStartCell || "A1";
      const sourceType = metaSourceType();
      const pages = sourceType === "sheet"
        ? (hebrew ? "שם קובץ ה־Sheet כעמוד אחד" : "spreadsheet file name as one page")
        : sourceType === "folder"
          ? (hebrew ? "שמות הקבצים בתיקיית Drive" : "Drive folder file names")
          : (state.collectedInputs.pageList || (hebrew ? "עמודים ידניים" : "manual pages"));
      const method = state.collectedInputs.generationMode === "ai"
        ? (hebrew ? "AI לניסוח מותאם" : "AI-written copy")
        : (hebrew ? "תבנית מהירה בלי AI" : "fast template, no AI");
      if (hebrew) {
        return [
          "Meta tags מוכנים להרצה:",
          `מקור: ${state.collectedInputs.sourceUrl || state.collectedInputs.pageList || "עמודים ידניים"}.`,
          `שמות עמודים: ${pages}.`,
          `שדות: ${metaFieldLabel() || "Meta title + description"}.`,
          `שפה: ${localizedLanguageCodes(state.collectedInputs.languages) || "אנגלית UK"}.`,
          `אופן בנייה: ${method}.`,
          outputMode === "preview"
            ? "כרגע זו בדיקה מקדימה בלבד, בלי כתיבה לגיליון."
            : `אם נכתוב לגיליון, הפלט יתחיל ב־${target}!${startCell}.`,
          outputMode === "preview" ? "" : "אם יש תאים מלאים בטווח הפלט, מה לעשות?"
        ].filter(Boolean).join("\n");
      }
      return [
        "Meta tags are ready:",
        `Source: ${state.collectedInputs.sourceUrl || state.collectedInputs.pageList || "manual pages"}.`,
        `Page names: ${pages}.`,
        `Fields: ${metaFieldLabel() || "Meta title + description"}.`,
        `Language: ${localizedLanguageCodes(state.collectedInputs.languages) || "English"}.`,
        `Build method: ${method}.`,
        outputMode === "preview"
          ? "This is preview only, so nothing will be written to the Sheet."
          : `If written, output starts at ${target}!${startCell}.`,
        outputMode === "preview" ? "" : "If the output range already has values, what should I do?"
      ].filter(Boolean).join("\n");
    }

    if (tool.id === "site-ai-audit") {
      const payload = state.lastPayload || buildToolPayload(tool, state.collectedInputs);
      const profile = siteAuditProfileDefaults(payload.auditProfile || state.collectedInputs.auditProfile);
      const checks = auditCheckOptions()
        .filter((item) => payload[item.id] !== false)
        .map((item) => item.label)
        .join(", ");
      return [
        hebrew ? "אודיט האתר מוכן להרצה:" : "Audit ready:",
        `${localizedSiteAuditProfileLabel(profile.auditProfile)} · עד ${payload.maxPages || profile.maxPages} ${hebrew ? "עמודים" : "pages"}`,
        `${hebrew ? "אתר" : "Website"}: ${payload.startUrl || state.collectedInputs.siteUrl || (hebrew ? "חסר אתר" : "missing site")}`,
        `${hebrew ? "בדיקות" : "Checks"}: ${checks || (hebrew ? "לא נבחרו" : "none selected")}`,
        `${hebrew ? "סיכום AI" : "AI summary"}: ${payload.includeAiAnalysis ? (hebrew ? "כן" : "yes") : (hebrew ? "לא" : "no")}`
      ].join("\n");
    }

    if (tool.id === "site-ai-faq-audit") {
      const result = state.faqAuditDiscovery || {};
      const selectedUrls = selectedFaqAuditUrlCount();
      const mappedUrls = Array.isArray(result.urls) ? result.urls.length : 0;
      return [
        hebrew ? "אודיט FAQ מוכן להרצה:" : "FAQ audit ready:",
        `${hebrew ? "אתר" : "Website"}: ${state.collectedInputs.siteUrl || (hebrew ? "חסר אתר" : "missing site")}`,
        `${hebrew ? "URLs לאודיט" : "URLs to audit"}: ${selectedUrls || 0}${mappedUrls ? ` ${hebrew ? "מתוך" : "of"} ${mappedUrls} ${hebrew ? "שמופו" : "mapped"}` : ""}`,
        `${hebrew ? "קבוצות לאודיט" : "Groups to audit"}: ${selectedFaqAuditGroupLabel()}`,
        `${hebrew ? "היקף" : "Audit mode"}: עד ${state.collectedInputs.maxPages || 50} ${hebrew ? "עמודים" : "pages"}`
      ].join("\n");
    }

    if (tool.id === "design-formatting") {
      const payload = state.lastPayload || buildToolPayload(tool, state.collectedInputs);
      const operation = payload?.operation || payload?.operations?.[0] || {};
      const isSourceLinkCleanup = operation.type === "faq_language_review" &&
        (isRemoveSourcesFromAnswersIntent(operation.editorInstruction || "") || isRemoveSourcesFromAnswersIntent(state.collectedInputs.instruction || ""));
      const operationLabels = hebrew
        ? {
          faq_answer_research: "מחקר AI לתשובות חסרות/VERIFY",
          faq_missing_questions: "הוספת שאלות FAQ חסרות",
          faq_apply_client_comments: "יישום הערות לקוח",
          faq_language_review: isSourceLinkCleanup ? "ניקוי קישורי מקור מהתשובות" : "בדיקת ניסוח",
          faq_question_review: "בדיקת שאלות",
          faq_name_injection: "בדיקת שימוש בשם",
          replace_column_when_value: `העתקה מ־${operation.sourceColumn || "עמודת מקור"} אל ${operation.targetColumn || "עמודת יעד"}`,
          format_table: "עיצוב טבלה"
        }
        : {
          faq_answer_research: "AI research missing/VERIFY answers",
          faq_missing_questions: "Add missing FAQ questions",
          faq_apply_client_comments: "Apply client comments",
          faq_language_review: isSourceLinkCleanup ? "Clean source links from answers" : "Language review",
          faq_question_review: "Question review",
          faq_name_injection: "Name usage review",
          replace_column_when_value: `Copy ${operation.sourceColumn || "source column"} into ${operation.targetColumn || "target column"}`,
          format_table: "Format table"
        };
      const operationLabel = operationLabels[operation.type] || operation.type || (hebrew ? "עריכת גיליון" : "Workspace edit");
      const outputColumn = operation.type === "replace_column_when_value"
        ? operation.targetColumn
        : (operation.targetCol || operation.outputColumn || state.collectedInputs.targetCol || "");
      return [
        hebrew ? "עריכת הגיליון מוכנה:" : "Sheet edit ready:",
        `${operationLabel} · ${state.collectedInputs.dryRun !== false ? "בדיקה בלי כתיבה" : "כתיבה לגיליון"}`,
        `${hebrew ? "גיליון" : "Sheet"}: ${state.collectedInputs.targetUrl || (hebrew ? "חסר גיליון" : "missing sheet")}`,
        operation.type === "replace_column_when_value" ? `${hebrew ? "עמודות" : "Columns"}: ${operation.sourceColumn || state.collectedInputs.sourceColumn || "source"} → ${operation.targetColumn || state.collectedInputs.targetColumn || "target"}` : "",
        outputColumn ? `${hebrew ? "עמודת יעד" : "Output"}: ${outputColumn}` : "",
        `${hebrew ? "הנחיה" : "Instruction"}: ${state.collectedInputs.instruction || (hebrew ? "חסרה הנחיה" : "missing instruction")}`,
        state.collectedInputs.sourceUrl ? `${hebrew ? "מקור מחקר" : "Research source"}: ${state.collectedInputs.sourceUrl}` : "",
        operation.useWebSearch ? (hebrew ? "כולל חיפוש/AI רק אחרי אישור כתיבה." : "AI/web search: live run only") : "",
        state.collectedInputs.dryRun !== false ? (hebrew ? "לא אכתוב לגיליון בלי אישור נוסף." : "I will not write without another confirmation.") : ""
      ].filter(Boolean).join("\n");
    }

    const lines = [
      prefersHebrew()
        ? `התוכנית מוכנה עבור ${tool.title}:`
        : `${tool.title} setup is ready:`
    ];
    const fields = [...(tool.requiredInputs || []), ...(tool.optionalInputs || [])];
    fields.forEach((field) => {
      const value = state.collectedInputs[field.key];
      if (!fieldHasValue(value)) return;
      lines.push(`${field.label || field.key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    });
    lines.push("");
    lines.push(hebrew
      ? (tool.canRunDirectly ? "אפשר להריץ מכאן או לפתוח את הכלי." : "צריך לפתוח את הכלי לפני פעולה שמשנה נתונים.")
      : (tool.canRunDirectly ? "Ready to run or open workspace." : "Open the workspace before live operation."));
    return lines.join("\n");
  }

  function setGenericReadyReplies(tool) {
    const replies = [];
    if (tool.id === "design-formatting") {
      const hebrew = prefersHebrew();
      const operation = (state.lastPayload || buildToolPayload(tool, state.collectedInputs))?.operation || {};
      const liveLabel = operation.type === "replace_column_when_value"
        ? (hebrew ? "לאשר כתיבה לגיליון" : "Confirm sheet write")
        : (hebrew ? "לאשר כתיבה לגיליון" : "Confirm live AI/write");
      replies.push({ label: hebrew ? "לבדוק בלי לכתוב" : "Run dry run here", value: "format:dry-run", primary: state.collectedInputs.dryRun !== false });
      replies.push({ label: liveLabel, value: "format:confirm-live", primary: state.collectedInputs.dryRun === false });
      replies.push({ label: hebrew ? "לפתוח כלי" : "Open workspace", value: "open-tool" });
      replies.push({ label: hebrew ? "להוסיף פרט" : "Add detail", value: "tool:detail" });
      replies.push({ label: hebrew ? "פרטים טכניים" : "Show payload", value: "review" });
      replies.push({ label: hebrew ? "להתחיל מחדש" : "Start over", value: "reset" });
      setQuickReplies(replies);
      return;
    }
    if (tool.id === "site-ai-audit") {
      const hebrew = prefersHebrew();
      replies.push({ label: hebrew ? "להריץ אודיט" : "Run audit", value: "run-tool" });
      replies.push({ label: hebrew ? "להחליף סוג אודיט" : "Change audit type", value: "audit:profile" });
      replies.push({ label: hebrew ? "לשנות מה בודקים" : "Change checks", value: "audit:focus" });
      replies.push({ label: hebrew ? "לשנות מספר עמודים" : "Change page budget", value: "audit:pages" });
      replies.push({ label: hebrew ? "לפתוח עמוד דוח" : "Open report workspace", value: "open-tool" });
      replies.push({ label: hebrew ? "בלי AI summary" : "No AI summary", value: "audit:no-ai" });
      replies.push({ label: hebrew ? "פרטים טכניים" : "Show payload", value: "review" });
      replies.push({ label: hebrew ? "להתחיל מחדש" : "Start over", value: "reset" });
      setQuickReplies(replies);
      return;
    }
    if (tool.id === "site-ai-faq-audit") {
      const hebrew = prefersHebrew();
      replies.push({ label: hebrew ? "להריץ FAQ audit" : "Run FAQ audit", value: "run-tool" });
      replies.push({ label: hebrew ? "בדיקה כמו בדפדפן" : "Rendered crawl", value: "faqaudit:rendered" });
      replies.push({ label: hebrew ? "בדיקה מהקוד בלבד" : "Static crawl", value: "faqaudit:static" });
      replies.push({ label: hebrew ? "להשוות לגיליון מקור" : "Compare source Sheet", value: "faqaudit:source" });
      replies.push({ label: hebrew ? "25 עמודים" : "25 pages", value: "pages:25" });
      replies.push({ label: hebrew ? "50 עמודים" : "50 pages", value: "pages:50" });
      replies.push({ label: hebrew ? "לפתוח כלי" : "Open workspace", value: "open-tool" });
      replies.push({ label: hebrew ? "פרטים טכניים" : "Show payload", value: "review" });
      replies.push({ label: hebrew ? "להתחיל מחדש" : "Start over", value: "reset" });
      setQuickReplies(replies);
      return;
    }
    if (tool.id === "schema-builder") {
      const hebrew = prefersHebrew();
      const cell = schemaOutputCell();
      const policy = existingValuePolicy();
      if (state.collectedInputs.previewOnly === false) {
        replies.push({ label: schemaWriteLabel(policy), value: `schema:run:${policy}`, primary: true });
        replies.push({ label: schemaWriteLabel(policy === "overwrite" ? "skip" : "overwrite"), value: `schema:run:${policy === "overwrite" ? "skip" : "overwrite"}` });
        replies.push({ label: hebrew ? "להישאר בבדיקה מקדימה" : "Stay in preview", value: "schema:preview" });
      } else {
        replies.push({ label: directRunLabel(tool), value: "run-tool", primary: true });
        replies.push({ label: hebrew ? `לכתוב לתא ${cell} רק אם ריק` : `Write to ${cell} if empty`, value: "schema:run:skip" });
        replies.push({ label: hebrew ? `לדרוס את ${cell}` : `Overwrite ${cell}`, value: "schema:run:overwrite" });
      }
      replies.push({ label: hebrew ? "לבחור תא אחר" : "Choose another cell", value: "schema:output" });
      replies.push({ label: hebrew ? "לפתוח כלי סכמה" : "Open Schema Builder", value: "open-tool" });
      replies.push({ label: hebrew ? "פרטים טכניים" : "Show payload", value: "review" });
      replies.push({ label: hebrew ? "להתחיל מחדש" : "Start over", value: "reset" });
      setQuickReplies(replies);
      return;
    }
    if (tool.id === "meta-tags") {
      const hebrew = prefersHebrew();
      const policy = existingValuePolicy();
      if (state.collectedInputs.outputMode && state.collectedInputs.outputMode !== "preview") {
        replies.push({ label: metaWriteLabel(policy), value: `meta:run:${policy}`, primary: true });
        replies.push({ label: metaWriteLabel(policy === "overwrite" ? "skip" : "overwrite"), value: `meta:run:${policy === "overwrite" ? "skip" : "overwrite"}` });
        replies.push({ label: hebrew ? "להישאר בבדיקה מקדימה" : "Stay in preview", value: "meta:preview" });
      } else {
        replies.push({ label: directRunLabel(tool), value: "run-tool", primary: true });
      }
      replies.push({ label: hebrew ? "לפתוח כלי Meta" : "Open Meta Tags Studio", value: "open-tool" });
      replies.push({ label: hebrew ? "להוסיף פרט" : "Add detail", value: "tool:detail" });
      replies.push({ label: hebrew ? "פרטים טכניים" : "Show payload", value: "review" });
      replies.push({ label: hebrew ? "להתחיל מחדש" : "Start over", value: "reset" });
      setQuickReplies(replies);
      return;
    }
    if (tool.canRunDirectly) replies.push({ label: directRunLabel(tool), value: "run-tool" });
    replies.push({ label: prefersHebrew() ? (tool.id === "schema-builder" ? "לפתוח כלי סכמה" : "לפתוח כלי") : "Open workspace", value: "open-tool", primary: !tool.canRunDirectly });
    replies.push({ label: prefersHebrew() ? "להוסיף פרט" : "Add detail", value: "tool:detail" });
    replies.push({ label: prefersHebrew() ? "פרטים טכניים" : "Show payload", value: "review" });
    replies.push({ label: prefersHebrew() ? "להתחיל מחדש" : "Start over", value: "reset" });
    setQuickReplies(replies);
  }

  function schemaOutputCell() {
    return state.collectedInputs.outputCell || "E73";
  }

  function existingValuePolicy() {
    return state.collectedInputs.existingValuePolicy === "overwrite" ? "overwrite" : "skip";
  }

  function setExistingValuePolicy(policy) {
    state.collectedInputs.existingValuePolicy = policy === "overwrite" ? "overwrite" : "skip";
  }

  function schemaWriteLabel(policy = existingValuePolicy()) {
    const cell = schemaOutputCell();
    if (prefersHebrew()) {
      return policy === "overwrite" ? `לדרוס את ${cell}` : `לכתוב לתא ${cell} רק אם ריק`;
    }
    return policy === "overwrite" ? `Overwrite ${cell}` : `Write to ${cell} if empty`;
  }

  function metaWriteLabel(policy = existingValuePolicy()) {
    if (prefersHebrew()) {
      return policy === "overwrite" ? "לדרוס תאים מלאים" : "לכתוב רק לתאים ריקים";
    }
    return policy === "overwrite" ? "Overwrite filled cells" : "Write only to empty cells";
  }

  function directRunLabel(tool) {
    const hebrew = prefersHebrew();
    if (tool.id === "translate-demo") return hebrew ? "להריץ תרגום" : "Run translation";
    if (tool.id === "schema-builder" && state.collectedInputs.previewOnly !== false) return hebrew ? "לבדוק בלי לכתוב" : "Run schema preview";
    if (tool.id === "schema-builder") return schemaWriteLabel();
    if (tool.id === "design-formatting") return state.collectedInputs.dryRun === false ? (hebrew ? "לאשר כתיבה לגיליון" : "Run live write") : (hebrew ? "לבדוק בלי לכתוב" : "Run dry run");
    if (tool.id === "site-ai-audit") return hebrew ? "להריץ אודיט" : "Run audit";
    if (tool.id === "site-ai-faq-audit") return hebrew ? "להריץ FAQ audit" : "Run FAQ audit";
    if (tool.id === "meta-tags" && state.collectedInputs.outputMode === "preview") return hebrew ? "לבדוק בלי לכתוב" : "Generate preview";
    if (tool.id === "meta-tags") return metaWriteLabel();
    return hebrew ? "להריץ כאן" : "Run here";
  }

  function designFormattingLiveConfirmationText() {
    const payload = state.lastPayload || buildToolPayload(getTool("design-formatting"), state.collectedInputs);
    const operation = payload?.operation || payload?.operations?.[0] || {};
    const target = payload?.targetId || state.collectedInputs.targetUrl || "the selected Google Sheet";
    const tab = payload?.tabName || state.collectedInputs.tabName || "Sheet1";
    const targetCol = operation.targetCol || operation.answerCol || operation.targetColumn || "the configured output column";
    const sourceCol = operation.sourceColumn || "the configured source column";
    const action = operation.type === "replace_column_when_value"
      ? `copy values from ${sourceCol} into ${targetCol}`
      : `run ${operation.useWebSearch ? "AI/web search" : "AI editing"}`;
    if (prefersHebrew()) {
      return [
        "אפשר לבצע את זה ישירות מהצ׳אט.",
        "",
        operation.type === "replace_column_when_value"
          ? `זה יעתיק ערכים מ־${sourceCol} אל ${targetCol} ויכתוב בחזרה לגיליון.`
          : `זה ישתמש ב־${operation.useWebSearch ? "AI וחיפוש ברשת" : "AI לעריכת התוכן"} ויכתוב בחזרה לגיליון.`,
        `גיליון: ${target}`,
        `טאב: ${tab}`,
        `עמודת יעד: ${targetCol}`,
        "",
        "לאשר כתיבה לגיליון?"
      ].join("\n");
    }
    return [
      "You do not have to open the manual editor. I can run this directly from chat.",
      "",
      `Final confirmation: this will ${action} and write back to Google Sheets.`,
      `Sheet: ${target}`,
      `Tab: ${tab}`,
      `Output: ${targetCol}`,
      "",
      "Confirm live run?"
    ].join("\n");
  }

  function askDesignFormattingLiveConfirmation() {
    const hebrew = prefersHebrew();
    ask("formatLiveConfirm", designFormattingLiveConfirmationText(), [
      { label: hebrew ? "כן, להריץ ולכתוב" : "Yes, run live", value: "format:live-run" },
      { label: hebrew ? "קודם לבדוק בלי לכתוב" : "Dry run first", value: "format:dry-run", primary: false },
      { label: hebrew ? "לפתוח כלי" : "Open workspace", value: "open-tool" }
    ]);
  }

  function needsRunConfirmation(tool, payload = state.lastPayload) {
    if (!tool || tool.id === "design-formatting" || tool.id === "file-draft") return false;
    if (tool.id === "schema-builder") return payload?.previewOnly === false;
    if (tool.id === "meta-tags") return payload?.outputMode && payload.outputMode !== "preview";
    if (tool.id === "translate-demo") return true;
    if (tool.id === "site-ai-audit" || tool.id === "site-ai-faq-audit") return true;
    return /creates|cost|ai|writes/i.test(String(tool.risk || ""));
  }

  function runConfirmationText(tool, payload = state.lastPayload) {
    const hebrew = prefersHebrew();
    if (hebrew) {
      if (tool.id === "translate-demo") return "התרגום יעדכן או ייצור טאבים בגיליון וישתמש בקריאות AI. לאשר הרצה?";
      if (tool.id === "schema-builder") return `אני עומדת לכתוב את הסכמה לתא ${payload?.outputCell || schemaOutputCell()}. זו פעולה שתעדכן את הגיליון. לאשר?`;
      if (tool.id === "meta-tags") return "הכלי יכתוב תוצאות לגיליון לפי הגדרת הפלט. לאשר?";
      if (tool.id === "site-ai-audit") return `האודיט יסרוק עד ${payload?.maxPages || state.collectedInputs.maxPages || "מספר"} עמודים${payload?.includeAiAnalysis ? " ויכול להשתמש בניתוח AI" : ""}. לאשר סריקה?`;
      if (tool.id === "site-ai-faq-audit") return "האודיט יסרוק את האתר ויכול ליצור דוח. לאשר?";
      return "הפעולה יכולה להשתמש ב־AI או ליצור פלט חיצוני. לאשר?";
    }
    if (tool.id === "translate-demo") return "Confirm before running: translation creates or updates Sheet tabs and spends AI calls. Run it?";
    if (tool.id === "schema-builder") return `I’m ready to write the JSON-LD to ${payload?.outputCell || schemaOutputCell()}. This will update the Sheet. Continue?`;
    if (tool.id === "meta-tags") return "Confirm before writing: Meta Tags will write results back to the Sheet according to the output settings. Run it?";
    if (tool.id === "site-ai-audit") return `Confirm before crawling: the audit will inspect up to ${payload?.maxPages || state.collectedInputs.maxPages || "the selected"} pages${payload?.includeAiAnalysis ? " and may spend AI analysis calls" : ""}. Run it?`;
    if (tool.id === "site-ai-faq-audit") return "Confirm before crawling: FAQ Audit will inspect the site and may create a report. Run it?";
    return "Confirm before running: this action can spend AI calls or create external output. Run it?";
  }

  function askToolRunConfirmation(tool, payload) {
    const hebrew = prefersHebrew();
    ask("toolRunConfirm", runConfirmationText(tool, payload), [
      { label: hebrew ? "כן, להריץ" : "Yes, run", value: "tool:confirm-run", primary: true, echo: false },
      { label: hebrew ? (tool?.id === "schema-builder" ? "לפתוח כלי סכמה" : "לפתוח כלי") : "Open workspace", value: "open-tool" },
      { label: hebrew ? "פרטים טכניים" : "Show payload", value: "review" }
    ]);
  }

  function applySiteAuditProfile(profile) {
    const defaults = siteAuditProfileDefaults(profile);
    const existingMaxPages = state.collectedInputs.maxPages;
    Object.assign(state.collectedInputs, defaults);
    state.collectedInputs.suggestedMaxPages = defaults.maxPages;
    state.collectedInputs.maxPages = existingMaxPages || "";
    state.auditCheckSelectionTouched = false;
    auditCheckOptions().forEach((item) => {
      delete state.collectedInputs[item.id];
    });
    updateToolMissingInputs();
  }

  function siteAuditFocusLabel(value) {
    const labels = prefersHebrew()
      ? {
        full: "אודיט AI/search מלא",
        "faq-schema": "FAQ + Schema",
        "technical-meta": "SEO טכני + Metadata",
        answerability: "יכולת מענה AI",
        "links-trust": "קישורים ואמון",
        custom: "בדיקות מותאמות"
      }
      : {
        full: "Full AI/search audit",
        "faq-schema": "FAQ + schema",
        "technical-meta": "Technical SEO + metadata",
        answerability: "AI answerability",
        "links-trust": "Links + trust signals",
        custom: "Custom checks"
      };
    return labels[value] || labels.full;
  }

  function applySiteAuditFocus(focus) {
    const presets = {
      full: { includeSitemap: true, includeLlmsTxt: true, includeFaqAudit: true, includeStructuredData: true, includeAnswerability: true, includeMetaAudit: true, includeLinkAudit: true },
      "faq-schema": { includeSitemap: true, includeLlmsTxt: true, includeFaqAudit: true, includeStructuredData: true, includeAnswerability: true, includeMetaAudit: false, includeLinkAudit: false },
      "technical-meta": { includeSitemap: true, includeLlmsTxt: false, includeFaqAudit: false, includeStructuredData: true, includeAnswerability: false, includeMetaAudit: true, includeLinkAudit: true },
      answerability: { includeSitemap: true, includeLlmsTxt: true, includeFaqAudit: true, includeStructuredData: true, includeAnswerability: true, includeMetaAudit: true, includeLinkAudit: false },
      "links-trust": { includeSitemap: true, includeLlmsTxt: false, includeFaqAudit: false, includeStructuredData: false, includeAnswerability: false, includeMetaAudit: true, includeLinkAudit: true }
    };
    state.collectedInputs.auditFocus = focus || "full";
    Object.assign(state.collectedInputs, presets[state.collectedInputs.auditFocus] || presets.full);
    state.auditCheckSelectionTouched = true;
    updateToolMissingInputs();
  }

  function askSiteAuditProfile() {
    const hebrew = prefersHebrew();
    state.pendingQuestion = { toolId: state.activeToolId, key: "auditProfile" };
    ask("toolField", hebrew ? "איזה סוג אודיט להריץ?" : "What kind of audit should I run?", [
      { label: hebrew ? "מהיר כללי" : "Fast general audit", value: "auditprofile:general-fast" },
      { label: hebrew ? "מלא + AI summary" : "Full + AI summary", value: "auditprofile:full-ai" },
      { label: hebrew ? "FAQ / Schema" : "FAQ/schema focus", value: "auditprofile:faq-schema" },
      { label: hebrew ? "עמוק עם JS rendered" : "Rendered JS deep audit", value: "auditprofile:rendered-deep" }
    ]);
  }

  function isDirectRunAllowed(tool) {
    if (!tool?.canRunDirectly) return false;
    if (tool.id === "translate-demo" && detectSourceType(state.collectedInputs.sourceUrl) === "folder") return false;
    return state.readyToRun;
  }

  function buildFaqHandoffValues() {
    return {
      subjects: subjectList(),
      subjectRaw: state.answers.subjectRaw || "",
      workflowType: state.answers.scope || "hotel",
      audience: state.answers.audience || "",
      language: state.answers.language || "",
      count: state.answers.count || "",
      categories: state.answers.categories || "",
      categoryCounts: state.answers.categoryCounts || "",
      forbiddenPhrases: state.answers.forbiddenPhrases || "",
      qaMode: state.answers.qaMode || "",
      style: state.answers.style || "",
      questionGuidance: state.answers.questionGuidance || "",
      answerGuidance: state.answers.answerGuidance || "",
      model: state.answers.model || "o3",
      sourceUrl: state.answers.sourceUrl || "",
      sourceMode: state.answers.sourceMode || "",
      sourceInstructions: state.answers.sourceInstructions || "",
      extraGuidance: state.answers.extraGuidance || "",
      tasks: buildTasks()
    };
  }

  function openCurrentToolWorkspace() {
    const tool = getTool(state.activeToolId);
    if (!tool?.href) return;
    const payload = faqAuditNeedsDiscovery(tool)
      ? faqAuditDiscoveryPayload()
      : (state.lastPayload || buildToolPayload(tool, state.collectedInputs));
    localStorage.setItem("carmelonAssistantToolHandoff", JSON.stringify({
      toolId: tool.id,
      values: state.collectedInputs,
      payload,
      createdAt: new Date().toISOString()
    }));
    if (tool.id === "faq-playground") {
      localStorage.setItem("carmelonAssistantHandoff", JSON.stringify({
        toolId: "faq-playground",
        values: buildFaqHandoffValues(),
        payload: buildPayload(),
        createdAt: new Date().toISOString()
      }));
    }
    window.open(tool.href, "_blank", "noopener");
    bot(prefersHebrew()
      ? `פתחתי את ${tool.title} עם ה־setup ששמרתי כ־handoff בדפדפן.`
      : `Opened ${tool.title} and saved the current setup as a browser handoff.`);
  }

  function faqBackPrefix() {
    return prefersHebrew() ? "חזרתי צעד אחורה." : "Went one step back.";
  }

  function goBackFaqStep() {
    const prefix = faqBackPrefix();
    if (state.step === "subjects") {
      state.answers.scope = "";
      state.answers.subjects = "";
      state.answers.subjectRaw = "";
      syncConversationFromFaq();
      askFaqScope(prefix);
      return true;
    }
    if (state.step === "audience") {
      askFaqSubjects(prefix);
      return true;
    }
    if (state.step === "language") {
      state.answers.audienceConfirmed = false;
      askFaqAudience(prefix);
      return true;
    }
    if (state.step === "count") {
      state.answers.languageConfirmed = false;
      askFaqLanguage(prefix);
      return true;
    }
    if (state.step === "categories" || state.step === "categoriesCustom") {
      state.answers.countConfirmed = false;
      askFaqCount(prefix);
      return true;
    }
    if (state.step === "categoryCounts" || state.step === "categoryCountsCustom") {
      state.answers.categoriesConfirmed = false;
      askFaqCategories(prefix);
      return true;
    }
    if (state.step === "source" || state.step === "sourceUrl" || state.step === "sourceCustom") {
      state.answers.categoryCountsConfirmed = false;
      askFaqCategoryCounts(prefix);
      return true;
    }
    if (state.step === "questionGuidance" || state.step === "questionGuidanceCustom") {
      state.answers.sourceConfirmed = false;
      askFaqSource(prefix);
      return true;
    }
    if (state.step === "answerGuidance" || state.step === "answerGuidanceCustom") {
      state.answers.questionGuidanceConfirmed = false;
      askQuestionGuidance(prefix);
      return true;
    }
    if (state.step === "style" || state.step === "styleCustom") {
      state.answers.answerGuidanceConfirmed = false;
      askAnswerGuidance(prefix);
      return true;
    }
    if (state.step === "qa") {
      state.answers.styleConfirmed = false;
      askFaqStyle(prefix);
      return true;
    }
    if (state.step === "ready" || state.step === "extraGuidance") {
      state.answers.qaConfirmed = false;
      askFaqQa(prefix);
      return true;
    }
    if (state.step === "forbiddenPhrases") {
      finishSetup(prefix);
      return true;
    }
    return false;
  }

  function goBackToolStep() {
    const tool = getTool(state.activeToolId);
    if (!tool) return false;
    if (tool.id === "site-ai-audit" && (state.activeStep === "auditChecks" || state.pendingQuestion?.key === "auditFocus")) {
      state.pendingQuestion = { toolId: tool.id, key: "auditProfile" };
      askSiteAuditProfile();
      return true;
    }
    if (["targetLangs", "languages"].includes(state.pendingQuestion?.key || state.activeStep)) {
      const key = toolLanguageKey();
      state.collectedInputs[key] = [];
      updateToolMissingInputs();
      advanceToolFlow(prefersHebrew() ? "חזרתי צעד אחורה." : "Went one step back.");
      return true;
    }
    if (state.step === "ready") {
      updateToolMissingInputs();
      const field = firstMissingField(tool) || [...(tool.optionalInputs || [])].find((item) => item.key === "maxPages");
      if (field) {
        state.pendingQuestion = { toolId: tool.id, key: field.key };
        ask("toolField", [faqBackPrefix(), fieldQuestionText(tool, field)].filter(Boolean).join("\n\n"), toolFieldReplies(tool, field));
        return true;
      }
    }
    return false;
  }

  function handleSpecialReply(value) {
    if (value === "faq:back") {
      if (state.mode === "faq" && goBackFaqStep()) return true;
      if (state.mode === "tool" && goBackToolStep()) return true;
      return true;
    }

    if (value === "start:faq") return startTool("faq-playground", "");
    if (value === "start:file") return startTool("file-draft", "");
    if (value === "start:translate") return startTool("translate-demo", "");
    if (value === "start:schema") return startTool("schema-builder", "");
    if (value === "start:meta") return startTool("meta-tags", "");
    if (value === "start:client-reports") return startTool("client-reports", "");
    if (value === "start:site-audit") return startTool("site-ai-audit", "");
    if (value === "start:faq-audit") return startTool("site-ai-faq-audit", "");
    if (value === "start:sheet-edit") return startTool("design-formatting", "");

    if (value.startsWith("toolfield:")) {
      const [, key, ...rest] = value.split(":");
      assignToolField(key, rest.join(":"));
      advanceToolFlow();
      return true;
    }

    if (value.startsWith("lang-toggle:")) {
      const lang = value.replace("lang-toggle:", "");
      const key = toolLanguageKey();
      const current = new Set(toolLanguageValues(key));
      if (current.has(lang)) current.delete(lang);
      else current.add(lang);
      setToolLanguageValues(key, Array.from(current));
      refreshToolLanguageReplies(key);
      return true;
    }

    if (value === "lang-clear") {
      const key = toolLanguageKey();
      setToolLanguageValues(key, []);
      refreshToolLanguageReplies(key);
      return true;
    }

    if (value === "lang-done") {
      const key = toolLanguageKey();
      if (!toolLanguageValues(key).length) {
        bot(prefersHebrew() ? "בחרי לפחות שפה אחת, או כתבי שפה מותאמת." : "Choose at least one language, or type a custom language.");
        refreshToolLanguageReplies(key);
        return true;
      }
      if (state.activeToolId === "meta-tags" && key === "languages") state.collectedInputs.metaLanguageConfirmed = true;
      showSelectedAnswer(localizedLanguageCodes(state.collectedInputs[key]));
      advanceToolFlow(prefersHebrew()
        ? `בחרתי שפות: ${localizedLanguageCodes(state.collectedInputs[key])}.`
        : `Selected languages: ${localizedLanguageCodes(state.collectedInputs[key])}.`);
      return true;
    }

    if (value.startsWith("lang:")) {
      const lang = value.replace("lang:", "");
      const key = state.pendingQuestion?.key || (state.activeToolId === "translate-demo" ? "targetLangs" : "languages");
      const current = manifestSplitList(state.collectedInputs[key]);
      state.collectedInputs[key] = Array.from(new Set([...current, lang]));
      if (state.step === "toolField" && ["targetLangs", "languages"].includes(key)) refreshToolLanguageReplies(key);
      else advanceToolFlow();
      return true;
    }

    if (value.startsWith("schema:")) {
      if (value.startsWith("schema:run:")) {
        const policy = value.endsWith(":overwrite") ? "overwrite" : "skip";
        setExistingValuePolicy(policy);
        state.collectedInputs.previewOnly = false;
        state.collectedInputs.dryRun = false;
        updateToolMissingInputs();
        runCurrentTool({ confirmed: true });
        return true;
      }
      if (value === "schema:output") {
        state.pendingQuestion = { toolId: state.activeToolId, key: "outputCell" };
        ask("toolField", prefersHebrew()
          ? "לאיזה תא לכתוב את הסכמה? אפשר לשלוח תא כמו E73, או שם טאב ותא כמו FAQPage Schema!A1."
          : "Where should I write the JSON-LD? Send a cell like E73, or a tab and cell like FAQPage Schema!A1.", [
          { label: prefersHebrew() ? "להשתמש ב־E73" : "Use E73", value: "toolfield:outputCell:E73" },
          { label: prefersHebrew() ? "להשתמש ב־A1" : "Use A1", value: "toolfield:outputCell:A1" },
          { label: prefersHebrew() ? "להישאר בבדיקה מקדימה" : "Keep preview only", value: "schema:preview" }
        ]);
        return true;
      }
      if (value.startsWith("schema:columns:")) {
        const [, , questionColumn, answerColumn] = value.split(":");
        state.collectedInputs.questionColumn = questionColumn || "B";
        state.collectedInputs.answerColumn = answerColumn || "C";
        advanceToolFlow(prefersHebrew() ? "מעולה, אשתמש בעמודה B לשאלות ובעמודה C לתשובות." : "Great, I’ll use column B for questions and column C for answers.");
        return true;
      }
      state.collectedInputs.previewOnly = value === "schema:preview";
      state.collectedInputs.dryRun = state.collectedInputs.previewOnly;
      if (!state.collectedInputs.previewOnly) setExistingValuePolicy("skip");
      const prefix = state.collectedInputs.previewOnly
        ? (prefersHebrew() ? "חזרנו לבדיקה מקדימה. לא תהיה כתיבה לגיליון." : "Preview mode is on. I will not write anything to the Sheet.")
        : (prefersHebrew() ? `אוקיי. הסכמה מיועדת לתא ${schemaOutputCell()}. אם התא מלא, בחרי אם לדלג או לדרוס.` : `Write target is ${schemaOutputCell()}. Choose whether to skip a filled cell or overwrite it.`);
      advanceToolFlow(prefix);
      return true;
    }

    if (value.startsWith("meta-pages:")) {
      const mode = value.replace("meta-pages:", "");
      if (mode === "source") {
        state.collectedInputs.metaPageSourceConfirmed = true;
        advanceToolFlow(prefersHebrew()
          ? "מעולה. אשתמש בשם הקובץ/הקבצים כמקור לשמות העמודים."
          : "Great. I’ll use the file name(s) as the page topics.");
        return true;
      }
      if (mode === "manual") {
        state.pendingQuestion = { toolId: state.activeToolId, key: "metaManualPages" };
        ask("toolField", prefersHebrew()
          ? "כתבי כל עמוד בשורה נפרדת. זה ירוץ כבדיקה מקדימה, כי רשימה ידנית לא יכולה להיכתב אוטומטית בחזרה לגיליון."
          : "Send each page on a separate line. This will run as preview, because manual page lists cannot be written back automatically.", [
            { label: prefersHebrew() ? "לפתוח כלי Meta" : "Open Meta Tags Studio", value: "open-tool" }
          ]);
        return true;
      }
    }

    if (value.startsWith("meta-fields:")) {
      setMetaFields(value.replace("meta-fields:", ""));
      advanceToolFlow(prefersHebrew()
        ? `אבנה: ${metaFieldLabel()}.`
        : `I’ll generate: ${metaFieldLabel()}.`);
      return true;
    }

    if (value.startsWith("meta-language:")) {
      const language = value.replace("meta-language:", "");
      if (language === "custom") {
        state.pendingQuestion = { toolId: state.activeToolId, key: "languages" };
        askToolLanguages(getTool(state.activeToolId), { key: "languages" }, prefersHebrew() ? "בחרי שפה אחת או יותר." : "Choose one or more languages.");
        return true;
      }
      state.collectedInputs.languages = [language];
      state.collectedInputs.metaLanguageConfirmed = true;
      advanceToolFlow(prefersHebrew()
        ? `השפה תהיה ${localizedLanguageCodes(state.collectedInputs.languages)}.`
        : `Language set to ${localizedLanguageCodes(state.collectedInputs.languages)}.`);
      return true;
    }

    if (value.startsWith("meta-build:")) {
      const mode = value.replace("meta-build:", "") === "ai" ? "ai" : "template";
      state.collectedInputs.generationMode = mode;
      state.collectedInputs.metaGenerationConfirmed = true;
      advanceToolFlow(mode === "ai"
        ? (prefersHebrew() ? "אבנה ניסוחים עם AI. זה צורך קריאת OpenAI בזמן ההרצה." : "I’ll use AI-written copy. This uses an OpenAI call when run.")
        : (prefersHebrew() ? "אבנה מתבנית מהירה, בלי קריאת AI." : "I’ll use a fast template without an AI call."));
      return true;
    }

    if (value.startsWith("meta-output:")) {
      const [, modeRaw, policyRaw] = value.split(":");
      if (modeRaw === "preview") {
        state.collectedInputs.outputMode = "preview";
        state.collectedInputs.metaOutputConfirmed = true;
        setExistingValuePolicy("skip");
      } else if (modeRaw === "firstTabCell") {
        state.pendingQuestion = { toolId: state.activeToolId, key: "metaFirstTabCell" };
        ask("metaFirstTabCell", prefersHebrew()
          ? "מאיזה תא בטאב הראשון להתחיל לכתוב? למשל E70. ברירת המחדל היא לדלג אם יש כבר ערכים."
          : "Which first-tab cell should I start writing from? For example E70. Default is to skip if cells already have values.", [
          { label: "E70", value: "toolfield:metaFirstTabCell:E70", primary: true },
          { label: "A1", value: "toolfield:metaFirstTabCell:A1" }
        ]);
        return true;
      } else {
        state.collectedInputs.outputMode = modeRaw === "firstTabRange" ? "firstTabRange" : "newTab";
        state.collectedInputs.outputTabName = state.collectedInputs.outputMode === "newTab" ? (state.collectedInputs.outputTabName || "Meta Tags") : state.collectedInputs.outputTabName;
        state.collectedInputs.outputStartCell = state.collectedInputs.outputStartCell || "A1";
        state.collectedInputs.metaOutputConfirmed = true;
        setExistingValuePolicy(policyRaw === "overwrite" ? "overwrite" : "skip");
      }
      advanceToolFlow(prefersHebrew()
        ? `יעד הפלט: ${metaOutputLabel()}.`
        : `Output destination: ${metaOutputLabel()}.`);
      return true;
    }

    if (value.startsWith("meta:")) {
      const mode = value.replace("meta:", "");
      if (value.startsWith("meta:run:")) {
        const policy = value.endsWith(":overwrite") ? "overwrite" : "skip";
        setExistingValuePolicy(policy);
        if (!state.collectedInputs.outputMode || state.collectedInputs.outputMode === "preview") state.collectedInputs.outputMode = "newTab";
        updateToolMissingInputs();
        runCurrentTool({ confirmed: true });
        return true;
      }
      if (mode === "ai" || mode === "template") state.collectedInputs.generationMode = mode;
      if (mode === "preview") state.collectedInputs.outputMode = "preview";
      advanceToolFlow();
      return true;
    }

    if (value === "audit:profile") {
      askSiteAuditProfile();
      return true;
    }

    if (value === "audit:focus") {
      askSiteAuditChecks();
      return true;
    }

    if (value === "audit:pages") {
      state.pendingQuestion = { toolId: state.activeToolId, key: "maxPages" };
      ask("toolField", prefersHebrew() ? "כמה עמודים לבדוק לעומק?" : "How many pages should the crawler inspect deeply?", [
        { label: prefersHebrew() ? "זריז · 15 עמודים" : "Quick · 15 pages", value: "toolfield:maxPages:15" },
        { label: prefersHebrew() ? "סטנדרטי · 25 עמודים" : "Standard · 25 pages", value: "toolfield:maxPages:25" },
        { label: prefersHebrew() ? "עמוק · 50 עמודים" : "Deep · 50 pages", value: "toolfield:maxPages:50" },
        { label: prefersHebrew() ? "עמוק מאוד · 100 עמודים" : "Very deep · 100 pages", value: "toolfield:maxPages:100" }
      ]);
      return true;
    }

    if (value.startsWith("auditprofile:")) {
      const profile = value.replace("auditprofile:", "");
      applySiteAuditProfile(profile);
      const label = localizedSiteAuditProfileLabel(profile);
      advanceToolFlow(prefersHebrew()
        ? `בחרתי סוג אודיט: ${label}.`
        : `Selected audit type: ${label}.`);
      return true;
    }

    if (value.startsWith("audit-toggle:")) {
      const id = value.replace("audit-toggle:", "");
      if (!auditCheckOptions().some((item) => item.id === id)) return true;
      state.collectedInputs.auditFocus = "custom";
      state.auditCheckSelectionTouched = true;
      state.collectedInputs[id] = !hasAuditCheck(id);
      refreshAuditCheckReplies();
      return true;
    }

    if (value === "audit-checks:all") {
      const allIds = auditCheckOptions().map((item) => item.id);
      const allSelected = allIds.every((id) => hasAuditCheck(id));
      state.collectedInputs.auditFocus = allSelected ? "custom" : "full";
      state.auditCheckSelectionTouched = true;
      setAuditCheckIds(allSelected ? [] : allIds);
      refreshAuditCheckReplies();
      return true;
    }

    if (value === "audit-checks:recommended") {
      state.collectedInputs.auditFocus = recommendedSiteAuditFocus();
      state.auditCheckSelectionTouched = true;
      setAuditCheckIds(recommendedSiteAuditCheckIds());
      refreshAuditCheckReplies();
      return true;
    }

    if (value === "audit-checks:clear") {
      state.collectedInputs.auditFocus = "custom";
      state.auditCheckSelectionTouched = true;
      setAuditCheckIds([]);
      refreshAuditCheckReplies();
      return true;
    }

    if (value === "audit-checks:back") {
      state.collectedInputs.auditFocus = "";
      state.auditCheckSelectionTouched = false;
      setAuditCheckIds([]);
      askSiteAuditProfile();
      return true;
    }

    if (value === "audit-checks-done") {
      if (!auditCheckOptions().some((item) => hasAuditCheck(item.id))) {
        bot(prefersHebrew() ? "בחרי לפחות בדיקה אחת כדי שהאודיט יהיה שימושי." : "Choose at least one check so the audit is useful.");
        refreshAuditCheckReplies();
        return true;
      }
      showSelectedAnswer(selectedAuditCheckLabel());
      updateToolMissingInputs();
      advanceToolFlow(prefersHebrew() ? "עדכנתי את בדיקות האודיט." : "Updated the audit checks.");
      return true;
    }

    if (value === "format:dry-run") {
      state.collectedInputs.dryRun = true;
      state.liveRunConfirmed = false;
      updateToolMissingInputs();
      runCurrentTool();
      return true;
    }

    if (value === "format:confirm-live") {
      state.collectedInputs.dryRun = false;
      state.liveRunConfirmed = false;
      updateToolMissingInputs();
      state.lastPayload = reconcileColumnTransferPayload(state.lastPayload || buildToolPayload(getTool("design-formatting"), state.collectedInputs), true);
      askDesignFormattingLiveConfirmation();
      return true;
    }

    if (value === "format:live-run") {
      state.collectedInputs.dryRun = false;
      state.liveRunConfirmed = true;
      updateToolMissingInputs();
      runCurrentTool({ confirmed: true });
      return true;
    }

    if (value === "tool:confirm-run") {
      state.runConfirmed = true;
      runCurrentTool({ confirmed: true });
      return true;
    }

    if (value === "format:preview") {
      state.collectedInputs.dryRun = true;
      state.liveRunConfirmed = false;
      advanceToolFlow(prefersHebrew()
        ? "חזרנו לבדיקה בלי כתיבה. לא תהיה כתיבה לגיליון לפני אישור."
        : "Preview mode is on. Nothing will be written before review.");
      return true;
    }
    if (value === "open-tool") {
      openCurrentToolWorkspace();
      return true;
    }

    if (value === "audit:no-ai") {
      state.collectedInputs.includeAiAnalysis = false;
      advanceToolFlow();
      return true;
    }
    if (value === "audit:faq-only") {
      applySiteAuditProfile("faq-schema");
      advanceToolFlow();
      return true;
    }
    if (value === "audit:rendered") {
      applySiteAuditProfile("rendered-deep");
      advanceToolFlow();
      return true;
    }
    if (value.startsWith("pages:")) {
      state.collectedInputs.maxPages = Number(value.replace("pages:", "")) || 30;
      advanceToolFlow();
      return true;
    }
    if (value === "faqaudit:map-site") {
      runFaqAuditDiscovery();
      return true;
    }
    if (value.startsWith("faqaudit:maxurls:")) {
      state.collectedInputs.maxDiscoveryUrls = Number(value.replace("faqaudit:maxurls:", "")) || 1000;
      askFaqAuditDiscovery();
      return true;
    }
    if (value.startsWith("faqaudit:depth:")) {
      state.collectedInputs.maxDepth = Number(value.replace("faqaudit:depth:", "")) || 3;
      askFaqAuditDiscovery();
      return true;
    }
    if (value.startsWith("faqaudit-group-toggle:")) {
      const group = value.replace("faqaudit-group-toggle:", "");
      const selected = new Set(selectedFaqAuditGroups());
      if (selected.has(group)) selected.delete(group);
      else selected.add(group);
      state.collectedInputs.groups = Array.from(selected);
      syncFaqAuditSelectedUrls();
      state.faqAuditGroupSelectionTouched = true;
      refreshFaqAuditGroupReplies();
      return true;
    }
    if (value === "faqaudit-groups:all") {
      const allGroups = faqAuditAvailableGroups().map((group) => group.group);
      const selected = new Set(selectedFaqAuditGroups());
      const allSelected = allGroups.length > 0 && allGroups.every((group) => selected.has(group));
      state.collectedInputs.groups = allSelected ? [] : allGroups;
      syncFaqAuditSelectedUrls();
      state.faqAuditGroupSelectionTouched = true;
      refreshFaqAuditGroupReplies();
      return true;
    }
    if (value === "faqaudit-groups:clear") {
      state.collectedInputs.groups = [];
      delete state.collectedInputs.urls;
      state.faqAuditGroupSelectionTouched = true;
      refreshFaqAuditGroupReplies();
      return true;
    }
    if (value === "faqaudit-groups:recommended") {
      state.collectedInputs.groups = defaultFaqAuditGroups();
      syncFaqAuditSelectedUrls();
      state.faqAuditGroupSelectionTouched = true;
      refreshFaqAuditGroupReplies();
      return true;
    }
    if (value === "faqaudit-groups:back") {
      delete state.collectedInputs.groups;
      delete state.collectedInputs.urls;
      state.faqAuditGroupSelectionTouched = false;
      askFaqAuditDiscovery(prefersHebrew()
        ? "חזרתי צעד אחורה להגדרות המיפוי."
        : "I went one step back to the discovery settings.");
      return true;
    }
    if (value === "faqaudit-groups-done") {
      if (!selectedFaqAuditGroups().length) {
        bot(prefersHebrew() ? "בחרי לפחות קבוצת URL אחת לאודיט." : "Choose at least one URL group for the audit.");
        refreshFaqAuditGroupReplies();
        return true;
      }
      state.collectedInputs.groups = selectedFaqAuditGroups();
      state.collectedInputs.urls = faqAuditUrlsForGroups(state.collectedInputs.groups);
      showSelectedAnswer(selectedFaqAuditGroupLabel());
      updateToolMissingInputs();
      const selectedUrls = selectedFaqAuditUrlCount();
      finishToolSetup(prefersHebrew()
        ? `מעולה. אשתמש ב־${selectedUrls} URLs שנבחרו מהמיפוי הקיים.`
        : `Great. I will use ${selectedUrls} URLs selected from the existing discovery map.`);
      return true;
    }
    if (value === "faqaudit:static" || value === "faqaudit:rendered") {
      state.collectedInputs.renderMode = value.replace("faqaudit:", "");
      advanceToolFlow();
      return true;
    }
    if (value === "faqaudit:source") {
      const source = state.sources.find((item) => item.kind === "Google Sheet" || item.kind === "Drive folder");
      if (source) state.collectedInputs.sourceInput = source.url;
      ask("toolField", prefersHebrew() ? "שלחי Google Sheet או תיקיית Drive להשוואת מקור." : "Send the source Google Sheet or Drive folder for comparison.", state.sources.map((item) => ({
        label: prefersHebrew() ? `להשתמש ב־${item.kind}` : `Use ${item.kind}`,
        value: `toolfield:sourceInput:${item.url}`
      })));
      state.pendingQuestion = { toolId: state.activeToolId, key: "sourceInput" };
      return true;
    }

    if (value.startsWith("hint:")) {
      const hint = value.replace("hint:", "");
      const hebrew = prefersHebrew();
      if (hint === "single-subject") bot(hebrew ? "כתבי את השם המדויק, למשל: Bachar House." : "Type the exact name, for example: Bachar House.");
      else if (hint === "multi-subject") bot(hebrew ? "כתבי כל נושא בשורה נפרדת, או הפרידי בפסיקים." : "Send each subject on a new line, or separate them with commas.");
      else if (hint === "not-sure-subject") bot(hebrew ? "אפשר לכתוב לקוח, עמוד, מלון, מוצר או נושא כללי, ואעזור לדייק." : "Give me the client, page, hotel, product, or rough topic, and I’ll help tighten it.");
      else if (hint === "custom-audience") bot(hebrew ? "כתבי במשפט אחד למי זה מיועד." : "Write one sentence about who this is for.");
      else if (hint === "custom-languages") bot(hebrew ? "כתבי את השפות הרצויות, למשל: גרמנית, צרפתית, ספרדית." : "Type the target languages, for example: German, French, Spanish.");
      return true;
    }

    if (value.startsWith("file:path:")) {
      state.fileTask.filePath = value.replace("file:path:", "");
      state.fileTask.targetScope = "";
      state.fileTask.targetKind = "repo-path";
      state.collectedInputs.filePath = state.fileTask.filePath;
      state.collectedInputs.targetScope = "";
      state.collectedInputs.targetKind = "repo-path";
      state.step = "fileInstruction";
      ask("fileInstruction", hasHebrew(state.fileTask.filePath)
        ? `מה לשנות ב־${state.fileTask.filePath}?`
        : `What should change in ${state.fileTask.filePath}?`, []);
      return true;
    }

    if (value === "file:discover") {
      state.mode = "file";
      state.step = "fileInstruction";
      state.activeIntent = "file-edit";
      state.activeToolId = "file-draft";
      state.activeStep = "collecting";
      state.fileTask.targetKind = "repo-discovery";
      state.fileTask.targetScope = codexDiscoveryTarget(state.messages.at(-1)?.text || "");
      state.collectedInputs = { ...state.fileTask };
      renderWorkspace();
      ask("fileInstruction", prefersHebrew() ? "מעולה. מה צריך להשתנות? אפשר לכתוב חופשי, ו־Codex יאתר את הקבצים הרלוונטיים בזמן העבודה." : "Great. What should change? Write naturally, and Codex will identify the relevant files while working.", []);
      return true;
    }

    if (value === "file:ask-path") {
      state.mode = "file";
      state.step = "filePath";
      state.activeIntent = "file-edit";
      state.activeToolId = "file-draft";
      state.activeStep = "collecting";
      renderWorkspace();
      ask("filePath", prefersHebrew() ? "שלחי נתיב קובץ מקומי בפרויקט, למשל public/page.html, docs/file.md, src/jobs/example.ts. אם זה Google Sheet, אבחר את כלי הגיליונות במקום." : "Send a local project file path, for example public/page.html, docs/file.md, or src/jobs/example.ts. If it is a Google Sheet, I’ll use the sheet tool instead.", []);
      return true;
    }

    if (value === "file:pasted-content") {
      state.mode = "file";
      state.step = "fileInstruction";
      state.activeIntent = "file-edit";
      state.activeToolId = "file-draft";
      state.activeStep = "collecting";
      state.fileTask.targetKind = "pasted-content";
      state.fileTask.targetScope = "User will paste content or describe an external content file.";
      state.collectedInputs = { ...state.fileTask };
      renderWorkspace();
      ask("fileInstruction", prefersHebrew() ? "הדביקי את התוכן או תארי את הקובץ ומה צריך לשנות בו. אם צריך אחר כך להפוך את זה לעריכת קוד/גיליון, אני אנתב." : "Paste the content or describe the file and what should change. If this needs to become a code or Sheet edit, I’ll route it.", []);
      return true;
    }

    if (value === "file:detail") {
      ask("fileInstruction", prefersHebrew() ? "כתבי את הפרטים שצריך להוסיף לבקשת העריכה." : "Add the details you want included in the edit request.", []);
      return true;
    }

    if (value.startsWith("scope:")) {
      state.mode = "faq";
      state.activeToolId = "faq-playground";
      state.answers.scope = value.replace("scope:", "");
      bot(prefersHebrew()
        ? `מעולה, נגדיר את זה כ־${localizedPresetLabel(state.answers.scope)}. עכשיו נמלא את הפרטים שמשפיעים על הסוכן.`
        : `Great, I’ll set this as ${localizedPresetLabel(state.answers.scope)}. Now we’ll fill in the details that matter.`);
      nextStep();
      return true;
    }

    if (value.startsWith("audience:")) {
      const kind = value.replace("audience:", "");
      state.answers.audience = {
        hotel: presetAudiences.hotel,
        compare: "Potential customers comparing options, trust signals, pricing, suitability and next steps.",
        existing: "Existing customers who need clear practical answers, support guidance and next steps."
      }[kind] || state.answers.audience;
      state.answers.audienceConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("audience-toggle:")) {
      const id = value.replace("audience-toggle:", "");
      const option = faqAudienceOptions().find((item) => item.id === id);
      if (!option) return true;
      const selected = faqAudienceSet();
      if (selected.has(option.value)) selected.delete(option.value);
      else selected.add(option.value);
      setFaqAudienceValues(Array.from(selected));
      refreshFaqAudienceReplies();
      return true;
    }

    if (value === "audience-clear") {
      setFaqAudienceValues([]);
      state.answers.audienceConfirmed = false;
      refreshFaqAudienceReplies();
      return true;
    }

    if (value === "audience-done") {
      if (!faqAudienceValues().length) {
        bot(prefersHebrew() ? "בחרי לפחות קהל אחד, או כתבי קהל מותאם." : "Choose at least one audience, or write a custom audience.");
        refreshFaqAudienceReplies();
        return true;
      }
      showSelectedAnswer(localizedAudience(audienceText()));
      state.answers.audienceConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("language:")) {
      state.answers.language = value.replace("language:", "");
      state.answers.languageConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("count:")) {
      state.answers.count = value.replace("count:", "");
      state.answers.countConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("category-toggle:")) {
      const id = value.replace("category-toggle:", "");
      const option = faqCategoryOptions().find((item) => item.id === id);
      if (!option) return true;
      const selected = new Set(faqCategoryValues());
      if (selected.has(option.value)) selected.delete(option.value);
      else selected.add(option.value);
      setFaqCategoryValues(Array.from(selected));
      refreshFaqCategoryReplies();
      return true;
    }

    if (value === "categories:all") {
      const options = faqCategoryOptions();
      const selected = new Set(faqCategoryValues());
      const allSelected = options.length > 0 && options.every((item) => selected.has(item.value));
      setFaqCategoryValues(allSelected ? [] : options.map((item) => item.value));
      refreshFaqCategoryReplies();
      return true;
    }

    if (value === "categories:recommended") {
      setFaqCategoryValues(faqCategoryOptions().map((item) => item.value));
      refreshFaqCategoryReplies();
      return true;
    }

    if (value === "categories:clear") {
      setFaqCategoryValues([]);
      state.answers.categoriesConfirmed = false;
      refreshFaqCategoryReplies();
      return true;
    }

    if (value === "categories:custom") {
      ask("categoriesCustom", prefersHebrew()
        ? "כתבי קטגוריות, כל קטגוריה בשורה. אפשר להוסיף אחרי מקף/נקודתיים מה היא צריכה לכסות."
        : "Write categories, one per line. You can add a dash/colon with what each category should cover.", [
        { label: prefersHebrew() ? "בחירה מומלצת" : "Recommended categories", value: "categories:recommended" },
        backReply()
      ]);
      return true;
    }

    if (value === "categories-done") {
      if (!faqCategoryValues().length) {
        bot(prefersHebrew() ? "בחרי לפחות קטגוריה אחת, או כתבי קטגוריות משלך." : "Choose at least one category, or write your own categories.");
        refreshFaqCategoryReplies();
        return true;
      }
      showSelectedAnswer(localizedCategoryLabel());
      state.answers.categoriesConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("category-counts:")) {
      const mode = value.replace("category-counts:", "");
      if (mode === "custom") {
        ask("categoryCountsCustom", prefersHebrew()
          ? `כתבי חלוקת שאלות לפי קטגוריה. סך הכל צריך להתאים ל־${totalQuestionTargetText()}.`
          : `Write the question split by category. The total should fit ${totalQuestionTargetText()}.`, [
          { label: prefersHebrew() ? "לפי ביקוש וכוונת חיפוש" : "By demand and intent", value: "category-counts:demand" },
          backReply()
        ]);
        return true;
      }
      const labels = {
        demand: `Total target: ${totalQuestionTargetText()}. Allocate more questions to categories with stronger real-user demand, search intent and source confidence. Keep the sum within the selected total range.`,
        balanced: `Total target: ${totalQuestionTargetText()}. Split questions as evenly as possible across the selected categories, then adjust lightly for category importance.`,
        decision: `Total target: ${totalQuestionTargetText()}. Prioritize decision-making categories such as booking, pricing, fit, trust, policies and practical next steps.`
      };
      state.answers.categoryCounts = labels[mode] || labels.demand;
      state.answers.categoryCountsConfirmed = true;
      showSelectedAnswer(mode === "balanced"
        ? (prefersHebrew() ? "חלוקה מאוזנת" : "Balanced split")
        : mode === "decision"
          ? (prefersHebrew() ? "עדיפות להחלטת רכישה" : "Prioritize decision topics")
          : (prefersHebrew() ? "לפי ביקוש וכוונת חיפוש" : "By demand and intent"));
      nextStep();
      return true;
    }

    if (value.startsWith("source:saved:")) {
      const url = value.replace("source:saved:", "");
      state.answers.sourceMode = "url";
      state.answers.sourceUrl = url;
      state.answers.sourceInstructions = `Use this source as the primary factual source: ${url}. Use other public sources only to understand question demand. Mark missing facts as Needs source confirmation.`;
      state.answers.sourceConfirmed = true;
      recordSource(url, "FAQ source", "faq-playground");
      nextStep();
      return true;
    }

    if (value.startsWith("source:")) {
      const mode = value.replace("source:", "");
      if (mode === "choose" || (mode === "none" && state.step === "sourceUrl")) {
        state.answers.sourceMode = "";
        state.answers.sourceUrl = "";
        state.answers.sourceInstructions = "";
        askFaqSource(prefersHebrew()
          ? "אין בעיה, לא נשתמש ב־URL כרגע."
          : "No problem, I won’t use a URL right now.");
        return true;
      }
      state.answers.sourceMode = mode;
      if (mode === "url") {
        ask("sourceUrl", prefersHebrew() ? "שלחי את ה־URL. אני אשתמש בו כמקור העובדתי המרכזי, ואסמן מידע חסר לבדיקה." : "Send the URL. I’ll use it as the primary factual source and mark missing facts for review.", [
          { label: prefersHebrew() ? "אין URL כרגע" : "No URL yet", value: "source:choose" },
          backReply()
        ]);
        return true;
      }
      if (mode === "custom") {
        ask("sourceCustom", prefersHebrew() ? "כתבי במשפט או שניים אילו מקורות מותר לסוכן להשתמש בהם, ומה חייב להישאר לבדיקה." : "Write one or two sentences about which sources the agent may use, and what must stay marked for review.", [
          { label: prefersHebrew() ? "אתר רשמי בלבד" : "Official site only", value: "source:official" },
          { label: prefersHebrew() ? "אין מקור כרגע" : "No source yet", value: "source:none" },
          backReply()
        ]);
        return true;
      }
      if (mode === "none") {
        state.answers.sourceInstructions = "No confirmed source URL was provided. Generate useful questions, but mark factual details as Needs source confirmation and do not invent facts.";
      }
      if (mode === "official") {
        state.answers.sourceInstructions = "Use the official website as the primary factual source. Use public review or competitor signals only for question demand, not final facts. Mark missing facts as Needs source confirmation.";
      }
      state.answers.sourceConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("questionGuidance-toggle:")) {
      const id = value.replace("questionGuidance-toggle:", "");
      const option = questionGuidanceOptions.find((item) => item.id === id);
      if (!option) return true;
      const selected = new Set(guidanceValues("questionGuidance", questionGuidanceOptions));
      if (selected.has(option.value)) selected.delete(option.value);
      else selected.add(option.value);
      setGuidanceValues("questionGuidance", Array.from(selected));
      refreshQuestionGuidanceReplies();
      return true;
    }

    if (value === "question-guidance-clear") {
      state.answers.questionGuidance = "__none__";
      state.answers.questionGuidanceConfirmed = false;
      refreshQuestionGuidanceReplies();
      return true;
    }

    if (value === "question-guidance:custom") {
      ask("questionGuidanceCustom", prefersHebrew()
        ? "כתבי דגשים לפרומפט השאלות: איך לחקור, איך לנסח ומה לתעדף. מילים אסורות מדויקות יישמרו בנפרד."
        : "Write guidance for the question prompt: how to research, how to phrase and what to prioritize. Exact words to avoid are stored separately.", [
        { label: prefersHebrew() ? "להשתמש בדגשים המומלצים" : "Use recommended guidance", value: "question-guidance:recommended" },
        backReply()
      ]);
      return true;
    }

    if (value === "question-guidance:recommended") {
      setGuidanceValues("questionGuidance", questionGuidanceOptions.map((item) => item.value));
      state.answers.questionGuidanceConfirmed = true;
      nextStep();
      return true;
    }

    if (value === "question-guidance-done") {
      if (!guidanceValues("questionGuidance", questionGuidanceOptions).length) {
        setGuidanceValues("questionGuidance", questionGuidanceOptions.map((item) => item.value));
      }
      showSelectedAnswer(guidanceLabel("questionGuidance", questionGuidanceOptions));
      state.answers.questionGuidanceConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("answerGuidance-toggle:")) {
      const id = value.replace("answerGuidance-toggle:", "");
      const option = answerGuidanceOptions.find((item) => item.id === id);
      if (!option) return true;
      const selected = new Set(guidanceValues("answerGuidance", answerGuidanceOptions));
      if (selected.has(option.value)) selected.delete(option.value);
      else selected.add(option.value);
      setGuidanceValues("answerGuidance", Array.from(selected));
      refreshAnswerGuidanceReplies();
      return true;
    }

    if (value === "answer-guidance-clear") {
      state.answers.answerGuidance = "__none__";
      state.answers.answerGuidanceConfirmed = false;
      refreshAnswerGuidanceReplies();
      return true;
    }

    if (value === "answer-guidance:custom") {
      ask("answerGuidanceCustom", prefersHebrew()
        ? "כתבי דגשים לפרומפט התשובות: דיוק, מבנה, מקור, מגבלות, מה להדגיש ומה לא."
        : "Write guidance for the answer prompt: accuracy, structure, sources, constraints, what to emphasize and what to avoid.", [
        { label: prefersHebrew() ? "להשתמש בדגשים המומלצים" : "Use recommended guidance", value: "answer-guidance:recommended" },
        backReply()
      ]);
      return true;
    }

    if (value === "answer-guidance:recommended") {
      setGuidanceValues("answerGuidance", answerGuidanceOptions.map((item) => item.value));
      state.answers.answerGuidanceConfirmed = true;
      nextStep();
      return true;
    }

    if (value === "answer-guidance-done") {
      if (!guidanceValues("answerGuidance", answerGuidanceOptions).length) {
        setGuidanceValues("answerGuidance", answerGuidanceOptions.map((item) => item.value));
      }
      showSelectedAnswer(guidanceLabel("answerGuidance", answerGuidanceOptions));
      state.answers.answerGuidanceConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("qa-toggle:")) {
      const id = value.replace("qa-toggle:", "");
      if (!faqQaOptions().some((item) => item.id === id)) return true;
      const checks = faqQaChecks();
      if (checks.has(id)) checks.delete(id);
      else checks.add(id);
      setFaqQaChecks(checks);
      refreshFaqQaReplies();
      return true;
    }

    if (value === "qa-clear") {
      state.answers.qaMode = "none";
      state.answers.qaConfirmed = false;
      refreshFaqQaReplies();
      return true;
    }

    if (value === "qa-done") {
      if (!faqQaChecks().size) {
        bot(prefersHebrew() ? "בחרי לפחות בדיקה אחת, או לחצי בלי QA." : "Choose at least one check, or choose No QA.");
        refreshFaqQaReplies();
        return true;
      }
      showSelectedAnswer(localizedQaLabel());
      state.answers.qaConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("qa:")) {
      state.answers.qaMode = value.replace("qa:", "");
      showSelectedAnswer(localizedQaLabel());
      state.answers.qaConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("style:")) {
      const style = value.replace("style:", "");
      if (style === "custom") {
        ask("styleCustom", prefersHebrew() ? "כתבי את דגשי הסגנון. למשל: קצר, לא מכירתי, בלי הבטחות שלא מופיעות באתר." : "Write the style notes. For example: short, non-salesy, no promises that are not on the site.", [
          { label: prefersHebrew() ? "חם וקצר" : "Warm and concise", value: "style:Warm, concise, reliable." },
          { label: prefersHebrew() ? "מקצועי וישיר" : "Professional and direct", value: "style:Professional, direct and source-grounded." }
        ]);
        return true;
      }
      state.answers.style = style;
      state.answers.styleConfirmed = true;
      nextStep();
      return true;
    }

    if (value.startsWith("style-toggle:")) {
      const id = value.replace("style-toggle:", "");
      const option = styleOptions.find((item) => item.id === id);
      if (!option) return true;
      const selected = styleSet();
      if (selected.has(option.value)) selected.delete(option.value);
      else selected.add(option.value);
      setStyleValues(Array.from(selected));
      refreshFaqStyleReplies();
      return true;
    }

    if (value === "style-clear") {
      setStyleValues([]);
      state.answers.styleConfirmed = false;
      refreshFaqStyleReplies();
      return true;
    }

    if (value === "style-done") {
      if (!styleValues().length) state.answers.style = "Warm, concise, reliable.";
      showSelectedAnswer(localizedStyleLabel());
      state.answers.styleConfirmed = true;
      nextStep();
      return true;
    }

    if (value === "forbidden:edit") {
      askForbiddenPhrases();
      return true;
    }

    if (value === "forbidden:none") {
      state.answers.forbiddenPhrases = "";
      finishSetup(prefersHebrew() ? "לא אוסיף מילים אסורות." : "No words-to-avoid guardrail added.");
      return true;
    }

    if (value.startsWith("faq-validation:")) {
      const action = value.replace("faq-validation:", "");
      if (action === "accept") {
        applyFaqValidation(state.faqSubjectValidation || {});
        bot(prefersHebrew() ? "מעולה, אמשיך עם הנושא והשפה שאישרת." : "Great, I’ll continue with the confirmed subject and language.");
        runWorkflow();
        return true;
      }
      if (action === "keep-original") {
        state.faqSubjectValidation = {
          signature: faqValidationSignature(),
          confirmed: true,
          confirmedAt: new Date().toISOString(),
          keptOriginal: true
        };
        bot(prefersHebrew() ? "בסדר, אשאיר את הנושא בדיוק כמו שהגדרת." : "Okay, I’ll keep the subject exactly as provided.");
        runWorkflow();
        return true;
      }
      if (action === "edit-subject") {
        state.faqSubjectValidation = null;
        state.answers.subjects = "";
        state.answers.subjectRaw = "";
        askFaqSubjects(prefersHebrew() ? "אין בעיה. כתבי את שם הנושא המדויק." : "No problem. Send the exact subject name.");
        return true;
      }
      if (action === "edit-language") {
        state.faqSubjectValidation = null;
        state.answers.languageConfirmed = false;
        askFaqLanguage(prefersHebrew() ? "אין בעיה. בחרי את שפת הפלט." : "No problem. Choose the output language.");
        return true;
      }
    }

    if (value === "run") {
      runWorkflow();
      return true;
    }

    if (value === "run-tool") {
      runCurrentTool({ confirmed: true });
      return true;
    }

    if (value === "open-tool") {
      openCurrentToolWorkspace();
      return true;
    }

    if (value === "review") {
      if (state.activeToolId === "faq-playground") bot(summaryText());
      else bot(JSON.stringify(faqAuditNeedsDiscovery() ? faqAuditDiscoveryPayload() : (state.lastPayload || state.collectedInputs), null, 2));
      if (state.activeToolId === "faq-playground") setReadyReplies();
      else if (faqAuditNeedsDiscovery()) askFaqAuditDiscovery();
      else setGenericReadyReplies(getTool(state.activeToolId));
      return true;
    }

    if (value === "review-prompts") {
      if (state.activeToolId === "faq-playground") {
        bot(faqPromptsText());
        setReadyReplies();
      }
      return true;
    }

    if (value === "tool:detail") {
      ask("toolDetail", prefersHebrew() ? "הוסיפי הנחיות או מגבלות לכלי הזה." : "Add any extra instructions or constraints for this tool.", []);
      return true;
    }

    if (value === "extra") {
      ask("extraGuidance", prefersHebrew() ? "מעולה. כתבי עוד הנחיות תוכן לסוכן: מה חשוב לכלול או איזו זווית מקצועית לשמור. למילים אסורות מדויקות השתמשי בכפתור מילים אסורות." : "Great. Add any guidance for the agent: what to include or which professional angle to keep. For exact banned phrases, use Words to avoid.", [
        { label: prefersHebrew() ? "לא צריך, אפשר להריץ" : "No need, run it", value: "run" }
      ]);
      return true;
    }

    if (value === "reset") {
      resetAll();
      return true;
    }

    return false;
  }

  function appendToolInstruction(clean) {
    const key = state.activeToolId === "design-formatting" ? "instruction" : "instructions";
    const items = [state.collectedInputs[key], clean]
      .map((item) => compact(item || ""))
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index);
    state.collectedInputs[key] = items.join("\n");
    if (state.activeToolId === "design-formatting") {
      state.collectedInputs.instructions = state.collectedInputs[key];
    }
  }

  function extractExplicitOutputCell(text) {
    const source = withoutUrlsForDisplay(text);
    const matches = Array.from(String(source || "").matchAll(/\b(?:[\w -]+!)?[A-Z]{1,3}\d{1,6}\b/gi))
      .map((match) => match[0].trim());
    const cell = matches.find((item) => item.includes("!")) ||
      matches.find((item) => /^[A-Z]{1,3}\d{1,6}$/i.test(item));
    if (cell) return extractOutputCell(cell, cell);
    const reversed = String(source || "").match(/\b(\d{1,6})\s*([A-Z]{1,3})\b/i);
    return reversed ? `${reversed[2].toUpperCase()}${reversed[1]}` : "";
  }

  function isRunRequest(text) {
    const clean = String(text || "").trim().toLowerCase();
    return /^(run|run it|start|start it|go|go ahead|execute|launch)$/i.test(clean) ||
      /^(תריץ|תריצי|להריץ|תתחיל|תתחילי|אפשר להריץ)$/i.test(String(text || "").trim());
  }

  function extractPreserveTerms(text) {
    const clean = compact(text);
    const english = clean.match(/(?:keep|preserve)\s+(.+?)(?:\s+exactly|\s+as written|$)/i)?.[1];
    const hebrew = clean.match(/(?:לשמור|שמור|שמרי|לא לתרגם)\s+(?:את\s+)?(.+?)(?:\s+בדיוק|$)/i)?.[1];
    return compact(english || hebrew || clean).replace(/^[,.;\s]+|[,.;\s]+$/g, "");
  }

  function looksLikeLanguageUpdate(text, langs) {
    if (!langs.length || extractUrl(text)) return false;
    if (/add|also|too|include|language|target|translate|תוסיף|תוסיפי|גם|ועוד|עוד|בנוסף|שפה|תרגום/i.test(text)) return true;
    const allowed = String(text || "")
      .toLowerCase()
      .replace(/\b(english|hebrew|german|deutsch|french|spanish|italian|dutch|polish|russian|chinese|arabic|en|he|de|fr|es|it|nl|pl|ru|zh|ar|and|or|to|into|language|languages)\b/g, "")
      .replace(/אנגלית|עברית|גרמנית|צרפתית|ספרדית|איטלקית|הולנדית|פולנית|רוסית|סינית|ערבית|ו|או/g, "")
      .replace(/[\s,;/+&.-]/g, "");
    return allowed.length === 0;
  }

  function applySiteAuditHints(text, options = {}) {
    const { includePages = true } = options;
    const clean = compact(text);
    let changed = false;
    if (includePages) {
      const pages = Number(clean.match(/\b(\d{1,3})\s*(?:pages?|עמודים?)\b/i)?.[1] || "");
      if (pages) {
        state.collectedInputs.maxPages = pages;
        changed = true;
      } else if (/deeper|deep|עמוק|להעמיק|יותר עמודים/i.test(clean)) {
        state.collectedInputs.maxPages = Math.max(Number(state.collectedInputs.maxPages) || 0, 50);
        changed = true;
      }
    }
    if (/deeper|deep|עמוק|להעמיק/i.test(clean)) {
      state.collectedInputs.maxDepth = Math.max(Number(state.collectedInputs.maxDepth) || 0, 3);
      changed = true;
    }
    if (/render|rendered|playwright|javascript|js|מרונדר|דפדפן/i.test(clean)) {
      applySiteAuditProfile("rendered-deep");
      changed = true;
    } else if (/faq|schema|סכמה|שאלות/i.test(clean)) {
      applySiteAuditFocus("faq-schema");
      if (/profile|type|סוג/i.test(clean)) applySiteAuditProfile("faq-schema");
      changed = true;
    } else if (/technical|meta|seo|מטא|טכני/i.test(clean)) {
      applySiteAuditFocus("technical-meta");
      changed = true;
    }
    if (/no ai|without ai|disable ai|בלי ai|ללא ai/i.test(clean)) {
      state.collectedInputs.includeAiAnalysis = false;
      changed = true;
    } else if (/ai summary|ai analysis|with ai|סיכום ai|ניתוח ai/i.test(clean)) {
      state.collectedInputs.includeAiAnalysis = true;
      changed = true;
    }
    return changed;
  }

  function updateReadyToolFromText(text) {
    const tool = getTool(state.activeToolId);
    if (!tool || state.mode !== "tool" || state.step !== "ready") return false;
    const clean = compact(text);
    const lower = clean.toLowerCase();
    const hebrew = hasHebrew(clean) || prefersHebrew();

    if (tool.id === "translate-demo") {
      const langs = detectLanguagesFromText(clean, []);
      let changed = false;
      const notes = [];
      if (langs.length && looksLikeLanguageUpdate(clean, langs)) {
        const current = manifestSplitList(state.collectedInputs.targetLangs);
        state.collectedInputs.targetLangs = Array.from(new Set([...current, ...langs]));
        notes.push(hebrew ? `הוספתי שפות יעד: ${langs.join(", ")}.` : `Added target language(s): ${langs.join(", ")}.`);
        changed = true;
      }
      if (/preserve|\bkeep\b|לא לתרגם|לשמור|שמור/i.test(clean)) {
        const preserveTerms = extractPreserveTerms(clean);
        state.collectedInputs.preserveTerms = [state.collectedInputs.preserveTerms, preserveTerms].filter(Boolean).join("\n");
        notes.push(hebrew ? "הוספתי מונחים לשימור." : "Added preserve-terms guidance.");
        changed = true;
      }
      if (changed) {
        updateToolMissingInputs();
        finishToolSetup(notes.join(" "));
        return true;
      }
    }

    if (tool.id === "schema-builder") {
      let changed = false;
      const cell = extractExplicitOutputCell(clean);
      if (cell && /output|cell|put|write|place|save|שם|לשם|בתא|לתא|ב-|ב־|ל-|ל־|עמודה|sheet/i.test(clean)) {
        state.collectedInputs.outputCell = cell;
        changed = true;
      }
      if (/write|inject|save|to sheet|לכתוב|להכניס|לשמור|לגיליון/i.test(clean)) {
        state.collectedInputs.previewOnly = false;
        state.collectedInputs.dryRun = false;
        changed = true;
      }
      if (/overwrite|replace existing|דרוס|לדרוס|דריסה/i.test(clean)) {
        setExistingValuePolicy("overwrite");
        changed = true;
      } else if (/skip|empty only|only if empty|דלג|ריק|תא ריק/i.test(clean)) {
        setExistingValuePolicy("skip");
        changed = true;
      }
      if (/preview|dry|בלי כתיבה|לא לכתוב|תצוגה/i.test(clean)) {
        state.collectedInputs.previewOnly = true;
        state.collectedInputs.dryRun = true;
        changed = true;
      }
      const columnPair = clean.match(/\b([A-Z]{1,3})\s*(?:\/|,|and|ו)\s*([A-Z]{1,3})\b/i);
      if (columnPair && /column|columns|question|answer|עמוד|שאלה|תשובה/i.test(clean)) {
        state.collectedInputs.questionColumn = columnPair[1].toUpperCase();
        state.collectedInputs.answerColumn = columnPair[2].toUpperCase();
        changed = true;
      }
      if (changed) {
        updateToolMissingInputs();
        finishToolSetup(hebrew ? "עדכנתי את הגדרות ה־Schema לפי ההמשך." : "Updated the Schema setup from that follow-up.");
        return true;
      }
    }

    if (tool.id === "site-ai-audit") {
      const changed = applySiteAuditHints(clean);
      if (changed) {
        updateToolMissingInputs();
        finishToolSetup(hebrew ? "עדכנתי את הגדרות האודיט לפי ההמשך." : "Updated the audit setup from that follow-up.");
        return true;
      }
    }

    if (tool.id === "meta-tags") {
      let changed = false;
      const langs = detectLanguagesFromText(clean, []);
      if (langs.length && looksLikeLanguageUpdate(clean, langs)) {
        const current = manifestSplitList(state.collectedInputs.languages);
        state.collectedInputs.languages = Array.from(new Set([...current, ...langs]));
        state.collectedInputs.metaLanguageConfirmed = true;
        changed = true;
      }
      if (applyMetaOutputIntentFromText(clean, { confirm: true })) changed = true;
      if (/\bai\b|בינה|איי/.test(lower)) {
        state.collectedInputs.generationMode = "ai";
        state.collectedInputs.metaGenerationConfirmed = true;
        changed = true;
      }
      if (/template|תבנית/.test(lower)) {
        state.collectedInputs.generationMode = "template";
        state.collectedInputs.metaGenerationConfirmed = true;
        changed = true;
      }
      if (changed) {
        updateToolMissingInputs();
        finishToolSetup(hebrew ? "עדכנתי את הגדרות ה־Meta Tags לפי ההמשך." : "Updated the Meta Tags setup from that follow-up.");
        return true;
      }
    }

    return false;
  }

  function isDryRunRequest(text) {
    return /\bdry\s*run\b|preview|תצוגה|בדיקה\s+יבשה|בלי\s+כתיבה|לא\s+לכתוב/i.test(String(text || ""));
  }

  function isLiveRunConfirmation(text) {
    const clean = String(text || "").toLowerCase();
    return /^(yes|y|confirm|approved|run live|write|go ahead|ok)$/i.test(clean.trim()) ||
      /כן|מאשרת|מאושר|תריץ|להריץ|תכתוב|לכתוב|אפשר\s+לכתוב|להמשיך/.test(text);
  }

  function isPayloadRequest(text) {
    return /payload|json|תראה\s+payload|להציג\s+payload|פיילואד/i.test(String(text || ""));
  }

  async function handleFreeText(text) {
    const clean = compact(text);
    if (!clean) return;

    if (handleFaqAuditDiscoveryText(clean)) {
      renderWorkspace();
      return;
    }

    if (
      state.activeToolId === "site-ai-faq-audit" &&
      state.step === "toolField" &&
      state.pendingQuestion?.key === "groups" &&
      applyFaqAuditGroupText(clean)
    ) {
      renderWorkspace();
      return;
    }

    if (state.activeToolId === "meta-tags" && state.mode === "tool") {
      if (state.pendingQuestion?.toolId === state.activeToolId && state.step === "toolField") {
        assignToolField(state.pendingQuestion.key, clean);
        advanceToolFlow();
        return;
      }
      if (handleMetaStepText(clean)) {
        return;
      }
      if (state.step === "ready" && updateReadyToolFromText(clean)) {
        return;
      }
    }

    if (handlePlannedAssistantCommands(clean)) {
      renderWorkspace();
      return;
    }

    const forbiddenPhrasesFromText = state.mode === "faq" ? extractForbiddenPhrases(clean) : [];
    if (forbiddenPhrasesFromText.length) {
      appendForbiddenPhrases(forbiddenPhrasesFromText);
      if (state.step === "ready" || state.step === "extraGuidance") {
        finishSetup(prefersHebrew()
          ? `עדכנתי מילים אסורות: ${forbiddenPhrasesLabel()}.`
          : `Updated words to avoid: ${forbiddenPhrasesLabel()}.`);
        return;
      }
    }

    if (state.mode === "faq" && state.step === "scope" && (isFaqImplementationAuditIntent(clean) || /^(לא|no|not that|זה לא|לא זה)$/i.test(clean))) {
      const tool = getTool("site-ai-faq-audit");
      state.mode = "tool";
      state.step = "tool";
      state.activeToolId = tool?.id || "site-ai-faq-audit";
      state.activeIntent = tool?.id || "site-ai-faq-audit";
      state.activeStep = "collecting";
      state.collectedInputs = tool ? mergeToolInference(tool, "") : {};
      state.pendingQuestion = null;
      state.readyToRun = false;
      state.lastPayload = null;
      state.liveRunConfirmed = false;
      state.runConfirmed = false;
      updateToolMissingInputs();
      advanceToolFlow(prefersHebrew()
        ? "הבנתי, זו לא יצירת FAQ. נעבור לבדיקה של הטמעת FAQ / Schema באתר."
        : "Got it, this is not FAQ creation. I’ll switch to checking FAQ / schema implementation on a site.");
      return;
    }

    if (state.mode === "faq" && state.step === "forbiddenPhrases") {
      const phrases = forbiddenPhrasesFromText.length ? forbiddenPhrasesFromText : splitForbiddenPhrases(clean);
      if (!phrases.length && /אין|בלי|none|skip|no words/i.test(clean)) {
        state.answers.forbiddenPhrases = "";
        finishSetup(prefersHebrew() ? "לא אוסיף מילים אסורות." : "No words-to-avoid guardrail added.");
        return;
      }
      if (!phrases.length) {
        bot(prefersHebrew() ? "כתבי לפחות מילה או ביטוי אחד, או בחרי שאין מילים אסורות." : "Add at least one word or phrase, or choose no words to avoid.");
        askForbiddenPhrases();
        return;
      }
      appendForbiddenPhrases(phrases);
      finishSetup(prefersHebrew()
        ? `הוספתי מילים אסורות: ${forbiddenPhrasesLabel()}.`
        : `Added words to avoid: ${forbiddenPhrasesLabel()}.`);
      return;
    }

    if (isFaqImplementationAuditIntent(clean)) {
      startTool("site-ai-faq-audit", clean);
      return;
    }

    if (isGeneratedSheetEditIntent(clean)) {
      startSheetEditFollowup(clean);
      return;
    }

    if (isSheetColumnTransferIntent(clean)) {
      startColumnTransferFollowup(clean);
      return;
    }

    if (state.pendingQuestion?.toolId === state.activeToolId && state.step === "toolField") {
      assignToolField(state.pendingQuestion.key, clean);
      advanceToolFlow();
      return;
    }

    if (handleMetaStepText(clean)) {
      return;
    }

    if (state.activeToolId === "site-ai-faq-audit" && state.step === "toolDiscovery") {
      askFaqAuditDiscovery(prefersHebrew()
        ? "עוד לא הרצתי מיפוי. לחצי על מיפוי אתר או כתבי למפות."
        : "Discovery has not run yet. Click Map site or type map site.");
      return;
    }

    if (state.mode === "tool" && state.step === "ready" && updateReadyToolFromText(clean)) {
      return;
    }

    if (isResultLocationQuestion(clean) && (state.lastRun || state.runningPayload || state.lastPayload || state.outputs.length)) {
      bot(describeLastRunOutput(clean));
      if (state.mode === "tool" && state.activeToolId) setGenericReadyReplies(getTool(state.activeToolId));
      return;
    }

    if (state.step === "toolDetail") {
      appendToolInstruction(clean);
      finishToolSetup(hasHebrew(clean) ? "הוספתי את ההנחיה." : "Added the instruction.");
      return;
    }

    if (state.step === "formatLiveConfirm" && state.activeToolId === "design-formatting") {
      if (isDryRunRequest(clean)) {
        state.collectedInputs.dryRun = true;
        state.liveRunConfirmed = false;
        updateToolMissingInputs();
        runCurrentTool();
        return;
      }
      if (isLiveRunConfirmation(clean)) {
        state.collectedInputs.dryRun = false;
        state.liveRunConfirmed = true;
        updateToolMissingInputs();
        runCurrentTool();
        return;
      }
      if (/workspace|עורך|ממשק|מסך/i.test(clean)) {
        openCurrentToolWorkspace();
        return;
      }
      finishToolSetup(hasHebrew(clean) ? "נשארתי במצב בטוח. לא אריץ כתיבה בלי אישור ברור." : "I stayed in safe mode. I will not run a live write without clear confirmation.");
      return;
    }

    if (state.step === "toolRunConfirm" && state.mode === "tool") {
      if (isLiveRunConfirmation(clean)) {
        state.runConfirmed = true;
        runCurrentTool();
        return;
      }
      if (/workspace|עורך|ממשק|מסך/i.test(clean)) {
        openCurrentToolWorkspace();
        return;
      }
      state.runConfirmed = false;
      finishToolSetup(hasHebrew(clean) ? "נשארתי במצב בטוח. לא אריץ בלי אישור ברור." : "I stayed in safe mode. I will not run without clear confirmation.");
      return;
    }

    if ((state.activeToolId === "file-draft" || state.step === "filePath" || state.step === "fileInstruction") && hasSheetReference(clean)) {
      startTool("design-formatting", clean);
      return;
    }

    if (isFileIntent(clean) && state.step !== "fileInstruction" && state.step !== "filePath") {
      startFileTask(clean);
      return;
    }

    if (state.step === "idle") {
      const tool = detectToolIntent(clean);
      if (tool) {
        startTool(tool.id, clean);
        return;
      }
      if (await trySmartRouter(clean)) {
        renderWorkspace();
        return;
      }
      if (await tryGeneralAssistant(clean)) {
        renderWorkspace();
        return;
      }
      bot(hasHebrew(clean)
        ? "אני איתך. זה יכול להיות FAQ, תרגום, Schema, Meta, Audit, עריכת גיליון או עריכת קובץ. מה תרצי שאעשה בפועל?"
        : "I’m with you. This can be FAQ, translation, schema, meta tags, audits, sheet editing, or a file draft. What should I do with it?");
      setQuickReplies(homeReplies());
      renderWorkspace();
      return;
    }

    if (state.mode === "tool" && state.step === "ready") {
      if (isPayloadRequest(clean)) {
        bot(JSON.stringify(faqAuditNeedsDiscovery() ? faqAuditDiscoveryPayload() : (state.lastPayload || state.collectedInputs), null, 2));
        setGenericReadyReplies(getTool(state.activeToolId));
        return;
      }
      if (isRunRequest(clean)) {
        runCurrentTool({ confirmed: true });
        return;
      }
      if (isDryRunRequest(clean) && state.activeToolId === "design-formatting") {
        state.collectedInputs.dryRun = true;
        state.liveRunConfirmed = false;
        updateToolMissingInputs();
        runCurrentTool();
        return;
      }
      if (isLiveRunConfirmation(clean) && state.activeToolId === "design-formatting" && /write|live|לכתוב|כתיבה|גיליון|sheet/i.test(clean)) {
        state.collectedInputs.dryRun = false;
        state.liveRunConfirmed = false;
        updateToolMissingInputs();
        askDesignFormattingLiveConfirmation();
        return;
      }
      appendToolInstruction(clean);
      finishToolSetup(hasHebrew(clean) ? "הוספתי את זה כהנחיה לכלי." : "Added that as a tool instruction.");
      return;
    }

    if (state.step === "filePath") {
      if (hasSheetReference(clean)) {
        startTool("design-formatting", clean);
        return;
      }
      const filePath = extractFilePath(clean);
      if (!filePath) {
        state.fileTask.filePath = "";
        state.fileTask.targetScope = clean || "Codex should identify the relevant local files from the request.";
        state.fileTask.targetKind = "repo-discovery";
        state.collectedInputs = { ...state.fileTask };
        renderWorkspace();
        ask("fileInstruction", hasHebrew(clean)
          ? "לא קיבלתי נתיב קובץ מקומי, אז אשאיר את זה כמשימה שבה Codex יאתר את הקבצים הרלוונטיים. מה בדיוק צריך להשתנות?"
          : "I did not get a local file path, so I’ll keep this as a task where Codex identifies the relevant files. What exactly should change?", []);
        return;
      }
      state.fileTask.filePath = filePath;
      state.fileTask.targetScope = "";
      state.fileTask.targetKind = "repo-path";
      state.collectedInputs.filePath = state.fileTask.filePath;
      state.collectedInputs.targetScope = "";
      state.collectedInputs.targetKind = "repo-path";
      ask("fileInstruction", hasHebrew(clean)
        ? `מצאתי את ${state.fileTask.filePath}. מה לשנות בו?`
        : `I found ${state.fileTask.filePath}. What should change?`, []);
      return;
    }

    if (state.step === "fileInstruction") {
      state.fileTask.instruction = [state.fileTask.instruction, clean]
        .filter(Boolean)
        .filter((item, index, arr) => arr.indexOf(item) === index)
        .join("\n");
      finishFileTask();
      return;
    }

    if (state.step === "faqSubjectValidation") {
      state.faqSubjectValidation = null;
      state.answers.subjects = parseSubjectAnswer(clean);
      state.answers.subjectRaw = clean;
      const language = detectLanguage(clean);
      if (language) {
        state.answers.language = language;
        state.answers.languageConfirmed = true;
      }
      finishSetup(prefersHebrew() ? "עדכנתי את ההגדרה לפני הרצה." : "Updated the setup before running.");
      return;
    }

    if (state.step === "subjects") {
      state.answers.subjects = parseSubjectAnswer(clean);
      state.answers.subjectRaw = clean;
      const language = detectLanguage(clean);
      if (language) {
        state.answers.language = language;
        state.answers.languageConfirmed = true;
      }
      state.faqSubjectValidation = null;
      nextStep();
      return;
    }

    if (state.step === "audience") {
      state.answers.audience = detectAudience(clean) || clean;
      state.answers.audienceConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "language") {
      state.answers.language = detectLanguage(clean) || clean;
      state.answers.languageConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "count") {
      state.answers.count = clean;
      state.answers.countConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "categories") {
      const matched = faqCategoryOptions().filter((item) => clean.toLowerCase().includes(item.title.toLowerCase()));
      if (matched.length) state.answers.categories = matched.map((item) => item.value).join("\n");
      else state.answers.categories = clean.split(/\n|,|;/).map(compact).filter(Boolean).join("\n");
      state.answers.categoriesConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "categoriesCustom") {
      state.answers.categories = clean.split(/\n|;/).map((line) => compact(line.replace(/\s+-\s+/, ": "))).filter(Boolean).join("\n");
      state.answers.categoriesConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "categoryCounts" || state.step === "categoryCountsCustom") {
      state.answers.categoryCounts = clean;
      state.answers.categoryCountsConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "source") {
      const url = extractUrl(clean);
      if (url) {
        state.answers.sourceUrl = url;
        state.answers.sourceMode = "url";
        state.answers.sourceInstructions = `Use this source as the primary factual source: ${url}. Use other public sources only to understand question demand. Mark missing facts as Needs source confirmation.`;
        recordSource(url, "FAQ source", "faq-playground");
      } else if (/אין|בלי|no source|none|skip|דלג/i.test(clean)) {
        state.answers.sourceMode = "none";
        state.answers.sourceInstructions = "No confirmed source URL was provided. Generate useful questions, but mark factual details as Needs source confirmation and do not invent facts.";
      } else if (/official|רשמי|אתר/i.test(clean)) {
        state.answers.sourceMode = "official";
        state.answers.sourceInstructions = "Use the official website as the primary factual source. Use public review or competitor signals only for question demand, not final facts. Mark missing facts as Needs source confirmation.";
      } else {
        state.answers.sourceMode = "custom";
        state.answers.sourceInstructions = clean;
      }
      state.answers.sourceConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "sourceUrl") {
      const url = extractUrl(clean);
      if (!url && /אין|בלי|no\s+url|no\s+source|none|skip|דלג/i.test(clean)) {
        state.answers.sourceMode = "";
        state.answers.sourceUrl = "";
        state.answers.sourceInstructions = "";
        askFaqSource(prefersHebrew()
          ? "אין בעיה, לא נשתמש ב־URL כרגע."
          : "No problem, I won’t use a URL right now.");
        return;
      }
      if (!url) {
        bot(prefersHebrew()
          ? "לא מצאתי URL בהודעה. אפשר לשלוח קישור מלא שמתחיל ב־http, או לחזור לבחירת מקור."
          : "I did not find a URL. Send a full link that starts with http, or go back to choose a source.");
        setQuickReplies([
          { label: prefersHebrew() ? "לבחור מקור אחר" : "Choose another source", value: "source:choose" }
        ]);
        return;
      }
      state.answers.sourceUrl = url;
      state.answers.sourceMode = "url";
      state.answers.sourceInstructions = `Use this source as the primary factual source: ${url}. Use other public sources only to understand question demand. Mark missing facts as Needs source confirmation.`;
      state.answers.sourceConfirmed = true;
      recordSource(url, "FAQ source", "faq-playground");
      nextStep();
      return;
    }

    if (state.step === "sourceCustom") {
      state.answers.sourceInstructions = clean;
      state.answers.sourceMode = "custom";
      state.answers.sourceConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "questionGuidance" || state.step === "questionGuidanceCustom") {
      state.answers.questionGuidance = clean;
      state.answers.questionGuidanceConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "answerGuidance" || state.step === "answerGuidanceCustom") {
      state.answers.answerGuidance = clean;
      state.answers.answerGuidanceConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "qa") {
      if (/בלי|none|no qa|ללא/i.test(clean)) state.answers.qaMode = "none";
      else if (/מקור|source|full|מלא/i.test(clean)) state.answers.qaMode = "duplicates|sources|writing";
      else if (/כפילו/i.test(clean) && !/כתיבה|grammar|writing/i.test(clean)) state.answers.qaMode = "duplicates";
      else state.answers.qaMode = "duplicates|writing";
      state.answers.qaConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "style") {
      const selected = [];
      if (/חם|קצר|warm|concise/i.test(clean)) selected.push("Warm, concise, reliable.");
      if (/מקצועי|ישיר|professional|direct/i.test(clean)) selected.push("Professional, direct and source-grounded.");
      if (/seo|ai|search|ישות|חיפוש/i.test(clean)) selected.push("Clear, entity-rich and useful for search and AI systems.");
      if (/פשוט|מעשי|plain|practical/i.test(clean)) selected.push("Plain, practical and easy to scan.");
      state.answers.style = selected.length ? selected.join("\n") : clean;
      state.answers.styleConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "styleCustom") {
      state.answers.style = clean;
      state.answers.styleConfirmed = true;
      nextStep();
      return;
    }

    if (state.step === "extraGuidance") {
      state.answers.extraGuidance = clean;
      finishSetup(localeText("הוספתי את ההנחיות הנוספות לתוכנית.", "Added the extra guidance to the plan."));
      return;
    }

    applyInference(clean);
    if (state.step === "ready") {
      const subjectUpdate = parseSubjectAnswer(clean);
      if (/(הנושא|השם|שם המלון|subject|name)/i.test(clean) && subjectUpdate) {
        state.answers.subjects = subjectUpdate;
        state.answers.subjectRaw = clean;
        state.faqSubjectValidation = null;
        finishSetup(hasHebrew(clean) ? "עדכנתי את שם הנושא." : "Updated the subject.");
        return;
      }
      state.answers.extraGuidance = [state.answers.extraGuidance, clean].filter(Boolean).join("\n");
      finishSetup(localeText("הוספתי את זה כהנחיה נוספת לפני הרצה.", "Added that as extra guidance before running."));
      return;
    }

    nextStep();
  }

  function targetText() {
    if (state.answers.count === "quality_first") return "No fixed target. Prefer quality, coverage and source confidence over quantity.";
    return `Aim for ${state.answers.count || "20-30"} final questions. Return fewer if strong source-grounded questions do not exist.`;
  }

  function qaGuidance() {
    const checks = new Set(String(state.answers.qaMode || "").split("|").filter(Boolean));
    if (state.answers.qaMode === "none") return "";
    const lines = [];
    if (checks.has("duplicates")) lines.push("Check duplicate and near-duplicate questions while preserving row order.");
    if (checks.has("sources")) lines.push("Flag unsupported facts, uncertain claims, missing source evidence and rows that need verification.");
    if (checks.has("writing")) lines.push("Check answer-question fit, grammar, syntax, clarity, usefulness and overly promotional wording.");
    return lines.join(" ");
  }

  function categoryPlanText() {
    const plan = faqCategoryValues().length ? faqCategoryValues() : (categoryPlans[state.answers.scope || "hotel"] || categoryPlans.hotel);
    return [
      `Selected FAQ category plan for ${presetLabels[state.answers.scope || "hotel"]}:`,
      ...plan.map((line) => `- ${line}`),
      "",
      `Question allocation: ${categoryAllocationText()}`,
      "Do not use category names themselves as questions. Turn them into real user questions."
    ].join("\n");
  }

  function namingRules() {
    return "Use each subject exactly as written by the user. Do not shorten, translate or rewrite the entity name. Mention it naturally where it helps clarity and avoid keyword stuffing.";
  }

  function buildTasks() {
    const language = state.answers.languageConfirmed
      ? (state.answers.language || "English (UK)")
      : "Output language is not selected yet";
    const audience = state.answers.audienceConfirmed
      ? (audienceText() || presetAudiences[state.answers.scope || "hotel"])
      : "Audience is not selected yet.";
    const sourcePolicy = state.answers.sourceConfirmed
      ? state.answers.sourceInstructions
      : "Factual source is not selected yet. Ask the user for a source policy before running and do not invent facts.";
    const categoryPlan = categoryPlanText();
    const target = targetText();
    const style = styleText();
    const questionGuidance = questionGuidanceText();
    const answerGuidance = answerGuidanceText();
    const forbiddenPhrases = forbiddenPhrasesRulesText();
    const extra = state.answers.extraGuidance ? `\n\nEXTRA USER GUIDANCE:\n${state.answers.extraGuidance}` : "";
    const model = state.answers.model || "o3";
    const tasks = [
      {
        id: 1,
        enabled: true,
        name: "Research questions",
        system: "You are a senior SEO, GEO and customer-intent researcher. You build practical FAQ question sets from real user needs and reliable source signals.",
        user: [
          "Research and build a practical FAQ question plan for {{subject}}.",
          "",
          `Question target: ${target}`,
          `Output language: ${language}.`,
          `Audience: ${audience}`,
          `Source policy: ${sourcePolicy}`,
          `Entity naming rules: ${namingRules()}`,
          `Forbidden phrase rules: ${forbiddenPhrases}`,
          "",
          "CATEGORY PLAN:",
          categoryPlan,
          "",
          "Research rules:",
          "- Prefer high-frequency questions real users ask before booking/buying, before arrival/use, during the experience, or while comparing alternatives.",
          "- Every question must be clear, self-contained and suitable for a real FAQ page.",
          "- Do not turn generic category headings into questions.",
          "- Do not create duplicate questions or close paraphrases, even across categories.",
          "- Avoid sales copy, vague questions, and questions that cannot be answered from reliable sources.",
          "- Include questions that help AI/search systems understand the entity, service, policies, location and trust signals.",
          "",
          "ADDITIONAL QUESTION GUIDANCE:",
          questionGuidance,
          extra,
          "",
          "Return ONLY a Markdown table with columns:",
          "Category | Question | Frequency Level | Evidence needed"
        ].filter(Boolean).join("\n"),
        model
      },
      {
        id: 2,
        enabled: true,
        name: "Write answers",
        system: "You are a precise FAQ content editor. You write short, useful and verifiable answers without inventing facts.",
        user: [
          "Using the question plan below, write source-grounded FAQ answers for {{subject}}.",
          "",
          "QUESTION PLAN:",
          "{{last}}",
          "",
          "Return ONLY TSV. Header exactly:",
          "Category\tQuestion\tAnswer\tFrequency Level",
          "",
          "Rules:",
          `- Answer in ${language}.`,
          `- Follow these entity naming rules: ${namingRules()}`,
          "- Each answer should be 1-3 concise sentences and at least 10-12 words when possible.",
          "- For yes/no questions, start with Yes, No, or Currently when it fits the facts.",
          "- Keep wording natural and helpful, not promotional.",
          "- If information is unavailable after checking approved sources, write exactly: Information is currently not available. [VERIFY]",
          "- If a fact comes from a non-official source, keep it cautious and mark it with [VERIFY].",
          "- Keep the exact question wording unless grammar, clarity, or forbidden-phrase cleanup is required.",
          `- Apply these forbidden phrase rules across both questions and answers: ${forbiddenPhrases}.`,
          "",
          "ADDITIONAL ANSWER GUIDANCE:",
          answerGuidance,
          extra,
          "",
          `TONE & STYLE:\n${style}`,
          "",
          `APPROVED SOURCES:\n${sourcePolicy}`
        ].filter(Boolean).join("\n"),
        model
      }
    ];

    const checks = new Set(String(state.answers.qaMode || "").split("|").filter(Boolean));
    if (checks.has("duplicates")) {
      tasks.push({
        id: 3,
        enabled: true,
        name: "Duplicate check",
        system: "You are a strict FAQ QA reviewer. You identify duplicate questions and near-duplicate intent without changing the table.",
        user: [
          "Check for duplicate FAQ questions that seek the same information.",
          "",
          "DATA TO CHECK:",
          "{{answersTsvNumbered}}",
          "",
          "Return exactly:",
          "HEADER",
          "Row\tDuplicate",
          "DATA",
          "[one Row-numbered value per data row]",
          "",
          "Use format: Row number, tab, result.",
          "Write NO if unique. Write YES - Q[#] [question] and Q[#] [question] if duplicate.",
          "Return exactly one line per data row, excluding the header, and preserve the input Row numbers."
        ].join("\n"),
        model
      });
    }

    if (checks.has("sources")) {
      tasks.push({
        id: 4,
        enabled: true,
        name: "Source verification",
        system: "You are a careful FAQ fact checker. You verify answers against approved sources and flag uncertain facts.",
        user: [
          "Cross-check each answer in the TSV against the approved source policy.",
          `Source policy: ${sourcePolicy}`,
          "",
          "DATA TO CHECK:",
          "{{answersTsvNumbered}}",
          "",
          `If returning WRONG or FOUND text, apply these forbidden phrase rules: ${forbiddenPhrases}`,
          "",
          "Return exactly:",
          "HEADER",
          "Row\tSource OK",
          "DATA",
          "[one Row-numbered value per data row]",
          "",
          "Use format: Row number, tab, result.",
          "For each row write OK, NOT VERIFIED, WRONG with correction, or FOUND with source.",
          "Return exactly one line per data row, excluding the header, and preserve the input Row numbers."
        ].join("\n"),
        model
      });
    }

    if (checks.has("writing")) {
      tasks.push({
        id: 5,
        enabled: true,
        name: "Grammar and answer fit",
        outputMode: "replace_base_tsv",
        system: "You are a strict FAQ editor. You check grammar, answer fit, clarity and tone without adding unsupported facts.",
        user: [
          "Review each TSV row for writing quality and question-answer fit.",
          "",
          "DATA TO CHECK:",
          "{{answersTsv}}",
          "",
          "Check direct answer fit, grammar, clarity, usefulness, non-promotional tone and natural use of the subject name.",
          `Apply these forbidden phrase rules across the final TSV: ${forbiddenPhrases}.`,
          qaGuidance(),
          "",
          "Return ONLY the full corrected TSV.",
          "Keep the same header and row order as the input TSV.",
          "Edit the Question and Answer cells directly where grammar, clarity, tone, forbidden phrases, or answer fit need improvement.",
          "For yes/no questions, do not start with Yes unless the answer is genuinely affirmative; use No when the service is unavailable.",
          "For what/where/when/how/how much questions, do not start the answer with Yes.",
          "Keep Category and Frequency Level unchanged unless a tiny wording cleanup is required.",
          "Do not add a Grammar Fix column.",
          "Do not add commentary before or after the TSV."
        ].filter(Boolean).join("\n"),
        model: "gpt-5.5"
      });
    }

    return tasks.sort((a, b) => a.id - b.id);
  }

  function buildPayload() {
    return {
      mode: "faq-playground",
      subjects: subjectList(),
      tasks: buildTasks()
    };
  }

  function faqPromptPreview() {
    const tasks = buildTasks();
    return {
      question: tasks.find((task) => task.id === 1) || null,
      answer: tasks.find((task) => task.id === 2) || null
    };
  }

  function compactPromptPreview(task) {
    if (!task) return "";
    return [
      `SYSTEM\n${task.system}`,
      "",
      `USER\n${task.user}`
    ].join("\n");
  }

  function faqPromptsText() {
    const prompts = faqPromptPreview();
    const hebrew = prefersHebrew();
    return [
      hebrew ? "הפרומפטים להרצה:" : "Prompts for this run:",
      "",
      "QUESTION PROMPT",
      compactPromptPreview(prompts.question),
      "",
      "ANSWER PROMPT",
      compactPromptPreview(prompts.answer)
    ].join("\n");
  }

  function summaryText() {
    const subjects = subjectList();
    if (prefersHebrew()) {
      return [
        "FAQ מוכן:",
        `${subjects.join(", ") || "חסר נושא"} · ${localizedLanguageLabel(state.answers.language)} · ${state.answers.count === "quality_first" ? "רק איכותי" : state.answers.count}`,
        `קהל: ${localizedAudience(audienceText()) || "לא הוגדר"}`,
        `קטגוריות: ${localizedCategoryLabel() || "לא הוגדרו"}`,
        `חלוקה: ${localizedCategoryCountsLabel() || categoryAllocationText()}`,
        `מקור: ${state.answers.sourceUrl || (state.answers.sourceMode === "none" ? "אין, נסמן לאימות" : "כללי מקור זהירים")}`,
        `מילים אסורות: ${forbiddenPhrasesLabel() || "לא הוגדרו"}`,
        `דגשי שאלות: ${guidanceLabel("questionGuidance", questionGuidanceOptions) || "כללי ברירת מחדל"}`,
        `דגשי תשובות: ${guidanceLabel("answerGuidance", answerGuidanceOptions) || "כללי ברירת מחדל"}`,
        `סגנון: ${localizedStyleLabel()}`,
        `QA: ${localizedQaLabel()}`,
        "אפשר להריץ כאן או לפתוח את ה־Builder."
      ].join("\n");
    }
    return [
      "FAQ ready:",
      `${subjects.join(", ") || "Missing subject"} · ${state.answers.language} · ${state.answers.count === "quality_first" ? "quality first" : state.answers.count}`,
      `Audience: ${localizedAudience(audienceText()) || "not set"}`,
      `Categories: ${localizedCategoryLabel() || "not set"}`,
      `Split: ${localizedCategoryCountsLabel() || categoryAllocationText()}`,
      `Source: ${state.answers.sourceUrl || (state.answers.sourceMode === "none" ? "none, mark facts for verification" : "careful source policy")}`,
      `Words to avoid: ${forbiddenPhrasesLabel() || "not set"}`,
      `Question guidance: ${guidanceLabel("questionGuidance", questionGuidanceOptions) || "default rules"}`,
      `Answer guidance: ${guidanceLabel("answerGuidance", answerGuidanceOptions) || "default rules"}`,
      `Style: ${localizedStyleLabel()}`,
      `QA: ${localizedQaLabel()}`,
      "Run here or open the Builder."
    ].join("\n");
  }

  function setReadyReplies() {
    const hebrew = prefersHebrew();
    setQuickReplies([
      { label: hebrew ? "להריץ עכשיו" : "Run now", value: "run" },
      { label: hebrew ? "לפתוח Builder" : "Open builder", value: "open-tool" },
      { label: hebrew ? "להראות פרומפטים" : "Show prompts", value: "review-prompts" },
      { label: hebrew ? "להוסיף דגשים" : "Add guidance", value: "extra" },
      { label: hebrew ? "מילים אסורות" : "Words to avoid", value: "forbidden:edit" },
      { label: hebrew ? "להראות סיכום" : "Show summary", value: "review" },
      { label: hebrew ? "להתחיל מחדש" : "Start over", value: "reset" }
    ]);
  }

  function finishSetup(prefix = "") {
    state.step = "ready";
    syncConversationFromFaq();
    const text = [prefix, summaryText()].filter(Boolean).join("\n\n");
    bot(text);
    setReadyReplies();
    renderWorkspace();
  }

  async function runWorkflow() {
    if (state.running) return;
    const subjects = subjectList();
    if (!subjects.length) {
      bot(prefersHebrew() ? "עוד חסר לי נושא להרצה. כתבי שם אחד לפחות, ואז נמשיך." : "I still need a subject before running. Send at least one name and we’ll continue.");
      state.step = "subjects";
      return;
    }
    if (!socket?.connected) {
      bot(prefersHebrew() ? "החיבור לשרת המקומי לא פעיל כרגע. פתחי את השרת ואז אוכל להריץ מכאן." : "The demo backend socket is not connected. Start the server and refresh, then I can run it here.");
      logLine("Backend socket is not connected.", "warn");
      return;
    }

    let payload = buildPayload();
    const validationOk = await validateFaqBeforeRun(payload);
    if (!validationOk) return;
    payload = buildPayload();
    state.running = true;
    state.runningToolId = "faq-playground";
    state.runningPayload = payload;
    state.lastPayload = payload;
    rememberToolPayload("faq-playground", payload, buildFaqHandoffValues());
    renderWorkspace();
    bot(prefersHebrew() ? "מעולה, מריצה עכשיו. הקובץ החדש יופיע בצד ימין כשהוא יהיה מוכן." : "Great, running now. The new file will appear on the right when it’s ready.");
    setQuickReplies([
      { label: prefersHebrew() ? "פרטים טכניים" : "Show technical details", value: "review" },
      { label: prefersHebrew() ? "להתחיל תכנון חדש" : "Start a new plan", value: "reset" }
    ]);
    logLine(`Starting FAQ workflow for ${subjects.length} subject(s)...`);
    payload = await runSmartPreflight(getTool("faq-playground"), payload);
    state.lastPayload = payload;
    state.runningPayload = payload;
    rememberToolPayload("faq-playground", payload, buildFaqHandoffValues());
    logLine(`Active tasks: ${payload.tasks.map((task) => `#${task.id}`).join(", ")}`);
    socket.emit("start-agent", payload);
  }

  async function runCurrentTool(options = {}) {
    const tool = getTool(state.activeToolId);
    if (!tool) return;
    const confirmedByExplicitRun = options.confirmed === true;
    realignDesignFormattingBeforeRun();
    updateToolMissingInputs();
    if (faqAuditNeedsDiscovery(tool)) {
      askFaqAuditDiscovery(prefersHebrew()
        ? "לפני אודיט FAQ צריך למפות את האתר."
        : "Before the FAQ audit, the site needs to be mapped.");
      return;
    }
    if (!isDirectRunAllowed(tool)) {
      const reason = tool.id === "translate-demo" && detectSourceType(state.collectedInputs.sourceUrl) === "folder"
        ? "Folder translation needs the dedicated workspace because the current backend job validates a single spreadsheet id."
        : "This tool needs the workspace or missing inputs before it can run.";
      bot(prefersHebrew()
        ? (tool.id === "translate-demo" && detectSourceType(state.collectedInputs.sourceUrl) === "folder"
          ? "תרגום תיקייה צריך את הכלי הייעודי, כי ההרצה הנוכחית עובדת מול קובץ Sheet יחיד."
          : "חסרים לי עוד פרטים לפני שאפשר להריץ את הכלי.")
        : reason);
      setGenericReadyReplies(tool);
      return;
    }
    let plannedPayload = state.lastPayload || buildToolPayload(tool, state.collectedInputs);
    if (tool.id === "design-formatting") {
      plannedPayload = reconcileColumnTransferPayload(plannedPayload, true);
      if (hasUnsafeColumnTransfer(plannedPayload)) {
        blockUnsafeColumnTransfer(plannedPayload);
        return;
      }
    }
    if (tool.id === "design-formatting" && plannedPayload?.dryRun === false && !state.liveRunConfirmed) {
      askDesignFormattingLiveConfirmation();
      return;
    }
    if (needsRunConfirmation(tool, plannedPayload) && !state.runConfirmed && !confirmedByExplicitRun) {
      state.lastPayload = plannedPayload;
      askToolRunConfirmation(tool, plannedPayload);
      return;
    }
    if (!socket?.connected) {
      bot(prefersHebrew() ? "החיבור לשרת המקומי לא פעיל כרגע. פתחי את השרת ורענני, ואז אוכל להריץ מכאן." : "The demo backend socket is not connected. Start the server and refresh, then I can run it here.");
      logLine("Backend socket is not connected.", "warn");
      return;
    }

    let payload = plannedPayload;
    state.lastPayload = payload;
    rememberToolPayload(tool.id, payload, state.collectedInputs);
    state.running = true;
    state.runningToolId = tool.id;
    state.runningPayload = payload;
    renderWorkspace();
    if (tool.id === "schema-builder") {
      bot(payload.previewOnly
        ? (prefersHebrew() ? "בודקת את הסכמה בלי לכתוב לגיליון." : "Running a schema preview. Nothing will be written to the Sheet.")
        : (prefersHebrew() ? `כותבת את סכמת ה־FAQ לתא ${payload.outputCell || schemaOutputCell()}.` : `Writing the FAQPage schema to ${payload.outputCell || schemaOutputCell()}.`));
    } else if (tool.id === "design-formatting") {
      const operation = payload.operation || payload.operations?.[0] || {};
      bot(payload.dryRun
        ? (prefersHebrew() ? "בודקת את העריכה בלי לכתוב לגיליון." : "Running a dry run. Nothing will be written.")
        : operation.type === "replace_column_when_value"
          ? (prefersHebrew() ? "כותבת את החלפת העמודות שאישרת." : "Running the approved live column replacement.")
          : (prefersHebrew() ? "כותבת את עריכת ה־FAQ שאישרת." : "Running the approved live FAQ edit."));
    } else {
      bot(prefersHebrew() ? `מריצה ${tool.title}.` : `Running ${tool.title}.`);
    }
    setQuickReplies([
      { label: prefersHebrew() ? "פרטים טכניים" : "Show technical details", value: "review" },
      { label: prefersHebrew() ? (tool.id === "schema-builder" ? "לפתוח כלי סכמה" : "לפתוח כלי") : "Open workspace", value: "open-tool" }
    ]);
    logLine(`Starting ${tool.title}...`);
    logLine(`Mode: ${payload.mode || tool.mode || tool.id}`);
    payload = await runSmartPreflight(tool, payload);
    if (tool.id === "design-formatting") {
      payload = reconcileColumnTransferPayload(payload, false);
      if (hasUnsafeColumnTransfer(payload)) {
        state.running = false;
        state.runningToolId = "";
        state.runningPayload = null;
        blockUnsafeColumnTransfer(payload);
        renderWorkspace();
        return;
      }
    }
    state.lastPayload = payload;
    state.runningPayload = payload;
    rememberToolPayload(tool.id, payload, state.collectedInputs);
    socket.emit("start-agent", payload);
    if (tool.id === "design-formatting") state.liveRunConfirmed = false;
    state.runConfirmed = false;
  }

  function resetAll() {
    state.messages = [];
    state.mode = "none";
    state.step = "idle";
    state.running = false;
    state.runningToolId = "";
    state.runningPayload = null;
    state.lastRun = null;
    state.lastResult = null;
    state.taskMemory = freshTaskMemory();
    state.runConfirmed = false;
    state.answers = freshAnswers();
    state.fileTask = freshFileTask();
    state.faqSubjectValidation = null;
    state.faqAuditDiscovery = null;
    state.faqAuditDiscoveryPending = false;
    resetActiveDraft();
    els.chatLog.innerHTML = "";
    welcome();
    renderWorkspace();
  }

  function completionItems() {
    const hebrew = prefersHebrew();
    return [
      [hebrew ? "סוג" : "Type", Boolean(state.answers.scope), localizedPresetLabel(state.answers.scope)],
      [hebrew ? "נושא" : "Subject", subjectList().length > 0, subjectList().join(", ")],
      [hebrew ? "קהל יעד" : "Audience", Boolean(state.answers.audienceConfirmed && audienceText()), state.answers.audienceConfirmed ? localizedAudience(audienceText()) : ""],
      [hebrew ? "שפה" : "Language", Boolean(state.answers.languageConfirmed), state.answers.languageConfirmed ? localizedLanguageLabel(state.answers.language) : ""],
      [hebrew ? "כמות" : "Depth", Boolean(state.answers.countConfirmed), state.answers.countConfirmed ? (state.answers.count === "quality_first" ? (hebrew ? "רק איכותי" : "Quality first") : state.answers.count) : ""],
      [hebrew ? "קטגוריות" : "Categories", Boolean(state.answers.categoriesConfirmed), state.answers.categoriesConfirmed ? localizedCategoryLabel() : ""],
      [hebrew ? "חלוקת שאלות" : "Question split", Boolean(state.answers.categoryCountsConfirmed), state.answers.categoryCountsConfirmed ? (localizedCategoryCountsLabel() || categoryAllocationText()) : ""],
      [hebrew ? "מקור" : "Source", Boolean(state.answers.sourceConfirmed), state.answers.sourceConfirmed ? (state.answers.sourceUrl || state.answers.sourceMode || "") : ""],
      [hebrew ? "דגשי שאלות" : "Question guidance", Boolean(state.answers.questionGuidanceConfirmed), state.answers.questionGuidanceConfirmed ? guidanceLabel("questionGuidance", questionGuidanceOptions) : ""],
      [hebrew ? "דגשי תשובות" : "Answer guidance", Boolean(state.answers.answerGuidanceConfirmed), state.answers.answerGuidanceConfirmed ? guidanceLabel("answerGuidance", answerGuidanceOptions) : ""],
      [hebrew ? "סגנון" : "Style", Boolean(state.answers.styleConfirmed), state.answers.styleConfirmed ? localizedStyleLabel() : ""],
      [hebrew ? "QA" : "QA", Boolean(state.answers.qaConfirmed), state.answers.qaConfirmed ? localizedQaLabel() : ""]
    ];
  }

  function renderWorkspace() {
    if (state.mode === "file") {
      renderFileWorkspace();
      scrollChatToLatest();
      return;
    }
    if (state.mode === "tool") {
      renderGenericToolWorkspace();
      scrollChatToLatest();
      return;
    }
    if (state.mode !== "faq") {
      renderHomeWorkspace();
      scrollChatToLatest();
      return;
    }

    const subjects = subjectList();
    const items = completionItems();
    const payload = buildPayload();
    const prompts = faqPromptPreview();
    const ready = state.step === "ready";
    const hebrew = prefersHebrew();

    els.actionsList.innerHTML = `
      <article class="action-card">
        <div class="action-card-head">
          <div>
            <h3 class="action-title"><span class="action-icon">FAQ</span>${hebrew ? "טיוטת FAQ" : "FAQ draft"}</h3>
            <p class="subtitle">${ready ? (hebrew ? "מוכן להרצה." : "Ready to run.") : (hebrew ? "חסרים כמה פרטים." : "A few details are missing.")}</p>
          </div>
          <span class="risk-pill" data-risk="${state.running ? "running" : "generates-content"}">${state.running ? "running" : ready ? "ready" : "draft"}</span>
        </div>
        <div class="action-body">
          <div class="task-summary">
            <strong>${escapeHtml(subjects.length ? subjects.join(", ") : (hebrew ? "עדיין אין נושא" : "No subject yet"))}</strong>
            <span>${escapeHtml(state.answers.audienceConfirmed ? localizedAudience(audienceText()) : (hebrew ? "חסר קהל יעד" : "Audience missing"))}</span>
          </div>
          <section class="prompt-preview-card" aria-label="Generated FAQ prompts">
            <div class="prompt-preview-head">
              <div>
                <span>${hebrew ? "פרומפטים להרצה" : "Run prompts"}</span>
                <strong>${ready ? (hebrew ? "מוכנים לשאלות ולתשובות" : "Question and answer prompts are ready") : (hebrew ? "מותאם למה שנבחר עד כה" : "Matched to the current setup")}</strong>
              </div>
              <button class="ghost-btn compact" type="button" data-copy-faq-prompts>${hebrew ? "להעתיק" : "Copy"}</button>
            </div>
            <div class="prompt-preview-grid">
              <details class="payload-details prompt-details" open>
                <summary>${hebrew ? "פרומפט לשאלות" : "Question prompt"}</summary>
                <pre class="payload-preview prompt-preview">${escapeHtml(compactPromptPreview(prompts.question))}</pre>
              </details>
              <details class="payload-details prompt-details" ${ready ? "open" : ""}>
                <summary>${hebrew ? "פרומפט לתשובות" : "Answer prompt"}</summary>
                <pre class="payload-preview prompt-preview">${escapeHtml(compactPromptPreview(prompts.answer))}</pre>
              </details>
            </div>
          </section>
          <div class="checklist">
            ${items.map(([label, done, value]) => `
              <div class="check-item ${done ? "is-done" : ""}">
                <span class="check-dot"></span>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value || (hebrew ? "חסר" : "Needed"))}</strong>
              </div>
            `).join("")}
          </div>
          <details class="payload-details">
            <summary>${hebrew ? "פרטים טכניים" : "Workflow payload preview"}</summary>
            <pre class="payload-preview">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
          </details>
          <div class="action-buttons">
            <button class="primary-btn" type="button" data-run-workflow ${ready && !state.running ? "" : "disabled"}>${hebrew ? "להריץ FAQ" : "Run FAQ workflow"}</button>
            <button class="ghost-btn" type="button" data-open-workspace ${ready ? "" : "disabled"}>${hebrew ? "לפתוח כלי FAQ" : "Open builder"}</button>
            <button class="ghost-btn" type="button" data-show-faq-prompts>${hebrew ? "להראות פרומפטים" : "Show prompts"}</button>
            <button class="ghost-btn" type="button" data-add-context>${hebrew ? "להוסיף הקשר" : "Add context"}</button>
            <button class="ghost-btn" type="button" data-copy-payload>${hebrew ? "להעתיק תוכנית" : "Copy plan"}</button>
            <button class="ghost-btn" type="button" data-reset-task>${hebrew ? "להתחיל מחדש" : "Start over"}</button>
          </div>
        </div>
      </article>
    `;
    scrollChatToLatest();
  }

  function renderHomeWorkspace() {
    const tools = manifest.tools || [];
    const hebrew = prefersHebrew();
    els.actionsList.innerHTML = `
      <article class="action-card">
        <div class="action-card-head">
          <div>
            <h3 class="action-title"><span class="action-icon">AI</span>${hebrew ? "הצ׳אט המרכזי" : "Workspace assistant"}</h3>
            <p class="subtitle">${hebrew ? "צ׳אט אחד שמבין את הבקשה, בוחר כלי, משלים פרטים חסרים ומחזיר תוצאה מסודרת." : "One stateful chat that chooses a tool, collects missing inputs, builds payloads, and parses outputs."}</p>
          </div>
          <span class="risk-pill">${hebrew ? "ממתין" : "idle"}</span>
        </div>
        <div class="action-body">
          <div class="task-summary">
            <strong>${hebrew ? "אין משימה פעילה כרגע" : "No active task yet"}</strong>
            <span>${hebrew ? `${tools.length} כלים זמינים לצ׳אט.` : `${tools.length} tools registered in the manifest. New tools should be added there, then get an adapter when needed.`}</span>
          </div>
          <div class="checklist">
            ${tools.slice(0, 8).map((tool) => `
              <div class="check-item ${tool.status?.includes("adapter") ? "is-done" : ""}">
                <span class="check-dot"></span>
                <span>${escapeHtml(tool.icon || "TOOL")}</span>
                <strong>${escapeHtml(tool.title)}</strong>
              </div>
            `).join("")}
          </div>
        </div>
      </article>
    `;
  }

  function renderGenericToolWorkspace() {
    const tool = getTool(state.activeToolId);
    if (!tool) return renderHomeWorkspace();
    const hebrew = prefersHebrew();
    const allFields = [...(tool.requiredInputs || []), ...(tool.optionalInputs || [])];
    const alwaysShow = new Set(
      tool.id === "schema-builder"
        ? ["sourceUrl", "tabName", "questionColumn", "answerColumn", "outputCell", "previewOnly", "existingValuePolicy"]
        : (tool.requiredInputs || []).map((field) => field.key)
    );
    const fields = allFields
      .filter((field) => alwaysShow.has(field.key) || fieldHasValue(state.collectedInputs[field.key]))
      .slice(0, tool.id === "schema-builder" ? 7 : 5);
    const needsFaqDiscovery = faqAuditNeedsDiscovery(tool);
    const payload = state.readyToRun
      ? (state.lastPayload || buildToolPayload(tool, state.collectedInputs))
      : (needsFaqDiscovery ? faqAuditDiscoveryPayload() : null);
    const operation = payload?.operation || payload?.operations?.[0] || null;
    const summaryNote = tool.id === "schema-builder"
      ? (hebrew
        ? `${state.collectedInputs.previewOnly === false ? "כתיבה לגיליון" : "בדיקה בלי כתיבה"} · תא ${schemaOutputCell()}`
        : `${state.collectedInputs.previewOnly === false ? "Write mode" : "Preview only"} · output ${schemaOutputCell()}`)
      : needsFaqDiscovery
        ? (hebrew ? "צריך למפות robots.txt, sitemaps וקבוצות URL לפני בחירת עמודים לאודיט." : "Map robots.txt, sitemaps and internal URL groups before choosing FAQ audit pages.")
      : tool.id === "design-formatting" && operation
        ? (hebrew
          ? `${designOperationLabel(operation, true)} · ${payload.dryRun !== false ? "בדיקה בלי כתיבה" : "כתיבה לגיליון"}`
          : `${operation.type || "sheet edit"} · ${payload.dryRun !== false ? "dry run first" : "live write requested"}`)
        : (tool.confirmationRules?.beforeRun || tool.risk || "");
    const statusLabel = hebrew
      ? (state.running ? "רץ עכשיו" : needsFaqDiscovery ? "צריך מיפוי" : state.readyToRun ? "מוכן" : "אוסף פרטים")
      : (state.running ? "running" : needsFaqDiscovery ? "mapping needed" : state.readyToRun ? "ready" : "collecting");
    const schemaButtons = tool.id === "schema-builder" ? (
      state.collectedInputs.previewOnly === false
        ? `
          <button class="ghost-btn" type="button" data-schema-policy="${existingValuePolicy() === "overwrite" ? "skip" : "overwrite"}">${escapeHtml(schemaWriteLabel(existingValuePolicy() === "overwrite" ? "skip" : "overwrite"))}</button>
          <button class="ghost-btn" type="button" data-schema-preview>${hebrew ? "להישאר בבדיקה מקדימה" : "Stay in preview"}</button>
          <button class="ghost-btn" type="button" data-schema-output>${hebrew ? "לבחור תא אחר" : "Choose another cell"}</button>
        `
        : `
          <button class="ghost-btn" type="button" data-schema-policy="skip">${escapeHtml(schemaWriteLabel("skip"))}</button>
          <button class="ghost-btn" type="button" data-schema-policy="overwrite">${escapeHtml(schemaWriteLabel("overwrite"))}</button>
          <button class="ghost-btn" type="button" data-schema-output>${hebrew ? "לבחור תא אחר" : "Choose another cell"}</button>
        `
    ) : "";
    const primaryActionButton = needsFaqDiscovery
      ? `<button class="primary-btn" type="button" data-faqaudit-map ${state.running ? "disabled" : ""}>${hebrew ? "למפות אתר" : "Map site"}</button>`
      : tool.canRunDirectly
      ? `<button class="primary-btn" type="button" data-run-tool ${isDirectRunAllowed(tool) && !state.running ? "" : "disabled"}>${escapeHtml(directRunLabel(tool))}</button>`
      : `<button class="primary-btn" type="button" data-open-workspace>${hebrew ? "לפתוח כלי" : "Open workspace"}</button>`;
    const workspaceActionButton = tool.canRunDirectly
      ? `<button class="ghost-btn" type="button" data-open-workspace>${hebrew ? (tool.id === "schema-builder" ? "לפתוח כלי סכמה" : "לפתוח כלי") : "Open workspace"}</button>`
      : "";

    els.actionsList.innerHTML = `
      <article class="action-card">
        <div class="action-card-head">
          <div>
            <h3 class="action-title"><span class="action-icon">${escapeHtml(tool.icon || "AI")}</span>${escapeHtml(tool.title)}</h3>
            <p class="subtitle">${escapeHtml(tool.description || "Tool adapter")}</p>
          </div>
          <span class="risk-pill" data-risk="${escapeHtml(tool.risk || "draft")}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="action-body">
          <div class="task-summary">
            <strong>${escapeHtml(hebrew ? (state.readyToRun ? "מוכן להרצה" : needsFaqDiscovery ? "צריך למפות את האתר" : "חסרים פרטים") : (state.readyToRun ? "Payload ready" : needsFaqDiscovery ? "Site mapping needed" : "Collecting required inputs"))}</strong>
            <span>${escapeHtml(summaryNote)}</span>
          </div>
          <div class="checklist">
            ${fields.map((field) => {
              const done = fieldHasValue(state.collectedInputs[field.key]);
              const value = state.collectedInputs[field.key];
              return `
                <div class="check-item ${done ? "is-done" : ""}">
                  <span class="check-dot"></span>
                  <span>${escapeHtml(field.label || field.key)}</span>
                  <strong>${escapeHtml(done ? (Array.isArray(value) ? value.join(", ") : value) : (field.required === false ? (hebrew ? "אופציונלי" : "Optional") : (hebrew ? "חסר" : "Needed")))}</strong>
                </div>
              `;
            }).join("")}
          </div>
          <details class="payload-details">
            <summary>${hebrew ? "פרטים טכניים" : (payload ? "Tool payload preview" : "Collected inputs")}</summary>
            <pre class="payload-preview">${escapeHtml(JSON.stringify(payload || state.collectedInputs, null, 2))}</pre>
          </details>
          <div class="action-buttons">
            ${primaryActionButton}
            ${workspaceActionButton}
            ${schemaButtons}
            <button class="ghost-btn" type="button" data-add-tool-detail>${hebrew ? "להוסיף פרט" : "Add detail"}</button>
            <button class="ghost-btn" type="button" data-copy-payload ${payload ? "" : "disabled"}>${hebrew ? "להעתיק פרטים" : "Copy payload"}</button>
            <button class="ghost-btn" type="button" data-reset-task>${hebrew ? "להתחיל מחדש" : "Start over"}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderFileWorkspace() {
    const hasPath = Boolean(state.fileTask.filePath);
    const hebrew = prefersHebrew();
    const targetLabel = state.fileTask.filePath ||
      state.fileTask.targetScope ||
      (state.fileTask.targetKind === "pasted-content" ? (hebrew ? "תוכן מודבק" : "Pasted content") : (hebrew ? "עוד לא נבחר יעד" : "No target selected yet"));
    const hasTarget = hasPath || Boolean(state.fileTask.targetScope) || state.fileTask.targetKind === "pasted-content";
    const hasInstruction = Boolean(state.fileTask.instruction);
    els.actionsList.innerHTML = `
      <article class="action-card">
        <div class="action-card-head">
          <div>
            <h3 class="action-title"><span class="action-icon">FILE</span>Codex file edit request</h3>
            <p class="subtitle">For local repo/content edits. Google Sheets and Drive sources are routed to their own workspace tools.</p>
          </div>
          <span class="risk-pill" data-risk="requires-review">${hasTarget && hasInstruction ? "drafted" : "collecting"}</span>
        </div>
        <div class="action-body">
          <div class="task-summary">
            <strong>${escapeHtml(targetLabel)}</strong>
            <span>${escapeHtml(state.fileTask.instruction || (hebrew ? "מה צריך להשתנות?" : "Tell me what should change."))}</span>
          </div>
          <div class="checklist">
            <div class="check-item ${hasTarget ? "is-done" : ""}"><span class="check-dot"></span><span>Target</span><strong>${escapeHtml(targetLabel || "Needed")}</strong></div>
            <div class="check-item ${hasInstruction ? "is-done" : ""}"><span class="check-dot"></span><span>Instruction</span><strong>${escapeHtml(hasInstruction ? "Captured" : (hebrew ? "חסר" : "Needed"))}</strong></div>
            <div class="check-item"><span class="check-dot"></span><span>Write access</span><strong>Codex review</strong></div>
          </div>
          <pre class="payload-preview">${escapeHtml(JSON.stringify(state.lastPayload || state.fileTask, null, 2))}</pre>
          <div class="action-buttons">
            <button class="ghost-btn" type="button" data-add-file-detail>Add detail</button>
            <button class="ghost-btn" type="button" data-copy-file-plan>Copy request</button>
            <button class="ghost-btn" type="button" data-reset-task>Start over</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderToolStrip() {
    const tools = manifest.tools || [];
    const memoryLabel = state.taskMemory.lastToolId
      ? `Memory: ${state.taskMemory.lastToolId}${state.taskMemory.lastOperation?.type ? `/${state.taskMemory.lastOperation.type}` : ""}`
      : "Memory: empty";
    els.toolStrip.innerHTML = [
      `<span class="tool-chip">Manifest tools: ${tools.length}</span>`,
      `<span class="tool-chip">Stateful routing</span>`,
      `<span class="tool-chip">${escapeHtml(memoryLabel)}</span>`,
      `<span class="tool-chip">Sources: ${state.sources.length}</span>`,
      `<span class="tool-chip">Outputs: ${state.outputs.length}</span>`
    ].join("");
  }

  function homeReplies() {
    const hebrew = prefersHebrew();
    return [
      { label: hebrew ? "בניית FAQ" : "Build FAQ", value: "start:faq" },
      { label: hebrew ? "תרגום תוכן" : "Translate content", value: "start:translate" },
      { label: hebrew ? "יצירת Schema" : "Create schema", value: "start:schema" },
      { label: hebrew ? "Meta tags" : "Meta tags", value: "start:meta" },
      { label: hebrew ? "דוחות לקוח" : "Client reports", value: "start:client-reports" },
      { label: hebrew ? "אודיט אתר" : "Site audit", value: "start:site-audit" },
      { label: hebrew ? "אודיט FAQ" : "FAQ audit", value: "start:faq-audit" },
      { label: hebrew ? "עריכת Google Sheet" : "Edit Google Sheet", value: "start:sheet-edit" },
      { label: hebrew ? "עריכת קובץ" : "Code/local file edit", value: "start:file" }
    ];
  }

  function welcome() {
    bot(prefersHebrew() ? "היי. מה תרצי לעשות?" : "Hi. What would you like to do?");
    setQuickReplies(homeReplies());
  }

  function currentMultiSelectDoneValue() {
    if (state.mode === "faq") {
      if (state.step === "audience") return "audience-done";
      if (state.step === "categories") return "categories-done";
      if (state.step === "questionGuidance") return "question-guidance-done";
      if (state.step === "answerGuidance") return "answer-guidance-done";
      if (state.step === "qa") return "qa-done";
      if (state.step === "style") return "style-done";
    }
    if (state.mode === "tool" && state.step === "toolField") {
      const key = toolLanguageKey();
      if ((state.activeStep === key || state.pendingQuestion?.key === key) && ["targetLangs", "languages"].includes(key)) return "lang-done";
      if (state.activeToolId === "site-ai-audit" && (state.activeStep === "auditChecks" || state.pendingQuestion?.key === "auditFocus")) return "audit-checks-done";
      if (state.activeToolId === "site-ai-faq-audit" && state.pendingQuestion?.key === "groups") return "faqaudit-groups-done";
    }
    return "";
  }

  function submitCurrentMultiSelect() {
    const doneValue = currentMultiSelectDoneValue();
    if (!doneValue) return false;
    return handleSpecialReply(doneValue);
  }

  function submitUserText(text) {
    const value = compact(text);
    if (!value) {
      if (submitCurrentMultiSelect()) renderToolStrip();
      return Promise.resolve();
    }
    if (els.input) els.input.value = "";
    user(value);
    return handleFreeText(value).finally(() => renderToolStrip());
  }

  function loadHomeDraft() {
    const params = new URLSearchParams(window.location.search || "");
    const shouldAutostart = params.get("autostart") === "1" || sessionStorage.getItem("carmelon.assistantAutostart") === "1";
    const draft = compact(params.get("draft") || params.get("message") || sessionStorage.getItem("carmelon.assistantDraft") || "");
    sessionStorage.removeItem("carmelon.assistantAutostart");
    if (!draft || !els.input) return false;
    sessionStorage.removeItem("carmelon.assistantDraft");
    els.input.value = draft;
    els.input.focus();
    if (params.has("draft") || params.has("message") || params.has("autostart")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (!shouldAutostart) return false;
    document.body.classList.add("is-home-launch");
    window.setTimeout(() => {
      submitUserText(draft).finally(() => {
        window.setTimeout(() => document.body.classList.remove("is-home-launch"), 420);
      });
    }, 240);
    return true;
  }

  function parseStructuredOutput(markerName, raw) {
    try {
      return JSON.parse(raw);
    } catch {
      recordOutput({
        title: `${markerName.replaceAll("_", " ")} result returned`,
        description: "Could not parse JSON block",
        type: "result",
        source: markerName
      });
      return null;
    }
  }

  function storeStructuredReportResult(storagePrefix, result) {
    try {
      const key = `${storagePrefix}.${Date.now()}`;
      localStorage.setItem(key, JSON.stringify({ result, createdAt: new Date().toISOString() }));
      return key;
    } catch {
      return "";
    }
  }

  function recordStructuredOutputs(markerName, result) {
    if (!result) return;

    if (markerName === "SCHEMA_BUILDER") {
      const ids = Array.from(new Set((result.results || [])
        .filter((item) => item.spreadsheetId && item.wroteToSheet)
        .map((item) => item.spreadsheetId)));
      ids.forEach((id) => recordOutput({
        title: "Schema written to Google Sheet",
        description: `${result.generated || 0} schema target(s)`,
        type: "google-sheet",
        url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
        source: markerName
      }));
      if (!ids.length) {
        recordOutput({
          title: "Schema preview ready (not written)",
          description: `Preview only · ${result.generated || 0} target(s), ${result.totalQuestions || 0} questions`,
          type: "preview",
          source: markerName
        });
      }
    }

    if (markerName === "META_TAGS") {
      recordOutput({
        title: result.summary?.writeback?.enabled ? "Meta tags generated and writeback attempted" : "Meta tags preview generated",
        description: `${result.rows?.length || result.summary?.rows || 0} rows`,
        type: result.summary?.writeback?.enabled ? "sheet-writeback" : "preview",
        source: markerName
      });
    }

    if (markerName === "CLIENT_REPORT") {
      recordOutput({
        title: "Client report dashboard generated",
        description: result.summary?.title || result.reportType || "Dashboard data ready",
        type: "report",
        source: markerName
      });
    }

    if (markerName === "CLIENT_REPORT_EDIT") {
      recordOutput({
        title: "Client report insight edited",
        description: "Updated insight block returned",
        type: "report-edit",
        source: markerName
      });
    }

    if (markerName === "SITE_AI_AUDIT") {
      let reportUrl = "";
      const key = storeStructuredReportResult("carmelon.siteAiAudit.result", result);
      reportUrl = key ? `/site-ai-audit.html?resultKey=${encodeURIComponent(key)}` : "/site-ai-audit.html";
      recordOutput({
        title: "Site AI audit report ready",
        description: `Score ${result.score?.total ?? "-"} / 100 · ${result.pages?.length || result.summary?.pagesChecked || 0} pages · ${(result.issues || []).length} issues`,
        type: "audit-report",
        url: reportUrl,
        source: markerName
      });
    }

    if (markerName === "SITE_FAQ_AUDIT") {
      if (result.googleSheet?.url) {
        recordOutput({
          title: "FAQ audit Google Sheet report",
          description: `${result.summary?.pagesChecked || 0} pages checked`,
          type: "google-sheet",
          url: result.googleSheet.url,
          source: markerName
        });
      }

      const key = storeStructuredReportResult("carmelon.siteFaqAudit.result", result);
      const reportUrl = key ? `/site-ai-faq-audit.html?resultKey=${encodeURIComponent(key)}` : "/site-ai-faq-audit.html";
      const summary = result.summary || {};
      const gapCount = Number(summary.pagesWithMismatch || 0) + Number(summary.pagesMissingSchema || 0) + Number(summary.pagesMissingVisibleFaq || 0);
      recordOutput({
        title: "FAQ audit report ready",
        description: `${summary.pagesChecked || result.pages?.length || 0} pages · ${summary.totalVisibleQuestions || 0} visible Q/A · ${summary.totalSchemaQuestions || 0} schema Q/A · ${gapCount} gaps`,
        type: "faq-audit-report",
        url: reportUrl,
        source: markerName
      });
    }

    if (markerName === "SITE_AI_DISCOVERY") {
      if (state.runningToolId === "site-ai-faq-audit" || state.activeToolId === "site-ai-faq-audit") {
        applyFaqAuditDiscoveryResult(result);
      }
      recordOutput({
        title: "Site discovery map ready",
        description: `${result.urls?.length || 0} URLs mapped`,
        type: "discovery",
        source: markerName
      });
    }
  }

  function parseLogForOutputs(rawLine) {
    const line = cleanAnsi(rawLine).trim();
    if (!line) return true;

    const startMatch = line.match(/^([A-Z0-9_]+)_RESULT_JSON_START$/);
    if (startMatch && resultMarkerNames.has(startMatch[1])) {
      state.marker = { name: startMatch[1], lines: [] };
      logLine(`Receiving structured ${startMatch[1].replaceAll("_", " ").toLowerCase()} result...`);
      return true;
    }

    const endMatch = line.match(/^([A-Z0-9_]+)_RESULT_JSON_END$/);
    if (endMatch && state.marker?.name === endMatch[1]) {
      const raw = state.marker.lines.join("\n").trim();
      const parsed = parseStructuredOutput(state.marker.name, raw);
      recordStructuredOutputs(state.marker.name, parsed);
      logLine(`Structured ${state.marker.name.replaceAll("_", " ").toLowerCase()} result parsed.`, parsed ? "ok" : "warn");
      state.marker = null;
      return true;
    }

    if (state.marker) {
      state.marker.lines.push(line);
      return true;
    }

    const sheetUrls = line.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:\/edit)?[^\s\u001b]*/g) || [];
    sheetUrls.forEach((url) => {
      recordOutput({
        title: /report/i.test(line) ? "Google Sheet report" : "Google Sheet created",
        description: /faq/i.test(line) ? "FAQ workflow output" : "Generated spreadsheet",
        type: "google-sheet",
        url: url.replace(/[),.;\]]+$/g, ""),
        source: state.activeToolId || "log"
      });
    });
    return false;
  }

  function handleRunLogLine(line) {
    const text = String(line || "");
    const consumed = parseLogForOutputs(text);
    if (!consumed) logLine(text);
    renderToolStrip();
  }

  function clearInterruptedStructuredResult(reason) {
    if (!state.marker) return;
    const markerLabel = state.marker.name.replaceAll("_", " ").toLowerCase();
    state.marker = null;
    logLine(`Structured ${markerLabel} result was interrupted before the closing marker. ${reason}`, "warn");
  }

  document.querySelectorAll(".history-stack details").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      document.querySelectorAll(".history-stack details[open]").forEach((item) => {
        if (item !== details) item.open = false;
      });
    });
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitUserText(els.input.value);
  });

  els.input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    els.form.requestSubmit();
  });

  els.quickReplies.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reply-value]");
    if (!button) return;
    const value = button.dataset.replyValue;
    if (button.dataset.replyEcho !== "false") user(button.textContent.trim());
    const handled = handleSpecialReply(value);
    if (handled) {
      renderToolStrip();
      return;
    }
    handleFreeText(value).finally(() => renderToolStrip());
  });

  els.actionsList.addEventListener("click", (event) => {
    if (event.target.closest("[data-run-workflow]")) runWorkflow();
    if (event.target.closest("[data-run-tool]")) runCurrentTool({ confirmed: true });
    if (event.target.closest("[data-faqaudit-map]")) runFaqAuditDiscovery();
    if (event.target.closest("[data-open-workspace]")) openCurrentToolWorkspace();
    if (event.target.closest("[data-show-faq-prompts]")) handleSpecialReply("review-prompts");
    if (event.target.closest("[data-schema-output]")) handleSpecialReply("schema:output");
    const schemaPolicyButton = event.target.closest("[data-schema-policy]");
    if (schemaPolicyButton) handleSpecialReply(`schema:run:${schemaPolicyButton.dataset.schemaPolicy || "skip"}`);
    if (event.target.closest("[data-schema-preview]")) handleSpecialReply("schema:preview");
    if (event.target.closest("[data-add-context]")) handleSpecialReply("extra");
    if (event.target.closest("[data-add-tool-detail]")) handleSpecialReply("tool:detail");
    if (event.target.closest("[data-add-file-detail]")) handleSpecialReply("file:detail");
    if (event.target.closest("[data-reset-task]")) resetAll();
    if (event.target.closest("[data-copy-file-plan]")) {
      navigator.clipboard?.writeText(JSON.stringify(state.lastPayload || state.fileTask, null, 2));
      bot(prefersHebrew() ? "העתקתי את בקשת העריכה." : "Copied the file edit request.");
    }
    if (event.target.closest("[data-copy-faq-prompts]")) {
      const prompts = faqPromptPreview();
      const text = [
        "QUESTION PROMPT",
        compactPromptPreview(prompts.question),
        "",
        "ANSWER PROMPT",
        compactPromptPreview(prompts.answer)
      ].join("\n\n");
      navigator.clipboard?.writeText(text);
      bot(prefersHebrew() ? "העתקתי את פרומפט השאלות ופרומפט התשובות." : "Copied the question and answer prompts.");
    }
    if (event.target.closest("[data-copy-payload]")) {
      const payload = state.activeToolId === "faq-playground"
        ? buildPayload()
        : (faqAuditNeedsDiscovery() ? faqAuditDiscoveryPayload() : state.lastPayload);
      if (!payload) return;
      navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
      bot(hasHebrew(JSON.stringify(payload)) ? "העתקתי את הפרטים הטכניים." : "Copied the payload.");
    }
  });

  els.resetChatBtn.addEventListener("click", resetAll);
  els.clearActionsBtn.addEventListener("click", resetAll);
  els.clearLogBtn.addEventListener("click", () => {
    els.runLog.textContent = "Ready. Existing workflows run through the same backend socket.";
    state.marker = null;
  });

  if (socket) {
    socket.on("connect", () => logLine("Backend socket connected.", "ok"));
    socket.on("disconnect", () => {
      clearInterruptedStructuredResult("Run the audit again to rebuild the formatted report card.");
      logLine("Backend socket disconnected.", "warn");
    });
    socket.on("log", (line) => handleRunLogLine(line));
    socket.on("preview-event", (event) => {
      recordOutput({
        title: event?.title || event?.kind || "Preview event",
        description: event?.fileName || event?.spreadsheetId || "Preview data received",
        type: "preview",
        source: state.runningToolId || state.activeToolId || "preview-event"
      });
    });
    socket.on("done", () => {
      clearInterruptedStructuredResult("The run ended before the full report JSON arrived.");
      const completedToolId = state.runningToolId || state.activeToolId;
      const completedPayload = state.runningPayload || state.lastPayload;
      state.running = false;
      state.lastRun = {
        toolId: completedToolId,
        payload: completedPayload,
        finishedAt: new Date().toISOString()
      };
      if (completedToolId) {
        rememberToolPayload(completedToolId, completedPayload || {}, state.collectedInputs);
        state.lastResult = {
          status: "finished",
          toolId: completedToolId,
          operation: completedPayload?.operation?.type || completedPayload?.selectedOperation || completedPayload?.mode || "",
          outputCount: state.outputs.length,
          latestOutput: state.outputs[0] || null,
          finishedAt: state.lastRun.finishedAt
        };
      }
      state.runningToolId = "";
      state.runningPayload = null;
      renderWorkspace();
      logLine("Workflow finished.", "ok");
      if (completedToolId === "faq-playground") {
        bot("ההרצה הסתיימה. אם נוצר קובץ חדש, הוא יופיע בצד ימין.");
        setReadyReplies();
      } else if (completedToolId) {
        const tool = getTool(completedToolId);
        if (tool?.id === "schema-builder") {
          bot(prefersHebrew()
            ? (state.collectedInputs.previewOnly === false
              ? "הסכמה נכתבה לגיליון. הקישור לקובץ נמצא בצד ימין."
              : "סיימתי את הבדיקה המקדימה. לא כתבתי לגיליון; התוצאה נשמרה בצד ימין.")
            : (state.collectedInputs.previewOnly === false
              ? "Schema Builder finished. The Sheet link is in Generated outputs."
              : "Schema preview finished. Nothing was written to the Sheet; the preview output is saved in Generated outputs."));
        } else if (tool?.id === "design-formatting") {
          bot(prefersHebrew()
            ? `סיימתי את ${designOperationLabel(payloadOperation(completedPayload), true)}. ${describeLastRunOutput("איפה הפלט")}`
            : `${tool.title} finished. ${describeLastRunOutput("where output")}`);
        } else if (tool?.id === "site-ai-faq-audit" && completedPayload?.mode === "site-ai-discovery") {
          if (hasFaqAuditDiscovery()) {
            askFaqAuditGroups();
          } else {
            askFaqAuditDiscovery(prefersHebrew()
              ? "המיפוי הסתיים אבל לא התקבלו קבוצות עמודים מסודרות. נסי למפות שוב או לפתוח את כלי האודיט."
              : "Discovery finished but no URL groups were parsed. Try mapping again or open the workspace.");
          }
        } else if (tool?.id === "site-ai-faq-audit") {
          const latestFaqOutput = state.outputs.find((item) => item.source === "SITE_FAQ_AUDIT");
          if (latestFaqOutput?.url) {
            bot(prefersHebrew()
              ? "האודיט הסתיים. הדוח הלחיץ מוכן בצד ימין. לא יצרתי Google Sheet בלי אישור יצוא נפרד."
              : "FAQ audit finished. A clickable internal report is ready in Generated outputs. I did not create a Google Sheet without a separate export confirmation.");
          } else {
            bot(prefersHebrew()
              ? "האודיט הסתיים, אבל לא הצלחתי לבנות דוח לחיץ מהתוצאה. בדקי את יומן ההרצה או הריצי שוב."
              : "FAQ audit finished, but I could not build a clickable report from the result. Check the run log or run it again.");
          }
        } else {
          bot(prefersHebrew()
            ? "ההרצה הסתיימה. אם זוהו קישורים או תוצאות מסודרות, הן נשמרו בצד ימין."
            : `${tool?.title || "The workflow"} finished. Parsed links and result markers were saved in Generated outputs when available.`);
        }
        if (tool && !(tool.id === "site-ai-faq-audit" && completedPayload?.mode === "site-ai-discovery")) setGenericReadyReplies(tool);
      }
      renderToolStrip();
    });
  }

  renderSources();
  renderOutputs();
  renderToolStrip();
  renderWorkspace();
  if (!loadHomeDraft()) welcome();
})();
