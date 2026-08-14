/**
 * Tiny inline-SVG infographic builders used by generate-content.ts.
 * Deliberately dependency-free (hand-built path/rect math) so the output
 * HTML has zero external image requests for these two diagrams.
 */

export function riskLevelDiagram(): string {
  const rows: { label: string; width: number; color: string }[] = [
    { label: "Low risk - narrow multiplier spread", width: 120, color: "#2f7d5f" },
    { label: "Medium risk - moderate spread", width: 210, color: "#b8860b" },
    { label: "High risk - widest spread", width: 320, color: "#a83232" },
  ];
  const barHeight = 28;
  const gap = 16;
  const height = rows.length * (barHeight + gap) + gap;
  const bars = rows
    .map((row, i) => {
      const y = gap + i * (barHeight + gap);
      return `
      <rect x="160" y="${y}" width="${row.width}" height="${barHeight}" rx="6" fill="${row.color}" />
      <text x="150" y="${y + barHeight / 2 + 5}" text-anchor="end" font-size="14" fill="#1f2430">${row.label.split(" - ")[0]}</text>
      <text x="${170 + row.width}" y="${y + barHeight / 2 + 5}" font-size="12" fill="#4a5060">${row.label.split(" - ")[1]}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 560 ${height}" role="img" aria-label="Diagram comparing Low, Medium and High Plinko risk settings by multiplier spread" xmlns="http://www.w3.org/2000/svg">
    <rect width="560" height="${height}" fill="#f7f5ef" rx="10" />
    ${bars}
  </svg>`;
}

/** Compact brand mark: a rounded badge with a small triangle of "pegs" and
 * one highlighted "ball" - echoes the Plinko board theme, used inline in
 * the header (no extra HTTP request) and written to each site's
 * assets/images/logo.svg for the favicon and Organization.logo. */
export function brandLogoSvg(accentColor: string, accentDark: string): string {
  return `<svg viewBox="0 0 40 40" role="img" aria-label="Site logo" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="${accentDark}" />
    <circle cx="20" cy="12" r="3" fill="#f5f2e8" />
    <circle cx="13" cy="21" r="3" fill="#f5f2e8" />
    <circle cx="27" cy="21" r="3" fill="#f5f2e8" />
    <circle cx="20" cy="30" r="4" fill="${accentColor}" stroke="#f5f2e8" stroke-width="1.5" />
  </svg>`;
}

export function oddsBarChart(rows: number[] = [8, 12, 16]): string {
  const width = 560;
  const height = 220;
  const barWidth = 90;
  const gap = (width - rows.length * barWidth) / (rows.length + 1);
  const maxSlots = Math.max(...rows.map((r) => r + 1));
  const bars = rows
    .map((r, i) => {
      const slots = r + 1;
      const barHeight = (slots / maxSlots) * 140;
      const x = gap + i * (barWidth + gap);
      const y = 170 - barHeight;
      return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="#3a5a9b" />
      <text x="${x + barWidth / 2}" y="190" text-anchor="middle" font-size="13" fill="#1f2430">${r} rows</text>
      <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="12" fill="#4a5060">${slots} slots</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Chart showing how the number of Plinko rows increases the number of landing slots" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#f7f5ef" rx="10" />
    ${bars}
    <line x1="30" y1="170" x2="${width - 30}" y2="170" stroke="#c9c4b4" stroke-width="1" />
  </svg>`;
}
