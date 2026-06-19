@echo off
setlocal

where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0download-go-deps.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0download-go-deps.ps1"
)

endlocal
