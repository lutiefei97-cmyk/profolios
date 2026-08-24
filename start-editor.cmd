@echo off
setlocal
title Portfolio Content Editor

where python >nul 2>nul
if errorlevel 1 goto try_py
python "%~dp0tools\editor_server.py" --root "%~dp0." --open
goto finished

:try_py
where py >nul 2>nul
if errorlevel 1 goto missing_python
py -3 "%~dp0tools\editor_server.py" --root "%~dp0." --open
goto finished

:missing_python
echo [ERROR] Python 3 was not found.
echo Install Python 3, then double-click start-editor.cmd again.

:finished
echo.
pause
endlocal
