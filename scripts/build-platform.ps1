$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$BinDir = Join-Path $Root ".bin"
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir | Out-Null
}

Write-Host ">> Building Go API server"
go build -o (Join-Path $BinDir "apiserver.exe") ./apiserver

Write-Host ">> Building web app"
Push-Location (Join-Path $Root "web")
try {
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    npm run build
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Build complete:"
Write-Host "  API: $Root\.bin\apiserver.exe"
Write-Host "  Web: $Root\web\dist"
