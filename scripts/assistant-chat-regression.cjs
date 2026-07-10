const { chromium } = require("playwright");

const BASE_URL = process.env.ASSISTANT_URL || "http://localhost:3105/assistant-workspace.html";

function pageUrl(path) {
  return new URL(path, BASE_URL).toString();
}

function fail(name, message, details = {}) {
  const error = new Error(`${name}: ${message}`);
  error.details = details;
  throw error;
}

function expectIncludes(name, text, expected) {
  if (!String(text || "").includes(expected)) fail(name, `Expected text to include "${expected}"`, { text });
}

function expectNotIncludes(name, text, forbidden) {
  if (String(text || "").includes(forbidden)) fail(name, `Expected text not to include "${forbidden}"`, { text });
}

function expectNoHebrew(name, text) {
  if (/[\u0590-\u05ff]/.test(String(text || ""))) fail(name, "Expected text to stay in English without Hebrew UI strings", { text });
}

async function setupPage(browser, viewport = { width: 1440, height: 1050 }, targetUrl = BASE_URL, waitForAssistant = true) {
  const page = await browser.newPage({ viewport });
  const preflightBodies = [];
  page.__assistantPreflightBodies = preflightBodies;
  page.setDefaultTimeout(7000);
  if (process.env.ASSISTANT_BASIC_AUTH) {
    await page.setExtraHTTPHeaders({
      Authorization: `Basic ${Buffer.from(process.env.ASSISTANT_BASIC_AUTH).toString("base64")}`
    });
  }
  await page.route("**/socket.io/socket.io.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.__assistantSocketEmits = [];
        window.io = function () {
          const handlers = {};
          window.__assistantSocketHandlers = handlers;
          return {
            connected: true,
            on(event, handler) {
              handlers[event] = handler;
              if (event === "connect") setTimeout(handler, 0);
              return this;
            },
            emit(event, payload) {
              window.__assistantSocketEmits.push({ event, payload });
              return this;
            }
          };
        };
      `
    });
  });
  await page.route("**/api/assistant-chat", async (route) => {
    const body = route.request().postDataJSON?.() || {};
    if (String(body.message || "").includes("__scroll_long_message__")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: Array.from({ length: 90 }, (_, index) => `Long assistant line ${index + 1}: keeping the latest message visible after quick replies resize the chat.`).join("\n"),
          actions: [],
          modelUsed: "stubbed-scroll-reply"
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: body.responseLanguage === "Hebrew" ? "אני צריכה עוד פרט קטן." : "I need one more detail.",
        actions: [],
        modelUsed: "stubbed-test-router"
      })
    });
  });
  await page.route("**/api/assistant-preflight", async (route) => {
    preflightBodies.push(route.request().postDataJSON?.() || {});
    const body = route.request().postDataJSON?.() || {};
    if (body.phase === "faq-subject-validation") {
      const serialized = JSON.stringify({ values: body.values, payload: body.payload });
      const unknownHebrewSubject = serialized.includes("אבגד");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "בדקתי את הנושא והשפה לפני יצירה.",
          warnings: [],
          faqValidation: {
            normalizedSubject: unknownHebrewSubject ? "מלון אבגד ברלין" : "לאונדרו ברלין",
            detectedBrandOrEntity: unknownHebrewSubject ? "מלון אבגד ברלין" : "לאונדרו ברלין",
            requestedLanguage: "English",
            requestedLocale: "UK",
            contentGoal: "Build an FAQ question plan",
            removedInstructionFragments: ["אנגלית uk"],
            confidence: 0.78,
            needsConfirmation: true,
            sourceUrlCandidate: unknownHebrewSubject ? "" : "https://www.leonardo-hotels.com/berlin/leonardo-hotel-berlin",
            sourceTitle: unknownHebrewSubject ? "" : "Leonardo Hotel Berlin official page",
            sourceType: unknownHebrewSubject ? "" : "official",
            sourceConfidence: unknownHebrewSubject ? 0 : 0.9,
            needsSourceConfirmation: !unknownHebrewSubject,
            confirmationQuestion: unknownHebrewSubject
              ? "הבנתי שהנושא הוא מלון אבגד ברלין והשפה היא UK English. להמשיך?"
              : "הבנתי שהנושא הוא לאונדרו ברלין והשפה היא UK English. להמשיך?"
          },
          modelUsed: "stubbed-test-faq-validation"
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ patch: {}, warnings: [], modelUsed: "stubbed-test-preflight" })
    });
  });
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  if (waitForAssistant) await page.waitForSelector("#assistantInput", { state: "visible" });
  return page;
}

async function send(page, text) {
  await page.locator("#assistantInput").fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(80);
  const stillThere = await page.locator("#assistantInput").inputValue();
  if (stillThere.trim()) {
    await page.locator("#assistantForm button[type='submit']").click();
    await page.waitForTimeout(80);
  }
}

async function clickReply(page, label) {
  const reply = page.locator("#quickReplies button.quick-reply", { hasText: label }).first();
  await reply.waitFor({ state: "visible" });
  await reply.click();
  await page.waitForTimeout(80);
}

async function clickSend(page) {
  await page.locator("#assistantForm button[type='submit']").click();
  await page.waitForTimeout(80);
}

async function chatText(page) {
  return page.locator("#chatLog").innerText();
}

async function quickText(page) {
  return page.locator("#quickReplies").innerText();
}

async function openWorkflowNav(page) {
  await page.locator(".workflow-nav-trigger").click();
  await page.locator(".workflow-nav-drawer").waitFor({ state: "visible" });
}

async function searchWorkflowNav(page, query) {
  await page.locator(".workflow-search-input").fill(query);
  await page.waitForTimeout(80);
  return page.locator(".workflow-results").innerText();
}

async function expectPrimaryReply(page, label) {
  const reply = page.locator("#quickReplies button.quick-reply", { hasText: label }).first();
  await reply.waitFor({ state: "visible" });
  const className = await reply.getAttribute("class");
  if (!String(className || "").split(/\s+/).includes("is-primary")) {
    fail(`primary-reply-${label}`, `Expected "${label}" to be styled as the primary chat action`, { className });
  }
}

async function panelText(page) {
  return page.locator("#actionsList").innerText();
}

async function userMessageTexts(page) {
  return page.locator("#chatLog .message.user").allTextContents();
}

async function scenarioWorkflowNavSearchOpensSiteAudit(browser) {
  const name = "workflow-nav-search-opens-site-audit";
  const page = await setupPage(browser, { width: 1440, height: 1050 }, pageUrl("/index.html"), false);
  const closedTrigger = await page.locator(".workflow-nav-trigger").boundingBox();
  if (!closedTrigger || closedTrigger.x > 8) fail(name, "Workflow trigger should start as a left-edge hamburger handle", { closedTrigger });
  const triggerText = await page.locator(".workflow-nav-trigger").innerText();
  if (triggerText.trim()) fail(name, "Workflow hamburger trigger should not be a right-side text button", { triggerText });
  await openWorkflowNav(page);
  await page.waitForTimeout(320);
  const openTrigger = await page.locator(".workflow-nav-trigger").boundingBox();
  if (!openTrigger || openTrigger.x < 300) fail(name, "Workflow trigger should slide right with the opened drawer", { openTrigger });
  let results = await searchWorkflowNav(page, "סכמות באתר");
  const firstTitle = await page.locator(".workflow-menu-parent strong").first().innerText();
  expectIncludes(name, firstTitle, "AI Site Audit Crawler");
  expectNotIncludes(name, results, "בדיקת Schema באתר");
  await page.locator(".workflow-menu-toggle").first().click();
  results = await page.locator(".workflow-results").innerText();
  expectIncludes(name, results, "בדיקת Schema באתר");
  await page.locator(".workflow-menu-link", { hasText: "בדיקת Schema באתר" }).click();
  await page.waitForURL(/site-ai-audit\.html/, { timeout: 7000 });
  expectIncludes(name, await page.title(), "AI Site Audit");
  await page.close();
}

async function scenarioWorkflowNavGeneralBeforeSheetSubfeatures(browser) {
  const name = "workflow-nav-general-before-sheet-subfeatures";
  const page = await setupPage(browser);
  await openWorkflowNav(page);
  const fullTitles = await page.locator(".workflow-menu-parent strong").allInnerTexts();
  const expectedOrder = ["FAQ Workflow Builder", "FAQ Editing Workspace", "AI Translation Engine", "Schema Builder", "Meta Tags Studio"];
  expectedOrder.forEach((title, index) => {
    if (fullTitles[index] !== title) fail(name, "Workflow menu should follow the home page feature order", { fullTitles, expectedOrder });
  });
  let results = await searchWorkflowNav(page, "edit sheet");
  const visibleChildren = await page.locator(".workflow-menu-child:visible").count();
  if (visibleChildren) fail(name, "Workflow menu should show only tool titles until a row is expanded", { visibleChildren });
  const firstTitle = await page.locator(".workflow-menu-parent strong").first().innerText();
  expectIncludes(name, firstTitle, "FAQ Editing Workspace");
  expectNotIncludes(name, results, "Complete Missing Answers");
  await page.locator(".workflow-menu-toggle").first().click();
  results = await page.locator(".workflow-results").innerText();
  expectIncludes(name, results, "Complete Missing Answers");
  expectIncludes(name, results, "Copy / Replace Columns");
  expectNotIncludes(name, firstTitle, "Code / Local File Edit");
  await page.close();
}

async function scenarioWorkflowNavFuzzyAndEscape(browser) {
  const name = "workflow-nav-fuzzy-and-escape";
  const page = await setupPage(browser);
  await openWorkflowNav(page);
  let results = await searchWorkflowNav(page, "scema");
  expectIncludes(name, results, "Schema Builder");
  results = await searchWorkflowNav(page, "output cell");
  expectIncludes(name, results, "Schema Builder");
  expectNotIncludes(name, results, "Schema Output Cell");
  await page.locator(".workflow-menu-toggle").first().click();
  expectIncludes(name, await page.locator(".workflow-results").innerText(), "Schema Output Cell");
  await page.keyboard.press("Escape");
  await page.locator(".workflow-nav-drawer").waitFor({ state: "hidden" });
  expectIncludes(name, await chatText(page), "Hi. What would you like to do?");
  await page.close();
}

async function scenarioWorkflowNavAskAssistant(browser) {
  const name = "workflow-nav-ask-assistant";
  const page = await setupPage(browser, { width: 1440, height: 1050 }, pageUrl("/faq-playground.html"), false);
  await openWorkflowNav(page);
  const results = await searchWorkflowNav(page, "glossary");
  const firstTitle = await page.locator(".workflow-menu-parent strong").first().innerText();
  expectIncludes(name, firstTitle, "AI Translation Engine");
  expectNotIncludes(name, results, "Glossary");
  await page.locator(".workflow-menu-toggle").first().click();
  expectIncludes(name, await page.locator(".workflow-results").innerText(), "Glossary");
  const askLink = page.locator(".workflow-menu-link", { hasText: "Glossary" }).first();
  const href = await askLink.getAttribute("href");
  expectIncludes(name, href, "translate-demo.html");
  await askLink.click();
  await page.waitForURL(/translate-demo\.html/, { timeout: 7000 });
  await page.close();
}

async function scenarioWorkflowNavNoResultsAndMobile(browser) {
  const name = "workflow-nav-no-results-and-mobile";
  const page = await setupPage(browser, { width: 390, height: 844 });
  await openWorkflowNav(page);
  const results = await searchWorkflowNav(page, "qzxqzxqzx");
  expectIncludes(name, results, "No matching workflow found");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) fail(name, "Feature drawer should not create horizontal overflow on mobile", {
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    innerWidth: await page.evaluate(() => window.innerWidth)
  });
  await page.keyboard.press("Escape");
  await page.locator(".workflow-nav-drawer").waitFor({ state: "hidden" });
  await page.close();
}

async function scenarioFaqOpeningUsesProvidedDetails(browser) {
  const name = "faq-opening-uses-provided-details";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות שאלות תשובות למלון לאונרדו מלון בוטיק האוס Bachar House לאורחים");
  const text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "באיזו שפה ליצור את התוצאה");
  expectIncludes(name, text, "מלון / אירוח");
  expectIncludes(name, text, "Bachar House");
  expectIncludes(name, text, "אורחים");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  expectNotIncludes(name, text, "על מה ה־FAQ");
  expectNotIncludes(name, text, "עדיין אין נושא");
  expectNotIncludes(name, text, "חסר קהל יעד");
  await page.close();
}

async function scenarioFaqHotelUrlInfersSubject(browser) {
  const name = "faq-hotel-url-infers-subject";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות עמוד faq חדש צריכה שאלון למלון https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv");
  const text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "NYX Hotel Tel Aviv");
  expectNotIncludes(name, text, "על מה ה־FAQ");
  expectNotIncludes(name, text, "עדיין אין נושא");
  await page.close();
}

async function scenarioFaqExistingPageGapResearch(browser) {
  const name = "faq-existing-page-gap-research";
  const page = await setupPage(browser);
  await send(page, "יש לי עמוד שכבר יש לו faq https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv אני צריכה שתסרוק אותו ותכתוב לי מסמך שיט עם שאלות שלא מופיעות בו");
  const text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "NYX Hotel Tel Aviv");
  expectNotIncludes(name, text, "על מה ה־FAQ");
  expectNotIncludes(name, text, "איזה אתר לבדוק ל־FAQ ול־Schema");
  await page.close();
}

async function scenarioFaqAudienceMulti(browser) {
  const name = "faq-hebrew-audience-multi";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  await clickReply(page, "מלון / אירוח");
  await send(page, "Bachar House");

  const beforeUsers = await userMessageTexts(page);
  await clickReply(page, "אורחים לפני הזמנה");
  await clickReply(page, "אורחים בזמן השהות");
  const afterUsers = await userMessageTexts(page);
  if (afterUsers.length !== beforeUsers.length) fail(name, "Multi-select toggles should not add chat bubbles", { beforeUsers, afterUsers });

  const replies = await quickText(page);
  expectIncludes(name, replies, "✓ אורחים לפני הזמנה");
  expectIncludes(name, replies, "✓ אורחים בזמן השהות");

  const beforeConfirmUsers = await userMessageTexts(page);
  await clickSend(page);
  const afterConfirmUsers = await userMessageTexts(page);
  if (afterConfirmUsers.length !== beforeConfirmUsers.length + 1) fail(name, "Empty Send should add the selected values as one chat bubble", { beforeConfirmUsers, afterConfirmUsers });
  expectIncludes(name, afterConfirmUsers.at(-1), "אורחים לפני הזמנה");
  expectIncludes(name, afterConfirmUsers.at(-1), "אורחים בזמן השהות");
  expectNotIncludes(name, afterConfirmUsers.at(-1), "להמשיך");
  expectIncludes(name, await chatText(page), "באיזו שפה");
  const panel = await panelText(page);
  expectIncludes(name, panel, "אורחים לפני הזמנה");
  expectIncludes(name, panel, "אורחים בזמן השהות");
  expectNotIncludes(name, panel, "חסר קהל יעד");
  await page.close();
}

async function scenarioFaqAudienceCanClearAndGoBack(browser) {
  const name = "faq-audience-clear-back";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  await clickReply(page, "מלון / אירוח");
  await send(page, "Bachar House");

  await clickReply(page, "אורחים לפני הזמנה");
  expectIncludes(name, await quickText(page), "✓ אורחים לפני הזמנה");
  const beforeAdminUsers = await userMessageTexts(page);
  await clickReply(page, "לנקות בחירה");
  let replies = await quickText(page);
  expectNotIncludes(name, replies, "✓ אורחים לפני הזמנה");
  let users = await userMessageTexts(page);
  if (users.length !== beforeAdminUsers.length) fail(name, "Clear selection should not echo as a chat message", { beforeAdminUsers, users });

  await clickReply(page, "להמשיך");
  expectIncludes(name, await chatText(page), "בחרי לפחות קהל אחד");
  await clickReply(page, "חזרה");
  const text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "חזרתי צעד אחורה");
  expectIncludes(name, text, "על מה ה־FAQ");
  expectIncludes(name, text, "יש לי שם אחד");
  users = await userMessageTexts(page);
  expectNotIncludes(name, users.join("\n"), "חזרה");
  await page.close();
}

async function scenarioFaqStyleAndQaMulti(browser) {
  const name = "faq-style-and-qa-multi";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  await clickReply(page, "מלון / אירוח");
  await send(page, "Bachar House");
  await clickReply(page, "אורחים לפני הזמנה");
  await clickReply(page, "להמשיך");
  await clickReply(page, "אנגלית UK");
  await clickReply(page, "סטנדרטי");
  expectIncludes(name, await chatText(page), "יצרתי קטגוריות מוצעות");
  expectIncludes(name, await quickText(page), "✓ General information");
  await clickReply(page, "להמשיך");
  expectIncludes(name, await chatText(page), "איך לחלק את 20-30");
  await clickReply(page, "לפי ביקוש וכוונת חיפוש");
  await clickReply(page, "אין מקור כרגע");
  expectIncludes(name, await chatText(page), "דגשים להוסיף לפרומפט השאלות");
  await clickReply(page, "להמשיך");
  expectIncludes(name, await chatText(page), "דגשים להוסיף לפרומפט התשובות");
  await clickReply(page, "להמשיך");
  expectIncludes(name, await chatText(page), "איזה סגנון כתיבה לשמור בתשובות");
  let replies = await quickText(page);
  expectIncludes(name, replies, "חם וקצר");
  await clickReply(page, "מקצועי וישיר");
  await clickReply(page, "SEO / מוכנות AI");
  replies = await quickText(page);
  expectIncludes(name, replies, "✓ מקצועי וישיר");
  expectIncludes(name, replies, "✓ SEO / מוכנות AI");

  const beforeStyleDoneUsers = (await userMessageTexts(page)).length;
  await clickReply(page, "להמשיך");
  users = await userMessageTexts(page);
  if (users.length !== beforeStyleDoneUsers + 1) fail(name, "Style Continue should show selected style notes as one answer", { users });
  expectIncludes(name, users.at(-1), "מקצועי וישיר");
  expectIncludes(name, users.at(-1), "SEO / מוכנות AI");
  expectIncludes(name, await chatText(page), "אילו בדיקות להריץ אחרי כתיבת התשובות");
  expectNotIncludes(name, await quickText(page), "חם וקצר");
  await clickReply(page, "בדיקת מקורות");

  users = await userMessageTexts(page);
  const beforeQaDoneUsers = users.length;
  await clickReply(page, "להמשיך");
  users = await userMessageTexts(page);
  if (users.length !== beforeQaDoneUsers + 1) fail(name, "QA Continue should show selected QA checks as one answer", { users });
  expectIncludes(name, users.at(-1), "כפילויות");
  expectIncludes(name, users.at(-1), "בדיקת מקורות");
  expectIncludes(name, users.at(-1), "כתיבה ובהירות");
  expectNotIncludes(name, users.at(-1), "להמשיך");
  const panel = await panelText(page);
  expectIncludes(name, panel, "מוכן להרצה");
  expectIncludes(name, panel, "פרומפט לשאלות");
  expectIncludes(name, panel, "פרומפט לתשובות");
  expectIncludes(name, panel, "מקצועי וישיר");
  expectIncludes(name, panel, "SEO / מוכנות AI");
  expectIncludes(name, panel, "בדיקת מקורות");

  const readyReplies = await quickText(page);
  expectIncludes(name, readyReplies, "להראות פרומפטים");
  await clickReply(page, "להראות פרומפטים");
  const chat = await chatText(page);
  expectIncludes(name, chat, "QUESTION PROMPT");
  expectIncludes(name, chat, "ANSWER PROMPT");
  expectIncludes(name, chat, "Research and build a practical FAQ question plan");
  expectIncludes(name, chat, "Using the question plan below");
  expectIncludes(name, chat, "ADDITIONAL QUESTION GUIDANCE");
  expectIncludes(name, chat, "natural wording real people would use");
  expectIncludes(name, chat, "ADDITIONAL ANSWER GUIDANCE");
  expectIncludes(name, chat, "Answer only with facts supported by approved sources");
  await page.close();
}

async function scenarioFaqBalancedSplitEchoesOnce(browser) {
  const name = "faq-balanced-split-echoes-once";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  await clickReply(page, "מלון / אירוח");
  await send(page, "Bachar House");
  await clickReply(page, "אורחים לפני הזמנה");
  await clickReply(page, "להמשיך");
  await clickReply(page, "אנגלית UK");
  await clickReply(page, "סטנדרטי");
  await clickReply(page, "להמשיך");
  expectIncludes(name, await chatText(page), "איך לחלק את 20-30");
  await clickReply(page, "חלוקה מאוזנת");
  const users = await userMessageTexts(page);
  const balancedCount = users.filter((text) => text.trim() === "חלוקה מאוזנת").length;
  if (balancedCount !== 1) fail(name, "Balanced split should appear as exactly one user bubble", { users, balancedCount });
  await page.close();
}

async function scenarioFaqWordsToAvoidStayGlobal(browser) {
  const name = "faq-words-to-avoid-stay-global";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  await clickReply(page, "מלון / אירוח");
  await send(page, "Bachar House");
  await clickReply(page, "אורחים לפני הזמנה");
  await clickReply(page, "להמשיך");
  await clickReply(page, "אנגלית UK");
  await clickReply(page, "סטנדרטי");
  await clickReply(page, "להמשיך");
  await clickReply(page, "לפי ביקוש וכוונת חיפוש");
  await clickReply(page, "אין מקור כרגע");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");

  expectIncludes(name, await quickText(page), "מילים אסורות");
  await clickReply(page, "מילים אסורות");
  await send(page, "יוקרתי\nהכי טוב");
  const readyText = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, readyText, "מילים אסורות: יוקרתי, הכי טוב");

  await clickReply(page, "להראות פרומפטים");
  const prompts = await chatText(page);
  expectIncludes(name, prompts, "Forbidden phrase rules");
  expectIncludes(name, prompts, "Do not use these words or phrases anywhere");
  expectIncludes(name, prompts, "יוקרתי");
  expectIncludes(name, prompts, "forbidden-phrase cleanup");
  expectNotIncludes(name, prompts, "QUESTION WORDING RULES");
  expectNotIncludes(name, prompts, "ANSWER WORDING RULES");

  await page.evaluate(() => {
    window.open = () => null;
  });
  await clickReply(page, "לפתוח Builder");
  const handoff = await page.evaluate(() => JSON.parse(localStorage.getItem("carmelonAssistantHandoff") || "{}"));
  if (handoff?.values?.forbiddenPhrases !== "יוקרתי\nהכי טוב") {
    fail(name, "FAQ handoff should carry global words-to-avoid into the Builder", { handoff });
  }
  await page.close();
}

async function scenarioFaqSourceUrlBack(browser) {
  const name = "faq-source-url-back";
  const page = await setupPage(browser);
  await send(page, "Build FAQ");
  await clickReply(page, "Hotel / hospitality");
  await send(page, "Bachar House");
  let panel = await panelText(page);
  expectIncludes(name, panel, "RUN PROMPTS");
  expectIncludes(name, panel, "QUESTION PROMPT");
  expectIncludes(name, panel, "ANSWER PROMPT");
  await clickReply(page, "Guests before booking");
  await clickReply(page, "Continue");
  await clickReply(page, "English UK");
  await clickReply(page, "Deep");
  expectIncludes(name, await chatText(page), "I generated suggested categories");
  await clickReply(page, "Continue");
  await clickReply(page, "By demand and intent");
  await clickReply(page, "I have a URL");
  expectIncludes(name, await chatText(page), "Send the URL");
  await clickReply(page, "No URL yet");
  const chat = await chatText(page);
  const replies = await quickText(page);
  expectIncludes(name, chat, "Where should I take the factual information from?");
  expectIncludes(name, replies, "I have a URL");
  expectIncludes(name, replies, "Official site only");
  expectIncludes(name, replies, "No source yet");
  expectNotIncludes(name, chat, "Which checks should run after the answers are written?");
  await page.close();
}

async function scenarioEnglishLocaleStableAfterGuidance(browser) {
  const name = "english-locale-stable-after-guidance";
  const page = await setupPage(browser);
  await send(page, "Build FAQ");
  await clickReply(page, "Hotel / hospitality");
  await send(page, "Bachar House");
  await clickReply(page, "Guests before booking");
  await clickReply(page, "Continue");
  await clickReply(page, "English UK");
  await clickReply(page, "Deep");
  await clickReply(page, "Continue");
  await clickReply(page, "By demand and intent");
  await clickReply(page, "Official site only");
  await clickReply(page, "Continue");
  await clickReply(page, "Continue");
  await clickReply(page, "Professional and direct");
  await clickReply(page, "Continue");
  await clickReply(page, "No QA");
  await clickReply(page, "Add guidance");
  expectIncludes(name, await chatText(page), "Great. Add any guidance");
  await send(page, "Keep the answers concise and practical.");

  const chat = await chatText(page);
  const panel = await panelText(page);
  const replies = await quickText(page);
  expectIncludes(name, chat, "Added the extra guidance to the plan.");
  expectIncludes(name, chat, "FAQ ready:");
  expectIncludes(name, panel, "FAQ draft");
  expectIncludes(name, panel, "Ready to run.");
  expectIncludes(name, replies, "Run now");
  expectIncludes(name, replies, "Show prompts");
  await expectPrimaryReply(page, "Run now");
  expectNoHebrew(name, chat);
  expectNoHebrew(name, panel);
  expectNoHebrew(name, replies);
  await page.close();
}

async function scenarioFaqSubjectValidationBeforeRun(browser) {
  const name = "faq-subject-validation-before-run";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  await clickReply(page, "מלון / אירוח");
  await send(page, "מלון לאונדרו ברלין? אנגלית uk");
  await clickReply(page, "אורחים לפני הזמנה");
  await clickReply(page, "להמשיך");
  await clickReply(page, "סטנדרטי");
  await clickReply(page, "להמשיך");
  await clickReply(page, "לפי ביקוש וכוונת חיפוש");
  await clickReply(page, "אין מקור כרגע");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להריץ עכשיו");
  await page.waitForTimeout(160);

  const preflights = page.__assistantPreflightBodies || [];
  if (!preflights.some((body) => body.phase === "faq-subject-validation")) {
    fail(name, "FAQ run should call the subject validation preflight before creating a sheet", { preflights });
  }

  let emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  if (emits.some((item) => item.event === "start-agent")) {
    fail(name, "FAQ run should wait for subject validation confirmation before emitting start-agent", { emits });
  }

  const confirmationText = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, confirmationText, "Leonardo Hotel Berlin");
  expectIncludes(name, confirmationText, "אנגלית UK");
  expectIncludes(name, confirmationText, "https://www.leonardo-hotels.com/berlin/leonardo-hotel-berlin");
  expectIncludes(name, confirmationText, "זיהיתי שהשם נכתב בעברית");
  expectIncludes(name, confirmationText, "כן, להשתמש בשם ובמקור");
  expectNotIncludes(name, confirmationText, "להשאיר כמו שכתבתי");

  await clickReply(page, "כן, להשתמש בשם ובמקור");
  await page.waitForTimeout(160);
  emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "faq-playground") fail(name, "Confirmed FAQ validation should start the FAQ workflow", { emits });
  if (!Array.isArray(runEmit.payload.subjects) || runEmit.payload.subjects[0] !== "Leonardo Hotel Berlin") {
    fail(name, "FAQ validation should apply normalized subject before run", { payload: runEmit.payload });
  }
  const taskText = JSON.stringify(runEmit.payload.tasks || []);
  expectIncludes(name, taskText, "Output language: English (UK).");
  expectIncludes(name, taskText, "https://www.leonardo-hotels.com/berlin/leonardo-hotel-berlin");
  expectNotIncludes(name, taskText, "אנגלית uk");
  await page.close();
}

async function scenarioFaqSubjectValidationBlocksUnnormalizedEnglishSubject(browser) {
  const name = "faq-subject-validation-blocks-unnormalized-english-subject";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  await clickReply(page, "מלון / אירוח");
  await send(page, "מלון אבגד ברלין? אנגלית uk");
  await clickReply(page, "אורחים לפני הזמנה");
  await clickReply(page, "להמשיך");
  await clickReply(page, "סטנדרטי");
  await clickReply(page, "להמשיך");
  await clickReply(page, "לפי ביקוש וכוונת חיפוש");
  await clickReply(page, "אין מקור כרגע");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להמשיך");
  await clickReply(page, "להריץ עכשיו");
  await page.waitForTimeout(160);

  const text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "לא אריץ על הטקסט המקורי");
  expectIncludes(name, text, "לשנות נושא");
  expectNotIncludes(name, text, "כן, להשתמש בשם הזה");
  expectNotIncludes(name, text, "להשאיר כמו שכתבתי");
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  if (emits.some((item) => item.event === "start-agent")) {
    fail(name, "FAQ validation should block a Hebrew subject that was not normalized for English output", { emits });
  }
  await page.close();
}

async function scenarioTranslateTargetLangsMulti(browser) {
  const name = "translate-target-langs-multi";
  const page = await setupPage(browser);
  await send(page, "תרגמי את הגיליון הזה https://docs.google.com/spreadsheets/d/1FakeSheetIdFakeSheetIdFake12/edit");
  expectIncludes(name, await chatText(page), "לאילו שפות יעד");
  await clickReply(page, "גרמנית");
  await clickReply(page, "צרפתית");
  await clickReply(page, "ספרדית");
  let replies = await quickText(page);
  expectIncludes(name, replies, "✓ גרמנית");
  expectIncludes(name, replies, "✓ צרפתית");
  expectIncludes(name, replies, "✓ ספרדית");

  const beforeLangDoneUsers = await userMessageTexts(page);
  await clickReply(page, "להמשיך");
  const afterLangDoneUsers = await userMessageTexts(page);
  if (afterLangDoneUsers.length !== beforeLangDoneUsers.length + 1) fail(name, "Language Continue should show selected languages as one answer", { beforeLangDoneUsers, afterLangDoneUsers });
  expectIncludes(name, afterLangDoneUsers.at(-1), "גרמנית");
  expectIncludes(name, afterLangDoneUsers.at(-1), "צרפתית");
  expectIncludes(name, afterLangDoneUsers.at(-1), "ספרדית");
  expectNotIncludes(name, afterLangDoneUsers.at(-1), "להמשיך");
  const chat = await chatText(page);
  expectIncludes(name, chat, "תרגום מוכן");
  expectIncludes(name, chat, "גרמנית + צרפתית + ספרדית");
  await expectPrimaryReply(page, "להריץ תרגום");
  await page.close();
}

async function scenarioSiteAuditChecksMulti(browser) {
  const name = "site-audit-checks-multi";
  const page = await setupPage(browser);
  await send(page, "תעשי אודיט לאתר https://example.com");
  expectIncludes(name, await chatText(page), "כמה עמודים לבדוק לעומק");
  await clickReply(page, "עמוק · 50 עמודים");
  expectIncludes(name, await chatText(page), "איך לקרוא את העמודים");
  await clickReply(page, "JS rendered");
  expectIncludes(name, await chatText(page), "להוסיף סיכום/ניתוח AI");
  await clickReply(page, "בלי AI summary");
  expectIncludes(name, await chatText(page), "מה לבדוק באודיט");
  let replies = await quickText(page);
  expectNotIncludes(name, replies, "✓ FAQ");
  expectNotIncludes(name, replies, "✓ Schema");
  expectNotIncludes(name, replies, "✓ קישורים ואמון");
  await clickReply(page, "FAQ");
  await clickReply(page, "Schema");
  await clickReply(page, "קישורים ואמון");
  replies = await quickText(page);
  expectIncludes(name, replies, "✓ FAQ");
  expectIncludes(name, replies, "✓ Schema");
  expectIncludes(name, replies, "✓ קישורים ואמון");
  expectNotIncludes(name, replies, "✓ Sitemap");
  expectNotIncludes(name, replies, "✓ llms.txt");

  const beforeAuditDoneUsers = await userMessageTexts(page);
  await clickReply(page, "להמשיך");
  const afterAuditDoneUsers = await userMessageTexts(page);
  if (afterAuditDoneUsers.length !== beforeAuditDoneUsers.length + 1) fail(name, "Audit Continue should show selected checks as one answer", { beforeAuditDoneUsers, afterAuditDoneUsers });
  expectIncludes(name, afterAuditDoneUsers.at(-1), "FAQ");
  expectIncludes(name, afterAuditDoneUsers.at(-1), "Schema");
  expectNotIncludes(name, afterAuditDoneUsers.at(-1), "Sitemap");
  expectNotIncludes(name, afterAuditDoneUsers.at(-1), "להמשיך");
  const chat = await chatText(page);
  expectIncludes(name, chat, "אודיט האתר מוכן");
  expectIncludes(name, chat, "FAQ");
  expectIncludes(name, chat, "Schema");
  expectIncludes(name, chat, "קישורים ואמון");
  await expectPrimaryReply(page, "להריץ אודיט");
  await clickReply(page, "להריץ אודיט");
  const afterRunChat = await chatText(page);
  const afterRunReplies = await quickText(page);
  expectIncludes(name, afterRunChat, "מריצה AI Site Audit Crawler.");
  expectNotIncludes(name, afterRunChat, "אישור לפני סריקה");
  expectNotIncludes(name, afterRunReplies, "כן, להריץ");
  await page.close();
}

async function scenarioSiteAuditAllChecksSend(browser) {
  const name = "site-audit-all-checks-send";
  const page = await setupPage(browser);
  await send(page, "Run an AI site audit and open the report");
  await send(page, "https://www.leonardo-hotels.co.il/");
  expectIncludes(name, await chatText(page), "How many pages should the crawler inspect deeply?");
  await clickReply(page, "Standard · 25 pages");
  expectIncludes(name, await chatText(page), "Should the crawler read static HTML or JS-rendered pages?");
  await clickReply(page, "JS rendered");
  expectIncludes(name, await chatText(page), "Should the audit include AI analysis and summary?");
  await clickReply(page, "With AI summary");
  expectIncludes(name, await chatText(page), "What should this audit check?");

  let replies = await quickText(page);
  expectNotIncludes(name, replies, "✓ Sitemap");
  expectNotIncludes(name, replies, "✓ llms.txt");
  expectNotIncludes(name, replies, "✓ FAQ");
  expectNotIncludes(name, replies, "✓ Schema");
  expectNotIncludes(name, replies, "✓ All checks");

  await clickReply(page, "Continue");
  expectIncludes(name, await chatText(page), "Choose at least one check");

  const beforeAllUsers = await userMessageTexts(page);
  await clickReply(page, "All checks");
  const afterAllUsers = await userMessageTexts(page);
  if (afterAllUsers.length !== beforeAllUsers.length) fail(name, "All checks should not echo as a chat message while selecting", { beforeAllUsers, afterAllUsers });
  replies = await quickText(page);
  expectIncludes(name, replies, "✓ All checks");

  await clickReply(page, "All checks");
  replies = await quickText(page);
  expectNotIncludes(name, replies, "✓ All checks");
  await clickReply(page, "All checks");

  const beforeSendUsers = await userMessageTexts(page);
  await clickSend(page);
  const afterSendUsers = await userMessageTexts(page);
  if (afterSendUsers.length !== beforeSendUsers.length + 1) fail(name, "Empty Send should confirm default audit checks once", { beforeSendUsers, afterSendUsers });
  expectIncludes(name, afterSendUsers.at(-1), "Sitemap");
  expectIncludes(name, afterSendUsers.at(-1), "llms.txt");
  expectIncludes(name, afterSendUsers.at(-1), "FAQ");
  expectNotIncludes(name, afterSendUsers.at(-1), "Continue");
  expectIncludes(name, await chatText(page), "Audit ready:");
  await page.close();
}

async function scenarioSiteAuditChecksRecommendedClearBack(browser) {
  const name = "site-audit-checks-recommended-clear-back";
  const page = await setupPage(browser);
  await send(page, "Run an AI site audit for https://example.com");
  await clickReply(page, "Standard · 25 pages");
  await clickReply(page, "JS rendered");
  await clickReply(page, "With AI summary");
  expectIncludes(name, await chatText(page), "What should this audit check?");

  const beforeUsers = await userMessageTexts(page);
  await clickReply(page, "Recommended checks");
  let users = await userMessageTexts(page);
  if (users.length !== beforeUsers.length) fail(name, "Recommended checks should not echo as a chat message", { beforeUsers, users });
  let replies = await quickText(page);
  expectIncludes(name, replies, "✓ Sitemap");
  expectIncludes(name, replies, "✓ FAQ");

  await clickReply(page, "Clear selection");
  replies = await quickText(page);
  expectNotIncludes(name, replies, "✓ Sitemap");
  expectNotIncludes(name, replies, "✓ FAQ");

  await clickReply(page, "Back");
  const text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Should the audit include AI analysis and summary?");
  expectIncludes(name, text, "With AI summary");
  users = await userMessageTexts(page);
  expectNotIncludes(name, users.join("\n"), "Back");
  await page.close();
}

async function scenarioSiteSchemaRequestUsesGeneralAudit(browser) {
  const name = "site-schema-request-uses-general-audit";
  const page = await setupPage(browser);
  await send(page, "אני צריכה לבדוק אם יש סכמות בעמודים באתר של לאונרדו");
  let text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "AI Site Audit Crawler");
  expectIncludes(name, text, "איזה אתר לבדוק");
  expectNotIncludes(name, text, "AI FAQ Audit");
  expectNotIncludes(name, text, "איזה אתר לבדוק ל־FAQ ול־Schema");

  await send(page, "https://www.leonardo-hotels.com");
  expectIncludes(name, await chatText(page), "כמה עמודים לבדוק לעומק");
  await clickReply(page, "סטנדרטי · 25 עמודים");
  await clickReply(page, "HTML סטטי");
  await clickReply(page, "בלי AI summary");
  text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "מה לבדוק באודיט");
  expectIncludes(name, text, "✓ Schema");
  expectNotIncludes(name, text, "✓ FAQ");
  await page.close();
}

async function scenarioSchemaRemainsSingleChoice(browser) {
  const name = "schema-single-choice";
  const page = await setupPage(browser);
  await send(page, "create schema for https://docs.google.com/spreadsheets/d/1FakeSchemaSheetFakeSchema12/edit");
  const replies = await quickText(page);
  expectIncludes(name, replies, "Run schema preview");
  expectIncludes(name, replies, "Write to E73 if empty");
  expectIncludes(name, replies, "Overwrite E73");
  expectNotIncludes(name, replies, "Continue");
  await expectPrimaryReply(page, "Run schema preview");
  await page.close();
}

async function scenarioSchemaPreviewSkipsPreflight(browser) {
  const name = "schema-preview-skips-preflight";
  const page = await setupPage(browser);
  await send(page, "create schema for https://docs.google.com/spreadsheets/d/1FakeSchemaNoPreflight12/edit");
  await clickReply(page, "Run schema preview");
  await page.waitForTimeout(120);
  const preflights = page.__assistantPreflightBodies || [];
  if (preflights.length) fail(name, "Deterministic schema preview should not call assistant preflight", { preflights });
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "schema-builder") fail(name, "Schema preview should still emit schema-builder run", { emits });
  if (runEmit.payload?.previewOnly !== true) fail(name, "Schema preview payload should stay previewOnly", { payload: runEmit.payload });
  if (runEmit.payload?.existingValuePolicy !== "skip") fail(name, "Schema default existing-value policy should be skip", { payload: runEmit.payload });
  await page.close();
}

async function scenarioSchemaWriteChoiceAndNoDoubleConfirmation(browser) {
  const name = "schema-write-choice-no-double-confirmation";
  const page = await setupPage(browser);
  await send(page, "תבני schema מהגיליון הזה https://docs.google.com/spreadsheets/d/1FakeSchemaWriteChoice12/edit ולכתוב לתא F79");
  const text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "אם נכתוב לתא F79 ויש שם כבר ערך, מה לעשות?");
  expectIncludes(name, text, "לכתוב לתא F79 רק אם ריק");
  expectIncludes(name, text, "לדרוס את F79");
  expectIncludes(name, text, "להישאר בבדיקה מקדימה");
  await expectPrimaryReply(page, "לכתוב לתא F79 רק אם ריק");
  await clickReply(page, "לכתוב לתא F79 רק אם ריק");
  await page.waitForTimeout(160);
  const userMessages = await userMessageTexts(page);
  if (!userMessages.some((message) => message.includes("לכתוב לתא F79 רק אם ריק"))) {
    fail(name, "Schema write decision should remain visible as a user answer", { userMessages });
  }
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "schema-builder") fail(name, "Schema write choice should emit schema-builder directly", { emits });
  if (runEmit.payload?.previewOnly !== false) fail(name, "Schema write choice should disable preview", { payload: runEmit.payload });
  if (runEmit.payload?.outputCell !== "F79") fail(name, "Schema write choice should preserve the selected output cell", { payload: runEmit.payload });
  if (runEmit.payload?.existingValuePolicy !== "skip") fail(name, "Schema safe write choice should use skip policy", { payload: runEmit.payload });
  const afterClick = `${await chatText(page)}\n${await quickText(page)}`;
  expectNotIncludes(name, afterClick, "כן, להריץ");
  expectNotIncludes(name, afterClick, "Yes, run");
  await page.close();
}

async function scenarioSchemaOverwritePolicy(browser) {
  const name = "schema-overwrite-policy";
  const page = await setupPage(browser);
  await send(page, "create schema for https://docs.google.com/spreadsheets/d/1FakeSchemaOverwrite12/edit write to G12");
  await clickReply(page, "Overwrite G12");
  await page.waitForTimeout(160);
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.existingValuePolicy !== "overwrite") fail(name, "Schema overwrite choice should use overwrite policy", { payload: runEmit?.payload, emits });
  if (runEmit.payload?.outputCell !== "G12") fail(name, "Schema overwrite should preserve output cell", { payload: runEmit.payload });
  await page.close();
}

async function scenarioChatScrollKeepsLongLatestVisible(browser) {
  const name = "chat-scroll-keeps-long-latest-visible";
  const page = await setupPage(browser);
  await send(page, "__scroll_long_message__");
  await page.waitForTimeout(160);
  const metrics = await page.evaluate(() => {
    const chat = document.querySelector("#chatLog");
    const message = chat?.querySelector(".message:last-child");
    if (!chat || !message) return null;
    const chatRect = chat.getBoundingClientRect();
    const messageRect = message.getBoundingClientRect();
    return {
      messageHeight: messageRect.height,
      viewportHeight: chatRect.height,
      topGap: messageRect.top - chatRect.top,
      bottomGap: chatRect.bottom - messageRect.bottom,
      chatBottom: chatRect.bottom,
      quickRepliesTop: document.querySelector("#quickReplies")?.getBoundingClientRect().top || 0,
      messageBottom: messageRect.bottom
    };
  });
  if (!metrics) fail(name, "Expected chat metrics", {});
  if (metrics.messageHeight <= metrics.viewportHeight) fail(name, "Expected the regression message to be taller than the chat viewport", metrics);
  if (Math.abs(metrics.topGap) > 18) fail(name, "Tall latest message should scroll to the top of the chat viewport", metrics);
  if (metrics.quickRepliesTop < metrics.chatBottom - 2) fail(name, "Quick replies should sit below the chat viewport instead of overlaying it", metrics);
  await page.close();
}

async function scenarioSheetEditRouting(browser) {
  const name = "sheet-edit-routing";
  const page = await setupPage(browser);
  await send(page, "תערכי לי את התשובות בעמודה C ככה שלא יהיו קישורים למקורות https://docs.google.com/spreadsheets/d/1FakeSheetEditFakeSheetEdit12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "FAQ Editing Workspace");
  expectIncludes(name, text, "ניקוי קישורי מקור מהתשובות");
  expectIncludes(name, text, "עמודת יעד: C");
  await page.close();
}

async function scenarioSheetEditResultQuestion(browser) {
  const name = "sheet-edit-result-question";
  const page = await setupPage(browser);
  await send(page, "Clean source links from answers in column C https://docs.google.com/spreadsheets/d/1FakeSheetResultFakeSheet12/edit");
  await send(page, "Where will this be written?");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "FAQ Editing Workspace");
  expectIncludes(name, text, "column C");
  expectNotIncludes(name, text, "What kind of FAQ");
  await page.close();
}

async function scenarioFaqThenSheetEditSwitch(browser) {
  const name = "faq-then-sheet-edit-switch";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  expectIncludes(name, await chatText(page), "איזה סוג FAQ");
  await send(page, "לא FAQ חדש, תערוך את התשובות בעמודה C שלא יהיו קישורים למקורות https://docs.google.com/spreadsheets/d/1FakeFaqThenEditFake12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "FAQ Editing Workspace");
  expectIncludes(name, text, "עריכת Google Sheet");
  expectIncludes(name, text, "עמודת יעד: C");
  await page.close();
}

async function scenarioFaqThenSchemaSwitch(browser) {
  const name = "faq-then-schema-switch";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  expectIncludes(name, await chatText(page), "איזה סוג FAQ");
  await send(page, "בעצם תבני schema מהגיליון הזה https://docs.google.com/spreadsheets/d/1FakeSchemaSwitchFake12/edit");
  const text = `${await panelText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Schema Builder");
  expectIncludes(name, text, "לבדוק בלי לכתוב");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  await page.close();
}

async function scenarioFaqThenMetaSwitch(browser) {
  const name = "faq-then-meta-switch";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  expectIncludes(name, await chatText(page), "איזה סוג FAQ");
  await send(page, "בעצם תבני meta tags לאתר https://example.com/services בעברית preview");
  const text = `${await panelText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Meta Tags Studio");
  expectIncludes(name, text, "example.com/services");
  expectIncludes(name, text, "he");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  await page.close();
}

async function scenarioFaqThenTranslationSwitch(browser) {
  const name = "faq-then-translation-switch";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות faq");
  expectIncludes(name, await chatText(page), "איזה סוג FAQ");
  await send(page, "בעצם תרגמי את הגיליון הזה https://docs.google.com/spreadsheets/d/1FakeTranslateSwitch12/edit");
  const text = `${await panelText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "AI Translation Engine");
  expectIncludes(name, text, "Target languages");
  expectIncludes(name, text, "גרמנית");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  await page.close();
}

async function scenarioColumnTransferUnderstandsTarget(browser) {
  const name = "column-transfer-understands-target";
  const page = await setupPage(browser);
  await send(page, "תיקח את התשובות שבעמודה F ותכניס לעמודה C https://docs.google.com/spreadsheets/d/1FakeColumnTransfer12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "FAQ Editing Workspace");
  expectIncludes(name, text, "F → C");
  expectIncludes(name, text, "העתקת ערכים בין עמודות");
  expectNotIncludes(name, text, "F → F");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  await page.close();
}

async function scenarioMetaTagsSingleMode(browser) {
  const name = "meta-tags-single-mode";
  const page = await setupPage(browser);
  await send(page, "Create meta tags for https://example.com/services");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Meta Tags Studio");
  expectIncludes(name, text, "Where should the page names come from?");
  expectIncludes(name, text, "this URL as one page");
  expectNotIncludes(name, text, "Meta tags are ready");
  expectNotIncludes(name, text, "You can choose more than one");
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  if (emits.some((item) => item.event === "start-agent")) fail(name, "Meta Tags should ask guiding questions before running", { emits });
  await page.close();
}

async function scenarioMetaTemplatePreviewSkipsPreflight(browser) {
  const name = "meta-template-preview-skips-preflight";
  const page = await setupPage(browser);
  await send(page, "Create meta tags for https://example.com/services preview");
  await clickReply(page, "this URL as one page");
  await clickReply(page, "Meta title + description");
  await clickReply(page, "English");
  await clickReply(page, "Fast template, no AI");
  await expectPrimaryReply(page, "Generate preview");
  await clickReply(page, "Generate preview");
  await page.waitForTimeout(120);
  const preflights = page.__assistantPreflightBodies || [];
  if (preflights.length) fail(name, "Deterministic meta template preview should not call assistant preflight", { preflights });
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "meta-tags") fail(name, "Meta preview should still emit meta-tags run", { emits });
  if (runEmit.payload?.outputMode !== "preview") fail(name, "Meta preview payload should stay in preview mode", { payload: runEmit.payload });
  if (runEmit.payload?.generationMode !== "template") fail(name, "Meta preview should stay in template mode", { payload: runEmit.payload });
  if (runEmit.payload?.existingValuePolicy !== "skip") fail(name, "Meta default existing-value policy should be skip", { payload: runEmit.payload });
  await page.close();
}

async function scenarioMetaTagsHebrewSheetGuidedFlow(browser) {
  const name = "meta-tags-hebrew-sheet-guided-flow";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות תגיות לקובץ הזה https://docs.google.com/spreadsheets/d/18MTITyggOj7cv69LXxqOJ6vbdGLLJgJ-5tPhmQj2z4E4/edit?usp=sharing טייטל ודסקריפשיין");
  let text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "מאיפה לקחת את שמות העמודים");
  expectIncludes(name, text, "שם הקובץ כעמוד אחד");
  expectNotIncludes(name, text, "Meta tags מוכנים להרצה");
  let emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  if (emits.some((item) => item.event === "start-agent")) fail(name, "Meta Tags should not run immediately after receiving a Sheet URL", { emits });

  await clickReply(page, "שם הקובץ כעמוד אחד");
  text = `${await chatText(page)}\n${await quickText(page)}`;
  expectNotIncludes(name, text, "מה לייצר לכל עמוד");
  expectIncludes(name, text, "באיזו שפה");
  await clickReply(page, "אנגלית UK");

  text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "איך לבנות");
  await clickReply(page, "תבנית מהירה בלי AI");

  text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "לאן להכניס");
  expectIncludes(name, text, "לכתוב לטאב Meta Tags רק אם ריק");
  await expectPrimaryReply(page, "לבדוק בלי לכתוב");
  await clickReply(page, "לבדוק בלי לכתוב");

  text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "Meta tags מוכנים להרצה");
  expectIncludes(name, text, "שדות: Meta title + description");
  expectIncludes(name, text, "שפה: אנגלית");
  expectIncludes(name, text, "תבנית מהירה בלי AI");
  await expectPrimaryReply(page, "לבדוק בלי לכתוב");
  await clickReply(page, "לבדוק בלי לכתוב");
  await page.waitForTimeout(120);

  emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "meta-tags") fail(name, "Guided Meta preview should emit meta-tags", { emits });
  if (runEmit.payload?.outputMode !== "preview") fail(name, "Guided Meta preview should not write", { payload: runEmit.payload });
  if (runEmit.payload?.sourceType !== "sheet") fail(name, "Guided Meta should preserve Sheet source", { payload: runEmit.payload });
  if (!Array.isArray(runEmit.payload?.activeRules) || runEmit.payload.activeRules.includes("includeH1") || runEmit.payload.activeRules.includes("openGraph")) {
    fail(name, "Title/description request should not silently include H1 or Open Graph", { payload: runEmit.payload });
  }
  await page.close();
}

async function scenarioMetaTagsManualFirstTabCellStaysMeta(browser) {
  const name = "meta-tags-manual-first-tab-cell-stays-meta";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבנות תגיות מטה ללינק הזה https://docs.google.com/spreadsheets/d/18MTITyggOj7cv69LXxqOJ6vbdGLLJgJ-5tPhmQj2z4E4/edit?usp=sharing תא f79");
  let text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "Meta Tags Studio");
  expectIncludes(name, text, "מאיפה לקחת את שמות העמודים");
  expectNotIncludes(name, text, "FAQ Editing Workspace");

  await clickReply(page, "שם הקובץ כעמוד אחד");
  await clickReply(page, "Meta title + description");
  await clickReply(page, "אנגלית UK");
  await clickReply(page, "תבנית מהירה בלי AI");
  text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "לאן להכניס");
  expectIncludes(name, text, "הטאב הראשון מתא F79");
  expectIncludes(name, text, "לבחור תא בטאב הראשון");

  await send(page, "לכתוב לטאב הראשון בתא 70e");
  text = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, text, "Meta tags מוכנים להרצה");
  expectIncludes(name, text, "הטאב הראשון!E70");
  expectIncludes(name, text, "לכתוב רק לתאים ריקים");
  expectNotIncludes(name, text, "FAQ Editing Workspace");
  expectNotIncludes(name, text, "העתקת ערכים בין עמודות");

  await clickReply(page, "לכתוב רק לתאים ריקים");
  await page.waitForTimeout(120);
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "meta-tags") fail(name, "Manual first-tab cell should keep the Meta Tags tool active", { emits });
  if (runEmit.payload?.outputMode !== "firstTabRange") fail(name, "Manual first-tab cell should write to the first tab range", { payload: runEmit.payload });
  if (runEmit.payload?.outputStartCell !== "E70") fail(name, "Manual reversed cell 70e should normalize to E70", { payload: runEmit.payload });
  if (runEmit.payload?.existingValuePolicy !== "skip") fail(name, "Manual first-tab write should default to skip", { payload: runEmit.payload });
  await page.close();
}

async function scenarioFaqAuditRoute(browser) {
  const name = "faq-audit-route";
  const page = await setupPage(browser);
  await send(page, "בדיקת FAQ לאתר https://example.com");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "AI FAQ Audit");
  expectIncludes(name, text, "צריך למפות את האתר");
  expectIncludes(name, text, "למפות אתר");
  expectNotIncludes(name, text, "Payload ready");
  await expectPrimaryReply(page, "למפות אתר");
  await clickReply(page, "למפות אתר");
  let emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const discoveryEmit = emits.find((item) => item.event === "start-agent");
  if (!discoveryEmit) fail(name, "Map site should start discovery", { emits });
  if (discoveryEmit.payload?.mode !== "site-ai-discovery") fail(name, "Map site should use site-ai-discovery before FAQ audit", { payload: discoveryEmit.payload });

  await page.evaluate(() => {
    const handlers = window.__assistantSocketHandlers || {};
    const discovery = {
      host: "example.com",
      urls: [
        { url: "https://example.com/faq", groups: ["faq"] },
        { url: "https://example.com/hotel", groups: ["hotel"] },
        { url: "https://example.com/location", groups: ["location"] }
      ],
      groups: [
        { group: "faq", count: 1, examples: ["https://example.com/faq"] },
        { group: "hotel", count: 1, examples: ["https://example.com/hotel"] },
        { group: "location", count: 1, examples: ["https://example.com/location"] }
      ]
    };
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_START");
    JSON.stringify(discovery, null, 2).split("\n").forEach((line) => handlers.log?.(line));
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_END");
    handlers.done?.();
  });
  await page.waitForTimeout(120);
  const afterDiscovery = `${await chatText(page)}\n${await quickText(page)}\n${await panelText(page)}`;
  expectIncludes(name, afterDiscovery, "המיפוי הושלם");
  expectNotIncludes(name, afterDiscovery, "✓ FAQ");
  await clickReply(page, "FAQ");
  expectIncludes(name, await quickText(page), "✓ FAQ");
  await clickReply(page, "להמשיך");
  await expectPrimaryReply(page, "להריץ FAQ audit");
  await clickReply(page, "להריץ FAQ audit");
  const afterRunChat = await chatText(page);
  const afterRunReplies = await quickText(page);
  expectIncludes(name, afterRunChat, "מריצה AI FAQ Audit.");
  expectNotIncludes(name, afterRunChat, "אישור לפני סריקה");
  expectNotIncludes(name, afterRunReplies, "כן, להריץ");
  emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const auditEmit = emits.findLast((item) => item.event === "start-agent");
  if (auditEmit?.payload?.mode !== "site-ai-faq-audit") fail(name, "Explicit run button should start FAQ audit after discovery", { emits });
  if (auditEmit.payload.renderMode !== "rendered") fail(name, "FAQ audit should default to rendered mode so client-rendered schema can be detected", { payload: auditEmit.payload });
  if (!Array.isArray(auditEmit.payload.groups) || !auditEmit.payload.groups.includes("faq")) fail(name, "FAQ audit payload should include mapped groups", { payload: auditEmit.payload });
  if (!Array.isArray(auditEmit.payload.urls) || !auditEmit.payload.urls.includes("https://example.com/faq")) fail(name, "FAQ audit payload should carry URLs selected from discovery", { payload: auditEmit.payload });
  await page.close();
}

async function scenarioFaqAuditResultCreatesClickableReport(browser) {
  const name = "faq-audit-result-clickable-report";
  const page = await setupPage(browser);
  await send(page, "בדיקת FAQ לאתר https://example.com");
  await clickReply(page, "למפות אתר");
  await page.evaluate(() => {
    const handlers = window.__assistantSocketHandlers || {};
    const discovery = {
      host: "example.com",
      urls: [
        { url: "https://example.com/faq", groups: ["faq"] },
        { url: "https://example.com/hotel", groups: ["hotel"] }
      ],
      groups: [
        { group: "faq", count: 1, examples: ["https://example.com/faq"] },
        { group: "hotel", count: 1, examples: ["https://example.com/hotel"] }
      ]
    };
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_START");
    JSON.stringify(discovery, null, 2).split("\n").forEach((line) => handlers.log?.(line));
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_END");
    handlers.done?.();
  });
  await page.waitForTimeout(120);
  await clickReply(page, "FAQ");
  await clickReply(page, "להמשיך");
  const readyText = await chatText(page);
  expectIncludes(name, readyText, "אשתמש ב־1 URLs שנבחרו מהמיפוי הקיים");
  expectNotIncludes(name, readyText, "מיפוי: 2 URLs");
  await clickReply(page, "להריץ FAQ audit");
  await page.waitForTimeout(120);

  const preflights = page.__assistantPreflightBodies || [];
  if (preflights.some((body) => body.toolId === "site-ai-faq-audit")) {
    fail(name, "FAQ audit run should not call smart preflight after deterministic URL selection", { preflights });
  }
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.findLast((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "site-ai-faq-audit") fail(name, "FAQ audit should emit a site-ai-faq-audit run", { emits });
  if (!Array.isArray(runEmit.payload.urls) || runEmit.payload.urls.length !== 1 || runEmit.payload.urls[0] !== "https://example.com/faq") {
    fail(name, "FAQ audit payload should use selected URLs from discovery and avoid remapping", { payload: runEmit.payload });
  }

  await page.evaluate(() => {
    const handlers = window.__assistantSocketHandlers || {};
    const result = {
      startedAt: "2026-05-24T17:00:00.000Z",
      finishedAt: "2026-05-24T17:00:01.000Z",
      startUrl: "https://example.com",
      normalizedStartUrl: "https://example.com/",
      discovery: null,
      selectedUrls: ["https://example.com/faq"],
      pages: [
        {
          url: "https://example.com/faq",
          title: "FAQ",
          h1: "FAQ",
          statusCode: 200,
          rendered: false,
          auditStatus: "missing-schema",
          schemaTypes: [],
          faqPageSchemaCount: 0,
          visibleQaCount: 2,
          schemaQaCount: 0,
          visibleQuestions: ["Question one?", "Question two?"],
          schemaQuestions: [],
          visibleQAs: [],
          schemaQAs: [],
          visibleOnlyQuestions: ["Question one?", "Question two?"],
          schemaOnlyQuestions: [],
          emptyVisibleAnswers: [],
          emptySchemaAnswers: [],
          invalidJsonLdCount: 0,
          notes: ["Visible FAQ exists, but FAQPage schema was not found."]
        },
        {
          url: "https://example.com/schema-faq",
          title: "Schema FAQ",
          h1: "Schema FAQ",
          statusCode: 200,
          rendered: true,
          auditStatus: "missing-visible-faq",
          schemaTypes: ["Answer", "FAQPage", "Question"],
          faqPageSchemaCount: 1,
          visibleQaCount: 0,
          schemaQaCount: 2,
          visibleQuestions: [],
          schemaQuestions: ["Schema question one?", "Schema only question?"],
          visibleQAs: [],
          schemaQAs: [
            { q: "Schema question one?", a: "Schema answer one." },
            { q: "Schema only question?", a: "Schema answer two." }
          ],
          visibleOnlyQuestions: [],
          schemaOnlyQuestions: ["Schema question one?", "Schema only question?"],
          emptyVisibleAnswers: [],
          emptySchemaAnswers: [],
          invalidJsonLdCount: 0,
          notes: ["FAQPage schema exists, but matching visible FAQ was not found.", "Visible Q/A: 0; Schema Q/A: 2; FAQPage objects: 1."]
        }
      ],
      summary: {
        pagesChecked: 2,
        pagesWithVisibleFaq: 1,
        pagesWithFaqSchema: 1,
        pagesOk: 0,
        pagesMissingSchema: 1,
        pagesMissingVisibleFaq: 1,
        pagesWithMismatch: 0,
        totalVisibleQuestions: 2,
        totalSchemaQuestions: 2
      }
    };
    handlers.log?.("SITE_FAQ_AUDIT_RESULT_JSON_START");
    JSON.stringify(result, null, 2).split("\n").forEach((line) => handlers.log?.(line));
    handlers.log?.("SITE_FAQ_AUDIT_RESULT_JSON_END");
    handlers.done?.();
  });
  await page.waitForTimeout(120);

  const latest = await page.locator("#latestOutputPanel").innerText();
  expectIncludes(name, latest, "FAQ audit report ready");
  expectIncludes(name, latest, "2 schema Q/A");
  expectIncludes(name, latest, "Open report");
  const href = await page.locator("#latestOutputPanel a.latest-output-link").getAttribute("href");
  if (!href || !href.includes("/site-ai-faq-audit.html?resultKey=")) fail(name, "FAQ audit output should link to the report workspace", { href });
  const stored = await page.evaluate((url) => {
    const key = new URL(url, window.location.origin).searchParams.get("resultKey");
    return Boolean(key && localStorage.getItem(key));
  }, href);
  if (!stored) fail(name, "FAQ audit report result should be stored for the linked report page", { href });
  expectIncludes(name, await chatText(page), "לא יצרתי Google Sheet בלי אישור");
  const outputCount = Number(await page.locator("#outputsCount").innerText());
  if (outputCount < 2) fail(name, "Output count should include discovery and FAQ audit report outputs", { outputCount });

  await page.goto(new URL(href, BASE_URL).toString(), { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("#faqPanel:not(.hidden)");
  const reportText = await page.locator("body").innerText();
  expectIncludes(name, reportText, "AI FAQ Audit Report");
  expectIncludes(name, reportText, "Question one?");
  expectIncludes(name, reportText, "Schema Q/A");
  expectIncludes(name, reportText, "FAQPage objects");
  expectIncludes(name, reportText, "Schema only question?");
  expectIncludes(name, reportText, "FAQPage");
  expectIncludes(name, reportText, "Loaded FAQ audit report from Generated outputs.");
  await page.close();
}

async function scenarioFaqAuditGroupsCanClearAndGoBack(browser) {
  const name = "faq-audit-groups-clear-back";
  const page = await setupPage(browser);
  await send(page, "בדיקת FAQ לאתר https://example.com");
  await clickReply(page, "למפות אתר");
  await page.evaluate(() => {
    const handlers = window.__assistantSocketHandlers || {};
    const discovery = {
      host: "example.com",
      urls: [
        { url: "https://example.com/faq", groups: ["faq"] },
        { url: "https://example.com/hotel", groups: ["hotel"] },
        { url: "https://example.com/location", groups: ["location"] }
      ],
      groups: [
        { group: "faq", count: 1, examples: ["https://example.com/faq"] },
        { group: "hotel", count: 1, examples: ["https://example.com/hotel"] },
        { group: "location", count: 1, examples: ["https://example.com/location"] }
      ]
    };
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_START");
    JSON.stringify(discovery, null, 2).split("\n").forEach((line) => handlers.log?.(line));
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_END");
    handlers.done?.();
  });
  await page.waitForTimeout(120);
  expectNotIncludes(name, await quickText(page), "✓ FAQ");

  await clickReply(page, "FAQ");
  expectIncludes(name, await quickText(page), "✓ FAQ");
  await clickReply(page, "לנקות בחירה");
  let replies = await quickText(page);
  expectNotIncludes(name, replies, "✓ FAQ");
  expectNotIncludes(name, replies, "✓ Hotels");
  await clickReply(page, "להמשיך");
  expectIncludes(name, await chatText(page), "בחרי לפחות קבוצת URL אחת");

  await clickReply(page, "בחירת ברירת מחדל");
  replies = await quickText(page);
  expectIncludes(name, replies, "✓ FAQ");
  await clickReply(page, "חזרה");
  const text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "חזרתי צעד אחורה");
  expectIncludes(name, text, "למפות אתר");
  await page.close();
}

async function scenarioFaqAuditFreeTextStartsDiscovery(browser) {
  const name = "faq-audit-free-text-starts-discovery";
  const page = await setupPage(browser);
  await send(page, "בדיקת FAQ לאתר https://example.com");
  expectIncludes(name, await chatText(page), "קודם נמפה את האתר");

  await send(page, "כן, תמפה את האתר עכשיו");
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const discoveryEmit = emits.find((item) => item.event === "start-agent");
  if (!discoveryEmit) fail(name, "Free-text mapping confirmation should start discovery", { emits });
  if (discoveryEmit.payload?.mode !== "site-ai-discovery") fail(name, "Free-text mapping confirmation should use site-ai-discovery", { payload: discoveryEmit.payload });
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "AI FAQ Audit");
  expectNotIncludes(name, text, "AI Site Audit Crawler");
  await page.close();
}

async function scenarioFaqAuditFreeTextGroupSelection(browser) {
  const name = "faq-audit-free-text-group-selection";
  const page = await setupPage(browser);
  await send(page, "בדיקת FAQ לאתר https://example.com");
  await clickReply(page, "למפות אתר");
  await page.evaluate(() => {
    const handlers = window.__assistantSocketHandlers || {};
    const discovery = {
      host: "example.com",
      urls: [
        { url: "https://example.com/faq", groups: ["faq"] },
        { url: "https://example.com/hotel", groups: ["hotel"] }
      ],
      groups: [
        { group: "faq", count: 1, examples: ["https://example.com/faq"] },
        { group: "hotel", count: 1, examples: ["https://example.com/hotel"] }
      ]
    };
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_START");
    JSON.stringify(discovery, null, 2).split("\n").forEach((line) => handlers.log?.(line));
    handlers.log?.("SITE_AI_DISCOVERY_RESULT_JSON_END");
    handlers.done?.();
  });
  await page.waitForTimeout(120);

  await send(page, "FAQ");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "אודיט FAQ מוכן");
  expectIncludes(name, text, "קבוצות לאודיט: FAQ");
  expectIncludes(name, text, "להריץ FAQ audit");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  await page.close();
}

async function scenarioFaqAuditDiscoveryCanSwitchToSiteAudit(browser) {
  const name = "faq-audit-discovery-can-switch-to-site-audit";
  const page = await setupPage(browser);
  await send(page, "בדיקת FAQ לאתר https://example.com");
  await send(page, "לא, אודיט אתר מלא");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "AI Site Audit Crawler");
  expectIncludes(name, text, "מחליפה");
  expectNotIncludes(name, text, "צריך למפות את האתר");
  await page.close();
}

async function scenarioFaqImplementationAuditNotCreation(browser) {
  const name = "faq-implementation-audit-not-creation";
  const page = await setupPage(browser);
  await send(page, "לבדוק הטמעה של faq באתר");
  let text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "AI FAQ Audit");
  expectIncludes(name, text, "איזה אתר לבדוק");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  await page.close();

  const correctionPage = await setupPage(browser);
  await send(correctionPage, "אני רוצה לבנות faq");
  expectIncludes(name, await chatText(correctionPage), "איזה סוג FAQ");
  await send(correctionPage, "לא, אני רוצה לבדוק איך ההטמעה של ה FAQ תואמת לסכמה באתר");
  text = `${await panelText(correctionPage)}\n${await chatText(correctionPage)}\n${await quickText(correctionPage)}`;
  expectIncludes(name, text, "AI FAQ Audit");
  expectIncludes(name, text, "זו לא יצירת FAQ");
  expectIncludes(name, text, "איזה אתר לבדוק");
  await correctionPage.close();
}

async function scenarioFaqImplementedQuestionsAuditRoute(browser) {
  const name = "faq-implemented-questions-audit-route";
  const page = await setupPage(browser);
  await send(page, "אני רוצה לבחון שאלות תשובות שכבר הוטמעו באתר");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "AI FAQ Audit");
  expectIncludes(name, text, "איזה אתר לבדוק");
  expectNotIncludes(name, text, "איזה סוג FAQ");
  await page.close();
}

async function scenarioTranslatedSheetEditStaysFormatting(browser) {
  const name = "translated-sheet-edit-stays-formatting";
  const page = await setupPage(browser);
  await send(page, "תתקני את התרגום בעמודה D בקובץ https://docs.google.com/spreadsheets/d/1FakeTranslatedEditFake12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "FAQ Editing Workspace");
  expectNotIncludes(name, text, "AI Translation Engine");
  await page.close();
}

async function scenarioSheetAnswerQaStaysFormatting(browser) {
  const name = "sheet-answer-qa-stays-formatting";
  const page = await setupPage(browser);
  await send(page, "לבדוק את התשובות בעמודה C בגיליון ולתקן אותן https://docs.google.com/spreadsheets/d/1FakeAnswerQaFakeSheet12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "FAQ Editing Workspace");
  expectNotIncludes(name, text, "AI FAQ Audit");
  await page.close();
}

async function scenarioGeneralAuditWithFaqMentionStaysGeneral(browser) {
  const name = "general-audit-with-faq-mention-stays-general";
  const page = await setupPage(browser);
  await send(page, "Run a full site audit including the FAQ pages of https://www.example-hotel.com");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "AI Site Audit Crawler");
  expectNotIncludes(name, text, "AI FAQ Audit");
  await page.close();
}

async function scenarioCrossFileRequestGoesToUtilities(browser) {
  const name = "cross-file-request-goes-to-utilities";
  const page = await setupPage(browser);
  await send(page, "הצלבה מול מאסטר https://docs.google.com/spreadsheets/d/1FakeMasterCrossCheck12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "Sheet Utilities");
  expectNotIncludes(name, text, "FAQ Editing Workspace");
  await page.close();
}

async function scenarioRevisionAfterRunFeedback(browser) {
  const name = "revision-after-run-feedback";
  const page = await setupPage(browser);
  await send(page, "תערוך את הגיליון לפי הערות הלקוחה https://docs.google.com/spreadsheets/d/reg-revision-test/edit");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__assistantSocketHandlers?.done?.());
  await page.waitForTimeout(300);
  await send(page, "לא התייחסת לכל ההערות של הלקוחה ובהערה הראשונה לא נכתבה תשובה מחליפה טובה ומלאה");
  const text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "משוב על הריצה הקודמת");
  expectIncludes(name, text, "לסרוק את כל ההערות מחדש");
  expectNotIncludes(name, text, "הוספתי את זה כהנחיה לכלי");
  await clickReply(page, "לסרוק את כל ההערות מחדש");
  const planText = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, planText, "dry-run");
  expectIncludes(name, planText, "אותו גיליון");
  expectIncludes(name, planText, "לבדוק בלי לכתוב");
  await page.close();
}

async function scenarioRevisionKeepsSameSheetInPayload(browser) {
  const name = "revision-keeps-same-sheet";
  const page = await setupPage(browser);
  await send(page, "תערוך את הגיליון לפי הערות הלקוחה https://docs.google.com/spreadsheets/d/reg-revision-sheet/edit");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__assistantSocketHandlers?.done?.());
  await page.waitForTimeout(300);
  await send(page, "פספסת כמה שורות והתשובה לא טובה בהערה הראשונה");
  await clickReply(page, "לתקן רק שורות בעייתיות");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "reg-revision-sheet");
  expectIncludes(name, text, "שורות בעייתיות");
  await page.close();
}

async function scenarioScanThenExtendFaqPlan(browser) {
  const name = "scan-then-extend-faq-plan";
  const page = await setupPage(browser);
  await send(page, "אני רוצה שתסרוק את כל השאלות שבעמוד הזה ואז תכתוב לי שאלות חדשות שלא קיימות בו https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "שתי משימות");
  expectIncludes(name, text, "שלב 1");
  expectNotIncludes(name, text, "למי זה מיועד");
  await page.close();
}

async function scenarioScanThenExtendFaqRequiresAuditOutput(browser) {
  const name = "scan-then-extend-faq-requires-audit-output";
  const page = await setupPage(browser);
  await send(page, "אני רוצה שתסרוק את כל השאלות שבעמוד הזה ואז תכתוב לי שאלות חדשות שלא קיימות בו https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__assistantSocketHandlers?.done?.());
  await page.waitForTimeout(300);
  const text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "לא אפתח את שלב 2");
  expectNotIncludes(name, text, "כן, להמשיך לשלב 2");
  await page.close();
}

async function scenarioScanThenExtendFaqFollowUp(browser) {
  const name = "scan-then-extend-faq-followup";
  const page = await setupPage(browser);
  await send(page, "אני רוצה שתסרוק את כל השאלות שבעמוד הזה ואז תכתוב לי שאלות חדשות שלא קיימות בו https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv");
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const handlers = window.__assistantSocketHandlers || {};
    const result = {
      startedAt: "2026-07-06T07:00:00.000Z",
      finishedAt: "2026-07-06T07:00:01.000Z",
      startUrl: "https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv",
      selectedUrls: ["https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv"],
      pages: [
        {
          url: "https://www.leonardo-hotels.com/tel-aviv/nyx-hotel-tel-aviv",
          title: "NYX Hotel Tel Aviv",
          visibleQuestions: ["Existing question?"],
          schemaQuestions: [],
        }
      ],
      summary: {
        pagesChecked: 1,
        totalVisibleQuestions: 1,
        totalSchemaQuestions: 0,
        pagesWithMismatch: 0,
        pagesMissingSchema: 0,
        pagesMissingVisibleFaq: 0
      }
    };
    handlers.log?.("SITE_FAQ_AUDIT_RESULT_JSON_START");
    JSON.stringify(result, null, 2).split("\n").forEach((line) => handlers.log?.(line));
    handlers.log?.("SITE_FAQ_AUDIT_RESULT_JSON_END");
    handlers.done?.();
  });
  await page.waitForTimeout(300);
  const text = `${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "שלב 2");
  expectIncludes(name, text, "כן, להמשיך לשלב 2");
  await clickReply(page, "כן, להמשיך לשלב 2");
  const followText = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, followText, "FAQ");
  await page.close();
}

async function scenarioApplyClientNotesAsksNotesLocation(browser) {
  const name = "apply-client-notes-clarifying-question";
  const page = await setupPage(browser);
  await send(page, "תערוך לפי הערות הלקוח https://docs.google.com/spreadsheets/d/reg-notes-test/edit");
  await page.waitForTimeout(500);
  const text = await chatText(page);
  expectIncludes(name, text, "כדי שההרצה תהיה מדויקת");
  await page.close();
}

async function scenarioReadyStatePivotGoesToAssistant(browser) {
  const name = "ready-state-pivot-goes-to-assistant";
  const page = await setupPage(browser);
  await send(page, "תערוך את הגיליון לפי הערות הלקוחה https://docs.google.com/spreadsheets/d/reg-pivot-test/edit");
  await page.waitForTimeout(300);
  await send(page, "רגע, זה לא מה שביקשתי, אני צריכה משהו אחר לגמרי מהסוכן");
  const text = await chatText(page);
  expectNotIncludes(name, text, "הוספתי את זה כהנחיה לכלי");
  await page.close();
}

async function scenarioSheetUtilitiesRoute(browser) {
  const name = "sheet-utilities-route";
  const page = await setupPage(browser);
  await send(page, "Prepare a Sheet Utilities cross-check between two spreadsheets");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Sheet Utilities");
  expectIncludes(name, text, "cross-check");
  expectIncludes(name, text, "Open workspace");
  await expectPrimaryReply(page, "Open workspace");
  await page.close();
}

async function scenarioFileDraftRoute(browser) {
  const name = "file-draft-route";
  const page = await setupPage(browser);
  await send(page, "Edit public/index.html and make the assistant title lighter");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Codex file edit request");
  expectIncludes(name, text, "public/index.html");
  expectIncludes(name, text, "does not write files");
  await page.close();
}

async function scenarioClientReportRoute(browser) {
  const name = "client-report-route";
  const page = await setupPage(browser);
  await send(page, "Build a client report from https://docs.google.com/spreadsheets/d/1FakeReportSheetFakeReport12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Client Reports");
  expectIncludes(name, text, "Data source: sheet");
  expectIncludes(name, text, "Open workspace");
  expectNotIncludes(name, text, "Run tool");
  await expectPrimaryReply(page, "Open workspace");
  await page.close();
}

async function scenarioClientReportAnalyticsRoute(browser) {
  const name = "client-report-analytics-route";
  const page = await setupPage(browser);
  await send(page, "Build a Google Analytics client report for the last 30 days");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "Client Reports");
  expectIncludes(name, text, "Data source: analytics");
  expectIncludes(name, text, "Analytics account: default-ga4");
  expectIncludes(name, text, "Open workspace");
  expectNotIncludes(name, text, "Which Google Sheet should the client report use?");
  await expectPrimaryReply(page, "Open workspace");
  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    scenarioWorkflowNavSearchOpensSiteAudit,
    scenarioWorkflowNavGeneralBeforeSheetSubfeatures,
    scenarioWorkflowNavFuzzyAndEscape,
    scenarioWorkflowNavAskAssistant,
    scenarioWorkflowNavNoResultsAndMobile,
    scenarioFaqOpeningUsesProvidedDetails,
    scenarioFaqHotelUrlInfersSubject,
    scenarioFaqExistingPageGapResearch,
    scenarioFaqAudienceMulti,
    scenarioFaqAudienceCanClearAndGoBack,
    scenarioFaqStyleAndQaMulti,
    scenarioFaqBalancedSplitEchoesOnce,
    scenarioFaqWordsToAvoidStayGlobal,
    scenarioFaqSourceUrlBack,
    scenarioEnglishLocaleStableAfterGuidance,
    scenarioFaqSubjectValidationBeforeRun,
    scenarioFaqSubjectValidationBlocksUnnormalizedEnglishSubject,
    scenarioTranslateTargetLangsMulti,
    scenarioSiteAuditChecksMulti,
    scenarioSiteAuditAllChecksSend,
    scenarioSiteAuditChecksRecommendedClearBack,
    scenarioSiteSchemaRequestUsesGeneralAudit,
    scenarioSchemaRemainsSingleChoice,
    scenarioSchemaPreviewSkipsPreflight,
    scenarioSchemaWriteChoiceAndNoDoubleConfirmation,
    scenarioSchemaOverwritePolicy,
    scenarioChatScrollKeepsLongLatestVisible,
    scenarioSheetEditRouting,
    scenarioSheetEditResultQuestion,
    scenarioFaqThenSheetEditSwitch,
    scenarioFaqThenSchemaSwitch,
    scenarioFaqThenMetaSwitch,
    scenarioFaqThenTranslationSwitch,
    scenarioColumnTransferUnderstandsTarget,
    scenarioMetaTagsSingleMode,
    scenarioMetaTemplatePreviewSkipsPreflight,
    scenarioMetaTagsHebrewSheetGuidedFlow,
    scenarioMetaTagsManualFirstTabCellStaysMeta,
    scenarioFaqAuditRoute,
    scenarioFaqAuditResultCreatesClickableReport,
    scenarioFaqAuditGroupsCanClearAndGoBack,
    scenarioFaqAuditFreeTextStartsDiscovery,
    scenarioFaqAuditFreeTextGroupSelection,
    scenarioFaqAuditDiscoveryCanSwitchToSiteAudit,
    scenarioFaqImplementationAuditNotCreation,
    scenarioFaqImplementedQuestionsAuditRoute,
    scenarioTranslatedSheetEditStaysFormatting,
    scenarioSheetAnswerQaStaysFormatting,
    scenarioGeneralAuditWithFaqMentionStaysGeneral,
    scenarioCrossFileRequestGoesToUtilities,
    scenarioRevisionAfterRunFeedback,
    scenarioRevisionKeepsSameSheetInPayload,
    scenarioScanThenExtendFaqPlan,
    scenarioScanThenExtendFaqRequiresAuditOutput,
    scenarioScanThenExtendFaqFollowUp,
    scenarioApplyClientNotesAsksNotesLocation,
    scenarioReadyStatePivotGoesToAssistant,
    scenarioSheetUtilitiesRoute,
    scenarioFileDraftRoute,
    scenarioClientReportRoute,
    scenarioClientReportAnalyticsRoute
  ];
  const results = [];
  for (const scenario of scenarios) {
    try {
      await scenario(browser);
      results.push({ name: scenario.name.replace(/^scenario/, ""), status: "passed" });
    } catch (error) {
      results.push({ name: scenario.name.replace(/^scenario/, ""), status: "failed", message: error.message, details: error.details || {} });
    }
  }
  await browser.close();
  const failed = results.filter((item) => item.status === "failed");
  console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
