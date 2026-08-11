# Scalpel Advisor

Optional PoE1 overlay plugin (author **E9**) — farming EV tools hub **inspired by** Perandus Ledger
calculators, with an original **Atlas Draft** UI (not a Ledger clone).

## Tools

Gem Leveling, Gem Transfig, Beasts, Scarab Atlas, Essences, Harvest (Farming EV + Crop Rotation), Currency Trends, Boss Profitability, Nightmare Boss Rush, Betrayal EV, Scrying Orb.

## UI

Ink-slate / verdigris “Atlas Draft” chrome: Fraunces display + Figtree UI, league stamp, underline tabs,
left-rule stats, workbench shells. Engines keep Ledger math; presentation is Scalpel’s.

## Develop / install

```bash
cd plugins/scalpel-advisor
npm install
npm test
npm run install:scalpel   # builds and copies to %APPDATA%\Scalpel\plugins\scalpel-advisor
```

Bind **Toggle Scalpel Advisor** in Settings → Macros.

**Data sources**
- **Live prices / 7-day trends:** Scalpel `ctx.prices` → poe.ninja (no Ledger CDN at runtime).
- **Drop weights** (scarabs / beasts / essences): scraped from Perandus Ledger CDN and embedded via `npm run scrape:weights` into `src/data/*-ref.json`.
- **Other tables** (XP, harvest math, boss drops): bundled static JSON.
- **Scrying map floors:** still bundled snapshots (not on poe.ninja).

```bash
npm run scrape:weights          # current Ledger league from /data/config.json
npm run scrape:weights keepers  # explicit league slug
```
