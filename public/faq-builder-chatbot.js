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
    namingRules: "לא לקצר או לתרגם את השם",
    questionUserNote: "",
    questionTone: "",
    answerUserNote: "",
    answerTone: "",
    qaMode: "writing_qa",
    categoryPreset: "hotel",
    categoryCount: "",
    customCategories: ""
  };

  const steps = {
    scope: {
      question: "נתחיל פשוט. איזה סוג FAQ אנחנו בונים?",
      replies: [
        { label: "מלון / נכס אירוח", value: "hotel" },
        { label: "עסק מקומי", value: "local" },
        { label: "מוצר / שירות", value: "service" }
      ]
    },
    subjects: {
      question: "מעולה. כתבי את שמות המלונות, המוצרים או העמודים. אם יש כמה, הפרידי בפסיק.",
      placeholder: "לדוגמה: Bachar House, master Wola"
    },
    language: {
      question: "באיזו שפה לכתוב את התוצרים?",
      replies: [
        { label: "English UK", value: "English (UK)" },
        { label: "English US", value: "English (US)" },
        { label: "עברית", value: "Hebrew" },
        { label: "Deutsch", value: "German" },
        { label: "Français", value: "French" },
        { label: "Español", value: "Spanish" }
      ]
    },
    count: {
      question: "כמה שאלות בערך לייצר? אפשר לבחור יעד, או לתת למודל להחזיר רק מה שבאמת נמצא.",
      replies: [
        { label: "כ-20 שאלות", value: "target:20" },
        { label: "כ-30 שאלות", value: "target:30" },
        { label: "כמה שנמצא", value: "as_found" },
        { label: "ללא יעד קשיח", value: "quality_first" }
      ]
    },
    sources: {
      question: "מאיפה מותר למודל לקבל השראה לשאלות?",
      replies: [
        { label: "אתר רשמי בלבד", value: "official" },
        { label: "אתר + ביקורות", value: "reviews" },
        { label: "מחקר רחב", value: "broad" },
        { label: "אכתוב לבד", value: "custom_sources" }
      ]
    },
    customSources: {
      question: "כתבי בקצרה אילו מקורות מותר להשתמש בהם ואילו עובדות חייבות אימות.",
      placeholder: "לדוגמה: אתר רשמי בלבד. ביקורות רק להשראה לשאלות."
    },
    naming: {
      question: "איך להתייחס לשם הנכס או המוצר בתוך השאלות והתשובות?",
      replies: [
        { label: "שם מדויק וטבעי", value: "natural_exact" },
        { label: "מעט אזכורים", value: "light" },
        { label: "מחמיר בשם המדויק", value: "strict" },
        { label: "אכתוב כלל בעצמי", value: "custom" }
      ]
    },
    customNaming: {
      question: "כתבי כלל קצר לשימוש בשם. עדיף משפט אחד ברור.",
      placeholder: "לדוגמה: להשתמש בשם המדויק בשאלה רק כשזה טבעי וברור."
    },
    questionBrief: {
      question: "מה הכי חשוב בבחירת השאלות?",
      replies: [
        { label: "בלי דגש נוסף", value: "none" },
        { label: "שאלות לפני הזמנה", value: "Focus on practical pre-booking questions and comparison intent." },
        { label: "שאלות לפי כאבי משתמש", value: "Prioritize real doubts, objections, unclear policies and decision blockers." },
        { label: "SEO / AI readiness", value: "Prioritize questions that clarify the entity, service, policies, location, trust and decision intent for search and AI tools." },
        { label: "אכתוב לבד", value: "custom_question_brief" }
      ]
    },
    customQuestionBrief: {
      question: "כתבי במשפט קצר מה חשוב לך בשאלות שהמערכת תבחר.",
      placeholder: "לדוגמה: להתמקד בשאלות שמונעות פניות חוזרות לשירות לקוחות."
    },
    questionTone: {
      question: "איזה סגנון שאלות מתאים לעבודה הזאת?",
      replies: [
        { label: "ענייני וברור", value: "Use a clear, practical and non-promotional tone when selecting questions." },
        { label: "ידידותי למשתמש", value: "Use a helpful, human and user-first tone. Prefer natural customer wording." },
        { label: "SEO / AI ממוקד", value: "Prioritize entity clarity, answerability and questions that help search and AI systems understand the page." },
        { label: "אכתוב לבד", value: "custom_question_tone" }
      ]
    },
    customQuestionTone: {
      question: "כתבי במשפט קצר איך השאלות צריכות להישמע.",
      placeholder: "לדוגמה: שאלות טבעיות כמו של לקוח אמיתי, בלי ניסוח שיווקי."
    },
    answerBrief: {
      question: "מה חשוב בתשובות עצמן?",
      replies: [
        { label: "בלי דגש נוסף", value: "none" },
        { label: "קצר ופרקטי", value: "Keep answers short, useful and easy to scan. Avoid filler." },
        { label: "רק עובדות מאומתות", value: "Do not invent facts. If a fact is not confirmed, mark it clearly as Needs source confirmation." },
        { label: "שפה שירותית אבל לא מכירתית", value: "Write helpful service-oriented answers without marketing exaggeration or unsupported promises." },
        { label: "אכתוב לבד", value: "custom_answer_brief" }
      ]
    },
    customAnswerBrief: {
      question: "כתבי במשפט קצר מה חשוב לך בתשובות.",
      placeholder: "לדוגמה: תשובות עד שני משפטים, בלי הבטחות שלא מופיעות באתר."
    },
    answerTone: {
      question: "איזה סגנון כתיבה מתאים לתשובות?",
      replies: [
        { label: "אמין ותמציתי", value: "Write in a reliable, concise and source-grounded tone." },
        { label: "חם ושירותי", value: "Write in a warm, helpful and guest-friendly tone without becoming promotional." },
        { label: "מקצועי וישיר", value: "Write in a precise, professional and direct tone. Prioritize clarity over marketing." },
        { label: "אכתוב לבד", value: "custom_answer_tone" }
      ]
    },
    customAnswerTone: {
      question: "כתבי משפט קצר על הטון לתשובות.",
      placeholder: "לדוגמה: טון שירותי אבל לא מכירתי, תשובות קצרות ומדויקות."
    },
    qaChecks: {
      question: "איזו בדיקת איכות להוסיף בסוף?",
      replies: [
        { label: "כפילויות + דקדוק", value: "writing_qa" },
        { label: "בדיקה מלאה כולל מקורות", value: "full_qa" },
        { label: "רק כפילויות", value: "duplicates_only" },
        { label: "בלי QA כרגע", value: "no_qa" }
      ]
    },
    categories: {
      question: "איך להגדיר קטגוריות לשאלות?",
      replies: [
        { label: "מלונות מלא", value: "hotel" },
        { label: "בסיסי וקצר", value: "basic" },
        { label: "אכתוב שמות קטגוריות", value: "custom_categories" },
        { label: "אשאיר לעריכה ידנית", value: "manual" }
      ]
    },
    categoryCount: {
      question: "כמה קטגוריות בערך יש לך? אפשר מספר, או לכתוב 'כמה שצריך'.",
      placeholder: "לדוגמה: 6"
    },
    customCategories: {
      question: "כתבי שמות קטגוריות, אחת בשורה. אם נוח לך, אפשר להוסיף אחרי מקף גם נושאים.",
      placeholder: "מידע כללי - למי מתאים, מה חשוב לדעת\nהזמנה ותשלום - מחיר, ביטול, פיקדון\nמיקום - חניה, תחבורה, אזור"
    }
  };

  const state = loadChatState();

  function loadChatState() {
    try {
      const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "{}");
      return {
        step: saved.step || "scope",
        answers: { ...defaultAnswers, ...(saved.answers || {}) },
        transcript: Array.isArray(saved.transcript) ? saved.transcript : []
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

    function setReplies(replies = []) {
      quick.innerHTML = "";
      replies.forEach((reply) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-reply";
        button.textContent = reply.label;
        button.dataset.chatValue = reply.value;
        button.addEventListener("click", () => {
          if (String(reply.value).startsWith("__")) return;
          handleAnswer(reply.value, reply.label);
        });
        quick.appendChild(button);
      });
    }

    function renderSummary() {
      const sources = state.answers.sources.join(", ");
      const target = state.answers.countMode === "target"
        ? `כ-${state.answers.count} שאלות`
        : state.answers.countMode === "as_found"
          ? "כמה שנמצא"
          : "ללא יעד קשיח";

      summary.innerHTML = [
        ["נושאים", state.answers.subjects || "עוד לא הוגדר"],
        ["שפה", state.answers.language],
        ["יעד", target],
        ["מקורות", sources || "אתר רשמי"],
        ["שם הנכס", state.answers.namingRules],
        ["שאלות", state.answers.questionUserNote || "דיפולט"],
        ["תשובות", state.answers.answerUserNote || "דיפולט"],
        ["QA", qaLabel(state.answers.qaMode)],
        ["קטגוריות", state.answers.customCategories ? "מותאם אישית" : presetLabel(state.answers.categoryPreset)]
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
        hotel: "מלונות מלא",
        local: "עסק מקומי",
        basic: "בסיסי וקצר",
        manual: "עריכה ידנית",
      service: "מוצר / שירות"
      }[value] || value || "מלונות מלא";
    }

    function qaLabel(value) {
      return {
        writing_qa: "כפילויות + דקדוק",
        full_qa: "בדיקה מלאה כולל מקורות",
        duplicates_only: "רק כפילויות",
        no_qa: "בלי QA"
      }[value] || "כפילויות + דקדוק";
    }

    function qaTaskMap(value) {
      if (value === "no_qa") {
        return { 3: false, 4: false, 5: false };
      }

      if (value === "duplicates_only") {
        return { 3: true, 4: false, 5: false };
      }

      if (value === "full_qa") {
        return { 3: true, 4: true, 5: true };
      }

      return { 3: true, 4: false, 5: true };
    }

    function qaGuidance(value) {
      if (value === "no_qa") {
        return "";
      }

      if (value === "duplicates_only") {
        return "Check only for duplicate or near-duplicate questions. Preserve row order and return one result per data row.";
      }

      if (value === "full_qa") {
        return "Check duplicates, source confidence, unsupported facts, answer-question match, grammar, syntax, clarity and overly promotional wording. Keep findings short and actionable.";
      }

      return "Check duplicate questions, answer-question match, grammar, syntax, clarity and overly promotional wording. Keep findings short and actionable.";
    }

    function showStep(stepName, shouldAsk = true) {
      state.step = stepName;
      saveChatState();
      const step = steps[stepName];
      if (!step) return finish();
      input.placeholder = step.placeholder || "כתבי כאן תשובה קצרה...";
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
      if (value === "reviews") {
        return {
          sources: ["Official website", "Public reviews", "Google Business Profile"],
          instructions: "Use the official website for factual answers. Use public reviews and Google Business Profile only to discover common questions and pain points."
        };
      }

      if (value === "broad") {
        return {
          sources: ["Official website", "Google Business Profile", "OTAs", "Public reviews", "Competitors"],
          instructions: "Use broad sources to discover question demand. Do not invent facts. Any answer not confirmed by an official source should be marked as Needs source confirmation."
        };
      }

      return {
        sources: ["Official website"],
        instructions: "Use the official website as the primary source. If a fact is missing, mark it as Needs source confirmation."
      };
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
        if (text === "custom_sources") {
          return showStep("customSources");
        }
        const preset = sourcePreset(text);
        state.answers.sources = preset.sources;
        state.answers.sourceInstructions = preset.instructions;
        applyAnswersToBuilder();
        return showStep("naming");
      }

      if (currentStep === "customSources") {
        state.answers.sources = ["Official website"];
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
          natural_exact: "לא לקצר או לתרגם את השם",
          light: "להשתמש בשם המדויק רק כשזה טבעי וברור",
          strict: "להשתמש בשם המדויק בכל שאלה רלוונטית"
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
        state.answers.qaMode = text;
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
        return finish();
      }

      if (currentStep === "categoryCount") {
        state.answers.categoryCount = text;
        return showStep("customCategories");
      }

      if (currentStep === "customCategories") {
        state.answers.categoryPreset = "manual";
        state.answers.customCategories = text;
        applyAnswersToBuilder();
        return finish();
      }
    }

    function finish() {
      applyAnswersToBuilder();
      state.step = "done";
      saveChatState();
      setReplies([
        { label: "פתח לעריכה ידנית", value: "__open_builder" },
        { label: "שמור JSON", value: "__save_json" },
        { label: "התחלה מחדש", value: "__restart" }
      ]);
      bot("סיימנו. מילאתי את ההגדרות המרכזיות במסך. עכשיו אפשר לפתוח עריכה ידנית, לדייק קטגוריות והנחיות, לשמור JSON או להריץ.");
      renderSummary();
    }

    function resetChat() {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      state.step = "scope";
      state.answers = { ...defaultAnswers };
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
        input.placeholder = "אפשר לפתוח עריכה ידנית או לשמור JSON.";
        setReplies([
          { label: "פתח לעריכה ידנית", value: "__open_builder" },
          { label: "שמור JSON", value: "__save_json" },
          { label: "התחלה מחדש", value: "__restart" }
        ]);
      } else {
        showStep(state.step, false);
      }
    } else {
      bot("היי, אני אעזור למלא את הבילדר בלי להיכנס לכל השדות. נשאל כמה שאלות קצרות, ואז הכל יישאר פתוח לעריכה ידנית.");
      showStep("scope");
    }

    renderSummary();
  }

  init();
})();
