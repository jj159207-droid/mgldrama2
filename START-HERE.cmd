@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title TAZA SITE MASTER - Client Setup

echo.
echo ============================================================
echo   TAZA SITE MASTER - ШИНЭ ХАРИЛЦАГЧИЙН СУУЛГАЦ
echo ============================================================
echo.

if not exist "%~dp0installer\TAZA-SETUP-V2.ps1" (
  echo [АЛДАА] installer\TAZA-SETUP-V2.ps1 олдсонгүй.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\TAZA-SETUP-V2.ps1"
set ERR=%ERRORLEVEL%

if not "%ERR%"=="0" (
  echo.
  echo [АЛДАА] Суулгац бүрэн дууссангүй. Дээрх алдааг шалгана уу.
  pause
  exit /b %ERR%
)

echo.
echo [OK] Суулгац дууслаа.
pause
exit /b 0
