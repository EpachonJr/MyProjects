@echo off
setlocal

echo ========================================================
echo    PATRIMONY DASHBOARD - ATUALIZANDO GITHUB & VERCEL
echo ========================================================
echo.

set GIT_EXE=C:\Users\leovp\.git-bin\cmd\git.exe
set REPO_URL=https://github.com/EpachonJr/MyProjects.git

cd /d "%~dp0"

echo [*] Repositorio: %REPO_URL%
"%GIT_EXE%" remote remove origin >nul 2>&1
"%GIT_EXE%" remote add origin %REPO_URL%

echo [*] Preparando ramos main e master...
"%GIT_EXE%" branch -M main >nul 2>&1
"%GIT_EXE%" branch master >nul 2>&1

echo [*] Enviando codigo para o GitHub...
echo (Se uma janela do navegador abrir, basta autorizar o Git)
"%GIT_EXE%" push -u origin main
"%GIT_EXE%" push -u origin master

echo.
echo ========================================================
echo [SUCESSO] Codigo enviado com sucesso para o GitHub!
echo A Vercel ja iniciou o build automatico do seu app.
echo ========================================================
echo.
pause
