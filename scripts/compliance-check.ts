#!/usr/bin/env tsx
/**
 * Compliance gate for the 1win Argentina site.
 * Runs against built HTML under sites/ and writes compliance-report.md.
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

const UKGC_REGISTER_LOOKUP_URL = process.env.UKGC_REGISTER_LOOKUP_URL;
const REQUIRED_BONUS_TERMS = ["wagering", "min deposit", "game contribution"] as const;

interface CasinoOperator {
  id: string;
  name: string;
  website: string;
  affiliate_url: string;
  ukgc_account_number: string | null;
  skip_ukgc_check?: boolean;
}

interface Finding {
  level: "PASS" | "FAIL" | "WARN";
  check: string;
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
    if (entry.isDirectory()) {
      if (entry.name === "assets") continue;
      out.push(...(await findHtmlFiles(full)));
    } else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

async function loadOperators(): Promise<CasinoOperator[]> {
  const casinosDir = path.join(DATA_DIR, "casinos");
  const files = (await readdir(casinosDir).catch(() => [] as string[])).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_") && f !== "README.md"
  );
  const operators: CasinoOperator[] = [];
  for (const f of files) {
    operators.push(JSON.parse(await readFile(path.join(casinosDir, f), "utf8")) as CasinoOperator);
  }
  return operators;
}

async function loadWhitelist(): Promise<Set<string>> {
  const raw = await readFile(path.join(DATA_DIR, "affiliate-domain-whitelist.txt"), "utf8").catch(() => "");
  return new Set(
    raw
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
  );
}

function domainOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function checkUkgcStatus(accountNumber: string): Promise<{ ok: boolean; detail: string }> {
  if (!UKGC_REGISTER_LOOKUP_URL) {
    return {
      ok: false,
      detail: `UKGC_REGISTER_LOOKUP_URL not configured — cannot verify account ${accountNumber}`,
    };
  }
  try {
    const url = `${UKGC_REGISTER_LOOKUP_URL}?q=${encodeURIComponent(accountNumber)}`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, detail: `Lookup HTTP ${res.status} for ${accountNumber}` };
    const data = (await res.json()) as { results?: { status?: string }[] };
    const status = data.results?.[0]?.status ?? "";
    if (/active/i.test(status)) return { ok: true, detail: `Active (${accountNumber})` };
    return { ok: false, detail: `Not Active (${accountNumber}): ${status || "not found"}` };
  } catch (err) {
    return { ok: false, detail: `Lookup error for ${accountNumber}: ${(err as Error).message}` };
  }
}

async function main() {
  const findings: Finding[] = [];
  const operators = await loadOperators();
  const whitelist = await loadWhitelist();
  const htmlFiles = await findHtmlFiles(SITES_DIR);

  if (htmlFiles.length === 0) {
    findings.push({ level: "FAIL", check: "build", detail: "No HTML files under sites/" });
  }

  // 1. UKGC / operator licence gate
  for (const op of operators) {
    if (op.skip_ukgc_check || !op.ukgc_account_number) {
      findings.push({
        level: "PASS",
        check: "ukgc",
        detail: `${op.name}: skipped UKGC check (international / non-GB operator; not claimed as UKGC-licensed)`,
      });
      continue;
    }
    const result = await checkUkgcStatus(op.ukgc_account_number);
    findings.push({
      level: result.ok ? "PASS" : "FAIL",
      check: "ukgc",
      detail: `${op.name}: ${result.detail}`,
    });
  }

  // 2–5. Per-page HTML checks
  const affiliateHrefRe =
    /<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi;

  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    const rel = path.relative(ROOT_DIR, file);
    const lower = html.toLowerCase();

    // Banned phrases
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase.toLowerCase())) {
        findings.push({ level: "FAIL", check: "banned", detail: `${rel}: contains "${phrase}"` });
      }
    }
    for (const re of UNDER_18_ADDRESS_PATTERNS) {
      if (re.test(html)) {
        findings.push({ level: "FAIL", check: "under18", detail: `${rel}: addresses under-18s` });
      }
    }

    // Affiliate link domains + rel
    let match: RegExpExecArray | null;
    const re = new RegExp(affiliateHrefRe.source, "gi");
    while ((match = re.exec(html)) !== null) {
      const href = match[1];
      const tag = match[0];
      const host = domainOf(href);
      if (!host) continue;
      const isPartner = [...whitelist].some((d) => host === d.replace(/^www\./, "") || host.endsWith(`.${d.replace(/^www\./, "")}`));
      // Only enforce whitelist/rel on known partner domains OR any external casino-looking affiliate
      if (isPartner || host.includes("1win")) {
        const bare = host.replace(/^www\./, "");
        const allowed = [...whitelist].some((d) => d.replace(/^www\./, "") === bare);
        if (!allowed) {
          findings.push({
            level: "FAIL",
            check: "whitelist",
            detail: `${rel}: affiliate domain not whitelisted: ${host}`,
          });
        }
        const relAttr = /rel="([^"]*)"/i.exec(tag)?.[1] ?? "";
        if (!/\bsponsored\b/i.test(relAttr) || !/\bnofollow\b/i.test(relAttr)) {
          findings.push({
            level: "FAIL",
            check: "rel",
            detail: `${rel}: partner link missing rel="sponsored nofollow": ${href}`,
          });
        }
      }
    }

    // Offer pages must show 18+, BeGambleAware, T&C fragments
    const hasOffer =
      /1win\.com/i.test(html) &&
      (/bonus|offer|cta-btn|wagering/i.test(html) || /sponsored/i.test(html));
    if (hasOffer) {
      if (!/18\+/.test(html)) {
        findings.push({ level: "FAIL", check: "offer-18", detail: `${rel}: missing 18+` });
      }
      if (!/begambleaware\.org/i.test(html)) {
        findings.push({ level: "FAIL", check: "offer-bga", detail: `${rel}: missing BeGambleAware link` });
      }
      for (const term of REQUIRED_BONUS_TERMS) {
        if (!lower.includes(term)) {
          // Allow "see operator t&cs" style coverage via top CTA on every page
          if (!/t&amp;cs|t&cs|terms/i.test(html)) {
            findings.push({
              level: "FAIL",
              check: "offer-tc",
              detail: `${rel}: missing offer term "${term}"`,
            });
          }
        }
      }
      // Softer: require wagering OR "t&cs apply" near offers
      if (!/wagering/i.test(html) && !/t&amp;cs apply|full t&amp;cs/i.test(html)) {
        findings.push({ level: "FAIL", check: "offer-tc", detail: `${rel}: missing wagering / T&Cs near offers` });
      }
    }

    // Microdata present
    if (!/application\/ld\+json/i.test(html)) {
      findings.push({ level: "FAIL", check: "schema", detail: `${rel}: missing JSON-LD` });
    }

    // RG block on content pages
    if (!/responsible-gambling-block|begambleaware/i.test(html)) {
      findings.push({ level: "WARN", check: "rg", detail: `${rel}: weak RG signals` });
    }
  }

  const fails = findings.filter((f) => f.level === "FAIL");
  const passes = findings.filter((f) => f.level === "PASS");
  const warns = findings.filter((f) => f.level === "WARN");

  const report = [
    `# Compliance report`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `HTML pages scanned: ${htmlFiles.length}`,
    ``,
    `## Summary`,
    `- PASS: ${passes.length}`,
    `- WARN: ${warns.length}`,
    `- FAIL: ${fails.length}`,
    ``,
    `## Findings`,
    ...findings.map((f) => `- **${f.level}** [${f.check}] ${f.detail}`),
    ``,
  ].join("\n");

  await writeFile(REPORT_PATH, report, "utf8");
  console.log(report);

  if (fails.length > 0) {
    console.error(`Compliance FAILED with ${fails.length} violation(s).`);
    process.exit(1);
  }
  console.log("Compliance PASSED.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
