/**
 * Safe hot-patch: replace only `out/` inside the installed app.asar.
 * Never rewrites node_modules inside the asar and never touches
 * app.asar.unpacked (natives stay exactly as the working install has them).
 */
import { execSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const asar = require('@electron/asar')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const installRoot =
  process.env.SCALPEL_INSTALL_DIR ||
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Scalpel')
const resources = path.join(installRoot, 'resources')
const asarDest = path.join(resources, 'app.asar')
const work = path.join(root, 'dist', '.safe-patch')
const extractDir = path.join(work, 'extract')
const packedAsar = path.join(work, 'app.asar')

function die(msg) {
  console.error(msg)
  process.exit(1)
}

function sleep(ms) {
  execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: 'ignore' })
}

if (!fs.existsSync(path.join(installRoot, 'Scalpel.exe'))) {
  die(`Installed Scalpel not found at ${installRoot}`)
}
if (!fs.existsSync(asarDest)) die(`Missing ${asarDest}`)

const beforeMb = fs.statSync(asarDest).size / 1024 / 1024
console.log(`Current asar: ${beforeMb.toFixed(1)} MB`)

console.log('Stopping Scalpel…')
spawnSync('taskkill', ['/F', '/IM', 'Scalpel.exe', '/T'], { stdio: 'ignore' })
sleep(2000)

if (process.env.SCALPEL_SKIP_BUILD === '1') {
  console.log('Skipping build (SCALPEL_SKIP_BUILD=1)')
} else {
  console.log('Building…')
  execSync('npm run build', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=8192'].filter(Boolean).join(' '),
    },
  })
}

fs.rmSync(work, { recursive: true, force: true })
fs.mkdirSync(extractDir, { recursive: true })

console.log('Extracting installed asar (keep its node_modules)…')
asar.extractAll(asarDest, extractDir)

const nmCount = fs.existsSync(path.join(extractDir, 'node_modules'))
  ? fs.readdirSync(path.join(extractDir, 'node_modules')).length
  : 0
console.log(`Extracted node_modules packages: ${nmCount}`)
if (nmCount < 20) die('Extract looks incomplete — aborting to avoid a broken install')

// Refuse to wipe a My Version build that has the native Filter Section Editor host.
// get-filter-sections alone is NOT enough — the Open editor plugin needs filterSectionEditor.
const extractHasSectionEditor = (() => {
  try {
    const mainJs = path.join(extractDir, 'out', 'main', 'index.js')
    const preloadJs = path.join(extractDir, 'out', 'preload', 'index.js')
    if (!fs.existsSync(mainJs) || !fs.existsSync(preloadJs)) return false
    const blob = fs.readFileSync(mainJs, 'utf8') + '\n' + fs.readFileSync(preloadJs, 'utf8')
    return /filterSectionEditor|filter-section-editor:show/.test(blob)
  } catch {
    return false
  }
})()
const incomingHasSectionEditor = (() => {
  try {
    const mainJs = path.join(root, 'out', 'main', 'index.js')
    const preloadJs = path.join(root, 'out', 'preload', 'index.js')
    if (!fs.existsSync(mainJs) || !fs.existsSync(preloadJs)) return false
    const blob = fs.readFileSync(mainJs, 'utf8') + '\n' + fs.readFileSync(preloadJs, 'utf8')
    return /filterSectionEditor|filter-section-editor:show/.test(blob)
  } catch {
    return false
  }
})()
if (extractHasSectionEditor && !incomingHasSectionEditor) {
  die(
    'ABORT: installed asar has Filter Section Editor host (filterSectionEditor). This build does not. Build/patch from Scalpel-My-Version (scalpel-myver) only — never from feat/filter-section-editor-loot-sim.',
  )
}
console.log(
  `FSE host (filterSectionEditor): installed=${extractHasSectionEditor} incoming=${incomingHasSectionEditor}`,
)

for (const dir of ['main', 'preload', 'renderer', 'scalpel-internal']) {
  const src = path.join(root, 'out', dir)
  if (!fs.existsSync(src)) continue
  const dst = path.join(extractDir, 'out', dir)
  fs.rmSync(dst, { recursive: true, force: true })
  fs.cpSync(src, dst, { recursive: true })
  console.log(`replaced out/${dir}`)
}

console.log('Packing (out/ only changed; natives untouched)…')
await asar.createPackageWithOptions(extractDir, packedAsar, { unpack: '*.node' })

const afterMb = fs.statSync(packedAsar).size / 1024 / 1024
const extractMb =
  fs
    .readdirSync(extractDir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .reduce((sum, d) => {
      const full = path.join(d.path ?? d.parentPath ?? extractDir, d.name)
      try {
        return sum + fs.statSync(full).size
      } catch {
        return sum
      }
    }, 0) / 1024 / 1024
console.log(`New asar: ${afterMb.toFixed(1)} MB (was ${beforeMb.toFixed(1)} MB; extract ${extractMb.toFixed(1)} MB)`)
// Installed asars can be much larger than extracted payload (prior pack quirks).
// Guard against incomplete packs vs the extract we just built, not vs old file size.
if (afterMb < extractMb * 0.85) {
  die(`New asar much smaller than extract (${afterMb.toFixed(1)} vs ${extractMb.toFixed(1)}) — aborting`)
}
if (afterMb < 20) {
  die(`New asar suspiciously small (${afterMb.toFixed(1)} MB) — aborting`)
}

const bak = path.join(resources, `app.asar.bak-${Date.now()}`)
fs.copyFileSync(asarDest, bak)
console.log(`Backup → ${path.basename(bak)}`)
fs.copyFileSync(packedAsar, asarDest)

// Explicitly do NOT touch app.asar.unpacked
console.log('Left app.asar.unpacked unchanged')

const hasCustom = (() => {
  try {
    return execSync(`findstr /C:"settings_custom_tiers" "${asarDest}"`, { stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
})()
console.log(hasCustom ? 'custom tiers: present in asar' : 'custom tiers: MISSING')

// spawn (not spawnSync): Scalpel stays open; waiting would hang the patch script forever.
const child = spawn(path.join(installRoot, 'Scalpel.exe'), [], {
  cwd: installRoot,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
})
child.unref()
console.log('Launched Scalpel. Check tray / window.')
