/**
 * Inline SVG infographic builders for the 1win Argentina guide.
 */

export function productAreaDiagram(): string {
  const areas = [
    { label: "Sports", x: 40, color: "#0b8f6a" },
    { label: "Casino", x: 170, color: "#1a6f9a" },
    { label: "Live", x: 300, color: "#2f5f8a" },
    { label: "Crash", x: 430, color: "#c45c26" },
  ];
  const blocks = areas
    .map(
      (a) => `
      <rect x="${a.x}" y="48" width="100" height="70" rx="10" fill="${a.color}" />
      <text x="${a.x + 50}" y="90" text-anchor="middle" font-size="16" fill="#ffffff" font-family="DM Sans, sans-serif">${a.label}</text>`
    )
    .join("");
  return `<svg viewBox="0 0 560 160" role="img" aria-label="Infographic of typical 1win product areas: Sports, Casino, Live and Crash" xmlns="http://www.w3.org/2000/svg">
    <rect width="560" height="160" fill="#eef4f8" rx="12" />
    <text x="28" y="30" font-size="15" fill="#1f2a37" font-family="DM Sans, sans-serif">Typical product areas inside one account</text>
    ${blocks}
  </svg>`;
}

export function evaluationChecklistDiagram(): string {
  const steps = ["Domain", "Age 18+", "Cashier", "Limits", "Terms"];
  const nodes = steps
    .map((label, i) => {
      const x = 36 + i * 105;
      return `
      <circle cx="${x + 30}" cy="70" r="26" fill="#0b8f6a" />
      <text x="${x + 30}" y="75" text-anchor="middle" font-size="13" fill="#fff" font-family="DM Sans, sans-serif">${i + 1}</text>
      <text x="${x + 30}" y="120" text-anchor="middle" font-size="13" fill="#1f2a37" font-family="DM Sans, sans-serif">${label}</text>
      ${i < steps.length - 1 ? `<line x1="${x + 58}" y1="70" x2="${x + 105}" y2="70" stroke="#9bb6c7" stroke-width="3" />` : ""}`;
    })
    .join("");
  return `<svg viewBox="0 0 560 150" role="img" aria-label="Five-step evaluation checklist before depositing" xmlns="http://www.w3.org/2000/svg">
    <rect width="560" height="150" fill="#f3f7fa" rx="12" />
    <text x="28" y="28" font-size="15" fill="#1f2a37" font-family="DM Sans, sans-serif">Calm evaluation sequence</text>
    ${nodes}
  </svg>`;
}

/** Brand mark fallback if the official SVG logo is unavailable. */
export function brandLogoSvg(accentColor: string, accentDark: string): string {
  return `<svg viewBox="0 0 120 40" role="img" aria-label="1win logo" xmlns="http://www.w3.org/2000/svg">
    <rect width="120" height="40" rx="8" fill="${accentDark}" />
    <text x="60" y="27" text-anchor="middle" font-size="22" font-weight="700" fill="${accentColor}" font-family="Syne, DM Sans, sans-serif">1win</text>
  </svg>`;
}

export function riskLevelDiagram(): string {
  return productAreaDiagram();
}

export function oddsBarChart(): string {
  return evaluationChecklistDiagram();
}
