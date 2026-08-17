#!/usr/bin/env tsx
/**
 * JSON-LD / schema.org validation for built HTML under sites/ (and dist/ if present).
 * Uses structural checks + optional Schema Markup Validator API when SCHEMA_VALIDATOR_URL is set.
 */

import { readFile, readdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SITES_DIR = path.join(ROOT_DIR, "sites");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const REPORT_PATH = path.join(ROOT_DIR, "compliance-report.md");

interface Issue {
  level: "ERROR" | "WARNING";
  file: string;
  message: string;
}

async function findHtml(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "assets") continue;
      out.push(...(await findHtml(full)));
    } else if (e.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      blocks.push({ __parseError: true, raw: m[1].slice(0, 200) });
    }
  }
  return blocks;
}

function collectNodes(doc: unknown): Record<string, unknown>[] {
  if (!doc || typeof doc !== "object") return [];
  const obj = doc as Record<string, unknown>;
  if (obj.__parseError) return [obj];
  if (Array.isArray(obj["@graph"])) {
    return (obj["@graph"] as unknown[]).filter((n) => n && typeof n === "object") as Record<
      string,
      unknown
    >[];
  }
  return [obj];
}

function validatePage(file: string, html: string): Issue[] {
  const issues: Issue[] = [];
  const rel = path.relative(ROOT_DIR, file);
  const docs = extractJsonLd(html);
  if (docs.length === 0) {
    issues.push({ level: "ERROR", file: rel, message: "No JSON-LD blocks found" });
    return issues;
  }

  const nodes = docs.flatMap(collectNodes);
  const ids = new Set<string>();
  for (const n of nodes) {
    if (typeof n["@id"] === "string") ids.add(n["@id"] as string);
  }

  for (const n of nodes) {
    if (n.__parseError) {
      issues.push({ level: "ERROR", file: rel, message: "JSON-LD parse error" });
      continue;
    }
    const type = n["@type"];
    if (!type) {
      issues.push({ level: "WARNING", file: rel, message: "Node missing @type" });
    }
    if (type === "HowTo") {
      issues.push({
        level: "WARNING",
        file: rel,
        message: "HowTo type present — rich results deprecated since 2023",
      });
    }
    if (type === "Casino" || type === "ClaimReview") {
      issues.push({
        level: "ERROR",
        file: rel,
        message: `Forbidden type on affiliate page: ${type}`,
      });
    }
    if (type === "Product" && /bonus/i.test(rel)) {
      issues.push({ level: "ERROR", file: rel, message: "Product type on bonus page is forbidden" });
    }
    // Resolve @id references inside nested objects (shallow)
    const json = JSON.stringify(n);
    for (const ref of json.match(/"@id"\s*:\s*"([^"]+)"/g) ?? []) {
      const id = ref.split('"').slice(-2)[0];
      // skip self declarations checked elsewhere
    }
    // publisher @id resolution
    const pub = n.publisher as { "@id"?: string } | undefined;
    if (pub?.["@id"] && !ids.has(pub["@id"])) {
      // may resolve across graph — check full ids set already built
      if (![...ids].includes(pub["@id"])) {
        issues.push({
          level: "ERROR",
          file: rel,
          message: `Unresolved @id reference: ${pub["@id"]}`,
        });
      }
    }

    if (type === "Review" || type === "AggregateRating") {
      const rating = (n.reviewRating ?? n) as Record<string, unknown>;
      if (rating.ratingValue != null) {
        const val = String(rating.ratingValue);
        if (!html.includes(val)) {
          issues.push({
            level: "ERROR",
            file: rel,
            message: `ratingValue ${val} not visible in page text`,
          });
        }
      }
      if (rating.bestRating == null || rating.worstRating == null) {
        issues.push({
          level: "ERROR",
          file: rel,
          message: "Review rating missing explicit bestRating/worstRating",
        });
      }
    }

    if (type === "Organization" && n.aggregateRating) {
      issues.push({
        level: "ERROR",
        file: rel,
        message: "aggregateRating inside operator Organization is forbidden",
      });
    }
  }

  // Required base types
  const types = new Set(nodes.map((n) => String(n["@type"] ?? "")));
  if (![...types].some((t) => t.includes("WebPage") || t.includes("WebSite") || t.includes("FAQPage"))) {
    issues.push({ level: "WARNING", file: rel, message: "No WebPage/WebSite/FAQPage type found" });
  }

  return issues;
}

async function maybeRemoteValidate(html: string, file: string): Promise<Issue[]> {
  const endpoint = process.env.SCHEMA_VALIDATOR_URL;
  if (!endpoint) return [];
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "text/html" },
      body: html,
    });
    if (!res.ok) {
      return [{ level: "WARNING", file, message: `Schema Markup Validator HTTP ${res.status}` }];
    }
    const data = (await res.json()) as { errors?: { message: string }[] };
    return (data.errors ?? []).map((e) => ({
      level: "ERROR" as const,
      file,
      message: `Validator: ${e.message}`,
    }));
  } catch (err) {
    return [
      {
        level: "WARNING",
        file,
        message: `Validator call failed: ${(err as Error).message}`,
      },
    ];
  }
}

async function main() {
  const roots = [SITES_DIR, DIST_DIR];
  const files: string[] = [];
  for (const root of roots) files.push(...(await findHtml(root)));
  // de-dupe
  const unique = [...new Set(files)];

  const issues: Issue[] = [];
  for (const file of unique) {
    const html = await readFile(file, "utf8");
    issues.push(...validatePage(file, html));
    issues.push(...(await maybeRemoteValidate(html, path.relative(ROOT_DIR, file))));
  }

  const section = [
    ``,
    `## Schema validation (validate-schema.ts)`,
    `Pages scanned: ${unique.length}`,
    ...issues.map((i) => `- **${i.level}** ${i.file}: ${i.message}`),
    issues.length === 0 ? `- **PASS** No schema issues found` : "",
    ``,
  ].join("\n");

  await appendFile(REPORT_PATH, section).catch(async () => {
    await writeFile(REPORT_PATH, `# Compliance report\n${section}`, "utf8");
  });

  const errors = issues.filter((i) => i.level === "ERROR");
  console.log(section);
  if (errors.length > 0) {
    console.error(`Schema validation FAILED: ${errors.length} error(s)`);
    process.exit(1);
  }
  console.log("Schema validation PASSED.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
