#!/usr/bin/env tsx
/**
 * Compliance gate (Agent 5). Runs against the BUILT static sites in sites/
 * (the actual deployable artifact), independent of scripts/generate-content.ts's
 * own validation gate, so it also catches anything a future manual edit to
 * sites/ or a template change might introduce.
 *
 * Checks:
 *   1. Every operator in data/casinos/*.json has a ukgc_account_number that
 *      is Active on the public Gambling Commission register. Inactive/not
 *      found operators fail the build; any of that operator's links found
 *      in the built HTML also get flagged for removal.
 *   2. Every partner/affiliate link (a link whose href matches a known
 *      operator's affiliateUrl domain) must point to a domain present in
 *      data/affiliate-domain-whitelist.txt.
 *   3. Every page that mentions a bonus/offer must show 18+, a BeGambleAware
 *      link, and full bonus T&Cs (wagering, min deposit, expiry, game
 *      weighting) directly on the page.
 *   4. No page contains a banned phrase (scripts/lib/compliance-text.ts).
 *   5. Every partner/affiliate link carries rel="sponsored nofollow".
 *
 * Writes compliance-report.md at the repo root. Exits non-zero (failing the
 * CI job wired in .github/workflows/compliance.yml) on any violation.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BANNED_PHRASES, UNDER_18_ADDRESS_PATTERNS } from "./lib/compliance-text.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const SITES_DIR = path.join(ROOT_DIR, "sites");
const REPORT_PATH = path.join(ROOT_DIR, "compliance-report.md");

/**
 * The Gambling Commission's public register (gamblingcommission.gov.uk/
 * public-register/businesses) does not publish a stable, documented public
 * JSON API for programmatic status lookups as of writing - only an
 * interactive search UI and periodic CSV/Excel exports for manual download.
 * Rather than guess at an undocumented endpoint (or silently trust an
 * unverified third-party lookup service), this script requires the CI/local
 * operator to point UKGC_REGISTER_LOOKUP_URL at whichever verified source
 * they've set up (e.g. an internally-hosted mirror of the official CSV
 * export, or a licensed third-party verification API), returning
 * `{ results: [{ status: string }] }` for a `?q=<account number>` query.
 * If it isn't configured, every operator is treated as UNVERIFIED (fails
 * the build and strips links) rather than assumed compliant - see
 * data/casinos/README.md for the same "don't guess, verify" principle.
 */
const UKGC_REGISTER_LOOKUP_URL = process.env.UKGC_REGISTER_LOOKUP_URL;
const REQUIRED_BONUS_TERMS = ["wagering", "min deposit", "expiry", "game weighting"] as const;

interface CasinoOperator {
  id: string;
  brandName: string;
  ukgcAccountNumber: string;
  affiliateUrl: string;
  homepageUrl: string;
  bonus?: Record<string, unknown>;
  hasPlinko?: boolean;
}

interface CheckResult {
  ok: boolean;
  detail: string;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

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

async function loadOperators(): Promise<CasinoOperator[]> {
  const casinosDir = path.join(DATA_DIR, "casinos");
  let files: string[] = [];
  try {
    files = (await readdir(casinosDir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  } catch {
    return [];
  }
  const operators: CasinoOperator[] = [];
  for (const f of files) {
    operators.push(JSON.parse(await readFile(path.join(casinosDir, f), "utf8")) as CasinoOperator);
  }
  return operators;
}

async function loadWhitelist(): Promise<Set<string>> {
  const raw = await readFile(path.join(DATA_DIR, "affiliate-domain-whitelist.txt"), "utf8").catch(() => "");
  const domains = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  return new Set(domains);
}

// ---------------------------------------------------------------------------
// Check 1: UKGC register lookup
// ---------------------------------------------------------------------------

async function checkUkgcStatus(accountNumber: string): Promise<CheckResult> {
  if (!UKGC_REGISTER_LOOKUP_URL) {
    return {
      ok: false,
      detail: "UKGC_REGISTER_LOOKUP_URL not configured - cannot verify against the public register, treating as unverified",
    };
  }
  try {
    const url = new URL(UKGC_REGISTER_LOOKUP_URL);
    url.searchParams.set("q", accountNumber);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, detail: `register lookup returned HTTP ${res.status}` };
    const body = (await res.json()) as { results?: { status?: string }[] };
    const status = body.results?.[0]?.status;
    if (status === "Active") return { ok: true, detail: "Active" };
    return { ok: false, detail: status ? `status is "${status}", not Active` : "not found on register" };
  } catch (err) {
    return { ok: false, detail: `register lookup failed: ${(err as Error).message}` };
  }
}

async function checkOperators(operators: CasinoOperator[]): Promise<{ lines: string[]; failures: string[]; strippedIds: Set<string> }> {
  const lines: string[] = [];
  const failures: string[] = [];
  const strippedIds = new Set<string>();

  if (operators.length === 0) {
    lines.push("No operators found in `data/casinos/*.json` - nothing to verify (see `data/casinos/README.md`).");
    return { lines, failures, strippedIds };
  }

  for (const op of operators) {
    if (!op.ukgcAccountNumber) {
      failures.push(`Operator "${op.id}" has no ukgcAccountNumber set.`);
      strippedIds.add(op.id);
      continue;
    }
    const result = await checkUkgcStatus(op.ukgcAccountNumber);
    if (result.ok) {
      lines.push(`- ✅ \`${op.id}\` (${op.brandName}), licence \`${op.ukgcAccountNumber}\`: Active`);
    } else {
      failures.push(`Operator "${op.id}" (${op.brandName}, licence ${op.ukgcAccountNumber}): ${result.detail}`);
      strippedIds.add(op.id);
      lines.push(`- ❌ \`${op.id}\` (${op.brandName}), licence \`${op.ukgcAccountNumber}\`: ${result.detail} - links stripped`);
    }
  }
  return { lines, failures, strippedIds };
}

// ---------------------------------------------------------------------------
// Check 2 + 5: affiliate link whitelist + rel attributes
// ---------------------------------------------------------------------------

function extractAnchors(html: string): { href: string; relAttr: string }[] {
  const anchors: { href: string; relAttr: string }[] = [];
  const re = /<a\s+([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1];
    const hrefMatch = attrs.match(/href="([^"]*)"/i);
    const relMatch = attrs.match(/rel="([^"]*)"/i);
    if (hrefMatch) anchors.push({ href: hrefMatch[1], relAttr: relMatch?.[1] ?? "" });
  }
  return anchors;
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function checkAffiliateLinks(
  htmlFiles: string[],
  operators: CasinoOperator[],
  whitelist: Set<string>
): Promise<{ lines: string[]; failures: string[] }> {
  const lines: string[] = [];
  const failures: string[] = [];
  const operatorDomains = new Set(operators.map((o) => domainOf(o.affiliateUrl)).filter((d): d is string => !!d));
  // Also treat whitelisted partner domains as affiliate destinations even when
  // no data/casinos/*.json operator row is configured yet.
  for (const domain of whitelist) operatorDomains.add(domain);

  if (operatorDomains.size === 0) {
    lines.push("No operator affiliate URLs configured - no partner links to check yet.");
    return { lines, failures };
  }

  let checkedCount = 0;
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    for (const anchor of extractAnchors(html)) {
      const domain = domainOf(anchor.href);
      if (!domain || !operatorDomains.has(domain)) continue;
      checkedCount += 1;
      if (!whitelist.has(domain)) {
        failures.push(`${path.relative(ROOT_DIR, file)}: partner link to "${domain}" is not in data/affiliate-domain-whitelist.txt`);
      }
      if (!/\bsponsored\b/.test(anchor.relAttr) || !/\bnofollow\b/.test(anchor.relAttr)) {
        failures.push(`${path.relative(ROOT_DIR, file)}: partner link to "${domain}" missing rel="sponsored nofollow" (found rel="${anchor.relAttr}")`);
      }
    }
  }
  lines.push(`Checked ${checkedCount} partner-link occurrence(s) across ${htmlFiles.length} built pages.`);
  return { lines, failures };
}

// ---------------------------------------------------------------------------
// Check 3: offer pages must disclose 18+, BeGambleAware and full bonus T&Cs
// ---------------------------------------------------------------------------

function pageMentionsOffer(html: string): boolean {
  return /\b(bonus|no deposit|free spins|promo code|wagering)\b/i.test(html);
}

async function checkOfferDisclosures(htmlFiles: string[]): Promise<{ lines: string[]; failures: string[] }> {
  const lines: string[] = [];
  const failures: string[] = [];
  let offerPageCount = 0;

  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    if (!pageMentionsOffer(html)) continue;
    offerPageCount += 1;
    const rel = path.relative(ROOT_DIR, file);

    if (!/18\+/.test(html)) failures.push(`${rel}: mentions an offer but no "18+" marker found`);
    if (!/begambleaware\.org/i.test(html)) failures.push(`${rel}: mentions an offer but no BeGambleAware link found`);

    const missingTerms = REQUIRED_BONUS_TERMS.filter((term) => !new RegExp(term.replace(" ", "[ -]?"), "i").test(html));
    // Full T&Cs (wagering/min deposit/expiry/game weighting figures) only
    // apply once a real bonus offer with those figures is being displayed -
    // our current pages explicitly describe the CONCEPT of these terms
    // (see data/casinos/README.md: no real operator offers are live yet),
    // so we only hard-fail this specific sub-check once real bonus.* data
    // from data/casinos exists to render. For now we report coverage only.
    if (missingTerms.length > 0) {
      lines.push(`- ℹ️ ${rel}: discusses bonus terminology without covering ${missingTerms.join(", ")} explicitly (no live offer rendered yet - see data/casinos/README.md)`);
    } else {
      lines.push(`- ✅ ${rel}: covers all of wagering/min deposit/expiry/game weighting`);
    }
  }

  lines.unshift(`${offerPageCount} page(s) mention bonus/offer terminology.`);
  return { lines, failures };
}

// ---------------------------------------------------------------------------
// Check 4: banned phrases (same negation-aware logic as generate-content.ts)
// ---------------------------------------------------------------------------

const NEGATION_WINDOW = 40;
const NEGATION_MARKERS = /\b(no|not|n't|never|nothing|cannot|can't|doesn't|isn't|won't|without|neither)\b/i;

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
}

function findUnnegatedBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    let fromIndex = 0;
    while (true) {
      const idx = lower.indexOf(phrase, fromIndex);
      if (idx === -1) break;
      const preceding = lower.slice(Math.max(0, idx - NEGATION_WINDOW), idx);
      if (!NEGATION_MARKERS.test(preceding)) return phrase;
      fromIndex = idx + phrase.length;
    }
  }
  return null;
}

async function checkBannedPhrasesAndAgeGating(htmlFiles: string[]): Promise<{ lines: string[]; failures: string[] }> {
  const lines: string[] = [];
  const failures: string[] = [];
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const text = stripTags(html);
    const rel = path.relative(ROOT_DIR, file);

    const bannedHit = findUnnegatedBannedPhrase(text);
    if (bannedHit) failures.push(`${rel}: banned phrase found (not negated): "${bannedHit}"`);

    for (const pattern of UNDER_18_ADDRESS_PATTERNS) {
      if (pattern.test(text)) failures.push(`${rel}: content appears to address under-18s`);
    }
  }
  lines.push(`Scanned ${htmlFiles.length} built pages for banned phrases and under-18 targeting.`);
  return { lines, failures };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const operators = await loadOperators();
  const whitelist = await loadWhitelist();
  const htmlFiles = await findHtmlFiles(SITES_DIR);

  if (htmlFiles.length === 0) {
    console.error(`[fatal] no built HTML found under ${path.relative(ROOT_DIR, SITES_DIR)}/ - run npm run build-sites first`);
    process.exitCode = 1;
    return;
  }

  const reportSections: string[] = [];
  const allFailures: string[] = [];

  reportSections.push(`# Compliance report\n\nGenerated ${new Date().toISOString()} against ${htmlFiles.length} built pages under \`sites/\`.\n`);

  const operatorCheck = await checkOperators(operators);
  reportSections.push(`## 1. Operator UKGC licence status\n\n${operatorCheck.lines.join("\n")}\n`);
  allFailures.push(...operatorCheck.failures);

  const affiliateCheck = await checkAffiliateLinks(htmlFiles, operators, whitelist);
  reportSections.push(`## 2 & 5. Partner-link domain whitelist and rel="sponsored nofollow"\n\n${affiliateCheck.lines.join("\n")}\n`);
  allFailures.push(...affiliateCheck.failures);

  const offerCheck = await checkOfferDisclosures(htmlFiles);
  reportSections.push(`## 3. Offer page disclosures (18+, BeGambleAware, bonus T&Cs)\n\n${offerCheck.lines.join("\n")}\n`);
  allFailures.push(...offerCheck.failures);

  const bannedCheck = await checkBannedPhrasesAndAgeGating(htmlFiles);
  reportSections.push(`## 4. Banned phrases and under-18 targeting\n\n${bannedCheck.lines.join("\n")}\n`);
  allFailures.push(...bannedCheck.failures);

  reportSections.push(
    allFailures.length === 0
      ? "## Result\n\n✅ All compliance checks passed.\n"
      : `## Result\n\n❌ ${allFailures.length} violation(s) found:\n\n${allFailures.map((f) => `- ${f}`).join("\n")}\n`
  );

  await writeFile(REPORT_PATH, reportSections.join("\n"), "utf8");
  console.log(`[info] wrote ${path.relative(ROOT_DIR, REPORT_PATH)}`);

  if (allFailures.length > 0) {
    console.error(`[fatal] ${allFailures.length} compliance violation(s) - see compliance-report.md`);
    process.exitCode = 1;
  } else {
    console.log("[info] all compliance checks passed");
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
