@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\new-client-setup.ps1"
if errorlevel 1 (
  echo.
  echo [ALDAA] Setup duusaagui. Deerkh aldaag zasna uu.
  pause
  exit /b 1
)
echo.
echo [OK] Client setup duuslaa.
pause
