@echo off
REM Start both ngrok tunnels (API and Frontend) in separate windows
REM Usage: scripts\start-ngrok.bat

echo Starting ngrok tunnels...
echo.

REM Check if ngrok is available
where ngrok >nul 2>&1
if errorlevel 1 (
    echo ERROR: ngrok not found in PATH
    echo Please install ngrok and add it to your PATH
    pause
    exit /b 1
)

echo Starting ngrok for API (port 8080)...
start "Ngrok API (8080)" cmd /k "ngrok http 8080"

timeout /t 2 /nobreak >nul

echo Starting ngrok for Frontend (port 5173)...
start "Ngrok Frontend (5173)" cmd /k "ngrok http 5173"

echo.
echo Both ngrok tunnels are starting in separate windows.
echo Copy the URLs from those windows and update your .env files.
echo.
pause

