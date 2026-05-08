// public/shared/insight-editor.js
// Vanilla ES module. Loaded by client-reports.html.
// Handles: rendering insight blocks, inline editing, AI edit buttons,
// custom-prompt textbox, and persistence in localStorage.

const STORAGE_KEY_PREFIX = "client-reports:insight-blocks:";

// === Public API ===

/**
 * Mounts the insight editor into a container element.
 *
 * @param {Object} params
 * @param {HTMLElement} params.container - Where to render the editor.
 * @param {Array} params.blocks - InsightBlock[] from the report result.
 * @param {Object} params.context - InsightEditContext (totals, comparison, etc.).
 * @param {string} params.reportKey - Stable key per report (used for localStorage).
 * @param {Function} params.onEditCommand - Called when user triggers an edit. Signature: (command) => Promise<{updatedBlock, action}>.
 * @param {Function} [params.onBlocksChanged] - Optional callback fired after any local change.
 * @returns {Object} controller with refresh/destroy methods.
 */
export function mountInsightEditor({ container, blocks, context, reportKey, onEditCommand, onBlocksChanged }) {
  if (!container) {
    throw new Error("insight-editor: container is required.");
  }

  // עומדים על העתק מקומי של הבלוקים כדי שלא נשנה את ה-prop של הקריאה.
  const state = {
    blocks: applyStoredOverrides(reportKey, normalizeBlocks(blocks)),
    context,
    reportKey,
    onEditCommand,
    onBlocksChanged,
    busyBlockIds: new Set(),
    container,
  };

  render(container, state);

  return {
    refresh(newBlocks, newContext) {
      // נקרא כשהדוח מתחדש (פילטר השתנה). שומר manual/pinned blocks.
      const incoming = normalizeBlocks(newBlocks);
      state.blocks = applyStoredOverrides(reportKey, incoming);
      if (newContext) state.context = newContext;
      render(container, state);
    },
    getBlocks() {
      return state.blocks.map((b) => ({ ...b }));
    },
    destroy() {
      container.innerHTML = "";
    },
  };
}

// === Rendering ===

function render(container, state) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "insight-editor";

  // Summary block - מוצג ראשון, גדול יותר.
  const summaryBlock = state.blocks.find((b) => b.kind === "summary");
  if (summaryBlock) {
    wrapper.appendChild(renderBlock(summaryBlock, state, /* isSummary */ true));
  }

  // Recommendations + observations + custom - לפי order.
  const otherBlocks = state.blocks
    .filter((b) => b.kind !== "summary")
    .sort((a, b) => a.order - b.order);

  if (otherBlocks.length) {
    const list = document.createElement("div");
    list.className = "insight-editor__list";

    otherBlocks.forEach((block) => {
      list.appendChild(renderBlock(block, state, /* isSummary */ false));
    });

    wrapper.appendChild(list);
  }

  // Custom prompt textbox - הקופסה הפתוחה שביקשת.
  wrapper.appendChild(renderCustomPromptBox(state));

  container.appendChild(wrapper);
}

function renderBlock(block, state, isSummary) {
  const blockEl = document.createElement("div");
  blockEl.className = `insight-block insight-block--${block.kind}${isSummary ? " insight-block--summary" : ""}`;
  blockEl.dataset.blockId = block.id;

  if (state.busyBlockIds.has(block.id)) {
    blockEl.classList.add("is-busy");
  }

  // Header עם kind + מקור + pin.
  const header = document.createElement("div");
  header.className = "insight-block__header";

  const kindLabel = document.createElement("span");
  kindLabel.className = "insight-block__kind";
  kindLabel.textContent = labelForKind(block.kind, block.title);
  header.appendChild(kindLabel);

  if (block.source === "manual") {
    const sourceTag = document.createElement("span");
    sourceTag.className = "insight-block__source-tag";
    sourceTag.textContent = "Edited";
    sourceTag.title = "This block was edited manually and will not be regenerated automatically.";
    header.appendChild(sourceTag);
  }

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = "insight-block__pin" + (block.pinned ? " is-active" : "");
  pinBtn.textContent = block.pinned ? "📌" : "📍";
  pinBtn.title = block.pinned ? "Unpin (will regenerate on filter change)" : "Pin (keep across filter changes)";
  pinBtn.addEventListener("click", () => togglePin(state, block.id));
  header.appendChild(pinBtn);

  blockEl.appendChild(header);

  // Content - contenteditable לעריכה inline.
  const content = document.createElement("div");
  content.className = "insight-block__content";
  content.contentEditable = "true";
  content.spellcheck = true;
  content.textContent = block.content;

  let originalContent = block.content;

  content.addEventListener("focus", () => {
    originalContent = content.textContent;
  });

  content.addEventListener("blur", () => {
    const newContent = (content.textContent || "").trim();
    if (newContent && newContent !== originalContent) {
      updateBlockLocally(state, block.id, { content: newContent, source: "manual" });
    }
  });

  content.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      content.blur();
    }
    if (e.key === "Escape") {
      content.textContent = originalContent;
      content.blur();
    }
  });

  blockEl.appendChild(content);

  // Action buttons - rephrase / shorten / expand / translate / delete.
  blockEl.appendChild(renderBlockActions(block, state));

  return blockEl;
}

function renderBlockActions(block, state) {
  const actions = document.createElement("div");
  actions.className = "insight-block__actions";

  const buttons = [
    { type: "rephrase", icon: "✏️", label: "Rephrase" },
    { type: "shorten", icon: "✂️", label: "Shorten" },
    { type: "expand", icon: "🔍", label: "Expand" },
    { type: "translate-he", icon: "🇮🇱", label: "Hebrew" },
    { type: "translate-en", icon: "🇬🇧", label: "English" },
  ];

  buttons.forEach(({ type, icon, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "insight-block__action";
    btn.innerHTML = `<span aria-hidden="true">${icon}</span> ${label}`;
    btn.disabled = state.busyBlockIds.has(block.id);
    btn.addEventListener("click", () => runEditCommand(state, { type, blockId: block.id }));
    actions.appendChild(btn);
  });

  // Delete (custom blocks בלבד).
  if (block.kind === "custom") {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "insight-block__action insight-block__action--danger";
    deleteBtn.innerHTML = `<span aria-hidden="true">🗑️</span> Delete`;
    deleteBtn.addEventListener("click", () => deleteBlock(state, block.id));
    actions.appendChild(deleteBtn);
  }

  return actions;
}

function renderCustomPromptBox(state) {
  const box = document.createElement("div");
  box.className = "insight-prompt-box";

  const label = document.createElement("label");
  label.className = "insight-prompt-box__label";
  label.textContent = "Ask AI to write a custom insight:";
  box.appendChild(label);

  const wrapper = document.createElement("div");
  wrapper.className = "insight-prompt-box__row";

  const textarea = document.createElement("textarea");
  textarea.className = "insight-prompt-box__input";
  textarea.placeholder =
    'e.g. "Write a sentence about how the campaign is tracking against the monthly goal"';
  textarea.rows = 2;

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "insight-prompt-box__submit";
  submitBtn.textContent = "Generate";

  const submit = async () => {
    const prompt = textarea.value.trim();
    if (!prompt) return;

    submitBtn.disabled = true;
    textarea.disabled = true;
    submitBtn.textContent = "Generating...";

    try {
      await runEditCommand(state, { type: "custom-prompt", prompt });
      textarea.value = "";
    } finally {
      submitBtn.disabled = false;
      textarea.disabled = false;
      submitBtn.textContent = "Generate";
    }
  };

  submitBtn.addEventListener("click", submit);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  });

  wrapper.appendChild(textarea);
  wrapper.appendChild(submitBtn);
  box.appendChild(wrapper);

  return box;
}

// === Actions ===

async function runEditCommand(state, command) {
  if (!state.onEditCommand) {
    console.warn("insight-editor: onEditCommand handler is not set.");
    return;
  }

  const targetId = command.type === "custom-prompt" ? command.targetBlockId : command.blockId;
  if (targetId) {
    state.busyBlockIds.add(targetId);
    rerender(state);
  }

  try {
    const result = await state.onEditCommand({
      command,
      currentBlocks: state.blocks.map((b) => ({ ...b })),
      context: state.context,
    });

    if (!result || !result.updatedBlock) {
      throw new Error("Edit command returned no updated block.");
    }

    if (result.action === "replace") {
      const idx = state.blocks.findIndex((b) => b.id === result.updatedBlock.id);
      if (idx !== -1) {
        state.blocks[idx] = result.updatedBlock;
      } else {
        state.blocks.push(result.updatedBlock);
      }
    } else {
      state.blocks.push(result.updatedBlock);
    }

    persistOverrides(state);
    notifyChanged(state);
  } catch (err) {
    console.error("insight-editor: edit command failed.", err);
    showError(state, "Edit failed. Please try again.");
  } finally {
    if (targetId) state.busyBlockIds.delete(targetId);
    rerender(state);
  }
}

function updateBlockLocally(state, blockId, updates) {
  const idx = state.blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) return;

  state.blocks[idx] = { ...state.blocks[idx], ...updates };
  persistOverrides(state);
  notifyChanged(state);
}

function togglePin(state, blockId) {
  const idx = state.blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) return;

  state.blocks[idx] = { ...state.blocks[idx], pinned: !state.blocks[idx].pinned };
  persistOverrides(state);
  notifyChanged(state);
  rerender(state);
}

function deleteBlock(state, blockId) {
  state.blocks = state.blocks.filter((b) => b.id !== blockId);
  persistOverrides(state);
  notifyChanged(state);
  rerender(state);
}

// === Persistence ===

function persistOverrides(state) {
  if (!state.reportKey) return;

  // שומר רק את הבלוקים הידניים/מקובעים. בלוקי AI רגילים לא צריכים persistence
  // - הם נוצרים מחדש בכל הרצה.
  const overrides = state.blocks.filter((b) => b.source === "manual" || b.pinned);

  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + state.reportKey, JSON.stringify(overrides));
  } catch (err) {
    console.warn("insight-editor: localStorage write failed.", err);
  }
}

function applyStoredOverrides(reportKey, blocks) {
  if (!reportKey) return blocks;

  let stored = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + reportKey);
    stored = raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("insight-editor: localStorage read failed.", err);
    return blocks;
  }

  if (!Array.isArray(stored) || !stored.length) return blocks;

  const storedById = new Map(stored.map((b) => [b.id, b]));
  const merged = blocks.map((b) => storedById.get(b.id) || b);
  const usedIds = new Set(merged.map((b) => b.id));

  // Custom blocks ששמורים מקומית אבל לא הגיעו מהשרת.
  const baseOrder = merged.length;
  let extraIndex = 0;

  for (const stored_block of stored) {
    if (!usedIds.has(stored_block.id)) {
      merged.push({ ...stored_block, order: baseOrder + extraIndex });
      extraIndex++;
    }
  }

  return merged;
}

// === Helpers ===

function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => ({ ...b }));
}

function rerender(state) {
  // משתמשים ב-container הספציפי שנשמר ב-state, לא ב-querySelector גלובלי.
  if (state.container) {
    render(state.container, state);
  }
}

function notifyChanged(state) {
  if (typeof state.onBlocksChanged === "function") {
    state.onBlocksChanged(state.blocks.map((b) => ({ ...b })));
  }
}

function labelForKind(kind, title) {
  if (title) return title;

  switch (kind) {
    case "summary":
      return "Summary";
    case "recommendation":
      return "Recommendation";
    case "observation":
      return "Observation";
    case "custom":
      return "Custom";
    default:
      return kind;
  }
}

function showError(state, message) {
  // toast קל-משקל.
  const toast = document.createElement("div");
  toast.className = "insight-editor__toast";
  toast.textContent = message;

  if (state.container) {
    state.container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  } else {
    console.error(message);
  }
}