(() => {
  const state = {
    user: null,
    root: null,
    menu: null,
    modal: null,
  };

  const styles = `
    .user-profile-root {
      position: relative;
      z-index: 80;
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      font-family: var(--font, var(--vx-font, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif));
    }

    .user-profile-trigger {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      min-height: 38px;
      max-width: min(320px, 46vw);
      padding: 7px 11px 7px 8px;
      border: 1px solid var(--border, var(--vx-border, #e4ddd1));
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.82);
      color: var(--ink, var(--vx-ink, #20172d));
      box-shadow: 0 8px 24px rgba(24, 18, 12, 0.06);
      cursor: pointer;
      font: inherit;
    }

    .user-profile-trigger:hover,
    .user-profile-trigger:focus-visible {
      border-color: var(--border-hover, var(--vx-violet, #6e57c4));
      outline: none;
    }

    .user-profile-avatar {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: var(--violet-soft, rgba(110, 87, 196, 0.13));
      color: var(--violet, var(--vx-violet, #6e57c4));
      font-size: 0.68rem;
      font-weight: 850;
      text-transform: uppercase;
    }

    .user-profile-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0;
    }

    .user-profile-edit-icon {
      width: 15px;
      height: 15px;
      flex: 0 0 auto;
      color: var(--text-muted, var(--vx-muted, #8b8175));
    }

    .user-profile-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      display: none;
      width: min(320px, calc(100vw - 28px));
      padding: 14px;
      border: 1px solid var(--border, var(--vx-border, #e4ddd1));
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 18px 50px rgba(24, 18, 12, 0.16);
    }

    .user-profile-root.is-open .user-profile-menu {
      display: grid;
      gap: 10px;
    }

    .user-profile-kicker {
      color: var(--text-muted, var(--vx-muted, #8b8175));
      font: 750 0.66rem/1.2 var(--mono, var(--vx-mono, monospace));
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .user-profile-email {
      overflow-wrap: anywhere;
      color: var(--text-dim, var(--vx-muted, #625a52));
      font-size: 0.78rem;
      line-height: 1.35;
    }

    .user-profile-action {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 8px 12px;
      border: 1px solid var(--border, var(--vx-border, #e4ddd1));
      border-radius: 999px;
      background: var(--surface-soft, var(--vx-surface-warm, #faf8f4));
      color: var(--ink, var(--vx-ink, #20172d));
      cursor: pointer;
      font: 800 0.82rem/1 var(--font, var(--vx-font, Inter, sans-serif));
    }

    .user-profile-action:hover,
    .user-profile-action:focus-visible {
      border-color: var(--border-hover, var(--vx-violet, #6e57c4));
      outline: none;
    }

    .user-profile-modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(32, 23, 45, 0.24);
      backdrop-filter: blur(8px);
    }

    .user-profile-modal.is-open {
      display: flex;
    }

    .user-profile-dialog {
      width: min(420px, 100%);
      padding: 22px;
      border: 1px solid var(--border, var(--vx-border, #e4ddd1));
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 24px 80px rgba(24, 18, 12, 0.18);
    }

    .user-profile-dialog h2 {
      margin: 0;
      color: var(--ink, var(--vx-ink, #20172d));
      font-size: 1.28rem;
      line-height: 1.15;
      letter-spacing: 0;
    }

    .user-profile-dialog p {
      margin: 8px 0 16px;
      color: var(--text-dim, var(--vx-muted, #625a52));
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .user-profile-field {
      display: grid;
      gap: 7px;
      margin-bottom: 14px;
    }

    .user-profile-field span {
      color: var(--text-muted, var(--vx-muted, #8b8175));
      font: 750 0.68rem/1.2 var(--mono, var(--vx-mono, monospace));
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .user-profile-field input {
      width: 100%;
      min-height: 46px;
      padding: 10px 13px;
      border: 1px solid var(--border, var(--vx-border, #e4ddd1));
      border-radius: 10px;
      color: var(--ink, var(--vx-ink, #20172d));
      background: #fff;
      font: 700 0.98rem/1.2 var(--font, var(--vx-font, Inter, sans-serif));
    }

    .user-profile-field input:focus {
      border-color: var(--violet, var(--vx-violet, #6e57c4));
      outline: 3px solid rgba(110, 87, 196, 0.14);
    }

    .user-profile-error {
      min-height: 18px;
      color: #b42318;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .user-profile-actions {
      display: flex;
      justify-content: flex-end;
      gap: 9px;
      margin-top: 6px;
    }

    .user-profile-secondary,
    .user-profile-primary {
      min-height: 40px;
      padding: 9px 15px;
      border-radius: 999px;
      cursor: pointer;
      font: 850 0.86rem/1 var(--font, var(--vx-font, Inter, sans-serif));
    }

    .user-profile-secondary {
      border: 1px solid var(--border, var(--vx-border, #e4ddd1));
      background: #fff;
      color: var(--text-dim, var(--vx-muted, #625a52));
    }

    .user-profile-primary {
      border: 1px solid var(--ink, var(--vx-ink, #20172d));
      background: var(--ink, var(--vx-ink, #20172d));
      color: #fff;
    }

    .user-profile-secondary:focus-visible,
    .user-profile-primary:focus-visible {
      outline: 3px solid rgba(110, 87, 196, 0.16);
    }

    @media (max-width: 720px) {
      .user-profile-root {
        width: 100%;
      }

      .user-profile-trigger {
        justify-content: space-between;
        max-width: none;
        width: 100%;
      }

      .user-profile-menu {
        left: 0;
        right: auto;
        width: 100%;
      }
    }
  `;

  function injectStyles() {
    if (document.getElementById("userProfileStyles")) return;
    const style = document.createElement("style");
    style.id = "userProfileStyles";
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizedName(value) {
    const name = String(value || "").replace(/\s+/g, " ").trim();
    return name && name.length <= 80 && !/[<>]/.test(name) ? name : "";
  }

  function fallbackName(user) {
    const email = String(user?.email || "");
    return email ? email.split("@")[0] : "User";
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
  }

  function pencilIcon() {
    return `
      <svg class="user-profile-edit-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    `;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error || `Request failed (${response.status})`);
    }

    return body;
  }

  function closeMenu() {
    state.root?.classList.remove("is-open");
  }

  function namePromptSeenKey() {
    const email = String(state.user?.email || "").trim().toLowerCase();
    return email ? `carmelon.userProfile.namePromptSeen.${email}` : "";
  }

  function hasSeenNamePrompt() {
    const key = namePromptSeenKey();
    return Boolean(key && localStorage.getItem(key) === "1");
  }

  function markNamePromptSeen() {
    const key = namePromptSeenKey();
    if (key) localStorage.setItem(key, "1");
  }

  function openNameDialog() {
    if (!state.modal) return;
    const input = state.modal.querySelector("[data-user-profile-input]");
    const error = state.modal.querySelector("[data-user-profile-error]");
    input.value = state.user?.displayName || "";
    error.textContent = "";
    state.modal.classList.add("is-open");
    window.setTimeout(() => input.focus(), 20);
    closeMenu();
  }

  function closeNameDialog() {
    state.modal?.classList.remove("is-open");
  }

  function render() {
    if (!state.root || !state.user) return;

    const name = state.user.displayName || fallbackName(state.user);
    const needsName = !state.user.displayName;

    state.root.innerHTML = `
      <button class="user-profile-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
        <span class="user-profile-avatar">${escapeHtml(initials(name).slice(0, 2))}</span>
        <span class="user-profile-name">${escapeHtml(needsName ? "Add your name" : name)}</span>
      </button>
      <div class="user-profile-menu" role="menu">
        <div class="user-profile-kicker">User profile</div>
        <div class="user-profile-email">${escapeHtml(state.user.email)}</div>
        <button class="user-profile-action" type="button" data-user-profile-edit>${pencilIcon()} Edit name</button>
      </div>
    `;

    const trigger = state.root.querySelector(".user-profile-trigger");
    trigger.addEventListener("click", () => {
      const open = !state.root.classList.contains("is-open");
      state.root.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    state.root.querySelector("[data-user-profile-edit]")?.addEventListener("click", openNameDialog);
  }

  function createModal() {
    if (state.modal) return;
    const modal = document.createElement("div");
    modal.className = "user-profile-modal";
    modal.innerHTML = `
      <form class="user-profile-dialog" data-user-profile-form>
        <h2>What should we call you?</h2>
        <p>This name is saved in this system and shown in the workspace. It does not change your Google account.</p>
        <label class="user-profile-field">
          <span>Your name</span>
          <input type="text" name="displayName" data-user-profile-input autocomplete="name" maxlength="80" placeholder="Example: Liron Cohen" />
        </label>
        <div class="user-profile-error" data-user-profile-error aria-live="polite"></div>
        <div class="user-profile-actions">
          <button class="user-profile-secondary" type="button" data-user-profile-cancel>Cancel</button>
          <button class="user-profile-primary" type="submit">Save name</button>
        </div>
      </form>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeNameDialog();
    });
    modal.querySelector("[data-user-profile-cancel]")?.addEventListener("click", closeNameDialog);
    modal.querySelector("[data-user-profile-form]")?.addEventListener("submit", saveName);
    document.body.appendChild(modal);
    state.modal = modal;
  }

  async function saveName(event) {
    event.preventDefault();
    const input = state.modal.querySelector("[data-user-profile-input]");
    const error = state.modal.querySelector("[data-user-profile-error]");
    const displayName = normalizedName(input.value);

    if (!displayName) {
      error.textContent = "Enter a name up to 80 characters, without angle brackets.";
      return;
    }

    error.textContent = "";

    try {
      const result = await api("/api/me/profile", {
        method: "POST",
        body: JSON.stringify({ displayName }),
      });
      state.user = result.user;
      render();
      state.modal.classList.remove("is-open");
    } catch (err) {
      error.textContent = err?.message || "Could not save your name.";
    }
  }

  function mount() {
    const header = document.querySelector(".topbar-actions") || document.querySelector(".demo-header") || document.querySelector(".topbar");
    if (!header || document.querySelector(".user-profile-root")) return false;

    const root = document.createElement("div");
    root.className = "user-profile-root";
    header.appendChild(root);
    state.root = root;
    return true;
  }

  async function init() {
    injectStyles();

    try {
      const result = await api("/api/me");
      if (!result?.authenticated || !result.user) return;
      state.user = result.user;
    } catch {
      return;
    }

    if (!mount()) return;

    createModal();
    render();

    if (!state.user.displayName && !hasSeenNamePrompt()) {
      markNamePromptSeen();
      openNameDialog();
    }
  }

  document.addEventListener("click", (event) => {
    if (state.root && !state.root.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      closeNameDialog();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
