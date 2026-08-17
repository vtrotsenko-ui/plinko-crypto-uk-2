/**
 * Shared compliance constants/snippets for 1win Argentina content.
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
    <p><strong>18+.</strong> 1win and every other gambling product discussed on this site is intended for adults aged 18 and over only. Gambling can be addictive — please play responsibly and never stake more than you can afford to lose.</p>
    <ul>
      <li>Independent information: <a href="https://www.begambleaware.org" rel="nofollow noopener" target="_blank">BeGambleAware</a>.</li>
      <li>Advice and treatment: <a href="https://www.gamcare.org.uk" rel="nofollow noopener" target="_blank">GamCare</a>.</li>
    </ul>
    <p>${siteName} uses clearly marked partner links. Nothing on this site is financial advice, and no outcome is promised.</p>
  </div>`;
}

export function affiliateDisclosureHtml(): string {
  return `<p class="affiliate-disclosure">Some links on this page are partner links. If you follow one and sign up with an operator, we may earn a commission at no extra cost to you. See our <a href="/about-us/">About Us</a> page for editorial policy.</p>`;
}
