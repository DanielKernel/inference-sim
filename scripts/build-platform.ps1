$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

$BinDir = Join-Path $Root ".bin"
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir | Out-Null
}
$ApiExe = Join-Path $BinDir "apiserver.exe"

Write-Host ">> Building Go API server"
go build -o "$ApiExe" ./apiserver
if (-not (Test-Path $ApiExe)) {
    throw "构建完成后未找到 API 可执行文件：$ApiExe"
}

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
Write-Host "  API: $ApiExe"
Write-Host "  Web: $Root\web\dist"
