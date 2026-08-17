/**
 * Anthropic API integration for Agent 4 (real production path).
 *
 * Only exercised when ANTHROPIC_API_KEY is set. In this environment it
 * isn't, so scripts/generate-content.ts falls back to the hand-authored
 * content in scripts/lib/core-pages.ts / trust-pages.ts instead - see the
 * README section "Content generation without an LLM API key" for why that's
 * the honest choice here rather than fabricating model output.
 */

import { BANNED_PHRASES } from "./compliance-text.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

export interface GenerationBrief {
  primaryKeyword: string;
  intent: string;
  pageType: string;
  supportingKeywords: string[];
  lsiTerms: string[];
  faqQuestions: string[];
  targets: { wordCount: { median: number; min: number; max: number }; h2: number; tables: number; lists: number };
}

export interface SiteContext {
  name: string;
  positioning: string;
}

export interface GeneratedContent {
  title: string;
  metaDescription: string;
  h1: string;
  sections: { h2: string; html: string }[];
  faq: { question: string; answer: string }[];
  schema: Record<string, unknown>;
  images: { filename: string; alt: string; prompt: string }[];
}

export function buildSystemPrompt(): string {
  return `You are a UK-based casino game reviewer writing in British English (en-GB spelling: "licence" not "license", "colour", "organise", etc.).

Rules you must follow exactly:
- Base every factual claim about game providers or specific operators ONLY on the competitor/brief data supplied in the user message. If a fact isn't in the supplied data, do not state it - write around the gap instead of guessing or estimating.
- Target word count: the brief's targets.wordCount.median, plus or minus 15%.
- Structure: one H1, exactly targets.h2 H2 sections, at least targets.tables HTML tables, at least targets.lists HTML lists (ul/ol) across the whole article, and at least 2 inline SVG infographics (self-contained <svg>...</svg> markup, no external image requests).
- Weave in the brief's lsiTerms naturally where relevant. Keep the primary keyword's density between 0.8% and 1.4% of total word count - do not repeat it unnaturally.
- Build the FAQ section from the brief's faqQuestions.
- Never use any of these words/phrases, in any form: ${BANNED_PHRASES.join(", ")}.
- Never make or imply a promise of winning, and never address or invite anyone under 18.
- Always include a clearly-labelled responsible gambling section mentioning 18+, BeGambleAware and GamCare.
- Output strict JSON only, matching this shape: { "title": string, "metaDescription": string, "h1": string, "sections": [{"h2": string, "html": string}], "faq": [{"question": string, "answer": string}], "schema": object, "images": [{"filename": string, "alt": string, "prompt": string}] }. title <= 60 characters, metaDescription <= 155 characters. The primary keyword must appear in the title, the h1, and within the first 100 characters of body text. Every image alt must be non-empty and reference the primary keyword where natural. Provide 3-4 images.`;
}

export function buildUserMessage(brief: GenerationBrief, site: SiteContext, factualData: unknown): string {
  return JSON.stringify(
    {
      instruction: "Generate the page content JSON described in the system prompt.",
      site,
      brief,
      factualData,
    },
    null,
    2
  );
}

export async function generateWithAnthropic(
  brief: GenerationBrief,
  site: SiteContext,
  factualData: unknown,
  apiKey: string
): Promise<GeneratedContent> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserMessage(brief, site, factualData) }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API returned HTTP ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const textBlock = body.content?.find((b) => b.type === "text")?.text;
  if (!textBlock) throw new Error("Anthropic API response had no text content block");

  return JSON.parse(textBlock) as GeneratedContent;
}
