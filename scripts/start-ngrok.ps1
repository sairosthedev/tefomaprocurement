# Start both ngrok tunnels (API and Frontend)
# Usage: .\scripts\start-ngrok.ps1

Write-Host "Starting ngrok tunnels..." -ForegroundColor Green
Write-Host ""

# Check if ngrok is available
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue

if (-not $ngrokPath) {
    Write-Host "ERROR: ngrok not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "To fix this:" -ForegroundColor Yellow
    Write-Host "1. Download ngrok from: https://ngrok.com/download" -ForegroundColor Cyan
    Write-Host "2. Extract ngrok.exe to a folder (e.g., C:\ngrok\)" -ForegroundColor Cyan
    Write-Host "3. Add it to PATH OR use one of these options:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option A - Add to PATH:" -ForegroundColor Green
    Write-Host "   - Open System Properties > Environment Variables" -ForegroundColor White
    Write-Host "   - Add the folder containing ngrok.exe to PATH" -ForegroundColor White
    Write-Host ""
    Write-Host "Option B - Update this script with full path:" -ForegroundColor Green
    Write-Host "   - Edit scripts\start-ngrok.ps1" -ForegroundColor White
    Write-Host "   - Replace 'ngrok' with full path like 'C:\ngrok\ngrok.exe'" -ForegroundColor White
    Write-Host ""
    Write-Host "Option C - Run manually:" -ForegroundColor Green
    Write-Host "   Open two terminals and run:" -ForegroundColor White
    Write-Host "   Terminal 1: ngrok http 8080" -ForegroundColor White
    Write-Host "   Terminal 2: ngrok http 5173" -ForegroundColor White
    Write-Host ""
    
    # Try common locations
    $commonPaths = @(
        "$env:USERPROFILE\Downloads\ngrok.exe",
        "$env:USERPROFILE\Desktop\ngrok.exe",
        "C:\ngrok\ngrok.exe",
        "C:\Program Files\ngrok\ngrok.exe",
        "C:\Program Files (x86)\ngrok\ngrok.exe"
    )
    
    Write-Host "Checking common locations..." -ForegroundColor Yellow
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            Write-Host "Found ngrok at: $path" -ForegroundColor Green
            Write-Host "You can update the script to use this path, or add it to PATH" -ForegroundColor Yellow
            $ngrokPath = $path
            break
        }
    }
    
    if (-not $ngrokPath) {
        pause
        exit 1
    }
}

# Use full path if found, otherwise use command name
$ngrokCmd = if ($ngrokPath -is [System.IO.FileInfo]) { $ngrokPath.FullName } else { "ngrok" }

Write-Host "Starting ngrok for API (port 8080)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$ngrokCmd http 8080" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting ngrok for Frontend (port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$ngrokCmd http 5173" -WindowStyle Normal

Write-Host ""
Write-Host "Both ngrok tunnels are starting in separate windows." -ForegroundColor Green
Write-Host "Copy the URLs from those windows and update your .env files." -ForegroundColor Yellow
Write-Host ""

