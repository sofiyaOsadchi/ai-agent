(() => {
  const LANGUAGE_OPTIONS = [
    { code: "en", label: "English" },
    { code: "de", label: "German" },
    { code: "fr", label: "French" },
    { code: "es", label: "Spanish" },
    { code: "it", label: "Italian" },
    { code: "nl", label: "Dutch" },
    { code: "pl", label: "Polish" },
    { code: "ru", label: "Russian" },
    { code: "he", label: "Hebrew" },
    { code: "zh", label: "Chinese" },
    { code: "ar", label: "Arabic" },
  ];

  const MODEL_OPTIONS = ["o3", "o4-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"];
  const DEFAULT_MODEL = "o3";
  const STORAGE_KEY = "translate-demo-chat-workspaces-v1";

  const DEFAULT_CHAT_DRAFT_PROMPT = [
    "תרגם את כל התאים במדויק לשפת היעד, תוך שמירה מלאה על מבנה הטבלה, סדר השורות והעמודות.",
    "שמור שמות מלון, מותג, קבצים, טאבים, תיקיות, IDs, URLs, אימיילים, קודים ומספרים בדיוק כפי שהם מופיעים במקור.",
    "השתמש במונחי glossary באופן עקבי, אל תקצר תשובות, ואל תוסיף מידע שלא קיים במקור.",
    "התוצאה צריכה להישמע טבעית בשפת היעד אבל להישאר נאמנה לגמרי למקור.",
  ].join("\n");

  const DEFAULT_CHAT_POLISH_PROMPT = [
    "ערוך את תרגום הדראפט כעורך לוקליזציה מקצועי: שפר טבעיות, זרימה וניסוח בלי לשנות עובדות או משמעות.",
    "שמור על מבנה JSON/טבלה זהה, ועל כל שמות הקבצים, הטאבים, התיקיות, IDs, URLs, קודים ומספרים בדיוק במקום שבו הופיעו.",
    "תקן ניסוחים מסורבלים, שמור על ניסוח מלונאי ברור ומקצועי, ויישם את כללי terminology בלי לפגוע במידע המקורי.",
    "אל תקצר, אל תרחיב, ואל תוסיף הבטחות או פרטים שלא מופיעים במקור.",
  ].join("\n");

  const baseState = {
    step: "sourceId",
    sourceType: "sheet",
    sourceId: "",
    sourceTab: "",
    targetLangs: ["de"],
    model: DEFAULT_MODEL,
    translateHeader: true,
    splitIntoTwo: true,
    draftPrompt: DEFAULT_CHAT_DRAFT_PROMPT,
    polishPrompt: DEFAULT_CHAT_POLISH_PROMPT,
    glossaryLines: "",
    terminologyLines: "",
    workName: "",
    complete: false,
  };

  const state = { ...baseState };
  const els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function init() {
    els.card = byId("translatorChatbot");
    els.log = byId("translationChatLog");
    els.options = byId("translationChatOptions");
    els.form = byId("translationChatForm");
    els.input = byId("translationChatInput");
    els.submitBtn = els.form?.querySelector("button[type='submit']");
    els.summary = byId("translationChatSummary");
    els.applyBtn = byId("chatbotApplyBtn");
    els.applyTopBtn = byId("chatbotApplyTopBtn");
    els.runBtn = byId("chatbotRunBtn");
    els.restartBtn = byId("chatbotRestartBtn");

    if (!els.log || !els.form || !els.input || !els.summary) return;

    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitText();
    });

    els.applyBtn?.addEventListener("click", () => applyToForm(false));
    els.applyTopBtn?.addEventListener("click", () => applyToForm(false));
    els.runBtn?.addEventListener("click", () => applyToForm(true));
    els.restartBtn?.addEventListener("click", restart);

    restart();
  }

  function resetState() {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, { ...baseState });
  }

  function restart() {
    resetState();
    els.log.innerHTML = "";
    askSourceId();
    renderSummary();
  }

  function bot(text) {
    appendMessage(text, "bot");
  }

  function user(text) {
    appendMessage(text, "user");
  }

  function appendMessage(text, type) {
    const message = document.createElement("div");
    message.className = `chat-message ${type}`;
    message.dir = "auto";
    message.textContent = text;
    els.log.appendChild(message);
    els.log.scrollTop = els.log.scrollHeight;
  }

  function setStepUi(step) {
    if (els.card) els.card.dataset.step = step;
    if (els.form) els.form.dataset.step = step;
    if (els.input) {
      const isPromptStep = step === "draftPrompt" || step === "polishPrompt";
      els.input.rows = isPromptStep ? 6 : 1;
    }
  }

  function setPrimaryButton(label) {
    if (els.submitBtn) els.submitBtn.textContent = label || "שליחה";
  }

  function setInput(placeholder, value = "") {
    els.input.placeholder = placeholder;
    els.input.value = value;
    window.setTimeout(() => els.input.focus(), 0);
  }

  function setOptions(options) {
    els.options.innerHTML = "";

    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "chat-option",
        option.confirm ? "confirm" : "",
        option.selected ? "selected" : "",
        option.featured ? "featured" : "",
      ].filter(Boolean).join(" ");
      button.textContent = option.label;
      button.addEventListener("click", option.onClick);
      els.options.appendChild(button);
    });
  }

  function askSourceId() {
    state.step = "sourceId";
    setStepUi("sourceId");
    bot("הדבק/י כאן קישור או ID של Google Sheet או תיקיית Drive.\nאני מזהה לבד וממשיך לשאלה הבאה.");
    setInput("Google Sheet / Drive Folder URL or ID", state.sourceId);
    setPrimaryButton("המשך");
    setOptions([]);
  }

  function askSourceTab() {
    state.step = "sourceTab";
    setStepUi("sourceTab");
    bot("איזה טאב לקרוא מתוך הגיליון? אם לא בטוח, אפשר להשאיר ריק ואשתמש בזיהוי אוטומטי.");
    setInput("לדוגמה: Sheet1, או להשאיר ריק", state.sourceTab);
    setPrimaryButton("המשך");
    setOptions([
      { label: "זיהוי אוטומטי", onClick: () => setSourceTab("") },
    ]);
  }

  function setSourceTab(value) {
    state.sourceTab = value.trim();
    user(state.sourceTab || "זיהוי אוטומטי");
    renderSummary();
    askLanguages();
  }

  function askLanguages() {
    state.step = "languages";
    setStepUi("languages");
    bot("לאילו שפות לתרגם?\nבחר/י שפה אחת או יותר, ואז לחצי על הכפתור הראשי למטה.");
    setInput("אפשר גם לכתוב: גרמנית, ספרדית, עברית או de, es, he");
    setPrimaryButton("המשך");
    renderLanguageOptions();
  }

  function renderLanguageOptions() {
    setOptions(LANGUAGE_OPTIONS.map((lang) => ({
      label: `${state.targetLangs.includes(lang.code) ? "✓ " : ""}${lang.label}`,
      selected: state.targetLangs.includes(lang.code),
      onClick: () => {
        toggleLanguage(lang.code);
        renderLanguageOptions();
        renderSummary();
      },
    })));
  }

  function toggleLanguage(code) {
    if (state.targetLangs.includes(code)) {
      state.targetLangs = state.targetLangs.filter((item) => item !== code);
      return;
    }

    state.targetLangs = [...state.targetLangs, code];
  }

  function continueLanguages() {
    if (!state.targetLangs.length) {
      bot("צריך לבחור לפחות שפת יעד אחת.");
      return;
    }

    user(state.targetLangs.join(", ").toUpperCase());
    renderSummary();
    askModel();
  }

  function askModel() {
    state.step = "model";
    setStepUi("model");
    bot(`איזה מודל להריץ?\n${DEFAULT_MODEL} כבר נבחר כברירת מחדל. אפשר פשוט ללחוץ על הכפתור הראשי למטה.`);
    setInput("אפשר לכתוב מודל אחר, או להשאיר ריק ולהמשיך עם o3");
    setPrimaryButton(`המשך עם ${state.model}`);
    renderModelOptions();
  }

  function renderModelOptions() {
    setOptions(MODEL_OPTIONS.map((model) => ({
      label: model === DEFAULT_MODEL ? `${model} - מומלץ` : model,
      selected: state.model === model,
      onClick: () => selectModel(model),
    })));
  }

  function selectModel(model) {
    state.model = isDefault(model) ? DEFAULT_MODEL : model.trim() || DEFAULT_MODEL;
    setPrimaryButton(`המשך עם ${state.model}`);
    renderModelOptions();
    renderSummary();
  }

  function continueWithModel(model) {
    state.model = isDefault(model) ? DEFAULT_MODEL : model.trim() || DEFAULT_MODEL;
    user(state.model);
    renderSummary();
    askDraftPrompt();
  }

  function askDraftPrompt() {
    state.step = "draftPrompt";
    setStepUi("draftPrompt");
    bot("הנחיות לדראפט\nשמתי פרומפט רציני יותר כנקודת פתיחה. אפשר לערוך אותו כאן או בסרגל הימני.");
    setInput("ערוך/י את הנחיית הדראפט", state.draftPrompt || DEFAULT_CHAT_DRAFT_PROMPT);
    setPrimaryButton("המשך עם הנחיית הדראפט");
    setOptions([
      { label: "ללא תוספת לדראפט", onClick: () => skipOptional("draftPrompt") },
    ]);
  }

  function askPolishPrompt() {
    state.step = "polishPrompt";
    setStepUi("polishPrompt");
    bot("הנחיות לפוליש\nשמתי פרומפט רציני יותר כנקודת פתיחה. אפשר לערוך אותו כאן או בסרגל הימני.");
    setInput("ערוך/י את הנחיית הפוליש", state.polishPrompt || DEFAULT_CHAT_POLISH_PROMPT);
    setPrimaryButton("המשך עם הנחיית הפוליש");
    setOptions([
      { label: "ללא תוספת לפוליש", onClick: () => skipOptional("polishPrompt") },
    ]);
  }

  function askGlossaryChoice() {
    state.step = "glossaryChoice";
    setStepUi("glossaryChoice");
    bot("יש מילים שצריך לתרגם תמיד באותה צורה?\nכתבי פשוט: מקור = תרגום. אם אין, אפשר לדלג.");
    setInput("לדוגמה: Aparthotel = Aparthotel", state.glossaryLines);
    setPrimaryButton("המשך");
    setOptions([
      { label: "להוסיף מילים קבועות", onClick: askGlossaryLines },
      { label: "לדלג על מילים קבועות", onClick: () => skipOptional("glossary") },
    ]);
  }

  function askGlossaryLines() {
    state.step = "glossaryLines";
    setStepUi("glossaryLines");
    user("להוסיף מילים קבועות");
    bot("מעולה. כתבי כל כלל בשורה נפרדת, בפורמט פשוט:\nמקור = תרגום");
    setInput("Aparthotel = Aparthotel; Free Wi-Fi = Kostenloses WLAN", state.glossaryLines);
    setPrimaryButton("המשך");
    setOptions([
      { label: "לדלג על מילים קבועות", onClick: () => skipOptional("glossary") },
    ]);
  }

  function askTerminologyChoice() {
    state.step = "terminologyChoice";
    setStepUi("terminologyChoice");
    bot("יש מילים או ניסוחים שלא תרצי שהמודל ישתמש בהם?\nכתבי פשוט: לא להשתמש = להשתמש במקום. אם אין, אפשר לדלג.");
    setInput("לדוגמה: Haus = Hotel | ניסוח מתאים יותר למלון", state.terminologyLines);
    setPrimaryButton("המשך");
    setOptions([
      { label: "להוסיף כללי ניסוח", onClick: askTerminologyLines },
      { label: "לדלג על כללי ניסוח", onClick: () => skipOptional("terminology") },
    ]);
  }

  function askTerminologyLines() {
    state.step = "terminologyLines";
    setStepUi("terminologyLines");
    user("להוסיף כללי ניסוח");
    bot("כתבי כל כלל בשורה נפרדת:\nלא להשתמש = להשתמש במקום\nאפשר להוסיף סיבה אחרי |");
    setInput("Haus = Hotel | ניסוח מתאים יותר למלון", state.terminologyLines);
    setPrimaryButton("המשך");
    setOptions([
      { label: "לדלג על כללי ניסוח", onClick: () => skipOptional("terminology") },
    ]);
  }

  function completeFlow() {
    state.step = "complete";
    state.complete = true;
    setStepUi("complete");
    bot("ההגדרה מוכנה. אפשר לשמור את העבודה, למלא את הטופס הידני כדי לערוך כל שדה, או להריץ מיד.");
    setInput("ההגדרה מוכנה");
    setPrimaryButton("מלא ופתח לעריכה ידנית");
    setOptions([
      { label: "מלא והריץ עכשיו", confirm: true, onClick: () => applyToForm(true) },
      { label: "התחלה מחדש", onClick: restart },
    ]);
    renderSummary();
  }

  function showCurrentStep() {
    const step = state.step || "sourceId";

    if (step === "sourceTab") return askSourceTab();
    if (step === "languages") return askLanguages();
    if (step === "model") return askModel();
    if (step === "draftPrompt") return askDraftPrompt();
    if (step === "polishPrompt") return askPolishPrompt();
    if (step === "glossaryChoice") return askGlossaryChoice();
    if (step === "glossaryLines") return askGlossaryLines();
    if (step === "terminologyChoice") return askTerminologyChoice();
    if (step === "terminologyLines") return askTerminologyLines();
    if (step === "complete") return completeFlow();
    return askSourceId();
  }

  function skipOptional(kind) {
    if (kind === "draftPrompt") {
      state.draftPrompt = "";
      user("דראפט: ללא תוספת");
      renderSummary();
      askPolishPrompt();
      return;
    }

    if (kind === "polishPrompt") {
      state.polishPrompt = "";
      user("פוליש: ללא תוספת");
      renderSummary();
      askGlossaryChoice();
      return;
    }

    if (kind === "glossary") {
      state.glossaryLines = "";
      user("לדלג על מילים קבועות");
      renderSummary();
      askTerminologyChoice();
      return;
    }

    if (kind === "terminology") {
      state.terminologyLines = "";
      user("לדלג על כללי ניסוח");
      renderSummary();
      completeFlow();
    }
  }

  function submitText() {
    const raw = els.input.value.trim();

    if (state.step === "sourceId") {
      const nextSourceId = raw || state.sourceId.trim();
      if (!nextSourceId) {
        bot("צריך URL או ID של המקור כדי להמשיך.");
        return;
      }
      state.sourceId = nextSourceId;
      state.sourceType = detectSourceType(nextSourceId);
      user(`${state.sourceType === "folder" ? "Drive Folder" : "Google Sheet"}: ${nextSourceId}`);
      renderSummary();
      askSourceTab();
      return;
    }

    if (state.step === "sourceTab") {
      setSourceTab(raw || state.sourceTab);
      return;
    }

    if (state.step === "languages") {
      if (raw) {
        const parsed = parseLanguageCodes(raw);
        if (!parsed.length) {
          bot("לא זיהיתי את השפות. אפשר לכתוב למשל: גרמנית, ספרדית, עברית או de, es, he.");
          return;
        }
        state.targetLangs = parsed;
      }
      continueLanguages();
      return;
    }

    if (state.step === "model") {
      continueWithModel(raw || state.model);
      return;
    }

    if (state.step === "draftPrompt") {
      if (!raw || isSkip(raw)) {
        skipOptional("draftPrompt");
        return;
      }
      state.draftPrompt = raw;
      user("עודכנו הנחיות הדראפט");
      renderSummary();
      askPolishPrompt();
      return;
    }

    if (state.step === "polishPrompt") {
      if (!raw || isSkip(raw)) {
        skipOptional("polishPrompt");
        return;
      }
      state.polishPrompt = raw;
      user("עודכנו הנחיות הפוליש");
      renderSummary();
      askGlossaryChoice();
      return;
    }

    if (state.step === "glossaryChoice" || state.step === "glossaryLines") {
      if (!raw || isSkip(raw)) {
        skipOptional("glossary");
        return;
      }
      state.glossaryLines = raw;
      user(raw);
      renderSummary();
      askTerminologyChoice();
      return;
    }

    if (state.step === "terminologyChoice" || state.step === "terminologyLines") {
      if (!raw || isSkip(raw)) {
        skipOptional("terminology");
        return;
      }
      state.terminologyLines = raw;
      user(raw);
      renderSummary();
      completeFlow();
      return;
    }

    if (state.step === "complete") {
      applyToForm(false);
    }
  }

  function detectSourceType(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (value.includes("/folders/") || value.includes("drive.google.com/drive/folders") || value.includes("folder")) {
      return "folder";
    }
    return "sheet";
  }

  function parseLanguageCodes(raw) {
    const aliases = new Map([
      ["english", "en"],
      ["אנגלית", "en"],
      ["german", "de"],
      ["deutsch", "de"],
      ["גרמנית", "de"],
      ["french", "fr"],
      ["francais", "fr"],
      ["français", "fr"],
      ["צרפתית", "fr"],
      ["spanish", "es"],
      ["ספרדית", "es"],
      ["italian", "it"],
      ["איטלקית", "it"],
      ["dutch", "nl"],
      ["הולנדית", "nl"],
      ["polish", "pl"],
      ["פולנית", "pl"],
      ["russian", "ru"],
      ["רוסית", "ru"],
      ["hebrew", "he"],
      ["עברית", "he"],
      ["chinese", "zh"],
      ["סינית", "zh"],
      ["arabic", "ar"],
      ["ערבית", "ar"],
    ]);

    const valid = new Set(LANGUAGE_OPTIONS.map((item) => item.code));
    const tokens = String(raw || "")
      .split(/[,;\n\s/]+/)
      .map((item) => item.trim().toLowerCase())
      .map((item) => item.startsWith("ו") ? item.slice(1) : item)
      .filter(Boolean);

    return tokens
      .map((item) => aliases.get(item) || item)
      .filter((item) => valid.has(item))
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  function isDefault(raw) {
    return /^(default|ברירת מחדל|רגיל|מומלץ)$/i.test(String(raw || "").trim());
  }

  function isSkip(raw) {
    return /^(skip|none|no|default|דלג|לדלג|אין|לא|בלי|ברירת מחדל|ללא תוספת)$/i.test(String(raw || "").trim());
  }

  function parseGlossary(lines) {
    const out = {};

    String(lines || "")
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parts = line.includes("->") ? line.split("->") : line.split("=");
        const source = (parts[0] || "").trim();
        const target = parts.slice(1).join("=").trim();
        if (source && target) out[source] = target;
      });

    return out;
  }

  function parseTerminology(lines) {
    const mappings = [];

    String(lines || "")
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [main, reasonRaw = "User-provided terminology rule."] = line.split("|");
        const [forbidden, preferred] = main.includes("->") ? main.split("->") : main.split("=");
        const cleanForbidden = (forbidden || "").trim();
        const cleanPreferred = (preferred || "").trim();
        if (cleanForbidden && cleanPreferred) {
          mappings.push({
            forbidden: cleanForbidden,
            preferred: cleanPreferred,
            reason: reasonRaw.trim() || "User-provided terminology rule.",
          });
        }
      });

    return { mappings, examples: [] };
  }

  function buildBridgePayload() {
    const glossary = parseGlossary(state.glossaryLines);
    const terminology = parseTerminology(state.terminologyLines);
    const glossaryByLang = {};
    const terminologyByLang = {};
    const prompts = buildPromptOverrides();

    state.targetLangs.forEach((lang) => {
      if (Object.keys(glossary).length) glossaryByLang[lang] = glossary;
      if (terminology.mappings.length) terminologyByLang[lang] = terminology;
    });

    return {
      sourceType: state.sourceType,
      sourceId: state.sourceId,
      sourceTab: state.sourceTab,
      targetLangs: state.targetLangs,
      model: state.model,
      translateHeader: state.translateHeader,
      splitIntoTwo: state.splitIntoTwo,
      prompts,
      glossaryByLang,
      terminologyByLang,
    };
  }

  function buildPromptOverrides() {
    const prompts = {};

    if (state.draftPrompt) {
      prompts.draftUser = appendChatInstructions(byId("draftUser")?.value || "", "Draft", state.draftPrompt);
    }

    if (state.polishPrompt) {
      prompts.polishUser = appendChatInstructions(byId("polishUser")?.value || "", "Polish", state.polishPrompt);
    }

    return prompts;
  }

  function appendChatInstructions(basePrompt, label, instructions) {
    const cleanBase = String(basePrompt || "").trimEnd();
    const marker = `CHAT ${label.toUpperCase()} INSTRUCTIONS SUMMARY:`;
    const withoutOldChatBlock = cleanBase.split(marker)[0].trimEnd();
    return `${withoutOldChatBlock}\n\n${marker}\n${summarizeChatInstructions(instructions)}`;
  }

  function summarizeChatInstructions(instructions) {
    const items = String(instructions || "")
      .split(/\s*(?:\n|;|•|\u2022)\s*/)
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const sourceItems = items.length ? items : [String(instructions || "").trim()];
    const bullets = sourceItems
      .slice(0, 12)
      .map((item) => `- ${item.replace(/^[-*]\s*/, "")}`)
      .join("\n");

    return `These are the user's chat instructions, rewritten as concise operating rules. Apply them while preserving all existing mandatory variables and JSON structure.\n${bullets}`;
  }

  function applyToForm(shouldRun) {
    if (!window.translateDemoBridge?.fillSetupFromChatbot) {
      bot("הטופס עדיין נטען. נסה/י שוב בעוד רגע.");
      return;
    }

    if (!state.sourceId.trim()) {
      bot("חסר לי עדיין URL או ID של Google Sheet / Drive Folder.");
      return;
    }

    if (!state.complete) {
      state.complete = true;
      bot("מילאתי את הטופס עם המידע שאספנו עד עכשיו. עברו לטאב הידני כדי לערוך כל שדה לפני הרצה.");
    }

    window.translateDemoBridge.fillSetupFromChatbot(buildBridgePayload());

    if (shouldRun) {
      window.translateDemoBridge.runTranslationFromChatbot();
      return;
    }

    window.translateDemoBridge.setSetupModeFromChatbot?.("manual");
  }

  function renderSummary() {
    const savedWorks = listSavedWorks();

    els.summary.innerHTML = `
      <div class="chatbot-save-panel" dir="auto">
        <label class="summary-edit-field">
          <span>שם עבודה לשמירה</span>
          <input type="text" id="chatWorkspaceName" value="${escapeHtml(state.workName)}" placeholder="לדוגמה: תרגום FAQ איטלקית" />
        </label>
        <div class="save-actions">
          <button type="button" class="small-btn primary" id="chatSaveWorkBtn">שמור עבודה</button>
          <select id="chatSavedWorksSelect">
            <option value="">עבודות שמורות בדפדפן</option>
            ${savedWorks.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="save-actions">
          <button type="button" class="small-btn" id="chatLoadWorkBtn">טען</button>
          <button type="button" class="small-btn" id="chatDeleteWorkBtn">מחק</button>
        </div>
        <p class="chatbot-save-note">השמירה היא בדפדפן הזה בלבד, בלי DB. מתאימה לחזרה מאותה עמדה במחשב הזה.</p>
      </div>

      <div class="chatbot-summary-form" dir="auto">
        <label class="summary-edit-field">
          <span>מקור</span>
          <select id="chatSummarySourceType">
            <option value="sheet"${state.sourceType === "sheet" ? " selected" : ""}>Google Sheet</option>
            <option value="folder"${state.sourceType === "folder" ? " selected" : ""}>Drive Folder</option>
          </select>
        </label>
        <label class="summary-edit-field">
          <span>URL / ID</span>
          <input type="text" id="chatSummarySourceId" value="${escapeHtml(state.sourceId)}" placeholder="עדיין חסר" />
        </label>
        <label class="summary-edit-field">
          <span>טאב</span>
          <input type="text" id="chatSummarySourceTab" value="${escapeHtml(state.sourceTab)}" placeholder="זיהוי אוטומטי" />
        </label>
        <label class="summary-edit-field">
          <span>שפות</span>
          <input type="text" id="chatSummaryLangs" value="${escapeHtml(state.targetLangs.join(", "))}" placeholder="de, it, he" />
        </label>
        <label class="summary-edit-field">
          <span>מודל</span>
          <input type="text" id="chatSummaryModel" value="${escapeHtml(state.model)}" />
        </label>
        <label class="summary-edit-field">
          <span>דראפט</span>
          <textarea id="chatSummaryDraft" rows="4">${escapeHtml(state.draftPrompt)}</textarea>
        </label>
        <label class="summary-edit-field">
          <span>פוליש</span>
          <textarea id="chatSummaryPolish" rows="4">${escapeHtml(state.polishPrompt)}</textarea>
        </label>
        <label class="summary-edit-field">
          <span>מילים קבועות</span>
          <textarea id="chatSummaryGlossary" rows="2" placeholder="Aparthotel = Aparthotel">${escapeHtml(state.glossaryLines)}</textarea>
        </label>
        <label class="summary-edit-field">
          <span>מילים לא רצויות</span>
          <textarea id="chatSummaryTerms" rows="2" placeholder="Haus = Hotel | ניסוח מתאים יותר">${escapeHtml(state.terminologyLines)}</textarea>
        </label>
        <div class="summary-static-note">
          שמות קבצים, טאבים ו-IDs נשמרים כמו שהם.
        </div>
      </div>
    `;

    attachSummaryListeners();
  }

  function attachSummaryListeners() {
    byId("chatWorkspaceName")?.addEventListener("input", (event) => {
      state.workName = event.target.value;
    });
    byId("chatSaveWorkBtn")?.addEventListener("click", saveCurrentWork);
    byId("chatLoadWorkBtn")?.addEventListener("click", () => {
      const id = byId("chatSavedWorksSelect")?.value || "";
      if (id) loadSavedWork(id);
    });
    byId("chatDeleteWorkBtn")?.addEventListener("click", () => {
      const id = byId("chatSavedWorksSelect")?.value || "";
      if (id) deleteSavedWork(id);
    });

    byId("chatSummarySourceType")?.addEventListener("change", (event) => {
      state.sourceType = event.target.value === "folder" ? "folder" : "sheet";
    });
    byId("chatSummarySourceId")?.addEventListener("input", (event) => {
      state.sourceId = event.target.value;
      state.sourceType = detectSourceType(event.target.value);
      const sourceTypeSelect = byId("chatSummarySourceType");
      if (sourceTypeSelect) sourceTypeSelect.value = state.sourceType;
    });
    byId("chatSummarySourceTab")?.addEventListener("input", (event) => { state.sourceTab = event.target.value; });
    byId("chatSummaryLangs")?.addEventListener("change", (event) => {
      const parsed = parseLanguageCodes(event.target.value);
      if (parsed.length) {
        state.targetLangs = parsed;
        if (state.step === "languages") renderLanguageOptions();
      }
    });
    byId("chatSummaryModel")?.addEventListener("input", (event) => {
      state.model = event.target.value.trim() || DEFAULT_MODEL;
      if (state.step === "model") setPrimaryButton(`המשך עם ${state.model}`);
    });
    byId("chatSummaryDraft")?.addEventListener("input", (event) => { state.draftPrompt = event.target.value; });
    byId("chatSummaryPolish")?.addEventListener("input", (event) => { state.polishPrompt = event.target.value; });
    byId("chatSummaryGlossary")?.addEventListener("input", (event) => { state.glossaryLines = event.target.value; });
    byId("chatSummaryTerms")?.addEventListener("input", (event) => { state.terminologyLines = event.target.value; });
  }

  function listSavedWorks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
        : [];
    } catch {
      return [];
    }
  }

  function writeSavedWorks(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function getWorkSnapshot() {
    return {
      ...state,
      targetLangs: [...state.targetLangs],
      updatedAt: new Date().toISOString(),
    };
  }

  function saveCurrentWork() {
    const name = String(state.workName || "").trim() || `תרגום ${new Date().toLocaleString("he-IL")}`;
    const id = slugify(name);
    const works = listSavedWorks().filter((item) => item.id !== id);
    works.unshift({ id, name, state: getWorkSnapshot(), updatedAt: new Date().toISOString() });
    writeSavedWorks(works.slice(0, 30));
    state.workName = name;
    renderSummary();
    bot(`שמרתי את העבודה "${name}" בדפדפן הזה.`);
  }

  function loadSavedWork(id) {
    const item = listSavedWorks().find((saved) => saved.id === id);
    if (!item?.state) return;

    Object.assign(state, { ...baseState, ...item.state, workName: item.name || item.state.workName || "" });
    state.targetLangs = Array.isArray(state.targetLangs) ? state.targetLangs : ["de"];
    els.log.innerHTML = "";
    bot(`טענתי את העבודה "${item.name}". ממשיכים מאותה נקודה.`);
    renderSummary();
    showCurrentStep();
  }

  function deleteSavedWork(id) {
    const item = listSavedWorks().find((saved) => saved.id === id);
    writeSavedWorks(listSavedWorks().filter((saved) => saved.id !== id));
    renderSummary();
    if (item) bot(`מחקתי את העבודה השמורה "${item.name}".`);
  }

  function slugify(value) {
    const base = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9א-ת\u0590-\u05ff_-]/g, "")
      .slice(0, 64);
    return base || `work-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
