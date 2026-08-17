# Casino operator data

Each JSON file describes one operator referenced by the site.

For Great Britain–licensed brands, set `ukgc_account_number` and leave
`skip_ukgc_check` unset/false. CI will look up Active status via
`UKGC_REGISTER_LOOKUP_URL` when configured.

For international brands such as 1win that are **not** presented as
UKGC-licensed on this Argentina guide, set:

```json
"ukgc_account_number": null,
"skip_ukgc_check": true
```

Never invent licence numbers. Affiliate URLs must use domains listed in
`data/affiliate-domain-whitelist.txt`.
