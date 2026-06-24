(() => {
  const CHAT_STORAGE_KEY = "carmelon.faqPlayground.chat.v4";

  const workflowDefaults = {
    hotel: {
      label: "Hotels",
      audience: "Guests before booking, guests before arrival, and in-house guests",
      sources: ["Official website"],
      sourceInstructions: "Use selected sources to discover common questions. Use the official source for factual answers. Mark missing facts as Needs source confirmation."
    },
    service: {
      label: "Product / service",
      audience: "Potential customers comparing products, services, pricing, suitability and next steps.",
      sources: ["Official website", "Public reviews", "Competitors"],
      sourceInstructions: "Use official product/service information for facts. Use reviews and competitors only for question ideas and comparison intent."
    },
    vehicle: {
      label: "Vehicle models",
      audience: "Car buyers comparing models, trims, ownership costs, reliability and day-to-day fit.",
      sources: ["Official website", "Public reviews", "Competitors"],
      sourceInstructions: "Use manufacturer pages and official specifications for facts. Reviews may inform common buyer concerns, but specs and claims must be verified."
    }
  };

  const defaultAnswers = {
    workflowType: "hotel",
    subjects: "",
    globalModel: "o3",
    language: "English (UK)",
    countMode: "target",
    count: "20-30",
    audience: workflowDefaults.hotel.audience,
    officialSourceUrl: "",
    sources: ["Official website"],
    sourceInstructions: workflowDefaults.hotel.sourceInstructions,
    faqDemand: {
      autoMine: true,
      useAnalytics: true,
      useSearchConsole: true,
      range: "90",
      maxPhrases: "5",
      questionsPerPhrase: "1",
      searchConsoleSite: ""
    },
    forbiddenPhrases: "",
    namingPolicy: "natural_exact",
    namingRules: "Do not shorten or translate the name.",
    questionUserNote: "",
    questionTone: "",
    answerUserNote: "",
    answerTone: "",
    qaMode: "duplicates|writing",
    categoryPreset: "hotel",
    categoryTarget: "inherit",
    customCategories: "",
    taskEnabledMap: { 1: true, 2: true, 3: true, 4: false, 5: true },
    grammarOutputMode: "replace_base_tsv",
    taskPrompts: {}
  };

  const promptTasks = [
    { id: 1, label: "Research questions" },
    { id: 2, label: "Write answers" },
    { id: 3, label: "Duplicate check" },
    { id: 4, label: "Source verification" },
    { id: 5, label: "Grammar and answer fit" }
  ];

  const longAnswerSteps = new Set([
    "subjects",
    "customAudience",
    "customSources",
    "forbiddenPhrases",
    "customNaming",
    "customQuestionBrief",
    "customQuestionTone",
    "customAnswerBrief",
    "customAnswerTone",
    "customCategories",
    "taskPrompt"
  ]);

  const steps = {
    workflowType: {
      question: "Choose the workflow type. This updates the builder presets for categories, audience, source rules and task guidance.",
      replies: [
        { label: "Hotels", value: "hotel" },
        { label: "Product / service", value: "service" },
        { label: "Vehicle models", value: "vehicle" }
      ]
    },
    subjects: {
      question: "Add the topics to run. Use one topic per line when each one should run as a separate job.",
      placeholder: "Leonardo Royal Berlin\nToyota Corolla Hybrid\nSmall business CRM"
    },
    globalModel: {
      question: "Choose the main model for the workflow.",
      replies: [
        { label: "o3 - balanced", value: "o3" },
        { label: "gpt-5.5 - deep", value: "gpt-5.5" },
        { label: "gpt-5.4 - strong", value: "gpt-5.4" },
        { label: "gpt-5.4-mini - quick", value: "gpt-5.4-mini" },
        { label: "Claude Sonnet 4.6", value: "anthropic:claude-sonnet-4-6" }
      ]
    },
    language: {
      question: "Which language should the final output use?",
      replies: [
        { label: "English UK", value: "English (UK)" },
        { label: "English US", value: "English (US)" },
        { label: "English", value: "English" },
        { label: "Hebrew", value: "Hebrew" },
        { label: "German", value: "German" },
        { label: "French", value: "French" },
        { label: "Spanish", value: "Spanish" }
      ]
    },
    count: {
      question: "Choose the FAQ size. The agent can still return fewer questions if the source material is thin.",
      replies: [
        { label: "Lean: 10-15", value: "target:10-15" },
        { label: "Standard: 20-30", value: "target:20-30" },
        { label: "Deep: 30-45", value: "target:30-45" },
        { label: "Full: 45-60", value: "target:45-60" },
        { label: "As many as found", value: "as_found" },
        { label: "No fixed target", value: "quality_first" }
      ]
    },
    audience: {
      question: "Who should the FAQ serve? Select all that apply.",
      multi: true,
      doneLabel: "Use selected audience",
      replies: [
        { label: "Before booking / buying", value: "People comparing options before booking or buying." },
        { label: "Before arrival / setup", value: "People preparing before arrival, setup or first use." },
        { label: "Current users / guests", value: "Current users, guests or customers looking for practical support." },
        { label: "Comparison shoppers", value: "People comparing alternatives, pricing, trust signals and next steps." },
        { label: "Add custom audience", value: "custom_audience" }
      ]
    },
    customAudience: {
      question: "Add any custom audience details. You can write more than one line.",
      placeholder: "Example: Families comparing compact SUV models before a lease or purchase.\nExample: Returning guests looking for arrival and parking details."
    },
    officialSourceUrl: {
      question: "Add the official website URL. This is the source of truth for names, facts and factual answer verification.",
      placeholder: "https://www.example.com/",
      replies: [
        { label: "Add later", value: "__skip_official_url" }
      ]
    },
    sources: {
      question: "Which research sources may help discover FAQ intent? Select all that apply.",
      multi: true,
      doneLabel: "Use selected sources",
      replies: [
        { label: "Official website", value: "Official website" },
        { label: "Google Business Profile", value: "Google Business Profile" },
        { label: "OTAs", value: "OTAs" },
        { label: "Public reviews", value: "Public reviews" },
        { label: "Competitors", value: "Competitors" },
        { label: "Custom source rules", value: "custom_sources" }
      ]
    },
    customSources: {
      question: "Add source policy details. Keep factual-answer sources and intent-discovery sources separate.",
      placeholder: "Example: Official website is the only factual source. Reviews may be used only for question ideas."
    },
    faqDemandMode: {
      question: "How should the builder use GA4/Search Console demand signals?",
      replies: [
        { label: "Auto mine during run", value: "auto" },
        { label: "Manual review only", value: "manual" },
        { label: "Do not use search demand", value: "off" }
      ]
    },
    faqDemandSources: {
      question: "Which demand sources should be enabled? Select all that apply.",
      multi: true,
      doneLabel: "Use demand sources",
      replies: [
        { label: "Google Analytics", value: "analytics" },
        { label: "Search Console", value: "search_console" }
      ]
    },
    faqDemandRange: {
      question: "Choose the demand signal date range.",
      replies: [
        { label: "Last 30 days", value: "30" },
        { label: "Last 90 days", value: "90" },
        { label: "Last 180 days", value: "180" }
      ]
    },
    faqDemandVolume: {
      question: "How many demand signals should the helper use per subject?",
      replies: [
        { label: "Top 5 · 1 question each", value: "5:1" },
        { label: "Top 10 · 1 question each", value: "10:1" },
        { label: "Top 10 · 2 questions each", value: "10:2" },
        { label: "Top 15 · 2 questions each", value: "15:2" },
        { label: "Top 15 · 3 questions each", value: "15:3" }
      ]
    },
    searchConsoleSite: {
      question: "If you know the exact Search Console property, paste it here. Otherwise use the official URL fallback or choose it later in the editor.",
      placeholder: "https://www.example.com/ or sc-domain:example.com",
      replies: [
        { label: "Use official URL fallback", value: "__use_official_url_for_sc" },
        { label: "Choose later in editor", value: "__choose_sc_later" }
      ]
    },
    forbiddenPhrases: {
      question: "Add words or phrases to avoid across questions, answers and final polish. Use one per line, or skip.",
      placeholder: "cheap\nluxury\nbest in class",
      replies: [
        { label: "No words to avoid", value: "__no_forbidden_phrases" }
      ]
    },
    naming: {
      question: "How should the subject name appear in generated questions and answers?",
      replies: [
        { label: "Exact name, natural use", value: "natural_exact" },
        { label: "Light mentions", value: "light" },
        { label: "Strict exact-name usage", value: "strict" },
        { label: "Custom naming rule", value: "custom" }
      ]
    },
    customNaming: {
      question: "Write the naming rule. One clear sentence is enough.",
      placeholder: "Example: Use the exact name only when it sounds natural and clear."
    },
    questionBrief: {
      question: "What should guide question selection? Select all that apply.",
      multi: true,
      doneLabel: "Use selected question focus",
      exclusiveValues: ["none"],
      replies: [
        { label: "No extra focus", value: "none" },
        { label: "Pre-booking / pre-buying", value: "Focus on practical pre-booking, pre-buying and comparison questions." },
        { label: "Pain points", value: "Prioritize real doubts, objections, unclear policies and decision blockers." },
        { label: "SEO / AI readiness", value: "Prioritize entity clarity, answerability and questions that help search and AI systems understand the page." },
        { label: "Support reduction", value: "Prioritize questions that reduce repeated support or sales questions." },
        { label: "Add custom focus", value: "custom_question_brief" }
      ]
    },
    customQuestionBrief: {
      question: "Add custom question-selection guidance. You can write more than one line.",
      placeholder: "Example: Focus on questions that reduce repeated support requests."
    },
    questionTone: {
      question: "Choose the question wording style.",
      replies: [
        { label: "Clear and practical", value: "Use a clear, practical and non-promotional tone when selecting questions." },
        { label: "User-friendly", value: "Use a helpful, human and user-first tone. Prefer natural customer wording." },
        { label: "SEO / AI focused", value: "Prioritize entity clarity, answerability and questions that help search and AI systems understand the page." },
        { label: "Custom question tone", value: "custom_question_tone" }
      ]
    },
    customQuestionTone: {
      question: "Write the question tone rule.",
      placeholder: "Example: Natural customer questions, without marketing wording."
    },
    answerBrief: {
      question: "What answer rules should be applied? Select all that apply.",
      multi: true,
      doneLabel: "Use selected answer rules",
      exclusiveValues: ["none"],
      replies: [
        { label: "No extra rules", value: "none" },
        { label: "Short and practical", value: "Keep answers short, useful and easy to scan. Avoid filler." },
        { label: "Verified facts only", value: "Do not invent facts. If a fact is not confirmed, mark it clearly as Needs source confirmation." },
        { label: "Helpful, not salesy", value: "Write helpful service-oriented answers without marketing exaggeration or unsupported promises." },
        { label: "Add custom rule", value: "custom_answer_brief" }
      ]
    },
    customAnswerBrief: {
      question: "Add custom answer guidance. You can write more than one line.",
      placeholder: "Example: Answers up to two sentences, with no promises that are not on the website."
    },
    answerTone: {
      question: "Choose the answer writing style.",
      replies: [
        { label: "Reliable and concise", value: "Write in a reliable, concise and source-grounded tone." },
        { label: "Warm and service-minded", value: "Write in a warm, helpful and guest-friendly tone without becoming promotional." },
        { label: "Professional and direct", value: "Write in a precise, professional and direct tone. Prioritize clarity over marketing." },
        { label: "Custom answer tone", value: "custom_answer_tone" }
      ]
    },
    customAnswerTone: {
      question: "Write the answer tone rule.",
      placeholder: "Example: Helpful but not promotional, with short and precise answers."
    },
    qaChecks: {
      question: "Which quality checks should run? Select all that apply.",
      multi: true,
      doneLabel: "Use selected checks",
      exclusiveValues: ["no_qa"],
      replies: [
        { label: "Duplicate check", value: "duplicates" },
        { label: "Source verification", value: "sources" },
        { label: "Grammar and answer fit", value: "writing" },
        { label: "No QA checks", value: "no_qa" }
      ]
    },
    categories: {
      question: "How should question categories be set?",
      replies: [
        { label: "Use workflow preset", value: "workflow" },
        { label: "Basic and short", value: "basic" },
        { label: "Custom categories", value: "custom_categories" },
        { label: "Leave for editor", value: "manual" }
      ]
    },
    categoryTarget: {
      question: "Should the same question range be applied to all categories?",
      replies: [
        { label: "Keep category defaults", value: "inherit" },
        { label: "2-4 per category", value: "2-4" },
        { label: "3-5 per category", value: "3-5" },
        { label: "4-6 per category", value: "4-6" },
        { label: "As many as found", value: "as_found" },
        { label: "Quality first", value: "quality_first" }
      ]
    },
    customCategories: {
      question: "Write custom category names, one per line. You can add details after a dash.",
      placeholder: "General information - who it suits, what to know\nBooking and payment - price, cancellation, deposit\nLocation - parking, transport, neighborhood"
    },
    taskRun: {
      question: "Which workflow tasks should be active? Select all that apply.",
      multi: true,
      doneLabel: "Use selected workflow tasks",
      replies: [
        { label: "Research questions", value: "1" },
        { label: "Write answers", value: "2" },
        { label: "Duplicate check", value: "3" },
        { label: "Source verification", value: "4" },
        { label: "Grammar and answer fit", value: "5" }
      ]
    },
    grammarOutputMode: {
      question: "How should the final grammar/answer-fit task return its result?",
      replies: [
        { label: "Apply polish to final sheet", value: "replace_base_tsv" },
        { label: "Add review column", value: "append_column" }
      ]
    },
    promptEditOffer: {
      question: "Do you want to edit full task prompts now? Most users should keep the generated workflow guidance and refine prompts later only if needed.",
      replies: [
        { label: "Keep prompts as configured", value: "skip_prompts" },
        { label: "Edit selected task prompts", value: "edit_prompts" }
      ]
    },
    promptTasks: {
      question: "Select task prompts to replace. This is advanced and replaces the main prompt for each selected task.",
      multi: true,
      doneLabel: "Edit selected prompts",
      exclusiveValues: ["skip_prompts"],
      replies: [
        { label: "Research questions", value: "task:1" },
        { label: "Write answers", value: "task:2" },
        { label: "Duplicate check", value: "task:3" },
        { label: "Source verification", value: "task:4" },
        { label: "Grammar and answer fit", value: "task:5" },
        { label: "Skip prompt editing", value: "skip_prompts" }
      ]
    },
    taskPrompt: {
      question: "Paste the replacement prompt for this task. Type keep to leave it unchanged.",
      placeholder: "Paste the full task prompt here, or type keep."
    }
  };

  const state = loadChatState();

  function cloneDefaultAnswers() {
    return {
      ...defaultAnswers,
      sources: [...defaultAnswers.sources],
      faqDemand: { ...defaultAnswers.faqDemand },
      taskEnabledMap: { ...defaultAnswers.taskEnabledMap },
      taskPrompts: {}
    };
  }

  function normalizeAnswers(saved = {}) {
    const workflowType = ["hotel", "service", "vehicle"].includes(saved.workflowType || saved.scope)
      ? (saved.workflowType || saved.scope)
      : "hotel";
    const base = cloneDefaultAnswers();
    const demand = saved.faqDemand && typeof saved.faqDemand === "object" ? saved.faqDemand : {};
    return {
      ...base,
      ...saved,
      workflowType,
      categoryPreset: saved.categoryPreset === "workflow" ? workflowType : (saved.categoryPreset || workflowType),
      sources: Array.isArray(saved.sources) && saved.sources.length ? saved.sources : [...(workflowDefaults[workflowType]?.sources || base.sources)],
      sourceInstructions: saved.sourceInstructions || workflowDefaults[workflowType]?.sourceInstructions || base.sourceInstructions,
      faqDemand: {
        ...base.faqDemand,
        ...demand
      },
      taskEnabledMap: {
        ...base.taskEnabledMap,
        ...(saved.taskEnabledMap || {})
      },
      taskPrompts: saved.taskPrompts && typeof saved.taskPrompts === "object" ? saved.taskPrompts : {}
    };
  }

  function loadChatState() {
    try {
      const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "{}");
      return {
        step: saved.step || "workflowType",
        answers: normalizeAnswers(saved.answers || {}),
        transcript: Array.isArray(saved.transcript) ? saved.transcript : [],
        promptQueue: Array.isArray(saved.promptQueue) ? saved.promptQueue : [],
        promptIndex: Number.isFinite(saved.promptIndex) ? saved.promptIndex : 0,
        pendingAudienceParts: Array.isArray(saved.pendingAudienceParts) ? saved.pendingAudienceParts : [],
        pendingQuestionBriefParts: Array.isArray(saved.pendingQuestionBriefParts) ? saved.pendingQuestionBriefParts : [],
        pendingAnswerBriefParts: Array.isArray(saved.pendingAnswerBriefParts) ? saved.pendingAnswerBriefParts : []
      };
    } catch {
      return { step: "workflowType", answers: cloneDefaultAnswers(), transcript: [] };
    }
  }

  function saveChatState() {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  }

  function init() {
    const bridge = window.faqBuilderBridge;
    if (!bridge) return;

    const $ = bridge.$;
    const log = $("faqChatLog");
    const quick = $("faqChatQuickReplies");
    const form = $("faqChatForm");
    const input = $("faqChatInput");
    const sendButton = $("faqChatSendBtn");
    const summary = $("faqChatSummary");

    if (!log || !quick || !form || !input || !sendButton || !summary) return;

    let activeMultiSelection = new Set();
    let activeMultiReplies = [];

    function addMessage(role, text, persist = true) {
      const item = document.createElement("div");
      item.className = `chat-message ${role}`;
      item.dir = "auto";
      item.textContent = text;
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;

      if (persist) {
        state.transcript.push({ role, text });
        state.transcript = state.transcript.slice(-100);
        saveChatState();
      }
    }

    function bot(text) {
      addMessage("bot", text);
    }

    function user(text) {
      addMessage("user", text);
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function compactLines(value) {
      return String(value || "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function key(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function selectedValuesFromText(value, replies = []) {
      const raw = String(value || "").trim();
      if (!raw) return [];
      const tokens = raw.includes("|")
        ? raw.split("|")
        : raw.split(/\n|,|;/);
      return tokens
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => {
          const tokenKey = key(token);
          const exact = replies.find((reply) => key(reply.value) === tokenKey || key(reply.label) === tokenKey);
          if (exact) return exact.value;
          const partial = replies.find((reply) => {
            const valueKey = key(reply.value);
            const labelKey = key(reply.label);
            return tokenKey && (valueKey.includes(tokenKey) || labelKey.includes(tokenKey) || tokenKey.includes(valueKey) || tokenKey.includes(labelKey));
          });
          return partial?.value || token;
        });
    }

    function selectedLabel(replies, selectedValues) {
      if (!selectedValues.length) return "No selection";
      return selectedValues.map((value) => {
        const match = replies.find((reply) => reply.value === value);
        return match?.label || value;
      }).join(", ");
    }

    function orderedSelectedValues(replies, selectedSet) {
      return (replies || [])
        .map((reply) => reply.value)
        .filter((value) => selectedSet.has(value));
    }

    function initialBriefSelection(stepName, answerValue, emptyValue) {
      const clean = String(answerValue || "").trim();
      if (!clean) return new Set([emptyValue]);
      const step = steps[stepName] || {};
      const exclusive = new Set(step.exclusiveValues || []);
      const selected = new Set();
      (step.replies || []).forEach((reply) => {
        if (!reply.value || exclusive.has(reply.value) || String(reply.value).startsWith("custom_")) return;
        if (clean.includes(reply.value)) selected.add(reply.value);
      });
      return selected.size ? selected : new Set();
    }

    function selectedDemandSources() {
      const demand = state.answers.faqDemand || {};
      const selected = [];
      if (demand.useAnalytics !== false) selected.push("analytics");
      if (demand.useSearchConsole !== false) selected.push("search_console");
      return selected;
    }

    function initialTaskSelection() {
      const map = state.answers.taskEnabledMap || {};
      return new Set(promptTasks
        .filter((task) => map[task.id] === true || map[String(task.id)] === true)
        .map((task) => String(task.id)));
    }

    function initialMultiSelection(stepName) {
      if (stepName === "audience") {
        return initialBriefSelection("audience", state.answers.audience, "");
      }
      if (stepName === "sources") {
        return new Set(state.answers.sources || ["Official website"]);
      }
      if (stepName === "faqDemandSources") {
        return new Set(selectedDemandSources());
      }
      if (stepName === "questionBrief") {
        return initialBriefSelection("questionBrief", state.answers.questionUserNote, "none");
      }
      if (stepName === "answerBrief") {
        return initialBriefSelection("answerBrief", state.answers.answerUserNote, "none");
      }
      if (stepName === "qaChecks") {
        if (state.answers.qaMode === "no_qa") return new Set(["no_qa"]);
        return new Set(String(state.answers.qaMode || "duplicates|writing").split("|").filter(Boolean));
      }
      if (stepName === "taskRun") {
        return initialTaskSelection();
      }
      if (stepName === "promptTasks") {
        const editedTaskIds = Object.keys(state.answers.taskPrompts || {})
          .map((taskId) => `task:${taskId}`)
          .filter((taskId) => steps.promptTasks.replies.some((reply) => reply.value === taskId));
        return new Set(editedTaskIds.length ? editedTaskIds : ["skip_prompts"]);
      }
      return new Set();
    }

    function updateComposerForStep(stepName, step = {}) {
      const isMulti = Boolean(step.multi);
      const isLongAnswer = longAnswerSteps.has(stepName);
      form.classList.toggle("is-multi-select", isMulti);
      input.classList.toggle("is-long-answer", isLongAnswer);
      input.rows = isLongAnswer ? 3 : 1;
      sendButton.textContent = isMulti ? (step.doneLabel || "Continue") : "Send";
    }

    function submitActiveMultiSelection() {
      const step = steps[state.step] || {};
      if (!step.multi) return false;
      const selected = orderedSelectedValues(activeMultiReplies, activeMultiSelection);
      handleAnswer(selected.join("|"), selectedLabel(activeMultiReplies, selected));
      return true;
    }

    function setReplies(replies = []) {
      quick.innerHTML = "";
      const step = steps[state.step] || {};
      activeMultiReplies = replies;
      activeMultiSelection = step.multi ? initialMultiSelection(state.step) : new Set();
      updateComposerForStep(state.step, step);

      function refreshMultiButtons() {
        quick.querySelectorAll("[data-chat-value]").forEach((button) => {
          button.classList.toggle("is-selected", activeMultiSelection.has(button.dataset.chatValue));
        });
      }

      replies.forEach((reply) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-reply";
        button.textContent = reply.label;
        button.dataset.chatValue = reply.value;
        button.addEventListener("click", () => {
          if (["__open_builder", "__save_plan", "__restart"].includes(String(reply.value))) return;
          if (step.multi) {
            const exclusive = new Set(step.exclusiveValues || []);
            if (exclusive.has(reply.value)) {
              activeMultiSelection.clear();
              activeMultiSelection.add(reply.value);
            } else {
              exclusive.forEach((value) => activeMultiSelection.delete(value));
              if (activeMultiSelection.has(reply.value)) {
                activeMultiSelection.delete(reply.value);
              } else {
                activeMultiSelection.add(reply.value);
              }
            }
            refreshMultiButtons();
            return;
          }
          handleAnswer(reply.value, reply.label);
        });
        quick.appendChild(button);
      });
      refreshMultiButtons();
    }

    function presetLabel(value) {
      return {
        hotel: "Hotels",
        service: "Product / service",
        vehicle: "Vehicle models",
        basic: "Basic and short",
        custom_categories: "Custom categories",
        manual: "Manual editing"
      }[value] || value || "Hotels";
    }

    function targetLabel() {
      if (state.answers.countMode === "as_found") return "As many as found";
      if (state.answers.countMode === "quality_first") return "No fixed target";
      return state.answers.count || "20-30";
    }

    function demandLabel() {
      const demand = state.answers.faqDemand || {};
      if (!demand.autoMine && !demand.useAnalytics && !demand.useSearchConsole) return "Off";
      const mode = demand.autoMine ? "Auto mine" : "Manual";
      const sources = [
        demand.useAnalytics !== false ? "GA4" : "",
        demand.useSearchConsole !== false ? "Search Console" : ""
      ].filter(Boolean).join(" + ") || "No sources";
      return `${mode} · ${sources}`;
    }

    function renderSummary() {
      const sources = Array.isArray(state.answers.sources) ? state.answers.sources.join(", ") : "Official website";
      const tasks = Object.entries(state.answers.taskEnabledMap || {})
        .filter(([, enabled]) => enabled === true)
        .map(([id]) => `#${id}`)
        .join(", ") || "None";

      summary.innerHTML = [
        ["Workflow", presetLabel(state.answers.workflowType)],
        ["Subjects", state.answers.subjects || "Not set yet"],
        ["Model", modelLabel(state.answers.globalModel)],
        ["Language", state.answers.language],
        ["FAQ size", targetLabel()],
        ["Audience", state.answers.audience || "Not set yet"],
        ["Official URL", state.answers.officialSourceUrl || "Not set"],
        ["Sources", sources || "Official website"],
        ["Search demand", demandLabel()],
        ["Words to avoid", state.answers.forbiddenPhrases ? `${compactLines(state.answers.forbiddenPhrases).length} item(s)` : "None"],
        ["Categories", state.answers.customCategories ? "Custom" : presetLabel(state.answers.categoryPreset)],
        ["Tasks", tasks]
      ].map(([label, value]) => `
        <div class="chat-summary-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join("");
    }

    function modelLabel(value) {
      return {
        o3: "o3",
        "gpt-5.5": "gpt-5.5",
        "gpt-5.4": "gpt-5.4",
        "gpt-5.4-mini": "gpt-5.4-mini",
        "anthropic:claude-sonnet-4-6": "Claude Sonnet 4.6"
      }[value] || value || "o3";
    }

    function qaGuidance(value) {
      const checks = new Set(String(value || "").split("|").filter(Boolean));
      if (value === "no_qa") return "";
      const lines = [];
      if (checks.has("duplicates")) lines.push("Check duplicate and near-duplicate questions while preserving row order.");
      if (checks.has("sources")) lines.push("Flag unsupported facts, uncertain claims, missing source evidence and rows that need verification.");
      if (checks.has("writing")) lines.push("Check answer-question fit, grammar, syntax, clarity, usefulness and overly promotional wording.");
      return lines.join(" ") || "Check duplicate questions, answer-question match, grammar, syntax, clarity and overly promotional wording. Keep findings short and actionable.";
    }

    function qaTaskMap(value) {
      const checks = new Set(String(value || "").split("|").filter(Boolean));
      if (value === "no_qa") return { 3: false, 4: false, 5: false };
      return {
        3: checks.has("duplicates"),
        4: checks.has("sources"),
        5: checks.has("writing")
      };
    }

    function taskEnabledMapFromQa(value) {
      return {
        ...state.answers.taskEnabledMap,
        ...qaTaskMap(value)
      };
    }

    function sourcePreset(sources) {
      const selected = Array.isArray(sources) && sources.length ? sources.filter((item) => item !== "custom_sources") : ["Official website"];
      const secondary = selected.filter((source) => source !== "Official website");
      const instructions = secondary.length
        ? `Use the official website as the primary factual source. Use ${secondary.join(", ")} to discover common question demand and pain points. Do not invent facts. Any answer not confirmed by an official source should be marked as Needs source confirmation.`
        : "Use the official website as the primary source. If a fact is missing, mark it as Needs source confirmation.";
      return { sources: selected.length ? selected : ["Official website"], instructions };
    }

    function setValue(id, value) {
      const element = $(id);
      if (element) element.value = value ?? "";
    }

    function setCheckbox(id, checked) {
      const element = $(id);
      if (element) element.checked = checked === true;
    }

    function setSelectValue(id, value, options = {}) {
      const element = $(id);
      if (!element) return;
      const clean = String(value || "");
      if (!clean) {
        element.value = "";
        return;
      }
      const exists = Array.from(element.options || []).some((option) => option.value === clean);
      if (!exists && options.allowCreate) {
        const option = document.createElement("option");
        option.value = clean;
        option.textContent = clean;
        element.appendChild(option);
      }
      element.value = clean;
    }

    function applyQuestionTarget() {
      const mode = state.answers.countMode;
      const count = state.answers.count || "20-30";
      setValue("questionCountMode", mode);
      setValue("questionCount", count);
      if ($("questionRangePreset") && mode === "target") {
        setSelectValue("questionRangePreset", count);
      }
    }

    function applyFaqDemandSettings() {
      const demand = state.answers.faqDemand || {};
      ["faqDemandAutoRun", "faqDemandAutoRunQuick"].forEach((id) => setCheckbox(id, demand.autoMine === true));
      setCheckbox("faqDemandUseAnalytics", demand.useAnalytics === true);
      setCheckbox("faqDemandUseSearchConsole", demand.useSearchConsole === true);
      setSelectValue("faqDemandRange", demand.range || "90");
      setSelectValue("faqDemandMaxPhrases", String(demand.maxPhrases || "5"));
      setSelectValue("faqDemandQuestionsPerPhrase", String(demand.questionsPerPhrase || "1"));
      if (demand.searchConsoleSite) {
        setSelectValue("faqDemandSearchSite", demand.searchConsoleSite, { allowCreate: true });
      }
    }

    function applyTaskSettings() {
      bridge.setTasksEnabled(state.answers.taskEnabledMap);
      setSelectValue("output-mode-5", state.answers.grammarOutputMode || "replace_base_tsv");
    }

    function applyAnswersToBuilder() {
      const answers = state.answers;
      bridge.setActivePreset(answers.workflowType, true, { updateFields: false });

      setValue("subjects", answers.subjects);
      setSelectValue("globalModel", answers.globalModel || "o3");
      setSelectValue("outputLanguage", answers.language || "English (UK)");
      applyQuestionTarget();
      setValue("audience", answers.audience || workflowDefaults[answers.workflowType]?.audience || workflowDefaults.hotel.audience);
      setValue("officialSourceUrl", answers.officialSourceUrl || "");
      setValue("sourceInstructions", answers.sourceInstructions || workflowDefaults[answers.workflowType]?.sourceInstructions || workflowDefaults.hotel.sourceInstructions);
      setValue("forbiddenPhrases", answers.forbiddenPhrases || "");
      setValue("namingPolicy", answers.namingPolicy || "natural_exact");
      setValue("namingRules", answers.namingRules || "Do not shorten or translate the name.");
      bridge.applySourceOptions(answers.sources);
      applyFaqDemandSettings();

      if (answers.customCategories) {
        bridge.applyCustomCategories(answers.customCategories);
      } else if (answers.categoryPreset === "basic") {
        bridge.setCategoriesEnabled(["general", "booking", "checkin", "location"]);
      } else if (answers.categoryPreset !== "manual") {
        bridge.setActivePreset(answers.categoryPreset || answers.workflowType, true, { updateFields: false });
      }

      if (answers.categoryTarget && answers.categoryTarget !== "inherit") {
        bridge.setCategoryTarget(answers.categoryTarget);
      }

      bridge.applyChatPromptGuidance({
        questionUserNote: answers.questionUserNote,
        questionTone: answers.questionTone,
        answerUserNote: answers.answerUserNote,
        answerTone: answers.answerTone,
        qaChecks: qaGuidance(answers.qaMode)
      });

      applyTaskSettings();
      bridge.applyChatTaskPrompts?.(answers.taskPrompts);
      bridge.updateSummary();
      bridge.saveState();
    }

    function syncAnswersFromBuilder() {
      const builderState = bridge.collectState?.();
      if (!builderState) return;
      const controls = builderState.controls || {};
      const demand = controls.faqDemand || {};
      const tasks = Array.isArray(builderState.tasks) ? builderState.tasks : [];
      state.answers = normalizeAnswers({
        ...state.answers,
        workflowType: controls.preset || state.answers.workflowType,
        categoryPreset: controls.preset || state.answers.categoryPreset,
        subjects: builderState.subjects || state.answers.subjects,
        globalModel: controls.globalModel || state.answers.globalModel,
        language: controls.outputLanguage || state.answers.language,
        countMode: controls.questionCountMode || state.answers.countMode,
        count: controls.questionCount || state.answers.count,
        audience: controls.audience || state.answers.audience,
        officialSourceUrl: controls.officialSourceUrl || "",
        sources: Array.isArray(controls.sourceOptions) && controls.sourceOptions.length ? controls.sourceOptions : state.answers.sources,
        sourceInstructions: controls.sourceInstructions || state.answers.sourceInstructions,
        forbiddenPhrases: controls.forbiddenPhrases || "",
        namingPolicy: controls.namingPolicy || state.answers.namingPolicy,
        namingRules: controls.namingRules || state.answers.namingRules,
        faqDemand: {
          autoMine: demand.enabled === true,
          useAnalytics: demand.analytics?.enabled !== false,
          useSearchConsole: demand.searchConsole?.enabled !== false,
          range: $("faqDemandRange")?.value || state.answers.faqDemand.range,
          maxPhrases: String(demand.maxPhrases || state.answers.faqDemand.maxPhrases),
          questionsPerPhrase: String(demand.questionsPerPhrase || state.answers.faqDemand.questionsPerPhrase),
          searchConsoleSite: demand.searchConsole?.siteUrl || ""
        },
        taskEnabledMap: Object.fromEntries(tasks.map((task) => [task.id, task.enabled === true])),
        grammarOutputMode: $("output-mode-5")?.value || state.answers.grammarOutputMode
      });
      saveChatState();
    }

    function showStep(stepName, shouldAsk = true) {
      state.step = stepName;
      saveChatState();
      const step = steps[stepName];
      if (!step) return finish();
      if (stepName === "taskPrompt") {
        const taskId = state.promptQueue?.[state.promptIndex || 0];
        const task = promptTasks.find((item) => item.id === Number(taskId));
        input.placeholder = step.placeholder || "Paste the full task prompt here, or type keep.";
        setReplies([{ label: "Keep unchanged", value: "keep" }]);
        if (shouldAsk) bot(`Main prompt for #${task?.id || taskId} ${task?.label || "this task"}: paste the replacement prompt, or type keep.`);
        renderSummary();
        return;
      }
      input.placeholder = step.multi
        ? (step.placeholder || "Select one or more options, then press Send.")
        : (step.placeholder || "Type a short answer...");
      setReplies(step.replies || []);
      if (shouldAsk) bot(step.question);
      renderSummary();
    }

    function nextAfterDemandMode() {
      const demand = state.answers.faqDemand || {};
      if (!demand.autoMine && !demand.useAnalytics && !demand.useSearchConsole) return "forbiddenPhrases";
      return "faqDemandSources";
    }

    function nextAfterDemandSources() {
      const demand = state.answers.faqDemand || {};
      if (!demand.useAnalytics && !demand.useSearchConsole) return "forbiddenPhrases";
      return "faqDemandRange";
    }

    function nextAfterDemandVolume() {
      return state.answers.faqDemand?.useSearchConsole ? "searchConsoleSite" : "forbiddenPhrases";
    }

    function nextAfterCategories() {
      return state.answers.categoryPreset === "custom_categories" ? "customCategories" : "categoryTarget";
    }

    function nextAfterTaskRun() {
      return state.answers.taskEnabledMap?.[5] === true || state.answers.taskEnabledMap?.["5"] === true
        ? "grammarOutputMode"
        : "promptEditOffer";
    }

    function handleAnswer(value, label = value) {
      const currentStep = state.step;
      const step = steps[currentStep] || {};
      const text = String(value || "").trim();
      if (!text) return;

      user(label || text);

      if (currentStep === "workflowType") {
        const workflowType = ["hotel", "service", "vehicle"].includes(text) ? text : "hotel";
        const defaults = workflowDefaults[workflowType] || workflowDefaults.hotel;
        state.answers.workflowType = workflowType;
        state.answers.categoryPreset = workflowType;
        state.answers.audience = defaults.audience;
        state.answers.sources = [...defaults.sources];
        state.answers.sourceInstructions = defaults.sourceInstructions;
        applyAnswersToBuilder();
        return showStep("subjects");
      }

      if (currentStep === "subjects") {
        state.answers.subjects = compactLines(text).join("\n") || text;
        applyAnswersToBuilder();
        return showStep("globalModel");
      }

      if (currentStep === "globalModel") {
        state.answers.globalModel = text;
        applyAnswersToBuilder();
        return showStep("language");
      }

      if (currentStep === "language") {
        state.answers.language = text;
        applyAnswersToBuilder();
        return showStep("count");
      }

      if (currentStep === "count") {
        if (text.startsWith("target:")) {
          state.answers.countMode = "target";
          state.answers.count = text.split(":")[1] || "20-30";
        } else if (/^\d+$/.test(text) || /^\d+-\d+$/.test(text)) {
          state.answers.countMode = "target";
          state.answers.count = text;
        } else {
          state.answers.countMode = text === "as_found" ? "as_found" : "quality_first";
          state.answers.count = text;
        }
        applyAnswersToBuilder();
        return showStep("audience");
      }

      if (currentStep === "audience") {
        const selected = selectedValuesFromText(text, step.replies);
        if (selected.includes("custom_audience")) {
          state.pendingAudienceParts = selected.filter((item) => item !== "custom_audience");
          return showStep("customAudience");
        }
        state.pendingAudienceParts = [];
        state.answers.audience = selected.length ? selected.join(" ") : text;
        applyAnswersToBuilder();
        return showStep("officialSourceUrl");
      }

      if (currentStep === "customAudience") {
        state.answers.audience = [...(state.pendingAudienceParts || []), text].filter(Boolean).join(" ");
        state.pendingAudienceParts = [];
        applyAnswersToBuilder();
        return showStep("officialSourceUrl");
      }

      if (currentStep === "officialSourceUrl") {
        state.answers.officialSourceUrl = text === "__skip_official_url" ? "" : text;
        applyAnswersToBuilder();
        return showStep("sources");
      }

      if (currentStep === "sources") {
        const selected = selectedValuesFromText(text, step.replies);
        const hasCustomSources = selected.includes("custom_sources");
        const preset = sourcePreset(selected);
        state.answers.sources = preset.sources;
        state.answers.sourceInstructions = preset.instructions;
        applyAnswersToBuilder();
        if (hasCustomSources) return showStep("customSources");
        return showStep("faqDemandMode");
      }

      if (currentStep === "customSources") {
        state.answers.sourceInstructions = text;
        applyAnswersToBuilder();
        return showStep("faqDemandMode");
      }

      if (currentStep === "faqDemandMode") {
        if (text === "off") {
          state.answers.faqDemand = {
            ...state.answers.faqDemand,
            autoMine: false,
            useAnalytics: false,
            useSearchConsole: false
          };
        } else {
          state.answers.faqDemand = {
            ...state.answers.faqDemand,
            autoMine: text === "auto",
            useAnalytics: state.answers.faqDemand.useAnalytics !== false,
            useSearchConsole: state.answers.faqDemand.useSearchConsole !== false
          };
        }
        applyAnswersToBuilder();
        return showStep(nextAfterDemandMode());
      }

      if (currentStep === "faqDemandSources") {
        const selected = selectedValuesFromText(text, step.replies);
        state.answers.faqDemand = {
          ...state.answers.faqDemand,
          useAnalytics: selected.includes("analytics"),
          useSearchConsole: selected.includes("search_console")
        };
        applyAnswersToBuilder();
        return showStep(nextAfterDemandSources());
      }

      if (currentStep === "faqDemandRange") {
        state.answers.faqDemand = {
          ...state.answers.faqDemand,
          range: text
        };
        applyAnswersToBuilder();
        return showStep("faqDemandVolume");
      }

      if (currentStep === "faqDemandVolume") {
        const [maxPhrases, questionsPerPhrase] = text.split(":");
        state.answers.faqDemand = {
          ...state.answers.faqDemand,
          maxPhrases: maxPhrases || "5",
          questionsPerPhrase: questionsPerPhrase || "1"
        };
        applyAnswersToBuilder();
        return showStep(nextAfterDemandVolume());
      }

      if (currentStep === "searchConsoleSite") {
        state.answers.faqDemand = {
          ...state.answers.faqDemand,
          searchConsoleSite: text === "__choose_sc_later"
            ? ""
            : text === "__use_official_url_for_sc"
              ? state.answers.officialSourceUrl
              : text
        };
        applyAnswersToBuilder();
        return showStep("forbiddenPhrases");
      }

      if (currentStep === "forbiddenPhrases") {
        state.answers.forbiddenPhrases = text === "__no_forbidden_phrases" ? "" : compactLines(text).join("\n");
        applyAnswersToBuilder();
        return showStep("naming");
      }

      if (currentStep === "naming") {
        if (text === "custom") {
          state.answers.namingPolicy = "custom";
          return showStep("customNaming");
        }
        state.answers.namingPolicy = text;
        state.answers.namingRules = {
          natural_exact: "Do not shorten or translate the name.",
          light: "Use the exact name only when it sounds natural and clear.",
          strict: "Use the exact name in every relevant question where the entity is named."
        }[text] || defaultAnswers.namingRules;
        applyAnswersToBuilder();
        return showStep("questionBrief");
      }

      if (currentStep === "customNaming") {
        state.answers.namingPolicy = "custom";
        state.answers.namingRules = text;
        applyAnswersToBuilder();
        return showStep("questionBrief");
      }

      if (currentStep === "questionBrief") {
        const selected = selectedValuesFromText(text, step.replies);
        if (selected.includes("custom_question_brief")) {
          state.pendingQuestionBriefParts = selected.filter((item) => item !== "none" && item !== "custom_question_brief");
          return showStep("customQuestionBrief");
        }
        state.pendingQuestionBriefParts = [];
        state.answers.questionUserNote = selected.includes("none") ? "" : (selected.length ? selected.join(" ") : text);
        applyAnswersToBuilder();
        return showStep("questionTone");
      }

      if (currentStep === "customQuestionBrief") {
        state.answers.questionUserNote = [...(state.pendingQuestionBriefParts || []), text].filter(Boolean).join(" ");
        state.pendingQuestionBriefParts = [];
        applyAnswersToBuilder();
        return showStep("questionTone");
      }

      if (currentStep === "questionTone") {
        if (text === "custom_question_tone") return showStep("customQuestionTone");
        state.answers.questionTone = text;
        applyAnswersToBuilder();
        return showStep("answerBrief");
      }

      if (currentStep === "customQuestionTone") {
        state.answers.questionTone = text;
        applyAnswersToBuilder();
        return showStep("answerBrief");
      }

      if (currentStep === "answerBrief") {
        const selected = selectedValuesFromText(text, step.replies);
        if (selected.includes("custom_answer_brief")) {
          state.pendingAnswerBriefParts = selected.filter((item) => item !== "none" && item !== "custom_answer_brief");
          return showStep("customAnswerBrief");
        }
        state.pendingAnswerBriefParts = [];
        state.answers.answerUserNote = selected.includes("none") ? "" : (selected.length ? selected.join(" ") : text);
        applyAnswersToBuilder();
        return showStep("answerTone");
      }

      if (currentStep === "customAnswerBrief") {
        state.answers.answerUserNote = [...(state.pendingAnswerBriefParts || []), text].filter(Boolean).join(" ");
        state.pendingAnswerBriefParts = [];
        applyAnswersToBuilder();
        return showStep("answerTone");
      }

      if (currentStep === "answerTone") {
        if (text === "custom_answer_tone") return showStep("customAnswerTone");
        state.answers.answerTone = text;
        applyAnswersToBuilder();
        return showStep("qaChecks");
      }

      if (currentStep === "customAnswerTone") {
        state.answers.answerTone = text;
        applyAnswersToBuilder();
        return showStep("qaChecks");
      }

      if (currentStep === "qaChecks") {
        const selected = selectedValuesFromText(text, step.replies);
        state.answers.qaMode = selected.includes("no_qa")
          ? "no_qa"
          : ["duplicates", "sources", "writing"].filter((item) => selected.includes(item)).join("|") || "duplicates|writing";
        state.answers.taskEnabledMap = taskEnabledMapFromQa(state.answers.qaMode);
        applyAnswersToBuilder();
        return showStep("categories");
      }

      if (currentStep === "categories") {
        state.answers.categoryPreset = text === "workflow" ? state.answers.workflowType : text;
        state.answers.customCategories = "";
        applyAnswersToBuilder();
        return showStep(nextAfterCategories());
      }

      if (currentStep === "categoryTarget") {
        state.answers.categoryTarget = text;
        applyAnswersToBuilder();
        return showStep("taskRun");
      }

      if (currentStep === "customCategories") {
        state.answers.categoryPreset = "custom_categories";
        state.answers.customCategories = text;
        applyAnswersToBuilder();
        return showStep("categoryTarget");
      }

      if (currentStep === "taskRun") {
        const selected = selectedValuesFromText(text, step.replies);
        const selectedSet = new Set(selected.map(String));
        state.answers.taskEnabledMap = Object.fromEntries(promptTasks.map((task) => [task.id, selectedSet.has(String(task.id))]));
        applyAnswersToBuilder();
        return showStep(nextAfterTaskRun());
      }

      if (currentStep === "grammarOutputMode") {
        state.answers.grammarOutputMode = text;
        applyAnswersToBuilder();
        return showStep("promptEditOffer");
      }

      if (currentStep === "promptEditOffer") {
        if (text === "edit_prompts") return showStep("promptTasks");
        applyAnswersToBuilder();
        return finish();
      }

      if (currentStep === "promptTasks") {
        const selected = selectedValuesFromText(text, step.replies);
        if (!selected.length || selected.includes("skip_prompts")) {
          applyAnswersToBuilder();
          return finish();
        }
        state.promptQueue = selected
          .map((item) => Number(String(item).replace("task:", "")))
          .filter((id) => promptTasks.some((task) => task.id === id));
        state.promptIndex = 0;
        return showStep("taskPrompt");
      }

      if (currentStep === "taskPrompt") {
        const taskId = state.promptQueue?.[state.promptIndex || 0];
        if (taskId && text.toLowerCase() !== "keep") {
          state.answers.taskPrompts = {
            ...(state.answers.taskPrompts || {}),
            [taskId]: text
          };
          applyAnswersToBuilder();
        }
        state.promptIndex = (state.promptIndex || 0) + 1;
        if (state.promptIndex < (state.promptQueue || []).length) {
          return showStep("taskPrompt");
        }
        return finish();
      }
    }

    function finish() {
      applyAnswersToBuilder();
      state.step = "done";
      saveChatState();
      setReplies([
        { label: "Open manual editor", value: "__open_builder" },
        { label: "Save plan", value: "__save_plan" },
        { label: "Restart", value: "__restart" }
      ]);
      bot("Done. I updated the builder settings. Open the editor to review sources, demand mining, categories, tasks and run readiness before starting the workflow.");
      renderSummary();
    }

    function resetChat() {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      state.step = "workflowType";
      state.answers = cloneDefaultAnswers();
      state.promptQueue = [];
      state.promptIndex = 0;
      state.pendingAudienceParts = [];
      state.pendingQuestionBriefParts = [];
      state.pendingAnswerBriefParts = [];
      state.transcript = [];
      log.innerHTML = "";
      syncAnswersFromBuilder();
      renderSummary();
      showStep("workflowType");
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      input.value = "";
      if (!value && submitActiveMultiSelection()) return;
      if (!value) return;
      const step = steps[state.step] || {};
      if (step.multi) {
        const selected = selectedValuesFromText(value, step.replies);
        handleAnswer(selected.length ? selected.join("|") : value, selected.length ? selectedLabel(step.replies, selected) : value);
        return;
      }
      handleAnswer(value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        if (longAnswerSteps.has(state.step)) return;
        event.preventDefault();
        form.requestSubmit();
      }
    });

    quick.addEventListener("click", (event) => {
      const button = event.target.closest("[data-chat-value]");
      if (!button) return;
      const value = button.dataset.chatValue;
      if (value === "__open_builder") {
        bridge.setStudioView("builder");
        return;
      }
      if (value === "__save_plan") {
        bridge.saveFaqAccountPlan?.();
        return;
      }
      if (value === "__restart") {
        resetChat();
      }
    });

    ["chatOpenBuilderBtn", "chatOpenBuilderBtnTop"].forEach((id) => {
      $(id)?.addEventListener("click", () => bridge.setStudioView("builder"));
    });

    $("chatSavePlanBtn")?.addEventListener("click", () => bridge.saveFaqAccountPlan?.());
    $("chatResetBtn")?.addEventListener("click", resetChat);

    if (!state.transcript.length) {
      syncAnswersFromBuilder();
    }

    if (state.transcript.length) {
      state.transcript.forEach((message) => addMessage(message.role, message.text, false));
      if (state.step === "done") {
        applyAnswersToBuilder();
        input.placeholder = "Open manual editing or save the plan.";
        setReplies([
          { label: "Open manual editor", value: "__open_builder" },
          { label: "Save plan", value: "__save_plan" },
          { label: "Restart", value: "__restart" }
        ]);
      } else {
        showStep(state.step, false);
      }
    } else {
      bot("Hi, I can fill the editor settings from one guided flow. I will cover workflow type, topics, model, sources, search demand, guardrails, categories and tasks.");
      showStep("workflowType");
    }

    renderSummary();
  }

  init();
})();
