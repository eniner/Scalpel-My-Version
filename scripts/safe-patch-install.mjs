/**
 * Safe hot-patch: replace `out/` inside the installed app.asar, and inject any
 * missing native modules the new build requires (e.g. koffi). Keeps the rest of
 * the install's node_modules and merges only newly unpacked `*.node` files into
 * app.asar.unpacked (does not wipe existing natives).
 *
 * Set SCALPEL_SKIP_BUILD=1 to reuse an existing out/ tree.
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
const unpackedDest = path.join(resources, 'app.asar.unpacked')
const work = path.join(root, 'dist', '.safe-patch')
const extractDir = path.join(work, 'extract')
const packedAsar = path.join(work, 'app.asar')
const packedUnpacked = `${packedAsar}.unpacked`
const sidecarBackup = path.join(work, 'sidecar-backup')

/** Native / platform packages that newer main builds may require. */
const INJECT_MODULES = [
  'koffi',
  '@koromix/koffi-win32-x64',
  '@coooookies/windows-smtc-monitor',
  '@coooookies/windows-smtc-monitor-win32-x64-msvc',
]

function die(msg) {
  console.error(msg)
  process.exit(1)
}

function sleep(ms) {
  execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: 'ignore' })
}

function copyRel(fromRoot, toRoot, rel) {
  const src = path.join(fromRoot, rel)
  if (!fs.existsSync(src)) return false
  const dst = path.join(toRoot, rel)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.cpSync(src, dst, { recursive: true })
  return true
}

/** Keep live-install sidecars (PoB entry shim, hooks) that are not in repo out/. */
function backupSidecars(fromRoot) {
  fs.rmSync(sidecarBackup, { recursive: true, force: true })
  fs.mkdirSync(sidecarBackup, { recursive: true })
  const kept = []
  copyRel(fromRoot, sidecarBackup, 'package.json') && kept.push('package.json')
  for (const dir of ['main', 'preload']) {
    const abs = path.join(fromRoot, 'out', dir)
    if (!fs.existsSync(abs)) continue
    for (const file of fs.readdirSync(abs)) {
      if (!/^(pob-|.*-hook\.js$)/.test(file)) continue
      const rel = path.join('out', dir, file)
      copyRel(fromRoot, sidecarBackup, rel)
      kept.push(rel)
    }
  }
  return kept
}

function restoreSidecars(toRoot, kept) {
  for (const rel of kept) {
    copyRel(sidecarBackup, toRoot, rel)
    console.log(`restored ${rel}`)
  }
}

function injectMissingModules(extractRoot) {
  const nmSrc = path.join(root, 'node_modules')
  const nmDst = path.join(extractRoot, 'node_modules')
  const injected = []
  for (const mod of INJECT_MODULES) {
    const src = path.join(nmSrc, ...mod.split('/'))
    const dst = path.join(nmDst, ...mod.split('/'))
    if (!fs.existsSync(src)) {
      console.warn(`skip inject ${mod}: not in local node_modules`)
      continue
    }
    if (fs.existsSync(dst)) {
      console.log(`already present: ${mod}`)
      continue
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.cpSync(src, dst, { recursive: true, dereference: true })
    injected.push(mod)
    console.log(`injected ${mod}`)
  }
  return injected
}

function mergeUnpacked(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) return 0
  let files = 0
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const nextRel = rel ? path.join(rel, entry.name) : entry.name
      const src = path.join(dir, entry.name)
      const dst = path.join(toDir, nextRel)
      if (entry.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true })
        walk(src, nextRel)
      } else {
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.copyFileSync(src, dst)
        files++
      }
    }
  }
  fs.mkdirSync(toDir, { recursive: true })
  walk(fromDir)
  return files
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
  if (!fs.existsSync(path.join(root, 'out', 'main', 'index.js'))) {
    die('SCALPEL_SKIP_BUILD=1 but out/main/index.js is missing')
  }
} else {
  console.log('Building…')
  execSync('npm run build', { cwd: root, stdio: 'inherit' })
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

// Refuse to wipe a My Version / Filter Section Editor build with a thinner tree.
const extractHasSectionEditor = (() => {
  try {
    const mainJs = path.join(extractDir, 'out', 'main', 'index.js')
    if (!fs.existsSync(mainJs)) return false
    const head = fs.readFileSync(mainJs, 'utf8')
    return /Filter Section|filter-section-editor|Add rule/.test(head)
  } catch {
    return false
  }
})()
const incomingHasSectionEditor = (() => {
  try {
    const mainJs = path.join(root, 'out', 'main', 'index.js')
    if (!fs.existsSync(mainJs)) return false
    return /Filter Section|filter-section-editor|Add rule/.test(fs.readFileSync(mainJs, 'utf8'))
  } catch {
    return false
  }
})()
if (extractHasSectionEditor && !incomingHasSectionEditor) {
  die(
    'ABORT: installed asar has Filter Section Editor; this repo build does not. Refusing to replace out/ and wipe your editor. Merge custom tiers into the My Version / filter-section-editor branch first.',
  )
}

const sidecarKept = backupSidecars(extractDir)
if (sidecarKept.length > 0) console.log(`Backed up sidecars: ${sidecarKept.join(', ')}`)

for (const dir of ['main', 'preload', 'renderer', 'scalpel-internal']) {
  const src = path.join(root, 'out', dir)
  if (!fs.existsSync(src)) continue
  const dst = path.join(extractDir, 'out', dir)
  fs.rmSync(dst, { recursive: true, force: true })
  fs.cpSync(src, dst, { recursive: true })
  console.log(`replaced out/${dir}`)
}

if (sidecarKept.length > 0) restoreSidecars(extractDir, sidecarKept)

const injected = injectMissingModules(extractDir)
if (injected.length === 0) console.log('No missing native modules to inject')

const pkgPath = path.join(extractDir, 'package.json')
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  if (pkg.main?.includes('pob-shim.js') && !fs.existsSync(path.join(extractDir, 'out', 'main', 'pob-shim.js'))) {
    die('package.json expects pob-shim.js but sidecar restore failed — aborting')
  }
}

console.log('Packing (out/ + injected natives; existing node_modules kept)…')
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

const merged = mergeUnpacked(packedUnpacked, unpackedDest)
console.log(
  merged > 0
    ? `Merged ${merged} unpacked native file(s) into app.asar.unpacked`
    : 'No new unpacked natives to merge (existing unpacked left as-is)',
)

const hasKoffi = (() => {
  try {
    return execSync(`findstr /C:"koffi" "${asarDest}"`, { stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
})()
const hasFse = fs.existsSync(path.join(root, 'out', 'renderer', 'filter-section-editor.html'))
console.log(hasKoffi ? 'koffi: present in asar' : 'koffi: MISSING')
console.log(hasFse ? 'FSE html: present in out/' : 'FSE html: MISSING')

spawn(path.join(installRoot, 'Scalpel.exe'), [], {
  cwd: installRoot,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
}).unref()
console.log('Launched Scalpel. Check tray / window.')
