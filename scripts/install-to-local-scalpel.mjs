#!/usr/bin/env node
/**
 * Build Scalpel + Scalpel Lab from this repo and patch the normal Start-menu install
 * (Local\Programs\scalpel) — replaces app.asar and copies bundled plugins into AppData.
 */
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync, execSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_IDS = [
  'build-shopping-list',
  'scalpel-lab',
  'scalpel-economy',
  'scalpel-harvest',
  'scalpel-advisor',
  'scalpel-skill-dps',
  'scalpel-warrants',
  'runeshape-checker',
  'well-tiers',
]
const installedRoot =
  process.env.SCALPEL_INSTALL_DIR ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Programs', 'scalpel')
const resourcesDir = join(installedRoot, 'resources')
const pluginsRoot = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Scalpel', 'plugins')

function run(cmd, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit', env: process.env })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))))
  })
}

function stopScalpel() {
  if (process.platform !== 'win32') return
  spawnSync('taskkill', ['/F', '/IM', 'Scalpel.exe', '/T'], { stdio: 'ignore', windowsHide: true })
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      "Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*scalpel*' } | Stop-Process -Force -ErrorAction SilentlyContinue",
    ],
    { stdio: 'ignore', windowsHide: true },
  )
}

function ensureInstalledJson() {
  const installedPath = join(pluginsRoot, 'installed.json')
  let ids = []
  if (existsSync(installedPath)) {
    try {
      ids = JSON.parse(readFileSync(installedPath, 'utf8'))
      if (!Array.isArray(ids)) ids = []
    } catch {
      ids = []
    }
  }
  ids = ids.filter((id) => id !== 'craft-of-exile')
  for (const id of PLUGIN_IDS) {
    if (!ids.includes(id)) ids.push(id)
  }
  mkdirSync(pluginsRoot, { recursive: true })
  writeFileSync(installedPath, `${JSON.stringify(ids, null, 2)}\n`)
  const legacy = join(pluginsRoot, 'craft-of-exile')
  if (existsSync(legacy)) rmSync(legacy, { recursive: true, force: true })
}

function installPlugin(pluginId) {
  const dist = join(root, 'plugins', pluginId, 'dist')
  const dest = join(pluginsRoot, pluginId)
  if (!existsSync(join(dist, 'plugin.js'))) throw new Error(`Missing build for plugin ${pluginId}`)
  if (existsSync(dest)) {
    const stat = lstatSync(dest)
    if (stat.isSymbolicLink?.() || stat.isJunction?.()) rmSync(dest, { recursive: true, force: true })
  }
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(dist)) {
    copyFileSync(join(dist, name), join(dest, name))
  }
}

function verifyAsar(asarPath) {
  const listing = execSync(`npx --yes @electron/asar list "${asarPath}"`, { encoding: 'utf8' })
  if (!listing.includes('\\out\\main\\index.js') && !listing.includes('/out/main/index.js')) {
    throw new Error(`Invalid asar (missing out/main/index.js): ${asarPath}`)
  }
  // Official GitHub betas omit this window; our fork packs it. Refuse to install a build
  // that would leave the Filter tab plugin dead.
  if (!listing.includes('filter-section-editor.html')) {
    throw new Error(
      `Invalid asar (missing filter-section-editor.html): ${asarPath}. Rebuild from this repo.`,
    )
  }
}

function writeCleanInstallManifest(version) {
  const userData = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Scalpel')
  mkdirSync(userData, { recursive: true })
  const manifestPath = join(userData, 'install-manifest.json')
  let existing = {}
  if (existsSync(manifestPath)) {
    try {
      existing = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      existing = {}
    }
  }
  const next = {
    ...existing,
    version,
    electronVersion: existing.electronVersion || process.versions.electron || '32.3.3',
    nativeModules: existing.nativeModules || {
      'electron-overlay-window': '4.1.0',
      'uiohook-napi': '1.5.4',
    },
  }
  // Never leave a sticky brick banner after a local install.
  delete next.brickedMessage
  writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`Wrote clean install-manifest.json (version ${version}, no brickedMessage)`)
}

/** Install a bundled cheat-sheet prefab into every PoE2 profile. */
function installPrefabCheatSheet(opts) {
  const { slug, categoryId, categoryName, sheets } = opts
  const profilesDir = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Scalpel', 'profiles')
  if (!existsSync(profilesDir)) return
  const sheetsRoot = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Scalpel', 'cheat-sheets')
  const destDir = join(sheetsRoot, categoryId)
  mkdirSync(destDir, { recursive: true })

  const installedSheets = []
  for (const sheet of sheets) {
    const sheetSrc = join(root, 'cheat-sheet-prefabs', sheet.src)
    if (!existsSync(sheetSrc)) {
      console.warn(`${categoryName} cheat sheet missing (${sheet.src}) — skip`)
      continue
    }
    copyFileSync(sheetSrc, join(destDir, `${sheet.id}.png`))
    const thumb = join(destDir, `${sheet.id}.thumb.jpg`)
    if (existsSync(thumb)) rmSync(thumb, { force: true })
    installedSheets.push({ id: sheet.id, label: sheet.label, ext: 'png' })
  }
  if (installedSheets.length === 0) return

  for (const name of readdirSync(profilesDir)) {
    if (!name.endsWith('.json')) continue
    const path = join(profilesDir, name)
    let profile
    try {
      profile = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      continue
    }
    if (profile.gameVariant !== 2) continue
    if (!profile.cheatSheets || typeof profile.cheatSheets !== 'object') {
      profile.cheatSheets = { globalHotkey: '', categories: [], pinned: false }
    }
    const cats = Array.isArray(profile.cheatSheets.categories) ? profile.cheatSheets.categories : []
    const existing = cats.find((c) => c.id === categoryId || c.prefabSlug === slug)
    const category = {
      id: categoryId,
      name: categoryName,
      hotkey: existing?.hotkey ?? '',
      prefabSlug: slug,
      sheets: installedSheets,
    }
    profile.cheatSheets.categories = [
      ...cats.filter((c) => c.id !== categoryId && c.prefabSlug !== slug),
      category,
    ]
    profile.updatedAt = new Date().toISOString()
    writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`)
    console.log(`Installed ${categoryName} cheat sheet into profile ${profile.name || name}`)
  }
}

function installExpeditionCheatSheet() {
  installPrefabCheatSheet({
    slug: 'expedition',
    categoryId: 'cat-expedition',
    categoryName: 'Expedition',
    sheets: [{ id: 'expedition-tier-list', label: 'Expedition Tier List', src: 'expedition/expedition-tier-list.png' }],
  })
}

function installRegexCheatSheet() {
  installPrefabCheatSheet({
    slug: 'regex',
    categoryId: 'cat-regex',
    categoryName: 'Regex',
    sheets: [
      { id: '01-operators', label: 'Operators', src: 'regex/01-operators.png' },
      { id: '02-numbers-gotchas', label: 'Numbers & Gotchas', src: 'regex/02-numbers-gotchas.png' },
    ],
  })
}

function patchInstalledAsar(version) {
  const srcAsar = join(root, 'dist', `v${version}`, 'app.asar')
  const srcUnpacked = `${srcAsar}.unpacked`
  const destAsar = join(resourcesDir, 'app.asar')
  const destUnpacked = join(resourcesDir, 'app.asar.unpacked')
  if (!existsSync(srcAsar)) throw new Error(`Built asar not found: ${srcAsar}`)
  verifyAsar(srcAsar)
  if (!existsSync(installedRoot)) throw new Error(`Scalpel install not found: ${installedRoot}`)
  const backup = join(resourcesDir, `app.asar.bak-${Date.now()}`)
  if (existsSync(destAsar)) copyFileSync(destAsar, backup)
  copyFileSync(srcAsar, destAsar)
  if (existsSync(srcUnpacked)) {
    if (existsSync(destUnpacked)) rmSync(destUnpacked, { recursive: true, force: true })
    cpSync(srcUnpacked, destUnpacked, { recursive: true })
  }
  // Prevent the built-in updater from reverting to an older release asar on next restart.
  const stagingDir = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Scalpel', 'update-staging')
  mkdirSync(stagingDir, { recursive: true })
  copyFileSync(srcAsar, join(stagingDir, 'app.asar.new'))
  if (existsSync(srcUnpacked)) {
    const stagedUnpacked = join(stagingDir, 'app.asar.unpacked')
    if (existsSync(stagedUnpacked)) rmSync(stagedUnpacked, { recursive: true, force: true })
    cpSync(srcUnpacked, stagedUnpacked, { recursive: true })
  }
  console.log(`Patched ${destAsar}`)
  if (existsSync(backup)) console.log(`Backup: ${backup}`)
}

async function main() {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  const builtAsar = join(root, 'dist', `v${version}`, 'app.asar')
  console.log('Building Scalpel with Lab support…')
  await run('node', ['scripts/build-coe-crafting-data.js'])
  if (existsSync(builtAsar)) {
    console.log('Removing stale dist asar so this build is packed…')
    rmSync(builtAsar, { force: true })
    const unpacked = `${builtAsar}.unpacked`
    if (existsSync(unpacked)) rmSync(unpacked, { recursive: true, force: true })
  }
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim()
  await run('npm', ['run', 'build'])
  await run('node', ['scripts/pack-asar.js'])

  for (const pluginId of PLUGIN_IDS) {
    const pluginDir = join(root, 'plugins', pluginId)
    if (!existsSync(join(pluginDir, 'package.json'))) continue
    if (!existsSync(join(pluginDir, 'node_modules'))) await run('npm', ['install'], pluginDir)
    await run('npm', ['run', 'build'], pluginDir)
  }

  stopScalpel()
  patchInstalledAsar(version)
  writeCleanInstallManifest(version)
  ensureInstalledJson()
  for (const pluginId of PLUGIN_IDS) installPlugin(pluginId)
  installExpeditionCheatSheet()
  installRegexCheatSheet()

  console.log('\nDone. Launching normal Scalpel…')
  const exe = join(installedRoot, 'Scalpel.exe')
  if (!existsSync(exe)) throw new Error(`Scalpel.exe not found: ${exe}`)
  const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
