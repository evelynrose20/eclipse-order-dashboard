@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-api-manager.ps1"
if errorlevel 1 pause
