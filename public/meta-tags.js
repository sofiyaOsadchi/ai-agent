(function () {
  const STORAGE_KEY = "carmelon.metaTagsStudio.setup.v1";

  const state = {
    mode: "template",
    sourceType: "manual",
    activeRules: new Set(["brandInTitle", "includeH1", "openGraph"]),
    results: [],
    pendingBackendJson: false,
    backendJsonLines: [],
  };

  const socket = typeof io === "function" ? io() : null;

  const $ = (id) => document.getElementById(id);
  const els = {
    modeButtons: Array.from(document.querySelectorAll(".mode-button")),
    sourceButtons: Array.from(document.querySelectorAll(".source-button")),
    ruleButtons: Array.from(document.querySelectorAll(".chip[data-rule]")),
    languageButtons: Array.from(document.querySelectorAll(".language-button")),
    templatePanel: $("templatePanel"),
    aiPanel: $("aiPanel"),
    manualPagesPanel: $("manualPagesPanel"),
    manualTopicsDetails: $("manualTopicsDetails"),
    sourceLink: $("sourceLink"),
    detectedSource: $("detectedSource"),
    brandName: $("brandName"),
    domain: $("domain"),
    pageList: $("pageList"),
    titleMax: $("titleMax"),
    descMax: $("descMax"),
    variantCount: $("variantCount"),
    titleTemplate: $("titleTemplate"),
    descTemplate: $("descTemplate"),
    applyPresetBtn: $("applyPresetBtn"),
    voice: $("voice"),
    primaryKeyword: $("primaryKeyword"),
    aiBrief: $("aiBrief"),
    previewBadge: $("previewBadge"),
    titleScore: $("titleScore"),
    descScore: $("descScore"),
    keywordScore: $("keywordScore"),
    rowScore: $("rowScore"),
    titleScoreCard: $("titleScoreCard"),
    descScoreCard: $("descScoreCard"),
    keywordScoreCard: $("keywordScoreCard"),
    serpUrl: $("serpUrl"),
    serpTitle: $("serpTitle"),
    serpDesc: $("serpDesc"),
    generateBtn: $("generateBtn"),
    saveSetupBtn: $("saveSetupBtn"),
    loadSetupBtn: $("loadSetupBtn"),
    copyCsvBtn: $("copyCsvBtn"),
    copyJsonBtn: $("copyJsonBtn"),
    clearBtn: $("clearBtn"),
    clearLogBtn: $("clearLogBtn"),
    outputMode: $("outputMode"),
    outputModeHint: $("outputModeHint"),
    writebackFields: $("writebackFields"),
    outputTabNameField: $("outputTabNameField"),
    outputTabName: $("outputTabName"),
    outputStartColumn: $("outputStartColumn"),
    outputStartRow: $("outputStartRow"),
    resultsBody: $("resultsBody"),
    terminalLog: $("terminalLog"),
    summaryText: $("summaryText"),
  };

  const copy = {
    en: {
      faqTitle: "FAQ | {{brand}}",
      faqDesc: "Find answers to frequently asked questions about {{brand}}, including services, location, booking details and practical guest information.",
      hotelTitle: "{{page}} | FAQ",
      hotelDesc: "Explore {{page}}. Find essential details, services, location information and practical guidance before you book.",
      h1Prefix: "",
      cta: "Get the details you need before you book.",
    },
    he: {
      faqTitle: "FAQ | {{brand}}",
      faqDesc: "Find clear answers about {{brand}}, including services, location, booking details and guest information.",
      hotelTitle: "{{page}} | FAQ",
      hotelDesc: "Explore {{page}} with practical information about services, location and guest experience.",
      h1Prefix: "",
      cta: "Review the key details before you book.",
    },
    de: {
      faqTitle: "FAQ | {{brand}}",
      faqDesc: "Antworten auf wichtige Fragen zu {{brand}}, von Buchung und Lage bis Ausstattung und Service.",
      hotelTitle: "{{page}} | FAQ",
      hotelDesc: "Entdecken Sie {{page}} mit wichtigen Informationen zu Lage, Services und Aufenthalt.",
      h1Prefix: "",
      cta: "Pruefen Sie die wichtigsten Informationen vor der Buchung.",
    },
    fr: {
      faqTitle: "FAQ | {{brand}}",
      faqDesc: "Trouvez les reponses essentielles sur {{brand}}, des services a la reservation, la localisation et les informations pratiques.",
      hotelTitle: "{{page}} | FAQ",
      hotelDesc: "Decouvrez {{page}} avec les informations utiles sur les services, la localisation et le sejour.",
      h1Prefix: "",
      cta: "Consultez les informations utiles avant de reserver.",
    },
    es: {
      faqTitle: "FAQ | {{brand}}",
      faqDesc: "Encuentra respuestas sobre {{brand}}, incluidos servicios, ubicacion, reservas e informacion practica.",
      hotelTitle: "{{page}} | FAQ",
      hotelDesc: "Explora {{page}} con informacion practica sobre servicios, ubicacion y estancia.",
      h1Prefix: "",
      cta: "Revisa los detalles clave antes de reservar.",
    },
    it: {
      faqTitle: "FAQ | {{brand}}",
      faqDesc: "Trova risposte utili su {{brand}}, inclusi servizi, posizione, prenotazioni e informazioni pratiche.",
      hotelTitle: "{{page}} | FAQ",
      hotelDesc: "Scopri {{page}} con informazioni pratiche su servizi, posizione e soggiorno.",
      h1Prefix: "",
      cta: "Consulta i dettagli principali prima di prenotare.",
    },
  };

  function getSetup() {
    const detected = detectSource(els.sourceLink.value);
    return {
      mode: state.mode,
      sourceType: detected.type,
      brandName: els.brandName.value.trim(),
      domain: els.domain.value.trim(),
      pageList: els.pageList.value,
      spreadsheetId: detected.type === "sheet" ? detected.value : "",
      folderId: detected.type === "folder" ? detected.value : "",
      sourceLink: els.sourceLink.value.trim(),
      folderRecursive: false,
      folderMaxFiles: 50,
      language: getSelectedLanguages()[0] || "en",
      languages: getSelectedLanguages(),
      pageType: "general",
      intent: "search",
      titleMax: Number(els.titleMax.value) || 60,
      descMax: Number(els.descMax.value) || 155,
      variantCount: state.mode === "ai" ? Number(els.variantCount.value) || 1 : 1,
      titleTemplate: els.titleTemplate.value,
      descTemplate: els.descTemplate.value,
      voice: els.voice.value,
      primaryKeyword: els.primaryKeyword.value.trim(),
      aiBrief: els.aiBrief.value.trim(),
      outputMode: getOutputMode(),
      outputTabName: els.outputTabName.value.trim() || "Meta Tags",
      outputStartCell: getOutputStartCell(),
      outputStartColumn: cleanColumn(els.outputStartColumn.value),
      outputStartRow: cleanRow(els.outputStartRow.value),
      activeRules: Array.from(state.activeRules),
    };
  }

  function applySetup(setup) {
    if (!setup || typeof setup !== "object") return;
    state.mode = setup.mode === "ai" ? "ai" : "template";
    state.sourceType = ["manual", "sheet", "folder"].includes(setup.sourceType) ? setup.sourceType : "manual";
    state.activeRules = new Set(Array.isArray(setup.activeRules) ? setup.activeRules : ["brandInTitle", "includeH1", "openGraph"]);
    setValue(els.brandName, setup.brandName);
    setValue(els.domain, setup.domain);
    setValue(els.pageList, setup.pageList);
    setValue(els.sourceLink, setup.sourceLink || setup.spreadsheetId || setup.folderId);
    setLanguages(setup.languages || [setup.language || "en"]);
    setValue(els.titleMax, setup.titleMax);
    setValue(els.descMax, setup.descMax);
    setValue(els.variantCount, setup.variantCount);
    setValue(els.titleTemplate, setup.titleTemplate);
    setValue(els.descTemplate, setup.descTemplate);
    setValue(els.voice, setup.voice);
    setValue(els.primaryKeyword, setup.primaryKeyword);
    setValue(els.aiBrief, setup.aiBrief);
    setValue(els.outputMode, setup.outputMode);
    setValue(els.outputTabName, setup.outputTabName);
    const start = splitCell(setup.outputStartCell || "A1");
    setValue(els.outputStartColumn, setup.outputStartColumn || start.col);
    setValue(els.outputStartRow, setup.outputStartRow || start.row);
    renderMode();
    renderSourceType();
    renderOutputMode();
    renderRules();
    renderLanguages();
    updatePreview();
  }

  function setValue(el, value) {
    if (el == null || value == null) return;
    el.value = String(value);
  }

  function pagesFromSetup(setup) {
    if (setup.sourceType === "folder" || setup.sourceType === "sheet") {
      const hasSource = setup.sourceType === "folder" ? setup.folderId : setup.spreadsheetId;
      const label = hasSource
        ? (setup.sourceType === "folder" ? "Drive folder topics" : "Spreadsheet file topic")
        : (setup.sourceType === "folder" ? "Paste a Drive folder first" : "Paste a Google Sheet first");
      return [{ raw: label, page: label, path: setup.sourceType === "folder" ? "drive-folder-topics" : "spreadsheet-file-topic" }];
    }

    return String(setup.pageList || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const urlMatch = line.match(/^https?:\/\/[^/]+\/?(.*)$/i);
        const path = urlMatch ? urlMatch[1].replace(/\/$/, "") : "";
        const page = urlMatch && path ? titleFromSlug(path.split("/").filter(Boolean).pop() || line) : line;
        return { raw: line, page: cleanPageName(page), path: path || slugify(line) };
      });
  }

  function detectSource(input) {
    const value = String(input || "").trim();
    if (!value) return { type: "manual", value: "" };
    if (/\/folders\//i.test(value) || /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//i.test(value)) {
      return { type: "folder", value };
    }
    if (/\/spreadsheets\/d\//i.test(value) || /docs\.google\.com\/spreadsheets/i.test(value)) {
      return { type: "sheet", value };
    }
    return { type: "sheet", value };
  }

  function cleanPageName(input) {
    return String(input || "")
      .replace(/^https?:\/\/[^/]+\/?/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function titleFromSlug(slug) {
    return String(slug || "").replace(/[-_]+/g, " ");
  }

  function slugify(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/^https?:\/\/[^/]+\/?/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page";
  }

  function fillTemplate(template, data) {
    return String(template || "").replace(/\{\{\s*(page|brand|intent|type|domain)\s*\}\}/g, (_, key) => data[key] || "");
  }

  function limitSentence(text, max) {
    let s = String(text || "").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    const hard = s.slice(0, max + 1);
    const sentence = hard.replace(/\s+\S*$/, "").replace(/[,.:\- ]+$/, "");
    return sentence || s.slice(0, max).trim();
  }

  function getLanguageCopy(lang) {
    return copy[lang] || copy.en;
  }

  function localizeTemplateTitle(language, page, currentTitle) {
    const defaultLike = currentTitle === page || currentTitle === `${page} | FAQ`;
    if (!defaultLike) return currentTitle;
    return {
      he: `${page} | שאלות נפוצות`,
      de: `${page} | FAQ`,
      fr: `${page} | FAQ`,
      es: `${page} | Preguntas frecuentes`,
      it: `${page} | FAQ`,
    }[language] || currentTitle;
  }

  function localizeTemplateDescription(language, page, currentDescription) {
    if (!String(currentDescription).toLowerCase().startsWith("explore ")) return currentDescription;
    return {
      he: `גלו מידע שימושי על ${page}, כולל פרטים חשובים, שירותים, מיקום והכוונה מעשית לפני ההזמנה.`,
      de: `Entdecken Sie nuetzliche Informationen zu ${page}, darunter wichtige Details, Services, Lage und praktische Hinweise vor der Buchung.`,
      fr: `Decouvrez les informations utiles sur ${page}, avec les details essentiels, les services, la localisation et les conseils pratiques avant de reserver.`,
      es: `Descubre informacion util sobre ${page}, incluidos detalles clave, servicios, ubicacion y orientacion practica antes de reservar.`,
      it: `Scopri informazioni utili su ${page}, inclusi dettagli importanti, servizi, posizione e indicazioni pratiche prima di prenotare.`,
    }[language] || currentDescription;
  }

  function makeTemplateResult(setup, item, variantIndex, language = setup.language) {
      const data = {
        page: item.page,
        brand: setup.brandName || "",
        intent: "search",
        type: "page",
        domain: setup.domain || "example.com",
      };
    let title = fillTemplate(setup.titleTemplate, data);
    let description = fillTemplate(setup.descTemplate, data);
    if (language !== "en") {
      title = localizeTemplateTitle(language, item.page, title);
      description = localizeTemplateDescription(language, item.page, description);
    }
    if (variantIndex === 1) {
      title = state.activeRules.has("brandInTitle") ? `${item.page} - ${setup.brandName}` : item.page;
      description = `Useful information about ${item.page}, including details, services and next steps for visitors.`;
    }
    if (variantIndex === 2) {
      title = `${item.page}: Guide and Details`;
      description = `Review ${item.page} with clear, practical guidance from ${setup.brandName || "the brand"}.`;
    }
    if (state.activeRules.has("cta")) {
      description = `${description} ${getLanguageCopy(language).cta}`;
    }
    return finalizeResult(setup, item, title, description, language);
  }

  function makeAiResult(setup, item, variantIndex, language = setup.language) {
    const langCopy = getLanguageCopy(language);
    const keyword = setup.primaryKeyword || item.page;
    const voice = setup.voice;
    const voicePhrase = {
      clear: "Clear information",
      premium: "Premium guidance",
      direct: "Practical details",
      warm: "Helpful guest guidance",
    }[voice] || "Clear information";
    const titleOptions = [
      state.activeRules.has("brandInTitle") ? `${item.page} | ${setup.brandName}` : `${item.page} Guide`,
      `${keyword} - ${setup.brandName || item.page}`,
      `${item.page}: Search-Friendly Metadata`,
    ];
    const descOptions = [
      `${voicePhrase} for ${item.page}. Learn what matters, compare key details and decide if ${setup.brandName || "this page"} fits your needs.`,
      `Explore ${item.page} with search-friendly details, useful context and a clear next step.`,
      `${setup.aiBrief || langCopy.faqDesc} ${state.activeRules.has("cta") ? langCopy.cta : ""}`,
    ];
    return finalizeResult(setup, item, titleOptions[variantIndex] || titleOptions[0], descOptions[variantIndex] || descOptions[0], language);
  }

  function finalizeResult(setup, item, title, description, language = setup.language) {
    const titleMax = setup.titleMax || 60;
    const descMax = setup.descMax || 155;
    const finalTitle = limitSentence(title, titleMax);
    const finalDescription = limitSentence(description, descMax);
    const h1 = state.activeRules.has("includeH1") ? item.page : "";
    const url = makeUrl(setup.domain, item.path);
    return {
      language,
      page: item.page,
      url,
      metaTitle: finalTitle,
      metaDescription: finalDescription,
      h1,
      ogTitle: state.activeRules.has("openGraph") ? finalTitle : "",
      ogDescription: state.activeRules.has("openGraph") ? finalDescription : "",
      titleLength: finalTitle.length,
      descriptionLength: finalDescription.length,
      status: scoreRow(setup, finalTitle, finalDescription),
    };
  }

  function makeUrl(domain, path) {
    const cleanDomain = String(domain || "example.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const cleanPath = String(path || "page").replace(/^\/+/, "");
    return `https://${cleanDomain}/${cleanPath}`;
  }

  function scoreRow(setup, title, description) {
    const keyword = (setup.primaryKeyword || "").toLowerCase();
    const titleOk = title.length >= 30 && title.length <= setup.titleMax;
    const descOk = description.length >= 80 && description.length <= setup.descMax;
    const keywordOk = !keyword || `${title} ${description}`.toLowerCase().includes(keyword.split(/\s+/)[0]);
    if (titleOk && descOk && keywordOk) return "good";
    if (title.length > setup.titleMax || description.length > setup.descMax) return "bad";
    return "warn";
  }

  function intentLabel(intent) {
    return {
      book: "booking",
      compare: "comparison",
      learn: "learning",
      support: "support",
    }[intent] || "search";
  }

  function typeLabel(type) {
    return {
      hotel: "hotel",
      local: "local business",
      product: "product",
      faq: "FAQ",
      article: "guide",
    }[type] || "page";
  }

  function generateResults() {
    const setup = getSetup();
    const needsBackend = state.mode === "ai" || setup.sourceType === "folder" || setup.sourceType === "sheet" || setup.outputMode !== "preview";

    if (setup.outputMode !== "preview" && setup.sourceType === "manual") {
      addLog("Choose Single sheet or Drive folder before writing tags back to a spreadsheet.", "warn");
      return;
    }

    if (needsBackend && socket?.connected) {
      runBackendGeneration(setup);
      return;
    }

    if ((setup.sourceType === "folder" || setup.sourceType === "sheet" || setup.outputMode !== "preview") && !socket?.connected) {
      addLog("Sheet and folder sources require the backend connection.", "warn");
      return;
    }

    if (state.mode === "ai" && !socket?.connected) {
      addLog("Backend is not connected. Using local AI-style draft instead.", "warn");
    }

    const pages = pagesFromSetup(setup);
    const count = state.mode === "ai" ? Math.max(1, Math.min(3, setup.variantCount)) : 1;
    const results = [];
    const languages = getSelectedLanguages();
    pages.forEach((item) => {
      languages.forEach((language) => {
      for (let i = 0; i < count; i++) {
        results.push(state.mode === "ai" ? makeAiResult(setup, item, i, language) : makeTemplateResult(setup, item, i, language));
      }
      });
    });
    state.results = results;
    renderResults();
    updatePreview();
    addLog(`Generated ${results.length} metadata rows from ${pages.length} page${pages.length === 1 ? "" : "s"}.`, "success");
    addLog(`Mode: ${state.mode === "ai" ? "AI assisted brief" : "Template engine"}.`, "dim");
    els.summaryText.textContent = `${results.length} draft rows ready for review`;
  }

  function runBackendGeneration(setup) {
    state.pendingBackendJson = false;
    state.backendJsonLines = [];
    els.generateBtn.disabled = true;
    els.generateBtn.textContent = "Generating...";
    els.summaryText.textContent = setup.mode === "ai"
      ? "AI generation running"
      : setup.sourceType === "manual"
        ? "Template generation running"
        : "Sheet topics resolving";
    addLog(
      setup.mode === "ai"
        ? "Sending metadata brief to backend AI job."
        : "Sending template setup to backend source resolver.",
      "info"
    );
    if (setup.sourceType === "folder") {
      addLog("Folder topics will be resolved from spreadsheet file names.", "dim");
    }
    if (setup.sourceType === "sheet") {
      addLog("Single-sheet topic will be resolved from the spreadsheet file name.", "dim");
    }
    if (setup.outputMode !== "preview") {
      const targetLabel = setup.outputMode === "newTab"
        ? `a dedicated "${setup.outputTabName}" tab starting at column ${setup.outputStartColumn}, row ${setup.outputStartRow}`
        : setup.outputMode === "firstTabRange"
          ? `the first tab, starting at column ${setup.outputStartColumn}, row ${setup.outputStartRow}.`
          : `the "${setup.outputTabName || "Meta Tags"}" tab starting at column ${setup.outputStartColumn}, row ${setup.outputStartRow}.`;
      addLog(`Generated tags will be written to ${targetLabel}.`, "dim");
    }
    socket.emit("start-agent", {
      ...setup,
      mode: "meta-tags",
      generationMode: setup.mode,
    });
  }

  function finishBackendGeneration() {
    const raw = state.backendJsonLines.join("\n").trim();
    state.pendingBackendJson = false;
    state.backendJsonLines = [];
    els.generateBtn.disabled = false;
    els.generateBtn.textContent = "Generate tags";

    if (!raw) {
      addLog("Backend returned an empty metadata result.", "warn");
      return;
    }

    try {
      const result = JSON.parse(raw);
      state.results = Array.isArray(result.rows) ? result.rows : [];
      renderResults();
      updatePreview();
      els.summaryText.textContent = `${state.results.length} metadata rows ready`;
      addLog(`Loaded ${state.results.length} generated metadata rows.`, "success");
      if (result.summary?.writeback?.enabled) {
        if (result.summary.writeback.error) {
          addLog(`Writeback did not complete: ${result.summary.writeback.error}`, "warn");
        } else {
          addLog(`Writeback complete: ${result.summary.writeback.writes || 0} spreadsheet update${result.summary.writeback.writes === 1 ? "" : "s"}.`, "success");
        }
      }
    } catch (error) {
      addLog(`Could not parse backend metadata JSON: ${error.message}`, "warn");
    }
  }

  function renderResults() {
    if (!state.results.length) {
      els.resultsBody.innerHTML = `<tr><td colspan="5">Generate tags to see editable output rows.</td></tr>`;
      return;
    }
    els.resultsBody.innerHTML = state.results.map((row, index) => `
      <tr>
        <td><span class="chip active">${escapeHtml(row.language || "en")}</span></td>
        <td>
          <strong>${escapeHtml(row.page)}</strong><br>
          <span class="hint">${escapeHtml(row.status)}</span>
        </td>
        <td><textarea class="editable-output" data-index="${index}" data-field="metaTitle">${escapeHtml(row.metaTitle)}</textarea><span class="hint">${row.titleLength} chars</span></td>
        <td><textarea class="editable-output" data-index="${index}" data-field="metaDescription">${escapeHtml(row.metaDescription)}</textarea><span class="hint">${row.descriptionLength} chars</span></td>
        <td><textarea class="editable-output" data-index="${index}" data-field="h1">${escapeHtml(row.h1)}</textarea></td>
      </tr>
    `).join("");
  }

  function updatePreview() {
    const setup = getSetup();
    const pages = pagesFromSetup(setup);
    els.previewBadge.textContent = `${pages.length} page${pages.length === 1 ? "" : "s"}`;
    const expectedRows = pages.length * getSelectedLanguages().length * (state.mode === "ai" ? setup.variantCount : 1);
    els.rowScore.textContent = state.results.length || expectedRows;

    const preview = state.results[0] || (pages[0]
      ? (state.mode === "ai" ? makeAiResult(setup, pages[0], 0) : makeTemplateResult(setup, pages[0], 0))
      : null);

    if (!preview) return;
    els.serpUrl.textContent = preview.url;
    els.serpTitle.textContent = preview.metaTitle;
    els.serpDesc.textContent = preview.metaDescription;
    els.titleScore.textContent = preview.titleLength;
    els.descScore.textContent = preview.descriptionLength;
    setScoreClass(els.titleScoreCard, preview.titleLength, 30, setup.titleMax);
    setScoreClass(els.descScoreCard, preview.descriptionLength, 80, setup.descMax);
    const keyword = setup.primaryKeyword;
    const hasKeyword = !keyword || `${preview.metaTitle} ${preview.metaDescription}`.toLowerCase().includes(keyword.toLowerCase().split(/\s+/)[0]);
    els.keywordScore.textContent = hasKeyword ? "OK" : "Check";
    els.keywordScoreCard.className = `quality-card ${hasKeyword ? "good" : "warn"}`;
  }

  function setScoreClass(card, value, min, max) {
    const status = value > max ? "bad" : value >= min ? "good" : "warn";
    card.className = `quality-card ${status}`;
  }

  function renderMode() {
    els.modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === state.mode);
    });
    els.templatePanel.classList.toggle("hidden", state.mode !== "template");
    els.aiPanel.classList.toggle("hidden", state.mode !== "ai");
    els.summaryText.textContent = state.mode === "ai" ? "AI brief mode selected" : "Template mode selected";
  }

  function renderSourceType() {
    const detected = detectSource(els.sourceLink.value);
    state.sourceType = detected.type;
    const labels = {
      manual: "Manual fallback",
      sheet: "Detected: Google Sheet",
      folder: "Detected: Drive folder",
    };
    els.detectedSource.textContent = labels[state.sourceType];
    if (els.manualTopicsDetails) {
      els.manualTopicsDetails.classList.toggle("hidden", state.sourceType !== "manual");
    }
    if (state.sourceType === "folder") {
      els.summaryText.textContent = "Drive folder source selected";
    }
    if (state.sourceType === "sheet") {
      els.summaryText.textContent = "Single sheet source selected";
    }
    if (state.sourceType === "manual") {
      els.summaryText.textContent = "Manual topics fallback selected";
    }
  }

  function renderOutputMode() {
    const mode = getOutputMode();
    const writing = mode !== "preview";
    els.writebackFields.classList.toggle("hidden", !writing);
    els.outputTabNameField?.classList.toggle("hidden", mode === "firstTabRange");
    if (mode === "preview") {
      els.outputModeHint.textContent = "Manual topics stay in this screen because there is no spreadsheet to write back to.";
    }
    if (mode === "newTab") {
      if (!els.outputTabName.value.trim()) els.outputTabName.value = "Meta Tags";
      ensureOutputPosition();
      els.outputModeHint.textContent = `Writes to a tab named "${els.outputTabName.value || "Meta Tags"}", starting at column ${cleanColumn(els.outputStartColumn.value)}, row ${cleanRow(els.outputStartRow.value)}. The output spans 9 columns.`;
    }
    if (mode === "firstTabRange") {
      ensureOutputPosition();
      els.outputModeHint.textContent = `Writes into the first tab of the source file, starting at column ${cleanColumn(els.outputStartColumn.value)}, row ${cleanRow(els.outputStartRow.value)}. The output spans 9 columns.`;
    }
    if (mode === "existingRange") {
      ensureOutputPosition();
      els.outputModeHint.textContent = `Writes to the named tab, starting at column ${cleanColumn(els.outputStartColumn.value)}, row ${cleanRow(els.outputStartRow.value)}. The output spans 9 columns.`;
    }
    if (writing && state.sourceType === "manual") {
      els.summaryText.textContent = "Choose a sheet source to write back";
    }
  }

  function getOutputMode() {
    const detected = detectSource(els.sourceLink.value);
    if (detected.type === "manual") return "preview";
    if (els.outputMode.value === "firstTabRange") return "firstTabRange";
    if (els.outputMode.value === "existingRange") return "existingRange";
    return "newTab";
  }

  function ensureOutputPosition() {
    if (!els.outputStartColumn.value.trim()) els.outputStartColumn.value = "A";
    if (!els.outputStartRow.value.trim()) els.outputStartRow.value = "1";
  }

  function cleanColumn(value) {
    const column = String(value || "A").trim().toUpperCase().replace(/[^A-Z]/g, "");
    return column || "A";
  }

  function cleanRow(value) {
    const row = Number(value) || 1;
    return Math.max(1, Math.floor(row));
  }

  function getOutputStartCell() {
    return `${cleanColumn(els.outputStartColumn.value)}${cleanRow(els.outputStartRow.value)}`;
  }

  function splitCell(cell) {
    const match = String(cell || "A1").trim().toUpperCase().match(/^([A-Z]+)([1-9][0-9]*)$/);
    return match ? { col: match[1], row: match[2] } : { col: "A", row: "1" };
  }

  function getSelectedLanguages() {
    const selected = els.languageButtons
      .filter((button) => button.classList.contains("active"))
      .map((button) => button.dataset.lang)
      .filter(Boolean);
    return selected.length ? selected : ["en"];
  }

  function setLanguages(languages) {
    const selected = new Set((Array.isArray(languages) ? languages : [languages]).filter(Boolean));
    if (!selected.size) selected.add("en");
    els.languageButtons.forEach((button) => {
      button.classList.toggle("active", selected.has(button.dataset.lang));
    });
  }

  function renderLanguages() {
    const selected = new Set(getSelectedLanguages());
    els.languageButtons.forEach((button) => {
      button.classList.toggle("active", selected.has(button.dataset.lang));
    });
  }

  function renderRules() {
    els.ruleButtons.forEach((button) => {
      button.classList.toggle("active", state.activeRules.has(button.dataset.rule));
    });
  }

  function saveSetup() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSetup()));
    addLog("Setup saved in this browser.", "success");
    els.summaryText.textContent = "Setup saved locally";
  }

  function loadSetup() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      addLog("No saved setup found in this browser.", "warn");
      return;
    }
    applySetup(JSON.parse(raw));
    addLog("Saved setup loaded.", "success");
    els.summaryText.textContent = "Saved setup loaded";
  }

  function clearAll() {
    state.results = [];
    renderResults();
    addLog("Output cleared.", "dim");
    els.summaryText.textContent = "Waiting for setup";
  }

  function copyCsv() {
    const rows = [["language", "page", "meta_title", "meta_description", "h1"], ...state.results.map((row) => [
      row.language || "en",
      row.page,
      row.metaTitle,
      row.metaDescription,
      row.h1,
    ])];
    copyText(rows.map((row) => row.map(csvCell).join(",")).join("\n"), "CSV copied.");
  }

  function copyJson() {
    copyText(JSON.stringify({ mode: state.mode, setup: getSetup(), results: state.results }, null, 2), "JSON copied.");
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  async function copyText(text, message) {
    if (!text || !state.results.length) {
      addLog("Nothing to copy yet.", "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      addLog(message, "success");
    } catch {
      addLog("Copy failed. Select the generated rows manually.", "warn");
    }
  }

  function applyHotelPreset() {
    const langCopy = getLanguageCopy(getSelectedLanguages()[0] || "en");
    els.titleTemplate.value = langCopy.hotelTitle;
    els.descTemplate.value = langCopy.hotelDesc;
    addLog("Hotel template preset applied.", "info");
    updatePreview();
  }

  function addLog(message, type = "info") {
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    line.textContent = message;
    els.terminalLog.appendChild(line);
    els.terminalLog.scrollTop = els.terminalLog.scrollHeight;
  }

  function clearLog() {
    els.terminalLog.innerHTML = `<div class="log-line dim">Log cleared. Generate tags to see the next run.</div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function bindEvents() {
    els.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode === "ai" ? "ai" : "template";
        renderMode();
        updatePreview();
      });
    });

    els.ruleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const rule = button.dataset.rule;
        if (state.activeRules.has(rule)) state.activeRules.delete(rule);
        else state.activeRules.add(rule);
        renderRules();
        updatePreview();
      });
    });

    els.languageButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const active = els.languageButtons.filter((item) => item.classList.contains("active"));
        if (button.classList.contains("active") && active.length === 1) return;
        button.classList.toggle("active");
        updatePreview();
      });
    });

    [
      els.brandName,
      els.domain,
      els.sourceLink,
      els.pageList,
      els.titleMax,
      els.descMax,
      els.variantCount,
      els.titleTemplate,
      els.descTemplate,
      els.voice,
      els.primaryKeyword,
      els.aiBrief,
      els.outputMode,
      els.outputTabName,
      els.outputStartColumn,
      els.outputStartRow,
    ].filter(Boolean).forEach((el) => {
      el.addEventListener("input", () => {
        renderSourceType();
        renderOutputMode();
        updatePreview();
      });
      el.addEventListener("change", () => {
        renderSourceType();
        renderOutputMode();
        updatePreview();
      });
    });

    els.generateBtn.addEventListener("click", generateResults);
    els.saveSetupBtn.addEventListener("click", saveSetup);
    els.loadSetupBtn.addEventListener("click", loadSetup);
    els.copyCsvBtn.addEventListener("click", copyCsv);
    els.copyJsonBtn.addEventListener("click", copyJson);
    els.clearBtn.addEventListener("click", clearAll);
    els.clearLogBtn.addEventListener("click", clearLog);
    els.applyPresetBtn.addEventListener("click", applyHotelPreset);

    if (socket) {
      socket.on("connect", () => addLog("Backend socket connected.", "dim"));
      socket.on("disconnect", () => addLog("Backend socket disconnected.", "warn"));
      socket.on("log", (line) => {
        const clean = String(line || "").trimEnd();
        if (clean === "META_TAGS_RESULT_JSON_START") {
          state.pendingBackendJson = true;
          state.backendJsonLines = [];
          return;
        }
        if (clean === "META_TAGS_RESULT_JSON_END") {
          finishBackendGeneration();
          return;
        }
        if (state.pendingBackendJson) {
          state.backendJsonLines.push(clean);
          return;
        }
        addLog(clean.replace(/\u001b\[[0-9;]*m/g, ""), clean.includes("failed") ? "warn" : "dim");
      });
      socket.on("done", () => {
        els.generateBtn.disabled = false;
        els.generateBtn.textContent = "Generate tags";
      });
    }

    els.resultsBody.addEventListener("input", (event) => {
      const target = event.target;
      if (!target.matches(".editable-output")) return;
      const index = Number(target.dataset.index);
      const field = target.dataset.field;
      if (!state.results[index] || !field) return;
      state.results[index][field] = target.value;
      if (field === "metaTitle") state.results[index].titleLength = target.value.length;
      if (field === "metaDescription") state.results[index].descriptionLength = target.value.length;
      updatePreview();
    });
  }

  bindEvents();
  renderMode();
  renderSourceType();
  renderOutputMode();
  renderRules();
  updatePreview();
})();
