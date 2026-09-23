@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==========================================
echo   HEADLINE OR HYPE? - Three.js prototype
echo ==========================================
echo.
echo Project directory:
cd
echo.
echo Starting Vite from THIS directory.
echo Do not run Vite from a university web/home directory.
echo.
call npm run dev
pause
