@echo off
rem Inicia o servidor local do Agezim e abre o jogo no navegador padrao.
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8123/index.html
  node devserver.js
) else (
  echo Node.js nao encontrado. Abrindo index.html diretamente...
  start "" "%~dp0index.html"
)
