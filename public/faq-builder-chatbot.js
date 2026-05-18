(() => {
  const CHAT_STORAGE_KEY = "carmelon.faqPlayground.chat.v3";

  const defaultAnswers = {
    scope: "",
    subjects: "",
    language: "English (UK)",
    countMode: "target",
    count: "30",
    sources: ["Official website"],
    sourceInstructions: "Use selected sources to discover common questions. Use the official source for factual answers. Mark missing facts as Needs source confirmation.",
    namingPolicy: "natural_exact",
    namingRules: "Do not shorten or translate the name.",
    questionUserNote: "",
    questionTone: "",
    answerUserNote: "",
    answerTone: "",
    qaMode: "writing_qa",
    categoryPreset: "hotel",
    categoryCount: "",
    customCategories: "",
    taskPrompts: {}
  };

  const promptTasks = [
    { id: 1, label: "Research questions" },
    { id: 2, label: "Write answers" },
    { id: 3, label: "Duplicate check" },
    { id: 4, label: "Source verification" },
    { id: 5, label: "Grammar and answer fit" }
  ];

  const steps = {
    scope: {
      question: "Let's start simple. What type of FAQ are we building?",
      replies: [
        { label: "Hotel / hospitality property", value: "hotel" },
        { label: "Local business", value: "local" },
        { label: "Product / service", value: "service" }
      ]
    },
    subjects: {
      question: "Great. Add the hotel, product, service, or page names. If there is more than one, separate them with commas.",
      placeholder: "Example: Bachar House, master Wola"
    },
    language: {
      question: "Which language should the outputs use?",
      replies: [
        { label: "English UK", value: "English (UK)" },
        { label: "English US", value: "English (US)" },
        { label: "Hebrew", value: "Hebrew" },
        { label: "German", value: "German" },
        { label: "French", value: "French" },
        { label: "Spanish", value: "Spanish" }
      ]
    },
    count: {
      question: "Choose a working range for the number of questions. The model can still return fewer if the source material is thin.",
      replies: [
        { label: "Lean: 10-15", value: "target:10-15" },
        { label: "Standard: 20-30", value: "target:20-30" },
        { label: "Deep: 30-45", value: "target:30-45" },
        { label: "As many as found", value: "as_found" },
        { label: "No fixed target", value: "quality_first" }
      ]
    },
    sources: {
      question: "Which sources can the model use? Select all that apply.",
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
      question: "Briefly describe which sources are allowed and which facts must be verified.",
      placeholder: "Example: Official website only. Reviews may be used only for question ideas."
    },
    naming: {
      question: "How should the property, product, or service name appear in the questions and answers?",
      replies: [
        { label: "Exact name, natural use", value: "natural_exact" },
        { label: "Light mentions", value: "light" },
        { label: "Strict exact-name usage", value: "strict" },
        { label: "I'll write my own rule", value: "custom" }
      ]
    },
    customNaming: {
      question: "Write a short rule for name usage. One clear sentence is best.",
      placeholder: "Example: Use the exact name only when it sounds natural and clear."
    },
    questionBrief: {
      question: "What matters most when choosing questions?",
      replies: [
        { label: "No extra focus", value: "none" },
        { label: "Pre-booking questions", value: "Focus on practical pre-booking questions and comparison intent." },
        { label: "User pain points", value: "Prioritize real doubts, objections, unclear policies and decision blockers." },
        { label: "SEO / AI readiness", value: "Prioritize questions that clarify the entity, service, policies, location, trust and decision intent for search and AI tools." },
        { label: "I'll write it myself", value: "custom_question_brief" }
      ]
    },
    customQuestionBrief: {
      question: "Write one short sentence about what matters in the questions the system selects.",
      placeholder: "Example: Focus on questions that reduce repeated support requests."
    },
    questionTone: {
      question: "What question style fits this workflow?",
      replies: [
        { label: "Clear and practical", value: "Use a clear, practical and non-promotional tone when selecting questions." },
        { label: "User-friendly", value: "Use a helpful, human and user-first tone. Prefer natural customer wording." },
        { label: "SEO / AI focused", value: "Prioritize entity clarity, answerability and questions that help search and AI systems understand the page." },
        { label: "I'll write it myself", value: "custom_question_tone" }
      ]
    },
    customQuestionTone: {
      question: "Write one short sentence describing how the questions should sound.",
      placeholder: "Example: Natural customer questions, without marketing wording."
    },
    answerBrief: {
      question: "What matters most in the answers?",
      replies: [
        { label: "No extra focus", value: "none" },
        { label: "Short and practical", value: "Keep answers short, useful and easy to scan. Avoid filler." },
        { label: "Verified facts only", value: "Do not invent facts. If a fact is not confirmed, mark it clearly as Needs source confirmation." },
        { label: "Helpful, not salesy", value: "Write helpful service-oriented answers without marketing exaggeration or unsupported promises." },
        { label: "I'll write it myself", value: "custom_answer_brief" }
      ]
    },
    customAnswerBrief: {
      question: "Write one short sentence about what matters in the answers.",
      placeholder: "Example: Answers up to two sentences, with no promises that are not on the website."
    },
    answerTone: {
      question: "Which writing style fits the answers?",
      replies: [
        { label: "Reliable and concise", value: "Write in a reliable, concise and source-grounded tone." },
        { label: "Warm and service-minded", value: "Write in a warm, helpful and guest-friendly tone without becoming promotional." },
        { label: "Professional and direct", value: "Write in a precise, professional and direct tone. Prioritize clarity over marketing." },
        { label: "I'll write it myself", value: "custom_answer_tone" }
      ]
    },
    customAnswerTone: {
      question: "Write one short sentence about the answer tone.",
      placeholder: "Example: Helpful but not promotional, with short and precise answers."
    },
    qaChecks: {
      question: "Which quality checks should be added at the end? Select all that apply.",
      multi: true,
      doneLabel: "Use selected checks",
      replies: [
        { label: "Duplicate check", value: "duplicates" },
        { label: "Source verification", value: "sources" },
        { label: "Grammar and answer fit", value: "writing" },
        { label: "No QA for now", value: "no_qa" }
      ]
    },
    categories: {
      question: "How should question categories be defined?",
      replies: [
        { label: "Full hotel set", value: "hotel" },
        { label: "Basic and short", value: "basic" },
        { label: "I'll write category names", value: "custom_categories" },
        { label: "Leave for manual editing", value: "manual" }
      ]
    },
    categoryCount: {
      question: "Roughly how many categories do you need? You can enter a number, or write 'as many as needed'.",
      placeholder: "Example: 6"
    },
    customCategories: {
      question: "Write category names, one per line. You can add topics after a dash if that helps.",
      placeholder: "General information - who it suits, what to know\nBooking and payment - price, cancellation, deposit\nLocation - parking, transport, neighborhood"
    },
    promptTasks: {
      question: "Do you want to replace the main prompt for any task now? Select the tasks you want to edit, or skip this step.",
      multi: true,
      doneLabel: "Edit selected prompts",
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
      question: "Paste the main prompt for this task. Write 'keep' if you want to leave it unchanged.",
      placeholder: "Paste the full task prompt here, or type keep."
    }
  };

  const state = loadChatState();

  function hasHebrewText(value) {
    return /[\u0590-\u05ff]/.test(String(value || ""));
  }

  function loadChatState() {
    try {
      const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "{}");
      const answers = { ...defaultAnswers, ...(saved.answers || {}) };
      answers.taskPrompts = answers.taskPrompts && typeof answers.taskPrompts === "object" ? answers.taskPrompts : {};
      const transcript = Array.isArray(saved.transcript) ? saved.transcript : [];
      if (hasHebrewText(JSON.stringify({ answers, transcript }))) {
        return { step: "scope", answers: { ...defaultAnswers }, transcript: [] };
      }
      return {
        step: saved.step || "scope",
        answers,
        transcript
      };
    } catch {
      return { step: "scope", answers: { ...defaultAnswers }, transcript: [] };
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
    const summary = $("faqChatSummary");

    if (!log || !quick || !form || !input || !summary) return;

    function addMessage(role, text, persist = true) {
      const item = document.createElement("div");
      item.className = `chat-message ${role}`;
      item.textContent = text;
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;

      if (persist) {
        state.transcript.push({ role, text });
        state.transcript = state.transcript.slice(-80);
        saveChatState();
      }
    }

    function bot(text) {
      addMessage("bot", text);
    }

    function user(text) {
      addMessage("user", text);
    }

    function initialMultiSelection(stepName) {
      if (stepName === "sources") {
        return new Set(state.answers.sources || ["Official website"]);
      }

      if (stepName === "qaChecks") {
        if (state.answers.qaMode === "no_qa") return new Set(["no_qa"]);
        if (state.answers.qaMode === "duplicates_only") return new Set(["duplicates"]);
        if (state.answers.qaMode === "full_qa") return new Set(["duplicates", "sources", "writing"]);
        return new Set(["duplicates", "writing"]);
      }

      return new Set();
    }

    function setReplies(replies = []) {
      quick.innerHTML = "";
      const step = steps[state.step] || {};
      const multiSelection = step.multi ? initialMultiSelection(state.step) : new Set();

      function refreshMultiButtons() {
        quick.querySelectorAll("[data-chat-value]").forEach((button) => {
          button.classList.toggle("is-selected", multiSelection.has(button.dataset.chatValue));
        });
      }

      replies.forEach((reply) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-reply";
        button.textContent = reply.label;
        button.dataset.chatValue = reply.value;
        button.addEventListener("click", () => {
          if (String(reply.value).startsWith("__")) return;
          if (step.multi) {
            if (reply.value === "no_qa" || reply.value === "skip_prompts") {
              multiSelection.clear();
              multiSelection.add(reply.value);
            } else {
              multiSelection.delete("no_qa");
              multiSelection.delete("skip_prompts");
              if (multiSelection.has(reply.value)) {
                multiSelection.delete(reply.value);
              } else {
                multiSelection.add(reply.value);
              }
            }
            refreshMultiButtons();
            return;
          }
          handleAnswer(reply.value, reply.label);
        });
        quick.appendChild(button);
      });

      if (step.multi) {
        const done = document.createElement("button");
        done.type = "button";
        done.className = "quick-reply quick-reply-done";
        done.textContent = step.doneLabel || "Done";
        done.addEventListener("click", () => {
          const selected = Array.from(multiSelection);
          handleAnswer(selected.join("|"), selected.length ? selected.map((value) => {
            const match = replies.find((reply) => reply.value === value);
            return match?.label || value;
          }).join(", ") : "No selection");
        });
        quick.appendChild(done);
        refreshMultiButtons();
      }
    }

    function renderSummary() {
      const sources = state.answers.sources.join(", ");
      const target = state.answers.countMode === "target"
        ? `${state.answers.count} questions`
        : state.answers.countMode === "as_found"
          ? "As many as found"
          : "No fixed target";

      summary.innerHTML = [
        ["Subjects", state.answers.subjects || "Not set yet"],
        ["Language", state.answers.language],
        ["Target", target],
        ["Sources", sources || "Official website"],
        ["Name rule", state.answers.namingRules],
        ["Questions", state.answers.questionUserNote || "Default"],
        ["Answers", state.answers.answerUserNote || "Default"],
        ["QA", qaLabel(state.answers.qaMode)],
        ["Categories", state.answers.customCategories ? "Custom" : presetLabel(state.answers.categoryPreset)],
        ["Edited prompts", Object.keys(state.answers.taskPrompts || {}).length ? `${Object.keys(state.answers.taskPrompts).length} task(s)` : "Default"]
      ].map(([label, value]) => `
        <div class="chat-summary-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join("");
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function presetLabel(value) {
      return {
        hotel: "Full hotel set",
        local: "Local business",
        basic: "Basic and short",
        manual: "Manual editing",
        service: "Product / service"
      }[value] || value || "Full hotel set";
    }

    function qaLabel(value) {
      return {
        writing_qa: "Duplicates + grammar",
        full_qa: "Full check including sources",
        duplicates_only: "Duplicates only",
        no_qa: "No QA",
        duplicates: "Duplicate check",
        sources: "Source verification",
        writing: "Grammar and answer fit",
        "duplicates|sources": "Duplicates + sources",
        "duplicates|writing": "Duplicates + writing",
        "sources|writing": "Sources + writing",
        "duplicates|sources|writing": "Full QA"
      }[value] || "Duplicates + grammar";
    }

    function qaTaskMap(value) {
      const checks = new Set(String(value || "").split("|").filter(Boolean));
      if (value === "no_qa") {
        return { 3: false, 4: false, 5: false };
      }

      if (value === "duplicates_only") {
        return { 3: true, 4: false, 5: false };
      }

      if (value === "full_qa") {
        return { 3: true, 4: true, 5: true };
      }

      if (checks.size) {
        return {
          3: checks.has("duplicates"),
          4: checks.has("sources"),
          5: checks.has("writing")
        };
      }

      return { 3: true, 4: false, 5: true };
    }

    function qaGuidance(value) {
      const checks = new Set(String(value || "").split("|").filter(Boolean));
      if (value === "no_qa") {
        return "";
      }

      if (value === "duplicates_only") {
        return "Check only for duplicate or near-duplicate questions. Preserve row order and return one result per data row.";
      }

      if (value === "full_qa") {
        return "Check duplicates, source confidence, unsupported facts, answer-question match, grammar, syntax, clarity and overly promotional wording. Keep findings short and actionable.";
      }

      if (checks.size) {
        const lines = [];
        if (checks.has("duplicates")) lines.push("Check duplicate and near-duplicate questions while preserving row order.");
        if (checks.has("sources")) lines.push("Flag unsupported facts, uncertain claims, missing source evidence and rows that need verification.");
        if (checks.has("writing")) lines.push("Check answer-question fit, grammar, syntax, clarity, usefulness and overly promotional wording.");
        return lines.join(" ");
      }

      return "Check duplicate questions, answer-question match, grammar, syntax, clarity and overly promotional wording. Keep findings short and actionable.";
    }

    function showStep(stepName, shouldAsk = true) {
      state.step = stepName;
      saveChatState();
      const step = steps[stepName];
      if (!step) return finish();
      input.classList.toggle("is-long-answer", ["customSources", "customCategories", "taskPrompt"].includes(stepName));
      if (stepName === "taskPrompt") {
        const taskId = state.promptQueue?.[state.promptIndex || 0];
        const task = promptTasks.find((item) => item.id === Number(taskId));
        input.placeholder = step.placeholder || "Paste the full task prompt here, or type keep.";
        setReplies([{ label: "Keep unchanged", value: "keep" }]);
        if (shouldAsk) bot(`Main prompt for #${task?.id || taskId} ${task?.label || "this task"}: paste the replacement prompt, or type keep.`);
        renderSummary();
        return;
      }
      input.placeholder = step.placeholder || "Type a short answer...";
      setReplies(step.replies || []);
      if (shouldAsk) bot(step.question);
      renderSummary();
    }

    function applyAnswersToBuilder() {
      const answers = state.answers;

      $("subjects").value = answers.subjects;
      $("outputLanguage").value = answers.language;
      $("questionCountMode").value = answers.countMode;
      $("questionCount").value = answers.count || "30";
      if ($("questionRangePreset") && answers.countMode === "target") {
        $("questionRangePreset").value = answers.count || "20-30";
      }
      $("sourceInstructions").value = answers.sourceInstructions;
      $("namingPolicy").value = answers.namingPolicy;
      $("namingRules").value = answers.namingRules;

      if (answers.scope === "local") {
        $("audience").value = "Potential customers researching the business before contacting, visiting or buying.";
      } else if (answers.scope === "service") {
        $("audience").value = "Potential customers comparing services, pricing, trust signals and next steps.";
      } else {
        $("audience").value = "Guests before booking, guests before arrival, and in-house guests";
      }

      bridge.applySourceOptions(answers.sources);

      bridge.applyChatPromptGuidance({
        questionUserNote: answers.questionUserNote,
        questionTone: answers.questionTone,
        answerUserNote: answers.answerUserNote,
        answerTone: answers.answerTone,
        qaChecks: qaGuidance(answers.qaMode)
      });

      bridge.applyChatTaskPrompts?.(answers.taskPrompts);

      bridge.setTasksEnabled(qaTaskMap(answers.qaMode));

      if (answers.customCategories) {
        bridge.applyCustomCategories(answers.customCategories);
      } else if (answers.categoryPreset === "basic") {
        bridge.setCategoriesEnabled(["general", "booking", "checkin", "location"]);
      } else if (answers.categoryPreset !== "manual") {
        bridge.setActivePreset(answers.categoryPreset, true);
      }

      bridge.updateSummary();
      bridge.saveState();
    }

    function sourcePreset(value) {
      const selected = String(value || "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== "custom_sources");
      const sources = selected.length ? selected : ["Official website"];
      const secondary = sources.filter((source) => source !== "Official website");
      const instructions = secondary.length
        ? `Use the official website as the primary factual source. Use ${secondary.join(", ")} to discover common question demand and pain points. Do not invent facts. Any answer not confirmed by an official source should be marked as Needs source confirmation.`
        : "Use the official website as the primary source. If a fact is missing, mark it as Needs source confirmation.";
      return { sources, instructions };
    }

    function handleAnswer(value, label = value) {
      const currentStep = state.step;
      const text = String(value || "").trim();
      if (!text) return;

      user(label || text);

      if (currentStep === "scope") {
        state.answers.scope = text;
        state.answers.categoryPreset = text === "local" ? "local" : "hotel";
        applyAnswersToBuilder();
        return showStep("subjects");
      }

      if (currentStep === "subjects") {
        state.answers.subjects = text;
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
          state.answers.count = text.split(":")[1] || "30";
        } else if (/^\d+$/.test(text)) {
          state.answers.countMode = "target";
          state.answers.count = text;
        } else {
          state.answers.countMode = text === "as_found" ? "as_found" : "quality_first";
        }
        applyAnswersToBuilder();
        return showStep("sources");
      }

      if (currentStep === "sources") {
        const hasCustomSources = text.split("|").includes("custom_sources");
        const preset = sourcePreset(text);
        state.answers.sources = preset.sources;
        state.answers.sourceInstructions = preset.instructions;
        applyAnswersToBuilder();
        if (hasCustomSources) {
          return showStep("customSources");
        }
        return showStep("naming");
      }

      if (currentStep === "customSources") {
        state.answers.sourceInstructions = text;
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
          strict: "Use the exact name in every relevant question."
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
        if (text === "custom_question_brief") {
          return showStep("customQuestionBrief");
        }
        state.answers.questionUserNote = text === "none" ? "" : text;
        applyAnswersToBuilder();
        return showStep("questionTone");
      }

      if (currentStep === "customQuestionBrief") {
        state.answers.questionUserNote = text;
        applyAnswersToBuilder();
        return showStep("questionTone");
      }

      if (currentStep === "questionTone") {
        if (text === "custom_question_tone") {
          return showStep("customQuestionTone");
        }
        state.answers.questionTone = text === "none" ? "" : text;
        applyAnswersToBuilder();
        return showStep("answerBrief");
      }

      if (currentStep === "customQuestionTone") {
        state.answers.questionTone = text;
        applyAnswersToBuilder();
        return showStep("answerBrief");
      }

      if (currentStep === "answerBrief") {
        if (text === "custom_answer_brief") {
          return showStep("customAnswerBrief");
        }
        state.answers.answerUserNote = text === "none" ? "" : text;
        applyAnswersToBuilder();
        return showStep("answerTone");
      }

      if (currentStep === "customAnswerBrief") {
        state.answers.answerUserNote = text;
        applyAnswersToBuilder();
        return showStep("answerTone");
      }

      if (currentStep === "answerTone") {
        if (text === "custom_answer_tone") {
          return showStep("customAnswerTone");
        }
        state.answers.answerTone = text === "none" ? "" : text;
        applyAnswersToBuilder();
        return showStep("qaChecks");
      }

      if (currentStep === "customAnswerTone") {
        state.answers.answerTone = text;
        applyAnswersToBuilder();
        return showStep("qaChecks");
      }

      if (currentStep === "qaChecks") {
        const order = ["duplicates", "sources", "writing", "no_qa"];
        const selected = text.split("|").filter(Boolean);
        state.answers.qaMode = selected.includes("no_qa")
          ? "no_qa"
          : order.filter((item) => selected.includes(item)).join("|") || "duplicates|writing";
        applyAnswersToBuilder();
        return showStep("categories");
      }

      if (currentStep === "categories") {
        if (text === "custom_categories") {
          return showStep("categoryCount");
        }
        state.answers.categoryPreset = text;
        state.answers.customCategories = "";
        applyAnswersToBuilder();
        return showStep("promptTasks");
      }

      if (currentStep === "categoryCount") {
        state.answers.categoryCount = text;
        return showStep("customCategories");
      }

      if (currentStep === "customCategories") {
        state.answers.categoryPreset = "manual";
        state.answers.customCategories = text;
        applyAnswersToBuilder();
        return showStep("promptTasks");
      }

      if (currentStep === "promptTasks") {
        const selected = text.split("|").filter(Boolean);
        if (!selected.length || selected.includes("skip_prompts")) {
          state.answers.taskPrompts = {};
          applyAnswersToBuilder();
          return finish();
        }
        state.promptQueue = selected
          .map((item) => Number(item.replace("task:", "")))
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
        { label: "Save JSON", value: "__save_json" },
        { label: "Restart", value: "__restart" }
      ]);
      bot("Done. I filled the main settings in the builder. You can open manual editing, refine categories and instructions, save JSON, or run the workflow.");
      renderSummary();
    }

    function resetChat() {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      state.step = "scope";
      state.answers = { ...defaultAnswers };
      state.answers.taskPrompts = {};
      state.promptQueue = [];
      state.promptIndex = 0;
      state.transcript = [];
      log.innerHTML = "";
      renderSummary();
      showStep("scope");
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      input.value = "";
      if (!value) return;
      handleAnswer(value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        if (["customSources", "customCategories", "taskPrompt"].includes(state.step)) return;
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
      if (value === "__save_json") {
        bridge.downloadWorkPlan();
        return;
      }
      if (value === "__restart") {
        resetChat();
      }
    });

    ["chatOpenBuilderBtn", "chatOpenBuilderBtnTop"].forEach((id) => {
      $(id)?.addEventListener("click", () => bridge.setStudioView("builder"));
    });

    $("chatSavePlanBtn")?.addEventListener("click", () => bridge.downloadWorkPlan());
    $("chatResetBtn")?.addEventListener("click", resetChat);

    if (state.transcript.length) {
      state.transcript.forEach((message) => addMessage(message.role, message.text, false));
      if (state.step === "done") {
        applyAnswersToBuilder();
        input.placeholder = "Open manual editing or save JSON.";
        setReplies([
          { label: "Open manual editor", value: "__open_builder" },
          { label: "Save JSON", value: "__save_json" },
          { label: "Restart", value: "__restart" }
        ]);
      } else {
        showStep(state.step, false);
      }
    } else {
      bot("Hi, I can help fill the builder without opening every field. We will answer a few short questions, then everything stays open for manual editing.");
      showStep("scope");
    }

    renderSummary();
  }

  init();
})();
