$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host ">> Downloading Go dependencies for platform module"
Push-Location $Root
try {
    go mod download
}
finally {
    Pop-Location
}

$BaseRoot = Join-Path (Join-Path $Root "third_party") "inference-sim"
if (Test-Path (Join-Path $BaseRoot "go.mod")) {
    Write-Host ">> Downloading Go dependencies for base module"
    Push-Location $BaseRoot
    try {
        go mod download
    }
    finally {
        Pop-Location
    }
}

Write-Host "Go dependency download complete."
