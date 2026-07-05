(() => {
  if (window.CarmelonGlobalWorkflowNav?.mounted) return;

  const toolHrefMap = {
    "faq-playground": "./faq-playground.html",
    "translate-demo": "./translate-demo.html",
    "design-formatting": "./design-formatting.html",
    "sheet-utilities": "./sheet-utilities.html",
    "client-reports": "./client-reports.html",
    "client-reports-edit": "./client-reports-edit.html",
    "site-ai-audit": "./site-ai-audit.html",
    "site-ai-faq-audit": "./site-ai-faq-audit.html",
    "schema-builder": "./schema-builder.html",
    "meta-tags": "./meta-tags.html",
    "file-draft": "./assistant-workspace.html",
    "assistant-workspace": "./assistant-workspace.html"
  };

  const toolLabelMap = {
    "faq-playground": "FAQ Builder",
    "translate-demo": "Translation",
    "design-formatting": "Formatting",
    "sheet-utilities": "Sheet Utilities",
    "client-reports": "Client Reports",
    "client-reports-edit": "Reports Edit",
    "site-ai-audit": "Site Audit",
    "site-ai-faq-audit": "FAQ Audit",
    "schema-builder": "Schema Builder",
    "meta-tags": "Meta Tags",
    "file-draft": "Assistant"
  };

  const state = {
    query: "",
    groups: [],
    expanded: new Set(),
    lastFocus: null
  };

  const mainPageOrder = [
    "faq-build-hotel",
    "sheet-edit-general",
    "translation-main",
    "schema-builder-faqpage",
    "meta-tags-create",
    "faq-audit-implementation",
    "site-audit-general",
    "client-reports-ga4",
    "sheet-utilities-general",
    "file-draft-local"
  ];

  const mainPageTitleMap = {
    "faq-build-hotel": "FAQ Workflow Builder",
    "sheet-edit-general": "FAQ Editing Workspace",
    "translation-main": "AI Translation Engine",
    "schema-builder-faqpage": "Schema Builder",
    "meta-tags-create": "Meta Tags Studio",
    "faq-audit-implementation": "AI FAQ Audit",
    "site-audit-general": "AI Site Audit Crawler",
    "client-reports-ga4": "Client Reports",
    "sheet-utilities-general": "Sheet Utilities",
    "file-draft-local": "Code / Local File Edit"
  };

  const mainPageTitleHeMap = {
    "faq-build-hotel": "FAQ Workflow Builder",
    "sheet-edit-general": "FAQ Editing Workspace",
    "translation-main": "AI Translation Engine",
    "schema-builder-faqpage": "Schema Builder",
    "meta-tags-create": "Meta Tags Studio",
    "faq-audit-implementation": "AI FAQ Audit",
    "site-audit-general": "AI Site Audit Crawler",
    "client-reports-ga4": "דוחות לקוח",
    "sheet-utilities-general": "Sheet Utilities",
    "file-draft-local": "עריכת קוד / קובץ מקומי"
  };

  let elements = {};
  const scriptBaseUrl = (() => {
    try {
      return new URL(".", document.currentScript?.src || window.location.href);
    } catch {
      return null;
    }
  })();

  function assetUrl(fileName) {
    if (!scriptBaseUrl) return `./${fileName}`;
    return new URL(fileName, scriptBaseUrl).href;
  }

  function ensureStylesheet() {
    if (document.querySelector('link[href$="global-workflow-nav.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetUrl("global-workflow-nav.css");
    document.head.appendChild(link);
  }

  function ensureFeatureIndex() {
    if (Array.isArray(window.CarmelonAssistantFeatureIndex?.features)) return Promise.resolve();
    const existing = document.querySelector('script[src$="assistant-feature-index.js"]');
    if (existing) {
      return new Promise((resolve) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", resolve, { once: true });
        window.setTimeout(resolve, 800);
      });
    }
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = assetUrl("assistant-feature-index.js");
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  function compact(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hasHebrew(value) {
    return /[\u0590-\u05ff]/.test(String(value || ""));
  }

  function messageDir(value) {
    return hasHebrew(value) ? "rtl" : "ltr";
  }

  function prefersHebrew() {
    return hasHebrew(state.query) || document.documentElement.lang === "he" || document.documentElement.dir === "rtl";
  }

  function features() {
    return Array.isArray(window.CarmelonAssistantFeatureIndex?.features)
      ? window.CarmelonAssistantFeatureIndex.features
      : [];
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0591-\u05c7]/g, "")
      .replace(/[ך]/g, "כ")
      .replace(/[ם]/g, "מ")
      .replace(/[ן]/g, "נ")
      .replace(/[ף]/g, "פ")
      .replace(/[ץ]/g, "צ")
      .replace(/פאק/g, "faq")
      .replace(/מטה/g, "מטא")
      .replace(/סכימות|סכמות|סכימה/g, "סכמה")
      .replace(/\bscema\b|\bshema\b|\bschmea\b/g, "schema")
      .replace(/[_/|+()[\]{}.,:;!?'"`~\u05be\u2013\u2014-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(value) {
    return normalizeSearchText(value)
      .split(/\s+/)
      .map(compact)
      .filter((token) => token.length > 1);
  }

  function isSubsequence(needle, haystack) {
    if (!needle || !haystack || needle.length < 4 || haystack.length < 4) return false;
    let index = 0;
    for (const char of haystack) {
      if (char === needle[index]) index += 1;
      if (index === needle.length) return true;
    }
    return false;
  }

  function fuzzyTokenMatch(term, haystackTokens) {
    if (!term) return false;
    return haystackTokens.some((token) => (
      token === term ||
      token.startsWith(term) ||
      term.startsWith(token) ||
      isSubsequence(term, token)
    ));
  }

  function localized(feature, key, hebrew = prefersHebrew()) {
    if (hebrew) return feature[`${key}He`] || feature[key] || "";
    return feature[key] || feature[`${key}He`] || "";
  }

  function hrefFor(feature) {
    return feature.href || toolHrefMap[feature.toolId] || "./assistant-workspace.html";
  }

  function isGeneral(feature) {
    return feature.kind === "general" || !feature.parentId;
  }

  function mainOrderFor(groupOrFeature) {
    const id = groupOrFeature.id || groupOrFeature.parent?.id || "";
    const index = mainPageOrder.indexOf(id);
    return index === -1 ? mainPageOrder.length + 50 : index;
  }

  function menuTitleFor(feature, hebrew = prefersHebrew()) {
    if (hebrew) return mainPageTitleHeMap[feature.id] || localized(feature, "title", hebrew);
    return mainPageTitleMap[feature.id] || localized(feature, "title", hebrew);
  }

  function toolLabelFor(feature) {
    return feature.toolTitle || toolLabelMap[feature.toolId] || feature.toolId || "Workflow";
  }

  function haystackFor(feature) {
    return normalizeSearchText([
      feature.id,
      feature.toolId,
      feature.parentId,
      feature.kind,
      feature.title,
      feature.titleHe,
      feature.group,
      feature.description,
      feature.descriptionHe,
      feature.prompt,
      feature.promptHe,
      toolLabelFor(feature),
      ...(feature.keywords || []),
      ...(feature.subfeatures || [])
    ].filter(Boolean).join(" "));
  }

  function scoreFeature(feature, query) {
    const normalizedQuery = normalizeSearchText(query);
    const basePriority = Number(feature.priority) || 0;
    if (!normalizedQuery) return basePriority;

    const title = normalizeSearchText(`${feature.title || ""} ${feature.titleHe || ""}`);
    const description = normalizeSearchText(`${feature.description || ""} ${feature.descriptionHe || ""}`);
    const keywords = normalizeSearchText((feature.keywords || []).join(" "));
    const subfeatures = normalizeSearchText((feature.subfeatures || []).join(" "));
    const haystack = haystackFor(feature);
    const queryTerms = tokens(normalizedQuery);
    const haystackTokens = tokens(haystack);
    let score = 0;

    if (title.includes(normalizedQuery)) score += 80;
    if (keywords.includes(normalizedQuery)) score += 70;
    if (subfeatures.includes(normalizedQuery)) score += 52;
    if (description.includes(normalizedQuery)) score += 30;
    if (haystack.includes(normalizedQuery)) score += 24;

    let matched = 0;
    queryTerms.forEach((term) => {
      if (title.includes(term)) score += 26;
      if (keywords.includes(term)) score += 22;
      if (subfeatures.includes(term)) score += 18;
      if (description.includes(term)) score += 8;
      if (haystack.includes(term) || fuzzyTokenMatch(term, haystackTokens)) {
        matched += 1;
        score += 10;
      }
    });

    if (!matched && !score) return 0;
    score += Math.round((matched / Math.max(queryTerms.length, 1)) * 35);
    if (feature.toolId === "file-draft" && /\b(sheet|sheets|spreadsheet|google sheet)\b|גיליון|גוגל\s*שיט|שיט/.test(normalizedQuery)) {
      score -= 90;
    }
    if (feature.kind === "general") score += 12;
    return score + Math.min(basePriority, 100) / 20;
  }

  function groupsFor(query = "") {
    const allFeatures = features();
    const byId = new Map(allFeatures.map((feature) => [feature.id, feature]));
    const groupMap = new Map();

    allFeatures.forEach((feature) => {
      const parentId = feature.parentId && byId.has(feature.parentId) ? feature.parentId : feature.id;
      const parent = byId.get(parentId) || feature;
      const group = groupMap.get(parentId) || {
        id: parentId,
        parent,
        parentScore: 0,
        children: [],
        score: 0,
        order: Number(parent.priority) || 0
      };

      const score = query ? scoreFeature(feature, query) : Number(feature.priority) || 0;
      if (feature.id === parentId) {
        group.parent = feature;
        group.parentScore = Math.max(group.parentScore, score);
      } else {
        group.children.push({ feature, score });
      }
      group.score = Math.max(group.score, score);
      group.order = Math.max(group.order, Number(feature.priority) || 0);
      groupMap.set(parentId, group);
    });

    let groups = Array.from(groupMap.values()).map((group) => ({
      ...group,
      children: group.children
        .sort((a, b) => b.score - a.score || (b.feature.priority || 0) - (a.feature.priority || 0))
        .map((item) => item.feature)
    }));

    if (query) {
      groups = groups
        .map((group) => {
          const parentMatched = scoreFeature(group.parent, query) > 0;
          const matchingChildren = group.children.filter((child) => scoreFeature(child, query) > 0);
          if (!parentMatched && !matchingChildren.length) return null;
          const childBest = matchingChildren.reduce((max, child) => Math.max(max, scoreFeature(child, query)), 0);
          return {
            ...group,
            children: parentMatched && !matchingChildren.length ? group.children.slice(0, 4) : matchingChildren,
            score: Math.max(scoreFeature(group.parent, query), childBest + (matchingChildren.length ? 10 : 0))
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || mainOrderFor(a) - mainOrderFor(b) || b.order - a.order);
    } else {
      groups = groups
        .filter((group) => isGeneral(group.parent))
        .sort((a, b) => mainOrderFor(a) - mainOrderFor(b) || b.order - a.order);
    }

    return groups.slice(0, query ? 8 : 20);
  }

  function search(query = "") {
    return groupsFor(query)
      .flatMap((group) => [group.parent, ...group.children])
      .filter((feature, index, values) => values.findIndex((item) => item.id === feature.id) === index);
  }

  function childItem(feature) {
    const hebrew = prefersHebrew();
    const title = localized(feature, "title", hebrew);
    return `
      <a class="workflow-menu-link workflow-menu-child" href="${escapeHtml(hrefFor(feature))}" data-workflow-id="${escapeHtml(feature.id)}">
        <span class="workflow-menu-copy">
          <strong dir="${messageDir(title)}">${escapeHtml(title)}</strong>
        </span>
      </a>
    `;
  }

  function groupBlock(group) {
    const hebrew = prefersHebrew();
    const parentTitle = menuTitleFor(group.parent, hebrew);
    const description = localized(group.parent, "description", hebrew);
    const expanded = state.expanded.has(group.id);
    const hasDetails = Boolean(description || group.children.length);
    const childList = group.children.map(childItem).join("");
    const detailsId = `workflowMenuDetails-${group.id}`;
    return `
      <section class="workflow-menu-section" data-workflow-group="${escapeHtml(group.id)}" data-expanded="${expanded ? "true" : "false"}" role="listitem">
        <div class="workflow-menu-row">
          <a class="workflow-menu-link workflow-menu-parent" href="${escapeHtml(hrefFor(group.parent))}" data-workflow-id="${escapeHtml(group.parent.id)}">
            <span class="workflow-menu-copy">
              <strong dir="${messageDir(parentTitle)}">${escapeHtml(parentTitle)}</strong>
            </span>
          </a>
          ${hasDetails ? `<button class="workflow-menu-toggle" type="button" aria-expanded="${expanded ? "true" : "false"}" aria-controls="${escapeHtml(detailsId)}" data-workflow-toggle="${escapeHtml(group.id)}" aria-label="${escapeHtml(hebrew ? `פתיחת פרטים עבור ${parentTitle}` : `Show options for ${parentTitle}`)}"><span></span></button>` : ""}
        </div>
        ${hasDetails ? `
          <div class="workflow-menu-details" id="${escapeHtml(detailsId)}" ${expanded ? "" : "hidden"}>
            ${description ? `<p class="workflow-menu-description" dir="${messageDir(description)}">${escapeHtml(description)}</p>` : ""}
            ${childList ? `<div class="workflow-submenu">${childList}</div>` : ""}
          </div>
        ` : ""}
      </section>
    `;
  }

  function renderMenuGroups(groups) {
    return groups.map(groupBlock).join("");
  }

  function setChromeLanguage(hebrew = prefersHebrew()) {
    if (elements.drawer) elements.drawer.dir = hebrew ? "rtl" : "ltr";
    if (elements.title) elements.title.textContent = hebrew ? "תפריט עבודה" : "Workflow menu";
    if (elements.subtitle) {
      elements.subtitle.textContent = hebrew
        ? "בחירת כלי עבודה או חיפוש לפי פעולה פנימית."
        : "Choose a workspace or search by inner feature.";
    }
    if (elements.input) {
      elements.input.placeholder = hebrew
        ? "חיפוש כלי או פעולה..."
        : "Search tools or inner features...";
    }
    if (elements.closeButton) {
      elements.closeButton.setAttribute("aria-label", hebrew ? "סגירת תפריט עבודה" : "Close workflow menu");
    }
    if (elements.trigger) {
      const open = document.body.classList.contains("workflow-nav-open");
      elements.trigger.setAttribute("aria-label", hebrew
        ? (open ? "סגירת תפריט עבודה" : "פתיחת תפריט עבודה")
        : (open ? "Close workflow menu" : "Open workflow menu"));
    }
  }

  function render() {
    if (!elements.results) return;
    state.query = elements.input?.value || "";
    state.groups = groupsFor(state.query);
    const hebrew = prefersHebrew();
    setChromeLanguage(hebrew);
    if (elements.count) {
      const count = state.groups.length;
      elements.count.textContent = hebrew ? `${count} כלים` : `${count} tools`;
    }
    if (elements.hint) {
      elements.hint.textContent = state.query ? (hebrew ? "חיפוש פעיל" : "Search active") : (hebrew ? "תפריט מלא" : "Full menu");
    }
    if (!state.groups.length) {
      elements.results.innerHTML = `<div class="workflow-empty">${hebrew ? "לא נמצאה התאמה. אפשר לנסח אחרת או לפתוח את הצ׳אט הראשי." : "No matching workflow found. Try another phrase or open the main assistant chat."}</div>`;
      return;
    }
    elements.results.innerHTML = renderMenuGroups(state.groups);
  }

  function open() {
    if (!elements.drawer) return;
    state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    elements.drawer.hidden = false;
    elements.overlay.hidden = false;
    render();
    elements.drawer.getBoundingClientRect();
    window.requestAnimationFrame(() => {
      document.body.classList.add("workflow-nav-open");
      elements.trigger.setAttribute("aria-expanded", "true");
      setChromeLanguage();
      window.setTimeout(() => elements.input?.focus(), 180);
    });
  }

  function close() {
    if (!elements.drawer) return;
    document.body.classList.remove("workflow-nav-open");
    elements.trigger.setAttribute("aria-expanded", "false");
    setChromeLanguage();
    window.setTimeout(() => {
      if (!document.body.classList.contains("workflow-nav-open")) {
        elements.drawer.hidden = true;
        elements.overlay.hidden = true;
      }
    }, 220);
    state.lastFocus?.focus?.();
  }

  function mount() {
    if (document.querySelector("[data-workflow-nav-mounted]")) return;
    ensureStylesheet();
    const root = document.createElement("div");
    root.dataset.workflowNavMounted = "true";
    root.innerHTML = `
      <button class="workflow-nav-trigger" type="button" aria-label="Open workflow menu" aria-expanded="false" aria-controls="workflowNavDrawer">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="workflow-nav-overlay" hidden></div>
      <aside class="workflow-nav-drawer" id="workflowNavDrawer" role="dialog" aria-modal="true" aria-labelledby="workflowNavTitle" hidden>
        <div class="workflow-nav-head">
          <div>
            <h2 class="workflow-nav-title" id="workflowNavTitle">Workflow menu</h2>
            <p class="workflow-nav-subtitle">Choose a workspace or narrow the menu by search.</p>
          </div>
          <button class="workflow-nav-close" type="button" aria-label="Close workflow search">×</button>
        </div>
        <div class="workflow-nav-search">
          <div class="workflow-search-row">
            <input class="workflow-search-input" type="search" autocomplete="off" placeholder="Search tools or inner features..." />
          </div>
          <div class="workflow-nav-meta">
            <span class="workflow-nav-count">0 results</span>
            <span class="workflow-nav-hint">Top matches</span>
          </div>
        </div>
        <div class="workflow-results" role="list"></div>
      </aside>
    `;
    document.body.appendChild(root);

    elements = {
      root,
      trigger: root.querySelector(".workflow-nav-trigger"),
      overlay: root.querySelector(".workflow-nav-overlay"),
      drawer: root.querySelector(".workflow-nav-drawer"),
      closeButton: root.querySelector(".workflow-nav-close"),
      input: root.querySelector(".workflow-search-input"),
      results: root.querySelector(".workflow-results"),
      title: root.querySelector(".workflow-nav-title"),
      subtitle: root.querySelector(".workflow-nav-subtitle"),
      count: root.querySelector(".workflow-nav-count"),
      hint: root.querySelector(".workflow-nav-hint")
    };

    elements.trigger.addEventListener("click", () => {
      if (document.body.classList.contains("workflow-nav-open")) close();
      else open();
    });
    elements.closeButton.addEventListener("click", close);
    elements.overlay.addEventListener("click", close);
    elements.input.addEventListener("input", render);
    elements.results.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-workflow-toggle]");
      if (toggle) {
        const id = toggle.getAttribute("data-workflow-toggle");
        if (state.expanded.has(id)) state.expanded.delete(id);
        else state.expanded.add(id);
        render();
        return;
      }
      const link = event.target.closest("a");
      if (!link) return;
      close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("workflow-nav-open")) {
        event.preventDefault();
        close();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (document.body.classList.contains("workflow-nav-open")) close();
        else open();
      }
    });
    render();
  }

  function ready() {
    ensureFeatureIndex().finally(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }

  window.CarmelonGlobalWorkflowNav = {
    mounted: true,
    open,
    close,
    search
  };
})();
