/**
 * Content for the 5 mandatory trust pages that ship on every site:
 * About Us, Privacy & Cookie Policy, Terms of Service, "is Plinko legal in
 * the UK" (K7) and Responsible Gambling (K10).
 *
 * About Us and the K7 legality page are written per-site (genuinely
 * different framing tied to each site's positioning). Privacy, Terms and
 * Responsible Gambling intentionally share most of their body copy across
 * the portfolio - that mirrors how a real multi-site publisher operates
 * (one legal/safety baseline, applied consistently) and keeps
 * safety-critical wording (the RG resources) standardised rather than
 * needlessly reworded per site. Only the intro paragraph varies per site.
 * scripts/generate-content.ts scopes the cross-site similarity check
 * accordingly (hard-fail on home/landing pages, warn-only on trust pages).
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

const IMAGE_BY_SITE: Record<string, string> = {
  "plinko-game-guide-uk": "hero-plinko-board.jpg",
  "plinko-casino-hub-uk": "hero-casino-comparison.jpg",
  "plinko-strategy-lab-uk": "plinko-odds-diagram-photo.jpg",
  "crypto-plinko-uk": "hero-crypto-plinko.jpg",
  "plinko-app-hub-uk": "hero-plinko-mobile-app.jpg",
};

// ---------------------------------------------------------------------------
// About Us - fully unique per site
// ---------------------------------------------------------------------------

const ABOUT_US: Record<string, CorePage> = {
  "plinko-game-guide-uk": {
    title: "About Us | Plinko Guide UK",
    metaDescription:
      "About Plinko Guide UK: a plain-English, beginner-first resource explaining how Plinko works, written and edited for a UK audience.",
    h1: "About Plinko Guide UK",
    sections: [
      {
        h2: "Our purpose",
        html: `<p>Plinko Guide UK exists for one reason: most explanations of the Plinko game mechanic online are either marketing copy or overly technical. We write for someone who has never seen a Plinko board before and wants to understand it - rules, settings and fairness - before they ever consider playing for money.</p>`,
      },
      {
        h2: "Our editorial approach",
        html: ul([
          "We describe mechanics that are common across Plinko implementations generally; we do not invent or estimate figures (RTP, house edge) for a specific provider unless that provider has published them.",
          "We link to demo modes and free-play options wherever possible so readers can learn before spending anything.",
          "We do not use language that implies guaranteed outcomes, and every page includes responsible gambling information.",
        ]),
      },
      {
        h2: "Who writes and reviews our content",
        html: `<p>Our editorial team is UK-based, with backgrounds in games writing and consumer-facing casino content. Pages covering gambling law or player-safety topics are cross-checked against current Gambling Commission and GamCare/BeGambleAware public guidance at the time of writing. We update pages when rules or our own understanding changes.</p>`,
      },
      {
        h2: "Contact and corrections",
        html: `<p>Spotted something inaccurate or out of date? We'd rather fix it than leave it. Reach the editorial team via the contact details on our parent listing, or via the enquiry channel linked in this site's footer once live.</p>
        ${table("About Plinko Guide UK at a glance", ["", ""], [
          ["Focus", "Beginner-first Plinko mechanics and rules"],
          ["Operator listings", "None yet - see homepage for our verification policy"],
          ["Content sourcing", "Generic mechanics only, no invented provider figures"],
        ])}`,
      },
    ],
    faq: [
      { question: "Does Plinko Guide UK accept payment to review specific casinos?", answer: "We currently do not publish paid or sponsored operator reviews on this site; see our homepage for our stance on operator listings." },
      { question: "Is this a gambling operator?", answer: "No - Plinko Guide UK is an independent information site. We do not accept deposits, run games, or process payments ourselves." },
    ],
    images: [{ filename: IMAGE_BY_SITE["plinko-game-guide-uk"], alt: "Plinko Guide UK editorial team illustration" }],
  },

  "plinko-casino-hub-uk": {
    title: "About Us | Plinko Casino Hub UK",
    metaDescription:
      "About Plinko Casino Hub UK: our licensing-first methodology for comparing Plinko-offering casino sites, and why we don't yet list specific operators.",
    h1: "About Plinko Casino Hub UK",
    sections: [
      {
        h2: "Why this hub exists",
        html: `<p>Plinko Casino Hub UK was built to flip the usual "best sites" format: instead of leading with bonus size, we lead with what an operator is legally required to disclose, and only then look at everything else.</p>`,
      },
      {
        h2: "Our listing methodology",
        html: ol([
          "Confirm Active Gambling Commission licence status via the public register.",
          "Confirm responsible-gambling tooling is present and accessible.",
          "Confirm a fairness/RNG disclosure exists for the specific Plinko title offered.",
          "Only then compare secondary factors such as bonus structure and game selection.",
        ]),
      },
      {
        h2: "Why operator listings are pending",
        html: `<p>We do not currently maintain a live, verified feed of licence numbers and bonus terms accurate enough to publish specific operator comparisons responsibly. Publishing stale or unverified terms would be worse than publishing nothing, so our comparison pages describe the methodology and checklist rather than naming operators until that feed exists.</p>`,
      },
      {
        h2: "Affiliate relationships",
        html: `<p>Where this site does link to specific operators in future, those links will be clearly marked as partner links, and will only ever point to operators that have passed our licensing checklist - see our compliance policy for details.</p>
        ${table("About Plinko Casino Hub UK at a glance", ["", ""], [
          ["Focus", "Licensing-first comparison of Plinko-offering sites"],
          ["Operator listings", "Pending a verified licence/bonus data feed"],
          ["Revenue model", "Future partner links only, clearly disclosed"],
        ])}`,
      },
    ],
    faq: [
      { question: "Is Plinko Casino Hub UK independent?", answer: "We are an independent comparison and information resource, not a gambling operator." },
      { question: "How do you choose which sites to eventually list?", answer: "Licence status first, responsible-gambling tooling second, and only then commercial factors - see our methodology above." },
    ],
    images: [{ filename: IMAGE_BY_SITE["plinko-casino-hub-uk"], alt: "Plinko Casino Hub UK editorial methodology illustration" }],
  },

  "plinko-strategy-lab-uk": {
    title: "About Us | Plinko Strategy Lab UK",
    metaDescription:
      "About Plinko Strategy Lab UK: an odds-and-probability-first resource that separates real bankroll management from gambling myths.",
    h1: "About Plinko Strategy Lab UK",
    sections: [
      {
        h2: "Our angle",
        html: `<p>Plinko Strategy Lab UK focuses on the maths: row counts, risk-level distributions and what "house edge" actually means in practice. We built this site because most "strategy" content online sells betting systems that don't hold up against basic probability.</p>`,
      },
      {
        h2: "What we will never publish",
        html: ul([
          "Betting systems presented as beating the house edge.",
          "Claims that a specific drop timing or clicking pattern changes outcomes.",
          "Unsubstantiated RTP or win-rate figures for a named provider we can't verify.",
        ]),
      },
      {
        h2: "Our sourcing standard",
        html: `<p>Where we describe general mechanics (row/slot counts, risk-level effects), we describe patterns common to the mechanic itself, not a specific provider's disclosed numbers, unless we can link to that provider's own published figures.</p>`,
      },
      {
        h2: "Get in touch",
        html: `<p>If you think a page overstates what a strategy can achieve, tell us - we'd rather correct it than leave a misleading claim live.</p>
        ${table("About Plinko Strategy Lab UK at a glance", ["", ""], [
          ["Focus", "Odds, volatility and bankroll management"],
          ["What we don't sell", "Betting systems or claims of a sure-thing outcome"],
          ["Content sourcing", "General probability, not invented provider RTP figures"],
        ])}`,
      },
    ],
    faq: [
      { question: "Do you sell a Plinko strategy guide or system?", answer: "No - we don't sell betting systems, and we're explicit that no such system beats the underlying house edge." },
      { question: "Are your odds explanations provider-specific?", answer: "No, unless we explicitly cite a named provider's own published paytable - otherwise we describe mechanics common across implementations." },
    ],
    images: [{ filename: IMAGE_BY_SITE["plinko-strategy-lab-uk"], alt: "Plinko Strategy Lab UK odds and probability illustration" }],
  },

  "crypto-plinko-uk": {
    title: "About Us | Crypto Plinko UK",
    metaDescription:
      "About Crypto Plinko UK: an educational resource on crypto-funded Plinko mechanics and UK licensing rules, not a promotion of unlicensed platforms.",
    h1: "About Crypto Plinko UK",
    sections: [
      {
        h2: "Why we cover this topic carefully",
        html: `<p>Crypto Plinko UK exists to explain how crypto-funded Plinko games work and what UK licensing law actually requires - not to promote any specific unlicensed platform. Many popular crypto-only casino brands do not hold a Gambling Commission licence, and we say so directly rather than glossing over it.</p>`,
      },
      {
        h2: "Our editorial red line",
        html: ul([
          "We do not name, link to, or promote operators without a Gambling Commission licence for Great Britain.",
          "We explain provably-fair verification as a technical concept, not as proof that a specific platform is safe or legal to use.",
          "Every page on this site links to UK licensing checks and free responsible-gambling support.",
        ]),
      },
      {
        h2: "Who this site is for",
        html: `<p>Readers researching how crypto gambling mechanics work, checking whether a platform is properly licensed, or looking for the UK legal and tax picture before making any decisions.</p>`,
      },
      {
        h2: "Corrections and updates",
        html: `<p>Licensing status and regulation in this space can change. If you spot outdated information, particularly on our legal notes pages, please flag it so we can correct it promptly.</p>
        ${table("About Crypto Plinko UK at a glance", ["", ""], [
          ["Focus", "Crypto-funded Plinko mechanics and UK legal notes"],
          ["Editorial red line", "No unlicensed operators named or linked"],
          ["Content sourcing", "Public regulatory guidance, not legal advice"],
        ])}`,
      },
    ],
    faq: [
      { question: "Does Crypto Plinko UK promote unlicensed casinos?", answer: "No - we explicitly do not name or link to operators without a current Gambling Commission licence for Great Britain." },
      { question: "Is this site itself a crypto casino?", answer: "No - Crypto Plinko UK is an independent information resource. We do not accept deposits or run games." },
    ],
    images: [{ filename: IMAGE_BY_SITE["crypto-plinko-uk"], alt: "Crypto Plinko UK editorial policy illustration" }],
  },

  "plinko-app-hub-uk": {
    title: "About Us | Plinko App Hub UK",
    metaDescription:
      "About Plinko App Hub UK: how we test and evaluate Plinko mobile apps for licensing, disclosures and genuine red flags.",
    h1: "About Plinko App Hub UK",
    sections: [
      {
        h2: "What we actually check",
        html: `<p>Plinko App Hub UK looks at Plinko-related mobile apps through one lens above all others: is there a licensed operator standing behind any real-money claim? App store ratings and download counts don't answer that question, so we don't lead with them.</p>`,
      },
      {
        h2: "Our review checklist",
        html: table(
          "What we check on every app we cover",
          ["Check", "Why"],
          [
            ["Named operator + licence lookup", "Confirms legal right to offer real-money play to GB users"],
            ["In-app fairness disclosure", "Confirms RNG certification or equivalent"],
            ["Review pattern analysis", "Surfaces recurring withdrawal or account complaints"],
          ]
        ),
      },
      {
        h2: "What we won't do",
        html: `<p>We won't rank an app as trustworthy purely on design polish, star rating, or marketing screenshots showing large wins - none of those confirm licensing or fairness.</p>
        ${ul([
          "We won't rely on star ratings alone to judge trustworthiness.",
          "We won't treat marketing screenshots as evidence of typical outcomes.",
          "We won't skip the licence-lookup step, even for well-reviewed apps.",
        ])}`,
      },
      {
        h2: "Contact us",
        html: `<p>If you've had a specific issue with an app we've written about, let us know - real user reports inform how carefully we flag an app going forward.</p>`,
      },
    ],
    faq: [
      { question: "Do you test every Plinko app in the app stores?", answer: "We prioritise apps that are widely searched for or reported on, using the licensing-first checklist above." },
      { question: "Are you affiliated with any app developer?", answer: "No developer relationship changes how we apply our licensing checklist." },
    ],
    images: [{ filename: IMAGE_BY_SITE["plinko-app-hub-uk"], alt: "Plinko App Hub UK review methodology illustration" }],
  },
};

// ---------------------------------------------------------------------------
// K7: "is Plinko legal in the UK" - per-site framing on shared legal facts
// ---------------------------------------------------------------------------

const LEGALITY_INTRO: Record<string, string> = {
  "plinko-game-guide-uk":
    "You've learned how the Plinko game works - the next natural question is whether playing it for real money is legal in the UK, and under what conditions.",
  "plinko-casino-hub-uk":
    "Before comparing any Plinko site, it's worth understanding exactly what UK gambling law requires of the operators behind them.",
  "plinko-strategy-lab-uk":
    "Understanding the odds only matters once you know whether, and how, real-money Plinko play is legally available to you in the UK.",
  "crypto-plinko-uk":
    "This is the single most important page on this site if you're considering crypto-funded Plinko: most crypto-only casinos fall outside UK licensing entirely.",
  "plinko-app-hub-uk":
    "Before trusting any app's real-money claims, it helps to understand the licensing law those claims are supposed to comply with.",
};

function legalityPage(site: SiteInfo): CorePage {
  return {
    title: `Is Plinko Legal in the UK? | ${site.name}`,
    metaDescription:
      "Is Plinko legal in the UK? Yes, when offered by a Gambling Commission-licensed operator to adults 18+. Here's how UK gambling licensing actually works.",
    h1: "Is Plinko legal in the UK?",
    sections: [
      {
        h2: "The short answer",
        html: `<p>${LEGALITY_INTRO[site.id]} Playing Plinko for real money is legal in Great Britain when it's offered by an operator holding a current Gambling Commission licence, to players aged 18 or over.</p>`,
      },
      {
        h2: "How UK gambling licensing works",
        html: table(
          "The UK licensing framework, briefly",
          ["Element", "What it means"],
          [
            ["Gambling Act 2005", "The primary legislation governing commercial gambling in Great Britain"],
            ["Gambling Commission (UKGC)", "The regulator that issues and enforces operator licences"],
            ["Licence conditions", "Require certified RNGs, responsible-gambling tools, ADR access and age verification"],
            ["Minimum age", "18, strictly enforced through identity verification at signup"],
          ]
        ),
      },
      {
        h2: "How to check a specific operator",
        html: ol([
          "Go to the Gambling Commission's public register.",
          "Search the operator's registered name (not just a brand name - check the footer for the licensed entity).",
          "Confirm the licence status shows as Active, not suspended, lapsed or revoked.",
          "If in doubt, treat the operator as unverified rather than assuming legality.",
        ]),
      },
      {
        h2: "What isn't automatically legal",
        html: ul([
          "Operators with no GB licence advertising directly to UK consumers.",
          "Platforms only licensed in jurisdictions that don't meet UKGC equivalence standards.",
          "Any site that doesn't perform age verification at signup.",
        ]),
      },
    ],
    faq: [
      { question: "Is Plinko legal in the UK?", answer: "Yes, when offered by a Gambling Commission-licensed operator to players aged 18+." },
      { question: "Is playing on an unlicensed site illegal for the player?", answer: "The licensing obligation sits with the operator, but playing on an unlicensed site removes all UK consumer protections, so we don't recommend it." },
      { question: "How do I check if an operator is currently licensed?", answer: "Search their registered name on the Gambling Commission's public register and confirm an Active status." },
    ],
    images: [{ filename: IMAGE_BY_SITE[site.id], alt: `UK gambling licensing illustration on ${site.name}` }],
  };
}

// ---------------------------------------------------------------------------
// K10: Responsible Gambling - shared safety content, per-site intro only
// ---------------------------------------------------------------------------

const RG_INTRO: Record<string, string> = {
  "plinko-game-guide-uk": "Learning how Plinko works is only half the picture - knowing your own limits matters just as much.",
  "plinko-casino-hub-uk": "Every site we'd ever consider listing has to make this information easy to find. Here it is on ours, unconditionally.",
  "plinko-strategy-lab-uk": "No strategy page on this site is complete without this one - bankroll management starts with knowing when to stop.",
  "crypto-plinko-uk": "Crypto-funded platforms don't always make support resources easy to find. We put ours front and centre.",
  "plinko-app-hub-uk": "A legitimate app should surface this information easily in-app. This page is our own, unconditional version.",
};

function responsibleGamblingPage(site: SiteInfo): CorePage {
  return {
    title: `Responsible Gambling | ${site.name}`,
    metaDescription:
      "Responsible gambling support for UK players: free help from BeGambleAware and GamCare, self-exclusion via GAMSTOP, and a quick self-assessment.",
    h1: "Responsible gambling",
    sections: [
      {
        h2: "Our commitment",
        html: `<p>${RG_INTRO[site.id]} This page is not a formality - it's here because gambling can become harmful, and free, confidential help exists.</p>`,
      },
      {
        h2: "A quick self-assessment",
        html: ul([
          "Have you tried to cut back on gambling and found it difficult?",
          "Have you gambled to escape a low mood, or to try to win back previous losses?",
          "Has gambling caused arguments with family or friends, or affected work or study?",
          "Have you borrowed money or sold anything to fund gambling?",
        ]),
      },
      {
        h2: "If any of that sounds familiar",
        html: `<p>Answering yes to any of the above is a reason to reach out for free, confidential support - not a personal failing to hide. The following organisations exist specifically to help:</p>${responsibleGamblingHtml(site.name)}`,
      },
      {
        h2: "Practical tools that help",
        html: table(
          "Player-protection tools worth using",
          ["Tool", "What it does"],
          [
            ["Deposit limits", "Cap how much you can add to your account in a day, week or month"],
            ["Loss/session time limits", "Cap losses or session length, set in your account settings"],
            ["Self-exclusion (GAMSTOP)", "Blocks your access across all UK-licensed gambling sites and apps at once"],
            ["Reality checks", "Pop-up reminders of session length and spend"],
          ]
        ),
      },
    ],
    faq: [
      { question: "What is the National Gambling Helpline number?", answer: "0808 8020 133, free and available 24/7 in the UK." },
      { question: "How does GAMSTOP self-exclusion work?", answer: "GAMSTOP lets you self-exclude from all UK-licensed online gambling sites and apps in one registration, for a period you choose." },
      { question: "Is help really free and confidential?", answer: "Yes - BeGambleAware and GamCare both offer free, confidential support with no obligation." },
    ],
    images: [{ filename: "responsible-gambling-icon.jpg", alt: `Responsible gambling support resources on ${site.name}` }],
  };
}

// ---------------------------------------------------------------------------
// Privacy & Cookie Policy - shared template, per-site intro
// ---------------------------------------------------------------------------

const PRIVACY_INTRO: Record<string, string> = {
  "plinko-game-guide-uk": "This policy explains, in plain terms, what happens with your data when you read Plinko Guide UK.",
  "plinko-casino-hub-uk": "This policy covers your data when you use Plinko Casino Hub UK to research and compare Plinko sites.",
  "plinko-strategy-lab-uk": "This policy covers your data when you use Plinko Strategy Lab UK's odds and strategy content.",
  "crypto-plinko-uk": "This policy covers your data when you use Crypto Plinko UK, including anonymised analytics of which guides are most read.",
  "plinko-app-hub-uk": "This policy covers your data when you use Plinko App Hub UK to research mobile Plinko apps.",
};

function privacyPolicyPage(site: SiteInfo): CorePage {
  return {
    title: `Privacy & Cookie Policy | ${site.name}`,
    metaDescription:
      "Privacy and cookie policy: what data we collect, why, your UK GDPR rights, and how to manage cookie preferences on this site.",
    h1: "Privacy & Cookie Policy",
    sections: [
      {
        h2: "Introduction",
        html: `<p>${PRIVACY_INTRO[site.id]} We aim to collect the minimum data needed to run the site and to be transparent about what that is.</p>
        <p><em>Template notice: the placeholders below (data controller, contact address, exact analytics/advertising vendors) must be completed with this site's real operating details before launch - see data/casinos/README.md style guidance in the source repository for the same "don't invent, verify before publishing" principle applied to legal contact details.</em></p>`,
      },
      {
        h2: "What we collect",
        html: table(
          "Data categories",
          ["Category", "Purpose", "Legal basis"],
          [
            ["Usage analytics (pages viewed, approximate location, device type)", "Understand what content is useful, fix broken pages", "Legitimate interests / consent for non-essential cookies"],
            ["Cookie preferences", "Remember your consent choices", "Necessary for site function"],
            ["Contact details, if you email us", "Respond to your enquiry", "Legitimate interests"],
          ]
        ),
      },
      {
        h2: "Cookie categories used on this site",
        html: ul([
          "<strong>Strictly necessary</strong> - required for basic site function; cannot be disabled.",
          "<strong>Analytics</strong> - helps us understand aggregate usage; requires your consent.",
          "<strong>Advertising/affiliate tracking</strong> - attributes partner-link referrals; requires your consent.",
        ]),
      },
      {
        h2: "Your rights under UK GDPR",
        html: ol([
          "Access the personal data we hold about you.",
          "Ask us to correct inaccurate data.",
          "Ask us to delete data we no longer have a lawful basis to keep.",
          "Object to processing based on legitimate interests, including analytics.",
          "Complain to the Information Commissioner's Office (ICO) if you believe your rights haven't been respected.",
        ]),
      },
      {
        h2: "How to manage cookies",
        html: `<p>Use the cookie consent banner on first visit, or your browser's cookie settings, to accept or reject non-essential cookies at any time.</p>`,
      },
      {
        h2: "Contact",
        html: `<p>Data protection queries: [insert real contact email/address before publishing]. This is a template document - have it reviewed against this site's actual data practices before it goes live.</p>`,
      },
    ],
    faq: [
      { question: "Do you sell my personal data?", answer: "No - this template does not provide for the sale of personal data to third parties." },
      { question: "Can I opt out of analytics cookies?", answer: "Yes, via the cookie consent banner or your browser settings, at any time." },
      { question: "Who do I contact about a data request?", answer: "Use the contact details in this policy once completed with this site's real operating details." },
    ],
    images: [{ filename: IMAGE_BY_SITE[site.id], alt: `Privacy and cookie policy illustration for ${site.name}` }],
  };
}

// ---------------------------------------------------------------------------
// Terms of Service - shared template, per-site intro
// ---------------------------------------------------------------------------

const TERMS_INTRO: Record<string, string> = {
  "plinko-game-guide-uk": "These terms cover your use of Plinko Guide UK's informational content.",
  "plinko-casino-hub-uk": "These terms cover your use of Plinko Casino Hub UK's comparison and checklist content.",
  "plinko-strategy-lab-uk": "These terms cover your use of Plinko Strategy Lab UK's odds and strategy content.",
  "crypto-plinko-uk": "These terms cover your use of Crypto Plinko UK's educational content on crypto-funded gambling mechanics.",
  "plinko-app-hub-uk": "These terms cover your use of Plinko App Hub UK's app-review content.",
};

function termsOfServicePage(site: SiteInfo): CorePage {
  return {
    title: `Terms of Service | ${site.name}`,
    metaDescription:
      "Terms of service: acceptable use of this site, our content and affiliate-link disclosure, disclaimers, and governing law.",
    h1: "Terms of Service",
    sections: [
      {
        h2: "Acceptance of terms",
        html: `<p>${TERMS_INTRO[site.id]} By using ${site.domain}, you agree to these terms. If you don't agree, please don't use the site.</p>`,
      },
      {
        h2: "What this site is - and isn't",
        html: table(
          "Scope of service",
          ["This site is", "This site is not"],
          [
            ["An independent information/comparison resource", "A gambling operator - we don't accept deposits or run games"],
            ["A publisher of educational and review content", "A source of financial, legal or tax advice"],
            ["18+ appropriate content about a regulated activity", "Suitable for, or targeted at, anyone under 18"],
          ]
        ),
      },
      {
        h2: "Acceptable use",
        html: ul([
          "You may read, share and link to our content for personal, non-commercial use.",
          "You may not scrape, republish or resell our content without permission.",
          "You may not use this site if you are under 18.",
          "You may not use this site to circumvent a self-exclusion you have in place elsewhere.",
        ]),
      },
      {
        h2: "Affiliate links and disclosure",
        html: `<p>Where present, partner/affiliate links are clearly marked. We may earn a commission if you sign up through one, at no extra cost to you - see our About Us page for our full editorial policy on affiliate relationships.</p>`,
      },
      {
        h2: "Disclaimers and liability",
        html: ol([
          "Content is provided for general information only and is not gambling, legal, financial or tax advice.",
          "We make reasonable efforts to keep information accurate but cannot guarantee it is error-free or current at all times.",
          "We are not liable for losses arising from third-party operators' actions, terms changes, or your gambling decisions.",
          "Nothing in these terms limits liability that cannot lawfully be limited (e.g. for fraud).",
        ]),
      },
      {
        h2: "Governing law",
        html: `<p>These terms are governed by the law of England and Wales. This is a template document - have it reviewed by a qualified solicitor and adapted to this site's actual operating entity before publishing.</p>`,
      },
    ],
    faq: [
      { question: "Is this website a gambling operator?", answer: "No - it's an independent information and comparison resource; it does not accept deposits or run games." },
      { question: "Can I reuse this site's content elsewhere?", answer: "Only with permission - see Acceptable Use above." },
      { question: "What law governs these terms?", answer: "The law of England and Wales." },
    ],
    images: [{ filename: IMAGE_BY_SITE[site.id], alt: `Terms of service illustration for ${site.name}` }],
  };
}

export function getTrustPageContent(slug: string, site: SiteInfo): CorePage | null {
  switch (slug) {
    case "/about-us/":
      return ABOUT_US[site.id] ?? null;
    case "/is-plinko-legal-in-the-uk/":
      return legalityPage(site);
    case "/responsible-gambling/":
      return responsibleGamblingPage(site);
    case "/privacy-cookie-policy/":
      return privacyPolicyPage(site);
    case "/terms-of-service/":
      return termsOfServicePage(site);
    default:
      return null;
  }
}
