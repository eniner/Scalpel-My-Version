#!/usr/bin/env node
/**
 * Build (if needed), link plugins, launch Scalpel from out/ — no dev server, no watch.
 */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_IDS = [
  'build-shopping-list',
  'scalpel-lab',
  'scalpel-economy',
  'scalpel-harvest',
  'scalpel-advisor',
  'runeshape-checker',
  'well-tiers',
  'scalpel-deals',
]
const OUT_DIR = join(root, 'src', 'shared', 'data', 'crafting')
const appDataPlugins = join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Scalpel', 'plugins')
const electronBin = join(
  root,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
)

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
    if (stat.isSymbolicLink() || stat.isJunction() || stat.isDirectory()) {
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
  const rendererDir = join(root, 'out/renderer/assets')
  if (!existsSync(rendererDir)) return true
  for (const file of readdirSync(rendererDir)) {
    if (!file.endsWith('.js')) continue
    const src = readFileSync(join(rendererDir, file), 'utf8')
    if (src.includes('craftModPool') || src.includes('craft-mod-pool') || src.includes('craftApply')) return false
  }
  return true
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
  const child = spawn(electronBin, ['.'], {
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
