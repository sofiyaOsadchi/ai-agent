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
    { code: "el", label: "Greek" },
  ];

  const MODEL_OPTIONS = ["o3", "o4-mini", "gpt-5.5", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "anthropic:claude-sonnet-4-6"];
  const DEFAULT_MODEL = "o3";
  const STORAGE_KEY = "translate-demo-chat-workspaces-v1";

  const DEFAULT_CHAT_DRAFT_PROMPT = [
    "Translate every cell accurately into the target language while preserving the table structure, row order, and column order.",
    "Keep hotel names, brand names, file names, tabs, folders, IDs, URLs, emails, codes, and numbers exactly as they appear in the source.",
    "Apply glossary terms consistently, do not shorten answers, and do not add information that is not present in the source.",
    "The result should sound natural in the target language while staying fully faithful to the source.",
  ].join("\n");

  const DEFAULT_CHAT_POLISH_PROMPT = [
    "Edit the draft translation as a professional localization editor: improve naturalness, flow, and wording without changing facts or meaning.",
    "Preserve the exact JSON/table structure, and keep all file names, tabs, folders, IDs, URLs, codes, and numbers exactly where they appear.",
    "Fix awkward wording, keep the copy clear and professional for hospitality, and apply terminology rules without changing the original information.",
    "Do not shorten, expand, or add promises or details that are not present in the source.",
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
    if (els.submitBtn) els.submitBtn.textContent = label || "Send";
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
    bot("Paste a Google Sheet or Drive Folder URL / ID.\nI will detect the source type automatically and continue to the next step.");
    setInput("Google Sheet / Drive Folder URL or ID", state.sourceId);
    setPrimaryButton("Continue");
    setOptions([]);
  }

  function askSourceTab() {
    state.step = "sourceTab";
    setStepUi("sourceTab");
    bot("Which tab should be read from the sheet? If you are not sure, leave it empty and I will use automatic detection.");
    setInput("Example: Sheet1, or leave empty", state.sourceTab);
    setPrimaryButton("Continue");
    setOptions([
      { label: "Auto-detect", onClick: () => setSourceTab("") },
    ]);
  }

  function setSourceTab(value) {
    state.sourceTab = value.trim();
    user(state.sourceTab || "Auto-detect");
    renderSummary();
    askLanguages();
  }

  function askLanguages() {
    state.step = "languages";
    setStepUi("languages");
    bot("Which target languages should be translated?\nChoose one or more languages, then use the primary button below.");
    setInput("You can also type: German, Spanish, Hebrew, or de, es, he");
    setPrimaryButton("Continue");
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
      bot("Select at least one target language.");
      return;
    }

    user(state.targetLangs.join(", ").toUpperCase());
    renderSummary();
    askModel();
  }

  function askModel() {
    state.step = "model";
    setStepUi("model");
    bot(`Which model should run?\n${DEFAULT_MODEL} is selected by default. You can simply continue with the primary button below.`);
    setInput("Type another model, or leave empty to continue with o3");
    setPrimaryButton(`Continue with ${state.model}`);
    renderModelOptions();
  }

  function renderModelOptions() {
    setOptions(MODEL_OPTIONS.map((model) => ({
      label: model === DEFAULT_MODEL ? `${model} - recommended` : formatModelLabel(model),
      selected: state.model === model,
      onClick: () => selectModel(model),
    })));
  }

  function formatModelLabel(model) {
    const value = String(model || "");
    if (value === "anthropic:claude-sonnet-4-6") return "Claude Sonnet 4.6";
    return value;
  }

  function selectModel(model) {
    state.model = isDefault(model) ? DEFAULT_MODEL : model.trim() || DEFAULT_MODEL;
    setPrimaryButton(`Continue with ${state.model}`);
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
    bot("Draft instructions\nA strong starter prompt is already in place. You can edit it here or in the right setup panel.");
    setInput("Edit the draft instructions", state.draftPrompt || DEFAULT_CHAT_DRAFT_PROMPT);
    setPrimaryButton("Continue with draft instructions");
    setOptions([
      { label: "No extra draft notes", onClick: () => skipOptional("draftPrompt") },
    ]);
  }

  function askPolishPrompt() {
    state.step = "polishPrompt";
    setStepUi("polishPrompt");
    bot("Polish instructions\nA strong starter prompt is already in place. You can edit it here or in the right setup panel.");
    setInput("Edit the polish instructions", state.polishPrompt || DEFAULT_CHAT_POLISH_PROMPT);
    setPrimaryButton("Continue with polish instructions");
    setOptions([
      { label: "No extra polish notes", onClick: () => skipOptional("polishPrompt") },
    ]);
  }

  function askGlossaryChoice() {
    state.step = "glossaryChoice";
    setStepUi("glossaryChoice");
    bot("Are there terms that must always be translated the same way?\nUse a simple format: source = translation. If not, you can skip this.");
    setInput("Example: Aparthotel = Aparthotel", state.glossaryLines);
    setPrimaryButton("Continue");
    setOptions([
      { label: "Add fixed terms", onClick: askGlossaryLines },
      { label: "Skip fixed terms", onClick: () => skipOptional("glossary") },
    ]);
  }

  function askGlossaryLines() {
    state.step = "glossaryLines";
    setStepUi("glossaryLines");
    user("Add fixed terms");
    bot("Great. Write each rule on a separate line, using this simple format:\nsource = translation");
    setInput("Aparthotel = Aparthotel; Free Wi-Fi = Kostenloses WLAN", state.glossaryLines);
    setPrimaryButton("Continue");
    setOptions([
      { label: "Skip fixed terms", onClick: () => skipOptional("glossary") },
    ]);
  }

  function askTerminologyChoice() {
    state.step = "terminologyChoice";
    setStepUi("terminologyChoice");
    bot("Are there words or phrases the model should avoid?\nUse a simple format: avoid = use instead. If not, you can skip this.");
    setInput("Example: Haus = Hotel | Better hospitality wording", state.terminologyLines);
    setPrimaryButton("Continue");
    setOptions([
      { label: "Add wording rules", onClick: askTerminologyLines },
      { label: "Skip wording rules", onClick: () => skipOptional("terminology") },
    ]);
  }

  function askTerminologyLines() {
    state.step = "terminologyLines";
    setStepUi("terminologyLines");
    user("Add wording rules");
    bot("Write each rule on a separate line:\navoid = use instead\nYou can add a reason after |");
    setInput("Haus = Hotel | Better hospitality wording", state.terminologyLines);
    setPrimaryButton("Continue");
    setOptions([
      { label: "Skip wording rules", onClick: () => skipOptional("terminology") },
    ]);
  }

  function completeFlow() {
    state.step = "complete";
    state.complete = true;
    setStepUi("complete");
    bot("The setup is ready. You can save this work, fill the manual form for editing, or run it now.");
    setInput("Setup ready");
    setPrimaryButton("Fill and open manual editing");
    setOptions([
      { label: "Fill and run now", confirm: true, onClick: () => applyToForm(true) },
      { label: "Restart", onClick: restart },
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
      user("Draft: no extra notes");
      renderSummary();
      askPolishPrompt();
      return;
    }

    if (kind === "polishPrompt") {
      state.polishPrompt = "";
      user("Polish: no extra notes");
      renderSummary();
      askGlossaryChoice();
      return;
    }

    if (kind === "glossary") {
      state.glossaryLines = "";
      user("Skip fixed terms");
      renderSummary();
      askTerminologyChoice();
      return;
    }

    if (kind === "terminology") {
      state.terminologyLines = "";
      user("Skip wording rules");
      renderSummary();
      completeFlow();
    }
  }

  function submitText() {
    const raw = els.input.value.trim();

    if (state.step === "sourceId") {
      const nextSourceId = raw || state.sourceId.trim();
      if (!nextSourceId) {
        bot("A source URL or ID is required to continue.");
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
          bot("I could not detect the languages. Try German, Spanish, Hebrew, or de, es, he.");
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
      user("Draft instructions updated");
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
      user("Polish instructions updated");
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
      ["german", "de"],
      ["deutsch", "de"],
      ["french", "fr"],
      ["francais", "fr"],
      ["français", "fr"],
      ["spanish", "es"],
      ["italian", "it"],
      ["dutch", "nl"],
      ["polish", "pl"],
      ["russian", "ru"],
      ["hebrew", "he"],
      ["chinese", "zh"],
      ["arabic", "ar"],
    ]);

    const valid = new Set(LANGUAGE_OPTIONS.map((item) => item.code));
    const tokens = String(raw || "")
      .split(/[,;\n\s/]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    return tokens
      .map((item) => aliases.get(item) || item)
      .filter((item) => valid.has(item))
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  function isDefault(raw) {
    return /^(default|recommended)$/i.test(String(raw || "").trim());
  }

  function isSkip(raw) {
    return /^(skip|none|no|default|no extra notes)$/i.test(String(raw || "").trim());
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
      bot("The form is still loading. Try again in a moment.");
      return;
    }

    if (!state.sourceId.trim()) {
      bot("I still need a Google Sheet or Drive Folder URL / ID.");
      return;
    }

    if (!state.complete) {
      state.complete = true;
      bot("I filled the form with the information collected so far. Open the manual tab to edit any field before running.");
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
        <div class="chatbot-save-head">
          <span>Saved plans</span>
          <button type="button" class="small-btn primary" id="chatSaveWorkBtn">Save</button>
        </div>
        <input type="text" id="chatWorkspaceName" value="${escapeHtml(state.workName)}" placeholder="Plan name" />
        <select id="chatSavedWorksSelect">
            <option value="">Saved browser workspaces</option>
            ${savedWorks.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <div class="chatbot-save-actions">
          <button type="button" class="small-btn" id="chatLoadWorkBtn">Load</button>
          <button type="button" class="small-btn" id="chatDeleteWorkBtn">Delete</button>
        </div>
        <p class="chatbot-save-note">Browser only. No shared database.</p>
      </div>

      <div class="chatbot-summary-form" dir="auto">
        <label class="summary-edit-field">
          <span>Source</span>
          <select id="chatSummarySourceType">
            <option value="sheet"${state.sourceType === "sheet" ? " selected" : ""}>Google Sheet</option>
            <option value="folder"${state.sourceType === "folder" ? " selected" : ""}>Drive Folder</option>
          </select>
        </label>
        <label class="summary-edit-field">
          <span>URL / ID</span>
          <input type="text" id="chatSummarySourceId" value="${escapeHtml(state.sourceId)}" placeholder="Still missing" />
        </label>
        <label class="summary-edit-field">
          <span>Tab</span>
          <input type="text" id="chatSummarySourceTab" value="${escapeHtml(state.sourceTab)}" placeholder="Auto-detect" />
        </label>
        <label class="summary-edit-field">
          <span>Languages</span>
          <input type="text" id="chatSummaryLangs" value="${escapeHtml(state.targetLangs.join(", "))}" placeholder="de, it, he" />
        </label>
        <label class="summary-edit-field">
          <span>Model</span>
          <input type="text" id="chatSummaryModel" value="${escapeHtml(state.model)}" />
        </label>
        <label class="summary-edit-field">
          <span>Draft</span>
          <textarea id="chatSummaryDraft" rows="4">${escapeHtml(state.draftPrompt)}</textarea>
        </label>
        <label class="summary-edit-field">
          <span>Polish</span>
          <textarea id="chatSummaryPolish" rows="4">${escapeHtml(state.polishPrompt)}</textarea>
        </label>
        <label class="summary-edit-field">
          <span>Fixed terms</span>
          <textarea id="chatSummaryGlossary" rows="2" placeholder="Aparthotel = Aparthotel">${escapeHtml(state.glossaryLines)}</textarea>
        </label>
        <label class="summary-edit-field">
          <span>Wording to avoid</span>
          <textarea id="chatSummaryTerms" rows="2" placeholder="Haus = Hotel | Better wording">${escapeHtml(state.terminologyLines)}</textarea>
        </label>
        <div class="summary-static-note">
          File names, tabs, and IDs are preserved exactly as provided.
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
      if (state.step === "model") setPrimaryButton(`Continue with ${state.model}`);
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
    const name = String(state.workName || "").trim() || `Translation ${new Date().toLocaleString("en-US")}`;
    const id = slugify(name);
    const works = listSavedWorks().filter((item) => item.id !== id);
    works.unshift({ id, name, state: getWorkSnapshot(), updatedAt: new Date().toISOString() });
    writeSavedWorks(works.slice(0, 30));
    state.workName = name;
    renderSummary();
    bot(`Saved "${name}" in this browser.`);
  }

  function loadSavedWork(id) {
    const item = listSavedWorks().find((saved) => saved.id === id);
    if (!item?.state) return;

    Object.assign(state, { ...baseState, ...item.state, workName: item.name || item.state.workName || "" });
    state.targetLangs = Array.isArray(state.targetLangs) ? state.targetLangs : ["de"];
    els.log.innerHTML = "";
    bot(`Loaded "${item.name}". Continuing from the saved point.`);
    renderSummary();
    showCurrentStep();
  }

  function deleteSavedWork(id) {
    const item = listSavedWorks().find((saved) => saved.id === id);
    writeSavedWorks(listSavedWorks().filter((saved) => saved.id !== id));
    renderSummary();
    if (item) bot(`Deleted the saved workspace "${item.name}".`);
  }

  function slugify(value) {
    const base = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
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
