# Runeshape Checker (Scalpel plugin)

Auto-detects rewards from the **Runeshape Combinations** panel using **fixed row slots** (one OCR crop per reward line) and draws **poe.ninja prices beside each row** in-game.

## Usage

1. Open the Runeshape Combinations panel in PoE 2
2. Bind **Price Runeshape rewards** in Scalpel → Settings → Plugins (or the Runeshape tab)
3. Press the hotkey while PoE is focused — prices appear next to each reward
4. Press again to dismiss

## How it reads rewards

Unlike Scalpel OCR (`well-tiers`), this plugin does **not** sparse-scan the whole panel and cluster words. It:

1. Crops the left Runeshape book panel
2. Splits it into **8 fixed row slots** over the reward text column (skipping rune icons)
3. Runs **one block OCR pass per row** at high zoom
4. Matches each line against the reward catalog + poe.ninja

## vs Scalpel OCR (`well-tiers`)

| | **Runeshape Checker** | **Scalpel OCR** |
|---|---|---|
| Scope | Runeshape only | Well of Souls + Runeshape |
| Hotkey | Price Runeshape rewards | Reveal well tiers |

You can run both plugins; use whichever hotkey you prefer for Runeshape.

## Build & install

```bash
cd scalpel-runeshape
npm install
npm run build
```

Copy `dist/` to `%APPDATA%\Scalpel\plugins\runeshape-checker\` and restart Scalpel.
