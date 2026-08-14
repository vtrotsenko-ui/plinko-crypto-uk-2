#!/usr/bin/env tsx
/**
 * Static site builder - the final step that turns validated content JSON
 * (scripts/generate-content.ts output) into 5 self-contained, host-ready
 * static sites under sites/{site-id}/.
 *
 * For each page in data/sitemap-plan.json:
 *   - loads content/generated/{site}/{pageKey}.json
 *   - renders a full HTML document (scripts/lib/layout.ts): header/nav,
 *     hero, article body, FAQ accordion, related-page links, footer with
 *     RG links, cookie-consent banner
 *   - embeds the free-play Plinko demo widget on every homepage, and on any
 *     page whose content explicitly asked for it (the dedicated demo page)
 *
 * Then copies the shared assets (CSS, JS, images) into each site's own
 * assets/ folder - every site under sites/ is independently deployable to
 * its own hosting root with no build step required.
 *
 * Finally writes robots.txt and sitemap.xml per site from the plan's
 * priorities.
 */

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import { renderPage, type NavLink, type PageInput, type SiteChrome } from "./lib/layout.js";
import { brandLogoSvg } from "./lib/svg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONTENT_DIR = path.join(ROOT_DIR, "content", "generated");
const ASSETS_SRC_DIR = path.join(ROOT_DIR, "assets-src");
const SITES_OUT_DIR = path.join(ROOT_DIR, "sites");

const SITEMAP_PLAN_PATH = path.join(DATA_DIR, "sitemap-plan.json");
const SITES_YAML_PATH = path.join(DATA_DIR, "sites.yaml");

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

interface SiteYamlDef {
  id: string;
  domain: string;
  name: string;
  positioning: string;
}

interface GeneratedContent {
  title: string;
  metaDescription: string;
  h1: string;
  sections: { h2: string; html: string }[];
  faq: { question: string; answer: string }[];
  schema: Record<string, unknown>;
  images: { filename: string; alt: string }[];
}

const TRUST_LABELS: Record<string, string> = {
  "/about-us/": "About Us",
  "/privacy-cookie-policy/": "Privacy & Cookie Policy",
  "/terms-of-service/": "Terms of Service",
  "/is-plinko-legal-in-the-uk/": "Is Plinko Legal in the UK?",
  "/responsible-gambling/": "Responsible Gambling",
};

const HERO_IMAGE_BY_SITE: Record<string, string> = {
  "plinko-game-guide-uk": "hero-plinko-board.jpg",
  "plinko-casino-hub-uk": "hero-casino-comparison.jpg",
  "plinko-strategy-lab-uk": "plinko-odds-diagram-photo.jpg",
  "crypto-plinko-uk": "hero-crypto-plinko.jpg",
  "plinko-app-hub-uk": "hero-plinko-mobile-app.jpg",
};

// Each site gets its own accent so the 5 sites don't look like clones of
// one template - used for links/buttons (site.css custom properties) and
// baked into that site's own logo.svg (favicon + header mark + schema.org
// Organization.logo).
const ACCENT_BY_SITE: Record<string, { accent: string; accentDark: string }> = {
  "plinko-game-guide-uk": { accent: "#1f6f54", accentDark: "#14503c" }, // teal green
  "plinko-casino-hub-uk": { accent: "#2b5faa", accentDark: "#1c4278" }, // navy blue
  "plinko-strategy-lab-uk": { accent: "#b8790a", accentDark: "#7a5206" }, // amber/gold
  "crypto-plinko-uk": { accent: "#7c4dbd", accentDark: "#553486" }, // purple
  "plinko-app-hub-uk": { accent: "#c1502e", accentDark: "#8f3a20" }, // coral
};

function slugToPageKey(slug: string): string {
  if (slug === "/") return "index";
  return slug.replace(/^\/|\/$/g, "");
}

function slugFromUrl(url: string): string {
  return url.replace(/^https:\/\/[^/]+/, "") || "/";
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function buildSite(siteDef: SiteYamlDef, pages: PlanPage[]): Promise<void> {
  const siteOutDir = path.join(SITES_OUT_DIR, siteDef.id);
  await mkdir(siteOutDir, { recursive: true });

  const landingPages = pages.filter((p) => p.page_type === "landing");
  const contentBySlug = new Map<string, GeneratedContent>();
  for (const page of pages) {
    const slug = slugFromUrl(page.url);
    const pageKey = slugToPageKey(slug);
    const content = await loadJson<GeneratedContent>(path.join(CONTENT_DIR, siteDef.id, `${pageKey}.json`));
    contentBySlug.set(slug, content);
  }

  const headerNav: NavLink[] = [
    { href: "/", label: "Home" },
    ...landingPages.map((p) => ({ href: slugFromUrl(p.url), label: contentBySlug.get(slugFromUrl(p.url))!.h1 })),
    { href: "/responsible-gambling/", label: "Responsible Gambling" },
  ];
  const footerGuides: NavLink[] = [
    { href: "/", label: "Home" },
    ...landingPages.map((p) => ({ href: slugFromUrl(p.url), label: contentBySlug.get(slugFromUrl(p.url))!.h1 })),
  ];
  const footerLegal: NavLink[] = Object.entries(TRUST_LABELS).map(([href, label]) => ({ href, label }));

  const accent = ACCENT_BY_SITE[siteDef.id] ?? ACCENT_BY_SITE["plinko-game-guide-uk"];
  const chrome: SiteChrome = {
    siteName: siteDef.name,
    domain: siteDef.domain,
    headerNav,
    footerGuides,
    footerLegal,
    heroImage: HERO_IMAGE_BY_SITE[siteDef.id] ?? "hero-plinko-board.jpg",
    accentColor: accent.accent,
    accentDark: accent.accentDark,
  };

  for (const page of pages) {
    const slug = slugFromUrl(page.url);
    const content = contentBySlug.get(slug)!;
    const includeDemoWidget =
      page.page_type === "home" ||
      content.sections.some((s) => s.html.includes("demo-embed-placeholder"));

    const pageInput: PageInput = {
      url: page.url,
      slug,
      pageType: page.page_type,
      primaryKeyword: page.primary_keyword,
      intent: page.intent,
      internalLinksTo: page.internal_links_to,
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      sections: content.sections,
      faq: content.faq,
      schema: content.schema,
      images: content.images,
      includeDemoWidget,
    };

    const html = renderPage(pageInput, chrome);
    const pageKey = slugToPageKey(slug);
    const outDir = pageKey === "index" ? siteOutDir : path.join(siteOutDir, pageKey);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "index.html"), html, "utf8");
  }

  // Shared assets - copied per site so each folder under sites/ is a fully
  // self-contained static site with zero build step at deploy time.
  await cp(path.join(ASSETS_SRC_DIR, "css"), path.join(siteOutDir, "assets", "css"), { recursive: true });
  await cp(path.join(ASSETS_SRC_DIR, "js"), path.join(siteOutDir, "assets", "js"), { recursive: true });
  await cp(path.join(ASSETS_SRC_DIR, "images"), path.join(siteOutDir, "assets", "images"), { recursive: true });

  // Per-site logo/favicon, tinted with this site's own accent colour -
  // used as the header brand mark, the favicon, and schema.org
  // Organization.logo (see scripts/lib/layout.ts).
  await writeFile(
    path.join(siteOutDir, "assets", "images", "logo.svg"),
    brandLogoSvg(accent.accent, accent.accentDark),
    "utf8"
  );

  const origin = `https://${siteDef.domain}`;
  await writeFile(
    path.join(siteOutDir, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
    "utf8"
  );

  const today = new Date().toISOString().slice(0, 10);
  const urlEntries = pages
    .map(
      (p) =>
        `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${p.priority.toFixed(1)}</priority>\n  </url>`
    )
    .join("\n");
  await writeFile(
    path.join(siteOutDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`,
    "utf8"
  );

  console.log(`[info] built ${pages.length} pages for "${siteDef.id}" -> ${path.relative(ROOT_DIR, siteOutDir)}/`);
}

async function main(): Promise<void> {
  await rm(SITES_OUT_DIR, { recursive: true, force: true });
  await mkdir(SITES_OUT_DIR, { recursive: true });

  const plan = await loadJson<PlanPage[]>(SITEMAP_PLAN_PATH);
  const sitesYaml = parseYaml(await readFile(SITES_YAML_PATH, "utf8")) as { sites: SiteYamlDef[] };

  for (const siteDef of sitesYaml.sites) {
    const pages = plan.filter((p) => p.site === siteDef.id);
    if (pages.length === 0) {
      console.warn(`[warn] no pages found in sitemap plan for site "${siteDef.id}" - skipping`);
      continue;
    }
    await buildSite(siteDef, pages);
  }

  console.log(`[info] all sites built under ${path.relative(ROOT_DIR, SITES_OUT_DIR)}/ - each folder is independently deployable`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
