param(
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,
    [ValidateSet("production", "local")]
    [string]$ApiTarget = "production"
)

$frontendEnv = Join-Path $PSScriptRoot "frontend\.env"
$backendEnv = Join-Path $PSScriptRoot "backend\.env"

if ($ApiTarget -eq "production") {
    $apiLink = "https://api.getopenmap.com"
} else {
    $apiLink = "http://localhost:8080"
}

@"
VITE_API_LINK=$apiLink
VITE_API_DEV_KEY=$ApiKey
"@ | Set-Content -Path $frontendEnv -Encoding utf8

@"
PORT=8080
API_DEV_KEY=$ApiKey
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
"@ | Set-Content -Path $backendEnv -Encoding utf8

Write-Host "Created frontend/.env (API: $apiLink)"
Write-Host "Created backend/.env"
Write-Host ""
Write-Host "Next:"
Write-Host "  Terminal 1 (optional if using production API): cd backend; npm run dev"
Write-Host "  Terminal 2: cd frontend; npm run web"
Write-Host "  Open http://localhost:5173"
