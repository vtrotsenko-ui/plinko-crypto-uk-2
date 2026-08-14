/**
 * Shared HTML document layout used by scripts/build-sites.ts to render
 * every page of every site from its generated content JSON.
 *
 * All internal navigation (nav links, footer links, related-page links,
 * asset URLs) uses RELATIVE paths ending in an explicit `index.html` for
 * page links. This is deliberate: root-relative paths like `/assets/...`
 * or `/about-us/` only resolve correctly when a page is served from a real
 * HTTP server at its domain root. They silently break - no CSS, no images,
 * no JS, dead links - when a page is opened directly from disk
 * (`file:///...`) or hosted in a sub-path, which is exactly how a lot of
 * manual QA happens before a real domain is wired up. Relative links with
 * an explicit `index.html` work identically in both cases and on every
 * static host. Canonical/OG URLs still use the real absolute domain URL,
 * which is correct - those are for search engines and social crawlers,
 * not for browser navigation.
 */

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

// ---------------------------------------------------------------------------
// Relative path helpers - see file header for why these matter
// ---------------------------------------------------------------------------

function depthOf(slug: string): number {
  return slug.split("/").filter(Boolean).length;
}

/** Relative href from `fromSlug` to `toSlug`, always ending in `index.html`. */
function toRelativeHref(fromSlug: string, toSlug: string): string {
  const up = "../".repeat(depthOf(fromSlug));
  const targetSegments = toSlug.split("/").filter(Boolean);
  return up + (targetSegments.length ? `${targetSegments.join("/")}/index.html` : "index.html");
}

/** Relative prefix to reach the site root's assets/ folder from `fromSlug`. */
function assetsPrefix(fromSlug: string): string {
  return "../".repeat(depthOf(fromSlug));
}

/**
 * Rewrites any root-relative internal link (`href="/some-page/"`) found
 * inside authored article HTML into a proper relative link for the current
 * page. Content is hand-authored (and, in production, LLM-authored) prose
 * with inline links like `<a href="/plinko-demo/">` - those read naturally
 * as absolute site paths while writing content, but must never reach the
 * final HTML as-is (see file header). This is the single choke point that
 * makes that safe regardless of where a link was written.
 */
function rewriteInternalLinks(html: string, currentSlug: string): string {
  // Matches "/", "/foo/", "/foo/bar/" etc. but not "//external.com/..."
  // (protocol-relative) - negative lookahead only excludes a second slash
  // immediately after the first, it still matches a bare "/" correctly.
  return html.replace(/href="(\/(?!\/)[^"]*)"/g, (_match, internalPath: string) => {
    return `href="${toRelativeHref(currentSlug, internalPath)}"`;
  });
}

function labelFromSlug(slug: string): string {
  if (slug === "/") return "Home";
  const clean = slug.replace(/^\/|\/$/g, "").replace(/-/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ---------------------------------------------------------------------------
// Nav / FAQ / demo widget fragments
// ---------------------------------------------------------------------------

function renderNav(links: NavLink[], currentSlug: string): string {
  return links
    .map(
      (l) =>
        `<a href="${toRelativeHref(currentSlug, l.href)}"${l.href === currentSlug ? ' aria-current="page"' : ""}>${escapeHtml(l.label)}</a>`
    )
    .join("\n");
}

function renderDemoWidget(idSuffix: string, currentSlug: string): string {
  const rgHref = toRelativeHref(currentSlug, "/responsible-gambling/");
  return `
  <section class="plinko-widget" data-plinko-widget aria-label="Free Plinko demo game">
    <span class="plinko-widget-badge">FREE DEMO - 18+ - VIRTUAL CREDITS ONLY, NO REAL MONEY</span>
    <div class="plinko-widget-grid">
      <div>
        <canvas data-plinko-canvas width="520" height="360" role="img" aria-label="Plinko demo board"></canvas>
        <div class="plinko-paytable" data-plinko-paytable aria-label="Demo paytable"></div>
      </div>
      <div class="plinko-controls">
        <div>
          <label for="plinko-rows-${idSuffix}">Rows</label>
          <select id="plinko-rows-${idSuffix}" data-plinko-rows>
            <option value="8">8 rows</option>
            <option value="12" selected>12 rows</option>
            <option value="16">16 rows</option>
          </select>
        </div>
        <div>
          <label for="plinko-risk-${idSuffix}">Risk level</label>
          <select id="plinko-risk-${idSuffix}" data-plinko-risk>
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label for="plinko-stake-${idSuffix}">Demo stake</label>
          <input id="plinko-stake-${idSuffix}" data-plinko-stake type="number" min="1" step="1" value="10" />
        </div>
        <p class="plinko-balance">Balance: <span data-plinko-balance>1000 demo credits</span></p>
        <button type="button" class="plinko-drop-btn" data-plinko-drop>Drop ball</button>
        <button type="button" class="plinko-reset-btn" data-plinko-reset>Reset demo balance</button>
        <p class="plinko-result" data-plinko-result role="status"></p>
      </div>
    </div>
    <p class="affiliate-disclosure">This demo uses virtual credits that have no cash value, cannot be withdrawn, and cannot be purchased. It is not a certified or provably-fair RNG and is provided purely to illustrate how the mechanic works. 18+. See <a href="${rgHref}">Responsible Gambling</a>.</p>
  </section>`;
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

// ---------------------------------------------------------------------------
// Structured data (gambling-relevant microdata)
// ---------------------------------------------------------------------------

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
    publisher: { "@id": `${origin}/#organization` },
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      ...(page.slug === "/" ? [] : [{ "@type": "ListItem", position: 2, name: page.h1, item: page.url }]),
    ],
  };

  const graph: unknown[] = [...existingGraph, organization, website, breadcrumb];

  if (page.includeDemoWidget) {
    graph.push({
      "@type": "Game",
      name: `${chrome.siteName} - free Plinko demo`,
      description: "Free-play Plinko demo using virtual credits with no cash value. Not real-money gambling.",
      genre: "Casino Game",
      isAccessibleForFree: true,
      audience: { "@type": "PeopleAudience", suggestedMinAge: 18 },
      contentRating: "18+",
      publisher: { "@id": `${origin}/#organization` },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

// ---------------------------------------------------------------------------
// Page renderer
// ---------------------------------------------------------------------------

export function renderPage(page: PageInput, chrome: SiteChrome): string {
  const canonical = page.url;
  const origin = new URL(page.url).origin;
  const assets = assetsPrefix(page.slug);
  const heroImagePath = `${assets}assets/images/${chrome.heroImage}`;
  const logoImagePath = `${assets}assets/images/logo.svg`;
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

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.metaDescription)}" />
<link rel="canonical" href="${canonical}" />
<meta name="robots" content="index, follow" />
<meta name="rating" content="RTA-5042-1996-1400-1577-RTA" />
<meta name="theme-color" content="${chrome.accentDark}" />
<link rel="icon" href="${logoImagePath}" type="image/svg+xml" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(page.title)}" />
<meta property="og:description" content="${escapeHtml(page.metaDescription)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${origin}/assets/images/${chrome.heroImage}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="${assets}assets/css/site.css" />
<style>:root{--color-accent:${chrome.accentColor};--color-accent-dark:${chrome.accentDark};}</style>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header">
  <div class="header-inner">
    <a class="site-brand" href="${homeHref}">
      <span class="site-logo">${brandLogoSvg(chrome.accentColor, chrome.accentDark)}</span>
      ${escapeHtml(chrome.siteName)}
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
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="lede">${escapeHtml(page.metaDescription)}</p>
    </div>
    <img src="${heroImagePath}" alt="${escapeHtml(page.images[0]?.alt ?? page.h1)}" loading="eager" width="640" height="360" />
  </div>
  ${page.includeDemoWidget ? renderDemoWidget(page.slug.replace(/[^a-z0-9]/gi, "") || "home", page.slug) : ""}
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
      <p style="font-size:0.85rem;color:#c7cad6;">18+. Gambling can be addictive. Free confidential support: <a href="https://www.begambleaware.org" rel="noopener" target="_blank">BeGambleAware</a> &middot; <a href="https://www.gamcare.org.uk" rel="noopener" target="_blank">GamCare</a> &middot; <a href="https://www.gamstop.co.uk" rel="noopener" target="_blank">GAMSTOP</a>.</p>
    </div>
  </div>
  <div class="footer-bottom">&copy; ${new Date().getFullYear()} ${escapeHtml(chrome.siteName)}. Independent information site - not a gambling operator. Domain shown is a placeholder pending registration: ${escapeHtml(chrome.domain)}.</div>
</footer>
<div class="cookie-banner" data-cookie-banner>
  <p>We use essential and (with your consent) analytics cookies. See our <a href="${privacyHref}">Privacy &amp; Cookie Policy</a>.</p>
  <div>
    <button type="button" data-cookie-reject style="background:#3a3f52;">Reject non-essential</button>
    <button type="button" data-cookie-accept>Accept</button>
  </div>
</div>
<script src="${assets}assets/js/cookie-consent.js"></script>
${page.includeDemoWidget ? `<script src="${assets}assets/js/plinko-demo.js"></script>` : ""}
</body>
</html>
`;
}
