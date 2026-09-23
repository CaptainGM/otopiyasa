
$ErrorActionPreference = "Continue"
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
node scripts\scheduled-scrape.mjs
