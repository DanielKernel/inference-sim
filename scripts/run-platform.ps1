$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Addr = if ($env:ADDR) { $env:ADDR } else { ":8080" }
$Url = if ($env:URL) { $env:URL } else { "http://localhost:8080" }

& (Join-Path $PSScriptRoot "build-platform.ps1")

Write-Host ">> Starting platform server on $Addr"
$apiExe = Join-Path $Root ".bin\apiserver.exe"
$proc = Start-Process -FilePath $apiExe `
    -ArgumentList @("--addr", $Addr, "--data", (Join-Path $Root "data"), "--web-dir", (Join-Path $Root "web\dist")) `
    -PassThru

try {
    Write-Host ">> Waiting for server health check"
    $healthy = $false
    for ($i = 0; $i -lt 40; $i++) {
        try {
            Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing | Out-Null
            $healthy = $true
            break
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $healthy) {
        throw "platform server failed to become healthy at $Url"
    }

    Write-Host ">> Opening browser: $Url"
    Start-Process $Url | Out-Null

    Write-Host ""
    Write-Host "Platform is running:"
    Write-Host "  Web UI: $Url"
    Write-Host "  API:    $Url/api/config"
    Write-Host ""
    Write-Host "Press Ctrl+C to stop."

    Wait-Process -Id $proc.Id
}
finally {
    if ($null -ne $proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
}
