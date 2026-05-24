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
    SHOW_RESULT: "show_result"
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

  function hasSheetReference(text, snapshot = {}) {
    const lower = String(text || "").toLowerCase();
    return Boolean(firstSheetUrl(text) || snapshot.latestSheetUrl || snapshot.latestGeneratedSheetUrl) &&
      /(sheet|spreadsheet|google\s*sheet|גיליון|גוגל\s*שיט|גוגל\s*שיטס|קובץ|טבלה|עמודה|תאים|cells?)/i.test(lower);
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
    return /payload|json|פיילואד|להציג\s+payload|תראה\s+payload/i.test(String(text || ""));
  }

  function isWorkspaceRequest(text) {
    return /open workspace|workspace|open builder|builder|פתח|לפתוח|מסך|ממשק|עורך/i.test(String(text || ""));
  }

  function isResultQuestion(text) {
    const lower = String(text || "").toLowerCase();
    if (/(build|create|generate|make|prepare|run|audit|translate|edit|fix|clean|copy|move|transfer|לבנות|ליצור|להכין|להריץ|אודיט|תרג|לערוך|לתקן|לנקות|להעתיק|להעביר)/i.test(lower)) {
      return false;
    }
    const asksLocation = /(where|where did|which column|where is|איפה|היכן|לאן|איזו\s+עמודה|איפה\s+שמת|איפה\s+נשמר)/i.test(lower);
    const asksOutcome = /(what changed|what happened|show result|show output|open report|result link|output link|מה השתנה|מה קרה|תראה\s+תוצאה|תציג\s+תוצאה|קישור\s+לתוצאה|דוח\s+שנוצר)/i.test(lower);
    const mentionsStoredOutput = /(saved|created|written|put|output|result|report|link|נשמר|נוצר|נכתב|שמת|פלט|תוצאה|דוח|קישור)/i.test(lower);
    return asksLocation || asksOutcome || (mentionsStoredOutput && /\?$/.test(cleanText(text)));
  }

  function isFaqImplementationAuditIntent(text) {
    const lower = String(text || "").toLowerCase();
    const mentionsFaq = /faq|faqpage|שאלות ותשובות|שאלות/.test(lower);
    const wantsCheck = /לבדוק|בדיקה|ביקורת|audit|check|verify|validation|validate|תואם|התאמה|מול|כנגד|השוואה/i.test(lower);
    const implementation = /הטמעה|מוטמע|מוטמעת|יישום|implementation|implemented|schema|json-ld|סכמה|סכימה|faqpage|rich results|אתר|עמוד|website|site|page/i.test(lower);
    return mentionsFaq && wantsCheck && implementation;
  }

  function isFaqCreationIntent(text) {
    const lower = String(text || "").toLowerCase();
    if (isFaqImplementationAuditIntent(text)) return false;
    return /(build|create|generate|make|prepare|לבנות|ליצור|להכין|תבנה|תכין).{0,30}(faq|שאלות)/i.test(lower) ||
      /^(faq|בניית\s+faq|אני\s+רוצה\s+לבנות\s+faq)/i.test(lower);
  }

  function isSiteAuditIntent(text) {
    const lower = String(text || "").toLowerCase();
    return /site audit|audit site|crawler|crawl|אודיט אתר|בדיקת אתר|סריקת אתר/i.test(lower) && !isFaqImplementationAuditIntent(text);
  }

  function isSheetEditIntent(text, snapshot = {}) {
    if (/schema|json-ld|faqpage|rich results|סכמה|סכימה/i.test(String(text || ""))) return false;
    const lower = stripUrls(text).toLowerCase();
    const hasEdit = /(edit|change|update|fix|clean|remove|delete|strip|replace|copy|move|transfer|put|write|fill|complete|search|find|לערוך|לתקן|לשנות|לעדכן|לנקות|להסיר|למחוק|להחליף|להעתיק|להעביר|לכתוב|להכניס|למלא|להשלים|לחפש|למצוא)/i.test(lower);
    const mentionsSheet = hasSheetReference(text, snapshot) || /(column|columns|cells|answers|עמודה|עמודות|תאים|תשובות)/i.test(lower);
    const hasRecentSheet = Boolean(snapshot.latestGeneratedSheetUrl || snapshot.latestSheetUrl || snapshot.lastSheetUrl);
    return hasEdit && mentionsSheet && (hasRecentSheet || Boolean(firstSheetUrl(text)));
  }

  function isColumnTransferIntent(text, snapshot = {}) {
    const lower = stripUrls(text).toLowerCase();
    const transfer = /(copy|move|transfer|replace|put|insert|write).{0,60}\b[a-z]{1,3}\b|תעביר|להעביר|תעתיק|להעתיק|תחליף|להחליף|תיקח|לקחת|תכניס|להכניס|שים|לשים|תכתוב|לכתוב/i.test(lower);
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
    const activeToolId = snapshot.activeToolId || "";
    const activeStep = snapshot.step || "";
    const pendingKey = snapshot.pendingQuestion?.key || "";

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

    if (activeToolId === "design-formatting" && isDryRunRequest(clean)) {
      return [{ type: COMMAND_TYPES.REQUEST_DRY_RUN, confidence: 0.9, reason: "dry-run request" }];
    }

    if (isFaqImplementationAuditIntent(clean)) {
      return [{
        type: activeToolId && activeToolId !== "site-ai-faq-audit" ? COMMAND_TYPES.SWITCH_TASK : COMMAND_TYPES.START_TASK,
        toolId: "site-ai-faq-audit",
        fields: websiteUrl ? { siteUrl: websiteUrl } : {},
        confidence: 0.95,
        reason: "FAQ implementation/schema audit"
      }];
    }

    if ((activeToolId === "faq-playground" || snapshot.mode === "faq") && /^(לא|no|not that|זה לא|לא זה)/i.test(clean) && /(אתר|schema|סכמה|הטמעה|מוטמע|implementation|site|audit|check|לבדוק)/i.test(clean)) {
      return [{
        type: COMMAND_TYPES.SWITCH_TASK,
        toolId: "site-ai-faq-audit",
        fields: websiteUrl ? { siteUrl: websiteUrl } : {},
        confidence: 0.92,
        reason: "FAQ flow correction to implementation audit"
      }];
    }

    if (isColumnTransferIntent(clean, snapshot)) {
      return [{
        type: COMMAND_TYPES.START_COLUMN_TRANSFER,
        fields: sheetUrl ? { targetUrl: sheetUrl } : {},
        confidence: 0.9,
        reason: "column transfer/edit follow-up"
      }];
    }

    if (isSheetEditIntent(clean, snapshot)) {
      return [{
        type: activeToolId === "design-formatting" ? COMMAND_TYPES.APPEND_INSTRUCTION : COMMAND_TYPES.START_SHEET_EDIT,
        fields: sheetUrl ? { targetUrl: sheetUrl } : {},
        text: clean,
        confidence: 0.86,
        reason: "sheet edit request"
      }];
    }

    if (isSiteAuditIntent(clean)) {
      return [{
        type: activeToolId && activeToolId !== "site-ai-audit" ? COMMAND_TYPES.SWITCH_TASK : COMMAND_TYPES.START_TASK,
        toolId: "site-ai-audit",
        fields: websiteUrl ? { siteUrl: websiteUrl } : {},
        confidence: 0.86,
        reason: "site audit request"
      }];
    }

    if (isFaqCreationIntent(clean)) {
      return [{
        type: activeToolId && activeToolId !== "faq-playground" ? COMMAND_TYPES.SWITCH_TASK : COMMAND_TYPES.START_TASK,
        toolId: "faq-playground",
        fields: {},
        confidence: 0.78,
        reason: "FAQ creation request"
      }];
    }

    if (pendingKey && websiteUrl && /siteUrl|sourceUrl|targetUrl/.test(pendingKey)) {
      commands.push({ type: COMMAND_TYPES.SET_FIELD, key: pendingKey, value: websiteUrl, confidence: 0.82, reason: "URL for pending field" });
    }

    return commands;
  }

  window.AssistantCommandModel = {
    COMMAND_TYPES,
    planDeterministicCommands
  };
})();
