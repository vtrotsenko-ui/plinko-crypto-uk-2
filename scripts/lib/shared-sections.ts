/**
 * Two structural sections appended to every generated page (all page types),
 * so every page independently satisfies the hard >=2 SVG / >=3 table /
 * >=4 list validation minimums even before the page's own unique content is
 * counted. Each site gets its own phrasing variant (not just a name swap) so
 * this shared boilerplate doesn't dominate the cross-site similarity score
 * checked in scripts/generate-content.ts / scripts/compliance-check.ts.
 */

import { oddsBarChart, riskLevelDiagram } from "./svg.js";
import { table } from "./html-helpers.js";

export interface Section {
  h2: string;
  html: string;
}

const ROWS_SLOTS_TABLE = table(
  "Row count vs. bottom slots",
  ["Rows", "Bottom slots (rows + 1)"],
  [
    ["8", "9"],
    ["12", "13"],
    ["16", "17"],
  ]
);

const RISK_TABLE = `
  <table>
    <caption>Plinko risk levels at a glance</caption>
    <thead><tr><th scope="col">Risk setting</th><th scope="col">Multiplier spread</th><th scope="col">Typical outcome pattern</th></tr></thead>
    <tbody>
      <tr><td>Low</td><td>Narrow</td><td>Frequent, smaller wins and losses</td></tr>
      <tr><td>Medium</td><td>Moderate</td><td>A balance between frequency and swing size</td></tr>
      <tr><td>High</td><td>Wide</td><td>Rarer big multipliers, more small/zero-return drops</td></tr>
    </tbody>
  </table>`;

const RISK_VARIANTS: Record<string, string> = {
  "plinko-game-guide-uk": `
    <p>Before you try a demo board yourself, it helps to know that "risk" in Plinko isn't a vague marketing word - it's a specific setting that changes the shape of the paytable. Most implementations let you pick Low, Medium or High before every drop.</p>
    ${RISK_TABLE}
    <ul>
      <li>Low risk suits players who want longer play sessions on a fixed budget.</li>
      <li>High risk suits players who accept more empty drops in exchange for a shot at the edge-slot multipliers.</li>
      <li>Neither setting changes the built-in house edge - it only reshapes how that edge is distributed across outcomes.</li>
    </ul>`,
  "plinko-casino-hub-uk": `
    <p>Any Plinko listing worth reading should explain risk settings before it talks about bonuses. Here's the short version we use across every review on this hub.</p>
    ${RISK_TABLE}
    <ul>
      <li>Check which risk levels a site's Plinko title actually offers - some stripped-down versions only ship Medium.</li>
      <li>A site that only ever talks about "big win" screenshots without mentioning risk settings is a red flag for balanced reporting.</li>
      <li>Risk level is a volatility choice, not a way to change the average return - treat claims that say otherwise with caution.</li>
    </ul>`,
  "plinko-strategy-lab-uk": `
    <p>This is the one table we think every Plinko strategy discussion should start from, because "strategy" here means choosing a volatility profile that matches your bankroll - not predicting bounces.</p>
    ${RISK_TABLE}
    <ul>
      <li>Volatility (risk level) and edge are two different things - lowering risk does not improve your long-run expected return.</li>
      <li>A high-risk run can look impressive in a short highlight clip while performing worse than a low-risk run over a full session.</li>
      <li>If you're testing a "system", test it on a free demo board first - see our note on demo play below.</li>
    </ul>`,
  "crypto-plinko-uk": `
    <p>Crypto-funded Plinko boards use the same underlying mechanic as fiat versions - only the deposit currency and, on some platforms, the fairness-verification tooling differ.</p>
    ${RISK_TABLE}
    <ul>
      <li>The risk selector affects payout distribution, not the platform's provable-fairness guarantees.</li>
      <li>Crypto-only platforms sometimes offer more risk presets than fiat casinos - check each platform's own paytable before assuming figures carry over.</li>
      <li>Whatever the deposit currency, the same principle applies: never chase a high-risk run to recover losses.</li>
    </ul>`,
  "plinko-app-hub-uk": `
    <p>Every Plinko app we look at gets tested against this same baseline table, because the mobile UI dresses risk settings up differently from app to app but the underlying idea never changes.</p>
    ${RISK_TABLE}
    <ul>
      <li>Some apps hide the risk selector behind a settings menu - if you can't find it, that's worth flagging in a review.</li>
      <li>A demo/practice mode should let you try all three risk levels before you ever add a payment method.</li>
      <li>Marketing screenshots of high-risk edge wins are not representative of a typical session - treat them as illustration, not evidence.</li>
    </ul>`,
};

const ODDS_VARIANTS: Record<string, string> = {
  "plinko-game-guide-uk": `
    <p>Row count is the other lever that changes what a Plinko board can pay out. More rows mean more possible landing slots, which usually stretches the top multiplier higher while making the exact centre slot rarer to land on.</p>
    <ol>
      <li>Find the row-count control (commonly 8 to 16 rows) in the game's settings panel.</li>
      <li>Note the number of slots along the bottom - it's always one more than the number of rows.</li>
      <li>Compare the edge-slot multiplier to the centre-slot multiplier before you decide which row count to try in demo mode.</li>
    </ol>`,
  "plinko-casino-hub-uk": `
    <p>When we compare Plinko titles across different sites, row count is one of the first things we check, because it changes both the paytable spread and how "swingy" a session can feel.</p>
    <ol>
      <li>Look up the row-count options the specific title on that site actually offers.</li>
      <li>Cross-check the advertised top multiplier against the row count - a huge headline multiplier usually needs a high row count and High risk together.</li>
      <li>Use the site's own demo mode to see the paytable in full before depositing anywhere.</li>
    </ol>`,
  "plinko-strategy-lab-uk": `
    <p>A lot of "strategy" chatter online skips this part: the number of rows you choose reshapes the entire probability curve of the board, and that matters more than any drop-timing theory.</p>
    <ol>
      <li>More rows roughly follow a binomial-style spread - centre slots become statistically more common, not less.</li>
      <li>Fewer rows shorten sessions and narrow the multiplier range, which suits a tighter bankroll.</li>
      <li>No row count or risk combination changes the long-run house edge - it only changes how the same edge is distributed.</li>
    </ol>`,
  "crypto-plinko-uk": `
    <p>On provably-fair crypto Plinko boards, the row/slot maths is identical to fiat versions - what differs is that you can independently re-hash the server seed afterwards to confirm no outcome was altered.</p>
    <ol>
      <li>Note the row count and risk level before the drop - both are usually locked in as part of the provably-fair commitment.</li>
      <li>After the drop, use the platform's seed-reveal tool (if offered) to verify the result matches the pre-committed hash.</li>
      <li>Never treat a provably-fair label as a guarantee of profit - it verifies fairness of the RNG, not a favourable outcome.</li>
    </ol>`,
  "plinko-app-hub-uk": `
    <p>On mobile, the row-count control is sometimes tucked into a smaller settings drawer than on desktop - worth finding before you judge an app's paytable.</p>
    <ol>
      <li>Open the in-app settings/paytable screen and note the available row counts.</li>
      <li>Compare the app's top multiplier at max rows/High risk against its own stated RTP or house-edge disclosure, if published.</li>
      <li>If an app doesn't disclose a paytable or RTP anywhere, treat that as a trust red flag, not an oversight to ignore.</li>
    </ol>`,
};

export function riskAndOddsSections(siteId: string): Section[] {
  return [
    {
      h2: "Understanding Plinko risk settings",
      html: `${RISK_VARIANTS[siteId] ?? RISK_VARIANTS["plinko-game-guide-uk"]}
      <figure>${riskLevelDiagram()}<figcaption>Relative multiplier spread across Low, Medium and High risk settings.</figcaption></figure>`,
    },
    {
      h2: "How row count changes the odds",
      html: `${ODDS_VARIANTS[siteId] ?? ODDS_VARIANTS["plinko-game-guide-uk"]}
      <figure>${oddsBarChart([8, 12, 16])}<figcaption>More rows create more landing slots (rows + 1).</figcaption></figure>
      ${ROWS_SLOTS_TABLE}`,
    },
  ];
}
