(() => {
  const COMMAND_TYPES = {
    START_TASK: "start_task",
    SWITCH_TASK: "switch_task",
    START_SHEET_EDIT: "start_sheet_edit",
    START_COLUMN_TRANSFER: "start_column_transfer",
    SET_FIELD: "set_field",
    APPEND_INSTRUCTION: "append_instruction",
    CONFIRM_RUN: "confirm_run",
    REQUEST_DRY_RUN: "request_dry_run",
    OPEN_WORKSPACE: "open_workspace",
    SHOW_PAYLOAD: "show_payload",
    SHOW_RESULT: "show_result",
    CLARIFY: "clarify"
  };

  function cleanText(text) {
    return String(text || "").trim();
  }

  function hasHebrew(text) {
    return /[\u0590-\u05ff]/.test(String(text || ""));
  }

  function stripUrls(text) {
    return String(text || "").replace(/https?:\/\/[^\s"'<>]+/gi, " ");
  }

  function extractUrls(text) {
    return Array.from(new Set((String(text || "").match(/https?:\/\/[^\s"'<>]+/gi) || [])
      .map((url) => url.replace(/[),.;\]]+$/g, ""))));
  }

  function isSheetUrl(url) {
    return /docs\.google\.com\/spreadsheets\//i.test(String(url || ""));
  }

  function isWebsiteUrl(url) {
    return /^https?:\/\//i.test(String(url || "")) && !isSheetUrl(url) && !/drive\.google\.com\/drive\/folders/i.test(String(url || ""));
  }

  function firstWebsiteUrl(text) {
    return extractUrls(text).find(isWebsiteUrl) || "";
  }

  function firstSheetUrl(text) {
    return extractUrls(text).find(isSheetUrl) || "";
  }

  function isDriveFolderUrl(url) {
    return /drive\.google\.com\/drive\/folders\//i.test(String(url || ""));
  }

  function firstDriveFolderUrl(text) {
    return extractUrls(text).find(isDriveFolderUrl) || "";
  }

  function hasSheetReference(text, snapshot = {}) {
    const lower = String(text || "").toLowerCase();
    return Boolean(firstSheetUrl(text) || firstDriveFolderUrl(text) || snapshot.latestSheetUrl || snapshot.latestGeneratedSheetUrl) &&
      /(sheet|spreadsheet|google\s*sheet|column|columns|cells?|גיליון|גוגל\s*שיט|גוגל\s*שיטס|קובץ|טבלה|עמודה|עמודות|תאים)/i.test(lower);
  }

  function hasEditVerb(text) {
    const lower = stripUrls(text).toLowerCase();
    return /(edit|change|update|fix|clean|remove|delete|strip|replace|copy|move|transfer|put|write|fill|complete|search|find|apply|לערוך|תערכי|תערוך|ערוך|לתקן|תתקני|תתקן|לשנות|לעדכן|לנקות|להסיר|למחוק|להחליף|להעתיק|להעביר|לכתוב|להכניס|למלא|להשלים|לחפש|למצוא|להחיל|ליישם|להטמיע\s+הערות)/i.test(lower);
  }

  function isRunRequest(text) {
    const value = cleanText(text).toLowerCase();
    return /^(run|run it|start|start it|go|go ahead|execute|launch|continue)$/i.test(value) ||
      /^(תריץ|תריצי|להריץ|תתחיל|תתחילי|אפשר להריץ|להמשיך|תמשיך)$/i.test(cleanText(text));
  }

  function isDryRunRequest(text) {
    return /\bdry\s*run\b|preview|תצוגה|בדיקה\s+יבשה|בלי\s+כתיבה|לא\s+לכתוב/i.test(String(text || ""));
  }

  function isPayloadRequest(text) {
    return /payload|פיילואד|להציג\s+payload|תראה\s+payload|show\s+(?:the\s+)?json\b(?!\s*-?\s*ld)|\bjson\b(?!\s*-?\s*ld)(?=.*(?:payload|show|תראה|להציג))/i.test(String(text || ""));
  }

  function isWorkspaceRequest(text) {
    return /open workspace|workspace|open builder|builder|פתח|לפתוח|מסך|ממשק|עורך/i.test(String(text || ""));
  }

  function isResultQuestion(text) {
    const lower = String(text || "").toLowerCase();
    if (/(build|create|generate|make|prepare|run|audit|translate|edit|fix|clean|copy|move|transfer|לבנות|ליצור|להכין|להריץ|אודיט|תרג|לערוך|לתקן|לנקות|להעתיק|להעביר)/i.test(lower)) {
      return false;
    }
    const asksLocation = /(where|where did|which column|where is|איפה|היכן|לאן|איזו\s+עמודה|איפה\s+שמת|איפה\s+נשמר|איפה\s+זה\s+נשמר)/i.test(lower);
    const asksOutcome = /(what changed|what happened|show result|show output|open report|result link|output link|מה השתנה|מה קרה|תראה\s+תוצאה|תציג\s+תוצאה|קישור\s+לתוצאה|דוח\s+שנוצר)/i.test(lower);
    const mentionsStoredOutput = /(saved|created|written|put|output|result|report|link|נשמר|נוצר|נכתב|שמת|פלט|תוצאה|דוח|קישור)/i.test(lower);
    return asksLocation || asksOutcome || (mentionsStoredOutput && /\?$/.test(cleanText(text)));
  }

  // ---------------------------------------------------------------------
  // Intent detectors
  // ---------------------------------------------------------------------

  function isFaqImplementationAuditIntent(text) {
    const value = String(text || "");
    const lower = value.toLowerCase();
    const mentionsFaq = /faq|faqpage|שאלות\s*(?:ו)?תשובות|שאלות\s+נפוצות|questions?\s+(?:and|&)\s+answers?/i.test(lower);
    const mentionsFaqSchema = /faqpage|faq\s*schema|schema.{0,35}faq|faq.{0,35}schema|סכמ(?:ה|ות|ת)?\s*(?:faq|שאלות)|json-ld.{0,35}faq|faq.{0,35}json-ld/i.test(lower);
    const mentionsSchema = /schema|json-ld|סכמה|סכימה|סכמות|rich results/i.test(lower);
    if (!mentionsFaq && !mentionsFaqSchema) return false;
    const wantsCheck = /לבדוק|לבחון|בחינה|בדיק(?:ה|ת)|ביקורת|audit|check|verify|validation|validate|inspect|review|compare|תואם|התאמה|השוואה|מול\s|כנגד/i.test(lower);
    if (!wantsCheck) return false;
    const strongImplementation = /הטמעה|הוטמע|הוטמעו|הוטמעה|מוטמע|מוטמעת|מוטמעים|יישום|implement(?:ed|ation)?|schema|json-ld|סכמה|סכימה|סכמות|faqpage|rich results/i.test(lower);
    const siteContext = /(?:^|[^א-ת\w])(?:אתר|באתר|לאתר|האתר)(?:[^א-ת\w]|$)|\bwebsite\b|\bsite\b|\bweb\s?page\b|(?:^|[^א-ת])עמוד(?:ים)?(?:\s|$|[^א-ת])/u.test(lower) || Boolean(firstWebsiteUrl(value));
    const wholeSiteAudit = /site\s+audit|full\s+audit|crawl|crawler|אודיט\s+אתר|סריקת\s+אתר|ai readiness|readiness audit/i.test(lower);
    if (wholeSiteAudit && !strongImplementation) return false;
    const sheetContext = /עמודה|בעמודה|column|גיליון|spreadsheet|google\s*sheet/i.test(lower) || Boolean(firstSheetUrl(value));
    if (sheetContext && !siteContext) return false;
    return strongImplementation || siteContext;
  }

  function isStructuredDataSiteAuditIntent(text) {
    const value = String(text || "");
    const lower = value.toLowerCase();
    if (isFaqImplementationAuditIntent(value)) return false;
    const mentionsStructuredData = /schema|structured\s*data|json-ld|סכמה|סכימה|סכמות|rich results/i.test(lower);
    if (!mentionsStructuredData) return false;
    const wantsCheck = /לבדוק|לבחון|בחינה|בדיק(?:ה|ת)|יש\s+סכמ|ישנן\s+סכמ|audit|check|verify|validation|validate|inspect|review|סריק(?:ה|ת)/i.test(lower);
    if (!wantsCheck) return false;
    const siteContext = /(?:^|[^א-ת\w])(?:אתר|באתר|לאתר|האתר)(?:[^א-ת\w]|$)|\bwebsite\b|\bsite\b|\bweb\s?page\b|(?:^|[^א-ת])עמוד(?:ים)?(?:\s|$|[^א-ת])/u.test(lower) || Boolean(firstWebsiteUrl(value));
    return siteContext;
  }

  function isFaqCreationIntent(text) {
    const lower = String(text || "").toLowerCase();
    if (isFaqImplementationAuditIntent(text)) return false;
    const existingFaqGap = /(faq|שאלות\s*(?:ו)?תשובות).{0,160}(missing|additional|gap|not\s+included|doesn.?t\s+include|שלא\s+מופיעות|לא\s+מופיעות|חסרות|נוספות)|(?:write|create|generate|תכתוב|לכתוב|כתוב|צרי|צור).{0,100}(missing\s+questions|additional\s+questions|שאלות\s+חסרות|שאלות\s+נוספות|שאלות\s+שלא\s+מופיעות)/i.test(lower);
    if (existingFaqGap) return true;
    return /(build|create|generate|make|prepare|לבנות|ליצור|להכין|תבנה|תבני|תכין|תכיני|צרי|צור).{0,40}(faq|שאלות)/i.test(lower) ||
      /(faq|שאלות\s*(?:ו)?תשובות).{0,40}(למלון|לעסק|למוצר|לשירות|לאורחים|for\s+(?:a\s+)?(?:hotel|guests|business|product|service))/i.test(lower) ||
      /^(faq|בניית\s+faq|אני\s+רוצה\s+לבנות\s+faq)/i.test(lower);
  }

  function isSiteAuditIntent(text) {
    const lower = String(text || "").toLowerCase();
    return (isStructuredDataSiteAuditIntent(text) || /site audit|audit\s+(?:the\s+)?(?:site|website)|seo audit|ai readiness|readiness audit|crawler|crawl|אודיט|בדיקת\s+אתר|סריקת\s+אתר|לסרוק\s+אתר/i.test(lower)) &&
      !isFaqImplementationAuditIntent(text);
  }

  function isTranslationIntent(text) {
    const value = String(text || "");
    const hasVerb = /\btranslate\b|\blocali[sz]e\b|לתרגם|תרגמו|תרגמי|(?:^|[\s,.:;"'])תרגם(?=[\s,.:;"']|$)/i.test(value) ||
      /(?:^|[\s,.:;"'])תרגום\s+(?:של|ל)/.test(value);
    if (hasVerb) return true;
    const hasNoun = /\btranslation\b|\blocali[sz]ation\b|תרגום/i.test(value);
    if (!hasNoun) return false;
    return !hasEditVerb(value);
  }

  function isMetaTagsIntent(text) {
    const lower = String(text || "").toLowerCase();
    if (/audit|check|verify|validation|אודיט|בדיקת|לבדוק|בדיקה|סריקה/i.test(lower)) return false;
    return /\bmeta(?:\s+tags?)?\b|title tag|meta title|meta description|seo tags?|seo title|open graph|og:|\bh1\b|מטא|מטה|תגיות\s*(?:מטא|מטה|seo)?|טייטל(?:ים)?|דסקריפש(?:ן|יין)|תיאורי?\s+מטא/i.test(lower);
  }

  function isSchemaBuilderIntent(text) {
    const lower = String(text || "").toLowerCase();
    if (isFaqImplementationAuditIntent(text)) return false;
    if (isStructuredDataSiteAuditIntent(text)) return false;
    return /schema|json-ld|faqpage|rich results|סכמה|סכימה|סכמות/i.test(lower);
  }

  function isSheetUtilitiesIntent(text) {
    const lower = stripUrls(text).toLowerCase();
    const crossFileWords = /vlookup|lookup\s+copy|cross[-\s]?check|coverage\s+report|folder[-\s]to[-\s]master|master\s+(?:file|sheet|injection)|work[-\s]file|copy\s+columns?\s+(?:between|from\s+.*\s+to\s+another)|בין\s+קבצים|מקובץ\s+אחר|לקובץ\s+אחר|הצלבה|להצליב|בדיקת\s+כיסוי|דוח\s+כיסוי|מאסטר|קובץ\s+עבודה/i.test(lower);
    if (crossFileWords) return true;
    const sheetLikeUrls = extractUrls(text).filter((url) => isSheetUrl(url) || isDriveFolderUrl(url));
    return sheetLikeUrls.length >= 2;
  }

  function isClientReportsIntent(text) {
    const lower = String(text || "").toLowerCase();
    if (isSheetUtilitiesIntent(text)) return false;
    return /client\s+reports?|dashboards?|performance\s+report|monthly\s+report|kpi\s+report|analytics\s+report|ga4|google\s+analytics|דוח\s+לקוח|דוחות\s+לקוח|דשבורד|דוח\s+חודשי|דוח\s+ביצועים|אנליטיקס/i.test(lower);
  }

  function isSheetEditIntent(text, snapshot = {}) {
    if (/schema|json-ld|faqpage|rich results|סכמה|סכימה/i.test(String(text || ""))) return false;
    if (isSheetUtilitiesIntent(text)) return false;
    const lower = stripUrls(text).toLowerCase();
    const hasEdit = hasEditVerb(text);
    const mentionsSheet = hasSheetReference(text, snapshot) || /(column|columns|cells|answers|source links?|עמודה|עמודות|תאים|תשובות|מקורות)/i.test(lower);
    const hasRecentSheet = Boolean(snapshot.latestGeneratedSheetUrl || snapshot.latestSheetUrl || snapshot.lastSheetUrl);
    const strongSheetPhrasing = /(answers?|column|cells|תשובות|עמודה|תאים).{0,60}/i.test(lower) && hasEdit;
    return hasEdit && mentionsSheet && (hasRecentSheet || Boolean(firstSheetUrl(text)) || strongSheetPhrasing);
  }

  function isRemoveSourcesIntentLite(text) {
    const lower = stripUrls(text).toLowerCase();
    return /(remove|delete|strip|clean|להסיר|למחוק|לנקות|להעלים).{0,60}(source|sources|reference|citation|links?|מקורות|מקור|קישורים|קישור|לינקים)/i.test(lower) ||
      /(קישור|קישורים|לינק|לינקים|links?).{0,40}(מקורות|מקור|sources?|references?|citations?)/i.test(lower);
  }

  function isColumnTransferIntent(text, snapshot = {}) {
    const lower = stripUrls(text).toLowerCase();
    const trimmed = cleanText(stripUrls(text)).replace(/[־–—]/g, "-");
    const correction =
      /^(?:עכשיו\s*)?ל[\s-]*[A-Z]{1,3}$/i.test(trimmed) ||
      /^(?:now\s+)?(?:to|into)\s+(?:column\s*)?[A-Z]{1,3}$/i.test(trimmed) ||
      /^(?:לא|not|no)\s+[A-Z]{1,3}\s*[,;]?\s*(?:אלא\s*)?(?:ל|to|into)?[\s-]*[A-Z]{1,3}$/i.test(trimmed);
    const hasMemory = Boolean(snapshot.lastOperation || snapshot.latestGeneratedSheetUrl || snapshot.latestSheetUrl || snapshot.lastSheetUrl || snapshot.activeToolId === "design-formatting");
    if (correction && hasMemory) return true;
    if (isRemoveSourcesIntentLite(text)) return false;
    if (isSheetUtilitiesIntent(text)) return false;
    if (snapshot.activeToolId !== "design-formatting" && /schema|json-ld|faqpage|rich results|סכמה|סכימה|\bmeta\b|מטא|מטה|תגיות|טייטל(?:ים)?|דסקריפש(?:ן|יין)/i.test(lower)) return false;
    const transfer = /\b(copy|move|transfer|replace|put|insert|write)\b.{0,60}\b[a-z]{1,3}\b|תעביר|להעביר|תעתיק|להעתיק|תחליף|להחליף|תיקח|לקחת|תכניס|להכניס|שים|לשים|תכתוב|לכתוב/i.test(lower);
    const columns = Array.from(lower.matchAll(/\b([a-z]{1,3})\b/g)).map((match) => match[1].toUpperCase())
      .filter((value) => /^[A-Z]{1,3}$/.test(value) && !["FAQ", "URL", "AI"].includes(value));
    const hasSheetContext = hasSheetReference(text, snapshot) ||
      Boolean(snapshot.latestGeneratedSheetUrl || snapshot.latestSheetUrl || snapshot.lastSheetUrl) ||
      snapshot.activeToolId === "design-formatting";
    return transfer && hasSheetContext && (columns.length >= 1 || Boolean(snapshot.lastOperation));
  }

  function planDeterministicCommands(text, snapshot = {}) {
    const clean = cleanText(text);
    if (!clean) return [];
    const commands = [];
    const websiteUrl = firstWebsiteUrl(clean);
    const sheetUrl = firstSheetUrl(clean);
    const folderUrl = firstDriveFolderUrl(clean);
    const activeToolId = snapshot.activeToolId || "";
    const activeStep = snapshot.step || "";
    const pendingKey = snapshot.pendingQuestion?.key || "";

    function startOrSwitch(toolId, fields, confidence, reason) {
      return [{
        type: activeToolId && activeToolId !== toolId ? COMMAND_TYPES.SWITCH_TASK : COMMAND_TYPES.START_TASK,
        toolId,
        fields: fields || {},
        confidence,
        reason
      }];
    }

    if (isResultQuestion(clean)) {
      return [{ type: COMMAND_TYPES.SHOW_RESULT, confidence: 0.95, reason: "result-location question" }];
    }

    if (isPayloadRequest(clean)) {
      return [{ type: COMMAND_TYPES.SHOW_PAYLOAD, confidence: 0.95, reason: "payload request" }];
    }

    if (isWorkspaceRequest(clean) && activeToolId) {
      return [{ type: COMMAND_TYPES.OPEN_WORKSPACE, confidence: 0.88, reason: "workspace request" }];
    }

    if (activeStep === "ready" && isRunRequest(clean)) {
      return [{ type: COMMAND_TYPES.CONFIRM_RUN, confidence: 0.93, reason: "explicit run request" }];
    }

    if (pendingKey && /siteUrl|sourceUrl|targetUrl|sourceInput|spreadsheetId|pageList/.test(pendingKey)) {
      const answerUrl = sheetUrl || folderUrl || websiteUrl;
      const bareUrlAnswer = answerUrl && stripUrls(clean).trim().length <= 12;
      if (bareUrlAnswer) {
        return [{ type: COMMAND_TYPES.SET_FIELD, key: pendingKey, value: answerUrl, confidence: 0.9, reason: "URL answer for pending field" }];
      }
    }

    if (activeToolId === "meta-tags" && activeStep && activeStep !== "idle") {
      return commands;
    }

    if (activeToolId === "design-formatting" && isDryRunRequest(clean)) {
      return [{ type: COMMAND_TYPES.REQUEST_DRY_RUN, confidence: 0.9, reason: "dry-run request" }];
    }

    if (isColumnTransferIntent(clean, snapshot)) {
      return [{
        type: COMMAND_TYPES.START_COLUMN_TRANSFER,
        fields: sheetUrl ? { targetUrl: sheetUrl } : {},
        confidence: 0.92,
        reason: "column transfer/edit follow-up"
      }];
    }

    if (isFaqImplementationAuditIntent(clean)) {
      return startOrSwitch("site-ai-faq-audit", websiteUrl ? { siteUrl: websiteUrl } : {}, 0.95, "FAQ implementation/schema audit");
    }

    if (isStructuredDataSiteAuditIntent(clean)) {
      const fields = {
        requestedAuditChecks: ["includeStructuredData"],
        auditFocus: "custom"
      };
      if (websiteUrl) fields.siteUrl = websiteUrl;
      return startOrSwitch("site-ai-audit", fields, 0.93, "structured data site audit");
    }

    if (isSheetUtilitiesIntent(clean)) {
      const urls = extractUrls(clean).filter((url) => isSheetUrl(url) || isDriveFolderUrl(url));
      const fields = { instruction: clean };
      if (urls[0]) fields.sourceUrl = urls[0];
      if (urls[1]) fields.targetUrl = urls[1];
      return startOrSwitch("sheet-utilities", fields, 0.9, "cross-file sheet utility request");
    }

    if (isSheetEditIntent(clean, snapshot)) {
      return [{
        type: activeToolId === "design-formatting" ? COMMAND_TYPES.APPEND_INSTRUCTION : COMMAND_TYPES.START_SHEET_EDIT,
        fields: sheetUrl ? { targetUrl: sheetUrl } : {},
        text: clean,
        confidence: 0.88,
        reason: "sheet edit request"
      }];
    }

    if (isTranslationIntent(clean)) {
      const sourceUrl = sheetUrl || folderUrl;
      return startOrSwitch("translate-demo", sourceUrl ? { sourceUrl } : {}, 0.9, "translation request");
    }

    const schemaIntent = isSchemaBuilderIntent(clean);
    const metaIntent = isMetaTagsIntent(clean);
    if (schemaIntent && metaIntent) {
      return [{
        type: COMMAND_TYPES.CLARIFY,
        confidence: 0.85,
        reason: "schema vs meta ambiguity",
        question: hasHebrew(clean)
          ? "זה יכול להיות שני דברים - מה להכין קודם?"
          : "This could be two different jobs - which should I prepare first?",
        options: [
          { label: hasHebrew(clean) ? "סכמת FAQPage (JSON-LD)" : "FAQPage schema (JSON-LD)", value: "route:schema-builder" },
          { label: hasHebrew(clean) ? "תגיות מטא (Title/Description/H1)" : "Meta tags (title/description/H1)", value: "route:meta-tags" }
        ]
      }];
    }

    if (schemaIntent) {
      const sourceUrl = sheetUrl || folderUrl;
      return startOrSwitch("schema-builder", sourceUrl ? { sourceUrl } : {}, 0.88, "schema builder request");
    }

    if (metaIntent) {
      const fields = sheetUrl || folderUrl
        ? { sourceUrl: sheetUrl || folderUrl }
        : (websiteUrl
          ? {
              pageList: websiteUrl,
              domain: websiteUrl.replace(/^https?:\/\//i, "").split("/")[0]
            }
          : {});
      return startOrSwitch("meta-tags", fields, 0.88, "meta tags request");
    }

    if (isClientReportsIntent(clean)) {
      return startOrSwitch("client-reports", sheetUrl ? { spreadsheetId: sheetUrl, sourceType: "sheet" } : {}, 0.88, "client report/dashboard request");
    }

    if ((activeToolId === "faq-playground" || snapshot.mode === "faq") && /^(לא|no|not that|זה לא|לא זה)/i.test(clean) && /(אתר|schema|סכמה|הטמעה|מוטמע|implementation|site|audit|check|לבדוק)/i.test(clean)) {
      const toolId = isStructuredDataSiteAuditIntent(clean) ? "site-ai-audit" : "site-ai-faq-audit";
      const fields = websiteUrl ? { siteUrl: websiteUrl } : {};
      if (toolId === "site-ai-audit") {
        fields.requestedAuditChecks = ["includeStructuredData"];
        fields.auditFocus = "custom";
      }
      return [{
        type: COMMAND_TYPES.SWITCH_TASK,
        toolId,
        fields,
        confidence: 0.92,
        reason: toolId === "site-ai-audit" ? "FAQ flow correction to site audit" : "FAQ flow correction to implementation audit"
      }];
    }

    if (isSiteAuditIntent(clean)) {
      return startOrSwitch("site-ai-audit", websiteUrl ? { siteUrl: websiteUrl } : {}, 0.86, "site audit request");
    }

    if (isFaqCreationIntent(clean)) {
      return startOrSwitch("faq-playground", {}, 0.78, "FAQ creation request");
    }

    if ((sheetUrl || folderUrl) && hasEditVerb(clean)) {
      return [{
        type: COMMAND_TYPES.START_SHEET_EDIT,
        fields: sheetUrl ? { targetUrl: sheetUrl } : {},
        text: clean,
        confidence: 0.8,
        reason: "Google Sheet/Drive link with an edit verb"
      }];
    }

    if (pendingKey && websiteUrl && /siteUrl|sourceUrl|targetUrl/.test(pendingKey)) {
      commands.push({ type: COMMAND_TYPES.SET_FIELD, key: pendingKey, value: websiteUrl, confidence: 0.82, reason: "URL for pending field" });
    }

    return commands;
  }

  window.AssistantCommandModel = {
    COMMAND_TYPES,
    planDeterministicCommands,
    intents: {
      isFaqImplementationAuditIntent,
      isFaqCreationIntent,
      isStructuredDataSiteAuditIntent,
      isSiteAuditIntent,
      isTranslationIntent,
      isMetaTagsIntent,
      isSchemaBuilderIntent,
      isSheetUtilitiesIntent,
      isClientReportsIntent,
      isSheetEditIntent,
      isColumnTransferIntent,
      isResultQuestion
    }
  };
})();
