@echo off
REM start.bat — Windows launcher for backend + frontend
REM Run from the repo root (folder containing ThePipelineComplete\ and UI\)

set ROOT=%~dp0
set PIPELINE=%ROOT%ThePipelineComplete
set FRONTEND=%ROOT%UI\frontend

echo [start] Launching FastAPI backend on http://localhost:8000
start "NeuroSight Backend" cmd /k "cd /d %PIPELINE% && uvicorn server:app --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo [start] Launching Next.js frontend on http://localhost:3000
start "NeuroSight Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"

echo.
echo Both servers starting in separate windows.
echo   Backend  -^> http://localhost:8000
echo   Frontend -^> http://localhost:3000
echo.
echo Close both windows or press Ctrl+C in each to stop.
pause
