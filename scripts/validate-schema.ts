#!/usr/bin/env tsx
/**
 * JSON-LD schema validation for built HTML pages in dist/ (and sites/).
 *
 * Checks:
 *  - Every JSON-LD block parses
 *  - @id references inside @graph resolve when present
 *  - Review nodes expose ratingValue/bestRating/worstRating and author Person
 *  - ratingValue appears in visible text; affiliate disclosure near review
 *  - Banned types on bonus pages: Casino, ClaimReview, Product
 *  - No aggregateRating inside Organization
 *  - HowTo emits a warning (rich results deprecated)
 *
 * Writes findings into compliance-report.md (appended) and fails on ERROR.
 */

import { readFile, readdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const SITES_DIR = path.join(ROOT_DIR, "sites");
const REPORT_PATH = path.join(ROOT_DIR, "compliance-report.md");

interface Issue {
  level: "ERROR" | "WARN";
  file: string;
  detail: string;
}

async function findHtmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findHtmlFiles(full)));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    blocks.push(JSON.parse(match[1]));
  }
  return blocks;
}

function collectGraph(nodes: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      for (const child of obj["@graph"]) {
        if (child && typeof child === "object") out.push(child as Record<string, unknown>);
      }
    } else {
      out.push(obj);
    }
  }
  return out;
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function validatePage(file: string, html: string): Issue[] {
  const issues: Issue[] = [];
  let blocks: unknown[] = [];
  try {
    blocks = extractJsonLd(html);
  } catch (err) {
    issues.push({ level: "ERROR", file, detail: `JSON-LD parse failure: ${(err as Error).message}` });
    return issues;
  }
  if (blocks.length === 0) {
    issues.push({ level: "ERROR", file, detail: "No JSON-LD blocks found" });
    return issues;
  }

  const graph = collectGraph(blocks);
  const ids = new Set(
    graph
      .map((n) => (typeof n["@id"] === "string" ? (n["@id"] as string) : null))
      .filter((x): x is string => Boolean(x))
  );

  const visible = stripTags(html);
  const isBonusPage = /bonus/i.test(file);

  for (const node of graph) {
    const type = node["@type"];
    const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];

    // Resolve @id references in nested objects one level deep
    for (const [key, value] of Object.entries(node)) {
      if (key === "@id") continue;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const ref = (value as Record<string, unknown>)["@id"];
        if (typeof ref === "string" && ref.startsWith("http") && ids.size > 0 && !ids.has(ref)) {
          // Only fail if the referenced id looks internal to our graph namespace
          if (ref.includes("#")) {
            issues.push({ level: "ERROR", file, detail: `@id reference ${ref} in ${key} does not resolve in @graph` });
          }
        }
      }
    }

    if (types.includes("HowTo")) {
      issues.push({ level: "WARN", file, detail: "HowTo markup present (rich result deprecated since 2023)" });
    }

    if (types.includes("Organization") && node.aggregateRating) {
      issues.push({
        level: "ERROR",
        file,
        detail: "aggregateRating inside Organization is forbidden for operator entities",
      });
    }

    if (isBonusPage && types.some((t) => ["Casino", "ClaimReview", "Product"].includes(t))) {
      issues.push({
        level: "ERROR",
        file,
        detail: `Forbidden type ${types.join(",")} on bonus page`,
      });
    }

    if (types.includes("Review")) {
      const rating = node.reviewRating as Record<string, unknown> | undefined;
      if (!rating || rating.ratingValue == null) {
        issues.push({ level: "ERROR", file, detail: "Review missing reviewRating.ratingValue" });
      } else {
        const ratingValue = String(rating.ratingValue);
        if (!visible.includes(ratingValue)) {
          issues.push({
            level: "ERROR",
            file,
            detail: `ratingValue ${ratingValue} not present in visible text`,
          });
        }
        if (rating.bestRating == null || rating.worstRating == null) {
          issues.push({ level: "ERROR", file, detail: "Review must set bestRating and worstRating explicitly" });
        }
      }

      const author = node.author as Record<string, unknown> | undefined;
      const authorId = author && typeof author["@id"] === "string" ? (author["@id"] as string) : null;
      const authorNode = authorId ? graph.find((n) => n["@id"] === authorId) : author;
      if (!authorNode || authorNode["@type"] !== "Person") {
        issues.push({ level: "ERROR", file, detail: "Review author must resolve to a Person node" });
      } else {
        if (!authorNode.jobTitle || !authorNode.knowsAbout || !authorNode.sameAs) {
          issues.push({
            level: "ERROR",
            file,
            detail: "Person author must include jobTitle, knowsAbout and sameAs",
          });
        }
      }

      if (!/partner|affiliate|sponsored/i.test(visible.slice(0, 2500))) {
        issues.push({
          level: "ERROR",
          file,
          detail: "Visible affiliate/partner disclosure missing near review/rating block",
        });
      }
    }
  }

  return issues;
}

async function main(): Promise<void> {
  const roots = [DIST_DIR, SITES_DIR];
  const files: string[] = [];
  for (const root of roots) {
    files.push(...(await findHtmlFiles(root)));
  }
  // de-dupe by relative path basename chain
  const unique = [...new Set(files)];
  if (unique.length === 0) {
    console.error("[fatal] no HTML pages found in dist/ or sites/");
    process.exitCode = 1;
    return;
  }

  const issues: Issue[] = [];
  for (const file of unique) {
    const html = await readFile(file, "utf8");
    issues.push(...validatePage(path.relative(ROOT_DIR, file), html));
  }

  const errors = issues.filter((i) => i.level === "ERROR");
  const warns = issues.filter((i) => i.level === "WARN");
  const section = [
    "",
    "## Schema validation (validate-schema.ts)",
    "",
    `- Pages scanned: ${unique.length}`,
    `- Errors: ${errors.length}`,
    `- Warnings: ${warns.length}`,
    "",
    ...issues.map((i) => `- **${i.level}** \`${i.file}\`: ${i.detail}`),
    "",
  ].join("\n");

  try {
    await appendFile(REPORT_PATH, section, "utf8");
  } catch {
    await writeFile(REPORT_PATH, `# Compliance report\n${section}`, "utf8");
  }

  if (errors.length) {
    console.error(`[fatal] schema validation failed with ${errors.length} error(s)`);
    for (const e of errors.slice(0, 30)) console.error(`  ERROR ${e.file}: ${e.detail}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[info] schema validation passed (${unique.length} pages, ${warns.length} warnings)`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
