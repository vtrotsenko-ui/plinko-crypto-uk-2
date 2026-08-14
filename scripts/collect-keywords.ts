#!/usr/bin/env tsx
/**
 * Keyword collection pipeline for the UK Plinko casino affiliate project.
 *
 * Pipeline:
 *   1. Read seed keywords from data/seeds.txt.
 *   2. Expand seeds via the Ahrefs API v3 (keywords-explorer/related-terms +
 *      keywords-explorer/overview), scoped to country=gb.
 *   3. Expand seeds via Google Autocomplete (suggestqueries), combined with
 *      prefixes/modifiers from data/prefixes.txt, hl=en&gl=uk.
 *   4. Deduplicate by a normalized form (lowercase -> strip punctuation ->
 *      drop stopwords -> Porter-stem remaining tokens).
 *   5. Drop blacklisted keywords (data/blacklist.txt): unlicensed operator
 *      brands and irrelevant intents (toy/DIY, probability lessons, TV show).
 *   6. Write data/keywords-raw.csv.
 *
 * Metrics (volume/kd/cpc/parent_topic) are only ever populated with values
 * actually returned by the Ahrefs API. Keywords with no Ahrefs match are
 * written with empty (null) metric cells - never an estimate or guess.
 *
 * Usage:
 *   AHREFS_API_KEY=xxx tsx scripts/collect-keywords.ts
 *
 * If AHREFS_API_KEY is not set, the Ahrefs stage is skipped (logged as a
 * warning) and the pipeline continues with Google Autocomplete only, so the
 * script remains runnable without credentials.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import natural from "natural";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const SEEDS_PATH = path.join(DATA_DIR, "seeds.txt");
const PREFIXES_PATH = path.join(DATA_DIR, "prefixes.txt");
const BLACKLIST_PATH = path.join(DATA_DIR, "blacklist.txt");
const OUTPUT_PATH = path.join(DATA_DIR, "keywords-raw.csv");

const COUNTRY = "gb";
const AHREFS_BASE_URL = "https://api.ahrefs.com/v3";
const AHREFS_SELECT = "keyword,volume,difficulty,cpc,parent_topic,serp_features";
const AHREFS_RELATED_TERMS_LIMIT = 200;
const AHREFS_OVERVIEW_CHUNK_SIZE = 100;

const GOOGLE_AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search";
const AUTOCOMPLETE_CONCURRENCY = 5;
const AUTOCOMPLETE_DELAY_MS = 120;

type Source = "ahrefs_related" | "ahrefs_overview" | "google_autocomplete";

interface KeywordRecord {
  keyword: string;
  volume: number | null;
  kd: number | null;
  cpc: number | null;
  parentTopic: string | null;
  serpFeatures: string[];
  sources: Set<Source>;
}

interface DropLogEntry {
  rule: string;
  category: string;
  example: string;
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

async function readLines(filePath: string): Promise<string[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    console.warn(`[warn] could not read ${filePath}: ${(err as Error).message}`);
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

// ---------------------------------------------------------------------------
// Normalization / dedup
// ---------------------------------------------------------------------------

const STOPWORDS = new Set<string>(natural.stopwords as string[]);

function normalizeForDedup(keyword: string): string {
  const tokens = keyword
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token))
    .map((token) => natural.PorterStemmer.stem(token));
  return tokens.join(" ");
}

// ---------------------------------------------------------------------------
// Blacklist
// ---------------------------------------------------------------------------

interface BlacklistRule {
  term: string;
  category: string;
  regex: RegExp;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadBlacklist(filePath: string): Promise<BlacklistRule[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    console.warn(`[warn] could not read ${filePath}: ${(err as Error).message}`);
    return [];
  }

  const rules: BlacklistRule[] = [];
  let currentCategory = "uncategorized";
  const categoryPattern = /^#\s*category:\s*(.+)$/i;

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) {
      const match = line.match(categoryPattern);
      if (match) currentCategory = match[1].trim();
      continue;
    }
    rules.push({
      term: line,
      category: currentCategory,
      regex: new RegExp(`\\b${escapeRegex(line.toLowerCase())}\\b`, "i"),
    });
  }
  return rules;
}

function matchBlacklist(keyword: string, rules: BlacklistRule[]): BlacklistRule | null {
  const lower = keyword.toLowerCase();
  for (const rule of rules) {
    if (rule.regex.test(lower)) return rule;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Keyword map helpers
// ---------------------------------------------------------------------------

function upsertKeyword(
  map: Map<string, KeywordRecord>,
  keyword: string,
  source: Source,
  metrics: Partial<Pick<KeywordRecord, "volume" | "kd" | "cpc" | "parentTopic" | "serpFeatures">> = {}
): void {
  const trimmed = keyword.trim();
  if (trimmed.length === 0) return;
  const key = normalizeForDedup(trimmed);
  if (key.length === 0) return;

  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      keyword: trimmed,
      volume: metrics.volume ?? null,
      kd: metrics.kd ?? null,
      cpc: metrics.cpc ?? null,
      parentTopic: metrics.parentTopic ?? null,
      serpFeatures: metrics.serpFeatures ?? [],
      sources: new Set([source]),
    });
    return;
  }

  existing.sources.add(source);
  if (existing.volume === null && metrics.volume !== undefined) existing.volume = metrics.volume;
  if (existing.kd === null && metrics.kd !== undefined) existing.kd = metrics.kd;
  if (existing.cpc === null && metrics.cpc !== undefined) existing.cpc = metrics.cpc;
  if (existing.parentTopic === null && metrics.parentTopic !== undefined) {
    existing.parentTopic = metrics.parentTopic;
  }
  if (existing.serpFeatures.length === 0 && metrics.serpFeatures?.length) {
    existing.serpFeatures = metrics.serpFeatures;
  }
}

// ---------------------------------------------------------------------------
// Ahrefs API v3
// ---------------------------------------------------------------------------

interface AhrefsKeywordRow {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  parent_topic: string | null;
  serp_features: string[] | null;
}

async function ahrefsRequest(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string
): Promise<AhrefsKeywordRow[]> {
  const url = new URL(`${AHREFS_BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Ahrefs ${endpoint} returned HTTP ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as { keywords?: AhrefsKeywordRow[] };
  return body.keywords ?? [];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function collectFromAhrefs(
  seeds: string[],
  apiKey: string,
  map: Map<string, KeywordRecord>
): Promise<{ relatedCount: number; overviewCount: number; errors: number }> {
  let relatedCount = 0;
  let overviewCount = 0;
  let errors = 0;

  // 1. Overview: authoritative metrics for the seed keywords themselves.
  for (const batch of chunk(seeds, AHREFS_OVERVIEW_CHUNK_SIZE)) {
    try {
      const rows = await ahrefsRequest(
        "/keywords-explorer/overview",
        { select: AHREFS_SELECT, country: COUNTRY, keywords: batch.join(",") },
        apiKey
      );
      for (const row of rows) {
        upsertKeyword(map, row.keyword, "ahrefs_overview", {
          volume: row.volume ?? null,
          kd: row.difficulty ?? null,
          cpc: row.cpc ?? null,
          parentTopic: row.parent_topic ?? null,
          serpFeatures: row.serp_features ?? [],
        });
        overviewCount += 1;
      }
    } catch (err) {
      console.error(`[error] ahrefs overview batch failed: ${(err as Error).message}`);
      errors += 1;
    }
  }

  // 2. Related terms: discover new keywords per seed.
  for (const seed of seeds) {
    try {
      const rows = await ahrefsRequest(
        "/keywords-explorer/related-terms",
        {
          select: AHREFS_SELECT,
          country: COUNTRY,
          keywords: seed,
          terms: "all",
          limit: String(AHREFS_RELATED_TERMS_LIMIT),
        },
        apiKey
      );
      for (const row of rows) {
        upsertKeyword(map, row.keyword, "ahrefs_related", {
          volume: row.volume ?? null,
          kd: row.difficulty ?? null,
          cpc: row.cpc ?? null,
          parentTopic: row.parent_topic ?? null,
          serpFeatures: row.serp_features ?? [],
        });
        relatedCount += 1;
      }
    } catch (err) {
      console.error(`[error] ahrefs related-terms failed for "${seed}": ${(err as Error).message}`);
      errors += 1;
    }
  }

  return { relatedCount, overviewCount, errors };
}

// ---------------------------------------------------------------------------
// Google Autocomplete
// ---------------------------------------------------------------------------

async function fetchAutocomplete(query: string): Promise<string[]> {
  const url = new URL(GOOGLE_AUTOCOMPLETE_URL);
  url.searchParams.set("client", "firefox");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "uk");
  url.searchParams.set("q", query);

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KeywordCollector/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Google Autocomplete returned HTTP ${res.status}`);
  }
  const body = (await res.json()) as [string, string[]];
  return Array.isArray(body?.[1]) ? body[1] : [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await sleep(AUTOCOMPLETE_DELAY_MS);
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

function buildAutocompleteQueries(seeds: string[], prefixes: string[]): string[] {
  const queries = new Set<string>();
  for (const seed of seeds) {
    queries.add(seed);
    for (const prefix of prefixes) {
      queries.add(`${prefix} ${seed}`);
      queries.add(`${seed} ${prefix}`);
    }
  }
  return Array.from(queries);
}

async function collectFromAutocomplete(
  seeds: string[],
  prefixes: string[],
  map: Map<string, KeywordRecord>
): Promise<{ suggestionCount: number; errors: number }> {
  const queries = buildAutocompleteQueries(seeds, prefixes);
  let suggestionCount = 0;
  let errors = 0;

  const resultsPerQuery = await runWithConcurrency(queries, AUTOCOMPLETE_CONCURRENCY, async (query) => {
    try {
      return await fetchAutocomplete(query);
    } catch (err) {
      console.error(`[error] autocomplete failed for "${query}": ${(err as Error).message}`);
      errors += 1;
      return [] as string[];
    }
  });

  for (const suggestions of resultsPerQuery) {
    for (const suggestion of suggestions) {
      upsertKeyword(map, suggestion, "google_autocomplete");
      suggestionCount += 1;
    }
  }

  return { suggestionCount, errors };
}

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatNumberCell(value: number | null): string {
  return value === null ? "" : String(value);
}

function toCsv(records: KeywordRecord[]): string {
  const header = "keyword,volume,kd,cpc,parent_topic,serp_features,source";
  const rows = records.map((r) =>
    [
      csvEscape(r.keyword),
      formatNumberCell(r.volume),
      formatNumberCell(r.kd),
      formatNumberCell(r.cpc),
      csvEscape(r.parentTopic ?? ""),
      csvEscape(r.serpFeatures.join(";")),
      csvEscape(Array.from(r.sources).sort().join(";")),
    ].join(",")
  );
  return [header, ...rows].join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const seeds = await readLines(SEEDS_PATH);
  const prefixes = await readLines(PREFIXES_PATH);
  const blacklistRules = await loadBlacklist(BLACKLIST_PATH);

  console.log(`[info] loaded ${seeds.length} seeds, ${prefixes.length} prefixes, ${blacklistRules.length} blacklist rules`);

  if (seeds.length === 0) {
    console.error(`[error] no seed keywords found in ${SEEDS_PATH}; aborting`);
    process.exitCode = 1;
    return;
  }

  const map = new Map<string, KeywordRecord>();

  const apiKey = process.env.AHREFS_API_KEY;
  let ahrefsStats = { relatedCount: 0, overviewCount: 0, errors: 0 };
  if (apiKey) {
    ahrefsStats = await collectFromAhrefs(seeds, apiKey, map);
    console.log(
      `[info] Ahrefs: ${ahrefsStats.overviewCount} overview rows, ${ahrefsStats.relatedCount} related-term rows, ${ahrefsStats.errors} request errors`
    );
  } else {
    console.warn("[warn] AHREFS_API_KEY not set - skipping Ahrefs stage, metrics will be null for all keywords");
  }

  const autocompleteStats = await collectFromAutocomplete(seeds, prefixes, map);
  console.log(
    `[info] Google Autocomplete: ${autocompleteStats.suggestionCount} raw suggestions, ${autocompleteStats.errors} request errors`
  );

  const rawCandidateCount = map.size;
  console.log(`[info] ${rawCandidateCount} unique keywords after dedup (normalized: lowercase + stopword removal + Porter stemming)`);

  const survivors: KeywordRecord[] = [];
  const dropLog: DropLogEntry[] = [];
  const dropCountByRule = new Map<string, number>();

  for (const record of map.values()) {
    const hit = matchBlacklist(record.keyword, blacklistRules);
    if (hit) {
      const ruleKey = `${hit.category} :: "${hit.term}"`;
      dropCountByRule.set(ruleKey, (dropCountByRule.get(ruleKey) ?? 0) + 1);
      if (!dropLog.some((entry) => entry.rule === ruleKey)) {
        dropLog.push({ rule: ruleKey, category: hit.category, example: record.keyword });
      }
      continue;
    }
    survivors.push(record);
  }

  const totalDropped = rawCandidateCount - survivors.length;
  console.log(`[info] blacklist filtering dropped ${totalDropped} of ${rawCandidateCount} keywords`);
  for (const [ruleKey, count] of Array.from(dropCountByRule.entries()).sort((a, b) => b[1] - a[1])) {
    const example = dropLog.find((entry) => entry.rule === ruleKey)?.example ?? "";
    console.log(`[info]   - ${ruleKey}: ${count} dropped (e.g. "${example}")`);
  }

  survivors.sort((a, b) => a.keyword.localeCompare(b.keyword));

  const nullVolumeCount = survivors.filter((r) => r.volume === null).length;
  console.log(`[info] ${survivors.length} keywords in final output, ${nullVolumeCount} with no Ahrefs volume (null, not estimated)`);

  await writeFile(OUTPUT_PATH, toCsv(survivors), "utf8");
  console.log(`[info] wrote ${survivors.length} rows to ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
