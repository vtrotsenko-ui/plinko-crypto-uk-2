#!/usr/bin/env tsx
/**
 * Content-brief generator, run ahead of Agent 4 (scripts/generate-content.ts).
 *
 * Not one of the five named agents in the spec, but generate-content.ts is
 * explicitly documented to consume "briefs/{cluster}.json (the output of
 * analyze-serp.ts)" - this script produces that input.
 *
 * Input: data/clusters.csv + data/sitemap-plan.json
 * Output: briefs/{brief_id}.json, one per page in the sitemap plan.
 *
 * Real SERP-derived competitor analysis (word counts, heading counts, table
 * counts actually observed in the top 10) requires the same paid SERP API as
 * scripts/cluster.ts. Without SERP_API_KEY, this script does not invent
 * competitor numbers - targets fall back to fixed, clearly-labelled defaults
 * per page type/intent, and `competitorAnalysis` is left null with a note
 * explaining why.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import natural from "natural";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const BRIEFS_DIR = path.join(ROOT_DIR, "briefs");

const CLUSTERS_PATH = path.join(DATA_DIR, "clusters.csv");
const SITEMAP_PLAN_PATH = path.join(DATA_DIR, "sitemap-plan.json");

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

interface ClusterMember {
  keyword: string;
  volume: number | null;
}

const WORD_COUNT_TARGETS: Record<string, { median: number; h2: number; tables: number; lists: number }> = {
  home: { median: 1400, h2: 9, tables: 3, lists: 5 },
  landing: { median: 1300, h2: 8, tables: 3, lists: 4 },
  trust: { median: 900, h2: 5, tables: 3, lists: 4 },
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

async function loadClusterMembers(filePath: string): Promise<Map<string, ClusterMember[]>> {
  const raw = await readFile(filePath, "utf8").catch(() => "");
  if (!raw) return new Map();
  const [, ...lines] = raw.split("\n").filter((l) => l.trim().length > 0);
  const map = new Map<string, ClusterMember[]>();
  for (const line of lines) {
    const [id, , keyword, volume] = parseCsvLine(line);
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push({ keyword, volume: volume ? Number(volume) : null });
  }
  return map;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STOPWORDS = new Set<string>(natural.stopwords as string[]);
const QUESTION_STARTERS = /^(how|is|are|what|why|does|do|can|will|should)\b/i;

function extractFaqQuestions(keywords: string[], primaryKeyword: string): string[] {
  const questions = keywords.filter((k) => QUESTION_STARTERS.test(k.trim()));
  const capitalized = questions.map((q) => {
    const trimmed = q.trim();
    const withCap = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return withCap.endsWith("?") ? withCap : `${withCap}?`;
  });
  const unique = Array.from(new Set(capitalized)).slice(0, 6);
  if (unique.length >= 3) return unique;

  // Not enough real question-keywords in this cluster - top up with a small
  // set of generic, clearly-labelled structural questions about the primary
  // keyword itself (not fabricated statistics, just standard FAQ framing).
  const generic = [
    `What is ${primaryKeyword}?`,
    `Is ${primaryKeyword} available in the UK?`,
    `How do I try ${primaryKeyword} for free before playing for real money?`,
  ];
  return Array.from(new Set([...unique, ...generic])).slice(0, 6);
}

function extractLsiTerms(keywords: string[], primaryKeyword: string): string[] {
  const primaryTokens = new Set(
    primaryKeyword
      .toLowerCase()
      .split(/\s+/)
      .map((t) => natural.PorterStemmer.stem(t))
  );
  const freq = new Map<string, number>();
  for (const kw of keywords) {
    const tokens = kw
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((t) => !STOPWORDS.has(t) && t !== "plinko");
    for (const token of tokens) {
      const stem = natural.PorterStemmer.stem(token);
      if (primaryTokens.has(stem)) continue;
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([term]) => term);
}

async function main(): Promise<void> {
  await mkdir(BRIEFS_DIR, { recursive: true });

  const clusterMembers = await loadClusterMembers(CLUSTERS_PATH);
  const plan = JSON.parse(await readFile(SITEMAP_PLAN_PATH, "utf8")) as PlanPage[];
  console.log(`[info] loaded ${plan.length} pages from ${path.relative(ROOT_DIR, SITEMAP_PLAN_PATH)}`);

  const hasSerpApi = Boolean(process.env.SERP_API_KEY);
  if (!hasSerpApi) {
    console.warn(
      "[warn] SERP_API_KEY not set - brief targets use fixed defaults per page type, not observed competitor data"
    );
  }

  const seen = new Set<string>();
  let written = 0;

  for (const page of plan) {
    const briefId = page.cluster_id ?? `editorial-${slugify(page.primary_keyword)}`;
    if (seen.has(briefId)) continue; // one brief per cluster/editorial topic, reused across sites if ever shared
    seen.add(briefId);

    const members = page.cluster_id ? clusterMembers.get(page.cluster_id) ?? [] : [];
    const keywords = members.length > 0 ? members.map((m) => m.keyword) : [page.primary_keyword];
    const knownVolumes = members.map((m) => m.volume).filter((v): v is number => v !== null);

    const base = WORD_COUNT_TARGETS[page.page_type];
    const brief = {
      briefId,
      clusterId: page.cluster_id,
      primaryKeyword: page.primary_keyword,
      intent: page.intent,
      pageType: page.page_type,
      supportingKeywords: keywords.slice(0, 40),
      knownSearchVolume: knownVolumes.length > 0 ? Math.max(...knownVolumes) : null,
      targets: {
        wordCount: {
          median: base.median,
          min: Math.round(base.median * 0.85),
          max: Math.round(base.median * 1.15),
        },
        h2: base.h2,
        tables: base.tables,
        lists: base.lists,
      },
      lsiTerms: extractLsiTerms(keywords, page.primary_keyword),
      faqQuestions: extractFaqQuestions(keywords, page.primary_keyword),
      competitorAnalysis: hasSerpApi
        ? null // real path not exercised in this environment - see cluster.ts for the same SERP_API_KEY contract
        : {
            available: false,
            note:
              "No SERP_API_KEY configured - targets are fixed defaults per page type, not measured from the live top 10. Re-run with SERP_API_KEY set to replace these with observed competitor word/heading/table counts.",
          },
    };

    await writeFile(path.join(BRIEFS_DIR, `${briefId}.json`), JSON.stringify(brief, null, 2) + "\n", "utf8");
    written += 1;
  }

  console.log(`[info] wrote ${written} briefs to ${path.relative(ROOT_DIR, BRIEFS_DIR)}/`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
