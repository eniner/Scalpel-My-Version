@echo off
cd /d "%~dp0"
powershell -NoProfile -WindowStyle Hidden -Command "node scripts/launch-built.mjs"
if errorlevel 1 (
  echo Scalpel failed to start. Open a terminal in this folder and run: node scripts/launch-built.mjs
  pause
)
