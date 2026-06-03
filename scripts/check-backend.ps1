# Kiem tra backend Free Traffic
$ErrorActionPreference = 'Stop'
$healthUrl = 'http://127.0.0.1:4000/api/health'

Write-Host "Checking $healthUrl ..."
try {
    $h = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    Write-Host "OK status=$($h.status) apiVersion=$($h.apiVersion)"
    if ($h.features -contains 'backlinks-scan') {
        Write-Host "OK backlinks-scan"
    } else {
        Write-Host "FAIL: thieu feature backlinks-scan - restart backend"
        exit 1
    }
} catch {
    Write-Host "FAIL: backend khong chay tren port 4000: $($_.Exception.Message)"
    exit 1
}
