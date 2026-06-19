$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Addr = if ($env:ADDR) { $env:ADDR } else { ":8080" }
$Url = if ($env:URL) { $env:URL } else { "http://localhost:8080" }

& (Join-Path $PSScriptRoot "build-platform.ps1")

$BinDir = Join-Path $Root ".bin"
$ApiExe = Join-Path $BinDir "apiserver.exe"
$DataDir = Join-Path $Root "data"
$WebDir = Join-Path (Join-Path $Root "web") "dist"

Write-Host ">> Starting platform server on $Addr"
$proc = $null
if (Test-Path $ApiExe) {
    $startArgs = @{
        FilePath = $ApiExe
        ArgumentList = @("--addr", $Addr, "--data", $DataDir, "--web-dir", $WebDir)
        WorkingDirectory = $Root
        PassThru = $true
    }
    $proc = Start-Process @startArgs
}
else {
    Write-Warning "API executable was not found at $ApiExe. Falling back to 'go run ./apiserver'."
    $startArgs = @{
        FilePath = "go"
        ArgumentList = @("run", "./apiserver", "--addr", $Addr, "--data", $DataDir, "--web-dir", $WebDir)
        WorkingDirectory = $Root
        PassThru = $true
    }
    $proc = Start-Process @startArgs
}

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
        throw "Platform server failed to become healthy at $Url"
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
