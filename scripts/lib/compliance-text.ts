/**
 * Shared compliance constants/snippets used by both scripts/generate-content.ts
 * (to inject the mandatory blocks) and scripts/compliance-check.ts (to verify
 * they're present and that nothing banned slipped in).
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
    <p><strong>18+.</strong> Plinko and every other casino-style game on this site is intended for adults aged 18 and over only. Gambling can be addictive - please play responsibly and never stake more than you can afford to lose.</p>
    <ul>
      <li>Free help and support: <a href="https://www.begambleaware.org" rel="sponsored nofollow noopener" target="_blank">BeGambleAware</a> or call the National Gambling Helpline on <strong>0808 8020 133</strong> (free, 24/7).</li>
      <li>Advice and treatment: <a href="https://www.gamcare.org.uk" rel="sponsored nofollow noopener" target="_blank">GamCare</a>.</li>
      <li>Self-exclude from all UK-licensed gambling websites and apps at once: <a href="https://www.gamstop.co.uk" rel="sponsored nofollow noopener" target="_blank">GAMSTOP</a>.</li>
    </ul>
    <p>${siteName} does not accept advertising from, or link to, operators that do not hold a current Gambling Commission licence for Great Britain. Nothing on this site is financial or gambling advice, and no outcome is guaranteed.</p>
  </div>`;
}

export function affiliateDisclosureHtml(): string {
  return `<p class="affiliate-disclosure">Some links on this page are marked as partner links. If you follow one and sign up with an operator, we may earn a commission at no extra cost to you. This never affects which operators we cover or how we describe them - see our <a href="/about-us/">About Us</a> page for our editorial policy.</p>`;
}
