#!/usr/bin/env node
/**
 * Friend zip matching eniner/Scalpel-My-Version v1.3.2-my:
 * copy the live Windows install + AppData plugins, then zip for gh release.
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

const releaseTag = process.env.SCALPEL_RELEASE_TAG || 'v1.4.0-my'
const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
const liveApp = join(localAppData, 'Programs', 'Scalpel')
const pluginsSrc = join(appData, 'Scalpel', 'plugins')
const root = join(import.meta.dirname, '..')
const stageRoot = join(root, 'dist', 'portable-stage')
const appDirName = 'Scalpel-My-Version'
const stageApp = join(stageRoot, appDirName)
const zipOut = join(root, 'dist', `Scalpel-My-Version-${releaseTag}-Windows.zip`)

const PLUGIN_IDS = [
  'build-shopping-list',
  'currency-exchange',
  'ini-editor',
  'runeshape-checker',
  'scalpel-advisor',
  'scalpel-blueprints',
  'scalpel-codex',
  'scalpel-deals',
  'scalpel-dps',
  'scalpel-economy',
  'scalpel-filter-editor',
  'scalpel-harvest',
  'scalpel-importer',
  'scalpel-lab',
  'scalpel-meta',
  'scalpel-pob',
  'scalpel-quest-tracker',
  'scalpel-skill-dps',
  'scalpel-strats',
  'scalpel-timeless-jewels',
  'scalpel-timeless-poe2',
  'scalpel-warrants',
  'timeless-jewels',
  'well-tiers',
]

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function skipLiveName(name) {
  if (/^\d+$/.test(name)) return true
  if (name.startsWith('app.asar.bak')) return true
  if (name.endsWith('.bak')) return true
  return false
}

function writeShortcutPs1(dest) {
  const content = `param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [string]$ShortcutName = 'Scalpel My Version'
)

$ErrorActionPreference = 'Stop'
$exe = Join-Path $InstallDir 'Scalpel.exe'
if (-not (Test-Path $exe)) { throw "Scalpel.exe not found in $InstallDir" }

$ico = Join-Path $InstallDir 'Scalpel.ico'
if (-not (Test-Path $ico)) { $ico = Join-Path $InstallDir 'resources\\icon.ico' }
$iconLocation = if (Test-Path $ico) { $ico } else { "$exe,0" }

function New-ScalpelShortcut([string]$path) {
  $folder = Split-Path $path -Parent
  if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  $ws = New-Object -ComObject WScript.Shell
  $s = $ws.CreateShortcut($path)
  $s.TargetPath = $exe
  $s.WorkingDirectory = $InstallDir
  $s.IconLocation = $iconLocation
  $s.Description = 'Scalpel My Version ${releaseTag}'
  $s.Save()
  Write-Host "  shortcut: $path"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
New-ScalpelShortcut (Join-Path $desktop "$ShortcutName.lnk")
New-ScalpelShortcut (Join-Path $programs "$ShortcutName.lnk")
`
  writeFileSync(dest, content.replace(/\n/g, '\r\n'))
}

function pluginIdsPsLiteral() {
  return PLUGIN_IDS.map((id) => `'${id}'`).join(',')
}

function writeInstallBat(dest) {
  const content = `@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "INSTALL_DIR=%LOCALAPPDATA%\\Programs\\Scalpel-My-Version"
set "PLUGINS_DIR=%APPDATA%\\Scalpel\\plugins"

echo.
echo  ========================================
echo   Scalpel My Version  ${releaseTag}
echo   One-click install (no build required)
echo  ========================================
echo.

echo [1/4] Installing app to:
echo       %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
robocopy "%~dp0." "%INSTALL_DIR%" /E /XD bundled-plugins /NFL /NDL /NJH /NJS /nc /ns /np >nul
if errorlevel 8 (
  echo ERROR: Failed to copy app files.
  pause
  exit /b 1
)

echo [2/4] Installing bundled plugins...
if not exist "%PLUGINS_DIR%" mkdir "%PLUGINS_DIR%"
for %%P in (${PLUGIN_IDS.join(' ')}) do (
  if exist "%~dp0bundled-plugins\\%%P" (
    if not exist "%PLUGINS_DIR%\\%%P" mkdir "%PLUGINS_DIR%\\%%P"
    robocopy "%~dp0bundled-plugins\\%%P" "%PLUGINS_DIR%\\%%P" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$utf8=New-Object System.Text.UTF8Encoding $false; $ids=@(${pluginIdsPsLiteral()}); function Merge($file){ $cur=@(); if(Test-Path $file){try{$cur=Get-Content $file -Raw -Encoding UTF8|ConvertFrom-Json}catch{}}; if(-not($cur -is [System.Array])){$cur=@($cur)}; foreach($i in $ids){if($cur -notcontains $i){$cur+=$i}}; [IO.File]::WriteAllText($file, ($cur|ConvertTo-Json -Compress), $utf8)}; Merge '%PLUGINS_DIR%\\installed.json'; Merge '%PLUGINS_DIR%\\unpacked.json'"

echo [3/4] Creating Desktop + Start Menu icons...
powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\\Create-Shortcuts.ps1" "%INSTALL_DIR%"
if errorlevel 1 (
  echo WARNING: Shortcut creation failed. You can still launch:
  echo          %INSTALL_DIR%\\Scalpel.exe
)

echo [4/4] Launching Scalpel...
start "" "%INSTALL_DIR%\\Scalpel.exe"

echo.
echo  Done. Use the Desktop / Start Menu icon "Scalpel My Version" next time.
echo.
timeout /t 4 >nul
`
  writeFileSync(dest, content.replace(/\n/g, '\r\n'))
}

function writePortableLaunchBat(dest) {
  const content = `@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PLUGINS_DIR=%APPDATA%\\Scalpel\\plugins"
echo Seeding plugins into %%APPDATA%%\\Scalpel\\plugins ...
if not exist "%PLUGINS_DIR%" mkdir "%PLUGINS_DIR%"
for %%P in (${PLUGIN_IDS.join(' ')}) do (
  if exist "%~dp0bundled-plugins\\%%P" (
    if not exist "%PLUGINS_DIR%\\%%P" mkdir "%PLUGINS_DIR%\\%%P"
    robocopy "%~dp0bundled-plugins\\%%P" "%PLUGINS_DIR%\\%%P" /E /NFL /NDL /NJH /NJS /nc /ns /np >nul
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$utf8=New-Object System.Text.UTF8Encoding $false; $ids=@(${pluginIdsPsLiteral()}); function Merge($file){ $cur=@(); if(Test-Path $file){try{$cur=Get-Content $file -Raw -Encoding UTF8|ConvertFrom-Json}catch{}}; if(-not($cur -is [System.Array])){$cur=@($cur)}; foreach($i in $ids){if($cur -notcontains $i){$cur+=$i}}; [IO.File]::WriteAllText($file, ($cur|ConvertTo-Json -Compress), $utf8)}; Merge '%PLUGINS_DIR%\\installed.json'; Merge '%PLUGINS_DIR%\\unpacked.json'"

start "" "%~dp0Scalpel.exe"
`
  writeFileSync(dest, content.replace(/\n/g, '\r\n'))
}

function writeReadme(dest) {
  const text = `Scalpel My Version ${releaseTag}
================================

EASY INSTALL (recommended)
1. Unzip this folder anywhere
2. Double-click  Install Scalpel.bat
3. Use the new Desktop / Start Menu icon: "Scalpel My Version"

That installs to %LOCALAPPDATA%\\Programs\\Scalpel-My-Version,
copies all plugins, creates the Scalpel icon, and launches the app.
No Node.js, no npm, no build.

If you already installed an older My Version zip, run Install Scalpel.bat
again so new plugins are copied.

PORTABLE (no install)
- Double-click  Launch Scalpel (Portable).bat
  (seeds plugins into AppData, then runs from this folder)

REQUIREMENTS
- Windows 10/11 x64
- Path of Exile / Path of Exile 2

Based on upstream Scalpel (AGPL-3.0). Fork: https://github.com/eniner/Scalpel-My-Version
`
  writeFileSync(dest, text.replace(/\n/g, '\r\n'))
}

function copyLiveApp() {
  if (!existsSync(join(liveApp, 'Scalpel.exe'))) fail(`Missing ${liveApp}\\Scalpel.exe`)
  if (!existsSync(join(liveApp, 'resources', 'app.asar'))) fail(`Missing live app.asar`)

  mkdirSync(stageApp, { recursive: true })
  for (const name of readdirSync(liveApp)) {
    if (skipLiveName(name)) continue
    const src = join(liveApp, name)
    const dest = join(stageApp, name)
    const st = statSync(src)
    if (st.isDirectory()) {
      if (name === 'resources') {
        mkdirSync(dest, { recursive: true })
        for (const rName of readdirSync(src)) {
          if (skipLiveName(rName)) continue
          const rSrc = join(src, rName)
          const rDest = join(dest, rName)
          if (statSync(rSrc).isDirectory()) cpSync(rSrc, rDest, { recursive: true })
          else copyFileSync(rSrc, rDest)
        }
      } else {
        cpSync(src, dest, { recursive: true })
      }
    } else {
      copyFileSync(src, dest)
    }
  }

  const iconSrc = join(stageApp, 'resources', 'icon.ico')
  if (existsSync(iconSrc)) copyFileSync(iconSrc, join(stageApp, 'Scalpel.ico'))
}

function copyPlugins() {
  const bundled = join(stageApp, 'bundled-plugins')
  mkdirSync(bundled, { recursive: true })
  let copied = 0
  for (const id of PLUGIN_IDS) {
    const src = join(pluginsSrc, id)
    if (!existsSync(join(src, 'plugin.js'))) {
      console.warn(`skip plugin ${id} (no plugin.js in AppData)`)
      continue
    }
    const dest = join(bundled, id)
    mkdirSync(dest, { recursive: true })
    for (const name of readdirSync(src)) {
      if (name === 'storage.json' || name.endsWith('.map')) continue
      const from = join(src, name)
      if (!statSync(from).isFile()) continue
      copyFileSync(from, join(dest, name))
    }
    copied += 1
  }
  if (copied === 0) fail('No bundled plugins found in AppData')
  console.log(`Bundled ${copied} plugins`)
}

function assemble() {
  console.log(`Assembling ${releaseTag} from ${liveApp}`)
  if (existsSync(stageRoot)) rmSync(stageRoot, { recursive: true, force: true })
  mkdirSync(stageApp, { recursive: true })
  copyLiveApp()
  copyPlugins()
  writeShortcutPs1(join(stageApp, 'Create-Shortcuts.ps1'))
  writeInstallBat(join(stageApp, 'Install Scalpel.bat'))
  writePortableLaunchBat(join(stageApp, 'Launch Scalpel (Portable).bat'))
  writeReadme(join(stageApp, 'README-INSTALL.txt'))

  if (existsSync(zipOut)) rmSync(zipOut, { force: true })
  console.log(`Zipping → ${zipOut}`)
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${stageApp}' -DestinationPath '${zipOut}' -CompressionLevel Optimal -Force`,
    ],
    { stdio: 'inherit' },
  )
  if (ps.status !== 0) fail('Compress-Archive failed')
  const mb = (statSync(zipOut).size / (1024 * 1024)).toFixed(1)
  console.log(`Done: ${zipOut} (${mb} MB)`)
}

assemble()
