#!/usr/bin/env tsx
/**
 * Cluster-to-site assignment pipeline for the UK Plinko affiliate project
 * (Agent 3).
 *
 * Input:
 *   - data/clusters.csv   (Agent 2 output)
 *   - data/sites.yaml     (5 sites, each with a positioning + a curated page
 *                          list resolved against clusters via cluster_match)
 *
 * Rules enforced:
 *   1. A site's home page ("/") carries its primary cluster.
 *   2. Every other yaml page is a secondary/internal landing page.
 *   3. HARD CONSTRAINT: cluster-set overlap between any two sites must stay
 *      <= 30% (overlap coefficient = |A n B| / min(|A|, |B|)). Violation
 *      fails the build and names the offending pair.
 *   4. One cluster = one landing page within a site (anti-cannibalisation).
 *      Reusing a cluster for two pages on the same site fails the build.
 *      Two *different* clusters on the same site whose keyword sets overlap
 *      more than 6/10 (lexical-Jaccard proxy, see cluster.ts fallback mode)
 *      only produce a merge warning, per spec - not a hard failure.
 *   5. Every site unconditionally gets K7 (legality) and K10 (responsible
 *      gambling) pages, regardless of cluster assignment - the E-E-A-T
 *      minimum - plus the four trust pages the client always requires
 *      (About Us, Privacy & Cookie Policy, Terms of Service are content-only
 *      pages with no target cluster; Responsible Gambling doubles as K10).
 *
 * Output: data/sitemap-plan.json
 *   [{ site, url, cluster_id, primary_keyword, intent, page_type,
 *      internal_links_to[], priority }]
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import natural from "natural";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const CLUSTERS_PATH = path.join(DATA_DIR, "clusters.csv");
const SITES_YAML_PATH = path.join(DATA_DIR, "sites.yaml");
const OUTPUT_PATH = path.join(DATA_DIR, "sitemap-plan.json");

const MAX_CROSS_SITE_CLUSTER_OVERLAP = 0.3;
const MERGE_WARNING_OVERLAP_SCORE = 6; // out of 10, same scale as cluster.ts

type Intent = "informational" | "commercial" | "transactional";
type PageType = "home" | "landing" | "trust";

interface ClusterMember {
  keyword: string;
  volume: number | null;
  kd: number | null;
  intent: string;
}

interface Cluster {
  id: string;
  name: string;
  members: ClusterMember[];
}

interface SitePageDef {
  slug: string;
  page_type: PageType;
  intent: Intent;
  /** Omitted for editorial/supporting pages that deliberately don't target a
   * distinct SERP cluster (e.g. a deep-dive subpage of a pillar page) - kept
   * out of the anti-cannibalisation and cross-site overlap checks. */
  cluster_match?: string;
  primary_keyword: string;
  priority: number;
}

interface SiteDef {
  id: string;
  domain: string;
  name: string;
  positioning: string;
  pages: SitePageDef[];
}

interface PlanPage {
  site: string;
  url: string;
  cluster_id: string | null;
  primary_keyword: string;
  intent: Intent;
  page_type: PageType;
  internal_links_to: string[];
  priority: number;
}

// ---------------------------------------------------------------------------
// CSV / token helpers
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

async function loadClusters(filePath: string): Promise<Map<string, Cluster>> {
  const raw = await readFile(filePath, "utf8");
  const [, ...lines] = raw.split("\n").filter((l) => l.trim().length > 0);
  const clusters = new Map<string, Cluster>();
  for (const line of lines) {
    const [id, name, keyword, volume, kd, intent] = parseCsvLine(line);
    if (!clusters.has(id)) clusters.set(id, { id, name, members: [] });
    clusters.get(id)!.members.push({
      keyword,
      volume: volume ? Number(volume) : null,
      kd: kd ? Number(kd) : null,
      intent,
    });
  }
  return clusters;
}

const STOPWORDS = new Set<string>(natural.stopwords as string[]);

function significantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((t) => !STOPWORDS.has(t))
      .map((t) => natural.PorterStemmer.stem(t))
  );
}

function jaccardOverlapScore(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 10);
}

// ---------------------------------------------------------------------------
// Cluster resolution
// ---------------------------------------------------------------------------

function resolveCluster(pattern: string, clusters: Map<string, Cluster>): Cluster | null {
  const regex = new RegExp(pattern, "i");
  let best: { cluster: Cluster; matchCount: number } | null = null;
  for (const cluster of clusters.values()) {
    const matchCount =
      (regex.test(cluster.name) ? 1 : 0) + cluster.members.filter((m) => regex.test(m.keyword)).length;
    if (matchCount > 0 && (!best || matchCount > best.matchCount)) {
      best = { cluster, matchCount };
    }
  }
  return best?.cluster ?? null;
}

function clusterTokenSet(cluster: Cluster): Set<string> {
  const tokens = new Set<string>();
  for (const m of cluster.members) for (const t of significantTokens(m.keyword)) tokens.add(t);
  return tokens;
}

function dominantIntent(cluster: Cluster, fallback: Intent): Intent {
  const counts = new Map<string, number>();
  for (const m of cluster.members) {
    const base = m.intent.replace(/_heuristic$/, "");
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0];
  return top === "informational" || top === "commercial" || top === "transactional" ? top : fallback;
}

// ---------------------------------------------------------------------------
// Mandatory trust pages (rule 5)
// ---------------------------------------------------------------------------

function mandatoryTrustPages(): { slug: string; primary_keyword: string; k: string }[] {
  return [
    { slug: "/about-us/", primary_keyword: "about us", k: "trust" },
    { slug: "/privacy-cookie-policy/", primary_keyword: "privacy and cookie policy", k: "trust" },
    { slug: "/terms-of-service/", primary_keyword: "terms of service", k: "trust" },
    { slug: "/is-plinko-legal-in-the-uk/", primary_keyword: "is Plinko legal in the UK", k: "K7" },
    { slug: "/responsible-gambling/", primary_keyword: "responsible gambling", k: "K10" },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const clusters = await loadClusters(CLUSTERS_PATH);
  console.log(`[info] loaded ${clusters.size} clusters from ${path.relative(ROOT_DIR, CLUSTERS_PATH)}`);

  const sitesYaml = parseYaml(await readFile(SITES_YAML_PATH, "utf8")) as { sites: SiteDef[] };
  const sites = sitesYaml.sites;
  console.log(`[info] loaded ${sites.length} site definitions from ${path.relative(ROOT_DIR, SITES_YAML_PATH)}`);

  const errors: string[] = [];
  const warnings: string[] = [];

  // Resolve every yaml page to a concrete cluster, tracking per-site usage
  // for the one-cluster-one-page rule and per-site cluster-token sets for
  // the merge-candidate warning.
  const siteClusterIds = new Map<string, Set<string>>();
  const siteAssignedClusters = new Map<string, { clusterId: string; slug: string }[]>();
  const resolvedPages = new Map<string, { def: SitePageDef; cluster: Cluster | null }[]>();

  for (const site of sites) {
    siteClusterIds.set(site.id, new Set());
    siteAssignedClusters.set(site.id, []);
    resolvedPages.set(site.id, []);

    for (const page of site.pages) {
      if (!page.cluster_match) {
        resolvedPages.get(site.id)!.push({ def: page, cluster: null });
        continue;
      }

      const cluster = resolveCluster(page.cluster_match, clusters);
      if (!cluster) {
        errors.push(
          `site "${site.id}" page "${page.slug}": cluster_match /${page.cluster_match}/ matched no cluster in clusters.csv`
        );
        continue;
      }

      const usedIds = siteClusterIds.get(site.id)!;
      if (usedIds.has(cluster.id)) {
        const clash = siteAssignedClusters.get(site.id)!.find((c) => c.clusterId === cluster.id);
        errors.push(
          `site "${site.id}": cluster "${cluster.id}" (${cluster.name}) is already used by page "${clash?.slug}" - ` +
            `page "${page.slug}" would cannibalise it (one cluster = one landing page per site)`
        );
        continue;
      }
      usedIds.add(cluster.id);
      siteAssignedClusters.get(site.id)!.push({ clusterId: cluster.id, slug: page.slug });

      const curatedTokens = significantTokens(page.primary_keyword);
      const clusterTokens = clusterTokenSet(cluster);
      const sharesToken = [...curatedTokens].some((t) => clusterTokens.has(t));
      if (!sharesToken) {
        warnings.push(
          `site "${site.id}" page "${page.slug}": curated primary_keyword "${page.primary_keyword}" shares no ` +
            `token with resolved cluster "${cluster.name}" (cluster_id ${cluster.id}) - double-check the mapping`
        );
      }

      resolvedPages.get(site.id)!.push({ def: page, cluster });
    }
  }

  // Rule 4 (soft part): within a site, warn about near-duplicate clusters.
  for (const site of sites) {
    const assigned = resolvedPages.get(site.id)!.filter(
      (p): p is { def: SitePageDef; cluster: Cluster } => p.cluster !== null
    );
    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const score = jaccardOverlapScore(
          clusterTokenSet(assigned[i].cluster),
          clusterTokenSet(assigned[j].cluster)
        );
        if (score > MERGE_WARNING_OVERLAP_SCORE) {
          warnings.push(
            `site "${site.id}": clusters "${assigned[i].cluster.name}" and "${assigned[j].cluster.name}" ` +
              `overlap ${score}/10 - consider merging pages "${assigned[i].def.slug}" and "${assigned[j].def.slug}"`
          );
        }
      }
    }
  }

  // Rule 3 (hard): cross-site cluster-set overlap <= 30%.
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const a = siteClusterIds.get(sites[i].id)!;
      const b = siteClusterIds.get(sites[j].id)!;
      const shared = [...a].filter((id) => b.has(id)).length;
      const denom = Math.min(a.size, b.size) || 1;
      const overlap = shared / denom;
      if (overlap > MAX_CROSS_SITE_CLUSTER_OVERLAP) {
        errors.push(
          `sites "${sites[i].id}" and "${sites[j].id}" share ${shared}/${denom} clusters ` +
            `(${(overlap * 100).toFixed(0)}% overlap, limit ${MAX_CROSS_SITE_CLUSTER_OVERLAP * 100}%)`
        );
      }
    }
  }

  for (const w of warnings) console.warn(`[warn] ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[error] ${e}`);
    console.error(`[fatal] ${errors.length} hard constraint violation(s) - aborting without writing ${OUTPUT_PATH}`);
    process.exitCode = 1;
    return;
  }

  // Build the final plan.
  const plan: PlanPage[] = [];
  for (const site of sites) {
    const trustSlugs = mandatoryTrustPages().map((t) => t.slug);
    const landingSlugs = site.pages.filter((p) => p.page_type !== "home").map((p) => p.slug);
    const homeSlug = site.pages.find((p) => p.page_type === "home")?.slug ?? "/";

    for (const { def, cluster } of resolvedPages.get(site.id)!) {
      const intent = cluster ? dominantIntent(cluster, def.intent) : def.intent;
      const internalLinks =
        def.page_type === "home"
          ? [...landingSlugs, ...trustSlugs].filter((s) => s !== def.slug)
          : [homeSlug, "/is-plinko-legal-in-the-uk/", "/responsible-gambling/", "/about-us/"].filter(
              (s) => s !== def.slug
            );

      plan.push({
        site: site.id,
        url: `https://${site.domain}${def.slug}`,
        cluster_id: cluster?.id ?? null,
        primary_keyword: def.primary_keyword,
        intent,
        page_type: def.page_type,
        internal_links_to: internalLinks,
        priority: def.priority,
      });
    }

    for (const trust of mandatoryTrustPages()) {
      const isResponsibleGambling = trust.slug === "/responsible-gambling/";
      const isLegality = trust.slug === "/is-plinko-legal-in-the-uk/";
      plan.push({
        site: site.id,
        url: `https://${site.domain}${trust.slug}`,
        cluster_id: null,
        primary_keyword: trust.primary_keyword,
        intent: "informational",
        page_type: "trust",
        internal_links_to: [homeSlug, ...trustSlugs.filter((s) => s !== trust.slug)],
        priority: isResponsibleGambling || isLegality ? 0.4 : 0.2,
      });
    }
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(plan, null, 2) + "\n", "utf8");
  console.log(
    `[info] wrote ${plan.length} pages across ${sites.length} sites to ${path.relative(ROOT_DIR, OUTPUT_PATH)} ` +
      `(${warnings.length} warning(s), 0 hard violations)`
  );
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
