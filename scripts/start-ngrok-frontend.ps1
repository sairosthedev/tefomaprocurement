# PowerShell script to start ngrok for Frontend (port 5173)
# Usage: .\scripts\start-ngrok-frontend.ps1

Write-Host "Starting ngrok tunnel for Frontend (port 5173)..." -ForegroundColor Green
Write-Host "Make sure your frontend server is running on port 5173 first!" -ForegroundColor Yellow
Write-Host ""

# Check if ngrok is available
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue

if (-not $ngrokPath) {
    Write-Host "ERROR: ngrok not found in PATH" -ForegroundColor Red
    Write-Host "Please install ngrok and add it to your PATH" -ForegroundColor Yellow
    Write-Host "Or update this script with the full path to ngrok.exe" -ForegroundColor Yellow
    exit 1
}

# Start ngrok
ngrok http 5173

