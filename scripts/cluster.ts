#!/usr/bin/env tsx
/**
 * Clustering pipeline for the Argentina 1win affiliate project (Agent 2).
 *
 * Pipeline:
 *   1. Read data/keywords-raw.csv (Agent 1 output).
 *   2. For every keyword eligible for clustering, fetch/derive a top-10 SERP
 *      signature for google.com.ar (gl=ar, hl=en), cached at
 *      .cache/serp/{md5(keyword)}.json.
 *   3. Build a keyword-to-keyword overlap score against cluster "cores" only
 *      (strong-link clustering: a keyword joins a cluster only if it
 *      overlaps the cluster's core keyword, never a random member).
 *   4. Name each cluster after its highest-volume member.
 *   5. Infer an intent label per cluster from SERP signals.
 *   6. Write data/clusters.csv and data/orphans.csv (singletons that never
 *      matched any core - never silently dropped).
 *
 * SERP data source:
 *   - If SERP_API_KEY is set, results come from a real SERP API
 *     (SerpApi-compatible `GET https://serpapi.com/search.json`,
 *     engine=google, google_domain=google.com.ar, gl=ar, hl=en, num=10).
 *   - If SERP_API_KEY is NOT set, the script does not fabricate a SERP.
 *     Instead it falls back to a clearly-labelled lexical-overlap proxy
 *     (Jaccard similarity of meaningful tokens) so the rest of the pipeline
 *     stays runnable without paid API access. Every cache file and every
 *     output row records which mode produced it (`source` column /
 *     `"fallback": true` cache flag) - nothing pretends to be real SERP data.
 *
 * Usage:
 *   SERP_API_KEY=xxx tsx scripts/cluster.ts
 *   tsx scripts/cluster.ts   # runs in lexical-fallback mode, logs a warning
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import natural from "natural";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CACHE_DIR = path.join(ROOT_DIR, ".cache", "serp");

const INPUT_PATH = path.join(DATA_DIR, "keywords-raw.csv");
const CLUSTERS_OUTPUT_PATH = path.join(DATA_DIR, "clusters.csv");
const ORPHANS_OUTPUT_PATH = path.join(DATA_DIR, "orphans.csv");

const MIN_VOLUME = 20;
const REAL_SERP_OVERLAP_THRESHOLD = 4; // shared URLs out of top 10
const FALLBACK_JACCARD_THRESHOLD = 0.34; // calibrated to behave like ~4/10 shared URLs
const SERP_API_URL = "https://serpapi.com/search.json";
const SERP_CONCURRENCY = 3;
const SERP_DELAY_MS = 250;

type Intent = "informational" | "commercial" | "transactional";

interface KeywordRow {
  keyword: string;
  volume: number | null;
  kd: number | null;
  cpc: number | null;
}

interface SerpSignature {
  fallback: boolean;
  urls: string[];
  titles: string[];
  hasShoppingOrAds: boolean;
}

interface ClusterCore {
  id: number;
  coreKeyword: string;
  signature: SerpSignature;
  members: KeywordRow[];
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

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

async function readKeywordsCsv(filePath: string): Promise<KeywordRow[]> {
  const raw = await readFile(filePath, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const [header, ...rows] = lines;
  const cols = header.split(",");
  const idx = (name: string) => cols.indexOf(name);
  const kwIdx = idx("keyword");
  const volIdx = idx("volume");
  const kdIdx = idx("kd");
  const cpcIdx = idx("cpc");

  return rows.map((line) => {
    const cells = parseCsvLine(line);
    const num = (s: string | undefined) => (s && s.length > 0 ? Number(s) : null);
    return {
      keyword: cells[kwIdx] ?? "",
      volume: num(cells[volIdx]),
      kd: num(cells[kdIdx]),
      cpc: num(cells[cpcIdx]),
    };
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// ---------------------------------------------------------------------------
// SERP signature: real API or lexical fallback
// ---------------------------------------------------------------------------

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

const STOPWORDS = new Set<string>(natural.stopwords as string[]);

/** Terms that appear in more than this share of the corpus (e.g. the seed
 * brand word "plinko" itself, present in almost every keyword) carry no
 * discriminating signal for topical clustering and are excluded from the
 * fallback Jaccard comparison - otherwise nearly everything looks similar. */
const COMMON_TOKEN_DOC_FREQ_THRESHOLD = 0.4;

function rawTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => natural.PorterStemmer.stem(t));
}

function computeCommonTokens(keywords: string[]): Set<string> {
  const docFreq = new Map<string, number>();
  for (const kw of keywords) {
    for (const token of new Set(rawTokens(kw))) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }
  const threshold = keywords.length * COMMON_TOKEN_DOC_FREQ_THRESHOLD;
  const common = new Set<string>();
  for (const [token, count] of docFreq) {
    if (count >= threshold) common.add(token);
  }
  return common;
}

let commonTokens = new Set<string>();

function significantTokens(keyword: string): Set<string> {
  return new Set(rawTokens(keyword).filter((t) => !commonTokens.has(t)));
}

async function fetchRealSerp(keyword: string, apiKey: string): Promise<SerpSignature> {
  const url = new URL(SERP_API_URL);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", keyword);
  url.searchParams.set("google_domain", "google.com.ar");
  url.searchParams.set("gl", "gb");
  url.searchParams.set("hl", "en");
  url.searchParams.set("num", "10");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`SERP API returned HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    organic_results?: { link?: string; title?: string }[];
    shopping_results?: unknown[];
    ads?: unknown[];
  };

  const organic = body.organic_results ?? [];
  return {
    fallback: false,
    urls: organic.map((r) => r.link ?? "").filter(Boolean).slice(0, 10),
    titles: organic.map((r) => r.title ?? "").filter(Boolean).slice(0, 10),
    hasShoppingOrAds: (body.shopping_results?.length ?? 0) > 0 || (body.ads?.length ?? 0) > 0,
  };
}

function fallbackSignature(keyword: string): SerpSignature {
  // No paid SERP access: derive a deterministic "signature" from the
  // keyword's own tokens so overlap scoring still works, but flagged as
  // fallback everywhere it's used/persisted. This is NOT a real SERP.
  return {
    fallback: true,
    urls: [],
    titles: [keyword],
    hasShoppingOrAds: false,
  };
}

async function loadOrFetchSignature(
  keyword: string,
  apiKey: string | undefined
): Promise<SerpSignature> {
  const cachePath = path.join(CACHE_DIR, `${md5(keyword)}.json`);
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8")) as SerpSignature;
    return cached;
  } catch {
    // no cache yet
  }

  const signature = apiKey ? await fetchRealSerp(keyword, apiKey) : fallbackSignature(keyword);
  await writeFile(cachePath, JSON.stringify(signature, null, 2), "utf8");
  return signature;
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
      if (index > 0) await sleep(SERP_DELAY_MS);
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

// ---------------------------------------------------------------------------
// Overlap scoring
// ---------------------------------------------------------------------------

/** Returns an overlap score on a 0-10 scale, comparable whether it came from
 * real shared URLs or the lexical fallback proxy. */
function overlapScore(a: SerpSignature, b: SerpSignature, keywordA: string, keywordB: string): number {
  if (!a.fallback && !b.fallback) {
    const setB = new Set(b.urls);
    const shared = a.urls.filter((u) => setB.has(u)).length;
    return shared;
  }
  const tokensA = significantTokens(keywordA);
  const tokensB = significantTokens(keywordB);
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  return Math.round(jaccard * 10);
}

function passesThreshold(score: number, usedFallback: boolean): boolean {
  return usedFallback ? score >= Math.round(FALLBACK_JACCARD_THRESHOLD * 10) : score >= REAL_SERP_OVERLAP_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

function classifyIntentFromSerp(signature: SerpSignature): Intent | null {
  if (signature.fallback) return null;
  if (signature.hasShoppingOrAds) return "transactional";
  const reviewGuideHits = signature.urls.filter((u) => /\/(review|guide)s?\//i.test(u)).length;
  const listingHits = signature.titles.filter((t) => /\b(best|top)\b/i.test(t)).length;
  if (listingHits >= reviewGuideHits && listingHits > 0) return "commercial";
  if (reviewGuideHits > 0) return "informational";
  return null;
}

function classifyIntentFromText(keyword: string): Intent {
  const k = keyword.toLowerCase();
  if (/\b(best|top|site|sites|casino|casinos)\b/.test(k)) return "commercial";
  if (/\b(review|reviews|how to|what is|is |guide|legit|safe|rigged|odds|strategy)\b/.test(k)) {
    return "informational";
  }
  if (/\b(app|download|real money|no deposit|bonus|play|demo)\b/.test(k)) return "transactional";
  return "informational";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.warn(
      "[warn] SERP_API_KEY not set - falling back to lexical-overlap clustering (NOT real SERP data). " +
        "Cluster intent will be derived heuristically from keyword text and flagged as such."
    );
  }

  const rows = await readKeywordsCsv(INPUT_PATH);
  console.log(`[info] loaded ${rows.length} keywords from ${path.relative(ROOT_DIR, INPUT_PATH)}`);

  commonTokens = computeCommonTokens(rows.map((r) => r.keyword));
  if (commonTokens.size > 0) {
    console.log(
      `[info] excluding ${commonTokens.size} near-universal token(s) from fallback overlap scoring: ${[...commonTokens].join(", ")}`
    );
  }

  // The volume >= MIN_VOLUME gate can only be enforced against keywords with
  // a KNOWN volume (from the semantic-core sheet or Ahrefs). Keywords whose
  // volume is unknown (Ahrefs stage skipped upstream) are kept - dropping
  // them would silently discard the entire Autocomplete-only pool instead of
  // applying the documented rule, which only targets *confirmed* low volume.
  const knownLowVolume = rows.filter((r) => r.volume !== null && r.volume < MIN_VOLUME);
  const unknownVolume = rows.filter((r) => r.volume === null);
  const eligible = rows.filter((r) => r.volume === null || r.volume >= MIN_VOLUME);
  console.log(
    `[info] volume gate: ${knownLowVolume.length} dropped (confirmed volume < ${MIN_VOLUME}), ` +
      `${unknownVolume.length} volume-unknown (kept), ${eligible.length}/${rows.length} eligible for clustering`
  );
  if (rows.every((r) => r.volume === null)) {
    console.warn("[warn] no keyword has a known volume at all - clustering runs on unranked keywords only");
  }

  // Sort by volume desc (nulls last), then alpha, so the highest-volume
  // keyword in any topical group is the one most likely to become a core.
  eligible.sort((a, b) => {
    if (a.volume !== b.volume) return (b.volume ?? -1) - (a.volume ?? -1);
    return a.keyword.localeCompare(b.keyword);
  });

  console.log(
    `[info] fetching/deriving SERP signatures for ${eligible.length} keywords (concurrency=${SERP_CONCURRENCY}, cached in .cache/serp/)`
  );
  const signatures = await runWithConcurrency(eligible, SERP_CONCURRENCY, async (row) => {
    try {
      return await loadOrFetchSignature(row.keyword, apiKey);
    } catch (err) {
      console.error(`[error] SERP fetch failed for "${row.keyword}": ${(err as Error).message}`);
      return fallbackSignature(row.keyword);
    }
  });

  // Strong-link clustering: a candidate joins a cluster only if it overlaps
  // the cluster's CORE, never merely another member.
  const clusters: ClusterCore[] = [];
  const orphans: KeywordRow[] = [];

  for (let i = 0; i < eligible.length; i++) {
    const row = eligible[i];
    const sig = signatures[i];

    let bestCluster: ClusterCore | null = null;
    let bestScore = -1;
    for (const cluster of clusters) {
      const score = overlapScore(sig, cluster.signature, row.keyword, cluster.coreKeyword);
      if (passesThreshold(score, sig.fallback || cluster.signature.fallback) && score > bestScore) {
        bestCluster = cluster;
        bestScore = score;
      }
    }

    if (bestCluster) {
      bestCluster.members.push(row);
    } else {
      clusters.push({
        id: clusters.length + 1,
        coreKeyword: row.keyword,
        signature: sig,
        members: [row],
      });
    }
  }

  // Singleton clusters (nothing else ever matched the core) become orphans.
  let realClusters = clusters.filter((c) => c.members.length > 1);
  for (const c of clusters) {
    if (c.members.length === 1) orphans.push(c.members[0]);
  }

  // Promote the highest-volume orphan (usually the bare brand term) into its
  // own cluster so the homepage can target it. Brand tokens are often
  // excluded from fallback overlap scoring and would otherwise stay orphaned.
  orphans.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  if (orphans.length > 0 && (orphans[0].volume ?? 0) >= 1000) {
    const brand = orphans.shift()!;
    realClusters = [
      {
        id: 1,
        coreKeyword: brand.keyword,
        signature: { fallback: true, urls: [], titles: [], hasShoppingOrAds: false },
        members: [brand],
      },
      ...realClusters,
    ];
    console.log(`[info] promoted brand orphan "${brand.keyword}" into its own cluster`);
  }

  console.log(
    `[info] formed ${realClusters.length} clusters (incl. brand), ${orphans.length} orphan keywords`
  );

  const clusterRows: string[] = ["cluster_id,cluster_name,keyword,volume,kd,intent,serp_overlap_score"];
  for (const cluster of realClusters) {
    const named = [...cluster.members].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1))[0];
    const clusterName = named.keyword;
    const serpIntent = classifyIntentFromSerp(cluster.signature);
    const usedFallback = cluster.signature.fallback;

    for (const member of cluster.members) {
      const memberSig = signatures[eligible.indexOf(member)];
      const intent = serpIntent ?? classifyIntentFromText(member.keyword);
      const score = overlapScore(memberSig, cluster.signature, member.keyword, cluster.coreKeyword);
      clusterRows.push(
        [
          `c${cluster.id}`,
          csvEscape(clusterName),
          csvEscape(member.keyword),
          member.volume ?? "",
          member.kd ?? "",
          usedFallback ? `${intent}_heuristic` : intent,
          String(score),
        ].join(",")
      );
    }
  }
  await writeFile(CLUSTERS_OUTPUT_PATH, clusterRows.join("\n") + "\n", "utf8");
  console.log(`[info] wrote ${realClusters.length} clusters (${clusterRows.length - 1} rows) to ${path.relative(ROOT_DIR, CLUSTERS_OUTPUT_PATH)}`);

  const orphanRows: string[] = ["keyword,volume,kd,reason"];
  for (const o of orphans) {
    orphanRows.push(
      [csvEscape(o.keyword), o.volume ?? "", o.kd ?? "", "no_serp_overlap_with_any_cluster_core"].join(",")
    );
  }
  await writeFile(ORPHANS_OUTPUT_PATH, orphanRows.join("\n") + "\n", "utf8");
  console.log(`[info] wrote ${orphans.length} orphan keywords to ${path.relative(ROOT_DIR, ORPHANS_OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
