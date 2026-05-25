const { chromium } = require("playwright");

const BASE_URL = process.env.ASSISTANT_URL || "http://localhost:3105/assistant-workspace.html";

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

async function setupPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ patch: {}, warnings: [], modelUsed: "stubbed-test-preflight" })
    });
  });
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("#assistantInput", { state: "visible" });
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
  await clickReply(page, "עמוק עם JS rendered");
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
  await clickReply(page, "סטנדרטי");
  const chat = await chatText(page);
  expectIncludes(name, chat, "אודיט מוכן");
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
  await clickReply(page, "Rendered JS deep audit");
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
  expectIncludes(name, await chatText(page), "How many pages should the crawler inspect deeply?");
  await page.close();
}

async function scenarioSiteAuditChecksRecommendedClearBack(browser) {
  const name = "site-audit-checks-recommended-clear-back";
  const page = await setupPage(browser);
  await send(page, "Run an AI site audit for https://example.com");
  await clickReply(page, "Rendered JS deep audit");
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
  expectIncludes(name, text, "What kind of audit should I run?");
  expectIncludes(name, text, "Rendered JS deep audit");
  users = await userMessageTexts(page);
  expectNotIncludes(name, users.join("\n"), "Back");
  await page.close();
}

async function scenarioSchemaRemainsSingleChoice(browser) {
  const name = "schema-single-choice";
  const page = await setupPage(browser);
  await send(page, "create schema for https://docs.google.com/spreadsheets/d/1FakeSchemaSheetFakeSchema12/edit");
  const replies = await quickText(page);
  expectIncludes(name, replies, "Run schema preview");
  expectIncludes(name, replies, "Write to Sheet");
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
  await page.close();
}

async function scenarioSheetEditRouting(browser) {
  const name = "sheet-edit-routing";
  const page = await setupPage(browser);
  await send(page, "תערכי לי את התשובות בעמודה C ככה שלא יהיו קישורים למקורות https://docs.google.com/spreadsheets/d/1FakeSheetEditFakeSheetEdit12/edit");
  const text = `${await panelText(page)}\n${await chatText(page)}`;
  expectIncludes(name, text, "FAQ Editing Workspace");
  expectIncludes(name, text, "ניקוי קישורי מקור מהתשובות");
  expectIncludes(name, text, "פלט: C");
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
  expectIncludes(name, text, "פלט: C");
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
  expectIncludes(name, text, "להריץ Schema preview");
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
  expectIncludes(name, text, "replace_column_when_value");
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
  expectIncludes(name, text, "meta");
  expectNotIncludes(name, text, "You can choose more than one");
  await page.close();
}

async function scenarioMetaTemplatePreviewSkipsPreflight(browser) {
  const name = "meta-template-preview-skips-preflight";
  const page = await setupPage(browser);
  await send(page, "Create meta tags for https://example.com/services preview");
  await clickReply(page, "Generate preview");
  await page.waitForTimeout(120);
  const preflights = page.__assistantPreflightBodies || [];
  if (preflights.length) fail(name, "Deterministic meta template preview should not call assistant preflight", { preflights });
  const emits = await page.evaluate(() => window.__assistantSocketEmits || []);
  const runEmit = emits.find((item) => item.event === "start-agent");
  if (runEmit?.payload?.mode !== "meta-tags") fail(name, "Meta preview should still emit meta-tags run", { emits });
  if (runEmit.payload?.outputMode !== "preview") fail(name, "Meta preview payload should stay in preview mode", { payload: runEmit.payload });
  if (runEmit.payload?.generationMode !== "template") fail(name, "Meta preview should stay in template mode", { payload: runEmit.payload });
  await page.close();
}

async function scenarioFaqAuditRoute(browser) {
  const name = "faq-audit-route";
  const page = await setupPage(browser);
  await send(page, "בדיקת FAQ לאתר https://example.com");
  const text = `${await panelText(page)}\n${await chatText(page)}\n${await quickText(page)}`;
  expectIncludes(name, text, "AI FAQ Audit");
  expectIncludes(name, text, "Site mapping needed");
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
  expectNotIncludes(name, text, "Site mapping needed");
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
    scenarioFaqOpeningUsesProvidedDetails,
    scenarioFaqAudienceMulti,
    scenarioFaqAudienceCanClearAndGoBack,
    scenarioFaqStyleAndQaMulti,
    scenarioFaqSourceUrlBack,
    scenarioEnglishLocaleStableAfterGuidance,
    scenarioTranslateTargetLangsMulti,
    scenarioSiteAuditChecksMulti,
    scenarioSiteAuditAllChecksSend,
    scenarioSiteAuditChecksRecommendedClearBack,
    scenarioSchemaRemainsSingleChoice,
    scenarioSchemaPreviewSkipsPreflight,
    scenarioSheetEditRouting,
    scenarioSheetEditResultQuestion,
    scenarioFaqThenSheetEditSwitch,
    scenarioFaqThenSchemaSwitch,
    scenarioFaqThenMetaSwitch,
    scenarioFaqThenTranslationSwitch,
    scenarioColumnTransferUnderstandsTarget,
    scenarioMetaTagsSingleMode,
    scenarioMetaTemplatePreviewSkipsPreflight,
    scenarioFaqAuditRoute,
    scenarioFaqAuditResultCreatesClickableReport,
    scenarioFaqAuditGroupsCanClearAndGoBack,
    scenarioFaqAuditFreeTextStartsDiscovery,
    scenarioFaqAuditFreeTextGroupSelection,
    scenarioFaqAuditDiscoveryCanSwitchToSiteAudit,
    scenarioFaqImplementationAuditNotCreation,
    scenarioFaqImplementedQuestionsAuditRoute,
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
