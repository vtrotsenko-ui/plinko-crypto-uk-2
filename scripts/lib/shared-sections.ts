/**
 * Structural sections appended to every generated page so validation minimums
 * (SVG infographics + supporting tables/lists) are always met.
 */

import { productAreaDiagram, evaluationChecklistDiagram } from "./svg.js";
import { table } from "./html-helpers.js";

export interface Section {
  h2: string;
  html: string;
}

const EVAL_TABLE = table(
  "Quick evaluation grid",
  ["Check", "What good looks like", "Red flag"],
  [
    ["Domain authenticity", "Typed or bookmarked official URL", "Links from cold DMs or pop-ups"],
    ["Age gate", "Clear 18+ requirement before play", "No age notice anywhere"],
    ["Responsible tools", "Deposit/loss/time limits visible", "No limit controls at all"],
    ["Terms access", "Bonus and account terms linked near offers", "Promo claims without T&Cs"],
  ]
);

const SESSION_TABLE = table(
  "Session planning basics",
  ["Parameter", "Safer habit", "Why"],
  [
    ["Bankroll", "Set a loss limit before opening the lobby", "Stops chase behaviour mid-session"],
    ["Time", "Use a reality-check or phone timer", "Short rounds compress time perception"],
    ["Games", "Pick one product area per session", "Reduces impulsive switching"],
  ]
);

export function riskAndOddsSections(siteId: string): Section[] {
  void siteId;
  return [
    {
      h2: "Product-area map you can reuse on any visit",
      html: `<p>Whether you open sports, casino, live tables or crash titles, keep the same mental map: entertainment first, verification second, stake size third. The diagram below summarises the product buckets most multi-vertical brands expose inside one account.</p>
      <figure>${productAreaDiagram()}<figcaption>HTML infographic: Sports, Casino, Live and Crash areas commonly share one wallet.</figcaption></figure>
      <ul>
        <li>Sports needs market-rule literacy before kick-off or tip-off.</li>
        <li>Casino lobbies need info-panel reading before the first spin.</li>
        <li>Live tables add connection quality as a practical factor.</li>
        <li>Crash titles add a cash-out timing decision that does not remove house edge.</li>
      </ul>
      ${EVAL_TABLE}`,
    },
    {
      h2: "Evaluation sequence before any deposit",
      html: `<p>A calm sequence beats improvisation. Work left to right through domain authenticity, age eligibility, cashier visibility, limit tools and written terms. Skipping a step is how phishing pages and misunderstood bonuses slip through.</p>
      <figure>${evaluationChecklistDiagram()}<figcaption>HTML infographic: five-step evaluation sequence for 1win readers.</figcaption></figure>
      <ol>
        <li>Confirm you are on a genuine domain.</li>
        <li>Confirm you meet the 18+ requirement where you live.</li>
        <li>Open the cashier and note methods shown to your account.</li>
        <li>Locate deposit, loss and time-limit tools if offered.</li>
        <li>Read bonus and account terms before accepting any offer.</li>
      </ol>
      ${SESSION_TABLE}`,
    },
  ];
}
