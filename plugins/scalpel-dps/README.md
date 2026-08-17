# Scalpel DPS

PoB-style weapon compare for **PoE1 and PoE2**.

Install from Scalpel’s plugin list after the registry listing is merged, or sideload the `plugin.js` + `manifest.json` from [Releases](https://github.com/eniner/scalpel-dps/releases).

## Use

1. Hover a weapon in inventory/stash (game focused)
2. **Ctrl+C**, then **Load → A**
3. Hover the other weapon, **Ctrl+C**, then **Load → B**
4. Toggle **Attack** / **Spell** on each tooltip if needed

PoE1 spell mode treats local attack speed (and quality AS enchants) as cast speed. Set **Character INT** for “% spell damage per intelligence”.

## Dev install

```bash
cd plugins/scalpel-dps
npm install
npm run install:scalpel
```
