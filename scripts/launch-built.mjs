#!/usr/bin/env node
/**
 * Build (if needed), link plugins, launch Scalpel from out/ — no dev server, no watch.
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_IDS = [
  'build-shopping-list',
  'scalpel-lab',
  'scalpel-economy',
  'scalpel-harvest',
  'scalpel-advisor',
  'scalpel-skill-dps',
  'runeshape-checker',
  'well-tiers',
]
const OUT_DIR = join(root, 'src', 'shared', 'data', 'crafting')
const appDataPlugins = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Scalpel', 'plugins')
const electronDist = join(root, 'node_modules', 'electron', 'dist')
const electronBinName = process.platform === 'win32' ? 'electron.exe' : 'electron'
const electronBin = join(electronDist, electronBinName)
const CLEAN_ELECTRON_DIST = join(root, '.electron-clean', 'dist')

function runQuiet(cmd, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true, stdio: 'ignore', windowsHide: true, env: process.env })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

function linkPluginDist(pluginId) {
  const pluginDir = join(root, 'plugins', pluginId)
  const pluginDist = join(pluginDir, 'dist')
  const appDataPlugin = join(appDataPlugins, pluginId)
  mkdirSync(appDataPlugins, { recursive: true })
  if (existsSync(appDataPlugin)) {
    const stat = lstatSync(appDataPlugin)
    const isJunction = typeof stat.isJunction === 'function' && stat.isJunction()
    if (stat.isSymbolicLink() || isJunction || stat.isDirectory()) {
      rmSync(appDataPlugin, { recursive: true, force: true })
    }
  }
  symlinkSync(pluginDist, appDataPlugin, 'junction')
}

function ensureInstalledJson() {
  const installedPath = join(appDataPlugins, 'installed.json')
  let ids = []
  if (existsSync(installedPath)) {
    try {
      ids = JSON.parse(readFileSync(installedPath, 'utf8'))
      if (!Array.isArray(ids)) ids = []
    } catch {
      ids = []
    }
  }
  // craft-of-exile was renamed to scalpel-lab — drop the old id so the tab loads again.
  ids = ids.filter((id) => id !== 'craft-of-exile')
  for (const id of PLUGIN_IDS) {
    if (!ids.includes(id)) ids.push(id)
  }
  writeFileSync(installedPath, `${JSON.stringify(ids, null, 2)}\n`)
  // Remove broken junction left from the old craft-of-exile id.
  const legacy = join(appDataPlugins, 'craft-of-exile')
  if (existsSync(legacy)) {
    try {
      rmSync(legacy, { recursive: true, force: true })
    } catch {
      /* best effort */
    }
  }
}

function needsHostBuild() {
  const coe = join(OUT_DIR, 'crafting-coe-poe2.json')
  if (!existsSync(coe)) return true
  const preload = join(root, 'out/preload/index.js')
  if (!existsSync(preload)) return true
  const preloadSrc = readFileSync(preload, 'utf8')
  if (!preloadSrc.includes('craft-mod-pool') || !preloadSrc.includes('craft-apply')) return true
  if (!preloadSrc.includes('ninja-character-model') || !preloadSrc.includes('ninjaGetCharacterModel')) return true
  const rendererDir = join(root, 'out/renderer/assets')
  if (!existsSync(rendererDir)) return true
  let hasCraft = false
  let hasNinja = false
  for (const file of readdirSync(rendererDir)) {
    if (!file.endsWith('.js')) continue
    const src = readFileSync(join(rendererDir, file), 'utf8')
    if (src.includes('craftModPool') || src.includes('craft-mod-pool') || src.includes('craftApply')) hasCraft = true
    if (src.includes('ninjaGetCharacterModel')) hasNinja = true
  }
  return !(hasCraft && hasNinja)
}

/** True when node_modules/electron was overwritten with a packaged Scalpel asar
 *  (e.g. old 0.9.16). In that case `electron .` ignores the repo out/ build. */
function electronDistIsHijacked() {
  const asarPath = join(electronDist, 'resources', 'app.asar')
  if (!existsSync(asarPath)) return false
  try {
    // Lazy require so launch still works if @electron/asar is missing.
    const asar = require('@electron/asar')
    const pkg = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'))
    return pkg?.name === 'scalpel'
  } catch {
    // Unreadable/locked asar that isn't Electron's tiny default — treat as hijacked.
    try {
      return lstatSync(asarPath).size > 1_000_000
    } catch {
      return false
    }
  }
}

function ensureCleanElectronBin() {
  if (!electronDistIsHijacked()) return electronBin
  mkdirSync(join(root, '.electron-clean'), { recursive: true })
  const cleanExe = join(CLEAN_ELECTRON_DIST, electronBinName)
  const cleanAsar = join(CLEAN_ELECTRON_DIST, 'resources', 'app.asar')
  const needsCopy =
    !existsSync(cleanExe) || (existsSync(cleanAsar) && electronDistIsHijackedPath(CLEAN_ELECTRON_DIST))
  if (needsCopy) {
    rmSync(CLEAN_ELECTRON_DIST, { recursive: true, force: true })
    cpSync(electronDist, CLEAN_ELECTRON_DIST, {
      recursive: true,
      filter: (src) => {
        const base = src.slice(electronDist.length).replace(/\\/g, '/')
        if (base === '/resources/app.asar') return false
        if (base.startsWith('/resources/app.asar.unpacked')) return false
        if (base.includes('hijacked')) return false
        return true
      },
    })
  }
  if (!existsSync(cleanExe)) {
    throw new Error(
      'Electron dist is hijacked by an old Scalpel app.asar and a clean copy could not be prepared. Delete node_modules/electron/dist/resources/app.asar (not the Beta install) and re-run npm install.',
    )
  }
  console.log('launch: using .electron-clean (stock Electron) — node_modules electron app.asar is a stale Scalpel build')
  return cleanExe
}

function electronDistIsHijackedPath(distDir) {
  const asarPath = join(distDir, 'resources', 'app.asar')
  if (!existsSync(asarPath)) return false
  try {
    const asar = require('@electron/asar')
    const pkg = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'))
    return pkg?.name === 'scalpel'
  } catch {
    return false
  }
}

async function ensureCoeData() {
  const coe = join(OUT_DIR, 'crafting-coe-poe2.json')
  if (!existsSync(coe)) {
    await runQuiet('node', ['scripts/build-coe-crafting-data.js'], root)
  }
}

async function ensurePluginsBuilt() {
  for (const pluginId of PLUGIN_IDS) {
    const pluginDir = join(root, 'plugins', pluginId)
    if (!existsSync(join(pluginDir, 'package.json'))) continue
    if (!existsSync(join(pluginDir, 'node_modules'))) {
      await runQuiet('npm', ['install'], pluginDir)
    }
    await runQuiet('npm', ['run', 'build'], pluginDir)
    if (!existsSync(join(pluginDir, 'dist/manifest.json'))) {
      copyFileSync(join(pluginDir, 'manifest.json'), join(pluginDir, 'dist/manifest.json'))
    }
    linkPluginDist(pluginId)
  }
  ensureInstalledJson()
}

async function main() {
  await ensureCoeData()
  await ensurePluginsBuilt()
  if (needsHostBuild()) {
    await runQuiet('npm', ['run', 'build'], root)
  }
  if (!existsSync(electronBin)) {
    throw new Error('Electron not installed. Run npm install in the repo once.')
  }
  // Close other Scalpel / repo Electron instances (not other apps using Electron).
  if (process.platform === 'win32') {
    await runQuiet('taskkill', ['/F', '/IM', 'Scalpel.exe', '/T']).catch(() => {})
    await runQuiet('powershell', [
      '-NoProfile',
      '-Command',
      "Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*scalpel-main*' } | Stop-Process -Force -ErrorAction SilentlyContinue",
    ]).catch(() => {})
  }
  // Give file locks a moment to drop after kill (hijacked app.asar is often locked).
  await new Promise((r) => setTimeout(r, 800))
  const bin = ensureCleanElectronBin()
  const child = spawn(bin, [root], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  })
  child.unref()
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
