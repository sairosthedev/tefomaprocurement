@echo off
REM Batch script to start ngrok for API (port 3001)
REM Usage: scripts\start-ngrok-api.bat

echo Starting ngrok tunnel for API (port 3001)...
echo Make sure your API server is running on port 3001 first!
echo.

REM Check if ngrok is available
where ngrok >nul 2>&1
if errorlevel 1 (
    echo ERROR: ngrok not found in PATH
    echo Please install ngrok and add it to your PATH
    echo Or update this script with the full path to ngrok.exe
    exit /b 1
)

REM Start ngrok
ngrok http 3001

