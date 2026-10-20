param([int]$Port = 4174)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    node tools/build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Website build failed.' }
    $env:PORT = $Port.ToString()
    node tools/server.mjs
} finally {
    Pop-Location
}
