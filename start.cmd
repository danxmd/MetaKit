@echo off
rem Starts MetaKit: double-click this file, or run "start.cmd --preview" for the production build.
cd /d "%~dp0"
where node >nul 2>nul || (
  echo MetaKit needs Node.js 22 or newer. Get it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
node scripts\start.js %*
if errorlevel 1 (
  pause
  exit /b 1
)
