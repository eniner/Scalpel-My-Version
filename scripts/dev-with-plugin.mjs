#!/usr/bin/env node
/**
 * One-command dev: build plugins + junction + host dev + plugin watch.
 * Run from repo root: node scripts/dev-with-plugin.mjs
 */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_IDS = [
  'build-shopping-list',
  'scalpel-lab',
  'scalpel-economy',
  'runeshape-checker',
  'well-tiers',
]
const appDataPlugins = join(
  process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
  'Scalpel',
  'plugins',
)

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true })
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
    if (stat.isSymbolicLink() || stat.isJunction()) {
      rmSync(appDataPlugin, { recursive: true, force: true })
    } else if (stat.isDirectory()) {
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
  ids = ids.filter((id) => id !== 'craft-of-exile')
  for (const id of PLUGIN_IDS) {
    if (!ids.includes(id)) ids.push(id)
  }
  writeFileSync(installedPath, `${JSON.stringify(ids, null, 2)}\n`)
  const legacy = join(appDataPlugins, 'craft-of-exile')
  if (existsSync(legacy)) {
    try {
      rmSync(legacy, { recursive: true, force: true })
    } catch {
      /* best effort */
    }
  }
}

async function main() {
  for (const pluginId of PLUGIN_IDS) {
    const pluginDir = join(root, 'plugins', pluginId)
    if (!existsSync(join(pluginDir, 'package.json'))) continue
    console.log(`[dev-with-plugin] building ${pluginId}…`)
    if (!existsSync(join(pluginDir, 'node_modules'))) {
      await run('npm', ['install'], pluginDir)
    }
    await run('npm', ['run', 'build'], pluginDir)
    const pluginDist = join(pluginDir, 'dist')
    if (!existsSync(join(pluginDist, 'manifest.json'))) {
      copyFileSync(join(pluginDir, 'manifest.json'), join(pluginDist, 'manifest.json'))
    }
    console.log(`[dev-with-plugin] linking ${pluginId} dist → AppData…`)
    linkPluginDist(pluginId)
  }
  ensureInstalledJson()
  for (const pluginId of PLUGIN_IDS) {
    const pluginDir = join(root, 'plugins', pluginId)
    if (!existsSync(join(pluginDir, 'package.json'))) continue
    console.log(`[dev-with-plugin] starting watch for ${pluginId}…`)
    spawn('npm', ['run', 'dev'], { cwd: pluginDir, stdio: 'inherit', shell: true, detached: true }).unref()
  }
  console.log('[dev-with-plugin] starting Scalpel dev…')
  await run('npm', ['run', 'dev'], root)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
