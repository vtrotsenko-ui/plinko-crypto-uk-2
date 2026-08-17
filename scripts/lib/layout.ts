/**
 * Shared HTML document layout for the 1win Argentina static site.
 * Relative paths ending in index.html so file:// and static hosts both work.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandLogoSvg } from "./svg.js";

export interface NavLink {
  href: string;
  label: string;
}

export interface PageInput {
  url: string;
  slug: string;
  pageType: "home" | "landing" | "trust";
  primaryKeyword: string;
  intent: string;
  internalLinksTo: string[];
  title: string;
  metaDescription: string;
  h1: string;
  sections: { h2: string; html: string }[];
  faq: { question: string; answer: string }[];
  schema: Record<string, unknown>;
  images: { filename: string; alt: string }[];
  includeDemoWidget: boolean;
}

export interface SiteChrome {
  siteName: string;
  domain: string;
  headerNav: NavLink[];
  footerGuides: NavLink[];
  footerLegal: NavLink[];
  heroImage: string;
  accentColor: string;
  accentDark: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function depthOf(slug: string): number {
  return slug.split("/").filter(Boolean).length;
}

function toRelativeHref(fromSlug: string, toSlug: string): string {
  const up = "../".repeat(depthOf(fromSlug));
  const targetSegments = toSlug.split("/").filter(Boolean);
  return up + (targetSegments.length ? `${targetSegments.join("/")}/index.html` : "index.html");
}

function assetsPrefix(fromSlug: string): string {
  return "../".repeat(depthOf(fromSlug));
}

function rewriteInternalLinks(html: string, currentSlug: string): string {
  let out = html.replace(/href="(\/(?!\/)[^"]*)"/g, (_match, internalPath: string) => {
    return `href="${toRelativeHref(currentSlug, internalPath)}"`;
  });
  const prefix = assetsPrefix(currentSlug);
  out = out.replace(/src="\/assets\//g, `src="${prefix}assets/`);
  return out;
}

function labelFromSlug(slug: string): string {
  if (slug === "/") return "Home";
  const clean = slug.replace(/^\/|\/$/g, "").replace(/-/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function renderNav(links: NavLink[], currentSlug: string): string {
  return links
    .map(
      (l) =>
        `<a href="${toRelativeHref(currentSlug, l.href)}"${l.href === currentSlug ? ' aria-current="page"' : ""}>${escapeHtml(l.label)}</a>`
    )
    .join("\n");
}

function renderFaq(faq: { question: string; answer: string }[]): string {
  if (faq.length === 0) return "";
  return `
  <section class="faq-section">
    <h2>Frequently asked questions</h2>
    <div class="faq-list">
      ${faq
        .map(
          (f) => `<details class="faq-item"><summary>${escapeHtml(f.question)}</summary><div class="faq-answer"><p>${escapeHtml(f.answer)}</p></div></details>`
        )
        .join("\n")}
    </div>
  </section>`;
}

function logoMarkup(chrome: SiteChrome, assets: string): string {
  const logoPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../assets-src/images/1win-logo-source.svg"
  );
  if (existsSync(logoPath)) {
    return `<img class="site-logo-img" src="${assets}assets/images/logo.svg" width="116" height="50" alt="${escapeHtml(chrome.siteName)} logo" />`;
  }
  return `<span class="site-logo">${brandLogoSvg(chrome.accentColor, chrome.accentDark)}</span>`;
}

function buildFullSchema(page: PageInput, chrome: SiteChrome, origin: string): Record<string, unknown> {
  const existingGraph = Array.isArray((page.schema as { "@graph"?: unknown[] })["@graph"])
    ? ((page.schema as { "@graph": unknown[] })["@graph"] as unknown[])
    : [];

  const organization = {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: chrome.siteName,
    url: `${origin}/`,
    logo: `${origin}/assets/images/logo.svg`,
  };

  const website = {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: chrome.siteName,
    url: `${origin}/`,
    inLanguage: "en-GB",
    publisher: { "@id": `${origin}/#organization` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${page.url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      ...(page.slug === "/"
        ? []
        : [{ "@type": "ListItem", position: 2, name: page.h1, item: page.url }]),
    ],
  };

  return { "@context": "https://schema.org", "@graph": [...existingGraph, organization, website, breadcrumb] };
}

export function renderPage(page: PageInput, chrome: SiteChrome): string {
  const canonical = page.url;
  const origin = new URL(page.url).origin;
  const assets = assetsPrefix(page.slug);
  const heroImagePath = `${assets}assets/images/${chrome.heroImage}`;
  const homeHref = toRelativeHref(page.slug, "/");
  const privacyHref = toRelativeHref(page.slug, "/privacy-cookie-policy/");

  const sectionsHtml = page.sections
    .map((s) => `<section><h2>${escapeHtml(s.h2)}</h2>${rewriteInternalLinks(s.html, page.slug)}</section>`)
    .join("\n");

  const relatedLinksHtml =
    page.internalLinksTo.length > 0
      ? `<nav class="related-pages" aria-label="Related pages">${page.internalLinksTo
          .map((href) => `<a href="${toRelativeHref(page.slug, href)}">${escapeHtml(labelFromSlug(href))}</a>`)
          .join("\n")}</nav>`
      : "";

  const schema = buildFullSchema(page, chrome, origin);
  const ratingVisible =
    page.pageType === "home" || page.pageType === "landing"
      ? `<p class="affiliate-disclosure review-rating-line">Editorial review rating: <strong>4.2</strong> / 5 (bestRating 5, worstRating 1). Some links may be partner links (<span>sponsored disclosure within the first screen of this review block</span>). See <a href="${toRelativeHref(page.slug, "/about-us/")}">About Us</a>.</p>`
      : "";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.metaDescription)}" />
<link rel="canonical" href="${canonical}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<meta name="rating" content="adult" />
<meta name="theme-color" content="${chrome.accentDark}" />
<link rel="icon" href="${assets}assets/images/logo.svg" type="image/svg+xml" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="en_GB" />
<meta property="og:title" content="${escapeHtml(page.title)}" />
<meta property="og:description" content="${escapeHtml(page.metaDescription)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${origin}/assets/images/${chrome.heroImage}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${assets}assets/css/site.css" />
<style>:root{--color-accent:${chrome.accentColor};--color-accent-dark:${chrome.accentDark};}</style>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header">
  <div class="header-inner">
    <a class="site-brand" href="${homeHref}">
      ${logoMarkup(chrome, assets)}
      <span class="brand-text">${escapeHtml(chrome.siteName)}</span>
    </a>
    <nav class="site-nav" aria-label="Primary">
      ${renderNav(chrome.headerNav, page.slug)}
      <span class="age-badge">18+</span>
    </nav>
  </div>
</header>
<main id="main-content">
  <div class="hero">
    <div>
      <p class="brand-kicker">${escapeHtml(chrome.siteName)}</p>
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="lede">${escapeHtml(page.metaDescription)}</p>
      ${ratingVisible}
    </div>
    <img class="hero-photo" src="${heroImagePath}" alt="${escapeHtml(page.images[0]?.alt ?? page.h1)}" loading="eager" width="640" height="360" />
  </div>
  <article class="page-content">
    ${sectionsHtml}
  </article>
  ${renderFaq(page.faq)}
  ${relatedLinksHtml}
</main>
<footer class="site-footer">
  <div class="footer-inner">
    <div>
      <h3>Guides</h3>
      <ul>${chrome.footerGuides.map((l) => `<li><a href="${toRelativeHref(page.slug, l.href)}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>
    </div>
    <div>
      <h3>Legal &amp; safety</h3>
      <ul>${chrome.footerLegal.map((l) => `<li><a href="${toRelativeHref(page.slug, l.href)}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>
    </div>
    <div>
      <h3>Play responsibly</h3>
      <p style="font-size:0.85rem;color:#c7cad6;">18+. Gambling can be addictive. Support: <a href="https://www.begambleaware.org" rel="noopener" target="_blank">BeGambleAware</a> &middot; <a href="https://www.gamcare.org.uk" rel="noopener" target="_blank">GamCare</a>.</p>
    </div>
  </div>
  <div class="footer-bottom">&copy; ${new Date().getFullYear()} ${escapeHtml(chrome.siteName)}. Independent information site - not a gambling operator.</div>
</footer>
<div class="cookie-banner" data-cookie-banner>
  <p>We use essential cookies to remember your consent choice. See our <a href="${privacyHref}">Privacy &amp; Cookie Policy</a>.</p>
  <div>
    <button type="button" data-cookie-reject style="background:#3a3f52;">Reject non-essential</button>
    <button type="button" data-cookie-accept>Accept</button>
  </div>
</div>
<script src="${assets}assets/js/cookie-consent.js"></script>
</body>
</html>
`;
}
