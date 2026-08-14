test 1212123
patch-1

## Keyword collection (Agent 1: Semantics)

`scripts/collect-keywords.ts` builds the raw keyword dataset for the UK
Plinko casino affiliate project.

Pipeline:

1. Reads seed keywords from `data/seeds.txt`.
2. Expands seeds via the Ahrefs API v3 (`keywords-explorer/overview` +
   `keywords-explorer/related-terms`, `country=gb`).
3. Expands seeds via Google Autocomplete (`suggestqueries`, `hl=en&gl=uk`),
   combined with modifiers from `data/prefixes.txt`.
4. Deduplicates by a normalized form (lowercase, stopword removal, Porter
   stemming) so near-identical phrasings collapse into one keyword.
5. Drops keywords matched by `data/blacklist.txt` (non-UKGC operator brands,
   irrelevant intents such as the toy/DIY version, probability lessons, or
   the "Price Is Right" TV show).
6. Writes `data/keywords-raw.csv` with columns:
   `keyword, volume, kd, cpc, parent_topic, serp_features, source`.

Metric columns (`volume`, `kd`, `cpc`, `parent_topic`) are left empty
whenever Ahrefs didn't return a value for that keyword — the script never
fabricates or estimates numbers.

### Usage

```bash
npm install
cp .env.example .env   # set AHREFS_API_KEY
npm run collect-keywords
```

Without `AHREFS_API_KEY` set, the script logs a warning and still runs using
Google Autocomplete only (all metric columns will be empty).

Run summary logs report: raw candidate counts per source, unique keyword
count after dedup, how many keywords were dropped by each blacklist rule
(with an example), and how many final rows have no Ahrefs volume.
