# PowerShell script to start ngrok for API (port 3001)
# Usage: .\scripts\start-ngrok-api.ps1

Write-Host "Starting ngrok tunnel for API (port 3001)..." -ForegroundColor Green
Write-Host "Make sure your API server is running on port 3001 first!" -ForegroundColor Yellow
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
ngrok http 3001

