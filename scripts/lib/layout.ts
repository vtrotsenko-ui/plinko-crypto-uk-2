/**
 * Shared HTML document layout used by scripts/build-sites.ts to render
 * every page of every site from its generated content JSON.
 */

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
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNav(links: NavLink[], currentSlug: string): string {
  return links
    .map((l) => `<a href="${l.href}"${l.href === currentSlug ? ' aria-current="page"' : ""}>${escapeHtml(l.label)}</a>`)
    .join("\n");
}

function labelFromSlug(slug: string): string {
  if (slug === "/") return "Home";
  const clean = slug.replace(/^\/|\/$/g, "").replace(/-/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function renderDemoWidget(idSuffix: string): string {
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
    <p class="affiliate-disclosure">This demo uses virtual credits that have no cash value, cannot be withdrawn, and cannot be purchased. It is not a certified or provably-fair RNG and is provided purely to illustrate how the mechanic works. 18+. See <a href="/responsible-gambling/">Responsible Gambling</a>.</p>
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

export function renderPage(page: PageInput, chrome: SiteChrome): string {
  const canonical = page.url;
  const origin = new URL(page.url).origin;
  const heroImagePath = `/assets/images/${chrome.heroImage}`;

  const sectionsHtml = page.sections
    .map((s) => `<section><h2>${escapeHtml(s.h2)}</h2>${s.html}</section>`)
    .join("\n");

  const relatedLinksHtml =
    page.internalLinksTo.length > 0
      ? `<nav class="related-pages" aria-label="Related pages">${page.internalLinksTo
          .map((href) => `<a href="${href}">${escapeHtml(labelFromSlug(href))}</a>`)
          .join("\n")}</nav>`
      : "";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.metaDescription)}" />
<link rel="canonical" href="${canonical}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(page.title)}" />
<meta property="og:description" content="${escapeHtml(page.metaDescription)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${origin}${heroImagePath}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="/assets/css/site.css" />
<script type="application/ld+json">${JSON.stringify(page.schema)}</script>
</head>
<body>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header">
  <div class="header-inner">
    <a class="site-brand" href="/">${escapeHtml(chrome.siteName)}</a>
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
  ${page.includeDemoWidget ? renderDemoWidget(page.slug.replace(/[^a-z0-9]/gi, "") || "home") : ""}
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
      <ul>${chrome.footerGuides.map((l) => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>
    </div>
    <div>
      <h3>Legal &amp; safety</h3>
      <ul>${chrome.footerLegal.map((l) => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>
    </div>
    <div>
      <h3>Play responsibly</h3>
      <p style="font-size:0.85rem;color:#c7cad6;">18+. Gambling can be addictive. Free confidential support: <a href="https://www.begambleaware.org" rel="noopener" target="_blank">BeGambleAware</a> &middot; <a href="https://www.gamcare.org.uk" rel="noopener" target="_blank">GamCare</a> &middot; <a href="https://www.gamstop.co.uk" rel="noopener" target="_blank">GAMSTOP</a>.</p>
    </div>
  </div>
  <div class="footer-bottom">&copy; ${new Date().getFullYear()} ${escapeHtml(chrome.siteName)}. Independent information site - not a gambling operator. Domain shown is a placeholder pending registration: ${escapeHtml(chrome.domain)}.</div>
</footer>
<div class="cookie-banner" data-cookie-banner>
  <p>We use essential and (with your consent) analytics cookies. See our <a href="/privacy-cookie-policy/">Privacy &amp; Cookie Policy</a>.</p>
  <div>
    <button type="button" data-cookie-reject style="background:#3a3f52;">Reject non-essential</button>
    <button type="button" data-cookie-accept>Accept</button>
  </div>
</div>
<script src="/assets/js/cookie-consent.js"></script>
${page.includeDemoWidget ? `<script src="/assets/js/plinko-demo.js"></script>` : ""}
</body>
</html>
`;
}
