/**
 * Shared compliance constants/snippets used by generate-content.ts and
 * compliance-check.ts.
 */

export const BANNED_PHRASES: string[] = [
  "guaranteed",
  "guarantee win",
  "risk-free",
  "risk free",
  "easy money",
  "beat the system",
  "can't lose",
  "cannot lose",
  "sure win",
  "surefire",
];

export const UNDER_18_ADDRESS_PATTERNS: RegExp[] = [
  /\bkids?\b.{0,20}\bplay\b/i,
  /\bchildren\b.{0,20}\b(play|bet|gamble)\b/i,
  /\bteen(ager)?s?\b.{0,20}\b(play|bet|gamble)\b/i,
  /\bunder\s?-?\s?18s?\b.{0,20}\b(play|bet|gamble|welcome)\b/i,
];

export function responsibleGamblingHtml(siteName: string): string {
  return `
  <div class="rg-block" data-testid="responsible-gambling-block">
    <p><strong>18+.</strong> Casino games, sports betting and crash titles discussed on this site are intended for adults aged 18 and over only. Gambling can be addictive - please play responsibly and never stake more than you can afford to lose.</p>
    <ul>
      <li>International support information: <a href="https://www.begambleaware.org" rel="noopener" target="_blank">BeGambleAware</a>.</li>
      <li>Advice and treatment resources: <a href="https://www.gamcare.org.uk" rel="noopener" target="_blank">GamCare</a>.</li>
      <li>If you are in Argentina, also look for locally available counselling and helpline resources through public health channels, and use any deposit/loss/time limits the operator provides.</li>
    </ul>
    <p>${siteName} publishes informational reviews and checklists. We do not invent licence numbers or claim UK Gambling Commission status for operators without verification in <code>data/casinos/</code>. Nothing on this site is financial or gambling advice, and no outcome is promised.</p>
  </div>`;
}

export function affiliateDisclosureHtml(): string {
  return `<p class="affiliate-disclosure">Some links on this page are marked as partner links. If you follow one and sign up with an operator, we may earn a commission at no extra cost to you. This never affects which operators we cover or how we describe them - see our <a href="/about-us/">About Us</a> page for our editorial policy.</p>`;
}
