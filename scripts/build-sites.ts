#!/usr/bin/env tsx
/**
 * Static site builder for the single 1win Argentina English guide.
 */

import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import { renderPage, type NavLink, type PageInput, type SiteChrome } from "./lib/layout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONTENT_DIR = path.join(ROOT_DIR, "content", "generated");
const ASSETS_SRC_DIR = path.join(ROOT_DIR, "assets-src");
const SITES_OUT_DIR = path.join(ROOT_DIR, "sites");
const DIST_OUT_DIR = path.join(ROOT_DIR, "dist");

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
  "/is-1win-legal-in-argentina/": "Is 1win Legal in Argentina?",
  "/responsible-gambling/": "Responsible Gambling",
};

const NAV_LABELS: Record<string, string> = {
  "/": "Home",
  "/1win-casino/": "Casino",
  "/1win-app/": "App",
  "/1win-login/": "Login",
  "/1win-bonus-code/": "Bonus code",
  "/1win-aviator/": "Aviator",
  "/1win-argentina/": "Argentina",
  "/is-1win-legal-in-argentina/": "Legality",
  "/responsible-gambling/": "Responsible gambling",
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
    ...landingPages
      .filter((p) => !slugFromUrl(p.url).includes("legal"))
      .slice(0, 6)
      .map((p) => {
        const slug = slugFromUrl(p.url);
        return { href: slug, label: NAV_LABELS[slug] ?? contentBySlug.get(slug)!.h1.slice(0, 24) };
      }),
    { href: "/responsible-gambling/", label: "RG" },
  ];
  const footerGuides: NavLink[] = [
    { href: "/", label: "Home" },
    ...landingPages.map((p) => {
      const slug = slugFromUrl(p.url);
      return { href: slug, label: NAV_LABELS[slug] ?? slug };
    }),
  ];
  const footerLegal: NavLink[] = Object.entries(TRUST_LABELS).map(([href, label]) => ({ href, label }));

  const chrome: SiteChrome = {
    siteName: siteDef.name,
    domain: siteDef.domain,
    headerNav,
    footerGuides,
    footerLegal,
    heroImage: "hero-1win-casino.png",
    accentColor: "#00c853",
    accentDark: "#0a1f17",
  };

  for (const page of pages) {
    const slug = slugFromUrl(page.url);
    const content = contentBySlug.get(slug)!;
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
      includeDemoWidget: false,
    };

    const html = renderPage(pageInput, chrome);
    const pageKey = slugToPageKey(slug);
    const outDir = pageKey === "index" ? siteOutDir : path.join(siteOutDir, pageKey);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "index.html"), html, "utf8");
  }

  await cp(path.join(ASSETS_SRC_DIR, "css"), path.join(siteOutDir, "assets", "css"), { recursive: true });
  await cp(path.join(ASSETS_SRC_DIR, "js"), path.join(siteOutDir, "assets", "js"), { recursive: true });
  await cp(path.join(ASSETS_SRC_DIR, "images"), path.join(siteOutDir, "assets", "images"), { recursive: true });

  // Prefer the official-style 1win logo copied from competitor reference assets.
  const logoSrc = path.join(ASSETS_SRC_DIR, "images", "1win-logo-source.svg");
  await cp(logoSrc, path.join(siteOutDir, "assets", "images", "logo.svg"));

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

  // Mirror into dist/ for schema validator + zip packaging
  await rm(DIST_OUT_DIR, { recursive: true, force: true });
  await mkdir(DIST_OUT_DIR, { recursive: true });
  await cp(siteOutDir, path.join(DIST_OUT_DIR, siteDef.id), { recursive: true });

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

  console.log(`[info] sites built under ${path.relative(ROOT_DIR, SITES_OUT_DIR)}/`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
