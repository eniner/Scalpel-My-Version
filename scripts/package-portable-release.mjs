#!/usr/bin/env node
/**
 * Assemble a one-click Windows portable package:
 *   unzip → double-click "Install Scalpel.bat" → desktop icon → play
 *
 * Uses dist/win-unpacked (Electron shell) + dist/v{version}/app.asar (full app)
 * + built plugin dists. Does not require npm on the end-user machine.
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  statSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const releaseTag = process.env.SCALPEL_RELEASE_TAG || `v${version}-my`

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

const winUnpacked = join(root, 'dist', 'win-unpacked')
const asarSrc = join(root, 'dist', `v${version}`, 'app.asar')
const asarUnpackedSrc = join(root, 'dist', `v${version}`, 'app.asar.unpacked')
const stageRoot = join(root, 'dist', 'portable-stage')
const appDirName = 'Scalpel-My-Version'
const stageApp = join(stageRoot, appDirName)
const zipOut = join(root, 'dist', `Scalpel-My-Version-${releaseTag}-Windows.zip`)

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function ensure() {
  if (!existsSync(join(winUnpacked, 'Scalpel.exe'))) {
    fail(`Missing Electron shell at ${winUnpacked}\\Scalpel.exe — run: npm run dist:win`)
  }
  if (!existsSync(asarSrc)) {
    fail(`Missing full app.asar at ${asarSrc} — run: npm run build && node scripts/pack-asar.js`)
  }
  for (const id of PLUGIN_IDS) {
    const pluginJs = join(root, 'plugins', id, 'dist', 'plugin.js')
    if (!existsSync(pluginJs)) fail(`Missing plugin build: ${pluginJs}`)
  }
}

function writeShortcutPs1(dest) {
  // Resolves OneDrive Desktop + Start Menu via .NET, then pins a .lnk that
  // uses Scalpel.exe's own embedded icon (most reliable on Windows).
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

function writeInstallBat(dest) {
  // Double-click installer: copies app to LocalAppData, seeds plugins, makes desktop icon, launches.
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
  "$p='%PLUGINS_DIR%\\installed.json'; $ids=@(${PLUGIN_IDS.map((id) => `'${id}'`).join(',')}); $cur=@(); if(Test-Path $p){try{$cur=Get-Content $p -Raw|ConvertFrom-Json}catch{}}; if(-not($cur -is [System.Array])){$cur=@()}; foreach($i in $ids){if($cur -notcontains $i){$cur+=$i}}; $cur|ConvertTo-Json|Set-Content -Encoding UTF8 $p"

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
  "$p='%PLUGINS_DIR%\\installed.json'; $ids=@(${PLUGIN_IDS.map((id) => `'${id}'`).join(',')}); $cur=@(); if(Test-Path $p){try{$cur=Get-Content $p -Raw|ConvertFrom-Json}catch{}}; if(-not($cur -is [System.Array])){$cur=@()}; foreach($i in $ids){if($cur -notcontains $i){$cur+=$i}}; $cur|ConvertTo-Json|Set-Content -Encoding UTF8 $p"

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

function assemble() {
  ensure()
  console.log(`Assembling portable package ${releaseTag}…`)
  if (existsSync(stageRoot)) rmSync(stageRoot, { recursive: true, force: true })
  mkdirSync(stageApp, { recursive: true })

  console.log('Copying Electron shell…')
  cpSync(winUnpacked, stageApp, { recursive: true })

  const resources = join(stageApp, 'resources')
  console.log('Installing full app.asar…')
  copyFileSync(asarSrc, join(resources, 'app.asar'))
  const unpackedDest = join(resources, 'app.asar.unpacked')
  if (existsSync(unpackedDest)) rmSync(unpackedDest, { recursive: true, force: true })
  if (existsSync(asarUnpackedSrc)) cpSync(asarUnpackedSrc, unpackedDest, { recursive: true })

  // Fork branding: beside the exe (shortcut-friendly) and in resources/
  const iconSrc = join(root, 'resources', 'icon.ico')
  if (existsSync(iconSrc)) {
    copyFileSync(iconSrc, join(resources, 'icon.ico'))
    copyFileSync(iconSrc, join(stageApp, 'Scalpel.ico'))
  }

  console.log('Bundling plugins…')
  const bundled = join(stageApp, 'bundled-plugins')
  mkdirSync(bundled, { recursive: true })
  for (const id of PLUGIN_IDS) {
    const dist = join(root, 'plugins', id, 'dist')
    const dest = join(bundled, id)
    mkdirSync(dest, { recursive: true })
    for (const name of readdirSync(dist)) {
      const src = join(dist, name)
      if (statSync(src).isFile()) copyFileSync(src, join(dest, name))
    }
  }

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
  console.log(`\nDone: ${zipOut} (${mb} MB)`)
  console.log('Users: download ZIP → unzip → double-click "Install Scalpel.bat"')
}

assemble()
