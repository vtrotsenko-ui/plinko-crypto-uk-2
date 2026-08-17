# 1win Argentina Guide (English SEO site)

Single host-ready static site targeting the primary keyword **1win** for an Argentina geo, with English copy and metadata.

## Deliverable

- `sites/1win-argentina/` — upload this folder to any static host
- `1win-argentina-site.zip` — same site as a zip (open `index.html` locally)
- `dist/1win-argentina/` — mirror used by schema validation

## Pipeline

```bash
npm ci
npm run build
```

Stages:

1. `collect-keywords` — imports `data/semantic-core.csv` (+ optional Ahrefs/Autocomplete)
2. `cluster` — SERP hard clustering (threshold 4/10) or lexical fallback without `SERP_API_KEY`
3. `assign-clusters` — one site plan in `data/sitemap-plan.json` (K7 legality + K10 RG forced)
4. `analyze-serp` — briefs under `briefs/`
5. `generate-content` — Anthropic if `ANTHROPIC_API_KEY` set, else `scripts/lib/core-pages.ts`
6. `build-sites` — static HTML under `sites/`
7. `compliance-check` — affiliate/RG/banned-phrase gate → `compliance-report.md`
8. `validate-schema` — JSON-LD checks
9. `package-zip` — `1win-argentina-site.zip`

## Pages

| Path | Intent |
|------|--------|
| `/` | 1win (primary) |
| `/1win-casino/` | 1win casino |
| `/1win-app/` | 1win app |
| `/1win-login/` | 1win login |
| `/1win-bonus-code/` | bonus code 1win |
| `/1win-aviator/` | 1win aviator |
| `/1win-argentina/` | 1win argentina |
| `/is-1win-legal-in-argentina/` | K7 legality |
| `/responsible-gambling/` | K10 |
| `/about-us/`, `/privacy-cookie-policy/`, `/terms-of-service/` | trust |

## Compliance notes

- No fabricated UKGC account numbers. Operators only enter `data/casinos/*.json` after verification.
- Partner links must use domains in `data/affiliate-domain-whitelist.txt` and `rel="sponsored nofollow"`.
- Copy forbids outcome-promise phrases and under-18 targeting.
