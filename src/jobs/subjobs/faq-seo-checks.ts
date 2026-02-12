// src/seo/faq-seo-checks.ts
// -------------------------------------------------------------
// בדיקות SEO בסיסיות לעמודי FAQ:
// * <title> ו- meta description
// * JSON-LD מסוג FAQPage + שאלות/תשובות מתוך הסכמה
// מחזיר issues בפורמט rule (kind: "rule") + רשימת Q/A מהסכמה
// + metaTitle/metaDescription ו־flag אם הסכמה תקינה.
// -------------------------------------------------------------

import * as cheerio from "cheerio";

export type QA = { q: string; a: string };

export type SeoRuleIssue = {
  kind: "rule";
  q: string;       // בדרך כלל ריק – לא קשור ל-Q/A ספציפי
  a: string;       // גם ריק
  reason: string;  // טקסט הסיבה
  index: number;   // -1 כדי לציין "לא קשור לאייטם מסוים"
};

export type SeoCheckResult = {
  issues: SeoRuleIssue[];
  schemaQAs: QA[];
  metaTitle: string;
  metaDescription: string;
  schemaOk: boolean;
};

export function validateMetaAndFaqSchema(html: string): SeoCheckResult {
  const $ = cheerio.load(html);
  const issues: SeoRuleIssue[] = [];
  const schemaQAs: QA[] = [];

  // ---------- 1) בדיקת <title> ----------
  const title = ($("head > title").text() || "").trim();
  if (!title) {
    issues.push(makeIssue("[meta] Missing <title> tag"));
  } else if (title.length < 10) {
    issues.push(makeIssue("[meta] <title> is very short (less than 10 chars)"));
  }

  // ---------- 1.5) בדיקת <h1> ----------
  const h1 = $("h1").text().trim();
  if (!h1) {
    issues.push(makeIssue("[meta] Missing <h1> tag"));
  } else if (h1.length < 5) {
    issues.push(makeIssue("[meta] <h1> is extremely short"));
  }

  // ---------- 2) meta description ----------
  const desc = ($('head meta[name="description"]').attr("content") || "").trim();
  if (!desc) {
    issues.push(makeIssue('[meta] Missing meta \"description\"'));
  } else if (desc.length < 30) {
    issues.push(makeIssue('[meta] description is very short (less than 30 chars)'));
  }

  let schemaOk = false;

  // ---------- 3) חיפוש JSON-LD ----------
  const scripts = $('script[type="application/ld+json"]');
  if (!scripts.length) {
    issues.push(makeIssue("[schema] No JSON-LD script tags found on page"));
    return {
      issues,
      schemaQAs,
      metaTitle: title,
      metaDescription: desc,
      schemaOk: false,
    };
  }

  const jsonObjects: any[] = [];
  scripts.each((_, el) => {
    const txt = $(el).contents().text();
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) {
        parsed.forEach(x => jsonObjects.push(x));
      } else {
        jsonObjects.push(parsed);
      }
    } catch {
      issues.push(makeIssue("[schema] Invalid JSON-LD (parse error)"));
    }
  });

  if (!jsonObjects.length) {
    issues.push(makeIssue("[schema] No valid JSON-LD objects parsed"));
    return {
      issues,
      schemaQAs,
      metaTitle: title,
      metaDescription: desc,
      schemaOk: false,
    };
  }

    // ---------- 2.5) Indexing (robots meta) ----------
  const robotNames = ["robots", "googlebot", "bingbot"];
  const robotDirectives: Array<{ name: string; content: string }> = [];

  for (const name of robotNames) {
    const content = ($(`head meta[name="${name}"]`).attr("content") || "").trim();
    if (content) robotDirectives.push({ name, content });
  }

  for (const { name, content } of robotDirectives) {
    const lc = content.toLowerCase();

    // "none" implies noindex,nofollow
    const hasNoIndex = lc.includes("noindex") || lc.includes("none");
    const hasNoFollow = lc.includes("nofollow") || lc.includes("none");

    if (hasNoIndex || hasNoFollow) {
      const parts: string[] = [];
      if (hasNoIndex) parts.push("noindex");
      if (hasNoFollow) parts.push("nofollow");

      issues.push(
        makeIssue(`[indexing] meta name="${name}" blocks indexing: ${parts.join(", ")} (content="${content}")`)
      );
    }
  }

  // ---------- 4) איתור FAQPage ----------
  const faqObjects: any[] = [];

  const visit = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    const type = (obj["@type"] || obj["@TYPE"] || "").toString();
    if (/faqpage/i.test(type)) faqObjects.push(obj);
    if (Array.isArray(obj["@graph"])) {
      obj["@graph"].forEach((x: any) => visit(x));
    }
  };

  for (const obj of jsonObjects) {
    visit(obj);
  }

  if (!faqObjects.length) {
    issues.push(makeIssue("[schema] No @type: FAQPage object found in JSON-LD"));
    return {
      issues,
      schemaQAs,
      metaTitle: title,
      metaDescription: desc,
      schemaOk: false,
    };
  }

  // ---------- 5) חילוץ Q/A מתוך FAQPage ----------
  for (const faq of faqObjects) {
    const main = faq.mainEntity || faq.mainEntityOfPage || [];
    const items = Array.isArray(main) ? main : [main];

    for (const it of items) {
      const t = (it.name || it.question || "").toString().trim();
      let ansText = "";

      const accepted = it.acceptedAnswer || it.acceptedAnswers || it.answer;
      if (accepted) {
        if (Array.isArray(accepted)) {
          ansText = accepted
            .map(a => (a.text || a.articleBody || "").toString())
            .join(" ");
        } else {
          ansText = (accepted.text || accepted.articleBody || "").toString();
        }
      }

      const a = ansText.replace(/\s+/g, " ").trim();
      const q = t.replace(/\s+/g, " ").trim();

      if (!q || !a) {
        issues.push(
          makeIssue("[schema] Question or answer missing in FAQPage mainEntity item")
        );
      } else {
        schemaQAs.push({ q, a });
      }
    }
  }

  if (!schemaQAs.length) {
    issues.push(
      makeIssue("[schema] FAQPage exists but contains no valid Q/A pairs")
    );
  }

  // סכמה נחשבת "תקינה" רק אם:
  // * יש FAQPage,
  // * יש לפחות זוג Q/A אחד תקין,
  // * ואין שום issue שמתחיל ב-[schema]
  if (
    faqObjects.length &&
    schemaQAs.length &&
    !issues.some(i => i.reason.startsWith("[schema]"))
  ) {
    schemaOk = true;
  }

  return {
    issues,
    schemaQAs,
    metaTitle: title,
    metaDescription: desc,
    schemaOk,
  };
}

// ---------- עזר קטן ליצירת issue ----------
function makeIssue(reason: string): SeoRuleIssue {
  return {
    kind: "rule",
    q: "",
    a: "",
    reason,
    index: -1,
  };
}