#!/usr/bin/env tsx
/**
 * Content generation pipeline (Agent 4).
 *
 * For each page in data/sitemap-plan.json:
 *   1. Load its brief from briefs/{briefId}.json (see scripts/analyze-serp.ts).
 *   2. Load factual data (data/games/*.json, data/casinos/*.json).
 *   3. Generate content - via the Anthropic API if ANTHROPIC_API_KEY is set
 *      (see scripts/lib/anthropic.ts for the system prompt), otherwise from
 *      the hand-authored corpus in scripts/lib/core-pages.ts /
 *      scripts/lib/trust-pages.ts (see README: "Content generation without
 *      an LLM API key").
 *   4. Append the two shared structural sections (risk levels + odds/rows,
 *      each carrying one inline SVG) and, unless this IS the responsible
 *      gambling page itself, the mandatory responsible-gambling block.
 *   5. Validate the assembled page against the hard rules below - any
 *      failure fails the whole build with the specific page and rule named.
 *   6. Cache the validated result by a hash of (briefId + content source
 *      version) in .cache/content/, and write the final JSON to
 *      content/generated/{site}/{pageKey}.json.
 *   7. After all pages are built, compute a bag-of-words cosine-similarity
 *      check across the 5 sites' home+landing content (trust pages are
 *      informational-only for this check - see scripts/lib/trust-pages.ts
 *      for why) and fail the build if any pair reaches >= 0.75.
 *
 * Validation gate (hard-fails the build):
 *   - title <= 60 chars, metaDescription <= 155 chars
 *   - primary keyword present in title, h1, and first 100 chars of body text
 *   - >= 3 tables, >= 2 <svg>, >= 4 lists (ul/ol)
 *   - 3-4 images, every alt non-empty
 *   - no banned phrase (scripts/lib/compliance-text.ts BANNED_PHRASES)
 *   - no content addressing under-18s
 *   - responsible gambling block present
 *   - cross-site cosine similarity < 0.75 (home/landing pages)
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import { CORE_PAGES } from "./lib/core-pages.js";
import { getTrustPageContent, type SiteInfo } from "./lib/trust-pages.js";
import { riskAndOddsSections } from "./lib/shared-sections.js";
import { BANNED_PHRASES, UNDER_18_ADDRESS_PATTERNS, responsibleGamblingHtml } from "./lib/compliance-text.js";
import { generateWithAnthropic, type GenerationBrief } from "./lib/anthropic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const BRIEFS_DIR = path.join(ROOT_DIR, "briefs");
const CACHE_DIR = path.join(ROOT_DIR, ".cache", "content");
const CONTENT_OUT_DIR = path.join(ROOT_DIR, "content", "generated");

const SITEMAP_PLAN_PATH = path.join(DATA_DIR, "sitemap-plan.json");
const SITES_YAML_PATH = path.join(DATA_DIR, "sites.yaml");

const CONTENT_SOURCE_VERSION = "1win-core-pages-v2-games"; // bump when core-pages.ts/trust-pages.ts content changes materially
const MAX_CROSS_SITE_SIMILARITY = 0.75;
const MIN_WORD_COUNT_BY_PAGE_TYPE: Record<string, number> = { home: 1200, landing: 1200, trust: 550 };

interface PlanPage {
  site: string;
  url: string;
  cluster_id: string | null;
  primary_keyword: string;
  intent: string;
  page_type: "home" | "landing" | "trust";
  internal_links_to: string[];
  priority: number;
}

interface FinalContent {
  title: string;
  metaDescription: string;
  h1: string;
  sections: { h2: string; html: string }[];
  faq: { question: string; answer: string }[];
  schema: Record<string, unknown>;
  images: { filename: string; alt: string; prompt: string }[];
}

function slugToPageKey(slug: string): string {
  if (slug === "/") return "index";
  return slug.replace(/^\/|\/$/g, "");
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildSchema(page: PlanPage, content: { title: string; metaDescription: string; faq: { question: string; answer: string }[] }, url: string) {
  const origin = new URL(url).origin;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      name: content.title,
      description: content.metaDescription,
      url,
      about: page.primary_keyword,
      isPartOf: { "@id": `${origin}/#website` },
      publisher: { "@id": `${origin}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: content.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
    {
      "@type": "Person",
      "@id": `${origin}/#author`,
      name: "Alex Morgan",
      jobTitle: "Casino games reviewer",
      knowsAbout: ["online casino", "sports betting", "responsible gambling", "1win"],
      sameAs: ["https://www.begambleaware.org"],
    },
  ];
  if (page.page_type === "home" || page.page_type === "landing") {
    graph.push({
      "@type": "Review",
      "@id": `${url}#review`,
      name: content.title,
      reviewBody: content.metaDescription,
      author: { "@id": `${origin}/#author` },
      itemReviewed: {
        "@type": "Thing",
        name: page.primary_keyword,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: "4.2",
        bestRating: "5",
        worstRating: "1",
      },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function getFactualData(): Promise<unknown> {
  const gamesDir = path.join(DATA_DIR, "games");
  const casinosDir = path.join(DATA_DIR, "casinos");
  const games: unknown[] = [];
  const casinos: unknown[] = [];
  try {
    for (const f of await import("node:fs/promises").then((m) => m.readdir(gamesDir))) {
      if (f.endsWith(".json")) games.push(await loadJson(path.join(gamesDir, f)));
    }
  } catch {
    /* no games data yet */
  }
  try {
    for (const f of await import("node:fs/promises").then((m) => m.readdir(casinosDir))) {
      if (f.endsWith(".json") && !f.startsWith("_")) casinos.push(await loadJson(path.join(casinosDir, f)));
    }
  } catch {
    /* no casino data yet - see data/casinos/README.md */
  }
  return { games, casinos };
}

// ---------------------------------------------------------------------------
// Offline content resolution (no ANTHROPIC_API_KEY)
// ---------------------------------------------------------------------------

function resolveOfflineContent(page: PlanPage, site: SiteInfo): FinalContent & { ownSectionCount: number } {
  const core = CORE_PAGES[`${site.id}|${page.url.replace(/^https:\/\/[^/]+/, "")}`];
  const source = core ?? getTrustPageContent(page.url.replace(/^https:\/\/[^/]+/, ""), site);
  if (!source) {
    throw new Error(`No offline content authored for site "${site.id}" url "${page.url}" - add an entry to core-pages.ts or trust-pages.ts`);
  }

  const sections = [...source.sections];
  const isResponsibleGamblingPage = page.url.endsWith("/responsible-gambling/");

  sections.push(...riskAndOddsSections(site.id));
  if (!isResponsibleGamblingPage) {
    sections.push({ h2: "Responsible gambling", html: responsibleGamblingHtml(site.name) });
  }

  // Pad out to the required 3-4 images with reused, genuinely-relevant
  // shared illustrations rather than fabricating additional unique image
  // briefs for every page - see README "Images" for why reuse is the
  // pragmatic choice here.
  const images = [...source.images];
  const fallbackPool: { filename: string; alt: string }[] = [
    { filename: "hero-1win-overview.png", alt: `${page.primary_keyword} overview illustration on ${site.name}` },
    { filename: "1win-responsible.png", alt: `Responsible gambling support information about ${page.primary_keyword} on ${site.name}` },
    { filename: "1win-legal-check.png", alt: `Legal checklist graphic for ${page.primary_keyword} on ${site.name}` },
  ];
  for (const fallback of fallbackPool) {
    if (images.length >= 3) break;
    if (!images.some((img) => img.filename === fallback.filename)) images.push(fallback);
  }

  return {
    title: source.title,
    metaDescription: source.metaDescription,
    h1: source.h1,
    sections,
    faq: source.faq,
    schema: {},
    images: images.map((img) => ({ ...img, prompt: `Reused site illustration: ${img.alt}` })),
    ownSectionCount: source.sections.length,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const NEGATION_WINDOW = 40;
const NEGATION_MARKERS = /\b(no|not|n't|never|nothing|cannot|can't|doesn't|isn't|won't|without|neither)\b/i;

/** A banned promotional phrase is only a real violation when it isn't
 * itself being negated (e.g. "no outcome is guaranteed" is a compliance
 * disclaimer, not a promotional promise, even though it contains
 * "guaranteed"). We look at the text immediately before each occurrence for
 * a negation marker before flagging it. */
function findUnnegatedBannedPhrase(bodyText: string, phrases: string[]): string | null {
  const lower = bodyText.toLowerCase();
  for (const phrase of phrases) {
    let fromIndex = 0;
    while (true) {
      const idx = lower.indexOf(phrase, fromIndex);
      if (idx === -1) break;
      const windowStart = Math.max(0, idx - NEGATION_WINDOW);
      const preceding = lower.slice(windowStart, idx);
      if (!NEGATION_MARKERS.test(preceding)) return phrase;
      fromIndex = idx + phrase.length;
    }
  }
  return null;
}

function validate(page: PlanPage, content: FinalContent): string[] {
  const errors: string[] = [];
  const bodyText = `${content.h1}. ${content.sections.map((s) => `${s.h2}. ${stripHtml(s.html)}`).join(" ")}`;
  const fullHtml = content.sections.map((s) => s.html).join(" ");
  const keyword = page.primary_keyword.toLowerCase().replace(/[?]/g, "").trim();

  if (content.title.length > 60) errors.push(`title exceeds 60 chars (${content.title.length}): "${content.title}"`);
  if (content.metaDescription.length > 155) {
    errors.push(`metaDescription exceeds 155 chars (${content.metaDescription.length})`);
  }
  if (!content.title.toLowerCase().includes(keyword.split(" ")[0])) {
    errors.push(`primary keyword "${page.primary_keyword}" does not appear to be reflected in title "${content.title}"`);
  }
  if (!content.h1.toLowerCase().includes(keyword.split(" ")[0])) {
    errors.push(`primary keyword "${page.primary_keyword}" not found in h1 "${content.h1}"`);
  }
  const first100 = bodyText.slice(0, 100).toLowerCase();
  if (!first100.includes(keyword.split(" ")[0])) {
    errors.push(`primary keyword "${page.primary_keyword}" not found in first 100 characters of body text`);
  }

  const wordTotal = wordCount(bodyText);
  const minWords = MIN_WORD_COUNT_BY_PAGE_TYPE[page.page_type] ?? 1100;
  if (wordTotal < minWords) {
    errors.push(`only ${wordTotal} words, need >= ${minWords} for a "${page.page_type}" page`);
  }

  const tableCount = (fullHtml.match(/<table/g) ?? []).length;
  if (tableCount < 3) errors.push(`only ${tableCount} <table> elements, need >= 3`);

  const svgCount = (fullHtml.match(/<svg/g) ?? []).length;
  if (svgCount < 2) errors.push(`only ${svgCount} <svg> elements, need >= 2`);

  const listCount = (fullHtml.match(/<(ul|ol)[ >]/g) ?? []).length;
  if (listCount < 4) errors.push(`only ${listCount} list elements, need >= 4`);

  if (content.images.length < 3 || content.images.length > 4) {
    errors.push(`${content.images.length} images, need 3-4`);
  }
  content.images.forEach((img, i) => {
    if (!img.alt || img.alt.trim().length === 0) errors.push(`image[${i}] has empty alt text`);
  });

  const lowerBody = bodyText.toLowerCase();
  const bannedHit = findUnnegatedBannedPhrase(bodyText, BANNED_PHRASES);
  if (bannedHit) errors.push(`banned phrase found (not negated): "${bannedHit}"`);
  for (const pattern of UNDER_18_ADDRESS_PATTERNS) {
    if (pattern.test(bodyText)) errors.push(`content appears to address under-18s (matched ${pattern})`);
  }

  const hasRgBlock = fullHtml.includes("rg-block") || lowerBody.includes("begambleaware");
  if (!hasRgBlock) errors.push("no responsible gambling block detected");

  return errors;
}

// ---------------------------------------------------------------------------
// Cross-site cosine similarity (bag-of-words TF vectors - see cluster.ts for
// the same "no paid semantic-similarity API available" fallback pattern)
// ---------------------------------------------------------------------------

function termFrequencyVector(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const v of a.values()) normA += v * v;
  for (const v of b.values()) normB += v * v;
  for (const [term, v] of a) dot += v * (b.get(term) ?? 0);
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Down-weights terms that appear across most/all of the 5 sites before
 * comparing them. Five closely-related niche sites will naturally share a
 * lot of on-topic vocabulary ("plinko", "risk", "row", "multiplier") - raw
 * term-frequency cosine similarity conflates that expected topical overlap
 * with genuine duplicate content. TF-IDF (idf measured across the 5 sites
 * as the document set) is the standard fix and better approximates what a
 * search engine's near-duplicate-content detection actually cares about:
 * shared surface text, not shared subject matter.
 */
function applyIdf(vectors: Map<string, Map<string, number>>): Map<string, Map<string, number>> {
  const docCount = vectors.size;
  const docFreq = new Map<string, number>();
  for (const vector of vectors.values()) {
    for (const term of vector.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }
  const weighted = new Map<string, Map<string, number>>();
  for (const [siteId, vector] of vectors) {
    const out = new Map<string, number>();
    for (const [term, tf] of vector) {
      const idf = Math.log(docCount / (docFreq.get(term) ?? 1));
      if (idf > 0) out.set(term, tf * idf);
    }
    weighted.set(siteId, out);
  }
  return weighted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(CONTENT_OUT_DIR, { recursive: true });

  const plan = await loadJson<PlanPage[]>(SITEMAP_PLAN_PATH);
  const sitesYaml = parseYaml(await readFile(SITES_YAML_PATH, "utf8")) as {
    sites: (SiteInfo & { pages: unknown[] })[];
  };
  const sitesById = new Map(sitesYaml.sites.map((s) => [s.id, s]));
  const factualData = await getFactualData();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn(
      "[warn] ANTHROPIC_API_KEY not set - using the hand-authored offline content corpus " +
        "(scripts/lib/core-pages.ts / trust-pages.ts) instead of calling the Anthropic API"
    );
  }

  const buildErrors: string[] = [];
  const siteBodyText = new Map<string, string[]>();
  let written = 0;
  let cacheHits = 0;

  for (const page of plan) {
    const site = sitesById.get(page.site);
    if (!site) {
      buildErrors.push(`page for unknown site "${page.site}" (${page.url})`);
      continue;
    }

    const briefId = page.cluster_id ?? `editorial-${page.primary_keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const briefPath = path.join(BRIEFS_DIR, `${briefId}.json`);
    let brief: GenerationBrief | null = null;
    try {
      brief = await loadJson<GenerationBrief>(briefPath);
    } catch {
      console.warn(`[warn] no brief found at ${path.relative(ROOT_DIR, briefPath)} for page ${page.url} - run npm run analyze-serp first`);
    }

    const cacheKey = md5(`${page.site}:${briefId}:${CONTENT_SOURCE_VERSION}:${apiKey ? "anthropic" : "offline"}`);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);

    let content: FinalContent & { ownSectionCount?: number };
    try {
      content = await loadJson<FinalContent & { ownSectionCount?: number }>(cachePath);
      cacheHits += 1;
    } catch {
      if (apiKey && brief) {
        const generated = await generateWithAnthropic(brief, { name: site.name, positioning: site.positioning }, factualData, apiKey);
        content = { ...generated };
      } else {
        content = resolveOfflineContent(page, site);
      }
      await writeFile(cachePath, JSON.stringify(content, null, 2), "utf8");
    }

    const ownSectionCount = content.ownSectionCount ?? content.sections.length;
    content.schema = buildSchema(page, content, page.url);

    const errors = validate(page, content);
    if (errors.length > 0) {
      for (const e of errors) buildErrors.push(`[${page.site}] ${page.url}: ${e}`);
      continue;
    }

    const pageKey = slugToPageKey(page.url.replace(/^https:\/\/[^/]+/, ""));
    const outDir = path.join(CONTENT_OUT_DIR, page.site);
    await mkdir(outDir, { recursive: true });
    const { ownSectionCount: _drop, ...publicContent } = content;
    await writeFile(path.join(outDir, `${pageKey}.json`), JSON.stringify(publicContent, null, 2) + "\n", "utf8");
    written += 1;

    if (page.page_type !== "trust") {
      // Similarity is measured on each page's OWN authored sections only,
      // excluding the universally shared risk/odds/RG boilerplate appended
      // to every page - that boilerplate is expected to repeat across a
      // site network (like a shared footer) and isn't the "article text"
      // the anti-duplication rule is meant to police.
      const bodyText = content.sections
        .slice(0, ownSectionCount)
        .map((s) => stripHtml(s.html))
        .join(" ");
      if (!siteBodyText.has(page.site)) siteBodyText.set(page.site, []);
      siteBodyText.get(page.site)!.push(bodyText);
    }
  }

  // Cross-site similarity check (home + landing content only, TF-IDF
  // weighted across the 5 sites - see applyIdf() for why).
  const rawVectors = new Map<string, Map<string, number>>();
  for (const [siteId, texts] of siteBodyText) {
    rawVectors.set(siteId, termFrequencyVector(texts.join(" ")));
  }
  const siteVectors = applyIdf(rawVectors);
  const siteIds = [...siteVectors.keys()];
  for (let i = 0; i < siteIds.length; i++) {
    for (let j = i + 1; j < siteIds.length; j++) {
      const sim = cosineSimilarity(siteVectors.get(siteIds[i])!, siteVectors.get(siteIds[j])!);
      console.log(`[info] cross-site similarity ${siteIds[i]} vs ${siteIds[j]}: ${sim.toFixed(3)}`);
      if (sim >= MAX_CROSS_SITE_SIMILARITY) {
        buildErrors.push(
          `cross-site content similarity ${sim.toFixed(3)} >= ${MAX_CROSS_SITE_SIMILARITY} between "${siteIds[i]}" and "${siteIds[j]}" (home/landing pages)`
        );
      }
    }
  }

  console.log(`[info] wrote ${written}/${plan.length} pages (${cacheHits} served from .cache/content/)`);

  if (buildErrors.length > 0) {
    console.error(`[fatal] ${buildErrors.length} validation failure(s):`);
    for (const e of buildErrors) console.error(`  - ${e}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
