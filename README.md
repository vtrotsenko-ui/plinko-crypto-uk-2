# Plinko Crypto UK - SEO site portfolio

An affiliate/information project targeting the UK Plinko casino-game niche
(geo: GB). This repo contains the full pipeline - keyword research,
clustering, cluster-to-site assignment, content generation and a compliance
gate - plus its output: **5 independently deployable static sites** under
[`sites/`](sites/), each with a free-play demo game and the four mandatory
trust pages (About Us, Privacy & Cookie Policy, Terms of Service,
Responsible Gambling) plus a dedicated UK-legality page.

## The 5 sites

| Site | Domain (placeholder) | Positioning |
| --- | --- | --- |
| Plinko Guide UK | `plinkoguide.uk` | Beginner-first mechanics/rules explainer |
| Plinko Casino Hub UK | `plinkocasinohub.uk` | Licensing-first site comparison hub |
| Plinko Strategy Lab UK | `plinkostrategylab.uk` | Odds/volatility/bankroll-management education |
| Crypto Plinko UK | `crypto-plinko-guide.uk` | Crypto-funded Plinko + UK legal/tax notes (flagship - backed by real search-volume data, see below) |
| Plinko App Hub UK | `plinkoapphub.uk` | Mobile app legitimacy checks |

Domains above are **placeholders** - point DNS/hosting at real registered
domains before launch, and update `data/sites.yaml` accordingly (the whole
pipeline re-derives everything from that file).

## Pipeline (5 stages, run with `npm run build`)

```
data/seeds.txt ─┐
data/semantic-core.csv (real client-supplied Ahrefs export) ─┤
                ├─> collect-keywords.ts ─> data/keywords-raw.csv
Google Autocomplete ─┘

data/keywords-raw.csv ─> cluster.ts ─> data/clusters.csv + data/orphans.csv

data/clusters.csv + data/sites.yaml ─> assign-clusters.ts ─> data/sitemap-plan.json

data/sitemap-plan.json ─> analyze-serp.ts ─> briefs/{id}.json

briefs/ + data/games/ + data/casinos/ ─> generate-content.ts ─> content/generated/{site}/{page}.json

content/generated/ + assets-src/ ─> build-sites.ts ─> sites/{site}/  (deploy this)

sites/ ─> compliance-check.ts ─> compliance-report.md (blocks deploy on failure)
```

Run the whole thing:

```bash
npm install
cp .env.example .env   # optional - see below, everything runs without keys
npm run build
```

Each stage can also be run individually (`npm run cluster`,
`npm run assign-clusters`, etc.) - see each script's file header for exactly
what it does and how it degrades gracefully without an API key.

### Running without any API keys

Every stage that would normally call a paid API (Ahrefs, a SERP API,
Anthropic) is designed to **degrade transparently, never fabricate data**:

- No `AHREFS_API_KEY` -> keyword metrics (volume/KD/CPC) stay `null`, never
  estimated. The real client-supplied semantic core
  (`data/semantic-core.csv`, a genuine Ahrefs export for `country=gb`) is
  still merged in with its real numbers.
- No `SERP_API_KEY` -> `cluster.ts` clusters by lexical token overlap
  instead of real SERP overlap (clearly logged and labelled in the output),
  and `analyze-serp.ts` uses fixed per-page-type targets instead of
  observed competitor word/table/heading counts.
- No `ANTHROPIC_API_KEY` -> `generate-content.ts` uses a hand-authored
  offline content corpus (see below) instead of calling Claude.

This is why the repo is fully buildable and the 5 sites are fully rendered
right now, with zero secrets configured.

### Content generation without an LLM API key

`scripts/generate-content.ts` is wired for production use with the
Anthropic API (`scripts/lib/anthropic.ts` has the full system prompt and
request/response handling matching the brief). Since no `ANTHROPIC_API_KEY`
is configured in this environment, the 40 pages you see under
`content/generated/` and `sites/` were instead composed from
**hand-authored content** in `scripts/lib/core-pages.ts` (15 unique
home/landing pages) and `scripts/lib/trust-pages.ts` (25 trust pages across
5 sites, with About Us and the legality page written per-site and
Privacy/Terms/Responsible Gambling sharing a safety-consistent baseline with
a per-site intro). Two structural sections (risk levels, row/odds) plus the
mandatory responsible-gambling block are appended to every page by
`scripts/lib/shared-sections.ts` / `scripts/lib/compliance-text.ts`.

Every page still goes through the exact same validation gate a real LLM
generation run would (`generate-content.ts`'s `validate()` function): title/
meta length, keyword placement, table/list/SVG/image minimums, banned-phrase
and under-18 checks, mandatory RG block, and a TF-IDF-weighted cross-site
duplicate-content check (see that file for why raw bag-of-words cosine
similarity isn't the right metric for 5 sites sharing a niche vocabulary).

## Images

Six illustrative images were generated once (`assets-src/images/`, resized
and compressed to 43-135 KB JPEGs) and are reused across pages/sites with
page-specific `alt` text, rather than generating 120+ near-identical unique
images. Two inline SVG infographics (risk-level spread, row/odds chart) are
generated as markup directly by `scripts/lib/svg.ts` - no image requests.

## Why `data/casinos/` is empty

No real-money operator is listed on any of the 5 sites. We don't have a
verified, current feed of UKGC licence numbers or real bonus T&Cs, and
inventing plausible-looking operator data would be false advertising under
the UK CAP Code and a Gambling Commission compliance risk. See
[`data/casinos/README.md`](data/casinos/README.md) for the schema and the
verification steps `scripts/compliance-check.ts` runs before any operator
link is allowed to render. Every site instead links to the official
Gambling Commission public register and explains what a compliant offer
must disclose.

## The demo game

Every site's homepage (and the dedicated `/plinko-demo/` page on Plinko
Guide UK) embeds a free-play Plinko widget (`assets-src/js/plinko-demo.js`):
virtual credits only, no account, no network requests, reset any time.
It is explicitly **not** presented as a certified or provably-fair RNG -
see the in-page disclosure text next to the widget.

## Compliance gate (Agent 5)

`npm run compliance-check` (wired into `.github/workflows/compliance.yml`
ahead of any deploy step) checks the **built HTML**, independent of the
content-generation validation:

1. Every operator in `data/casinos/*.json` must have an Active licence per
   `UKGC_REGISTER_LOOKUP_URL` (unconfigured = treated as unverified, not
   assumed compliant - see that env var's comment in `.env.example` for why
   there's no hardcoded Gambling Commission API endpoint).
2. Every partner link's domain must be in
   `data/affiliate-domain-whitelist.txt`.
3. Every page mentioning a bonus/offer must show 18+ and a BeGambleAware
   link; full bonus T&Cs (wagering/min deposit/expiry/game weighting) are
   checked once real offers exist.
4. No banned phrase anywhere (negation-aware - "no outcome is guaranteed" is
   fine, "guaranteed win" is not).
5. Every partner link carries `rel="sponsored nofollow"`.

Output: [`compliance-report.md`](compliance-report.md).

## Repository layout

```
data/               keyword/cluster/site inputs (some gitignored & regenerated)
briefs/             generated content briefs (gitignored, npm run analyze-serp)
content/generated/  generated page content JSON (gitignored, npm run generate-content)
scripts/            the pipeline (one file per agent + shared lib/)
assets-src/         shared CSS/JS/images copied into every built site
sites/              the 5 built, deployable static sites (gitignored, npm run build-sites)
.github/workflows/  CI: build + compliance gate before deploy
```
