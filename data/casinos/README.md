# Operator data (`data/casinos/*.json`)

This directory is intentionally **empty of real operators** in this delivery.

The pipeline (`scripts/generate-content.ts`, `scripts/compliance-check.ts`) is
fully wired to support operator listings, but we do not have a verified,
current feed of UKGC-licensed Plinko-offering operators, their real bonus
terms (wagering, min deposit, expiry, game weighting) or affiliate deal
terms. Rather than invent plausible-looking operator names, licence numbers
or bonus T&Cs - which would be false advertising under the UK CAP Code and a
compliance risk under the Gambling Commission's licence conditions - the 5
sites ship without a real-money operator comparison table populated. Every
site instead links out to the official Gambling Commission public register
so visitors can check licensing themselves, and clearly explains what a
compliant offer must disclose.

## Adding real operators later

Add one JSON file per operator, matching `_schema.example.json`:

```json
{
  "id": "example-operator",
  "brandName": "Example Casino",
  "ukgcAccountNumber": "00000-0000-00000000-00",
  "affiliateUrl": "https://affiliates.example-operator.example/click?id=...",
  "homepageUrl": "https://www.example-operator.example/",
  "bonus": {
    "headline": "Up to £50 in bonus funds",
    "minDeposit": "£10",
    "wageringRequirement": "35x bonus amount",
    "expiry": "7 days",
    "eligibleGames": ["Plinko"],
    "gameWeighting": "100% Plinko"
  },
  "hasPlinko": true
}
```

`scripts/compliance-check.ts` will:

1. Look up `ukgcAccountNumber` on the public Gambling Commission register and
   require status `Active` - anything else (or not found) fails the build
   and the operator's links are stripped from generated pages.
2. Require `affiliateUrl`'s domain to be present in
   `data/affiliate-domain-whitelist.txt`.
3. Require the bonus block to be complete before the operator can be
   rendered on an offer page (wagering, min deposit, expiry, game weighting).

Do not hand-author `ukgcAccountNumber` or bonus terms from memory or
guesswork - copy them from the operator's own terms page and the
Commission's register at the time of adding the file.
