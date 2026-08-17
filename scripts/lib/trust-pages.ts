/**
 * Trust pages for the 1win Argentina English guide:
 * About Us, Privacy & Cookie Policy, Terms of Service, Responsible Gambling.
 * K7 legality content lives in core-pages.ts (/is-1win-legal-in-argentina/).
 */

import { table, ul, ol } from "./html-helpers.js";
import { responsibleGamblingHtml } from "./compliance-text.js";

export interface CorePage {
  title: string;
  metaDescription: string;
  h1: string;
  sections: { h2: string; html: string }[];
  faq: { question: string; answer: string }[];
  images: { filename: string; alt: string }[];
}

export interface SiteInfo {
  id: string;
  name: string;
  domain: string;
  positioning: string;
}

function aboutUs(site: SiteInfo): CorePage {
  return {
    title: "About Us | 1win Argentina Guide",
    metaDescription:
      "About 1win Argentina Guide: English editorial standards, affiliate disclosure, and how we verify claims without inventing licences.",
    h1: "About 1win Argentina Guide",
    sections: [
      {
        h2: "Who we are",
        html: `<p>${site.name} is an English-language informational project for readers exploring 1win in an Argentina-facing context. We explain product areas, mobile access, login hygiene, bonus-code mechanics, crash-style games and legality checklists. We are not the operator, we do not accept player deposits, and we do not process bets.</p>
<img src="/assets/images/hero-1win-overview.png" alt="About 1win Argentina Guide editorial overview image">
<p>Our positioning: ${site.positioning}</p>`,
      },
      {
        h2: "Editorial standards",
        html: ul([
          "We do not invent game-provider lists, RTP figures, or licence numbers.",
          "When a fact is missing from verified data, we say so and ask readers to check the operator site and local rules.",
          "We avoid promotional phrases that promise outcomes.",
          "Every commercial page includes responsible-gambling context and an 18+ notice.",
          "Affiliate relationships, if present, are disclosed near relevant offers or ratings.",
        ]),
      },
      {
        h2: "How we handle affiliate relationships",
        html: `<p>Some outbound links may be partner links marked with <code>rel="sponsored nofollow"</code>. If you register through them, we may earn a commission at no extra cost to you. Commissions never justify inventing compliance claims. Operators listed in <code>data/casinos/</code> must pass the project's verification gate before affiliate URLs are allowed.</p>
${table(
  "Editorial vs commercial roles",
  ["Role", "What we do", "What we do not do"],
  [
    ["Editorial", "Explain products and risks in plain English", "Promise winnings or invent licences"],
    ["Commercial", "Disclose partner links when used", "Hide T&C caveats beside offers"],
    ["Safety", "Point to BeGambleAware / GamCare and local help", "Encourage under-18 play"],
  ]
)}`,
      },
      {
        h2: "Corrections",
        html: `<p>If you spot outdated product descriptions or broken safety links, contact the editorial team via the channel published in the site footer once the domain is live. We prefer a public correction to a quiet silence.</p>
${ol([
  "Describe the page URL and the inaccurate sentence.",
  "Point to a primary source if you have one.",
  "Allow time for verification before expecting a rewrite.",
])}`,
      },
    ],
    faq: [
      {
        question: "Is 1win Argentina Guide the same company as 1win?",
        answer: "No. We are an independent informational site. 1win is a separate operator brand.",
      },
      {
        question: "Do you provide legal advice?",
        answer: "No. Our legality pages are checklists and reading guides, not legal advice for your personal situation.",
      },
    ],
    images: [
      { filename: "hero-1win-overview.png", alt: "About 1win Argentina Guide overview" },
      { filename: "1win-responsible.png", alt: "Responsible standards at 1win Argentina Guide" },
      { filename: "1win-legal-check.png", alt: "Verification habits explained by 1win Argentina Guide" },
    ],
  };
}

function privacy(site: SiteInfo): CorePage {
  return {
    title: "Privacy & Cookie Policy",
    metaDescription:
      "Privacy and cookie policy for 1win Argentina Guide: what limited data a static informational site may process and how cookies are used.",
    h1: "Privacy & Cookie Policy",
    sections: [
      {
        h2: "Scope",
        html: `<p>This policy describes how ${site.name} (${site.domain}) handles information when you browse our static pages. It is written for a general audience and is not a substitute for jurisdiction-specific counsel.</p>
<img src="/assets/images/1win-login-secure.png" alt="Privacy and cookie security illustration for 1win readers">`,
      },
      {
        h2: "What we collect",
        html: ul([
          "Server or CDN logs that may include IP address, user agent, and requested URLs.",
          "Optional cookie-consent preference stored locally in your browser.",
          "Aggregate analytics only if a privacy-respecting analytics tool is later enabled and disclosed here.",
          "Messages you voluntarily send to any published contact address.",
        ]),
      },
      {
        h2: "Cookies",
        html: `<p>Essential cookies (or localStorage keys) may remember that you dismissed the cookie banner. We do not use cookies to build gambling profiles. If marketing cookies are ever added, this page will be updated before they are activated and the banner will offer a clear choice.</p>
${table(
  "Cookie categories",
  ["Category", "Purpose", "Default"],
  [
    ["Essential", "Store consent choice and keep pages functional", "On"],
    ["Analytics", "Understand aggregate traffic if enabled later", "Off until disclosed"],
    ["Marketing", "Not used in the current static build", "Off"],
  ]
)}`,
      },
      {
        h2: "Your choices",
        html: ol([
          "Use browser controls to block or delete cookies.",
          "Avoid submitting personal data in forms that are not present on this static site.",
          "Contact us to request deletion of email correspondence you previously sent.",
        ]),
      },
      {
        h2: "Third parties",
        html: `<p>Outbound links to operators, BeGambleAware, GamCare or other resources are governed by those sites' own policies. Clicking away means their rules apply.</p>`,
      },
    ],
    faq: [
      {
        question: "Do you sell personal data?",
        answer: "No. This informational site does not sell personal data.",
      },
      {
        question: "How long are server logs kept?",
        answer: "Retention depends on the hosting provider configuration; typically logs rotate within weeks unless a security investigation requires longer retention.",
      },
    ],
    images: [
      { filename: "1win-login-secure.png", alt: "Privacy checklist image for 1win Argentina Guide" },
      { filename: "1win-responsible.png", alt: "Responsible data handling note for 1win readers" },
      { filename: "hero-1win-overview.png", alt: "1win Argentina Guide privacy overview graphic" },
    ],
  };
}

function terms(site: SiteInfo): CorePage {
  return {
    title: "Terms of Service",
    metaDescription:
      "Terms of service for 1win Argentina Guide: acceptable use, no warranties on gambling outcomes, and intellectual-property basics.",
    h1: "Terms of Service",
    sections: [
      {
        h2: "Agreement",
        html: `<p>By using ${site.name}, you agree to these terms. If you disagree, please leave the site. Content is informational, written in English, and aimed at adults 18+.</p>
<img src="/assets/images/1win-legal-check.png" alt="Terms of service checklist illustration for 1win guide">`,
      },
      {
        h2: "Acceptable use",
        html: ul([
          "Do not scrape the site in a way that degrades service for others.",
          "Do not misrepresent our pages as the official 1win operator site.",
          "Do not use our content to target or encourage under-18 gambling.",
          "Do not remove affiliate or responsible-gambling disclosures when republishing excerpts with permission.",
        ]),
      },
      {
        h2: "No outcome promises",
        html: `<p>Nothing on this site promises winnings, recovery of losses, or a particular sports/casino result. Gambling involves risk of losing money. Ratings, if shown, are editorial opinions about clarity and tooling - not predictions.</p>
${table(
  "What these terms cover",
  ["Topic", "Summary"],
  [
    ["Information only", "We explain products; we do not operate games"],
    ["Adults only", "18+ audience; no under-age invitations"],
    ["External sites", "Third-party terms apply after you leave"],
    ["Changes", "We may update these terms; the dated page controls"],
  ]
)}`,
      },
      {
        h2: "Intellectual property",
        html: ol([
          "Site copy and original graphics are owned by the publisher unless otherwise noted.",
          "Brand names such as 1win remain the property of their respective owners and are used for identification and commentary.",
          "Do not reuse our logo or layout as if you were the official operator.",
        ]),
      },
      {
        h2: "Limitation of liability",
        html: `<p>To the fullest extent permitted by law, ${site.name} is not liable for losses arising from reliance on informational content, from following outbound links, or from gambling activity on third-party sites. Seek professional advice for legal or financial decisions.</p>`,
      },
    ],
    faq: [
      {
        question: "Can I republish an article?",
        answer: "Contact us for permission. Any approved reuse must keep disclosures and avoid implying operator affiliation.",
      },
      {
        question: "Do these terms cover the 1win casino itself?",
        answer: "No. Operator terms are separate and appear on the operator's own domains.",
      },
    ],
    images: [
      { filename: "1win-legal-check.png", alt: "Terms of service image for 1win Argentina Guide" },
      { filename: "hero-1win-sports.png", alt: "1win product areas referenced in terms context" },
      { filename: "1win-responsible.png", alt: "Responsible use reminder for 1win guide terms" },
    ],
  };
}

function responsibleGambling(site: SiteInfo): CorePage {
  return {
    title: "Responsible Gambling",
    metaDescription:
      "Responsible gambling guidance for 1win Argentina Guide readers: 18+, limits, BeGambleAware, GamCare, and healthier session habits.",
    h1: "Responsible gambling resources and habits",
    sections: [
      {
        h2: "Start with the basics",
        html: `<p>Real-money play is for adults aged 18 and over only. If gambling stops being entertainment, pause and use support tools. This page summarises habits and resources for readers of ${site.name}.</p>
<img src="/assets/images/1win-responsible.png" alt="Responsible gambling resources for 1win Argentina readers">
${responsibleGamblingHtml(site.name)}`,
      },
      {
        h2: "Practical limits",
        html: ul([
          "Set a deposit limit before you feel pressure.",
          "Set a time limit for crash and live sessions that move quickly.",
          "Keep gambling money separate from essential bills.",
          "Do not chase losses after a cold streak.",
          "Take breaks after wins as well as losses.",
        ]),
      },
      {
        h2: "Tools to look for in an operator account",
        html: `${table(
  "Common responsible-gambling tools",
  ["Tool", "What it does", "When to use it"],
  [
    ["Deposit limits", "Caps how much you can add", "Before the first deposit"],
    ["Loss limits", "Caps net losses in a period", "If sessions run long"],
    ["Reality checks", "Periodic time reminders", "For crash and live play"],
    ["Time-outs", "Short cooling-off breaks", "When emotions run high"],
    ["Self-exclusion", "Longer blocks on play", "If control is slipping"],
  ]
)}
${ol([
  "Find the responsible-gambling or account-limits menu.",
  "Set numbers you can afford even if you lose them entirely.",
  "Confirm the limit is active before returning to the lobby.",
])}`,
      },
      {
        h2: "Talking to someone",
        html: `<p>Speaking with a support service is a strength, not a failure. Start with <a href="https://www.begambleaware.org" rel="noopener" target="_blank">BeGambleAware</a> or <a href="https://www.gamcare.org.uk" rel="noopener" target="_blank">GamCare</a>, and seek local Argentina health resources if you are based there. If someone you know is struggling, encourage professional help rather than tip "systems".</p>
<img src="/assets/images/1win-legal-check.png" alt="Responsible gambling checklist graphic for 1win readers">`,
      },
    ],
    faq: [
      {
        question: "Is responsible gambling only for people with a problem?",
        answer: "No. Limits and breaks help every adult keep entertainment in proportion.",
      },
      {
        question: "Does this site accept players under 18?",
        answer: "No. Content about real-money play is for adults 18+ only.",
      },
    ],
    images: [
      { filename: "1win-responsible.png", alt: "Responsible gambling illustration for 1win Argentina" },
      { filename: "1win-legal-check.png", alt: "Support checklist for 1win responsible play" },
      { filename: "hero-1win-overview.png", alt: "1win guide responsible gambling overview" },
    ],
  };
}

export function getTrustPageContent(slug: string, site: SiteInfo): CorePage | null {
  switch (slug) {
    case "/about-us/":
      return aboutUs(site);
    case "/privacy-cookie-policy/":
      return privacy(site);
    case "/terms-of-service/":
      return terms(site);
    case "/responsible-gambling/":
      return responsibleGambling(site);
    default:
      return null;
  }
}
