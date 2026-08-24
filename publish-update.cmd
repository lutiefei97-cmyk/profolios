@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\publish_update.ps1"
set "PUBLISH_EXIT=%ERRORLEVEL%"

echo.
if not "%PUBLISH_EXIT%"=="0" echo Publish did not finish. Read the message above.
pause
exit /b %PUBLISH_EXIT%
