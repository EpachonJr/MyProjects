@echo off
title Patrimony Dashboard - Personal Wealth Tracker
cd /d "%~dp0"
echo Starting Patrimony Dashboard (API + SQLite on port 3001, Web UI on http://localhost:5173)...
start "" "http://localhost:5173"
call npm.cmd run dev
pause
