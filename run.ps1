Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RootDir = "c:\Users\Japne\OneDrive\Desktop\inx\AutoReach-AI"

function Get-PythonExecutable {
    return "C:\Python313\python.exe"
}

$PythonBin = Get-PythonExecutable
if (-not $PythonBin) {
    Write-Host 'Error: Python 3.10+ not found on PATH. Install it and try again.' -ForegroundColor Red
    exit 1
}

Write-Host '───────────────────────────────────────────────' -ForegroundColor Cyan
Write-Host '     CampaignX — Starting Up                   ' -ForegroundColor Cyan
Write-Host '───────────────────────────────────────────────' -ForegroundColor Cyan
Write-Host "       Using Python: $PythonBin" -ForegroundColor Green

function Run-InDir($path, [ScriptBlock]$action) {
    Push-Location $path
    try {
        & $action
    } finally {
        Pop-Location
    }
}

function Start-AgentPrewarmJob {
    param (
        [string]$Endpoint,
        [int]$MaxAttempts = 60,
        [int]$DelayMs = 1000
    )

    $existing = Get-Job -Name "CampaignXAgentPrewarm" -ErrorAction SilentlyContinue
    if ($existing) {
        $existing | Stop-Job -ErrorAction SilentlyContinue
        $existing | Remove-Job -Force -ErrorAction SilentlyContinue
    }

    Start-Job -Name "CampaignXAgentPrewarm" -ScriptBlock {
        param($endpoint, $maxAttempts, $delayMs)
        for ($attempt = 0; $attempt -lt $maxAttempts; $attempt++) {
            $ts = [int](Get-Date -UFormat "%s")
            $uri = "$endpoint?ts=$ts"
            try {
                Invoke-WebRequest -Uri $uri -TimeoutSec 5 | Out-Null
                return
            } catch {
                Start-Sleep -Milliseconds $delayMs
            }
        }
    } -ArgumentList $Endpoint, $MaxAttempts, $DelayMs | Out-Null
}

Write-Host "`n[1/3] Installing Python backend dependencies..." -ForegroundColor Green
Run-InDir "$RootDir\backend" { & $PythonBin -m pip install -r requirements.txt --quiet }

Write-Host "`n[2/3] Installing frontend Node.js dependencies..." -ForegroundColor Green
Run-InDir "$RootDir\frontend" { npm install --silent }

Write-Host "`n[3/3] Starting CampaignX frontend dev server..." -ForegroundColor Green
Write-Host '       Pre-warming backend connection in the background...' -ForegroundColor Cyan
Start-AgentPrewarmJob -Endpoint "http://localhost:3000/api/agent/ws"
Run-InDir "$RootDir\frontend" { npm run dev }
