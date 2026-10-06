@echo off
title Patrimony Dashboard - Cloud Deploy (Vercel)
cd /d "%~dp0"
echo ========================================================
echo   Patrimony Dashboard - 24/7 Cloud Deploy for iPhone
echo ========================================================
echo.
echo Step 1: Checking / logging in to Vercel (free account)...
call npx.cmd --yes vercel whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo Opening browser to sign in to Vercel ^(free with Google or GitHub^)...
    call npx.cmd --yes vercel login
)
echo.
echo Step 2: Deploying production app + API to Vercel Cloud...
call npx.cmd --yes vercel --prod --yes
echo.
echo ========================================================
echo   DONE! Open the Production URL above in Safari on your
echo   iPhone, tap Share -^> "Add to Home Screen".
echo ========================================================
pause
