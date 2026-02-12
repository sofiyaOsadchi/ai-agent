// NOTE: Keep code in English. Comments can be Hebrew if you want.

import type { TerminologyProfile, TerminologyMapRule, FewShotExample } from "./terminology-management.js";

export type SelectedTerminology = {
  matchedForbidden: string[];
  mappings: TerminologyMapRule[];
  examples: FewShotExample[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// === Stopwords for fallback example matching ===
// Common German/English words that are too generic to be distinctive triggers
const STOPWORDS = new Set([
  // German
  "das", "der", "die", "ein", "eine", "einer", "eines", "einem", "einen",
  "ist", "sind", "wird", "werden", "hat", "haben", "kann", "können",
  "und", "oder", "aber", "auch", "noch", "schon", "sehr", "nicht",
  "für", "von", "mit", "auf", "aus", "bei", "nach", "über", "unter",
  "des", "dem", "den", "zum", "zur", "als", "wie", "was", "wer",
  "sich", "alle", "jede", "jedes", "jedem", "jeden", "nein",
  "gibt", "bietet", "steht", "hotel", "zimmer", "gäste", "gästen",
  "verfügt", "wurden", "wird", "dort", "hier", "dass", "wenn",
  // English
  "the", "yes", "and", "for", "are", "was", "not", "but", "all",
  "can", "her", "was", "one", "our", "out",
]);

/**
 * Extract distinctive tokens from a text for fallback matching.
 * Returns lowercased tokens > 4 chars that are not stopwords.
 */
function extractDistinctiveTokens(text: string): string[] {
  return text
    .split(/[\s.,;:!?"()\[\]{}–—\/…]+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 4 && !STOPWORDS.has(w));
}

/**
 * Builds a RegExp from a forbidden term string.
 *
 * Handles:
 * - Normal multi-word phrases: "auf Wunsch" → /auf[\s]+Wunsch/i
 * - Wildcard "..." between words: "steht ... bereit" → /steht.{0,80}?bereit/i
 * - Optional trailing punctuation on each token
 * - Flexible whitespace (including non-breaking space)
 */
function buildForbiddenRegex(forbidden: string): RegExp {
  const raw = (forbidden || "").trim();
  if (!raw || raw.length < 2) return /$a/; // never matches

  // 1) normalize spaces
  const normalized = raw.replace(/\s+/g, " ").trim();

  // 2) Handle "..." as wildcard (match variable text in between)
  const ellipsisParts = normalized.split(/\s*\.{2,}\s*/);

  if (ellipsisParts.length > 1) {
    // Build pattern with wildcard between parts
    const partPatterns = ellipsisParts
      .filter(p => p.trim().length > 0)
      .map(part => {
        const tokens = part.trim().split(" ").map(t => escapeRegExp(t));
        const ws = `[\\s\\u00A0]+`;
        return tokens.map(t => `${t}[\\.,;:!?]?`).join(ws);
      });

    // Allow up to ~80 chars between parts (covers typical German phrases)
    const wildcard = `[\\s\\S]{0,80}?`;
    return new RegExp(partPatterns.join(wildcard), "i");
  }

  // 3) Normal (no ellipsis): split to tokens
  const tokens = normalized.split(" ").map(t => escapeRegExp(t));
  const ws = `[\\s\\u00A0]+`;

  const tokenPattern = tokens
    .map(t => `${t}[\\.,;:!?]?`)
    .join(ws);

  return new RegExp(tokenPattern, "i");
}

function matrixToText(rows: string[][]): string {
  return rows
    .map(r => (r ?? []).map(c => c ?? "").join(" | "))
    .join("\n");
}

function indexExamplesByForbidden(
  forbiddenRules: TerminologyMapRule[],
  examples: FewShotExample[]
): Map<string, FewShotExample[]> {
  const map = new Map<string, FewShotExample[]>();

  for (const rule of forbiddenRules) {
    const rx = buildForbiddenRegex(rule.forbidden);
    const key = rule.forbidden;

    for (const ex of examples) {
      const draft = ex.draft ?? "";
      if (rx.test(draft)) {
        const arr = map.get(key) ?? [];
        arr.push(ex);
        map.set(key, arr);
      }
    }
  }

  return map;
}

/**
 * Fallback: check if an example's draft has enough distinctive-token overlap
 * with the actual draft text to be considered relevant.
 *
 * Uses a threshold: at least `minHits` distinctive tokens from the example
 * must appear in the draft text.
 */
function exampleMatchesDraftFallback(
  exampleDraft: string,
  draftTextLower: string,
  minHits: number = 2
): boolean {
  const tokens = extractDistinctiveTokens(exampleDraft);

  // For very short examples (1-2 distinctive tokens), require just 1 match
  const threshold = tokens.length <= 2 ? 1 : minHits;

  let hits = 0;
  for (const t of tokens) {
    if (draftTextLower.includes(t)) {
      hits++;
      if (hits >= threshold) return true;
    }
  }

  return false;
}

export function selectTerminologyByDraftHits(
  profile: TerminologyProfile,
  draftRows: string[][],
  opts?: {
    maxForbiddenHits?: number;
    maxMappings?: number;
    maxExamples?: number;
    debug?: boolean;
  }
): SelectedTerminology {
  const maxForbiddenHits = opts?.maxForbiddenHits ?? 30;
  const maxMappings = opts?.maxMappings ?? 30;
  const maxExamples = opts?.maxExamples ?? 20;

  const mappingsAll = profile.mappings ?? [];
  const examplesAll = profile.examples ?? [];

  const draftText = matrixToText(draftRows);
  const draftTextLower = draftText.toLowerCase();

  const debug = opts?.debug ?? false;

  if (debug) {
    console.log(`[TERMS][debug] draftText length=${draftText.length}`);
  }

  // === Phase 1: Find forbidden terms that appear in draft ===
  const hits: string[] = [];
  for (const rule of mappingsAll) {
    const forbidden = (rule.forbidden ?? "").trim();
    if (!forbidden) continue;

    const rx = buildForbiddenRegex(forbidden);
    if (rx.test(draftText)) {
      hits.push(forbidden);
      if (hits.length >= maxForbiddenHits) break;
    }
  }

  const hitSet = new Set(hits);

  const selectedMappings = mappingsAll
    .filter(r => hitSet.has((r.forbidden ?? "").trim()))
    .slice(0, maxMappings);

  // === Phase 2: Select examples linked to matched forbidden terms ===
  const exByForbidden = indexExamplesByForbidden(selectedMappings, examplesAll);

  const selectedExamples: FewShotExample[] = [];
  const selectedDrafts = new Set<string>(); // track by draft text to avoid duplicates

  for (const forbidden of hits) {
    const arr = exByForbidden.get(forbidden) ?? [];
    for (const ex of arr) {
      if (selectedDrafts.has(ex.draft)) continue;
      selectedExamples.push(ex);
      selectedDrafts.add(ex.draft);
      if (selectedExamples.length >= maxExamples) break;
    }
    if (selectedExamples.length >= maxExamples) break;
  }

  // === Phase 3: FALLBACK — scan remaining examples independently ===
  // This catches examples whose patterns appear in the draft but have no
  // corresponding forbidden mapping (or whose mapping didn't trigger).
  if (selectedExamples.length < maxExamples) {
    let fallbackCount = 0;

    for (const ex of examplesAll) {
      if (selectedExamples.length >= maxExamples) break;
      if (selectedDrafts.has(ex.draft)) continue;

      if (exampleMatchesDraftFallback(ex.draft, draftTextLower, 2)) {
        selectedExamples.push(ex);
        selectedDrafts.add(ex.draft);
        fallbackCount++;
      }
    }

    if (debug && fallbackCount > 0) {
      console.log(`[TERMS][debug] fallback added ${fallbackCount} extra examples`);
    }
  }

  return {
    matchedForbidden: hits,
    mappings: selectedMappings,
    examples: selectedExamples,
  };
}

export function formatStrictTerminologyFromSelection(sel: SelectedTerminology): string {
  const mappings = sel.mappings ?? [];
  const examples = sel.examples ?? [];

  if (mappings.length === 0 && examples.length === 0) return "";

  const lines: string[] = [];
  lines.push("=== STRICT TERMINOLOGY ENFORCEMENT ===");
  lines.push("Apply the following constraints while polishing.");
  lines.push("Only apply rules that are relevant to the provided DRAFT.");
  lines.push("Do NOT do blind find-and-replace. Rewrite naturally while keeping correct grammar.");
  lines.push("");

  if ((sel.matchedForbidden ?? []).length > 0) {
    lines.push(`Matched forbidden terms in DRAFT: ${sel.matchedForbidden.join(", ")}`);
    lines.push("");
  }

  if (mappings.length > 0) {
    lines.push("A) Forbidden -> Preferred (apply when you see the forbidden term in DRAFT):");
    lines.push("");

    for (const r of mappings) {
      const reason = r.reason ? ` Reason: ${r.reason}` : "";
      lines.push(`- Forbidden: "${r.forbidden}" -> Preferred: "${r.preferred}".${reason}`);
    }

    lines.push("");
  }

  if (examples.length > 0) {
    lines.push("B) Few-shot examples (follow the pattern in similar cases):");
    lines.push("");

    for (const ex of examples) {
      const note = ex.note ? ` Note: ${ex.note}` : "";
      lines.push(`- Draft: ${ex.draft}`);
      lines.push(`  Polish: ${ex.polish}.${note}`);
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}