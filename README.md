# Scalpel — My Version

A fork of [Scalpel](https://github.com/scalpelpoe/scalpel) with **Scalpel Lab** built in: a PoE 2 crafting lab (odds simulator, emulator, target hits, craft paths, and mod weight cheat sheet).

This repo patches your **normal installed Scalpel app** (Start menu) so Lab works without running a separate dev launcher.

---

## What you get

| Feature | Description |
|--------|-------------|
| **Scalpel Lab** | In-game overlay tab (pickaxe icon) for PoE 2 crafting |
| **Craft engine** | CoE-style per-base mod weights baked into the app |
| **Simulator** | Roll odds for essences, orbs, etc. on a base |
| **Emulator** | Step through crafts on a virtual item |
| **Target odds** | Chance to hit a mod with a given method |
| **Craft path** | Multi-step paths (e.g. alt until hit) |
| **Mod cheat sheet** | Pop-out overlay of mod pools and weights |

Upstream Scalpel features (filter, price check, regex, etc.) are unchanged.

---

## Requirements

- **Windows** (install script targets `%LOCALAPPDATA%\Programs\scalpel`)
- **[Scalpel](https://github.com/scalpelpoe/scalpel/releases)** already installed from the official installer
- **[Node.js 22+](https://nodejs.org/)** (for building once)
- **Path of Exile 2** (Lab is PoE 2 only)

---

## Install (recommended)

Use this if you already have Scalpel from the official site/Start menu.

### 1. Clone this repo

```powershell
git clone https://github.com/eniner/Scalpel-My-Version.git
cd Scalpel-My-Version
```

### 2. Install dependencies

```powershell
npm install
cd plugins\scalpel-lab
npm install
cd ..\build-shopping-list
npm install
cd ..\..
```

### 3. Patch your installed Scalpel

**Quit Scalpel completely** (including the system tray icon), then run:

```powershell
npm run install:local
```

This will:

1. Build CoE crafting data and the full app bundle
2. Pack a new `app.asar` with the craft engine + Lab support
3. Replace `%LOCALAPPDATA%\Programs\scalpel\resources\app.asar` (old file backed up as `app.asar.bak-*`)
4. Copy the **Scalpel Lab** plugin into `%APPDATA%\Scalpel\plugins\scalpel-lab\`
5. Launch Scalpel from your normal install

**First build can take several minutes** and needs ~8 GB RAM. If the build fails with “JavaScript heap out of memory”, close other apps and run:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run install:local
```

### 4. Open Scalpel

Launch **Scalpel** from the Start menu (not a separate dev exe). In the overlay toolbar, click the **pickaxe** tab — **Scalpel Lab**.

---

## Using Scalpel Lab

1. Set Scalpel to **PoE 2** and your league in settings.
2. Open the overlay in game (default hotkey from Scalpel settings).
3. Select the **Scalpel Lab** tab (pickaxe icon).

### Tabs inside Lab

| Tab | Purpose |
|-----|---------|
| **Simulator** | Pick a base and crafting action; see mod roll probabilities |
| **Mod cheat sheet** | Search/filter mod pools and weights for a base |
| **Emulator** | Apply crafts step-by-step on a virtual item |
| **Target odds** | Probability to hit a specific mod (search by name) |
| **Craft path** | Odds for multi-step plans (e.g. spam alts until mod) |

### Import an item from game

- Use the hotkey **Import item → Scalpel Lab** (configure in Scalpel plugin hotkeys), or
- Copy item in game and use Smart Import inside Lab where available.

### Pop-out cheat sheet

In the Lab tab header, click **Pop out** to open the mod cheat sheet in a separate window.

---

## Developer workflow (optional)

If you want to hack on Lab or run from source without patching the installer:

```powershell
npm run dev:plugin
```

Or build and launch from the repo without a dev server:

```powershell
npm run launch
```

Or double-click **`Launch Scalpel.bat`** in the repo root (same as `npm run launch`).

---

## Re-install / update after pulling git changes

```powershell
git pull
npm install
npm run install:local
```

Always fully quit Scalpel before running `install:local`.

---

## Troubleshooting

### Orange banner: “Scalpel needs a full restart…”

The craft engine is not loaded. **Quit Scalpel entirely** (tray + all windows) and open it again from the Start menu. If it persists, re-run `npm run install:local`.

### Error: `Cannot find module ... app.asar\out\main\index.js`

The patched `app.asar` is broken (incomplete build). Restore from backup:

```powershell
# Find the newest backup
dir $env:LOCALAPPDATA\Programs\scalpel\resources\app.asar.bak-*

# Restore (replace TIMESTAMP with your backup name)
Copy-Item "$env:LOCALAPPDATA\Programs\scalpel\resources\app.asar.bak-TIMESTAMP" `
  "$env:LOCALAPPDATA\Programs\scalpel\resources\app.asar" -Force
```

Then re-run `npm run install:local` with `$env:NODE_OPTIONS="--max-old-space-size=8192"`.

### Lab tab missing

Check `%APPDATA%\Scalpel\plugins\installed.json` includes `"scalpel-lab"`. Re-run `npm run install:local`.

### Official Scalpel auto-update overwrote Lab

The built-in updater may replace `app.asar` with a release that does not include Lab. Re-run:

```powershell
npm run install:local
```

The install script also updates the pending update staging folder so restarts are less likely to revert the patch.

---

## Project layout

```
plugins/scalpel-lab/     Scalpel Lab plugin (UI)
src/shared/crafting/     Craft engine (host)
src/main/handlers/       Craft IPC handlers
scripts/install-to-local-scalpel.mjs   Patch normal Scalpel install
```

---

## License

Based on [Scalpel](https://github.com/scalpelpoe/scalpel) — **AGPL-3.0-only**. Scalpel Lab additions follow the same license. You must comply with AGPL if you distribute modified versions.

---

## Credits

- [Scalpel](https://github.com/scalpelpoe/scalpel) — Kyusung / Scalpel team
- Mod weight data — Craft of Exile–style dataset (built via `npm run build-coe-crafting-data`)
- Scalpel Lab — E9ine_AC
