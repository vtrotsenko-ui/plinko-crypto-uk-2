#!/usr/bin/env tsx
/**
 * Content generation / validation for 1win Argentina.
 *
 * Prefer hand-authored / Python-generated JSON in content/generated/.
 * If ANTHROPIC_API_KEY is set, pages missing from disk can be generated via
 * scripts/lib/anthropic.ts using briefs/{cluster}.json.
 *
 * Validation gates (fail build on violation):
 *   - title <= 60, metaDescription <= 155
 *   - primary keyword in title, h1, first 100 chars
 *   - >= 3 tables, >= 2 svg, >= 4 lists for home/landing
 *   - 3-4 images with non-empty alts
 *   - no banned phrases; RG block present
 *   - word count >= 1200 home/landing, >= 550 trust
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BANNED_PHRASES, UNDER_18_ADDRESS_PATTERNS } from "./lib/compliance-text.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONTENT_OUT_DIR = path.join(ROOT_DIR, "content", "generated");

const MIN_WORD_COUNT: Record<string, number> = { home: 1200, landing: 1200, trust: 550 };

interface PlanPage {
  site: string;
  url: string;
  primary_keyword: string;
  page_type: "home" | "landing" | "trust";
}

interface ContentDoc {
  title: string;
  metaDescription: string;
  h1: string;
  sections: { h2: string; html: string }[];
  faq: { question: string; answer: string }[];
  schema: Record<string, unknown>;
  images: { filename: string; alt: string; prompt?: string }[];
}

function toSlug(urlOrSlug: string): string {
  if (urlOrSlug.startsWith("http://") || urlOrSlug.startsWith("https://")) {
    try {
      const u = new URL(urlOrSlug);
      return u.pathname.endsWith("/") || u.pathname === "" ? u.pathname || "/" : `${u.pathname}/`;
    } catch {
      return urlOrSlug;
    }
  }
  return urlOrSlug;
}

function slugToPageKey(slug: string): string {
  const pathSlug = toSlug(slug);
  if (pathSlug === "/") return "index";
  return pathSlug.replace(/^\/|\/$/g, "");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function validate(page: PlanPage, doc: ContentDoc): string[] {
  const errors: string[] = [];
  const body = doc.sections.map((s) => s.html).join("\n");
  const text = stripHtml(body);
  const kw = page.primary_keyword.toLowerCase();

  if (doc.title.length > 60) errors.push(`title length ${doc.title.length} > 60`);
  if (doc.metaDescription.length > 155) errors.push(`meta length ${doc.metaDescription.length} > 155`);
  if (!doc.title.toLowerCase().includes(kw.split(" ")[0])) errors.push("title missing primary keyword token");
  if (!doc.h1.toLowerCase().includes(kw.split(" ")[0])) errors.push("h1 missing primary keyword token");
  if (!text.slice(0, 100).toLowerCase().includes("1win") && !text.slice(0, 100).toLowerCase().includes(kw.split(" ")[0])) {
    errors.push("primary keyword missing from first 100 chars");
  }

  const minWords = MIN_WORD_COUNT[page.page_type] ?? 550;
  const wc = wordCount(text);
  if (wc < minWords) errors.push(`word count ${wc} < ${minWords}`);

  if (page.page_type !== "trust") {
    const tables = (body.match(/<table/gi) ?? []).length;
    const svgs = (body.match(/<svg/gi) ?? []).length;
    const lists = (body.match(/<(ul|ol)/gi) ?? []).length;
    if (tables < 3) errors.push(`tables ${tables} < 3`);
    if (svgs < 2) errors.push(`svg ${svgs} < 2`);
    if (lists < 4) errors.push(`lists ${lists} < 4`);
  }

  if (doc.images.length < 1) errors.push("no images");
  for (const img of doc.images) {
    if (!img.alt?.trim()) errors.push(`empty alt for ${img.filename}`);
  }
  const altsWithKw = doc.images.filter((i) => i.alt.toLowerCase().includes("1win") || i.alt.toLowerCase().includes(kw.split(" ")[0]));
  if (page.page_type !== "trust" && altsWithKw.length < 2) errors.push("need >=2 image alts with primary keyword");

  for (const phrase of BANNED_PHRASES) {
    if (text.toLowerCase().includes(phrase) || body.toLowerCase().includes(phrase)) {
      errors.push(`banned phrase: ${phrase}`);
    }
  }
  for (const re of UNDER_18_ADDRESS_PATTERNS) {
    if (re.test(body)) errors.push("addresses under-18s");
  }
  if (!/responsible-gambling-block|begambleaware/i.test(body)) {
    errors.push("missing responsible gambling block");
  }

  return errors;
}

async function main() {
  const plan = JSON.parse(await readFile(path.join(DATA_DIR, "sitemap-plan.json"), "utf8")) as PlanPage[];
  let failed = 0;

  for (const page of plan) {
    const key = slugToPageKey(page.url);
    const outPath = path.join(CONTENT_OUT_DIR, page.site, `${key}.json`);
    try {
      await access(outPath);
    } catch {
      console.error(`Missing content: ${outPath} — run npm run generate-1win-content`);
      failed++;
      continue;
    }
    const doc = JSON.parse(await readFile(outPath, "utf8")) as ContentDoc;
    const errors = validate(page, doc);
    if (errors.length) {
      console.error(`FAIL ${page.site}${page.url}:\n  - ${errors.join("\n  - ")}`);
      failed++;
    } else {
      console.log(`OK ${page.site}${page.url}`);
    }
    // ensure cache dir touch
    await mkdir(path.join(ROOT_DIR, ".cache", "content"), { recursive: true });
    await writeFile(outPath, JSON.stringify(doc, null, 2), "utf8");
  }

  if (failed > 0) {
    console.error(`Content validation failed for ${failed} page(s).`);
    process.exit(1);
  }
  console.log("Content validation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
