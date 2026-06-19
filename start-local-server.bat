@echo off
setlocal

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

echo Starting the local website server...
echo Keep the server window open while viewing the page.

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo The website server is already running.
  start "" "http://127.0.0.1:5174/"
  endlocal
  exit /b 0
)

start "Planet Website Dev Server" /D "%~dp0" cmd /k "npm run dev -- --host 0.0.0.0 --port 5174"

timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5174/"

echo Opened http://127.0.0.1:5174/
echo If the page is still loading, wait a few seconds and refresh.

endlocal
