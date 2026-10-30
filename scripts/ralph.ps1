<#
.SYNOPSIS
    Ralph Loop runner for REWIND Agent Lab (Windows PowerShell).
.DESCRIPTION
    Runs an autonomous coding agent loop with fresh context on each iteration,
    reading state and tasks from PRD.md until all tasks are marked complete or max iterations reached.
.PARAMETER MaxIterations
    Maximum number of loop cycles (default: 15).
.PARAMETER AgentCommand
    Command to invoke the AI agent. Defaults to "claude" or custom CLI.
#>
param(
    [int]$MaxIterations = 15,
    [string]$AgentCommand = "claude"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$PRDPath = Join-Path $RepoRoot "PRD.md"
$PromptPath = Join-Path $PSScriptRoot "ralph\prompt.md"

if (-not (Test-Path $PRDPath)) {
    Write-Error "PRD.md not found at $PRDPath"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Starting Ralph Loop for REWIND Agent Lab" -ForegroundColor Cyan
Write-Host "   Target PRD: $PRDPath" -ForegroundColor Cyan
Write-Host "   Max Iterations: $MaxIterations" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$iteration = 1

while ($iteration -le $MaxIterations) {
    Write-Host "`n>>> [Iteration $iteration / $MaxIterations] Starting fresh agent cycle..." -ForegroundColor Yellow
    
    # Check if any unchecked tasks remain in PRD.md
    $prdContent = Get-Content $PRDPath -Raw
    if ($prdContent -notmatch "- \[ \]") {
        Write-Host "`n🎉 All tasks in PRD.md are completed! Halting Ralph Loop." -ForegroundColor Green
        break
    }

    # Verify tests and syntax are in good state before launch
    Write-Host "Verifying current baseline..." -ForegroundColor Gray
    & node --test
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Baseline tests failed before iteration! Agent must fix."
    }

    Write-Host "Launching agent with fresh context prompt: $PromptPath" -ForegroundColor Yellow
    
    # Example agent invocation: replace with your chosen agent CLI (e.g. claude, goose, or custom script)
    # Get-Content $PromptPath | & $AgentCommand -p
    
    Write-Host "Agent iteration $iteration completed. Reviewing PRD status..." -ForegroundColor Gray
    $iteration++
}

Write-Host "`nRalph Loop finished." -ForegroundColor Cyan
