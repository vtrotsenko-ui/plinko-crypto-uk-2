export function table(caption: string, headers: string[], rows: string[][]): string {
  const thead = `<tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  return `<table><caption>${caption}</caption><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

export function ul(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

export function ol(items: string[]): string {
  return `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
}
