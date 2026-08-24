$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repositoryRoot
$gitSafeDirectoryArgs = @("-c", "safe.directory=$repositoryRoot")

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & git @gitSafeDirectoryArgs @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed or is not available in PATH."
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is not installed or is not available in PATH."
}

& python tools/build_simulator_bundle.py
if ($LASTEXITCODE -ne 0) {
    throw "Unable to build the simulator asset bundle."
}

$branchOutput = & git @gitSafeDirectoryArgs branch --show-current
if ($LASTEXITCODE -ne 0) {
    throw "Unable to determine the current Git branch."
}
$branch = ($branchOutput | Out-String).Trim()
if ($branch -ne "main") {
    throw "Publishing is only allowed from the main branch. Current branch: $branch"
}

$changes = @(& git @gitSafeDirectoryArgs status --short)
if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the repository status."
}

if ($changes.Count -eq 0) {
    Write-Host "No local changes. The website is already up to date." -ForegroundColor Green
    exit 0
}

Write-Host "The following changes will be published:" -ForegroundColor Cyan
$changes | ForEach-Object { Write-Host "  $_" }
Write-Host
$confirmation = Read-Host "Type Y to commit and publish"
if ($confirmation -notmatch '^[Yy]$') {
    Write-Host "Publish cancelled. No files were changed." -ForegroundColor Yellow
    exit 0
}

Invoke-Git -Arguments @("add", "-A")
& git @gitSafeDirectoryArgs diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No publishable changes after applying ignore rules." -ForegroundColor Yellow
    exit 0
}
if ($LASTEXITCODE -ne 1) {
    throw "Unable to inspect staged changes."
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Invoke-Git -Arguments @("commit", "-m", "Update website $timestamp")
Invoke-Git -Arguments @("push", "origin", "main")

Write-Host
Write-Host "Published successfully. GitHub Pages will update in a few minutes." -ForegroundColor Green
