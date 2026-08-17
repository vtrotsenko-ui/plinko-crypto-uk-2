# 1win Argentina SEO site

English-language, SEO-optimised static site targeting the primary keyword **1win** for Argentina, plus the clustering/content/compliance pipeline.

## Quick start (host-ready zip)

```bash
npm ci
npm run build
```

Output:

- `sites/1win-argentina/` — open `index.html` locally or upload the folder to hosting
- `1win-argentina-site.zip` — same site as a single archive

## Pipeline

1. `npm run cluster` — hard clustering (SERP API or lexical fallback), writes `data/clusters.csv` + `data/orphans.csv`
2. `npm run assign-clusters` — maps clusters to the single site in `data/sites.yaml` → `data/sitemap-plan.json`
3. `npm run generate-1win-content` — long-form English pages (≥1200 words on home/landings)
4. `npm run build-sites` — static HTML with relative links (works from disk)
5. `npm run compliance-check` + `npm run validate-schema` — CI gates

## Compliance notes

- Partner links use `rel="sponsored nofollow"` and must stay on the affiliate domain whitelist
- 18+, BeGambleAware, GamCare, and offer T&C reminders on commercial pages
- 1win is treated as an international operator (`skip_ukgc_check`) — this site does not claim a UKGC licence for 1win
