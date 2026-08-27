# Listing Watch (Scalpel plugin)

PoE2 **monitor / alert** plugin for [Scalpel](https://github.com/scalpelpoe/scalpel). It polls the official trade search through Scalpel's host (same rate-limit path as Price Check), estimates a fair ask from a rolling median + MAD, and flags listings that look cheap.

**It does not whisper, buy, or send any game input.** You open the trade site and act yourself.

## Features

- Watches: base type / class / unique name, weighted mods, price band, flag multiplier
- Rolling robust stats (median, MAD, bottom percentile) — not a raw average
- In-app feed + optional desktop notification (rate-limited per watch)
- Exchange tab: ninja currency snapshot (informational)
- Uses Scalpel's existing pathofexile.com login (trade is not GGG OAuth)

## Not available (GGG docs, Aug 2026)

- PoE2 stash / public-stash stream (PoE1 only)
- Character gold balance
- New OAuth app registration on GGG's developer site

## Dev

```bash
npm install
npm test
npm run build
npm run install:scalpel
```

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
