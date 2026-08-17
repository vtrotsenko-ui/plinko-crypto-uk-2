#!/usr/bin/env tsx
/**
 * Static site builder for the single 1win Argentina site.
 * Reads content/generated/{site}/{page}.json + data/sitemap-plan.json
 * and writes a host-ready tree under sites/{site-id}/.
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

const HERO_BY_SLUG: Record<string, string> = {
  "/": "hero-1win-home.png",
  "/1win-casino/": "hero-1win-casino.png",
  "/1win-app/": "hero-1win-app.png",
  "/1win-login/": "hero-1win-login.png",
  "/bonus-code-1win/": "img-bonus-code.png",
  "/1win-aviator/": "img-aviator.png",
  "/1win-argentina/": "img-argentina.png",
  "/is-1win-legal-in-argentina/": "img-legal.png",
  "/responsible-gambling/": "img-rg.png",
  "/about-us/": "img-about.png",
  "/privacy-cookie-policy/": "img-privacy.png",
  "/terms-of-service/": "img-terms.png",
};

function toSlug(urlOrSlug: string): string {
  if (urlOrSlug.startsWith("http://") || urlOrSlug.startsWith("https://")) {
    try {
      const u = new URL(urlOrSlug);
      return u.pathname.endsWith("/") || u.pathname === "" ? u.pathname || "/" : `${u.pathname}/`;
    } catch {
      return urlOrSlug;
    }
  }
  return urlOrSlug;
}

function slugToPageKey(slug: string): string {
  const pathSlug = toSlug(slug);
  if (pathSlug === "/") return "index";
  return pathSlug.replace(/^\/|\/$/g, "");
}

function labelFor(slug: string, keyword: string): string {
  return TRUST_LABELS[slug] ?? keyword;
}

async function main() {
  const plan = JSON.parse(await readFile(path.join(DATA_DIR, "sitemap-plan.json"), "utf8")) as PlanPage[];
  const sitesYaml = parseYaml(await readFile(path.join(DATA_DIR, "sites.yaml"), "utf8")) as {
    sites: SiteYamlDef[];
  };
  const siteMeta = new Map(sitesYaml.sites.map((s) => [s.id, s]));

  await rm(SITES_OUT_DIR, { recursive: true, force: true });
  await mkdir(SITES_OUT_DIR, { recursive: true });

  const bySite = new Map<string, PlanPage[]>();
  for (const page of plan) {
    const list = bySite.get(page.site) ?? [];
    list.push(page);
    bySite.set(page.site, list);
  }

  for (const [siteId, pages] of bySite) {
    const meta = siteMeta.get(siteId);
    if (!meta) throw new Error(`Unknown site ${siteId}`);

    const siteRoot = path.join(SITES_OUT_DIR, siteId);
    await mkdir(siteRoot, { recursive: true });

    // Copy assets
    await cp(ASSETS_SRC_DIR, path.join(siteRoot, "assets"), { recursive: true });

    const headerNav: NavLink[] = pages
      .filter((p) => p.page_type !== "trust" || toSlug(p.url) === "/responsible-gambling/")
      .slice(0, 7)
      .map((p) => ({ href: toSlug(p.url), label: labelFor(toSlug(p.url), p.primary_keyword) }));

    const footerGuides: NavLink[] = pages
      .filter((p) => p.page_type === "home" || p.page_type === "landing")
      .map((p) => ({ href: toSlug(p.url), label: labelFor(toSlug(p.url), p.primary_keyword) }));

    const footerLegal: NavLink[] = pages
      .filter((p) => p.page_type === "trust")
      .map((p) => ({ href: toSlug(p.url), label: labelFor(toSlug(p.url), p.primary_keyword) }));

    for (const page of pages) {
      const slug = toSlug(page.url);
      const pageKey = slugToPageKey(slug);
      const contentPath = path.join(CONTENT_DIR, siteId, `${pageKey}.json`);
      const content = JSON.parse(await readFile(contentPath, "utf8")) as GeneratedContent;

      const chrome: SiteChrome = {
        siteName: meta.name,
        domain: meta.domain,
        headerNav,
        footerGuides,
        footerLegal,
        heroImage: HERO_BY_SLUG[slug] ?? content.images[0]?.filename ?? "hero-1win-home.png",
        accentColor: "#0d7a5f",
        accentDark: "#0a5543",
        bgColor: "#e7f3f0",
      };

      const absoluteUrl =
        slug === "/" ? `https://${meta.domain}/` : `https://${meta.domain}${slug}`;

      const input: PageInput = {
        url: absoluteUrl,
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
      };

      const html = renderPage(input, chrome);
      const outDir =
        slug === "/" ? siteRoot : path.join(siteRoot, slug.replace(/^\/|\/$/g, ""));
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, "index.html"), html, "utf8");
      console.log(`wrote ${siteId}${slug}`);
    }

    // robots + sitemap
    const robots = `User-agent: *\nAllow: /\nSitemap: https://${meta.domain}/sitemap.xml\n`;
    await writeFile(path.join(siteRoot, "robots.txt"), robots, "utf8");

    const urls = pages
      .map((p) => {
        const slug = toSlug(p.url);
        const loc = slug === "/" ? `https://${meta.domain}/` : `https://${meta.domain}${slug}`;
        return `  <url><loc>${loc}</loc><priority>${p.priority.toFixed(1)}</priority></url>`;
      })
      .join("\n");
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    await writeFile(path.join(siteRoot, "sitemap.xml"), sitemap, "utf8");
  }

  console.log("Build complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
